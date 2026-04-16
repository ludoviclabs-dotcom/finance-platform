-- Migration 002 — Table facts_events (append-only, hash Merkle chaîné)
-- Idempotent : CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS facts_events (
    id           BIGSERIAL    PRIMARY KEY,
    company_id   INTEGER      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code         TEXT         NOT NULL,           -- ex: carbon.scope1Tco2e
    value        NUMERIC(20,6),
    unit         TEXT         NOT NULL,
    ef_id        INTEGER      REFERENCES emission_factors(id),  -- NULL si KPI composite
    source_path  TEXT         NOT NULL,           -- upload:CarbonCo_v2.xlsx!Synthese_GES!C10 | master | manual
    computed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    hash_prev    TEXT,                            -- hex 64, NULL sur le 1er event de la chaîne company
    hash_self    TEXT         NOT NULL,           -- hex 64, calculé par application
    meta         JSONB,                           -- user_email, ingest_id, workbook_name...
    UNIQUE (company_id, code, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_facts_company_code   ON facts_events(company_id, code);
CREATE INDEX IF NOT EXISTS idx_facts_computed_desc  ON facts_events(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_facts_ef             ON facts_events(ef_id);
