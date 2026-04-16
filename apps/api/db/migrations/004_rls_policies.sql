-- Migration 004 — Row Level Security (RLS) pour isolation multi-tenant stricte
-- Chaque transaction doit SET LOCAL app.current_company_id = $1 sinon les requêtes retournent 0 rows.
-- Idempotent : utilise DO $$ ... BEGIN IF NOT EXISTS ... $$ pour éviter les erreurs sur ré-exécution.

-- ──────────────────────────────────────────────────────────────────────────
-- snapshots
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='snapshots' AND policyname='tenant_isolation_snapshots') THEN
    CREATE POLICY tenant_isolation_snapshots ON snapshots
      USING (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='snapshots' AND policyname='tenant_isolation_snapshots_insert') THEN
    CREATE POLICY tenant_isolation_snapshots_insert ON snapshots
      FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- facts_events
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE facts_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='facts_events' AND policyname='tenant_isolation_facts_events') THEN
    CREATE POLICY tenant_isolation_facts_events ON facts_events
      USING (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='facts_events' AND policyname='tenant_isolation_facts_events_insert') THEN
    CREATE POLICY tenant_isolation_facts_events_insert ON facts_events
      FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- audit_events
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_events' AND policyname='tenant_isolation_audit_events') THEN
    CREATE POLICY tenant_isolation_audit_events ON audit_events
      USING (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_events' AND policyname='tenant_isolation_audit_events_insert') THEN
    CREATE POLICY tenant_isolation_audit_events_insert ON audit_events
      FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- alert_rules
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='tenant_isolation_alert_rules') THEN
    CREATE POLICY tenant_isolation_alert_rules ON alert_rules
      USING (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_rules' AND policyname='tenant_isolation_alert_rules_insert') THEN
    CREATE POLICY tenant_isolation_alert_rules_insert ON alert_rules
      FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- products
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='tenant_isolation_products') THEN
    CREATE POLICY tenant_isolation_products ON products
      USING (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='tenant_isolation_products_insert') THEN
    CREATE POLICY tenant_isolation_products_insert ON products
      FOR INSERT WITH CHECK (company_id = current_setting('app.current_company_id', true)::int);
  END IF;
END $$;

-- Note : emission_factors N'A PAS de RLS (catalogue global partagé entre tous les tenants).
--        companies et users gardent leur logique applicative (filtrage explicite par id).
