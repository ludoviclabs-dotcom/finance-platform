-- Migration 017 — Screening FEC → Scope 3 monétaire (T4.3).
--
-- Stocke le résultat de screening d'un FEC importé (statut pending → emitted).
-- Aucun fact n'est émis tant que le statut n'est pas passé à `emitted` via la
-- validation analyste (POST /fec/{id}/emit). Par-organisation → RLS (pattern
-- 008b). La table de passage PCG → Scope 3 est un catalogue (data/pcg_scope3.json),
-- pas une table.

CREATE TABLE IF NOT EXISTS fec_screenings (
    id              BIGSERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL,
    filename        TEXT NOT NULL,
    exercise_year   TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    total_debit     NUMERIC,
    total_credit    NUMERIC,
    mappable_pct    NUMERIC,
    estimated_tco2e NUMERIC,
    result          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fec_screening_status_check CHECK (status IN ('pending', 'emitted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_fec_screenings_company ON fec_screenings(company_id, created_at DESC);

ALTER TABLE fec_screenings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fec_screenings' AND policyname='tenant_isolation_fec') THEN
    CREATE POLICY tenant_isolation_fec ON fec_screenings
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fec_screenings' AND policyname='tenant_isolation_fec_ins') THEN
    CREATE POLICY tenant_isolation_fec_ins ON fec_screenings
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fec_screenings' AND policyname='tenant_isolation_fec_upd') THEN
    CREATE POLICY tenant_isolation_fec_upd ON fec_screenings
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
