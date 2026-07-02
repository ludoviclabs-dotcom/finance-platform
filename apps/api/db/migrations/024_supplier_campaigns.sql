-- Migration 024 — Campagnes de collecte fournisseurs (T7.3).
--
-- supplier_campaigns : campagne de collecte centralisée (nom, exercice, date
-- limite) regroupant des invitations tokenisées. Relances par paliers
-- (J-14 / J-7 / deadline) via le centre de notifications in-app (021) et
-- e-mail fournisseur optionnel (EMAIL_ENABLED, SMTP stdlib).
--
-- Extensions des tables Phase 4 :
--   - supplier_questionnaire_tokens.campaign_id : rattachement à la campagne
--     (le champ texte libre `campaign` est conservé pour compatibilité)
--   - supplier_questionnaire_tokens.viewed_at : première consultation du
--     questionnaire public (distinction pending / viewed / completed)
--   - supplier_answers.review_status : revue obligatoire avant intégration
--     (pattern gate FEC/imports — rien n'alimente le Scope 3 sans validation)

CREATE TABLE IF NOT EXISTS supplier_campaigns (
    id             BIGSERIAL PRIMARY KEY,
    company_id     INTEGER NOT NULL,
    name           TEXT NOT NULL,
    exercise_year  INTEGER,
    deadline       DATE,
    status         TEXT NOT NULL DEFAULT 'active',
    reminder_stage TEXT NOT NULL DEFAULT '',
    created_by     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at      TIMESTAMPTZ,
    CONSTRAINT supplier_campaign_status_check CHECK (status IN ('active', 'closed')),
    CONSTRAINT supplier_campaign_stage_check CHECK (reminder_stage IN ('', 'j14', 'j7', 'deadline'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_campaigns_company
    ON supplier_campaigns(company_id, status, deadline);

ALTER TABLE supplier_questionnaire_tokens ADD COLUMN IF NOT EXISTS campaign_id BIGINT;
ALTER TABLE supplier_questionnaire_tokens ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_supplier_tokens_campaign
    ON supplier_questionnaire_tokens(campaign_id);

ALTER TABLE supplier_answers ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE supplier_answers ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE supplier_answers ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE supplier_answers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_answer_review_check') THEN
    ALTER TABLE supplier_answers ADD CONSTRAINT supplier_answer_review_check
      CHECK (review_status IN ('pending', 'accepted', 'flagged'));
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER — première consultation du questionnaire public
-- ──────────────────────────────────────────────────────────────────────────
-- Même pattern que resolve_supplier_token (008b) : l'endpoint public
-- GET /q/{token} n'a pas de contexte tenant, RLS bloquerait l'UPDATE.
-- Idempotent : ne stampe que la PREMIÈRE consultation.

CREATE OR REPLACE FUNCTION public.mark_supplier_token_viewed(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE supplier_questionnaire_tokens
    SET viewed_at = now()
    WHERE token = p_token AND viewed_at IS NULL;
$$;

COMMENT ON FUNCTION public.mark_supplier_token_viewed(text) IS
    'Stampe la première consultation d''un questionnaire fournisseur public — SECURITY DEFINER, '
    'bypasse RLS intentionnellement (endpoint /q/{token} sans JWT). Écrit uniquement viewed_at.';

ALTER TABLE supplier_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supplier_campaigns' AND policyname='tenant_isolation_supplier_campaigns') THEN
    CREATE POLICY tenant_isolation_supplier_campaigns ON supplier_campaigns
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supplier_campaigns' AND policyname='tenant_isolation_supplier_campaigns_ins') THEN
    CREATE POLICY tenant_isolation_supplier_campaigns_ins ON supplier_campaigns
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supplier_campaigns' AND policyname='tenant_isolation_supplier_campaigns_upd') THEN
    CREATE POLICY tenant_isolation_supplier_campaigns_upd ON supplier_campaigns
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='supplier_campaigns' AND policyname='tenant_isolation_supplier_campaigns_del') THEN
    CREATE POLICY tenant_isolation_supplier_campaigns_del ON supplier_campaigns
      FOR DELETE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
