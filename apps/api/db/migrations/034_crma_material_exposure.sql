-- Migration 034 — CRMA, aimants permanents et exposition matières critiques
-- (PR-07) : référentiels globaux (groupes, étapes de la chaîne de valeur,
-- observations par étape, marché, substituts, recyclage, événements) et tables
-- tenant (exposition entreprise, évaluations Article 24, actions d'atténuation).
--
-- Phase 6 de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §12/§20.
-- MVP : terres rares pour aimants permanents (NdFeB, SmCo).
--
-- ---------------------------------------------------------------------------
-- PRINCIPES NON NÉGOCIABLES MATÉRIALISÉS ICI (plan §12.4, §1.10, §1.11)
-- ---------------------------------------------------------------------------
-- 1. RISQUE ≠ CONFIANCE. `crma_article24_assessments` porte DEUX colonnes
--    distinctes (`risk_score`, `confidence`) avec deux CHECK d'intervalle
--    séparés. Aucune colonne ne les fusionne, aucune vue ne les combine.
-- 2. CONCENTRATION PAR ÉTAPE. `material_stage_observations.stage_code` est
--    NOT NULL : une part pays n'existe JAMAIS hors d'une étape. Il est donc
--    impossible, au niveau du schéma, d'enregistrer une « part pays globale »
--    qui mélangerait extraction et raffinage (gate de la Phase 6). La contrainte
--    d'unicité inclut l'étape, et l'index de calcul est (material_id,
--    stage_code, reference_year) — tout agrégat passe par une étape.
-- 3. AUCUN SCORE OFFICIEL UE. `methodology_code` est NOT NULL et vaut par
--    défaut 'CC-MATERIAL-EXPOSURE' : le score est une méthode CarbonCo
--    versionnée, jamais un score réglementaire. Le nom du règlement est
--    conservé séparément dans `regulation_version` (ex. 'CRMA-2024') qui
--    qualifie le STATUT critique/stratégique, pas le score.
-- 4. STATUT CRITIQUE / STRATÉGIQUE NON EXCLUSIF (plan §12.1) : porté par
--    `material_group_members` via des groupes ('eu_critical', 'eu_strategic'),
--    donc une matière peut appartenir aux DEUX. Aucun booléen exclusif, aucune
--    colonne `criticality` unique. Toute matière stratégique doit aussi être
--    critique — invariant applicatif vérifié par les tests (il dépend du
--    contenu, pas du schéma).
-- 5. LICENCE AVANT AFFICHAGE (contrats §8). `material_market_observations`
--    (prix, volumes marché) porte `source_release_id NOT NULL` : une donnée de
--    marché SANS release enregistrée est impossible à insérer. Le droit
--    d'affichage/d'usage dérivé se lit ensuite via
--    `license_policy.evaluate(source)` côté service — le schéma garantit
--    seulement qu'il y a toujours une source à interroger.
-- 6. PAS DE FAIT SANS SOURCE NI AVEU D'ESTIMATION. Les tables factuelles
--    globales portent un CHECK `*_sourced_check` : `data_status = 'verified'`
--    exige `source_release_id NOT NULL`. Une ligne non sourcée reste possible
--    mais doit s'avouer `estimated`/`manual`/`inferred` (prohibition
--    « aucune donnée externe réelle ingérée » : les fixtures de test sont donc
--    explicitement estimées).
--
-- ---------------------------------------------------------------------------
-- RÉFÉRENCE MATIÈRE : `material_id TEXT`, PAS DE FK
-- ---------------------------------------------------------------------------
-- Le référentiel `materials` lui-même relève d'une migration distincte
-- (`033_material_reference_crma.sql` dans l'arborescence cible du plan, §
-- « arborescence »), NON fusionnée à ce jour. PR-07 ne la crée pas et ne peut
-- pas dépendre d'un travail non mergé : la clé de jointure est donc
-- `material_id TEXT`, exactement le type déjà retenu par
-- `material_mappings.material_id` (migration 030, dont le commentaire annonce
-- « référentiel matières global = PR-07 ; ici material_id nullable/texte tant
-- qu'absent »). Cohérent avec l'existant, sans FK fantôme. Quand 033 arrivera,
-- une migration ultérieure pourra promouvoir ces colonnes en FK.
--
-- ---------------------------------------------------------------------------
-- RLS GÉNÉRATION 2 (comme 028/030/031)
-- ---------------------------------------------------------------------------
-- ENABLE + FORCE, policies scopées PAR COMMANDE (SELECT/INSERT/UPDATE/DELETE),
-- NULLIF(current_setting('app.current_company_id'))::bigint, app.rls_bypass,
-- DROP POLICY IF EXISTS avant chaque CREATE (rejouable par startup_event en
-- dev). DEUX portées coexistent ici, contrairement à 030/031 :
--   * RÉFÉRENTIEL GLOBAL (`company_id BIGINT` NULLABLE) — material_groups,
--     material_group_members, processing_stages, material_stage_observations,
--     material_market_observations, substitutes, recycling_routes,
--     trade_or_regulatory_events. LECTURE : `company_id IS NULL` (ligne
--     globale) OU la ligne du tenant. ÉCRITURE : tenant UNIQUEMENT — jamais
--     `IS NULL`. Un tenant ne crée ni ne modifie jamais une ligne globale ;
--     l'écriture globale passe par `app.rls_bypass = 'on'` (service admin).
--     C'est le pattern 028 à l'identique.
--   * TENANT STRICT (`company_id BIGINT NOT NULL`) — company_material_exposures,
--     crma_article24_assessments, mitigation_actions. La branche de lecture
--     `company_id IS NULL` est conservée par cohérence de pattern (inerte sous
--     NOT NULL), comme 030.
--
-- DÉFENSE EN PROFONDEUR APPLICATIVE OBLIGATOIRE EN PLUS (contrats §7) : le
-- PostgreSQL de CI se connecte en superuser, qui BYPASSE la RLS (FORCE
-- compris). Sans prédicat de périmètre explicite dans chaque requête de
-- service, aucun test d'isolation ne prouve quoi que ce soit en CI. Voir
-- `services/crma/*` : `_SCOPE` / `_GLOBAL_SCOPE`.
--
-- Cette migration ne crée QUE des tables neuves (aucun ALTER d'une table
-- existante) — pas de privilège propriétaire requis, comme 028/030/031.
-- Aucune donnée métier migrée, aucune source externe ingérée, aucun LLM.
-- Les seules lignes insérées sont les 8 étapes de la chaîne de valeur : un
-- VOCABULAIRE structurel (comme une contrainte CHECK), pas une donnée
-- factuelle sur le monde — donc pas de source à citer.
--
-- FK BIGINT vers des PK INTEGER historiques (suppliers.id, products.id,
-- companies.id sont SERIAL/int4) : valide en PostgreSQL, même geste que
-- 028/030.

-- ===========================================================================
-- PARTIE 1 — RÉFÉRENTIELS GLOBAUX
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A. material_groups — regroupements de matières (familles industrielles ET
--    statuts réglementaires). Le statut critique/stratégique est modélisé
--    comme une APPARTENANCE À UN GROUPE, pas comme deux booléens sur la
--    matière : c'est ce qui rend le statut NON EXCLUSIF (plan §12.1) et
--    versionnable (`regulation_version`). Une matière stratégique appartient
--    aux deux groupes 'eu_strategic' ET 'eu_critical'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_groups (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT REFERENCES companies(id),
    code               TEXT NOT NULL,
    label              TEXT NOT NULL,
    group_kind         TEXT NOT NULL DEFAULT 'family',
    regulation_version TEXT,
    description        TEXT,
    created_by         BIGINT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT material_groups_kind_check CHECK (
        group_kind IN ('family', 'regulatory', 'application', 'custom')
    )
);

-- Unicité du code : une fois par tenant, une fois en global (le partial index
-- sur company_id IS NULL est le geste de 028 pour source_registry.code).
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_groups_code_tenant
    ON material_groups (company_id, code) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_material_groups_code_global
    ON material_groups (code) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_material_groups_kind ON material_groups(group_kind);

-- ---------------------------------------------------------------------------
-- B. material_group_members — appartenance matière -> groupe. Table
--    d'association PURE : c'est elle qui porte « critique » et « stratégique »
--    simultanément pour une même matière (aucune exclusion possible par
--    construction, contrairement à deux colonnes booléennes d'une table
--    `materials` où rien n'empêcherait strategic=true/critical=false).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_group_members (
    id           BIGSERIAL PRIMARY KEY,
    company_id   BIGINT REFERENCES companies(id),
    group_id     BIGINT NOT NULL REFERENCES material_groups(id) ON DELETE CASCADE,
    material_id  TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT material_group_members_uniq UNIQUE (group_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_material_group_members_material ON material_group_members(material_id);
CREATE INDEX IF NOT EXISTS idx_material_group_members_group ON material_group_members(group_id);

-- ---------------------------------------------------------------------------
-- C. processing_stages — étapes ORDONNÉES de la chaîne de valeur.
--    `stage_order` matérialise l'ordre amont -> aval et permet de vérifier
--    qu'une comparaison ne saute pas d'un maillon à l'autre. `is_upstream`
--    distingue l'amont extractif (extraction/séparation) de la transformation :
--    c'est le garde-fou lisible du principe « l'extraction n'est JAMAIS
--    mélangée au raffinage ni à la transformation ».
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processing_stages (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT REFERENCES companies(id),
    code        TEXT NOT NULL,
    label       TEXT NOT NULL,
    stage_order INTEGER NOT NULL,
    is_upstream BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_processing_stages_code_tenant
    ON processing_stages (company_id, code) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_processing_stages_code_global
    ON processing_stages (code) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_processing_stages_order ON processing_stages(stage_order);

-- Le vocabulaire des 8 étapes est semé en PARTIE 3bis, APRÈS l'activation de
-- la RLS, via `app.rls_bypass` — l'idiome documenté d'écriture globale
-- (contrats §7). Le semer ici, avant `ENABLE ROW LEVEL SECURITY`, marcherait
-- au premier passage mais deviendrait un piège au rejeu (startup_event en dev
-- local) : `FORCE ROW LEVEL SECURITY` s'applique AUSSI au propriétaire de la
-- table, et la policy INSERT refuse `company_id IS NULL`.

-- ---------------------------------------------------------------------------
-- D. material_stage_observations — part d'un pays dans une matière À UNE
--    ÉTAPE DONNÉE. `stage_code` NOT NULL : le schéma REND IMPOSSIBLE une part
--    pays « globale » hors étape. C'est le cœur du gate de la Phase 6.
--    Sourcée par le noyau Evidence Kernel (source_release_id /
--    evidence_artifact_id, contrats §3). `confidence` (0-1) reste SÉPARÉ de
--    `data_status` (contrats §2).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_stage_observations (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT REFERENCES companies(id),
    material_id          TEXT NOT NULL,
    stage_code           TEXT NOT NULL,
    country_code         TEXT NOT NULL,
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
    CONSTRAINT material_stage_observations_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT material_stage_observations_share_range_check CHECK (
        share_pct IS NULL OR (share_pct >= 0 AND share_pct <= 100)
    ),
    CONSTRAINT material_stage_observations_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    -- Pas de fait « vérifié » sans release enregistrée (contrats §3, gate
    -- Phase 3). Une ligne sans source doit s'avouer estimée/manuelle/inférée.
    CONSTRAINT material_stage_observations_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    ),
    -- Une seule part par (matière, étape, pays, année, portée) : rend les
    -- ré-imports idempotents et interdit le double comptage dans un HHI.
    CONSTRAINT material_stage_observations_uniq UNIQUE (
        company_id, material_id, stage_code, country_code, reference_year
    )
);

CREATE INDEX IF NOT EXISTS idx_material_stage_obs_material_stage
    ON material_stage_observations(material_id, stage_code, reference_year);
CREATE INDEX IF NOT EXISTS idx_material_stage_obs_company ON material_stage_observations(company_id);
CREATE INDEX IF NOT EXISTS idx_material_stage_obs_country ON material_stage_observations(country_code);
CREATE INDEX IF NOT EXISTS idx_material_stage_obs_release ON material_stage_observations(source_release_id);

-- ---------------------------------------------------------------------------
-- E. material_market_observations — prix / volumes de marché. TOUJOURS
--    licenciés : `source_release_id NOT NULL` rend impossible l'insertion
--    d'un prix « venu de nulle part ». Le droit d'AFFICHER (allow_display) et
--    le droit de CALCULER (allow_derived_use) sont évalués à la lecture par
--    `license_policy.evaluate` — jamais recopiés ici (une licence peut
--    changer ; la dénormaliser produirait un droit périmé).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_market_observations (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT REFERENCES companies(id),
    material_id          TEXT NOT NULL,
    stage_code           TEXT,
    metric_code          TEXT NOT NULL,
    numeric_value        NUMERIC,
    unit                 TEXT,
    currency             TEXT,
    observed_at          TIMESTAMPTZ NOT NULL,
    data_status          TEXT NOT NULL DEFAULT 'estimated',
    confidence           NUMERIC,
    source_release_id    BIGINT NOT NULL REFERENCES source_releases(id),
    evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT material_market_observations_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT material_market_observations_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

CREATE INDEX IF NOT EXISTS idx_material_market_obs_material
    ON material_market_observations(material_id, metric_code, observed_at);
CREATE INDEX IF NOT EXISTS idx_material_market_obs_release
    ON material_market_observations(source_release_id);
CREATE INDEX IF NOT EXISTS idx_material_market_obs_company ON material_market_observations(company_id);

-- ---------------------------------------------------------------------------
-- F. substitutes — matière de substitution possible, À UNE ÉTAPE DONNÉE.
--    `maturity` est un palier qualitatif explicite (jamais un score opaque) et
--    `performance_penalty_pct` dit le coût technique de la substitution.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS substitutes (
    id                      BIGSERIAL PRIMARY KEY,
    company_id              BIGINT REFERENCES companies(id),
    material_id             TEXT NOT NULL,
    substitute_material_id  TEXT NOT NULL,
    stage_code              TEXT,
    application             TEXT,
    maturity                TEXT NOT NULL DEFAULT 'research',
    performance_penalty_pct NUMERIC,
    data_status             TEXT NOT NULL DEFAULT 'estimated',
    notes                   TEXT,
    source_release_id       BIGINT REFERENCES source_releases(id),
    evidence_artifact_id    BIGINT REFERENCES evidence_artifacts(id),
    created_by              BIGINT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT substitutes_maturity_check CHECK (
        maturity IN ('research', 'pilot', 'commercial', 'mature')
    ),
    CONSTRAINT substitutes_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT substitutes_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    ),
    CONSTRAINT substitutes_not_self_check CHECK (substitute_material_id <> material_id),
    CONSTRAINT substitutes_uniq UNIQUE (company_id, material_id, substitute_material_id, stage_code, application)
);

CREATE INDEX IF NOT EXISTS idx_substitutes_material ON substitutes(material_id);
CREATE INDEX IF NOT EXISTS idx_substitutes_company ON substitutes(company_id);

-- ---------------------------------------------------------------------------
-- G. recycling_routes — filière de recyclage d'une matière (EoL, chutes de
--    production, réemploi d'aimants). `input_stage_code` / `output_stage_code`
--    disent OÙ la boucle se referme dans la chaîne de valeur : un recyclage
--    qui réinjecte à l'étape 'powder' ne réduit pas la dépendance à
--    l'extraction de la même façon qu'un recyclage réinjectant à 'separation'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recycling_routes (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT REFERENCES companies(id),
    material_id           TEXT NOT NULL,
    route_code            TEXT NOT NULL,
    label                 TEXT NOT NULL,
    input_stage_code      TEXT,
    output_stage_code     TEXT,
    maturity              TEXT NOT NULL DEFAULT 'research',
    recycled_content_pct  NUMERIC,
    recovery_rate_pct     NUMERIC,
    data_status           TEXT NOT NULL DEFAULT 'estimated',
    source_release_id     BIGINT REFERENCES source_releases(id),
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recycling_routes_maturity_check CHECK (
        maturity IN ('research', 'pilot', 'commercial', 'mature')
    ),
    CONSTRAINT recycling_routes_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT recycling_routes_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    ),
    CONSTRAINT recycling_routes_recycled_range_check CHECK (
        recycled_content_pct IS NULL OR (recycled_content_pct >= 0 AND recycled_content_pct <= 100)
    ),
    CONSTRAINT recycling_routes_recovery_range_check CHECK (
        recovery_rate_pct IS NULL OR (recovery_rate_pct >= 0 AND recovery_rate_pct <= 100)
    ),
    CONSTRAINT recycling_routes_uniq UNIQUE (company_id, material_id, route_code)
);

CREATE INDEX IF NOT EXISTS idx_recycling_routes_material ON recycling_routes(material_id);
CREATE INDEX IF NOT EXISTS idx_recycling_routes_company ON recycling_routes(company_id);

-- ---------------------------------------------------------------------------
-- H. trade_or_regulatory_events — événement commercial ou réglementaire
--    (contrôle à l'export, quota, droit de douane, sanction, incident).
--    `severity` est un palier explicite ; `stage_code` rattache l'événement à
--    l'étape touchée (un contrôle à l'export de poudres ne frappe pas
--    l'extraction). `effective_from`/`effective_to` bornent l'effet dans le
--    temps : le score ne compte QUE les événements actifs à la date d'analyse.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_or_regulatory_events (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT REFERENCES companies(id),
    material_id          TEXT,
    stage_code           TEXT,
    country_code         TEXT,
    event_type           TEXT NOT NULL,
    severity             TEXT NOT NULL DEFAULT 'medium',
    title                TEXT NOT NULL,
    description          TEXT,
    effective_from       DATE,
    effective_to         DATE,
    data_status          TEXT NOT NULL DEFAULT 'estimated',
    source_release_id    BIGINT REFERENCES source_releases(id),
    evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id),
    created_by           BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trade_events_type_check CHECK (
        event_type IN (
            'export_control', 'quota', 'tariff', 'sanction', 'ban',
            'subsidy', 'incident', 'regulation', 'other'
        )
    ),
    CONSTRAINT trade_events_severity_check CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT trade_events_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT trade_events_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    ),
    CONSTRAINT trade_events_period_check CHECK (
        effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from
    )
);

