-- Migration 033 — Moteur de calcul Scope 2 dual (PR-06B).
--
-- Phase 5 du PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md (« Scope 2 dual »),
-- tranche B : le MOTEUR de calcul, par-dessus la fondation « ledger énergie »
-- de la migration 031 (compteurs, activités, instruments, allocations,
-- métadonnées de facteurs).
--
-- Ce que cette migration ajoute : deux tables de RUN de calcul.
--   * `scope2_calculation_runs`  — un calcul daté, méthodologie versionnée,
--     snapshot IMMUABLE des entrées, facteurs utilisés, résultat, warnings,
--     confiance, couverture, approbation.
--   * `scope2_line_results`      — le détail par activité et par base (location
--     / market), avec le NIVEAU de hiérarchie de facteur retenu et sa RAISON :
--     c'est la « trace de calcul » persistée.
--
-- Colonnes communes de run imposées par WAVE_2_INTERFACE_CONTRACTS.md §4
-- (methodology_code/version, input_snapshot, factor_versions, result, warnings,
-- confidence, coverage_pct, calculated_at, approved_at, approved_by) — mêmes
-- noms que `procurement_calculation_runs` pour rester interchangeables.
--
-- INTERDITS MÉTHODOLOGIQUES (non négociables, portés par le schéma ET le moteur) :
--   * une moyenne nationale (`basis='location'`) présentée comme market-based ;
--   * une estimation présentée comme vérifiée (`data_quality` est explicite) ;
--   * un proxy fournisseur présenté comme facteur contractuel vérifié.
-- Le schéma force la traçabilité : `selection_level` et `selection_reason` sont
-- NOT NULL — aucun facteur ne peut être enregistré sans dire d'où il vient.
--
-- Aucun calcul n'est exécuté par cette migration, aucune donnée métier migrée,
-- aucun LLM, aucune donnée externe réelle ingérée.
--
-- Convention Wave 2 (contrats §7) : tables purement tenant
-- (`company_id BIGINT NOT NULL`, jamais de ligne globale). RLS gen-2 : ENABLE +
-- FORCE + policies scopées par commande (FOR SELECT/INSERT/UPDATE/DELETE) +
-- garde `app.rls_bypass`, chaque CREATE POLICY précédé d'un DROP POLICY IF
-- EXISTS (rejouable par startup_event, pattern 028/030/031). Comme en 031, la
-- clause de lecture ne porte PAS la branche `company_id IS NULL` (elle serait
-- morte) : lecture = écriture = tenant courant.

