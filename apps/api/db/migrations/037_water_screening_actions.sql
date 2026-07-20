-- Migration 037 — Screening hydrique auditable, cibles et actions eau
-- (PR-08, tranche B).
--
-- Par-dessus la fondation 036 (sites géolocalisés + ledger eau + référentiel
-- water_risk_areas). Ne crée QUE des tables neuves (aucun ALTER d'une table
-- existante) — pas de privilège propriétaire requis, comme 028/030/031/033/034.
--
-- 1. `site_water_screenings` — résultat VERSIONNÉ et IMMUABLE d'un screening
--    site × zones de stress hydrique. Méthodologie versionnée
--    (methodology_code/version), snapshot d'entrée gelé (trigger, précédent
--    033), `method_code` géométrique EXPLICITE (geojson_point_in_polygon_v1 —
--    bbox = pré-filtre uniquement, jamais un résultat ; jamais présenté comme
--    ST_Intersects/PostGIS). Risque (`risk_category`, ordinal issu des zones
--    appariées) et confiance (`confidence`, qualité du socle documentaire)
--    sont DEUX colonnes SÉPARÉES avec deux CHECK indépendants (précédent 034,
--    contrats §6 Wave 4) — jamais fusionnés.
--    `iro_signal` n'enregistre JAMAIS une décision de matérialité : c'est un
--    signal-à-examiner posé par un humain, avec sa justification obligatoire ;
--    la promotion effective en IRO reste l'affaire de PR-10 (contrats §10 —
--    aucune table *_iro_candidates par domaine).
-- 2. `water_targets` — cibles eau déclarées, rattachées à un site et
--    (optionnellement) au screening qui les motive. Revue humaine gatée.
-- 3. `water_actions` — actions eau (efficacité, réutilisation…), calquées sur
--    mitigation_actions (034) : `expected_reduction_m3` est une INTENTION
--    déclarée, jamais appliquée automatiquement à un résultat de screening.
--
-- RLS gen-2 tenant STRICT sur les trois tables (company_id BIGINT NOT NULL,
-- ENABLE+FORCE, policies par commande, DROP POLICY IF EXISTS, NULLIF/
-- app.rls_bypass). Défense en profondeur applicative obligatoire en plus
-- (CI superuser bypasse la RLS — prédicats company_id = %s dans les services).
--
-- Aucun calcul exécuté par la migration, aucune donnée métier migrée, aucun
-- LLM, aucune source externe ingérée, aucun appel réseau.

