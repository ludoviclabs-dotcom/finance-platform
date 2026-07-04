-- Migration 023 — Suivi des dépôts BEGES (T7.2).
--
-- beges_filings : historique des bilans BEGES déposés par organisation (année
-- de référence, date de dépôt déclarée par l'utilisateur, référence ADEME,
-- lien optionnel vers l'export généré). L'échéance suivante (+4 ans pour une
-- entreprise, art. L229-25) est calculée à l'enregistrement ; les rappels de
-- renouvellement (J-180 / J-30 / échéance atteinte) alimentent le centre de
-- notifications in-app (alert_notifications, migration 021).
-- Par-organisation → RLS (pattern 008b/021).

CREATE TABLE IF NOT EXISTS beges_filings (
    id             BIGSERIAL PRIMARY KEY,
    company_id     INTEGER NOT NULL,
    exercise_year  INTEGER NOT NULL,
    filed_at       DATE NOT NULL,
    next_due_at    DATE NOT NULL,
    ademe_ref      TEXT,
    package_hash   TEXT,
    total_tco2e    NUMERIC(14, 3),
    notes          TEXT,
    reminder_stage TEXT NOT NULL DEFAULT '',
    created_by     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT beges_filing_year_check CHECK (exercise_year BETWEEN 2000 AND 2100),
    CONSTRAINT beges_filing_stage_check CHECK (reminder_stage IN ('', 'j180', 'j30', 'overdue')),
    UNIQUE (company_id, exercise_year)
);

CREATE INDEX IF NOT EXISTS idx_beges_filings_company ON beges_filings(company_id, next_due_at DESC);

ALTER TABLE beges_filings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='beges_filings' AND policyname='tenant_isolation_beges_filings') THEN
    CREATE POLICY tenant_isolation_beges_filings ON beges_filings
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='beges_filings' AND policyname='tenant_isolation_beges_filings_ins') THEN
    CREATE POLICY tenant_isolation_beges_filings_ins ON beges_filings
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='beges_filings' AND policyname='tenant_isolation_beges_filings_upd') THEN
    CREATE POLICY tenant_isolation_beges_filings_upd ON beges_filings
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='beges_filings' AND policyname='tenant_isolation_beges_filings_del') THEN
    CREATE POLICY tenant_isolation_beges_filings_del ON beges_filings
      FOR DELETE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
