-- Migration 012 — Rôle « Auditeur invité » (T2.2 du PLAN_ACTION_CARBONCO).
--
-- Un lien d'accès lecture seule, scopé à une company, avec expiration (30 j par
-- défaut) et révocable. Le token (64 hex) est résolu par les endpoints publics
-- /auditor/public/{token} qui n'ont PAS de JWT — donc pas de contexte tenant en
-- session. On suit le pattern des tokens fournisseurs (008b) : RLS ENABLE +
-- policy d'isolation pour les endpoints admin, et fonctions SECURITY DEFINER
-- pour la résolution/journalisation publique (bypass RLS intentionnel, bornées
-- aux colonnes nécessaires).

CREATE TABLE IF NOT EXISTS auditor_invites (
    id               BIGSERIAL PRIMARY KEY,
    company_id       INTEGER NOT NULL,
    token            TEXT NOT NULL UNIQUE,
    email            TEXT,
    label            TEXT,
    created_by       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at       TIMESTAMPTZ NOT NULL,
    revoked_at       TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    access_count     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auditor_invites_company ON auditor_invites(company_id);

-- ── RLS (endpoints admin avec contexte tenant) ──────────────────────────────
ALTER TABLE auditor_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditor_invites' AND policyname = 'tenant_isolation_auditor'
  ) THEN
    CREATE POLICY tenant_isolation_auditor ON auditor_invites
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditor_invites' AND policyname = 'tenant_isolation_auditor_ins'
  ) THEN
    CREATE POLICY tenant_isolation_auditor_ins ON auditor_invites
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditor_invites' AND policyname = 'tenant_isolation_auditor_upd'
  ) THEN
    CREATE POLICY tenant_isolation_auditor_upd ON auditor_invites
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;

-- ── Journal d'audit : nouveaux types d'événements ───────────────────────────
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_eventtype_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_eventtype_check CHECK (event_type IN (
    'ingest','upload','cache_clear','login','export','validation','error',
    '2fa_enroll','2fa_success','2fa_fail','2fa_recovery',
    'auditor_invite','auditor_access'
));

-- ── Résolution publique du token (SECURITY DEFINER, bypass RLS) ─────────────
CREATE OR REPLACE FUNCTION public.resolve_auditor_token(p_token text)
RETURNS TABLE (
    id           bigint,
    company_id   int,
    email        text,
    label        text,
    expires_at   timestamptz,
    revoked_at   timestamptz,
    access_count int,
    company_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ai.id, ai.company_id, ai.email, ai.label, ai.expires_at, ai.revoked_at,
           ai.access_count, c.name::text AS company_name
    FROM auditor_invites ai
    JOIN companies c ON c.id = ai.company_id
    WHERE ai.token = p_token
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_auditor_token(text) IS
    'Résolution publique du token auditeur — SECURITY DEFINER, bypasse RLS. '
    'Ne retourne que les métadonnées de l''invitation (aucune donnée métier).';

-- Enregistre une consultation (last_accessed_at + compteur), bypass RLS.
CREATE OR REPLACE FUNCTION public.touch_auditor_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE auditor_invites
       SET last_accessed_at = now(), access_count = access_count + 1
     WHERE token = p_token AND revoked_at IS NULL AND expires_at > now();
$$;

COMMENT ON FUNCTION public.touch_auditor_token(text) IS
    'Incrémente le compteur d''accès d''un token auditeur valide — SECURITY DEFINER.';
