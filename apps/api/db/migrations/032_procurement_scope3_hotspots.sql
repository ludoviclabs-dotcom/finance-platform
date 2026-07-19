-- Migration 032 — Moteur Scope 3 catégorie 1 (achats), hotspots et sélection
-- humaine (PR-05B). Suite de 030 (exposition achats) : celle-ci pose UNIQUEMENT
-- les tables de CALCUL et de sélection, jamais de nouvelle table d'exposition.
--
-- Phase 4 de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §10/§20, tranche
-- B du plan PR05_PROCUREMENT_EXPOSURE_IMPLEMENTATION_PLAN.md (§5 « PR-05B
-- indicatif », §6, §7). Aucune donnée métier migrée, aucune source externe
-- ingérée, aucun LLM (l'IA ne produit jamais un calcul ni une décision).
--
-- RLS génération 2 (comme 028/030/031) : ENABLE + FORCE, policies scopées PAR
-- COMMANDE (SELECT/INSERT/UPDATE/DELETE), NULLIF(current_setting(
-- 'app.current_company_id'))::bigint, app.rls_bypass, DROP POLICY IF EXISTS
-- avant chaque CREATE (rejouable par startup_event/run_migrations() en dev).
-- Ces trois tables sont à portée tenant STRICTE (`company_id BIGINT NOT NULL`,
-- aucune ligne globale) ; la branche de lecture `company_id IS NULL` du pattern
-- 028/030 est conservée à l'identique par cohérence de relecture (inerte sous
-- NOT NULL). La défense en profondeur applicative (prédicat de périmètre
-- explicite dans CHAQUE requête de service) reste OBLIGATOIRE en plus de la RLS :
-- le PostgreSQL de CI se connecte en superuser, qui bypasse la RLS y compris
-- FORCE (cf. PR03_EVIDENCE_KERNEL_TRACEABILITY.md §15).
--
-- FK BIGINT vers des PK INTEGER historiques (suppliers.id, supplier_campaigns.id
-- sont SERIAL/int4) : valide en PostgreSQL (comparaison croisée int4/int8
-- nativement supportée), même geste que 028/030.

