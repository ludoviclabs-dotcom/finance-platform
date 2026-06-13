-- Migration 015 — Valeurs VSME par organisation (T3.2).
--
-- Stocke les datapoints VSME renseignés/non-applicables par company : saisie
-- guidée, justification de non-applicabilité, et lien vers le fact chaîné émis
-- (fact_event_id). Le catalogue (014) est global ; CETTE table est par-tenant →
-- RLS (pattern 008b). UNIQUE (company_id, datapoint_code) : une valeur par
-- datapoint et par organisation (UPSERT).

CREATE TABLE IF NOT EXISTS vsme_field_values (
    id               BIGSERIAL PRIMARY KEY,
    company_id       INTEGER NOT NULL,
    datapoint_code   TEXT NOT NULL,
    value            TEXT,
    is_applicable    BOOLEAN NOT NULL DEFAULT TRUE,
    na_justification TEXT,
    fact_event_id    BIGINT,
    source_path      TEXT,
    updated_by       TEXT,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, datapoint_code)
);

CREATE INDEX IF NOT EXISTS idx_vsme_field_values_company ON vsme_field_values(company_id);

ALTER TABLE vsme_field_values ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vsme_field_values' AND policyname = 'tenant_isolation_vsme_fv'
  ) THEN
    CREATE POLICY tenant_isolation_vsme_fv ON vsme_field_values
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vsme_field_values' AND policyname = 'tenant_isolation_vsme_fv_ins'
  ) THEN
    CREATE POLICY tenant_isolation_vsme_fv_ins ON vsme_field_values
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vsme_field_values' AND policyname = 'tenant_isolation_vsme_fv_upd'
  ) THEN
    CREATE POLICY tenant_isolation_vsme_fv_upd ON vsme_field_values
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
