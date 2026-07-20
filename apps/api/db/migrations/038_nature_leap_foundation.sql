-- Migration 038 — Fondation biodiversité : référentiel nature, intersections
-- géométriques, dépendances/impacts TNFD, dossiers LEAP (PR-09, tranche A).
--
-- mode: requires_owner=false (migration_manifest.py) — CREATE TABLE neufs
-- uniquement, aucun ALTER d'une table existante. Précédent direct : 028/030/
-- 031/033/034/037 (jamais 027/036, qui altèrent `sites`/`actions`).
--
-- Numérotation : PR09_BIODIVERSITY_LEAP_IMPLEMENTATION_PLAN.md réservait `037`
-- (avant que PR-08 tranche B ne le prenne réellement) puis
-- WAVE_4_INTERFACE_CONTRACTS.md §13 réservait `037` à PR-09 et `038` à PR-10 —
-- les deux sont dépassés par l'état réel du dépôt (38 fichiers déjà mergés,
-- 001-037). Numérotation validée pour cette branche : 038 = fondation
-- Locate+Evaluate (ce fichier), 039 = Assess+Prepare (PR-09 tranche B).
-- Déviation documentée dans PR09_BIODIVERSITY_LEAP_TRACEABILITY.md.
--
-- ---------------------------------------------------------------------------
-- AUCUN NOUVEAU MODÈLE GÉOSPATIAL — réutilisation stricte de PR-08.
-- ---------------------------------------------------------------------------
-- Même décision validée que 036 : PAS DE POSTGIS. Coordonnées canoniques
-- latitude/longitude NUMERIC (sites, étendue par 036) ; zones = bbox_* +
-- boundary_geojson JSONB (Polygon/MultiPolygon) évaluées par le moteur PUR
-- `services/calculations/geo.py` (point-dans-polygone déterministe,
-- frontière = intérieur) — importé tel quel, jamais recopié. `method_code`
-- explicite sur chaque résultat géométrique (geojson_point_in_polygon_v1 /
-- geojson_bbox_prefilter_v1 / manual_coordinates_v1), jamais présenté comme
-- ST_Intersects/PostGIS.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION AJOUTE
-- ---------------------------------------------------------------------------
-- 1. `nature_features` — référentiel d'éléments naturels sensibles (aires
--    protégées, Key Biodiversity Areas, écosystèmes), portée mixte
--    tenant/globale (motif 034/036), TOUJOURS sourcé (source_release_id NOT
--    NULL, motif water_risk_areas). Masquage des données sensibles par
--    `sensitivity` (vocabulaire IDENTIQUE à evidence_artifacts.sensitivity,
--    028) : une ligne confidential/restricted ne renvoie jamais sa géométrie
--    précise dans une liste standard — voir services/nature/features_service.py.
-- 2. `site_nature_intersections` (Locate) — résultat FACTUEL et IMMUABLE
--    (trigger, précédent site_water_screenings 033/037) de l'intersection
--    d'un site (036) avec un nature_features, calculé via
--    `geo.match_point_to_area`. JAMAIS un score : proximité ≠ impact. Recalcul
--    = nouvelle ligne (historique conservé), jamais une réécriture. Gate de
--    revue humaine (pending/accepted/flagged) sur chaque ligne — aucune
--    conclusion automatique tant qu'un humain n'a pas accepté le fait.
-- 3. `nature_dependencies` / `nature_impacts` (Evaluate) — deux tables
--    SÉPARÉES par construction (TNFD : dépendre d'un service écosystémique
--    ≠ impacter un écosystème, deux directions différentes). Aucune colonne
--    commune ne les fusionne : dependencies porte ecosystem_service/
--    dependency_level, impacts porte pressure_type/impact_kind/
--    magnitude_qualitative. Gate de revue humaine (pending/accepted/flagged).
--    Lien matière sans FK fantôme (material_id TEXT, motif 034 — le
--    référentiel `materials` n'existe toujours pas) ; lien BOM réel
--    (bom_item_id, la table existe depuis 030).
-- 4. `leap_assessments` / `leap_assessment_sites` — le dossier LEAP
--    (Locate/Evaluate/Assess/Prepare) : ouvert en phase='locate' dès cette
--    migration, sa `phase` avance au fil de PR-09 (assess/prepare arrivent en
--    039). `status`/`approved_by` suivent le motif crma_article24_assessments
--    (034) : une approbation exige un approbateur humain identifié.
--
-- RLS gen-2 complète sur les 6 tables (ENABLE+FORCE, policies par commande,
-- DROP POLICY IF EXISTS, NULLIF/app.rls_bypass — pattern 034/036/037).
-- `nature_features` : lecture tenant OU globale, écriture tenant uniquement
-- (motif water_risk_areas/material_groups). Les 5 autres : tenant strict.
--
-- DÉFENSE EN PROFONDEUR APPLICATIVE OBLIGATOIRE EN PLUS (contrats §7) : le
-- PostgreSQL de CI se connecte en superuser (RLS bypassée, FORCE compris) —
-- chaque requête de service porte son prédicat `company_id = %s` explicite.
--
-- Aucune donnée métier migrée, aucune source externe ingérée, aucun LLM,
-- aucun appel réseau. Aucun scoring de risque/opportunité ici (tranche B,
-- migration 039) — proximité ≠ impact, dépendance ≠ risque financier.

-- ===========================================================================
-- A. nature_features — référentiel sourcé, portée mixte tenant/globale.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS nature_features (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT REFERENCES companies(id),
    code                  TEXT NOT NULL,
    label                 TEXT NOT NULL,
    feature_kind          TEXT NOT NULL DEFAULT 'ecosystem',
    bbox_min_lat          NUMERIC(9,6) NOT NULL,
    bbox_max_lat          NUMERIC(9,6) NOT NULL,
    bbox_min_lon          NUMERIC(9,6) NOT NULL,
    bbox_max_lon          NUMERIC(9,6) NOT NULL,
    boundary_geojson      JSONB NOT NULL,
    -- Masquage (précision de WAVE_4_INTERFACE_CONTRACTS.md §14.2) : vocabulaire
    -- IDENTIQUE à evidence_artifacts.sensitivity (028), jamais un 4e vocabulaire.
    sensitivity           TEXT NOT NULL DEFAULT 'public',
    source_release_id     BIGINT NOT NULL REFERENCES source_releases(id),
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    data_status           TEXT NOT NULL DEFAULT 'estimated',
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nature_features_kind_check CHECK (
        feature_kind IN ('protected_area', 'kba', 'ecosystem', 'other')
    ),
    CONSTRAINT nature_features_sensitivity_check CHECK (
        sensitivity IN ('public', 'internal', 'confidential', 'restricted')
    ),
    CONSTRAINT nature_features_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT nature_features_bbox_lat_check CHECK (
        bbox_min_lat >= -90 AND bbox_max_lat <= 90 AND bbox_min_lat <= bbox_max_lat
    ),
    CONSTRAINT nature_features_bbox_lon_check CHECK (
        bbox_min_lon >= -180 AND bbox_max_lon <= 180 AND bbox_min_lon <= bbox_max_lon
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nature_features_code_tenant
    ON nature_features (company_id, code) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_nature_features_code_global
    ON nature_features (code) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_nature_features_company ON nature_features(company_id);
CREATE INDEX IF NOT EXISTS idx_nature_features_bbox_lat
    ON nature_features(bbox_min_lat, bbox_max_lat);
CREATE INDEX IF NOT EXISTS idx_nature_features_bbox_lon
    ON nature_features(bbox_min_lon, bbox_max_lon);
CREATE INDEX IF NOT EXISTS idx_nature_features_release ON nature_features(source_release_id);
CREATE INDEX IF NOT EXISTS idx_nature_features_sensitivity ON nature_features(sensitivity);

-- ===========================================================================
-- B. site_nature_intersections (Locate) — fait géométrique immuable.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS site_nature_intersections (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id),
    site_id            BIGINT NOT NULL REFERENCES sites(id),
    feature_id         BIGINT NOT NULL REFERENCES nature_features(id),
    method_code        TEXT NOT NULL,
    bbox_candidate     BOOLEAN NOT NULL,
    -- FAIT géométrique uniquement — jamais un score, jamais une conclusion de
    -- matérialité. `matched=true` signifie « le site est dans la zone » (ou sur
    -- sa frontière, convention geo.py) ; l'interprétation reste humaine.
    matched            BOOLEAN NOT NULL,
    input_snapshot     JSONB NOT NULL,
    input_fingerprint  TEXT NOT NULL,
    review_status      TEXT NOT NULL DEFAULT 'pending',
    reviewed_by        BIGINT,
    reviewed_at        TIMESTAMPTZ,
    computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    computed_by        BIGINT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Vocabulaire FERMÉ, aligné sur geo.GEO_METHOD_CODES — jamais un libellé
    -- libre. bbox_prefilter n'apparaît qu'en pré-filtre (geo.py, jamais un
    -- method_code final) mais reste admis ici par cohérence avec le CHECK
    -- miroir de site_water_screenings (037) — usage réel toujours
    -- geojson_point_in_polygon_v1 (prouvé par test).
    CONSTRAINT site_nature_intersections_method_check CHECK (
        method_code IN ('geojson_point_in_polygon_v1', 'geojson_bbox_prefilter_v1', 'manual_coordinates_v1')
    ),
    CONSTRAINT site_nature_intersections_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    -- Une revue (accepted/rejected) porte TOUJOURS son réviseur et sa date.
    CONSTRAINT site_nature_intersections_reviewed_check CHECK (
        review_status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_site_nature_intersections_company
    ON site_nature_intersections(company_id);
CREATE INDEX IF NOT EXISTS idx_site_nature_intersections_site
    ON site_nature_intersections(company_id, site_id, computed_at);
CREATE INDEX IF NOT EXISTS idx_site_nature_intersections_feature
    ON site_nature_intersections(company_id, feature_id);
CREATE INDEX IF NOT EXISTS idx_site_nature_intersections_fingerprint
    ON site_nature_intersections(company_id, input_fingerprint);
CREATE INDEX IF NOT EXISTS idx_site_nature_intersections_matched
    ON site_nature_intersections(company_id, matched);

-- Immutabilité du fait géométrique (précédent site_water_screening_immutability_guard,
-- 037) : recalculer = une NOUVELLE ligne, jamais une réécriture des entrées ni
-- du résultat. Seuls review_status/reviewed_by/reviewed_at/updated_at sont
-- modifiables — la revue humaine ne peut jamais changer discrètement le fait.
-- (SECURITY DEFINER absent à dessein : la fonction ne lit que OLD/NEW — pour
-- mémoire, SECURITY DEFINER ne contournerait de toute façon PAS FORCE RLS.)
CREATE OR REPLACE FUNCTION site_nature_intersection_immutability_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.feature_id IS DISTINCT FROM OLD.feature_id
     OR NEW.method_code IS DISTINCT FROM OLD.method_code
     OR NEW.bbox_candidate IS DISTINCT FROM OLD.bbox_candidate
     OR NEW.matched IS DISTINCT FROM OLD.matched
     OR NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot
     OR NEW.input_fingerprint IS DISTINCT FROM OLD.input_fingerprint
     OR NEW.computed_at IS DISTINCT FROM OLD.computed_at
     OR NEW.computed_by IS DISTINCT FROM OLD.computed_by
  THEN
    RAISE EXCEPTION
      'nature: intersection % immuable — seule la revue (review_status, reviewed_by, reviewed_at) est modifiable, recalculer crée une NOUVELLE ligne',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_nature_intersections_guard ON site_nature_intersections;
CREATE TRIGGER trg_site_nature_intersections_guard
  BEFORE UPDATE ON site_nature_intersections
  FOR EACH ROW EXECUTE FUNCTION site_nature_intersection_immutability_guard();

-- ===========================================================================
-- C. nature_dependencies (Evaluate) — l'entreprise DÉPEND d'un service
--    écosystémique. JAMAIS fusionnée avec nature_impacts (colonnes disjointes).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS nature_dependencies (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    site_id               BIGINT REFERENCES sites(id),
    bom_item_id           BIGINT REFERENCES bom_items(id),
    material_id           TEXT,
    ecosystem_service     TEXT NOT NULL,
    -- Palier QUALITATIF explicite — jamais un score opaque (motif Wave 4 §1).
    dependency_level      TEXT NOT NULL,
    rationale             TEXT,
    data_status           TEXT NOT NULL DEFAULT 'manual',
    review_status         TEXT NOT NULL DEFAULT 'pending',
    source_release_id     BIGINT REFERENCES source_releases(id),
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nature_dependencies_service_check CHECK (
        ecosystem_service IN ('freshwater', 'pollination', 'soil_stability', 'other')
    ),
    CONSTRAINT nature_dependencies_level_check CHECK (
        dependency_level IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT nature_dependencies_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT nature_dependencies_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    -- Une dépendance sans ancrage (ni site, ni composant BOM, ni matière) ne
    -- décrit rien de vérifiable — refus explicite, pas une ligne orpheline.
    CONSTRAINT nature_dependencies_anchor_check CHECK (
        site_id IS NOT NULL OR bom_item_id IS NOT NULL OR material_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_nature_dependencies_company ON nature_dependencies(company_id);
CREATE INDEX IF NOT EXISTS idx_nature_dependencies_site ON nature_dependencies(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_nature_dependencies_bom_item ON nature_dependencies(bom_item_id);
CREATE INDEX IF NOT EXISTS idx_nature_dependencies_review
    ON nature_dependencies(company_id, review_status);

-- ===========================================================================
-- D. nature_impacts (Evaluate) — l'entreprise IMPACTE un écosystème. JAMAIS
--    fusionnée avec nature_dependencies. `pressure_type` porte la pression
--    TNFD comme ATTRIBUT de l'impact (pas de table nature_pressures séparée —
--    elle n'existe pas indépendamment d'un impact qui la matérialise).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS nature_impacts (
    id                     BIGSERIAL PRIMARY KEY,
    company_id             BIGINT NOT NULL REFERENCES companies(id),
    site_id                BIGINT REFERENCES sites(id),
    bom_item_id            BIGINT REFERENCES bom_items(id),
    material_id            TEXT,
    pressure_type          TEXT NOT NULL,
    impact_kind            TEXT NOT NULL,
    magnitude_qualitative  TEXT NOT NULL,
    rationale              TEXT,
    data_status            TEXT NOT NULL DEFAULT 'manual',
    review_status          TEXT NOT NULL DEFAULT 'pending',
    source_release_id      BIGINT REFERENCES source_releases(id),
    evidence_artifact_id   BIGINT REFERENCES evidence_artifacts(id),
    created_by             BIGINT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nature_impacts_pressure_check CHECK (
        pressure_type IN (
            'land_use_change', 'water_use', 'resource_exploitation',
            'climate_change', 'pollution', 'invasive_species', 'other'
        )
    ),
    CONSTRAINT nature_impacts_kind_check CHECK (
        impact_kind IN ('positive', 'negative')
    ),
    CONSTRAINT nature_impacts_magnitude_check CHECK (
        magnitude_qualitative IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT nature_impacts_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT nature_impacts_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    CONSTRAINT nature_impacts_anchor_check CHECK (
        site_id IS NOT NULL OR bom_item_id IS NOT NULL OR material_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_nature_impacts_company ON nature_impacts(company_id);
CREATE INDEX IF NOT EXISTS idx_nature_impacts_site ON nature_impacts(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_nature_impacts_bom_item ON nature_impacts(bom_item_id);
CREATE INDEX IF NOT EXISTS idx_nature_impacts_review ON nature_impacts(company_id, review_status);
CREATE INDEX IF NOT EXISTS idx_nature_impacts_kind ON nature_impacts(company_id, impact_kind);

-- ===========================================================================
-- E. leap_assessments — le dossier LEAP lui-même (traverse 038 et 039).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS leap_assessments (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL REFERENCES companies(id),
    label         TEXT NOT NULL,
    phase         TEXT NOT NULL DEFAULT 'locate',
    status        TEXT NOT NULL DEFAULT 'draft',
    prepared_by   BIGINT,
    approved_by   BIGINT,
    approved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT leap_assessments_phase_check CHECK (
        phase IN ('locate', 'evaluate', 'assess', 'prepare', 'completed')
    ),
    CONSTRAINT leap_assessments_status_check CHECK (
        status IN ('draft', 'under_review', 'approved')
    ),
    -- Une approbation exige un approbateur humain identifié (motif
    -- crma_article24_approval_check, 034).
    CONSTRAINT leap_assessments_approval_check CHECK (
        status <> 'approved' OR approved_by IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_leap_assessments_company ON leap_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_leap_assessments_phase ON leap_assessments(company_id, phase);
CREATE INDEX IF NOT EXISTS idx_leap_assessments_status ON leap_assessments(company_id, status);

-- ===========================================================================
-- F. leap_assessment_sites — association M:N dossier LEAP <-> sites.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS leap_assessment_sites (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL REFERENCES companies(id),
    assessment_id  BIGINT NOT NULL REFERENCES leap_assessments(id) ON DELETE CASCADE,
    site_id        BIGINT NOT NULL REFERENCES sites(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT leap_assessment_sites_uniq UNIQUE (assessment_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_leap_assessment_sites_company ON leap_assessment_sites(company_id);
CREATE INDEX IF NOT EXISTS idx_leap_assessment_sites_assessment
    ON leap_assessment_sites(assessment_id);
CREATE INDEX IF NOT EXISTS idx_leap_assessment_sites_site ON leap_assessment_sites(site_id);

-- ===========================================================================
-- PARTIE RLS — GÉNÉRATION 2 (ENABLE+FORCE, policies par commande, pattern
-- 034/036/037 : DROP POLICY IF EXISTS avant chaque CREATE POLICY).
-- ===========================================================================

-- ── nature_features (portée MIXTE : lecture tenant OU globale, écriture
--    tenant uniquement — l'écriture globale passe par app.rls_bypass, motif
--    water_risk_areas 036 / material_groups 034) ───────────────────────────
ALTER TABLE nature_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE nature_features FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nature_features ON nature_features;
CREATE POLICY tenant_isolation_nature_features ON nature_features
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_features_insert ON nature_features;
CREATE POLICY tenant_isolation_nature_features_insert ON nature_features
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_features_update ON nature_features;
CREATE POLICY tenant_isolation_nature_features_update ON nature_features
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_features_delete ON nature_features;
CREATE POLICY tenant_isolation_nature_features_delete ON nature_features
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── site_nature_intersections (tenant strict) ───────────────────────────────
ALTER TABLE site_nature_intersections ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_nature_intersections FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_site_nature_intersections ON site_nature_intersections;
CREATE POLICY tenant_isolation_site_nature_intersections ON site_nature_intersections
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_nature_intersections_insert ON site_nature_intersections;
CREATE POLICY tenant_isolation_site_nature_intersections_insert ON site_nature_intersections
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_nature_intersections_update ON site_nature_intersections;
CREATE POLICY tenant_isolation_site_nature_intersections_update ON site_nature_intersections
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_nature_intersections_delete ON site_nature_intersections;
CREATE POLICY tenant_isolation_site_nature_intersections_delete ON site_nature_intersections
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── nature_dependencies (tenant strict) ─────────────────────────────────────
ALTER TABLE nature_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE nature_dependencies FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nature_dependencies ON nature_dependencies;
CREATE POLICY tenant_isolation_nature_dependencies ON nature_dependencies
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_dependencies_insert ON nature_dependencies;
CREATE POLICY tenant_isolation_nature_dependencies_insert ON nature_dependencies
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_dependencies_update ON nature_dependencies;
CREATE POLICY tenant_isolation_nature_dependencies_update ON nature_dependencies
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_dependencies_delete ON nature_dependencies;
CREATE POLICY tenant_isolation_nature_dependencies_delete ON nature_dependencies
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── nature_impacts (tenant strict) ──────────────────────────────────────────
ALTER TABLE nature_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nature_impacts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nature_impacts ON nature_impacts;
CREATE POLICY tenant_isolation_nature_impacts ON nature_impacts
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_impacts_insert ON nature_impacts;
CREATE POLICY tenant_isolation_nature_impacts_insert ON nature_impacts
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_impacts_update ON nature_impacts;
CREATE POLICY tenant_isolation_nature_impacts_update ON nature_impacts
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_impacts_delete ON nature_impacts;
CREATE POLICY tenant_isolation_nature_impacts_delete ON nature_impacts
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── leap_assessments (tenant strict) ────────────────────────────────────────
ALTER TABLE leap_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leap_assessments FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_leap_assessments ON leap_assessments;
CREATE POLICY tenant_isolation_leap_assessments ON leap_assessments
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_leap_assessments_insert ON leap_assessments;
CREATE POLICY tenant_isolation_leap_assessments_insert ON leap_assessments
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_leap_assessments_update ON leap_assessments;
CREATE POLICY tenant_isolation_leap_assessments_update ON leap_assessments
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_leap_assessments_delete ON leap_assessments;
CREATE POLICY tenant_isolation_leap_assessments_delete ON leap_assessments
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── leap_assessment_sites (tenant strict) ───────────────────────────────────
ALTER TABLE leap_assessment_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE leap_assessment_sites FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_leap_assessment_sites ON leap_assessment_sites;
CREATE POLICY tenant_isolation_leap_assessment_sites ON leap_assessment_sites
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_leap_assessment_sites_insert ON leap_assessment_sites;
CREATE POLICY tenant_isolation_leap_assessment_sites_insert ON leap_assessment_sites
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_leap_assessment_sites_update ON leap_assessment_sites;
CREATE POLICY tenant_isolation_leap_assessment_sites_update ON leap_assessment_sites
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_leap_assessment_sites_delete ON leap_assessment_sites;
CREATE POLICY tenant_isolation_leap_assessment_sites_delete ON leap_assessment_sites
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- PARTIE GRANT — ACCÈS APPLICATIF (conditionnel, geste 027/028/030/031/033/
-- 034/036/037).
-- ===========================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      nature_features, site_nature_intersections, nature_dependencies,
      nature_impacts, leap_assessments, leap_assessment_sites
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      nature_features_id_seq, site_nature_intersections_id_seq,
      nature_dependencies_id_seq, nature_impacts_id_seq,
      leap_assessments_id_seq, leap_assessment_sites_id_seq
      TO carbonco_app;
  END IF;
END $$;
