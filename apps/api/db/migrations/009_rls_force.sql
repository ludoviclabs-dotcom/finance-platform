-- Migration 009 — RLS FORCE + escape hatch maintenance (bypass GUC).
--
-- Supersède 004 : policies « bypass-aware » + FORCE (l'owner est lui aussi soumis
-- aux policies, contrairement à ENABLE seul). Auto-appliquée UNIQUEMENT si
-- RLS_FORCE=1 (cf. migrations.py) — opt-in, car FORCE doit être validé contre une
-- vraie base Neon avant de s'y fier (un contexte company oublié => 0 row).
--
-- Escape hatch : les opérations de maintenance (REFRESH MATERIALIZED VIEW) posent
-- le GUC de service `app.rls_bypass = 'on'` pour voir toutes les companies. Les
-- chemins applicatifs ne le posent jamais. Contexte absent => fail-safe (0 row),
-- pas de fuite.
--
-- NULLIF(current_setting(...), '') : un GUC custom jamais SET dans une session
-- renvoie NULL au premier current_setting(..., true), MAIS après un premier
-- `SET LOCAL app.current_company_id = X` dans CETTE session, Postgres instancie
-- un placeholder qui revient à '' (chaîne vide, pas NULL) une fois le LOCAL
-- expiré — donc toute requête ultérieure SANS company_id sur cette même
-- connexion physique (typique sous PgBouncer transaction pooling, où le
-- backend est réutilisé entre clients) fait planter `''::int` au lieu de
-- filtrer silencieusement à 0 ligne. Confirmé en conditions réelles sur Neon
-- (branche de validation RLS_FORCE, 04/07/2026). NULLIF convertit '' en NULL
-- AVANT le cast : le fail-safe reste 0 ligne, sans exception. Même pattern
-- que la migration 008b (suppliers) et 021 (alert_rules) — 009 ne l'avait
-- pas, corrigé ici avant sa première activation en prod.
--
-- Idempotent : DROP POLICY IF EXISTS puis CREATE.

-- ── snapshots ───────────────────────────────────────────────────────────────
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_snapshots ON snapshots;
CREATE POLICY tenant_isolation_snapshots ON snapshots
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
DROP POLICY IF EXISTS tenant_isolation_snapshots_insert ON snapshots;
CREATE POLICY tenant_isolation_snapshots_insert ON snapshots
  FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);

-- ── facts_events ────────────────────────────────────────────────────────────
ALTER TABLE facts_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts_events FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_facts_events ON facts_events;
CREATE POLICY tenant_isolation_facts_events ON facts_events
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
DROP POLICY IF EXISTS tenant_isolation_facts_events_insert ON facts_events;
CREATE POLICY tenant_isolation_facts_events_insert ON facts_events
  FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);

-- ── audit_events ────────────────────────────────────────────────────────────
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_audit_events ON audit_events;
CREATE POLICY tenant_isolation_audit_events ON audit_events
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
DROP POLICY IF EXISTS tenant_isolation_audit_events_insert ON audit_events;
CREATE POLICY tenant_isolation_audit_events_insert ON audit_events
  FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);

-- ── alert_rules ─────────────────────────────────────────────────────────────
-- NB : la migration 021 (alert_rules_notifications) ajoute SES PROPRES policies
-- guardées (tenant_isolation_alert_rules_ins/_upd) sous des noms différents des
-- nôtres (..._insert) — elles coexistent (permissives, combinées en OR) ; comme
-- 009 est désormais guardée aussi, les deux jeux sont sans risque redondants.
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_alert_rules ON alert_rules;
CREATE POLICY tenant_isolation_alert_rules ON alert_rules
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
DROP POLICY IF EXISTS tenant_isolation_alert_rules_insert ON alert_rules;
CREATE POLICY tenant_isolation_alert_rules_insert ON alert_rules
  FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);

-- ── products ────────────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
  USING (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
DROP POLICY IF EXISTS tenant_isolation_products_insert ON products;
CREATE POLICY tenant_isolation_products_insert ON products
  FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
         OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);

-- emission_factors : PAS de RLS (catalogue global). companies/users : filtrage applicatif.