CREATE INDEX IF NOT EXISTS idx_trade_events_material ON trade_or_regulatory_events(material_id);
CREATE INDEX IF NOT EXISTS idx_trade_events_company ON trade_or_regulatory_events(company_id);
CREATE INDEX IF NOT EXISTS idx_trade_events_effective ON trade_or_regulatory_events(effective_from, effective_to);

-- ===========================================================================
-- PARTIE 2 — TABLES TENANT (company_id NOT NULL)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- I. company_material_exposures — exposition RÉELLE d'un tenant à une matière,
--    rattachée à sa chaîne d'approvisionnement (BOM PR-05A, fournisseur, site,
--    produit). `stock_coverage_days` porte la couverture de stock (composante
--    « stocks » du score). Les montants (`annual_spend_eur`) sont des données
--    PROPRES du tenant : aucune licence externe en jeu, contrairement aux prix
--    de marché (table E).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_material_exposures (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    material_id          TEXT NOT NULL,
    stage_code           TEXT,
    bom_item_id          BIGINT REFERENCES bom_items(id),
    material_mapping_id  BIGINT REFERENCES material_mappings(id),
    product_id           BIGINT REFERENCES products(id),
    supplier_id          BIGINT REFERENCES suppliers(id),
    supplier_site_id     BIGINT REFERENCES supplier_sites(id),
    annual_mass_kg       NUMERIC,
    annual_spend_eur     NUMERIC,
    share_of_supply_pct  NUMERIC,
    stock_coverage_days  NUMERIC,
    stock_as_of          DATE,
    reference_year       INTEGER,
    data_status          TEXT NOT NULL DEFAULT 'manual',
    confidence           NUMERIC,
    notes                TEXT,
    created_by           BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT company_material_exposures_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT company_material_exposures_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    CONSTRAINT company_material_exposures_share_range_check CHECK (
        share_of_supply_pct IS NULL OR (share_of_supply_pct >= 0 AND share_of_supply_pct <= 100)
    ),
    CONSTRAINT company_material_exposures_stock_check CHECK (
        stock_coverage_days IS NULL OR stock_coverage_days >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_company_material_exposures_company
    ON company_material_exposures(company_id);
CREATE INDEX IF NOT EXISTS idx_company_material_exposures_material
    ON company_material_exposures(company_id, material_id);
CREATE INDEX IF NOT EXISTS idx_company_material_exposures_bom_item
    ON company_material_exposures(bom_item_id);
CREATE INDEX IF NOT EXISTS idx_company_material_exposures_supplier
    ON company_material_exposures(supplier_id);

-- ---------------------------------------------------------------------------
-- J. crma_article24_assessments — évaluation Article 24 (CRMA) d'un tenant
--    pour une matière et une année.
--
--    RISQUE ET CONFIANCE SONT DEUX COLONNES. `risk_score` (0-100) dit
--    l'intensité du risque ; `confidence` (0-100) dit à quel point on croit ce
--    chiffre au vu des données disponibles. Les fusionner (p.ex. « risque
--    pondéré par la confiance ») produirait un nombre non interprétable :
--    c'est explicitement interdit (plan §1.10, contrats §2).
--
--    `components` (JSONB) garde CHAQUE composante séparément et inspectable
--    (valeur, poids, contribution, raison) — le score n'est jamais un nombre
--    opaque. `input_snapshot` conserve les entrées du calcul (reproductibilité,
--    contrats §4). `status` porte la revue humaine : un rapport Article 24
--    n'est jamais « approuvé » par un calcul.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crma_article24_assessments (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id),
    material_id         TEXT NOT NULL,
    assessment_year     INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft',
    risk_score          NUMERIC,
    confidence          NUMERIC,
    coverage_pct        NUMERIC,
    methodology_code    TEXT NOT NULL DEFAULT 'CC-MATERIAL-EXPOSURE',
    methodology_version TEXT NOT NULL DEFAULT '0.1.0',
    regulation_version  TEXT,
    components          JSONB NOT NULL DEFAULT '[]'::jsonb,
    drivers             JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings            JSONB NOT NULL DEFAULT '[]'::jsonb,
    input_snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
    vulnerability_summary TEXT,
    calculated_at       TIMESTAMPTZ,
    prepared_by         BIGINT,
    approved_by         BIGINT,
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crma_article24_status_check CHECK (
        status IN ('draft', 'under_review', 'approved', 'submitted')
    ),
    -- Deux intervalles SÉPARÉS : aucune contrainte ne lie risk_score et
    -- confidence, ce sont deux grandeurs indépendantes.
    CONSTRAINT crma_article24_risk_range_check CHECK (
        risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
    ),
    CONSTRAINT crma_article24_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT crma_article24_coverage_range_check CHECK (
        coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100)
    ),
    -- Une approbation exige un approbateur humain identifié (revue humaine).
    CONSTRAINT crma_article24_approval_check CHECK (
        status NOT IN ('approved', 'submitted') OR approved_by IS NOT NULL
    ),
    CONSTRAINT crma_article24_uniq UNIQUE (company_id, material_id, assessment_year)
);

