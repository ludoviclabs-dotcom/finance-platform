-- Migration 039 — Risques, opportunités, actions et brouillons TNFD nature
-- (PR-09, tranche B — Assess + Prepare).
--
-- mode: requires_owner=false (migration_manifest.py) — CREATE TABLE neufs
-- uniquement, aucun ALTER d'une table existante. Précédent direct : 038
-- (tranche A de cette même PR) et 028/030/031/033/034/037.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION AJOUTE
-- ---------------------------------------------------------------------------
-- 1. `nature_risks` / `nature_opportunities` (Assess) — motif
--    `crma_article24_assessments` (034) repris à l'identique : `risk_score`
--    (resp. `opportunity_score`), `likelihood` et `confidence` sont TROIS
--    colonnes SÉPARÉES, chacune avec son CHECK indépendant — aucune ne fusionne
--    les autres. `components` (JSONB) garde chaque composante inspectable
--    (code/label/available/value/weight/contribution/rationale) — jamais un
--    total opaque. `methodology_code`/`methodology_version` versionnent le
--    calcul (services/calculations/nature_scoring.py, tranche B). L'ABSENCE de
--    donnée ne devient JAMAIS un risque/une opportunité à zéro : une
--    composante sans donnée est exclue (poids renormalisés parmi les
--    composantes disponibles), la confiance baisse, le score reste NULL si
--    aucune composante n'est calculable (motif scoring.py PR-07, contrats §6).
--    `dependency_id`/`impact_id` optionnels tracent la donnée d'origine
--    (nature_dependencies/nature_impacts, 038) SANS jamais dériver
--    automatiquement un risque d'une intersection géométrique seule
--    (proximité ≠ impact, dépendance ≠ risque financier — la traduction en
--    IRO financier reste l'affaire de PR-10, contrats §10).
-- 2. `nature_actions` — calquée sur `mitigation_actions` (034) et
--    `water_actions` (037) : `expected_risk_reduction_pct` est une INTENTION
--    déclarée, jamais soustraite automatiquement d'un score. Rattachée à un
--    risque, une opportunité, et/ou un dossier LEAP (au moins un ancrage).
-- 3. `tnfd_disclosure_drafts` (Prepare) — TOUJOURS un brouillon. Motif
--    `Article24Report.is_official_eu_score=False` (034, `services/crma/
--    scoring.py::DISCLAIMER`) repris à l'identique pour TNFD :
--    `is_official_tnfd_disclosure` est verrouillé à `false` par un CHECK — pas
--    seulement une discipline applicative, une garantie de schéma. Le
--    vocabulaire `status` (draft/under_review/approved) N'INCLUT PAS
--    'published' : aucune publication automatique n'est même représentable.
--
-- RLS gen-2 complète sur les 4 tables (ENABLE+FORCE, policies par commande,
-- DROP POLICY IF EXISTS, NULLIF/app.rls_bypass — pattern 034/036/037/038).
-- Toutes tenant STRICT (contrairement à nature_features, 038 : un risque, une
-- opportunité, une action ou un brouillon de disclosure appartiennent
-- toujours à un tenant précis, jamais un référentiel partagé).
--
-- DÉFENSE EN PROFONDEUR APPLICATIVE OBLIGATOIRE EN PLUS (contrats §7) : le
-- PostgreSQL de CI se connecte en superuser (RLS bypassée, FORCE compris) —
-- chaque requête de service porte son prédicat `company_id = %s` explicite.
--
-- Aucun calcul exécuté par la migration, aucune donnée métier migrée, aucune
-- source externe ingérée, aucun LLM, aucune publication automatique.

-- ===========================================================================
-- A. nature_risks (Assess) — risque, aléa et confiance : TROIS colonnes.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS nature_risks (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    assessment_id        BIGINT NOT NULL REFERENCES leap_assessments(id),
    site_id              BIGINT REFERENCES sites(id),
    dependency_id        BIGINT REFERENCES nature_dependencies(id),
    impact_id            BIGINT REFERENCES nature_impacts(id),
    title                TEXT NOT NULL,
    methodology_code     TEXT NOT NULL DEFAULT 'CC-NATURE-RISK',
    methodology_version  TEXT NOT NULL DEFAULT '0.1.0',
    -- RISQUE : intensité. NULL = aucune composante calculable (jamais un 0 inventé).
    risk_score           NUMERIC,
    -- ALÉA qualitatif — palier explicite, SÉPARÉ du score et de la confiance.
    likelihood           TEXT,
    -- CONFIANCE : solidité du socle documentaire. Ne dit RIEN du niveau de risque.
    confidence           NUMERIC,
    components           JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings              JSONB NOT NULL DEFAULT '[]'::jsonb,
    input_snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_fingerprint     TEXT,
    rationale             TEXT,
    review_status         TEXT NOT NULL DEFAULT 'pending',
    reviewed_by           BIGINT,
    reviewed_at           TIMESTAMPTZ,
    calculated_at         TIMESTAMPTZ,
    calculated_by         BIGINT,
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nature_risks_likelihood_check CHECK (
        likelihood IS NULL OR likelihood IN ('low', 'medium', 'high', 'critical')
    ),
    -- Deux intervalles SÉPARÉS : aucune contrainte ne lie risk_score et confidence.
    CONSTRAINT nature_risks_score_range_check CHECK (
        risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
    ),
    CONSTRAINT nature_risks_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT nature_risks_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    )
);

