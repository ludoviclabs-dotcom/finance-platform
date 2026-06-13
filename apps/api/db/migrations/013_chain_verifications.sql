-- Migration 013 — Vérifications planifiées de la chaîne d'intégrité (T2.5).
--
-- Un job quotidien (scripts/run_chain_verifications.py via .github/workflows/
-- chain-verify.yml) appelle verify_chain() par organisation et horodate le
-- résultat ici. Le dashboard lit la dernière ligne pour afficher un badge de
-- confiance ; un résultat ok=false déclenche un audit_event d'erreur.

CREATE TABLE IF NOT EXISTS chain_verifications (
    id          BIGSERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    ok          BOOLEAN NOT NULL,
    broken_at   BIGINT,
    checked     INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chain_verif_company
    ON chain_verifications(company_id, verified_at DESC);

ALTER TABLE chain_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chain_verifications' AND policyname = 'tenant_isolation_chainv'
  ) THEN
    CREATE POLICY tenant_isolation_chainv ON chain_verifications
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chain_verifications' AND policyname = 'tenant_isolation_chainv_ins'
  ) THEN
    CREATE POLICY tenant_isolation_chainv_ins ON chain_verifications
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
