-- Migration 014 — Référentiel VSME (catalogue des datapoints, T3.1).
--
-- Catalogue GLOBAL du standard EFRAG (modules Basic B1-B11 + Comprehensive
-- C1-C9), IDENTIQUE pour toutes les organisations — donc PAS de company_id et
-- PAS de RLS (même logique que emission_factors). Seedé par
-- scripts/seed_vsme_datapoints.py depuis data/vsme_datapoints.json. Les valeurs
-- par organisation vivent dans vsme_field_values (migration 015, T3.2).

CREATE TABLE IF NOT EXISTS vsme_datapoints (
    code           TEXT PRIMARY KEY,
    module         TEXT NOT NULL,
    label          TEXT NOT NULL,
    type           TEXT NOT NULL,
    unit           TEXT,
    snapshot_path  TEXT,
    fact_code      TEXT,
    collect_status TEXT NOT NULL DEFAULT 'optional',
    version        TEXT NOT NULL DEFAULT 'v2024.12'
);

CREATE INDEX IF NOT EXISTS idx_vsme_datapoints_module ON vsme_datapoints(module);
