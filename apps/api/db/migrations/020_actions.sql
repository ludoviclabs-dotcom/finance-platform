-- Migration 020 — Actions de réduction : MACC (T5.1) + plan de transition (T5.2).
--
-- Une action = un levier de réduction (CapEx, réduction tCO2e/an, durée de vie)
-- → coût marginal €/tCO2e = capex / (réduction × durée). Statut (proposée →
-- engagée → réalisée) avec journal append-only (action_events). La trajectoire
-- projetée et la MACC sont CALCULÉES en lecture (jamais ré-émises comme facts).
-- Par-organisation → RLS (pattern 008b).

CREATE TABLE IF NOT EXISTS actions (
    id              BIGSERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'proposed',
    owner           TEXT,
    milestone       DATE,
    capex           NUMERIC,
    reduction_tco2e NUMERIC,
    lifespan_years  NUMERIC,
    target_code     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT actions_status_check CHECK (status IN ('proposed', 'committed', 'done'))
);

CREATE TABLE IF NOT EXISTS action_events (
    id          BIGSERIAL PRIMARY KEY,
    company_id  INTEGER NOT NULL,
    action_id   BIGINT,
    status_from TEXT,
    status_to   TEXT NOT NULL,
    actor       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_company ON actions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_action_events_company ON action_events(company_id, action_id, created_at DESC);

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='actions' AND policyname='tenant_isolation_actions') THEN
    CREATE POLICY tenant_isolation_actions ON actions
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='actions' AND policyname='tenant_isolation_actions_ins') THEN
    CREATE POLICY tenant_isolation_actions_ins ON actions
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='actions' AND policyname='tenant_isolation_actions_upd') THEN
    CREATE POLICY tenant_isolation_actions_upd ON actions
      FOR UPDATE USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='action_events' AND policyname='tenant_isolation_action_events') THEN
    CREATE POLICY tenant_isolation_action_events ON action_events
      USING (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='action_events' AND policyname='tenant_isolation_action_events_ins') THEN
    CREATE POLICY tenant_isolation_action_events_ins ON action_events
      FOR INSERT WITH CHECK (company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;
