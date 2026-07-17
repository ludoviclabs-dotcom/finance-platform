-- Bootstrap 000 — table `schema_migrations` (le ledger lui-même).
--
-- Cas particulier, PAS une migration numérotée : ce fichier vit hors de
-- `apps/api/db/migrations/` précisément pour ne jamais être découvert par
-- `MigrationRunner.discover_migrations()` (PR02_ARCHITECTURE_PLAN.md §6).
-- Il n'a pas de statut, jamais de ligne dans sa propre table — son existence
-- EST la table. Exécuté une seule fois par `MigrationRunner._ensure_ledger_table()`,
-- sous le verrou advisory, avant toute autre opération de `baseline()`/`verify()`.
--
-- Ne pas confondre avec la baseline `version='000'` (une ligne réelle dans le
-- ledger, désignant le DDL inline historique de migrations.py — companies,
-- users, refresh_tokens, snapshots, audit_events, products, alert_rules).

CREATE TABLE IF NOT EXISTS schema_migrations (
    version           TEXT        PRIMARY KEY,
    name              TEXT        NOT NULL,
    checksum_sha256   TEXT        NOT NULL,
    status            TEXT        NOT NULL
        CHECK (status IN ('applied', 'failed', 'manual_required', 'baseline')),
    applied_at        TIMESTAMPTZ,
    execution_ms      INTEGER,
    applied_by        TEXT,
    requires_owner    BOOLEAN     NOT NULL DEFAULT FALSE,
    transactional     BOOLEAN     NOT NULL DEFAULT TRUE,
    error_message     TEXT,
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);
