-- Migration 043 — Module 2 (Ressources stratégiques) : expositions & moteur
-- d'assessment (PR-M2B). Par-dessus la fondation catalogue 042.
--
-- Architecture : MODULE2_DATA_MODEL.md §3, MODULE2_RLS_AND_SECURITY.md,
-- MODULE2_METHODOLOGY (HHI 0-10000, risque≠confiance, run immuable).
--
-- Tables ajoutées :
--   * resource_supply_observations  — part pays PAR ÉTAPE (entrée du HHI), portée mixte
--   * company_resource_exposure_links — pont d'exposition tenant vers un objet EXISTANT
--                                       (BOM/achat/énergie/eau/déclaration) — orchestre, ne recalcule pas
--   * resource_assessment_runs      — run d'assessment IMMUABLE (risque, confiance, couverture, input_hash)
--   * resource_assessment_dimensions — composantes inspectables du run (risque ET confiance, séparées)
--
-- INVARIANTS (schéma ET moteur) :
--   * RISQUE ≠ CONFIANCE : deux colonnes distinctes, deux CHECK séparés, jamais fusionnées.
--   * PAS DE FAIT SANS SOURCE : data_status='verified' ⇒ source_release_id NOT NULL.
--   * RUN IMMUABLE : input_snapshot/input_hash/risk_score/confidence figés (trigger) — recalcul = NOUVEAU run.
--   * D-4 : company_resource_exposure_links POINTE vers un objet carbone existant, ne stocke ni ne
--     recalcule aucun facteur d'émission.
--
-- iros_origin_domain_check N'EST PAS élargie ici : l'ÉMISSION d'un signal IRO
-- (origin_domain='strategic_resources', D-5) est reportée à une tranche
-- ultérieure. `resource_assessment_runs.iro_signal_id` est une FK NULLABLE
-- forward-compatible (référence iros(id), aucune ligne insérée). Cette migration
-- NE CRÉE donc QUE des tables neuves (aucun ALTER) — requires_owner=False,
-- comme 028/030/031/033/034/042. Aucune donnée métier semée, aucun LLM.

-- ===========================================================================
-- A. resource_supply_observations — part pays PAR ÉTAPE (fondation HHI)
-- ===========================================================================
-- Portée mixte (company_id NULLABLE : NULL = observation globale lisible par
-- tous, non-null = tenant). Miroir FK-validé de material_stage_observations
-- (034) pour la clé resource_id (042). L'unicité par (étape, pays, année,
-- métrique) interdit le double-comptage dans un HHI.
CREATE TABLE IF NOT EXISTS resource_supply_observations (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT REFERENCES companies(id),
    resource_id          BIGINT NOT NULL REFERENCES resource_catalog(id),
    stage_code           TEXT NOT NULL,
    country_code         TEXT NOT NULL,
    metric_code          TEXT NOT NULL DEFAULT 'production',
    share_pct            NUMERIC,
    volume_value         NUMERIC,
    volume_unit          TEXT,
    reference_year       INTEGER NOT NULL,
    data_status          TEXT NOT NULL DEFAULT 'estimated',
    confidence           NUMERIC,
    methodology_version  TEXT,
    source_release_id    BIGINT REFERENCES source_releases(id),
    evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id),
    observed_at          TIMESTAMPTZ,
    created_by           BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_supply_metric_check CHECK (
        metric_code IN ('production', 'reserves', 'refining_capacity', 'trade_export', 'trade_import')
    ),
    CONSTRAINT resource_supply_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT resource_supply_share_range_check CHECK (
        share_pct IS NULL OR (share_pct >= 0 AND share_pct <= 100)
    ),
    CONSTRAINT resource_supply_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    CONSTRAINT resource_supply_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    ),
    CONSTRAINT resource_supply_uniq UNIQUE (
        company_id, resource_id, stage_code, country_code, reference_year, metric_code
    )
);

