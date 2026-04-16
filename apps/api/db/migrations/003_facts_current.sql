-- Migration 003 — Vue matérialisée facts_current
-- Dernière valeur par (company_id, code)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY déclenché par l'application après ingest.

CREATE MATERIALIZED VIEW IF NOT EXISTS facts_current AS
SELECT DISTINCT ON (company_id, code)
    company_id,
    code,
    value,
    unit,
    ef_id,
    source_path,
    computed_at,
    hash_self
FROM facts_events
ORDER BY company_id, code, computed_at DESC;

-- Index unique requis pour REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_facts_current_pk ON facts_current(company_id, code);
