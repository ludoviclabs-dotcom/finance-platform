-- Migration 018 — Périmètre organisationnel & multi-entités (T4.4).
--
-- Hiérarchie d'entités via companies.parent_id + % de détention + approche de
-- consolidation. La consolidation est CALCULÉE en lecture (jamais ré-émise comme
-- facts). Journal des changements de périmètre dans perimeter_events.
--
-- Sécurité (cf. revue) : PAS de RLS récursive. La vue groupe lit des company_id
-- enfants via une whitelist explicite côté service (db/database.get_db).

ALTER TABLE companies ADD COLUMN IF NOT EXISTS parent_id INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ownership_pct NUMERIC NOT NULL DEFAULT 100;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS consolidation_approach TEXT NOT NULL DEFAULT 'operational';

CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_id);

CREATE TABLE IF NOT EXISTS perimeter_events (
    id            BIGSERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL,
    approach_from TEXT,
    approach_to   TEXT NOT NULL,
    detail        TEXT,
    actor         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perimeter_events_company ON perimeter_events(company_id, created_at DESC);

ALTER TABLE perimeter_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perimeter_events' AND policyname='tenant_isolation_perimeter') THEN
    CREATE POLICY tenant_isolation_perimeter ON perimeter_events
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='perimeter_events' AND policyname='tenant_isolation_perimeter_ins') THEN
    CREATE POLICY tenant_isolation_perimeter_ins ON perimeter_events
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