CREATE INDEX IF NOT EXISTS idx_nature_risks_company ON nature_risks(company_id);
CREATE INDEX IF NOT EXISTS idx_nature_risks_assessment ON nature_risks(company_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_nature_risks_site ON nature_risks(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_nature_risks_review ON nature_risks(company_id, review_status);

-- ===========================================================================
-- B. nature_opportunities (Assess) — même discipline, direction opposée.
--    JAMAIS fusionnée avec nature_risks (table séparée, motif dépendances/
--    impacts de 038 : une opportunité n'est pas l'inverse arithmétique d'un
--    risque, ce sont deux évaluations humaines distinctes).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS nature_opportunities (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    assessment_id        BIGINT NOT NULL REFERENCES leap_assessments(id),
    site_id              BIGINT REFERENCES sites(id),
    dependency_id        BIGINT REFERENCES nature_dependencies(id),
    impact_id            BIGINT REFERENCES nature_impacts(id),
    title                TEXT NOT NULL,
    methodology_code     TEXT NOT NULL DEFAULT 'CC-NATURE-OPPORTUNITY',
    methodology_version  TEXT NOT NULL DEFAULT '0.1.0',
    opportunity_score    NUMERIC,
    likelihood           TEXT,
    confidence           NUMERIC,
    components           JSONB NOT NULL DEFAULT '[]'::jsonb,
    warnings              JSONB NOT NULL DEFAULT '[]'::jsonb,
    input_snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,
    input_fingerprint     TEXT,
    rationale             TEXT,
    review_status         TEXT NOT NULL DEFAULT 'pending',
    reviewed_by           BIGINT,
    reviewed_at           TIMESTAMPTZ,
    calculated_at         TIMESTAMPTZ,
    calculated_by         BIGINT,
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nature_opportunities_likelihood_check CHECK (
        likelihood IS NULL OR likelihood IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT nature_opportunities_score_range_check CHECK (
        opportunity_score IS NULL OR (opportunity_score >= 0 AND opportunity_score <= 100)
    ),
    CONSTRAINT nature_opportunities_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT nature_opportunities_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    )
);

CREATE INDEX IF NOT EXISTS idx_nature_opportunities_company ON nature_opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_nature_opportunities_assessment
    ON nature_opportunities(company_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_nature_opportunities_site ON nature_opportunities(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_nature_opportunities_review
    ON nature_opportunities(company_id, review_status);

-- ===========================================================================
-- C. nature_actions — calquée sur mitigation_actions (034) / water_actions
--    (037) : intention déclarée, jamais soustraite automatiquement.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS nature_actions (
    id                           BIGSERIAL PRIMARY KEY,
    company_id                   BIGINT NOT NULL REFERENCES companies(id),
    risk_id                      BIGINT REFERENCES nature_risks(id) ON DELETE SET NULL,
    opportunity_id               BIGINT REFERENCES nature_opportunities(id) ON DELETE SET NULL,
    assessment_id                BIGINT REFERENCES leap_assessments(id) ON DELETE SET NULL,
    action_type                  TEXT NOT NULL,
    title                        TEXT NOT NULL,
    description                  TEXT,
    status                       TEXT NOT NULL DEFAULT 'planned',
    owner                        TEXT,
    due_date                     DATE,
    completed_at                 TIMESTAMPTZ,
    expected_effect               TEXT,
    expected_risk_reduction_pct    NUMERIC,
    review_status                  TEXT NOT NULL DEFAULT 'pending',
    created_by                     BIGINT,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT nature_actions_type_check CHECK (
        action_type IN (
            'restoration', 'habitat_protection', 'species_monitoring',
            'pollution_reduction', 'water_management', 'sourcing_change', 'other'
        )
    ),
    CONSTRAINT nature_actions_status_check CHECK (
        status IN ('planned', 'in_progress', 'completed', 'cancelled')
    ),
    CONSTRAINT nature_actions_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    CONSTRAINT nature_actions_reduction_range_check CHECK (
        expected_risk_reduction_pct IS NULL
        OR (expected_risk_reduction_pct >= 0 AND expected_risk_reduction_pct <= 100)
    ),
    -- Une action sans ancrage (ni risque, ni opportunité, ni dossier) ne
    -- décrit rien de rattachable — refus explicite, pas une ligne orpheline.
    CONSTRAINT nature_actions_anchor_check CHECK (
        risk_id IS NOT NULL OR opportunity_id IS NOT NULL OR assessment_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_nature_actions_company ON nature_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_nature_actions_risk ON nature_actions(risk_id);
CREATE INDEX IF NOT EXISTS idx_nature_actions_opportunity ON nature_actions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_nature_actions_assessment ON nature_actions(company_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_nature_actions_status ON nature_actions(company_id, status);

-- ===========================================================================
-- D. tnfd_disclosure_drafts (Prepare) — TOUJOURS un brouillon, jamais publié
--    automatiquement. `is_official_tnfd_disclosure` verrouillé à `false` par
--    CHECK — garantie de SCHÉMA, pas seulement de discipline applicative
--    (motif Article24Report.is_official_eu_score=False, 034).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS tnfd_disclosure_drafts (
    id                           BIGSERIAL PRIMARY KEY,
    company_id                   BIGINT NOT NULL REFERENCES companies(id),
    assessment_id                BIGINT NOT NULL REFERENCES leap_assessments(id),
    title                        TEXT NOT NULL,
    sections                     JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_official_tnfd_disclosure  BOOLEAN NOT NULL DEFAULT false,
    disclaimer                   TEXT NOT NULL,
    -- Vocabulaire FERMÉ : 'published' n'existe PAS — une publication
    -- automatique n'est même pas représentable en base.
    status                       TEXT NOT NULL DEFAULT 'draft',
    prepared_by                  BIGINT,
    approved_by                  BIGINT,
    approved_at                  TIMESTAMPTZ,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tnfd_disclosure_drafts_never_certified_check CHECK (
        is_official_tnfd_disclosure = false
    ),
    CONSTRAINT tnfd_disclosure_drafts_status_check CHECK (
        status IN ('draft', 'under_review', 'approved')
    ),
    CONSTRAINT tnfd_disclosure_drafts_approval_check CHECK (
        status <> 'approved' OR approved_by IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_tnfd_disclosure_drafts_company ON tnfd_disclosure_drafts(company_id);
CREATE INDEX IF NOT EXISTS idx_tnfd_disclosure_drafts_assessment
    ON tnfd_disclosure_drafts(company_id, assessment_id);
CREATE INDEX IF NOT EXISTS idx_tnfd_disclosure_drafts_status
    ON tnfd_disclosure_drafts(company_id, status);

-- ===========================================================================
-- PARTIE RLS — GÉNÉRATION 2 (tenant STRICT sur les 4 tables).
-- ===========================================================================

-- ── nature_risks ─────────────────────────────────────────────────────────
ALTER TABLE nature_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nature_risks FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nature_risks ON nature_risks;
CREATE POLICY tenant_isolation_nature_risks ON nature_risks
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_risks_insert ON nature_risks;
CREATE POLICY tenant_isolation_nature_risks_insert ON nature_risks
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_risks_update ON nature_risks;
CREATE POLICY tenant_isolation_nature_risks_update ON nature_risks
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_risks_delete ON nature_risks;
CREATE POLICY tenant_isolation_nature_risks_delete ON nature_risks
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── nature_opportunities ─────────────────────────────────────────────────
ALTER TABLE nature_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE nature_opportunities FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nature_opportunities ON nature_opportunities;
CREATE POLICY tenant_isolation_nature_opportunities ON nature_opportunities
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_opportunities_insert ON nature_opportunities;
CREATE POLICY tenant_isolation_nature_opportunities_insert ON nature_opportunities
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_opportunities_update ON nature_opportunities;
CREATE POLICY tenant_isolation_nature_opportunities_update ON nature_opportunities
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_opportunities_delete ON nature_opportunities;
CREATE POLICY tenant_isolation_nature_opportunities_delete ON nature_opportunities
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── nature_actions ───────────────────────────────────────────────────────
ALTER TABLE nature_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nature_actions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_nature_actions ON nature_actions;
CREATE POLICY tenant_isolation_nature_actions ON nature_actions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_actions_insert ON nature_actions;
CREATE POLICY tenant_isolation_nature_actions_insert ON nature_actions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_actions_update ON nature_actions;
CREATE POLICY tenant_isolation_nature_actions_update ON nature_actions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_nature_actions_delete ON nature_actions;
CREATE POLICY tenant_isolation_nature_actions_delete ON nature_actions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── tnfd_disclosure_drafts ───────────────────────────────────────────────
ALTER TABLE tnfd_disclosure_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tnfd_disclosure_drafts FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tnfd_disclosure_drafts ON tnfd_disclosure_drafts;
CREATE POLICY tenant_isolation_tnfd_disclosure_drafts ON tnfd_disclosure_drafts
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_tnfd_disclosure_drafts_insert ON tnfd_disclosure_drafts;
CREATE POLICY tenant_isolation_tnfd_disclosure_drafts_insert ON tnfd_disclosure_drafts
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_tnfd_disclosure_drafts_update ON tnfd_disclosure_drafts;
CREATE POLICY tenant_isolation_tnfd_disclosure_drafts_update ON tnfd_disclosure_drafts
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_tnfd_disclosure_drafts_delete ON tnfd_disclosure_drafts;
CREATE POLICY tenant_isolation_tnfd_disclosure_drafts_delete ON tnfd_disclosure_drafts
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- PARTIE GRANT — ACCÈS APPLICATIF (conditionnel, geste 027/028/030/031/033/
-- 034/036/037/038).
-- ===========================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      nature_risks, nature_opportunities, nature_actions, tnfd_disclosure_drafts
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      nature_risks_id_seq, nature_opportunities_id_seq, nature_actions_id_seq,
      tnfd_disclosure_drafts_id_seq
      TO carbonco_app;
  END IF;
END $$;