-- ---------------------------------------------------------------------------
-- A. site_water_screenings — run de screening versionné, snapshot immuable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_water_screenings (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    site_id               BIGINT NOT NULL REFERENCES sites(id),
    methodology_code      TEXT NOT NULL DEFAULT 'CC-WATER-SCREENING',
    methodology_version   TEXT NOT NULL,
    method_code           TEXT NOT NULL,
    scenario_code         TEXT NOT NULL DEFAULT 'baseline',
    -- Snapshot gelé des entrées (position acceptée du site, zones candidates,
    -- décisions de licence) — reproductibilité et auditabilité (précédent 033).
    input_snapshot        JSONB NOT NULL,
    input_fingerprint     TEXT NOT NULL,
    result                JSONB NOT NULL,
    matched_area_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- RISQUE : catégorie ordinale issue des zones appariées (vocabulaire du
    -- référentiel water_risk_areas). SÉPARÉE de la confiance, jamais pondérée
    -- par elle. NULL = aucune zone appariée (résultat « hors zone connue »,
    -- ce qui n'est PAS un risque nul — voir warnings/coverage).
    risk_category         TEXT,
    risk_components       JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- CONFIANCE : solidité du socle documentaire (précision du géocodage,
    -- fraîcheur/statut des données de zones). Ne dit RIEN du niveau de risque.
    confidence            NUMERIC,
    coverage_pct          NUMERIC,
    warnings              JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Signal IRO : un geste HUMAIN (« à examiner comme IRO »), jamais une
    -- décision. La justification est obligatoire dès que le signal est posé.
    iro_signal            BOOLEAN NOT NULL DEFAULT false,
    iro_signal_rationale  TEXT,
    iro_signal_by         BIGINT,
    iro_signal_at         TIMESTAMPTZ,
    calculated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculated_by         BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT site_water_screenings_method_check CHECK (
        method_code IN ('geojson_point_in_polygon_v1', 'geojson_bbox_prefilter_v1', 'manual_coordinates_v1')
    ),
    CONSTRAINT site_water_screenings_risk_check CHECK (
        risk_category IS NULL
        OR risk_category IN ('low', 'low_medium', 'medium_high', 'high', 'extremely_high')
    ),
    -- Deux intervalles SÉPARÉS, aucune contrainte ne lie risque et confiance.
    CONSTRAINT site_water_screenings_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT site_water_screenings_coverage_range_check CHECK (
        coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100)
    ),
    -- Un signal IRO posé porte TOUJOURS sa justification et son auteur.
    CONSTRAINT site_water_screenings_iro_signal_check CHECK (
        iro_signal = false
        OR (iro_signal_rationale IS NOT NULL AND iro_signal_by IS NOT NULL AND iro_signal_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_site_water_screenings_company
    ON site_water_screenings(company_id);
CREATE INDEX IF NOT EXISTS idx_site_water_screenings_site
    ON site_water_screenings(company_id, site_id, calculated_at);
CREATE INDEX IF NOT EXISTS idx_site_water_screenings_fingerprint
    ON site_water_screenings(company_id, input_fingerprint);
CREATE INDEX IF NOT EXISTS idx_site_water_screenings_signal
    ON site_water_screenings(company_id, iro_signal);

-- Immutabilité du run (précédent scope2_run_immutability_guard, 033) : les
-- entrées gelées, la méthode et le résultat ne se réécrivent JAMAIS. Seuls le
-- signal IRO (iro_signal, iro_signal_rationale, iro_signal_by, iro_signal_at)
-- et updated_at sont modifiables — poser un signal ne peut pas changer
-- discrètement les chiffres. Recalculer = un NOUVEAU run.
CREATE OR REPLACE FUNCTION site_water_screening_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
     OR NEW.input_fingerprint IS DISTINCT FROM OLD.input_fingerprint
     OR NEW.result IS DISTINCT FROM OLD.result
     OR NEW.matched_area_ids IS DISTINCT FROM OLD.matched_area_ids
     OR NEW.risk_category IS DISTINCT FROM OLD.risk_category
     OR NEW.risk_components IS DISTINCT FROM OLD.risk_components
     OR NEW.confidence IS DISTINCT FROM OLD.confidence
     OR NEW.coverage_pct IS DISTINCT FROM OLD.coverage_pct
     OR NEW.warnings IS DISTINCT FROM OLD.warnings
     OR NEW.methodology_code IS DISTINCT FROM OLD.methodology_code
     OR NEW.methodology_version IS DISTINCT FROM OLD.methodology_version
     OR NEW.method_code IS DISTINCT FROM OLD.method_code
     OR NEW.scenario_code IS DISTINCT FROM OLD.scenario_code
     OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.calculated_at IS DISTINCT FROM OLD.calculated_at
     OR NEW.calculated_by IS DISTINCT FROM OLD.calculated_by
  THEN
    RAISE EXCEPTION
      'water_screening: run % immuable — entrées, méthode et résultat ne se réécrivent pas (recalculer un nouveau run)',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_water_screenings_immutable ON site_water_screenings;
CREATE TRIGGER trg_site_water_screenings_immutable
  BEFORE UPDATE ON site_water_screenings
  FOR EACH ROW EXECUTE FUNCTION site_water_screening_immutability_guard();

-- ---------------------------------------------------------------------------
-- B. water_targets — cibles eau déclarées (réduction de prélèvement, etc.).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_targets (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id),
    site_id             BIGINT REFERENCES sites(id),
    screening_id        BIGINT REFERENCES site_water_screenings(id) ON DELETE SET NULL,
    target_type         TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    baseline_year       INTEGER,
    target_year         INTEGER,
    baseline_value_m3   NUMERIC,
    target_value_m3     NUMERIC,
    status              TEXT NOT NULL DEFAULT 'draft',
    review_status       TEXT NOT NULL DEFAULT 'pending',
    notes               TEXT,
    created_by          BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT water_targets_type_check CHECK (
        target_type IN ('withdrawal_reduction', 'consumption_reduction',
                        'discharge_quality', 'reuse_rate', 'other')
    ),
    CONSTRAINT water_targets_status_check CHECK (
        status IN ('draft', 'active', 'achieved', 'abandoned')
    ),
    CONSTRAINT water_targets_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    CONSTRAINT water_targets_years_check CHECK (
        baseline_year IS NULL OR target_year IS NULL OR target_year >= baseline_year
    ),
    CONSTRAINT water_targets_baseline_value_check CHECK (
        baseline_value_m3 IS NULL OR baseline_value_m3 >= 0
    ),
    CONSTRAINT water_targets_target_value_check CHECK (
        target_value_m3 IS NULL OR target_value_m3 >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_water_targets_company ON water_targets(company_id);
CREATE INDEX IF NOT EXISTS idx_water_targets_site ON water_targets(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_water_targets_screening ON water_targets(screening_id);

-- ---------------------------------------------------------------------------
-- C. water_actions — actions eau. `expected_reduction_m3` est une INTENTION
--    déclarée, jamais soustraite automatiquement d'un résultat (précédent
--    mitigation_actions 034).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_actions (
    id                     BIGSERIAL PRIMARY KEY,
    company_id             BIGINT NOT NULL REFERENCES companies(id),
    site_id                BIGINT REFERENCES sites(id),
    screening_id           BIGINT REFERENCES site_water_screenings(id) ON DELETE SET NULL,
    target_id              BIGINT REFERENCES water_targets(id) ON DELETE SET NULL,
    action_type            TEXT NOT NULL,
    title                  TEXT NOT NULL,
    description            TEXT,
    status                 TEXT NOT NULL DEFAULT 'planned',
    owner                  TEXT,
    due_date               DATE,
    completed_at           TIMESTAMPTZ,
    expected_effect        TEXT,
    expected_reduction_m3  NUMERIC,
    review_status          TEXT NOT NULL DEFAULT 'pending',
    created_by             BIGINT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT water_actions_type_check CHECK (
        action_type IN ('efficiency', 'reuse', 'recycling', 'sourcing_change',
                        'treatment', 'monitoring', 'other')
    ),
    CONSTRAINT water_actions_status_check CHECK (
        status IN ('planned', 'in_progress', 'completed', 'cancelled')
    ),
    CONSTRAINT water_actions_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    CONSTRAINT water_actions_reduction_check CHECK (
        expected_reduction_m3 IS NULL OR expected_reduction_m3 >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_water_actions_company ON water_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_water_actions_site ON water_actions(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_water_actions_screening ON water_actions(screening_id);
CREATE INDEX IF NOT EXISTS idx_water_actions_status ON water_actions(company_id, status);

-- ---------------------------------------------------------------------------
-- RLS gen-2 — tenant strict sur les trois tables.
-- ---------------------------------------------------------------------------

-- ── site_water_screenings ───────────────────────────────────────────────────
ALTER TABLE site_water_screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_water_screenings FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_site_water_screenings ON site_water_screenings;
CREATE POLICY tenant_isolation_site_water_screenings ON site_water_screenings
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_water_screenings_insert ON site_water_screenings;
CREATE POLICY tenant_isolation_site_water_screenings_insert ON site_water_screenings
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_water_screenings_update ON site_water_screenings;
CREATE POLICY tenant_isolation_site_water_screenings_update ON site_water_screenings
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_water_screenings_delete ON site_water_screenings;
CREATE POLICY tenant_isolation_site_water_screenings_delete ON site_water_screenings
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── water_targets ───────────────────────────────────────────────────────────
ALTER TABLE water_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_targets FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_water_targets ON water_targets;
CREATE POLICY tenant_isolation_water_targets ON water_targets
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_targets_insert ON water_targets;
CREATE POLICY tenant_isolation_water_targets_insert ON water_targets
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_targets_update ON water_targets;
CREATE POLICY tenant_isolation_water_targets_update ON water_targets
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_targets_delete ON water_targets;
CREATE POLICY tenant_isolation_water_targets_delete ON water_targets
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── water_actions ───────────────────────────────────────────────────────────
ALTER TABLE water_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_actions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_water_actions ON water_actions;
CREATE POLICY tenant_isolation_water_actions ON water_actions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_actions_insert ON water_actions;
CREATE POLICY tenant_isolation_water_actions_insert ON water_actions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_actions_update ON water_actions;
CREATE POLICY tenant_isolation_water_actions_update ON water_actions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_actions_delete ON water_actions;
CREATE POLICY tenant_isolation_water_actions_delete ON water_actions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ---------------------------------------------------------------------------
-- Accès applicatif — GRANT conditionnel (geste 027/028/030/031/033/036).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      site_water_screenings, water_targets, water_actions
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      site_water_screenings_id_seq, water_targets_id_seq, water_actions_id_seq
      TO carbonco_app;
  END IF;
END $$;
