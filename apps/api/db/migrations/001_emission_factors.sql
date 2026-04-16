-- Migration 001 — Table emission_factors
-- Catalogue ADEME Base Empreinte versionné
-- Idempotent : CREATE TABLE IF NOT EXISTS

CREATE TABLE IF NOT EXISTS emission_factors (
    id            SERIAL PRIMARY KEY,
    ef_code       TEXT         NOT NULL,
    label         TEXT         NOT NULL,
    scope         SMALLINT,                        -- 1|2|3|NULL (transverse)
    category      TEXT,                            -- energy|transport|waste|materials|...
    factor_kgco2e NUMERIC(14,4) NOT NULL,
    unit          TEXT         NOT NULL,           -- kWh|kg|km|t|m3|€|MJ
    source        TEXT         NOT NULL DEFAULT 'ADEME Base Empreinte',
    version       TEXT         NOT NULL,           -- v2025.0
    valid_from    DATE,
    valid_until   DATE,
    raw           JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (ef_code, version)
);

CREATE INDEX IF NOT EXISTS idx_ef_scope_cat ON emission_factors(scope, category);
CREATE INDEX IF NOT EXISTS idx_ef_version   ON emission_factors(version);
CREATE INDEX IF NOT EXISTS idx_ef_code      ON emission_factors(ef_code);
