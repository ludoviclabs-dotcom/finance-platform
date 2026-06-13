-- Migration 016 — Sessions du wizard VSME (T3.4).
--
-- Persiste la progression du parcours « VSME en 10 étapes » par organisation :
-- étape courante, état JSONB (valeurs saisies par étape), % de progression.
-- UNIQUE (company_id) : une session active par organisation (reprise = chargement
-- de la ligne). RLS (pattern 008b). Les facts ne sont émis qu'au `complete`.

CREATE TABLE IF NOT EXISTS vsme_wizard_sessions (
    id           BIGSERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL UNIQUE,
    step         INTEGER NOT NULL DEFAULT 1,
    state        JSONB NOT NULL DEFAULT '{}'::jsonb,
    progress_pct INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vsme_wizard_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vsme_wizard_sessions' AND policyname = 'tenant_isolation_vsme_wizard'
  ) THEN
    CREATE POLICY tenant_isolation_vsme_wizard ON vsme_wizard_sessions
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vsme_wizard_sessions' AND policyname = 'tenant_isolation_vsme_wizard_ins'
  ) THEN
    CREATE POLICY tenant_isolation_vsme_wizard_ins ON vsme_wizard_sessions
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vsme_wizard_sessions' AND policyname = 'tenant_isolation_vsme_wizard_upd'
  ) THEN
    CREATE POLICY tenant_isolation_vsme_wizard_upd ON vsme_wizard_sessions
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