CREATE INDEX IF NOT EXISTS idx_resource_supply_material_stage
    ON resource_supply_observations(resource_id, stage_code, reference_year);
CREATE INDEX IF NOT EXISTS idx_resource_supply_company ON resource_supply_observations(company_id);
CREATE INDEX IF NOT EXISTS idx_resource_supply_country ON resource_supply_observations(country_code);
CREATE INDEX IF NOT EXISTS idx_resource_supply_release ON resource_supply_observations(source_release_id);

-- ===========================================================================
-- B. company_resource_exposure_links — pont d'exposition (tenant strict, D-1)
-- ===========================================================================
-- Relie une ressource à un objet EXISTANT d'un autre module (BOM, achat,
-- énergie, eau, déclaration fournisseur) ou une saisie manuelle. `role` porte le
-- rôle exercé (D-1, non exclusif au niveau du lien). D-4 : aucune colonne de
-- facteur carbone — l'empreinte est LUE depuis le module cible, jamais recalculée.
CREATE TABLE IF NOT EXISTS company_resource_exposure_links (
    id                     BIGSERIAL PRIMARY KEY,
    company_id             BIGINT NOT NULL REFERENCES companies(id),
    resource_id            BIGINT NOT NULL REFERENCES resource_catalog(id),
    role                   TEXT NOT NULL,
    link_kind              TEXT NOT NULL,
    bom_item_id            BIGINT REFERENCES bom_items(id),
    purchase_line_id       BIGINT REFERENCES purchase_lines(id),
    energy_activity_id     BIGINT REFERENCES energy_activities(id),
    water_activity_id      BIGINT REFERENCES water_activities(id),
    supplier_declaration_id BIGINT REFERENCES supplier_metric_declarations(id),
    manual_note            TEXT,
    annual_mass_kg         NUMERIC,
    annual_spend_eur       NUMERIC,
    share_of_supply_pct    NUMERIC,
    stock_coverage_days    NUMERIC,
    data_status            TEXT NOT NULL DEFAULT 'manual',
    confidence             NUMERIC,
    notes                  TEXT,
    created_by             BIGINT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crel_role_check CHECK (
        role IN ('material', 'feedstock', 'energy_carrier', 'process_input',
                 'industrial_gas', 'nuclear_fuel', 'biomass', 'water')
    ),
    CONSTRAINT crel_link_kind_check CHECK (
        link_kind IN ('bom_item', 'purchase_line', 'energy_activity',
                      'water_activity', 'supplier_declaration', 'manual')
    ),
    CONSTRAINT crel_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT crel_share_range_check CHECK (
        share_of_supply_pct IS NULL OR (share_of_supply_pct >= 0 AND share_of_supply_pct <= 100)
    ),
    CONSTRAINT crel_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    CONSTRAINT crel_stock_check CHECK (
        stock_coverage_days IS NULL OR stock_coverage_days >= 0
    ),
    -- Exactement UNE cible, cohérente avec link_kind (jamais deux objets liés,
    -- jamais un lien orphelin ; 'manual' exige une note).
    CONSTRAINT crel_target_check CHECK (
        (link_kind = 'bom_item' AND bom_item_id IS NOT NULL AND purchase_line_id IS NULL
            AND energy_activity_id IS NULL AND water_activity_id IS NULL AND supplier_declaration_id IS NULL)
        OR (link_kind = 'purchase_line' AND purchase_line_id IS NOT NULL AND bom_item_id IS NULL
            AND energy_activity_id IS NULL AND water_activity_id IS NULL AND supplier_declaration_id IS NULL)
        OR (link_kind = 'energy_activity' AND energy_activity_id IS NOT NULL AND bom_item_id IS NULL
            AND purchase_line_id IS NULL AND water_activity_id IS NULL AND supplier_declaration_id IS NULL)
        OR (link_kind = 'water_activity' AND water_activity_id IS NOT NULL AND bom_item_id IS NULL
            AND purchase_line_id IS NULL AND energy_activity_id IS NULL AND supplier_declaration_id IS NULL)
        OR (link_kind = 'supplier_declaration' AND supplier_declaration_id IS NOT NULL AND bom_item_id IS NULL
            AND purchase_line_id IS NULL AND energy_activity_id IS NULL AND water_activity_id IS NULL)
        OR (link_kind = 'manual' AND manual_note IS NOT NULL AND bom_item_id IS NULL
            AND purchase_line_id IS NULL AND energy_activity_id IS NULL AND water_activity_id IS NULL
            AND supplier_declaration_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_crel_company ON company_resource_exposure_links(company_id);
CREATE INDEX IF NOT EXISTS idx_crel_resource ON company_resource_exposure_links(company_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_crel_bom ON company_resource_exposure_links(bom_item_id);
CREATE INDEX IF NOT EXISTS idx_crel_purchase ON company_resource_exposure_links(purchase_line_id);
CREATE INDEX IF NOT EXISTS idx_crel_energy ON company_resource_exposure_links(energy_activity_id);
CREATE INDEX IF NOT EXISTS idx_crel_water ON company_resource_exposure_links(water_activity_id);

-- ===========================================================================
-- C. resource_assessment_runs — run d'assessment IMMUABLE (tenant strict)
-- ===========================================================================
-- Instantané figé et reproductible d'un calcul d'exposition. Modèle « run »
-- (motif scope2_calculation_runs 033) : risque et confiance en DEUX colonnes,
-- input_snapshot + input_hash gelés (reproductibilité), recalcul = nouveau run
-- (supersedes_id). risk_score NULL autorisé (données obligatoires manquantes ⇒
-- pas d'indice inventé).
CREATE TABLE IF NOT EXISTS resource_assessment_runs (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    resource_id          BIGINT NOT NULL REFERENCES resource_catalog(id),
    assessment_year      INTEGER NOT NULL,
    status               TEXT NOT NULL DEFAULT 'computed',
    supersedes_id        BIGINT REFERENCES resource_assessment_runs(id),
    risk_score           NUMERIC,
    confidence           NUMERIC,
    coverage_pct         NUMERIC,
    observed_hhi         NUMERIC,
    missing_share_pct    NUMERIC,
    methodology_code     TEXT NOT NULL DEFAULT 'CC-RESOURCE-EXPOSURE',
    methodology_version  TEXT NOT NULL DEFAULT '0.1.0',
    input_snapshot       JSONB NOT NULL,
    input_hash           TEXT NOT NULL,
    drivers              JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings             JSONB NOT NULL DEFAULT '[]'::jsonb,
    sensitivity          JSONB,
    iro_signal_id        BIGINT REFERENCES iros(id),
    calculated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculated_by        BIGINT,
    approved_at          TIMESTAMPTZ,
    approved_by          BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_run_status_check CHECK (
        status IN ('computed', 'approved', 'superseded')
    ),
    -- Deux intervalles SÉPARÉS : risk_score et confidence sont indépendants.
    CONSTRAINT resource_run_risk_range_check CHECK (
        risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
    ),
    CONSTRAINT resource_run_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT resource_run_coverage_range_check CHECK (
        coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100)
    ),
    CONSTRAINT resource_run_hhi_range_check CHECK (
        observed_hhi IS NULL OR (observed_hhi >= 0 AND observed_hhi <= 10000)
    ),
    CONSTRAINT resource_run_missing_range_check CHECK (
        missing_share_pct IS NULL OR (missing_share_pct >= 0 AND missing_share_pct <= 100)
    ),
    CONSTRAINT resource_run_approval_check CHECK (
        status <> 'approved' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
    )
);

-- Un seul run COURANT par (ressource, année) ; l'historique (superseded) est préservé.
CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_run_current
    ON resource_assessment_runs (company_id, resource_id, assessment_year)
    WHERE status <> 'superseded';
CREATE INDEX IF NOT EXISTS idx_resource_run_company ON resource_assessment_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_resource_run_status ON resource_assessment_runs(company_id, status);
CREATE INDEX IF NOT EXISTS idx_resource_run_hash ON resource_assessment_runs(company_id, input_hash);

-- ===========================================================================
-- D. resource_assessment_dimensions — composantes du run (tenant strict)
-- ===========================================================================
-- Chaque composante inspectable d'un run (motif ScoreComponent/ConfidenceComponent
-- de scoring.py). `kind` sépare risque et confiance — jamais additionnées.
-- `detail` porte les sous-valeurs SÉPARÉES (ex. substituabilité : maturité +
-- pénalité, jamais fusionnées). `source_release_ids` trace la provenance.
CREATE TABLE IF NOT EXISTS resource_assessment_dimensions (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id),
    run_id             BIGINT NOT NULL REFERENCES resource_assessment_runs(id) ON DELETE CASCADE,
    kind               TEXT NOT NULL,
    dimension_code     TEXT NOT NULL,
    available          BOOLEAN NOT NULL,
    risk_value         NUMERIC,
    weight             NUMERIC,
    contribution       NUMERIC,
    raw_value          NUMERIC,
    raw_unit           TEXT,
    stage_code         TEXT,
    rationale          TEXT,
    detail             JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_release_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_dim_kind_check CHECK (kind IN ('risk', 'confidence')),
    CONSTRAINT resource_dim_uniq UNIQUE (run_id, kind, dimension_code)
);

CREATE INDEX IF NOT EXISTS idx_resource_dim_run ON resource_assessment_dimensions(company_id, run_id);

-- ===========================================================================
-- PARTIE 2 — RLS GÉNÉRATION 2
-- ===========================================================================

-- ── resource_supply_observations (portée mixte : lecture globale+tenant) ────
ALTER TABLE resource_supply_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_supply_observations FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_supply_observations ON resource_supply_observations;
CREATE POLICY tenant_isolation_resource_supply_observations ON resource_supply_observations
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_supply_observations_insert ON resource_supply_observations;
CREATE POLICY tenant_isolation_resource_supply_observations_insert ON resource_supply_observations
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_supply_observations_update ON resource_supply_observations;
CREATE POLICY tenant_isolation_resource_supply_observations_update ON resource_supply_observations
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_supply_observations_delete ON resource_supply_observations;
CREATE POLICY tenant_isolation_resource_supply_observations_delete ON resource_supply_observations
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── company_resource_exposure_links (tenant strict) ─────────────────────────
ALTER TABLE company_resource_exposure_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_resource_exposure_links FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_company_resource_exposure_links ON company_resource_exposure_links;
CREATE POLICY tenant_isolation_company_resource_exposure_links ON company_resource_exposure_links
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_company_resource_exposure_links_insert ON company_resource_exposure_links;
CREATE POLICY tenant_isolation_company_resource_exposure_links_insert ON company_resource_exposure_links
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_company_resource_exposure_links_update ON company_resource_exposure_links;
CREATE POLICY tenant_isolation_company_resource_exposure_links_update ON company_resource_exposure_links
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_company_resource_exposure_links_delete ON company_resource_exposure_links;
CREATE POLICY tenant_isolation_company_resource_exposure_links_delete ON company_resource_exposure_links
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── resource_assessment_runs (tenant strict) ────────────────────────────────
ALTER TABLE resource_assessment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_assessment_runs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_runs ON resource_assessment_runs;
CREATE POLICY tenant_isolation_resource_assessment_runs ON resource_assessment_runs
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_runs_insert ON resource_assessment_runs;
CREATE POLICY tenant_isolation_resource_assessment_runs_insert ON resource_assessment_runs
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_runs_update ON resource_assessment_runs;
CREATE POLICY tenant_isolation_resource_assessment_runs_update ON resource_assessment_runs
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_runs_delete ON resource_assessment_runs;
CREATE POLICY tenant_isolation_resource_assessment_runs_delete ON resource_assessment_runs
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── resource_assessment_dimensions (tenant strict) ──────────────────────────
ALTER TABLE resource_assessment_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_assessment_dimensions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_dimensions ON resource_assessment_dimensions;
CREATE POLICY tenant_isolation_resource_assessment_dimensions ON resource_assessment_dimensions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_dimensions_insert ON resource_assessment_dimensions;
CREATE POLICY tenant_isolation_resource_assessment_dimensions_insert ON resource_assessment_dimensions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_dimensions_update ON resource_assessment_dimensions;
CREATE POLICY tenant_isolation_resource_assessment_dimensions_update ON resource_assessment_dimensions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_assessment_dimensions_delete ON resource_assessment_dimensions;
CREATE POLICY tenant_isolation_resource_assessment_dimensions_delete ON resource_assessment_dimensions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- PARTIE 3 — IMMUTABILITÉ DES RUNS ET DIMENSIONS (triggers)
-- ===========================================================================
-- Un run est un ENREGISTREMENT de calcul : entrées gelées, empreinte, chiffres
-- ne se réécrivent pas. Seuls le cycle de vie (status, approved_*, iro_signal_id)
-- et updated_at sont modifiables. Motif scope2_run_immutability_guard (033).
-- SANS SECURITY DEFINER (ne lit aucune table ; sous FORCE RLS, DEFINER ne
-- contournerait de toute façon rien).
CREATE OR REPLACE FUNCTION resource_run_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
     OR NEW.input_hash IS DISTINCT FROM OLD.input_hash
     OR NEW.risk_score IS DISTINCT FROM OLD.risk_score
     OR NEW.confidence IS DISTINCT FROM OLD.confidence
     OR NEW.coverage_pct IS DISTINCT FROM OLD.coverage_pct
     OR NEW.observed_hhi IS DISTINCT FROM OLD.observed_hhi
     OR NEW.missing_share_pct IS DISTINCT FROM OLD.missing_share_pct
     OR NEW.drivers IS DISTINCT FROM OLD.drivers
     OR NEW.sensitivity IS DISTINCT FROM OLD.sensitivity
     OR NEW.methodology_code IS DISTINCT FROM OLD.methodology_code
     OR NEW.methodology_version IS DISTINCT FROM OLD.methodology_version
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.assessment_year IS DISTINCT FROM OLD.assessment_year
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
  THEN
    RAISE EXCEPTION
      'resource_engine: run % immuable — entrées, empreinte et chiffres non modifiables (recalculer un nouveau run)',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resource_run_immutable ON resource_assessment_runs;
CREATE TRIGGER trg_resource_run_immutable
  BEFORE UPDATE ON resource_assessment_runs
  FOR EACH ROW EXECUTE FUNCTION resource_run_immutability_guard();

-- Les dimensions sont produites par un run figé : append-only, jamais réécrites.
-- Suppression via la CASCADE du run parent seulement.
CREATE OR REPLACE FUNCTION resource_dimension_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'resource_engine: dimension % immuable — la composante d''un run figé ne se réécrit pas (recalculer un nouveau run)',
    OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_resource_dimension_immutable ON resource_assessment_dimensions;
CREATE TRIGGER trg_resource_dimension_immutable
  BEFORE UPDATE ON resource_assessment_dimensions
  FOR EACH ROW EXECUTE FUNCTION resource_dimension_immutability_guard();

-- ===========================================================================
-- PARTIE 4 — ACCÈS APPLICATIF (GRANT conditionnel, motif 028/030/033/034/042)
-- ===========================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      resource_supply_observations, company_resource_exposure_links,
      resource_assessment_runs, resource_assessment_dimensions
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      resource_supply_observations_id_seq, company_resource_exposure_links_id_seq,
      resource_assessment_runs_id_seq, resource_assessment_dimensions_id_seq
      TO carbonco_app;
  END IF;
END $$;