-- ---------------------------------------------------------------------------
-- A. scope2_calculation_runs — un run de calcul Scope 2 dual (LB + MB).
--    `input_snapshot` est IMMUABLE (trigger plus bas) : un run rejoué sur les
--    mêmes entrées doit redonner le même résultat, donc les entrées gelées ne
--    peuvent pas être réécrites après coup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scope2_calculation_runs (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    methodology_code     TEXT NOT NULL,
    methodology_version  TEXT NOT NULL,
    period_start         DATE NOT NULL,
    period_end           DATE NOT NULL,
    geography_code       TEXT NOT NULL,
    -- Snapshot gelé des entrées (activités, allocations, facteurs candidats) —
    -- rend le run reproductible et auditable indépendamment de l'évolution
    -- ultérieure du ledger énergie.
    input_snapshot       JSONB NOT NULL,
    -- Empreinte déterministe du snapshot : deux runs de même empreinte doivent
    -- porter le même résultat (test de reproductibilité).
    input_fingerprint    TEXT NOT NULL,
    factor_versions      JSONB NOT NULL DEFAULT '[]'::jsonb,
    result               JSONB NOT NULL,
    warnings             JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence           NUMERIC,
    coverage_pct         NUMERIC,
    status               TEXT NOT NULL DEFAULT 'draft',
    calculated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculated_by        BIGINT,
    approved_at          TIMESTAMPTZ,
    approved_by          BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scope2_runs_status_check CHECK (
        status IN ('draft', 'approved', 'superseded')
    ),
    CONSTRAINT scope2_runs_period_check CHECK (period_end >= period_start),
    CONSTRAINT scope2_runs_confidence_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT scope2_runs_coverage_check CHECK (
        coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100)
    ),
    -- Un run approuvé porte TOUJOURS sa date et son approbateur (pas
    -- d'approbation anonyme d'un KPI réglementaire).
    CONSTRAINT scope2_runs_approval_check CHECK (
        status <> 'approved' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_scope2_runs_company ON scope2_calculation_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_scope2_runs_period
    ON scope2_calculation_runs(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_scope2_runs_status ON scope2_calculation_runs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_scope2_runs_fingerprint
    ON scope2_calculation_runs(company_id, input_fingerprint);

-- ---------------------------------------------------------------------------
-- B. scope2_line_results — trace de calcul persistée, une ligne par (activité,
--    base, segment). `segment` distingue, en market-based, la part COUVERTE par
--    un instrument contractuel de la part NON COUVERTE (qui retombe sur facteur
--    fournisseur / mix résiduel) : la quantité non couverte reste VISIBLE, elle
--    n'est jamais absorbée silencieusement dans un total.
--
--    `selection_level` + `selection_reason` sont NOT NULL : AUCUN facteur ne
--    peut être écrit sans son niveau de hiérarchie et sa justification — c'est
--    la traduction schéma de « aucun facteur choisi silencieusement ».
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scope2_line_results (
    id                     BIGSERIAL PRIMARY KEY,
    company_id             BIGINT NOT NULL REFERENCES companies(id),
    run_id                 BIGINT NOT NULL REFERENCES scope2_calculation_runs(id) ON DELETE CASCADE,
    energy_activity_id     BIGINT REFERENCES energy_activities(id),
    basis                  TEXT NOT NULL,
    segment                TEXT NOT NULL DEFAULT 'total',
    instrument_id          BIGINT REFERENCES contractual_instruments(id),
    carrier                TEXT NOT NULL,
    geography_code         TEXT,
    period_start           DATE NOT NULL,
    period_end             DATE NOT NULL,
    activity_value         NUMERIC NOT NULL,
    activity_unit          TEXT NOT NULL,
    activity_mwh           NUMERIC NOT NULL,
    ef_id                  INTEGER REFERENCES emission_factors(id),
    ef_code                TEXT,
    ef_version             TEXT,
    factor_kgco2e_per_mwh  NUMERIC,
    factor_basis           TEXT,
    selection_level        TEXT NOT NULL,
    selection_reason       TEXT NOT NULL,
    result_tco2e           NUMERIC NOT NULL,
    uncertainty            NUMERIC,
    data_quality           TEXT NOT NULL,
    fallback_reason        TEXT,
    warnings               JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Les DEUX bases coexistent toujours (Scope 2 dual) — jamais l'une à la
    -- place de l'autre.
    CONSTRAINT scope2_lines_basis_check CHECK (basis IN ('location', 'market')),
    CONSTRAINT scope2_lines_segment_check CHECK (
        segment IN ('total', 'covered', 'uncovered')
    ),
    -- `factor_basis` NE PEUT PAS être 'location' sur une ligne market-based :
    -- c'est l'interdit méthodologique « une moyenne nationale présentée comme
    -- market-based », posé EN BASE et pas seulement dans le moteur. Le repli
    -- documenté (si la méthodologie l'autorise explicitement) est tracé par
    -- `factor_basis='documented_fallback'` + `fallback_reason` obligatoire.
    CONSTRAINT scope2_lines_factor_basis_check CHECK (
        factor_basis IS NULL
        OR factor_basis IN ('location', 'market', 'residual_mix',
                            'contractual_instrument', 'documented_fallback')
    ),
    CONSTRAINT scope2_lines_market_purity_check CHECK (
        basis <> 'market' OR factor_basis IS NULL OR factor_basis <> 'location'
    ),
    -- Un repli exige TOUJOURS sa raison écrite (jamais de fallback silencieux).
    CONSTRAINT scope2_lines_fallback_reason_check CHECK (
        factor_basis IS DISTINCT FROM 'documented_fallback' OR fallback_reason IS NOT NULL
    ),
    -- Vocabulaire aligné sur observations.data_status (contrats §2).
    CONSTRAINT scope2_lines_data_quality_check CHECK (
        data_quality IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT scope2_lines_carrier_check CHECK (
        carrier IN ('electricity', 'gas', 'heat', 'steam', 'cooling', 'other')
    ),
    CONSTRAINT scope2_lines_period_check CHECK (period_end >= period_start),
    CONSTRAINT scope2_lines_quantity_check CHECK (activity_mwh >= 0)
);

CREATE INDEX IF NOT EXISTS idx_scope2_lines_company ON scope2_line_results(company_id);
CREATE INDEX IF NOT EXISTS idx_scope2_lines_run ON scope2_line_results(company_id, run_id);
CREATE INDEX IF NOT EXISTS idx_scope2_lines_basis ON scope2_line_results(run_id, basis);
CREATE INDEX IF NOT EXISTS idx_scope2_lines_activity ON scope2_line_results(energy_activity_id);

-- ---------------------------------------------------------------------------
-- RLS gen-2 — ENABLE + FORCE + policies scopées par commande + rls_bypass.
-- ---------------------------------------------------------------------------

-- ── scope2_calculation_runs ─────────────────────────────────────────────────
ALTER TABLE scope2_calculation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope2_calculation_runs FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scope2_calculation_runs ON scope2_calculation_runs;
CREATE POLICY tenant_isolation_scope2_calculation_runs ON scope2_calculation_runs
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_scope2_calculation_runs_insert ON scope2_calculation_runs;
CREATE POLICY tenant_isolation_scope2_calculation_runs_insert ON scope2_calculation_runs
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_scope2_calculation_runs_update ON scope2_calculation_runs;
CREATE POLICY tenant_isolation_scope2_calculation_runs_update ON scope2_calculation_runs
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_scope2_calculation_runs_delete ON scope2_calculation_runs;
CREATE POLICY tenant_isolation_scope2_calculation_runs_delete ON scope2_calculation_runs
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── scope2_line_results ─────────────────────────────────────────────────────
ALTER TABLE scope2_line_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope2_line_results FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_scope2_line_results ON scope2_line_results;
CREATE POLICY tenant_isolation_scope2_line_results ON scope2_line_results
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_scope2_line_results_insert ON scope2_line_results;
CREATE POLICY tenant_isolation_scope2_line_results_insert ON scope2_line_results
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_scope2_line_results_update ON scope2_line_results;
CREATE POLICY tenant_isolation_scope2_line_results_update ON scope2_line_results
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_scope2_line_results_delete ON scope2_line_results;
CREATE POLICY tenant_isolation_scope2_line_results_delete ON scope2_line_results
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ---------------------------------------------------------------------------
-- Immutabilité du snapshot d'entrée et du résultat (trigger).
--
-- Un run est un ENREGISTREMENT de calcul : ses entrées gelées, sa méthodologie,
-- son empreinte et son résultat ne se réécrivent pas. Seuls le cycle de vie
-- (`status`, `approved_at`, `approved_by`) et `updated_at` sont modifiables —
-- approuver un run ne doit jamais pouvoir en changer discrètement les chiffres.
--
-- Fonction volontairement SANS SECURITY DEFINER : elle ne lit aucune autre
-- table, ne compare que OLD et NEW. (Rappel utile : sous FORCE ROW LEVEL
-- SECURITY, SECURITY DEFINER ne contourne PAS la RLS — seul un superuser ou un
-- rôle BYPASSRLS le ferait ; ce n'est donc jamais l'outil d'un contournement.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION scope2_run_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
     OR NEW.input_fingerprint IS DISTINCT FROM OLD.input_fingerprint
     OR NEW.result IS DISTINCT FROM OLD.result
     OR NEW.factor_versions IS DISTINCT FROM OLD.factor_versions
     OR NEW.methodology_code IS DISTINCT FROM OLD.methodology_code
     OR NEW.methodology_version IS DISTINCT FROM OLD.methodology_version
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.geography_code IS DISTINCT FROM OLD.geography_code
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
  THEN
    RAISE EXCEPTION
      'scope2_engine: run % immuable — entrées, méthodologie et résultat ne sont pas modifiables (recalculer un nouveau run)',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scope2_runs_immutable ON scope2_calculation_runs;
CREATE TRIGGER trg_scope2_runs_immutable
  BEFORE UPDATE ON scope2_calculation_runs
  FOR EACH ROW EXECUTE FUNCTION scope2_run_immutability_guard();

-- ---------------------------------------------------------------------------
-- Immutabilité des lignes de trace : une ligne de résultat ne se réécrit pas
-- (elle est produite par un run, et un run est immuable). Recalculer = nouveau
-- run. La suppression reste possible via la CASCADE du run parent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION scope2_line_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'scope2_engine: ligne de résultat % immuable — la trace de calcul ne se réécrit pas (recalculer un nouveau run)',
    OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_scope2_lines_immutable ON scope2_line_results;
CREATE TRIGGER trg_scope2_lines_immutable
  BEFORE UPDATE ON scope2_line_results
  FOR EACH ROW EXECUTE FUNCTION scope2_line_immutability_guard();

-- ---------------------------------------------------------------------------
-- Accès applicatif — même geste que 027/028/030/031 : si la migration est
-- appliquée par un rôle admin distinct du rôle applicatif (DATABASE_ADMIN_URL
-- en prod via db-migrate.yml), l'app (DATABASE_URL, rôle carbonco_app) a besoin
-- d'un GRANT explicite. No-op si carbonco_app est déjà propriétaire ou absent.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      scope2_calculation_runs, scope2_line_results
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      scope2_calculation_runs_id_seq, scope2_line_results_id_seq
      TO carbonco_app;
  END IF;
END $$;
