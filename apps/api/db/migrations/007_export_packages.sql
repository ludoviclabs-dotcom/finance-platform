-- Migration 007 — Export packages (ZIP signés avec manifest hash)
-- Chaque ZIP généré par /export/package est enregistré ici pour permettre
-- la vérification publique via /verify/{hash} sans authentification.

CREATE TABLE IF NOT EXISTS export_packages (
    id             BIGSERIAL    PRIMARY KEY,
    company_id     INTEGER      NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    package_hash   TEXT         NOT NULL UNIQUE,    -- SHA-256 hex du ZIP complet
    manifest_hash  TEXT         NOT NULL,            -- SHA-256 du manifest.json embarqué
    domain         TEXT         NOT NULL,            -- carbon|esg|finance|consolidated
    filename       TEXT         NOT NULL,            -- ex: carbonco-export-acme-2026-04-17T10:30.zip
    size_bytes     BIGINT       NOT NULL,
    event_count    INTEGER      NOT NULL DEFAULT 0,  -- nb d'events embarqués dans audit_trail.json
    frozen_count   INTEGER      NOT NULL DEFAULT 0,  -- nb de datapoints gelés
    generated_by   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    generated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    meta           JSONB
);

CREATE INDEX IF NOT EXISTS idx_export_packages_company    ON export_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_export_packages_hash       ON export_packages(package_hash);
CREATE INDEX IF NOT EXISTS idx_export_packages_generated  ON export_packages(generated_at DESC);