-- ---------------------------------------------------------------------------
-- A. procurement_calculation_runs — un run de calcul Scope 3 cat. 1.
--
--    Colonnes de run PARTAGÉES par convention Wave 2 (WAVE_2_INTERFACE_CONTRACTS.md
--    §4, reprises de PLAN_ACTION §9.2) : methodology_code, methodology_version,
--    input_snapshot, factor_versions, result, warnings, confidence, coverage_pct,
--    calculated_at, approved_at, approved_by. `scope2_calculation_runs` (PR-06B)
--    reprendra les mêmes.
--
--    input_snapshot est le SNAPSHOT IMMUABLE des entrées (lignes d'achat
--    retenues, bornes de période, périmètre) : un run rejoué plus tard, alors
--    que les données d'achat ont changé, reste lisible tel qu'il a été calculé.
--    input_fingerprint = SHA-256 canonique de (snapshot + méthodologie + version)
--    → REPRODUCTIBILITÉ vérifiable et IDEMPOTENCE du run : recalculer sur des
--    entrées identiques ne crée pas un second run (UNIQUE ci-dessous), il rend
--    l'existant.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement_calculation_runs (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id),
    import_id           BIGINT REFERENCES purchase_imports(id),
    period_start        DATE,
    period_end          DATE,
    methodology_code    TEXT NOT NULL,
    methodology_version TEXT NOT NULL,
    input_snapshot      JSONB NOT NULL DEFAULT '{}',
    input_fingerprint   TEXT NOT NULL,
    factor_versions     JSONB NOT NULL DEFAULT '{}',
    result              JSONB NOT NULL DEFAULT '{}',
    warnings            JSONB NOT NULL DEFAULT '[]',
    confidence          NUMERIC,
    coverage_pct        NUMERIC,
    line_count          INTEGER NOT NULL DEFAULT 0,
    unresolved_count    INTEGER NOT NULL DEFAULT 0,
    total_tco2e         NUMERIC,
    status              TEXT NOT NULL DEFAULT 'calculated',
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ,
    approved_by         BIGINT,
    created_by          BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT procurement_runs_status_check CHECK (
        status IN ('calculated', 'approved', 'superseded')
    ),
    -- confidence 0-1 (échelle backend, comme observations.confidence) ; la
    -- présentation 0-100 de l'enveloppe analytique (contrats §4) est une
    -- CONVERSION d'affichage, jamais un second stockage.
    CONSTRAINT procurement_runs_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    CONSTRAINT procurement_runs_coverage_range_check CHECK (
        coverage_pct IS NULL OR (coverage_pct >= 0 AND coverage_pct <= 100)
    ),
    -- Idempotence / reproductibilité : mêmes entrées + même méthodologie
    -- versionnée = un seul run pour ce tenant.
    CONSTRAINT procurement_runs_fingerprint_uniq UNIQUE (company_id, input_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_procurement_runs_company ON procurement_calculation_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_procurement_runs_import ON procurement_calculation_runs(import_id);
CREATE INDEX IF NOT EXISTS idx_procurement_runs_status ON procurement_calculation_runs(status);

-- ---------------------------------------------------------------------------
-- B. procurement_line_results — résultat PAR LIGNE d'achat d'un run.
--
--    HIÉRARCHIE DE MÉTHODE (ordre non négociable, plan §6) :
--      1 supplier_pcf_verified     — PCF fournisseur vérifiée ET comparable
--      2 supplier_specific_hybrid  — méthode fournisseur spécifique / hybride
--      3 average_physical          — facteur physique moyen (produit/matière)
--      4 spend_based_economic      — facteur économique par catégorie de dépense
--      5 unresolved                — AUCUN chiffre inventé : la ligne reste dans
--                                    les résultats avec sa raison, et alimente
--                                    la file de correction.
--
--    AUCUN FALLBACK SILENCIEUX — garanti EN BASE par
--    procurement_line_results_fallback_reason_check : dès que le rang retenu
--    n'est pas 1 (donc dès qu'un repli a eu lieu), `fallback_reason` est
--    OBLIGATOIRE. Une ligne ne peut pas descendre la hiérarchie sans dire
--    pourquoi, même si un futur appelant oubliait de le renseigner.
--
--    result_tco2e est NULL pour une ligne `unresolved` (jamais 0 : un trou de
--    donnée n'est pas une émission nulle). La conversion d'unité est EXPLICITE
--    et conservée (conversion_factor / converted_unit / conversion_note) plutôt
--    qu'appliquée en silence.
--
--    confidence (0-1) est SÉPARÉ de data_quality (0-1) et des dimensions de
--    risque fournisseur (services/procurement/scoring.py) — contrats §2 :
--    risque ≠ confiance ≠ statut, jamais fusionnés en un chiffre unique.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement_line_results (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    run_id                BIGINT NOT NULL REFERENCES procurement_calculation_runs(id),
    purchase_line_id      BIGINT NOT NULL REFERENCES purchase_lines(id),
    supplier_id           BIGINT REFERENCES suppliers(id),
    supplier_product_id   BIGINT REFERENCES supplier_products(id),
    calculation_method    TEXT NOT NULL,
    method_rank           SMALLINT NOT NULL,
    factor_id             TEXT,
    factor_version        TEXT,
    factor_source         TEXT,
    activity_value        NUMERIC,
    activity_unit         TEXT,
    converted_value       NUMERIC,
    converted_unit        TEXT,
    conversion_factor     NUMERIC,
    conversion_note       TEXT,
    result_tco2e          NUMERIC,
    uncertainty_pct       NUMERIC,
    uncertainty_low_tco2e  NUMERIC,
    uncertainty_high_tco2e NUMERIC,
    data_quality          NUMERIC,
    data_quality_label    TEXT,
    confidence            NUMERIC,
    data_status           TEXT NOT NULL DEFAULT 'estimated',
    fallback_reason       TEXT,
    warnings              JSONB NOT NULL DEFAULT '[]',
    method_trace          JSONB NOT NULL DEFAULT '[]',
    -- Preuve de la donnée RÉELLEMENT retenue pour cette ligne (PCF ou
    -- déclaration sourcée). Rend le drill-down « résultat → pièce » direct,
    -- sans avoir à re-déduire après coup quelle source avait servi.
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    source_release_id     BIGINT REFERENCES source_releases(id),
    observation_id        BIGINT REFERENCES observations(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT procurement_line_results_method_check CHECK (
        calculation_method IN (
            'supplier_pcf_verified',
            'supplier_specific_hybrid',
            'average_physical',
            'spend_based_economic',
            'unresolved'
        )
    ),
    CONSTRAINT procurement_line_results_rank_check CHECK (method_rank BETWEEN 1 AND 5),
    -- Cohérence méthode ↔ rang : le rang n'est pas une donnée libre, il est
    -- l'ordre canonique de la hiérarchie. Empêche qu'un appelant enregistre
    -- « spend_based » au rang 1 et fausse tous les agrégats de couverture.
    CONSTRAINT procurement_line_results_method_rank_coherent_check CHECK (
        (calculation_method = 'supplier_pcf_verified'    AND method_rank = 1)
        OR (calculation_method = 'supplier_specific_hybrid' AND method_rank = 2)
        OR (calculation_method = 'average_physical'         AND method_rank = 3)
        OR (calculation_method = 'spend_based_economic'     AND method_rank = 4)
        OR (calculation_method = 'unresolved'               AND method_rank = 5)
    ),
    -- AUCUN FALLBACK SILENCIEUX : tout rang > 1 exige sa raison de repli.
    CONSTRAINT procurement_line_results_fallback_reason_check CHECK (
        method_rank = 1 OR (fallback_reason IS NOT NULL AND length(btrim(fallback_reason)) > 0)
    ),
    -- Une ligne non résolue ne porte JAMAIS de chiffre (ni 0, ni estimation).
    CONSTRAINT procurement_line_results_unresolved_null_check CHECK (
        calculation_method <> 'unresolved' OR result_tco2e IS NULL
    ),
    CONSTRAINT procurement_line_results_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT procurement_line_results_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    CONSTRAINT procurement_line_results_quality_range_check CHECK (
        data_quality IS NULL OR (data_quality >= 0 AND data_quality <= 1)
    ),
    -- Un run ne produit qu'un résultat par ligne d'achat (rejouabilité).
    CONSTRAINT procurement_line_results_run_line_uniq UNIQUE (run_id, purchase_line_id)
);

CREATE INDEX IF NOT EXISTS idx_procurement_line_results_company ON procurement_line_results(company_id);
CREATE INDEX IF NOT EXISTS idx_procurement_line_results_run ON procurement_line_results(run_id);
CREATE INDEX IF NOT EXISTS idx_procurement_line_results_line ON procurement_line_results(purchase_line_id);
CREATE INDEX IF NOT EXISTS idx_procurement_line_results_supplier ON procurement_line_results(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_line_results_method ON procurement_line_results(calculation_method);
CREATE INDEX IF NOT EXISTS idx_procurement_line_results_artifact ON procurement_line_results(evidence_artifact_id);

-- ---------------------------------------------------------------------------
-- C. procurement_hotspot_selections — SÉLECTION HUMAINE d'un hotspot.
--
--    Un hotspot est DÉTECTÉ par agrégation (déterministe, lecture seule) ; il
--    n'est jamais « décidé » par la machine. Cette table enregistre ce qu'un
--    analyste a explicitement retenu, écarté, ou transformé en campagne
--    fournisseur. C'est le gate humain entre « le calcul montre » et « on agit ».
--
--    La création de campagne est CONTRÔLÉE : campaign_id n'est posé que par le
--    service, depuis une sélection `selected` de type `supplier` rattachée à un
--    fournisseur du tenant (services/procurement/hotspots_service.py). Le
--    moteur de campagnes lui-même (024, supplier_campaigns_service) n'est PAS
--    réinventé — il est réutilisé tel quel.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement_hotspot_selections (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id),
    run_id             BIGINT NOT NULL REFERENCES procurement_calculation_runs(id),
    hotspot_type       TEXT NOT NULL,
    hotspot_key        TEXT NOT NULL,
    hotspot_label      TEXT,
    supplier_id        BIGINT REFERENCES suppliers(id),
    contribution_tco2e NUMERIC,
    contribution_pct   NUMERIC,
    rank_position      SMALLINT,
    selection_status   TEXT NOT NULL DEFAULT 'selected',
    selection_reason   TEXT,
    campaign_id        BIGINT REFERENCES supplier_campaigns(id),
    selected_by        BIGINT,
    selected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT procurement_hotspot_type_check CHECK (
        hotspot_type IN ('supplier', 'supplier_product', 'category', 'country')
    ),
    CONSTRAINT procurement_hotspot_status_check CHECK (
        selection_status IN ('selected', 'dismissed', 'campaign_created')
    ),
    -- Une campagne ne peut être rattachée qu'à une sélection passée au statut
    -- correspondant : pas de campagne « fantôme » sur un hotspot écarté.
    CONSTRAINT procurement_hotspot_campaign_status_check CHECK (
        campaign_id IS NULL OR selection_status = 'campaign_created'
    ),
    -- Sélection idempotente : re-sélectionner le même hotspot d'un run met à
    -- jour la ligne existante, n'en crée pas une seconde.
    CONSTRAINT procurement_hotspot_selection_uniq UNIQUE (company_id, run_id, hotspot_type, hotspot_key)
);

CREATE INDEX IF NOT EXISTS idx_procurement_hotspot_company ON procurement_hotspot_selections(company_id);
CREATE INDEX IF NOT EXISTS idx_procurement_hotspot_run ON procurement_hotspot_selections(run_id);
CREATE INDEX IF NOT EXISTS idx_procurement_hotspot_supplier ON procurement_hotspot_selections(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_hotspot_status ON procurement_hotspot_selections(selection_status);

-- ---------------------------------------------------------------------------
-- RLS — génération 2 (pattern 028/030/031). Chaque table : ENABLE + FORCE, puis
-- 4 policies scopées par commande. SELECT autorise rls_bypass / global (inerte
-- ici, NOT NULL) / tenant ; INSERT/UPDATE/DELETE autorisent rls_bypass / tenant
-- uniquement (jamais IS NULL — un tenant n'écrit jamais une ligne globale).
-- DROP POLICY IF EXISTS avant chaque CREATE (idempotence).
-- ---------------------------------------------------------------------------

-- ── procurement_calculation_runs ────────────────────────────────────────────
ALTER TABLE procurement_calculation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_calculation_runs FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_procurement_calculation_runs ON procurement_calculation_runs;
CREATE POLICY tenant_isolation_procurement_calculation_runs ON procurement_calculation_runs
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_calculation_runs_insert ON procurement_calculation_runs;
CREATE POLICY tenant_isolation_procurement_calculation_runs_insert ON procurement_calculation_runs
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_calculation_runs_update ON procurement_calculation_runs;
CREATE POLICY tenant_isolation_procurement_calculation_runs_update ON procurement_calculation_runs
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_calculation_runs_delete ON procurement_calculation_runs;
CREATE POLICY tenant_isolation_procurement_calculation_runs_delete ON procurement_calculation_runs
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── procurement_line_results ────────────────────────────────────────────────
ALTER TABLE procurement_line_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_line_results FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_procurement_line_results ON procurement_line_results;
CREATE POLICY tenant_isolation_procurement_line_results ON procurement_line_results
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_line_results_insert ON procurement_line_results;
CREATE POLICY tenant_isolation_procurement_line_results_insert ON procurement_line_results
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_line_results_update ON procurement_line_results;
CREATE POLICY tenant_isolation_procurement_line_results_update ON procurement_line_results
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_line_results_delete ON procurement_line_results;
CREATE POLICY tenant_isolation_procurement_line_results_delete ON procurement_line_results
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── procurement_hotspot_selections ──────────────────────────────────────────
ALTER TABLE procurement_hotspot_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurement_hotspot_selections FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_procurement_hotspot_selections ON procurement_hotspot_selections;
CREATE POLICY tenant_isolation_procurement_hotspot_selections ON procurement_hotspot_selections
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_hotspot_selections_insert ON procurement_hotspot_selections;
CREATE POLICY tenant_isolation_procurement_hotspot_selections_insert ON procurement_hotspot_selections
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_hotspot_selections_update ON procurement_hotspot_selections;
CREATE POLICY tenant_isolation_procurement_hotspot_selections_update ON procurement_hotspot_selections
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_procurement_hotspot_selections_delete ON procurement_hotspot_selections;
CREATE POLICY tenant_isolation_procurement_hotspot_selections_delete ON procurement_hotspot_selections
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ---------------------------------------------------------------------------
-- Accès applicatif — même geste que 027/028/030/031 : si la migration est
-- appliquée par un rôle admin distinct du rôle applicatif (DATABASE_ADMIN_URL
-- en prod via db-migrate.yml), l'app (rôle carbonco_app) a besoin d'un GRANT
-- explicite sur les nouvelles tables/séquences. No-op si carbonco_app est
-- propriétaire (environnement neuf) ou absent (dev/CI sans ce rôle).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      procurement_calculation_runs, procurement_line_results,
      procurement_hotspot_selections
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      procurement_calculation_runs_id_seq, procurement_line_results_id_seq,
      procurement_hotspot_selections_id_seq
      TO carbonco_app;
  END IF;
END $$;
