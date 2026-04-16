"""
migrations.py — DDL initial pour CarbonCo PostgreSQL.

Exécuté au démarrage de l'API si les tables n'existent pas encore.
Idempotent : utilise CREATE TABLE IF NOT EXISTS partout.

Tables :
  - companies       : entreprises (multi-tenant)
  - users           : utilisateurs rattachés à une company
  - snapshots       : historique versionné des snapshots par domaine
  - audit_events    : journal d'audit persistant
  - products        : fiches DPP par entreprise
  - alert_rules     : règles de notification/alertes
"""

from __future__ import annotations

import logging

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

DDL = """
-- ----------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,
    naf_code    TEXT,
    plan        TEXT        NOT NULL DEFAULT 'starter',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entreprise par défaut pour la migration des données existantes
INSERT INTO companies (name, slug, plan)
VALUES ('CarbonCo Demo', 'carbonco-demo', 'pro')
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    role            TEXT        NOT NULL DEFAULT 'analyst',
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);

-- ----------------------------------------------------------------
-- refresh_tokens
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_rt_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_token   ON refresh_tokens(token_hash);

-- ----------------------------------------------------------------
-- snapshots  (historique versionné)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    domain      TEXT        NOT NULL,   -- carbon | vsme | esg | finance
    version     INTEGER     NOT NULL DEFAULT 1,
    data        JSONB       NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source      TEXT        NOT NULL DEFAULT 'ingest',  -- ingest | upload | manual
    CONSTRAINT snapshots_domain_check CHECK (domain IN ('carbon','vsme','esg','finance'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_company_domain ON snapshots(company_id, domain);
CREATE INDEX IF NOT EXISTS idx_snapshots_generated_at   ON snapshots(generated_at DESC);

-- ----------------------------------------------------------------
-- audit_events
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER     REFERENCES companies(id) ON DELETE SET NULL,
    user_email  TEXT,
    event_type  TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    detail      TEXT,
    status      TEXT        NOT NULL DEFAULT 'ok',
    meta        JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_status_check     CHECK (status IN ('ok','warning','error')),
    CONSTRAINT audit_eventtype_check  CHECK (event_type IN (
        'ingest','upload','cache_clear','login','export','validation','error'
    ))
);

CREATE INDEX IF NOT EXISTS idx_audit_company    ON audit_events(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type       ON audit_events(event_type);

-- ----------------------------------------------------------------
-- products  (DPP / ESPR)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    sku                 TEXT,
    sector              TEXT,
    pcf_kgco2e          NUMERIC(12,3),
    recyclability_pct   NUMERIC(5,2),
    lifespan_years      NUMERIC(5,1),
    supply_chain        JSONB,
    espr_status         TEXT        NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_espr_check CHECK (espr_status IN ('pending','eligible','compliant','non_compliant'))
);

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);

-- ----------------------------------------------------------------
-- alert_rules
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_rules (
    id          SERIAL PRIMARY KEY,
    company_id  INTEGER     NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    domain      TEXT        NOT NULL,
    field_path  TEXT        NOT NULL,   -- ex: carbon.totalS123Tco2e
    operator    TEXT        NOT NULL,   -- gt | lt | gte | lte | eq
    threshold   NUMERIC     NOT NULL,
    channel     TEXT        NOT NULL DEFAULT 'webhook',  -- webhook | email
    destination TEXT        NOT NULL,   -- URL webhook ou adresse email
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    last_fired_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_company ON alert_rules(company_id);
"""


def run_migrations() -> None:
    """Execute DDL to create all tables if they don't exist. Safe to call on every startup.

    Étapes :
      1. DDL inline (tables historiques : companies, users, snapshots, audit_events, products, alert_rules)
      2. Fichiers SQL dans db/migrations/ préfixés 001-003 (Phase 1.B : facts backbone)
         NOTE : 004_rls_policies.sql est EXCLUS — à activer manuellement après audit complet des callers.
    """
    if not db_available():
        logger.info("PostgreSQL non disponible — migrations ignorées (mode /tmp JSON actif)")
        return
    try:
        # --- 1. DDL inline historique ---
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(DDL)
        logger.info("Migrations PostgreSQL (DDL inline) exécutées avec succès")

        # --- 2. Fichiers SQL 001-003 (Phase 1.B tables nouvelles, idempotent) ---
        from pathlib import Path
        migrations_dir = Path(__file__).parent / "migrations"
        if migrations_dir.exists():
            # Auto : tout fichier *.sql dont le préfixe numérique est < 004
            sql_files = sorted(migrations_dir.glob("*.sql"))
            for sql_file in sql_files:
                prefix = sql_file.name[:3]
                if not prefix.isdigit() or int(prefix) >= 4:
                    logger.info("Migration %s — skippée (activation manuelle)", sql_file.name)
                    continue
                try:
                    sql = sql_file.read_text(encoding="utf-8")
                    with get_db() as conn:
                        with conn.cursor() as cur:
                            cur.execute(sql)
                    logger.info("Migration %s exécutée", sql_file.name)
                except Exception as exc:
                    logger.warning("Migration %s échouée (peut être déjà appliquée) : %s", sql_file.name, exc)
    except Exception as exc:
        logger.error("Erreur migrations PostgreSQL : %s", exc)
        # Ne pas faire planter le démarrage de l'API — fallback /tmp reste actif
