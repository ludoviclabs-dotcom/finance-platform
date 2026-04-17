-- Migration 008 — Supplier Data Collection
-- Crée les tables pour le module fournisseurs Phase 4.
-- Idempotente (IF NOT EXISTS sur tout).

-- ---------------------------------------------------------------------------
-- suppliers : catalogue des fournisseurs d'une entreprise
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL DEFAULT 1,
    name            VARCHAR(255) NOT NULL,
    contact_email   VARCHAR(255),
    contact_name    VARCHAR(255),
    country         VARCHAR(100),
    sector          VARCHAR(100),
    scope3_category VARCHAR(100),       -- ex. "C1 Biens achetés", "C4 Transport amont"
    spend_eur       NUMERIC(18, 2),     -- dépenses annuelles (€), null si inconnues
    ghg_estimate_tco2e NUMERIC(12, 3),  -- estimation GES scope 3 (tCO₂e)
    status          VARCHAR(50) NOT NULL DEFAULT 'active',
                    -- active | pending | archived
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers (company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status  ON suppliers (company_id, status);

-- ---------------------------------------------------------------------------
-- supplier_questionnaire_tokens : tokens d'accès public aux questionnaires
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_questionnaire_tokens (
    id              SERIAL PRIMARY KEY,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    company_id      INTEGER NOT NULL DEFAULT 1,
    token           VARCHAR(64) NOT NULL UNIQUE,  -- UUID hex, 32 bytes → 64 chars
    campaign        VARCHAR(255),                  -- ex. "Campagne 2026 Q1"
    expires_at      TIMESTAMPTZ,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sqt_token      ON supplier_questionnaire_tokens (token);
CREATE INDEX IF NOT EXISTS idx_sqt_supplier   ON supplier_questionnaire_tokens (supplier_id);
CREATE INDEX IF NOT EXISTS idx_sqt_company    ON supplier_questionnaire_tokens (company_id);

-- ---------------------------------------------------------------------------
-- supplier_answers : réponses aux questionnaires
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_answers (
    id              SERIAL PRIMARY KEY,
    token_id        INTEGER NOT NULL REFERENCES supplier_questionnaire_tokens (id) ON DELETE CASCADE,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
    company_id      INTEGER NOT NULL DEFAULT 1,
    ghg_total_tco2e NUMERIC(12, 3),
    ghg_scope1      NUMERIC(12, 3),
    ghg_scope2      NUMERIC(12, 3),
    ghg_scope3      NUMERIC(12, 3),
    methodology     VARCHAR(255),   -- ex. "GHG Protocol", "Bilan Carbone ADEME"
    reporting_year  INTEGER,
    has_sbti        BOOLEAN DEFAULT FALSE,
    has_iso14001    BOOLEAN DEFAULT FALSE,
    has_iso50001    BOOLEAN DEFAULT FALSE,
    narrative       TEXT,           -- texte libre additionnel
    raw_json        JSONB,          -- réponses brutes formulaire
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sa_supplier  ON supplier_answers (supplier_id);
CREATE INDEX IF NOT EXISTS idx_sa_company   ON supplier_answers (company_id);

-- ---------------------------------------------------------------------------
-- materialite_positions : positions personnalisées sur la matrice 2D
-- (drag & drop Phase 4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materialite_positions (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL DEFAULT 1,
    issue_code      VARCHAR(50) NOT NULL,
    x_proba         NUMERIC(4, 2) NOT NULL CHECK (x_proba BETWEEN 0 AND 5),
    y_impact        NUMERIC(4, 2) NOT NULL CHECK (y_impact BETWEEN 0 AND 5),
    updated_by      VARCHAR(255),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, issue_code)
);

CREATE INDEX IF NOT EXISTS idx_matpos_company ON materialite_positions (company_id);
