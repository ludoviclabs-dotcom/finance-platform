-- Migration 005 — Ajoute colonnes hash_prev et hash_self à audit_events
-- Rétro-compatibilité garantie via IF NOT EXISTS.
-- Le backfill des valeurs hash est fait par apps/api/scripts/migrate_audit_hash.py (pas ici,
-- car le hash dépend d'ordering + calcul applicatif avec SHA-256).

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS hash_prev TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS hash_self TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_events_hash ON audit_events(hash_self) WHERE hash_self IS NOT NULL;
