-- Migration 022 — Adaptateurs d'import fichiers (T5.4).
--
-- Screening d'un fichier exporté manuellement (AWS CCFT, GCP Carbon Footprint,
-- Qonto CSV). Statut pending → emitted : AUCUN fact n'entre dans la chaîne sans
-- validation analyste (POST /imports/{id}/emit), comme le FEC (T4.3). Une table
-- unique discriminée par import_type. Par-organisation → RLS (pattern 008b).

CREATE TABLE IF NOT EXISTS import_screenings (
    id           BIGSERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL,
    import_type  TEXT NOT NULL,
    filename     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    total_tco2e  NUMERIC,
    mappable_pct NUMERIC,
    parsed       JSONB,
    result       JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT import_type_check CHECK (import_type IN ('aws', 'gcp', 'qonto')),
    CONSTRAINT import_status_check CHECK (status IN ('pending', 'emitted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_import_screenings_company ON import_screenings(company_id, created_at DESC);

ALTER TABLE import_screenings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='import_screenings' AND policyname='tenant_isolation_imports') THEN
    CREATE POLICY tenant_isolation_imports ON import_screenings
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='import_screenings' AND policyname='tenant_isolation_imports_ins') THEN
    CREATE POLICY tenant_isolation_imports_ins ON import_screenings
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='import_screenings' AND policyname='tenant_isolation_imports_upd') THEN
    CREATE POLICY tenant_isolation_imports_upd ON import_screenings
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
