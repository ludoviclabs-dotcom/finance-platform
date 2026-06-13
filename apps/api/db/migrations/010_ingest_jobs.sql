-- Migration 010 — File de jobs d'ingestion (T1.3).
-- pending -> processing -> done | failed. id uuid (généré côté application).
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS ingest_jobs (
    id           UUID        PRIMARY KEY,
    company_id   INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind         TEXT        NOT NULL DEFAULT 'ingest',
    status       TEXT        NOT NULL DEFAULT 'pending',
    error        TEXT,
    payload      JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ,
    CONSTRAINT ingest_jobs_status_check CHECK (status IN ('pending','processing','done','failed'))
);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_company ON ingest_jobs(company_id, created_at DESC);

-- RLS (ENABLE ; policy bypass-aware, cohérente avec 009). FORCE non appliqué ici
-- (id uuid non devinable + filtrage applicatif par company_id).
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_ingest_jobs ON ingest_jobs;
CREATE POLICY tenant_isolation_ingest_jobs ON ingest_jobs
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = current_setting('app.current_company_id', true)::int);
DROP POLICY IF EXISTS tenant_isolation_ingest_jobs_insert ON ingest_jobs;
CREATE POLICY tenant_isolation_ingest_jobs_insert ON ingest_jobs
  FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = current_setting('app.current_company_id', true)::int);
