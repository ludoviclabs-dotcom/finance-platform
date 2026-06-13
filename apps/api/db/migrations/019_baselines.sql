-- Migration 019 — Année de référence & politique de recalcul (T4.5).
--
-- Baseline gelée par organisation (année + KPIs + hash de chaîne au gel). Tout
-- recalcul est un event (motif obligatoire) ; les facts ré-émis portent le motif
-- dans meta (PAS dans compute_hash — la chaîne reste inchangée, cf. revue).
-- L'ancienne valeur reste consultable dans le trail (append-only). Par-org → RLS.

CREATE TABLE IF NOT EXISTS baselines (
    id            BIGSERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL,
    baseline_year INTEGER NOT NULL,
    snapshot_hash TEXT,
    ef_version    TEXT,
    kpis          JSONB,
    frozen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, baseline_year)
);

CREATE TABLE IF NOT EXISTS recalc_events (
    id            BIGSERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL,
    baseline_id   BIGINT,
    reason        TEXT NOT NULL,
    detail        TEXT,
    facts_touched INTEGER NOT NULL DEFAULT 0,
    actor         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recalc_reason_check CHECK (reason IN ('scope_change', 'ef_version', 'data_error', 'manual_adjustment'))
);

CREATE INDEX IF NOT EXISTS idx_baselines_company ON baselines(company_id, baseline_year DESC);
CREATE INDEX IF NOT EXISTS idx_recalc_company ON recalc_events(company_id, created_at DESC);

ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE recalc_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='baselines' AND policyname='tenant_isolation_baselines') THEN
    CREATE POLICY tenant_isolation_baselines ON baselines
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='baselines' AND policyname='tenant_isolation_baselines_ins') THEN
    CREATE POLICY tenant_isolation_baselines_ins ON baselines
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  -- freeze_baseline fait un INSERT ... ON CONFLICT DO UPDATE : policy UPDATE
  -- explicite (la policy USING ci-dessus la couvre déjà en FOR ALL, mais on
  -- l'expose pour cohérence avec 017 et lisibilité de l'intention).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='baselines' AND policyname='tenant_isolation_baselines_upd') THEN
    CREATE POLICY tenant_isolation_baselines_upd ON baselines
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recalc_events' AND policyname='tenant_isolation_recalc') THEN
    CREATE POLICY tenant_isolation_recalc ON recalc_events
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recalc_events' AND policyname='tenant_isolation_recalc_ins') THEN
    CREATE POLICY tenant_isolation_recalc_ins ON recalc_events
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
