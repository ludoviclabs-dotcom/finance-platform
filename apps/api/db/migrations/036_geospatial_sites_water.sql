-- Migration 036 — Géospatial (sites) et ledger eau (PR-08, tranche A).
--
-- mode: manual-owner (requires_owner=true dans migration_manifest.py).
-- Cette migration ALTÈRE la table EXISTANTE `sites` (027) : en production,
-- `sites` appartient à `neondb_owner` (027 appliquée manuellement dans le Neon
-- SQL Editor le 2026-07-04) — `carbonco_app` ne peut pas exécuter cet ALTER.
-- Application via DATABASE_ADMIN_URL puis `mark-manual-verified`, précédent
-- direct : 027. Les tables NEUVES ci-dessous sont des CREATE TABLE purs qui
-- n'exigent pas de privilège propriétaire, mais elles voyagent dans le même
-- fichier que l'ALTER (une seule unité fonctionnelle), donc tout le fichier
-- passe par le chemin manuel.
--
-- ---------------------------------------------------------------------------
-- DÉCISION GÉOSPATIALE VALIDÉE : PAS DE POSTGIS.
-- ---------------------------------------------------------------------------
-- Aucun CREATE EXTENSION, aucune colonne geography/geometry, aucun ST_*.
-- La question de privilège PostGIS (WAVE_4_INTERFACE_CONTRACTS.md §3) est
-- tranchée par le repli documenté : coordonnées canoniques = latitude/longitude
-- NUMERIC ; zones = boîte englobante (bbox_*) + `boundary_geojson JSONB`
-- (Polygon/MultiPolygon GeoJSON évalué côté Python par un point-dans-polygone
-- DÉTERMINISTE — services/calculations/geo.py). La bbox est un PRÉ-FILTRE
-- uniquement, jamais un résultat : chaque résultat géométrique porte son
-- `method_code` explicite (geojson_point_in_polygon_v1 /
-- geojson_bbox_prefilter_v1 / manual_coordinates_v1) — jamais présenté comme
-- ST_Intersects. PostGIS reste une OPTIMISATION future optionnelle (migration
-- ultérieure dédiée), pas un prérequis. Aucun fallback silencieux.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION AJOUTE
-- ---------------------------------------------------------------------------
-- 1. `sites` + colonnes géo NULLABLES (aucun backfill, GET/POST /sites
--    existants inchangés) : latitude/longitude, précision, provenance du
--    géocodage, gate de revue `geocode_review_status` (pending|accepted|
--    flagged — vocabulaire déjà porté par supplier_sites 030 et
--    energy_activities 031, jamais un 4e vocabulaire).
-- 2. `site_geocode_candidates` — historique APPEND-ONLY des propositions de
--    géocodage (trigger d'immutabilité : seule la revue proposed→accepted/
--    rejected est permise, jamais une réécriture de coordonnées ; une
--    correction = un NOUVEAU candidat). La saisie manuelle passe par le MÊME
--    gate (`provider='manual'`, method_code='manual_coordinates_v1').
-- 3. Ledger eau : `water_imports` (idempotence de CONTENU sha256, patron
--    purchase_imports 030) + `water_activities` (prélèvement/consommation/
--    rejet par site et période, gate de revue) + `water_permits` (autorisation
--    administrative, preuve Evidence Kernel).
-- 4. Référentiel `water_risk_areas` (zones de stress hydrique, portée mixte
--    tenant/globale — motif 034) : TOUJOURS sourcée (`source_release_id NOT
--    NULL`, comme material_market_observations 034) — une zone sans release
--    est impossible à insérer ; la licence se lit via license_policy.evaluate
--    à l'usage, jamais dénormalisée ici.
--
-- RLS gen-2 sur toutes les tables NEUVES (ENABLE+FORCE, policies par commande,
-- DROP POLICY IF EXISTS, NULLIF/app.rls_bypass — pattern 028/030/031/033/034).
-- `sites` conserve sa RLS 027 telle quelle (les colonnes ajoutées sont
-- automatiquement couvertes par les policies existantes ; pas de retrofit
-- gen-2 dans cette vague, décision contrats Wave 4 §7.2).
--
-- DÉFENSE EN PROFONDEUR APPLICATIVE OBLIGATOIRE EN PLUS (contrats §7) : le
-- PostgreSQL de CI se connecte en superuser (RLS bypassée, FORCE compris) —
-- chaque requête de service porte son prédicat `company_id = %s` explicite.
--
-- Aucune donnée métier migrée, aucune source externe ingérée, aucun LLM,
-- aucun appel réseau. Aucun calcul de screening ici (tranche B, migration 037).