CREATE INDEX IF NOT EXISTS idx_crma_article24_company ON crma_article24_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_crma_article24_material
    ON crma_article24_assessments(company_id, material_id, assessment_year);
CREATE INDEX IF NOT EXISTS idx_crma_article24_status ON crma_article24_assessments(status);

-- ---------------------------------------------------------------------------
-- K. mitigation_actions — actions d'atténuation du risque matière, rattachées
--    (optionnellement) à une évaluation Article 24. `expected_risk_reduction_pct`
--    est une INTENTION déclarée, jamais appliquée automatiquement au score :
--    aucun service ne soustrait cette valeur du `risk_score`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mitigation_actions (
    id                          BIGSERIAL PRIMARY KEY,
    company_id                  BIGINT NOT NULL REFERENCES companies(id),
    assessment_id               BIGINT REFERENCES crma_article24_assessments(id) ON DELETE SET NULL,
    material_id                 TEXT,
    target_stage_code           TEXT,
    action_type                 TEXT NOT NULL,
    title                       TEXT NOT NULL,
    description                 TEXT,
    status                      TEXT NOT NULL DEFAULT 'planned',
    owner                       TEXT,
    due_date                    DATE,
    completed_at                TIMESTAMPTZ,
    expected_effect             TEXT,
    expected_risk_reduction_pct NUMERIC,
    created_by                  BIGINT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mitigation_actions_type_check CHECK (
        action_type IN (
            'diversification', 'substitution', 'recycling', 'stockpiling',
            'supplier_audit', 'long_term_contract', 'rd', 'other'
        )
    ),
    CONSTRAINT mitigation_actions_status_check CHECK (
        status IN ('planned', 'in_progress', 'completed', 'cancelled')
    ),
    CONSTRAINT mitigation_actions_reduction_range_check CHECK (
        expected_risk_reduction_pct IS NULL
        OR (expected_risk_reduction_pct >= 0 AND expected_risk_reduction_pct <= 100)
    )
);

CREATE INDEX IF NOT EXISTS idx_mitigation_actions_company ON mitigation_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_mitigation_actions_assessment ON mitigation_actions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mitigation_actions_status ON mitigation_actions(status);

-- ===========================================================================
-- PARTIE 3 — RLS GÉNÉRATION 2
-- ===========================================================================
-- Lecture = tenant OU global (`company_id IS NULL`) ; écriture = tenant
-- UNIQUEMENT (jamais `IS NULL`). Policies par commande, DROP avant CREATE.

-- ── material_groups ─────────────────────────────────────────────────────────
ALTER TABLE material_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_groups FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_material_groups ON material_groups;
CREATE POLICY tenant_isolation_material_groups ON material_groups
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_groups_insert ON material_groups;
CREATE POLICY tenant_isolation_material_groups_insert ON material_groups
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_groups_update ON material_groups;
CREATE POLICY tenant_isolation_material_groups_update ON material_groups
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_groups_delete ON material_groups;
CREATE POLICY tenant_isolation_material_groups_delete ON material_groups
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── material_group_members ──────────────────────────────────────────────────
ALTER TABLE material_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_group_members FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_material_group_members ON material_group_members;
CREATE POLICY tenant_isolation_material_group_members ON material_group_members
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_group_members_insert ON material_group_members;
CREATE POLICY tenant_isolation_material_group_members_insert ON material_group_members
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_group_members_update ON material_group_members;
CREATE POLICY tenant_isolation_material_group_members_update ON material_group_members
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_group_members_delete ON material_group_members;
CREATE POLICY tenant_isolation_material_group_members_delete ON material_group_members
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── processing_stages ───────────────────────────────────────────────────────
ALTER TABLE processing_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_stages FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_processing_stages ON processing_stages;
CREATE POLICY tenant_isolation_processing_stages ON processing_stages
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_processing_stages_insert ON processing_stages;
CREATE POLICY tenant_isolation_processing_stages_insert ON processing_stages
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_processing_stages_update ON processing_stages;
CREATE POLICY tenant_isolation_processing_stages_update ON processing_stages
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_processing_stages_delete ON processing_stages;
CREATE POLICY tenant_isolation_processing_stages_delete ON processing_stages
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── material_stage_observations ─────────────────────────────────────────────
ALTER TABLE material_stage_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stage_observations FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_material_stage_observations ON material_stage_observations;
CREATE POLICY tenant_isolation_material_stage_observations ON material_stage_observations
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_stage_observations_insert ON material_stage_observations;
CREATE POLICY tenant_isolation_material_stage_observations_insert ON material_stage_observations
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_stage_observations_update ON material_stage_observations;
CREATE POLICY tenant_isolation_material_stage_observations_update ON material_stage_observations
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_stage_observations_delete ON material_stage_observations;
CREATE POLICY tenant_isolation_material_stage_observations_delete ON material_stage_observations
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── material_market_observations ────────────────────────────────────────────
ALTER TABLE material_market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_market_observations FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_material_market_observations ON material_market_observations;
CREATE POLICY tenant_isolation_material_market_observations ON material_market_observations
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_market_observations_insert ON material_market_observations;
CREATE POLICY tenant_isolation_material_market_observations_insert ON material_market_observations
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_market_observations_update ON material_market_observations;
CREATE POLICY tenant_isolation_material_market_observations_update ON material_market_observations
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_market_observations_delete ON material_market_observations;
CREATE POLICY tenant_isolation_material_market_observations_delete ON material_market_observations
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── substitutes ─────────────────────────────────────────────────────────────
ALTER TABLE substitutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_substitutes ON substitutes;
CREATE POLICY tenant_isolation_substitutes ON substitutes
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_substitutes_insert ON substitutes;
CREATE POLICY tenant_isolation_substitutes_insert ON substitutes
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_substitutes_update ON substitutes;
CREATE POLICY tenant_isolation_substitutes_update ON substitutes
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_substitutes_delete ON substitutes;
CREATE POLICY tenant_isolation_substitutes_delete ON substitutes
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── recycling_routes ────────────────────────────────────────────────────────
ALTER TABLE recycling_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycling_routes FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_recycling_routes ON recycling_routes;
CREATE POLICY tenant_isolation_recycling_routes ON recycling_routes
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_recycling_routes_insert ON recycling_routes;
CREATE POLICY tenant_isolation_recycling_routes_insert ON recycling_routes
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_recycling_routes_update ON recycling_routes;
CREATE POLICY tenant_isolation_recycling_routes_update ON recycling_routes
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_recycling_routes_delete ON recycling_routes;
CREATE POLICY tenant_isolation_recycling_routes_delete ON recycling_routes
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── trade_or_regulatory_events ──────────────────────────────────────────────
ALTER TABLE trade_or_regulatory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_or_regulatory_events FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_trade_or_regulatory_events ON trade_or_regulatory_events;
CREATE POLICY tenant_isolation_trade_or_regulatory_events ON trade_or_regulatory_events
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_trade_or_regulatory_events_insert ON trade_or_regulatory_events;
CREATE POLICY tenant_isolation_trade_or_regulatory_events_insert ON trade_or_regulatory_events
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_trade_or_regulatory_events_update ON trade_or_regulatory_events;
CREATE POLICY tenant_isolation_trade_or_regulatory_events_update ON trade_or_regulatory_events
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_trade_or_regulatory_events_delete ON trade_or_regulatory_events;
CREATE POLICY tenant_isolation_trade_or_regulatory_events_delete ON trade_or_regulatory_events
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── company_material_exposures (tenant strict) ──────────────────────────────
ALTER TABLE company_material_exposures ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_material_exposures FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_company_material_exposures ON company_material_exposures;
CREATE POLICY tenant_isolation_company_material_exposures ON company_material_exposures
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_company_material_exposures_insert ON company_material_exposures;
CREATE POLICY tenant_isolation_company_material_exposures_insert ON company_material_exposures
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_company_material_exposures_update ON company_material_exposures;
CREATE POLICY tenant_isolation_company_material_exposures_update ON company_material_exposures
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_company_material_exposures_delete ON company_material_exposures;
CREATE POLICY tenant_isolation_company_material_exposures_delete ON company_material_exposures
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── crma_article24_assessments (tenant strict) ──────────────────────────────
ALTER TABLE crma_article24_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crma_article24_assessments FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_crma_article24_assessments ON crma_article24_assessments;
CREATE POLICY tenant_isolation_crma_article24_assessments ON crma_article24_assessments
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_crma_article24_assessments_insert ON crma_article24_assessments;
CREATE POLICY tenant_isolation_crma_article24_assessments_insert ON crma_article24_assessments
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_crma_article24_assessments_update ON crma_article24_assessments;
CREATE POLICY tenant_isolation_crma_article24_assessments_update ON crma_article24_assessments
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_crma_article24_assessments_delete ON crma_article24_assessments;
CREATE POLICY tenant_isolation_crma_article24_assessments_delete ON crma_article24_assessments
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── mitigation_actions (tenant strict) ──────────────────────────────────────
ALTER TABLE mitigation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitigation_actions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_mitigation_actions ON mitigation_actions;
CREATE POLICY tenant_isolation_mitigation_actions ON mitigation_actions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_mitigation_actions_insert ON mitigation_actions;
CREATE POLICY tenant_isolation_mitigation_actions_insert ON mitigation_actions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_mitigation_actions_update ON mitigation_actions;
CREATE POLICY tenant_isolation_mitigation_actions_update ON mitigation_actions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_mitigation_actions_delete ON mitigation_actions;
CREATE POLICY tenant_isolation_mitigation_actions_delete ON mitigation_actions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- PARTIE 3bis — VOCABULAIRE DE LA CHAÎNE DE VALEUR (lignes globales)
-- ===========================================================================
-- Les 8 étapes du MVP « aimants permanents » :
--   extraction -> séparation -> raffinage -> métal & alliage -> poudre ->
--   aimant -> composant -> produit
--
-- Ce sont des lignes GLOBALES (company_id NULL), donc écrites via
-- `app.rls_bypass = 'on'` — l'unique voie d'écriture globale prévue par les
-- contrats §7. `SET LOCAL` limite le bypass à la transaction de la migration
-- (transactional=true au manifeste) : aucune fuite vers une session applicative.
--
-- Ce n'est PAS une donnée factuelle sur le monde (aucune part pays, aucun
-- chiffre, aucun prix) mais la TAXONOMIE qui rend les observations comparables
-- entre elles — au même titre qu'une contrainte CHECK. Il n'y a donc aucune
-- source externe à citer, et la prohibition « aucune donnée externe réelle
-- ingérée » est respectée. Idempotent : ON CONFLICT DO NOTHING s'appuie sur
-- l'index unique partiel `uq_processing_stages_code_global`.
DO $$ BEGIN
  SET LOCAL app.rls_bypass = 'on';
  INSERT INTO processing_stages (company_id, code, label, stage_order, is_upstream, description)
  VALUES
      (NULL, 'extraction',  'Extraction minière', 10, true,  'Minerai extrait, avant tout traitement chimique.'),
      (NULL, 'separation',  'Séparation',         20, true,  'Séparation des oxydes de terres rares individuels.'),
      (NULL, 'refining',    'Raffinage',          30, false, 'Raffinage chimique en oxydes purifiés.'),
      (NULL, 'metal_alloy', 'Métal et alliage',   40, false, 'Réduction en métal puis alliage (NdFeB, SmCo).'),
      (NULL, 'powder',      'Poudre',             50, false, 'Broyage et préparation des poudres magnétiques.'),
      (NULL, 'magnet',      'Aimant',             60, false, 'Frittage/liaison et magnétisation.'),
      (NULL, 'component',   'Composant',          70, false, 'Intégration en moteur, générateur, actionneur.'),
      (NULL, 'product',     'Produit fini',       80, false, 'Produit assemblé mis sur le marché.')
  ON CONFLICT DO NOTHING;
END $$;

-- ===========================================================================
-- PARTIE 4 — ACCÈS APPLICATIF
-- ===========================================================================
-- Même geste que 027/028/030/031 : si la migration est appliquée par un rôle
-- admin distinct du rôle applicatif (DATABASE_ADMIN_URL en prod via
-- db-migrate.yml), l'app (rôle carbonco_app) a besoin d'un GRANT explicite sur
-- les nouvelles tables/séquences. No-op si carbonco_app est propriétaire
-- (environnement neuf) ou absent (dev/CI sans ce rôle).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      material_groups, material_group_members, processing_stages,
      material_stage_observations, material_market_observations, substitutes,
      recycling_routes, trade_or_regulatory_events, company_material_exposures,
      crma_article24_assessments, mitigation_actions
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      material_groups_id_seq, material_group_members_id_seq,
      processing_stages_id_seq, material_stage_observations_id_seq,
      material_market_observations_id_seq, substitutes_id_seq,
      recycling_routes_id_seq, trade_or_regulatory_events_id_seq,
      company_material_exposures_id_seq, crma_article24_assessments_id_seq,
      mitigation_actions_id_seq
      TO carbonco_app;
  END IF;
END $$;