-- ===========================================================================
-- PARTIE 1 — EXTENSION DE `sites` (ALTER, requires_owner)
-- ===========================================================================
ALTER TABLE sites ADD COLUMN IF NOT EXISTS latitude              NUMERIC(9,6);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS longitude             NUMERIC(9,6);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geocode_precision     TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geocode_provider      TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geocode_provider_ref  TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geocode_review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geocode_reviewed_by   BIGINT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS geocode_reviewed_at   TIMESTAMPTZ;

-- CHECK rejouables (DROP + ADD, même geste que 035 pour purchase_lines) :
-- bornes géographiques et vocabulaires imposés EN BASE, pas seulement côté
-- service. Les lignes existantes (colonnes NULL) passent toutes.
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_latitude_range_check;
ALTER TABLE sites ADD CONSTRAINT sites_latitude_range_check CHECK (
    latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
);
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_longitude_range_check;
ALTER TABLE sites ADD CONSTRAINT sites_longitude_range_check CHECK (
    longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
);
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_geocode_review_status_check;
ALTER TABLE sites ADD CONSTRAINT sites_geocode_review_status_check CHECK (
    geocode_review_status IN ('pending', 'accepted', 'flagged')
);
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_geocode_precision_check;
ALTER TABLE sites ADD CONSTRAINT sites_geocode_precision_check CHECK (
    geocode_precision IS NULL
    OR geocode_precision IN ('exact', 'street', 'city', 'country', 'manual')
);
-- Une position acceptée porte TOUJOURS ses deux coordonnées et son réviseur
-- (jamais d'acceptation anonyme ni de latitude orpheline).
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_geocode_accepted_check;
ALTER TABLE sites ADD CONSTRAINT sites_geocode_accepted_check CHECK (
    geocode_review_status <> 'accepted'
    OR (latitude IS NOT NULL AND longitude IS NOT NULL AND geocode_reviewed_by IS NOT NULL)
);

-- ===========================================================================
-- PARTIE 2 — TABLES NEUVES
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A. site_geocode_candidates — historique append-only des propositions.
--    Un géocodeur (adaptateur enregistré comme MÉTADONNÉE — aucun appel réseau
--    réel dans ce dépôt) ou une saisie manuelle PROPOSE ; un analyste ACCEPTE
--    ou REJETTE ; l'acceptation promeut sites.latitude/longitude. Jamais de
--    mise à jour d'une ligne revue : une correction ajoute un nouveau candidat
--    (même philosophie que source_releases/observations 028).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_geocode_candidates (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    site_id               BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    provider              TEXT NOT NULL,
    provider_ref          TEXT,
    latitude              NUMERIC(9,6) NOT NULL,
    longitude             NUMERIC(9,6) NOT NULL,
    "precision"           TEXT,
    method_code           TEXT NOT NULL DEFAULT 'manual_coordinates_v1',
    source_release_id     BIGINT REFERENCES source_releases(id),
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    status                TEXT NOT NULL DEFAULT 'proposed',
    review_note           TEXT,
    reviewed_by           BIGINT,
    reviewed_at           TIMESTAMPTZ,
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT site_geocode_candidates_lat_check CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT site_geocode_candidates_lon_check CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT site_geocode_candidates_precision_check CHECK (
        "precision" IS NULL OR "precision" IN ('exact', 'street', 'city', 'country', 'manual')
    ),
    CONSTRAINT site_geocode_candidates_status_check CHECK (
        status IN ('proposed', 'accepted', 'rejected')
    ),
    -- Le code de méthode est un vocabulaire FERMÉ : jamais un libellé libre qui
    -- laisserait présenter la méthode comme autre chose que ce qu'elle est.
    CONSTRAINT site_geocode_candidates_method_check CHECK (
        method_code IN ('manual_coordinates_v1', 'geojson_point_in_polygon_v1', 'geojson_bbox_prefilter_v1')
    ),
    -- Une revue (accepted/rejected) porte TOUJOURS son réviseur et sa date.
    CONSTRAINT site_geocode_candidates_reviewed_check CHECK (
        status = 'proposed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_site_geocode_candidates_company
    ON site_geocode_candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_site_geocode_candidates_site
    ON site_geocode_candidates(company_id, site_id, status);

-- Append-only EN BASE : la seule transition permise est la revue d'un candidat
-- `proposed` (status/review_note/reviewed_by/reviewed_at). Coordonnées,
-- provider, méthode, rattachements : IMMUABLES. Une ligne déjà revue ne se
-- modifie plus jamais. DELETE refusé (l'historique des propositions est une
-- preuve). Même geste que scope2_run_immutability_guard (033).
-- (SECURITY DEFINER absent à dessein : la fonction ne lit que OLD/NEW ;
-- rappel — SECURITY DEFINER ne contournerait de toute façon PAS FORCE RLS.)
CREATE OR REPLACE FUNCTION site_geocode_candidate_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'geo: candidat de géocodage % append-only — suppression interdite (l''historique des propositions est une preuve)',
      OLD.id;
  END IF;
  IF OLD.status <> 'proposed' THEN
    RAISE EXCEPTION
      'geo: candidat de géocodage % déjà revu (%) — aucune modification possible, proposer un NOUVEAU candidat',
      OLD.id, OLD.status;
  END IF;
  IF NEW.latitude IS DISTINCT FROM OLD.latitude
     OR NEW.longitude IS DISTINCT FROM OLD.longitude
     OR NEW."precision" IS DISTINCT FROM OLD."precision"
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_ref IS DISTINCT FROM OLD.provider_ref
     OR NEW.method_code IS DISTINCT FROM OLD.method_code
     OR NEW.source_release_id IS DISTINCT FROM OLD.source_release_id
     OR NEW.evidence_artifact_id IS DISTINCT FROM OLD.evidence_artifact_id
     OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION
      'geo: candidat de géocodage % immuable — seule la revue (status, review_note, reviewed_by, reviewed_at) est modifiable',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_geocode_candidates_guard ON site_geocode_candidates;
CREATE TRIGGER trg_site_geocode_candidates_guard
  BEFORE UPDATE OR DELETE ON site_geocode_candidates
  FOR EACH ROW EXECUTE FUNCTION site_geocode_candidate_guard();

-- ---------------------------------------------------------------------------
-- B. water_imports — idempotence de CONTENU d'un import CSV d'activités eau
--    (patron purchase_imports 030 : UNIQUE(company_id, sha256) — rejouer les
--    mêmes octets est un no-op, jamais un doublon) + gate de revue de l'import.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_imports (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    filename        TEXT NOT NULL,
    sha256          TEXT NOT NULL,
    row_count       INTEGER NOT NULL DEFAULT 0,
    accepted_count  INTEGER NOT NULL DEFAULT 0,
    rejected_count  INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    imported_by     BIGINT,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT water_imports_status_check CHECK (
        status IN ('pending', 'validated', 'rejected')
    ),
    CONSTRAINT water_imports_sha_uniq UNIQUE (company_id, sha256)
);

CREATE INDEX IF NOT EXISTS idx_water_imports_company ON water_imports(company_id);

-- ---------------------------------------------------------------------------
-- C. water_activities — donnée d'activité eau par site/type/période
--    (prélèvement, consommation, rejet). Calquée sur energy_activities (031) :
--    mêmes vocabulaires data_status/review_status, idempotence de LIGNE en
--    base par clé naturelle. La clé naturelle inclut `source_type` (déviation
--    documentée du plan §5 : un même site peut prélever la même période en
--    eau de surface ET au réseau — les fusionner serait une perte silencieuse
--    de flux physiques distincts).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_activities (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    site_id               BIGINT NOT NULL REFERENCES sites(id),
    activity_type         TEXT NOT NULL,
    source_type           TEXT NOT NULL DEFAULT 'other',
    quantity_m3           NUMERIC NOT NULL,
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    import_id             BIGINT REFERENCES water_imports(id),
    data_status           TEXT NOT NULL DEFAULT 'manual',
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    review_status         TEXT NOT NULL DEFAULT 'pending',
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT water_activities_type_check CHECK (
        activity_type IN ('withdrawal', 'consumption', 'discharge')
    ),
    CONSTRAINT water_activities_source_type_check CHECK (
        source_type IN ('surface', 'groundwater', 'municipal', 'seawater', 'other')
    ),
    CONSTRAINT water_activities_quantity_check CHECK (quantity_m3 >= 0),
    CONSTRAINT water_activities_period_check CHECK (period_end >= period_start),
    CONSTRAINT water_activities_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT water_activities_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    -- Pas de fait « vérifié » sans preuve enregistrée (même geste que les
    -- *_sourced_check de 034).
    CONSTRAINT water_activities_sourced_check CHECK (
        data_status <> 'verified' OR evidence_artifact_id IS NOT NULL
    ),
    -- Idempotence de LIGNE : un flux (site, type, source, période) n'existe
    -- qu'une fois — réimporter la même période est un no-op (ON CONFLICT).
    CONSTRAINT water_activities_idempotency_uniq UNIQUE (
        company_id, site_id, activity_type, source_type, period_start, period_end
    )
);

CREATE INDEX IF NOT EXISTS idx_water_activities_company ON water_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_water_activities_site
    ON water_activities(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_water_activities_period
    ON water_activities(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_water_activities_review
    ON water_activities(company_id, review_status);
CREATE INDEX IF NOT EXISTS idx_water_activities_import ON water_activities(import_id);

-- ---------------------------------------------------------------------------
-- D. water_permits — autorisation administrative de prélèvement/rejet d'un
--    site. La preuve (l'arrêté, l'autorisation) est une pièce Evidence Kernel.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_permits (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    site_id               BIGINT NOT NULL REFERENCES sites(id),
    permit_type           TEXT NOT NULL,
    permit_reference      TEXT,
    authorized_volume_m3  NUMERIC,
    valid_from            DATE,
    valid_to              DATE,
    issuing_authority     TEXT,
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    status                TEXT NOT NULL DEFAULT 'active',
    review_status         TEXT NOT NULL DEFAULT 'pending',
    notes                 TEXT,
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT water_permits_type_check CHECK (
        permit_type IN ('withdrawal', 'discharge', 'operation', 'other')
    ),
    CONSTRAINT water_permits_volume_check CHECK (
        authorized_volume_m3 IS NULL OR authorized_volume_m3 >= 0
    ),
    CONSTRAINT water_permits_validity_check CHECK (
        valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from
    ),
    CONSTRAINT water_permits_status_check CHECK (
        status IN ('active', 'expired', 'revoked')
    ),
    CONSTRAINT water_permits_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    )
);

CREATE INDEX IF NOT EXISTS idx_water_permits_company ON water_permits(company_id);
CREATE INDEX IF NOT EXISTS idx_water_permits_site ON water_permits(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_water_permits_validity ON water_permits(valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- E. water_risk_areas — référentiel de zones de stress hydrique, portée MIXTE
--    tenant/globale (company_id NULLABLE — motif material_groups 034 : lecture
--    tenant OU globale, écriture tenant uniquement, écriture globale via
--    app.rls_bypass depuis le CLI d'administration — jamais un endpoint
--    utilisateur). TOUJOURS sourcée : `source_release_id NOT NULL` rend
--    impossible une zone « venue de nulle part » ; la licence (affichage /
--    usage dérivé) se lit à l'usage via license_policy.evaluate sur la source
--    de la release — jamais dénormalisée ici (une licence peut changer).
--
--    Géométrie SANS PostGIS : bbox (pré-filtre indexable) + boundary_geojson
--    (Polygon/MultiPolygon, anneaux intérieurs/trous inclus) évaluée côté
--    Python (services/calculations/geo.py, point-dans-polygone déterministe).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_risk_areas (
    id                        BIGSERIAL PRIMARY KEY,
    company_id                BIGINT REFERENCES companies(id),
    code                      TEXT NOT NULL,
    label                     TEXT NOT NULL,
    area_kind                 TEXT NOT NULL DEFAULT 'basin',
    scenario_code             TEXT NOT NULL DEFAULT 'baseline',
    horizon_year              INTEGER,
    baseline_stress_category  TEXT NOT NULL,
    bbox_min_lat              NUMERIC(9,6) NOT NULL,
    bbox_max_lat              NUMERIC(9,6) NOT NULL,
    bbox_min_lon              NUMERIC(9,6) NOT NULL,
    bbox_max_lon              NUMERIC(9,6) NOT NULL,
    boundary_geojson          JSONB NOT NULL,
    source_release_id         BIGINT NOT NULL REFERENCES source_releases(id),
    evidence_artifact_id      BIGINT REFERENCES evidence_artifacts(id),
    data_status               TEXT NOT NULL DEFAULT 'estimated',
    created_by                BIGINT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT water_risk_areas_kind_check CHECK (
        area_kind IN ('basin', 'aquifer', 'administrative', 'custom')
    ),
    CONSTRAINT water_risk_areas_stress_check CHECK (
        baseline_stress_category IN ('low', 'low_medium', 'medium_high', 'high', 'extremely_high')
    ),
    CONSTRAINT water_risk_areas_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT water_risk_areas_bbox_lat_check CHECK (
        bbox_min_lat >= -90 AND bbox_max_lat <= 90 AND bbox_min_lat <= bbox_max_lat
    ),
    CONSTRAINT water_risk_areas_bbox_lon_check CHECK (
        bbox_min_lon >= -180 AND bbox_max_lon <= 180 AND bbox_min_lon <= bbox_max_lon
    )
);

-- Unicité du code par scénario/horizon : une fois par tenant, une fois en
-- global (partial index, geste 028/034).
CREATE UNIQUE INDEX IF NOT EXISTS uq_water_risk_areas_code_tenant
    ON water_risk_areas (company_id, code, scenario_code, COALESCE(horizon_year, 0))
    WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_water_risk_areas_code_global
    ON water_risk_areas (code, scenario_code, COALESCE(horizon_year, 0))
    WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_water_risk_areas_company ON water_risk_areas(company_id);
-- Pré-filtre bbox : les requêtes de screening cherchent les zones dont la
-- boîte contient un point (bbox_min_lat <= lat <= bbox_max_lat, idem lon).
CREATE INDEX IF NOT EXISTS idx_water_risk_areas_bbox_lat
    ON water_risk_areas(bbox_min_lat, bbox_max_lat);
CREATE INDEX IF NOT EXISTS idx_water_risk_areas_bbox_lon
    ON water_risk_areas(bbox_min_lon, bbox_max_lon);
CREATE INDEX IF NOT EXISTS idx_water_risk_areas_release
    ON water_risk_areas(source_release_id);

-- ===========================================================================
-- PARTIE 3 — RLS GÉNÉRATION 2 (tables neuves uniquement)
-- ===========================================================================

-- ── site_geocode_candidates (tenant strict) ─────────────────────────────────
ALTER TABLE site_geocode_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_geocode_candidates FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_site_geocode_candidates ON site_geocode_candidates;
CREATE POLICY tenant_isolation_site_geocode_candidates ON site_geocode_candidates
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_geocode_candidates_insert ON site_geocode_candidates;
CREATE POLICY tenant_isolation_site_geocode_candidates_insert ON site_geocode_candidates
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_geocode_candidates_update ON site_geocode_candidates;
CREATE POLICY tenant_isolation_site_geocode_candidates_update ON site_geocode_candidates
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_site_geocode_candidates_delete ON site_geocode_candidates;
CREATE POLICY tenant_isolation_site_geocode_candidates_delete ON site_geocode_candidates
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── water_imports (tenant strict) ───────────────────────────────────────────
ALTER TABLE water_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_imports FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_water_imports ON water_imports;
CREATE POLICY tenant_isolation_water_imports ON water_imports
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_imports_insert ON water_imports;
CREATE POLICY tenant_isolation_water_imports_insert ON water_imports
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_imports_update ON water_imports;
CREATE POLICY tenant_isolation_water_imports_update ON water_imports
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_imports_delete ON water_imports;
CREATE POLICY tenant_isolation_water_imports_delete ON water_imports
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── water_activities (tenant strict) ────────────────────────────────────────
ALTER TABLE water_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_activities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_water_activities ON water_activities;
CREATE POLICY tenant_isolation_water_activities ON water_activities
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_activities_insert ON water_activities;
CREATE POLICY tenant_isolation_water_activities_insert ON water_activities
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_activities_update ON water_activities;
CREATE POLICY tenant_isolation_water_activities_update ON water_activities
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_activities_delete ON water_activities;
CREATE POLICY tenant_isolation_water_activities_delete ON water_activities
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── water_permits (tenant strict) ───────────────────────────────────────────
ALTER TABLE water_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_permits FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_water_permits ON water_permits;
CREATE POLICY tenant_isolation_water_permits ON water_permits
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_permits_insert ON water_permits;
CREATE POLICY tenant_isolation_water_permits_insert ON water_permits
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_permits_update ON water_permits;
CREATE POLICY tenant_isolation_water_permits_update ON water_permits
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_permits_delete ON water_permits;
CREATE POLICY tenant_isolation_water_permits_delete ON water_permits
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── water_risk_areas (portée MIXTE : lecture tenant OU globale, écriture
--    tenant uniquement — l'écriture globale passe par app.rls_bypass, motif
--    material_groups 034) ─────────────────────────────────────────────────────
ALTER TABLE water_risk_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_risk_areas FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_water_risk_areas ON water_risk_areas;
CREATE POLICY tenant_isolation_water_risk_areas ON water_risk_areas
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_risk_areas_insert ON water_risk_areas;
CREATE POLICY tenant_isolation_water_risk_areas_insert ON water_risk_areas
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_risk_areas_update ON water_risk_areas;
CREATE POLICY tenant_isolation_water_risk_areas_update ON water_risk_areas
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_water_risk_areas_delete ON water_risk_areas;
CREATE POLICY tenant_isolation_water_risk_areas_delete ON water_risk_areas
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- PARTIE 4 — ACCÈS APPLICATIF (GRANT conditionnel, geste 027/028/030/031/033)
-- ===========================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      site_geocode_candidates, water_imports, water_activities,
      water_permits, water_risk_areas
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      site_geocode_candidates_id_seq, water_imports_id_seq,
      water_activities_id_seq, water_permits_id_seq, water_risk_areas_id_seq
      TO carbonco_app;
  END IF;
END $$;
