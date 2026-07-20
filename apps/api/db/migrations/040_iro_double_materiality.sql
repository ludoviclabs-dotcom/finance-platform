-- Migration 040 — IRO, double matérialité et transmission financière (PR-10).
--
-- Phase 9 de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §15/§20 — point
-- de convergence des signaux produits par les autres modules (matières
-- critiques/CRMA 034, eau 037, nature 038/039, énergie) SANS jamais
-- transformer un signal en décision automatiquement. Livrée en UNE tranche
-- (comme CRMA 034) : pas de moteur de calcul lourd à isoler, la valeur du
-- module est un registre structuré et revu humainement, testable de bout en
-- bout pour que la discipline « jamais de score unique » soit vérifiable dans
-- son ensemble.
--
-- NOTE DE NUMÉROTATION : le plan PR10_IRO_DOUBLE_MATERIALITY_IMPLEMENTATION_PLAN.md
-- réservait « 038 ». L'ordre réel de fusion de la Vague 4 a affecté 038/039 à
-- PR-09 (fondation biodiversité + Assess/Prepare, voir migration_manifest.py
-- notes 038/039). PR-10 prend donc 040, après 039 — exactement le scénario que
-- le plan §14 anticipait lui-même (« Numéro 038 déjà pris... renuméroter au
-- merge »).
--
-- ---------------------------------------------------------------------------
-- PRINCIPE STRUCTURANT — JAMAIS UN SCORE UNIQUE (plan §6, non négociable)
-- ---------------------------------------------------------------------------
-- 1. `impact_assessments` et `financial_assessments` sont DEUX tables
--    séparées. Dans chacune, les composantes (scale/scope/irremediability/
--    likelihood côté impact ; likelihood/magnitude côté financier) sont des
--    COLONNES DISTINCTES. `confidence` est encore une colonne séparée de
--    toutes les précédentes, dans les deux tables. Aucune colonne calculée,
--    aucune vue matérialisée, aucun trigger ne combine ces valeurs en un
--    nombre unique — `threshold_crossed` est un booléen INDICATIF (calculé
--    par une règle OR transparente et documentée côté service, jamais une
--    moyenne pondérée qui fusionnerait les composantes), jamais une décision.
-- 2. `materiality_decisions.is_material` est un booléen décidé par un HUMAIN
--    (`decided_by NOT NULL`), motivé (`justification NOT NULL`), qui indique
--    QUELLE dimension (`basis`) a pesé. Append-only : une redécision insère
--    une nouvelle ligne (`supersedes_id`), ne réécrit jamais l'ancienne —
--    appliqué ici par un trigger dédié (motif `evidence_kernel_guard('frozen')`,
--    028), pas seulement par l'absence de policy RLS UPDATE/DELETE, pour un
--    message d'erreur explicite plutôt qu'un filtrage RLS silencieux à 0 ligne
--    (même raisonnement que le commentaire RLS de `source_releases`/
--    `observations`, 028).
-- 3. `financial_assessments.transmission_chain` (JSONB) est une CHAÎNE
--    structurée (array d'étapes, chacune avec `channel`+`rationale`), jamais
--    un chiffre unique. Un `estimated_amount_eur` par étape reste optionnel.
--    PostgreSQL interdit les sous-requêtes dans une contrainte CHECK — la
--    règle « chaque étape porte channel+rationale » est donc appliquée côté
--    modèle Pydantic (champs obligatoires) et service, PAS par un CHECK SQL ;
--    seule la non-vacuité du tableau est vérifiable en CHECK
--    (`jsonb_array_length(...) > 0`), et l'est.
-- 4. `iro_actions.expected_risk_reduction_pct` reste une INTENTION déclarée,
--    jamais soustraite automatiquement d'un score (même règle que
--    `mitigation_actions` 034 / `water_actions` 037 / `nature_actions` 039).
-- 5. `disclosure_mappings` est une table de correspondance PURE — aucune
--    colonne de statut ne déclenche de publication automatique
--    (`status` reste manipulé uniquement par un appel humain explicite).
--
-- ---------------------------------------------------------------------------
-- TABLE VOLONTAIREMENT ABSENTE : `iro_evidence_links`
-- ---------------------------------------------------------------------------
-- `claim_evidence_links` (migration 028) + `services/intelligence/
-- claim_link_service.py` (livré PR-05A, vérifié réel) couvrent déjà ce besoin
-- — `claim_type` libre (`'iro'`/`'impact_assessment'`/`'financial_assessment'`),
-- `claim_key=f"iro:{id}"` etc., `relation_type ∈ supports|contradicts|
-- contextualizes|derived_from`. Créer une seconde table dupliquerait un
-- mécanisme déjà générique et déjà servi par un service existant (même
-- correction que celle déjà appliquée à `water_dataset_releases`/
-- `nature_dataset_releases` vis-à-vis de `source_releases`).
--
-- ---------------------------------------------------------------------------
-- ORIGIN_REFERENCE — TEXT LIBRE, PAS DE FK (comme `material_id` en 034)
-- ---------------------------------------------------------------------------
-- `iros.origin_reference` pointe librement vers l'enregistrement source d'un
-- signal domaine (ex. `'site_water_screening:123'`) sans FK — pour ne pas
-- coupler cette migration à un ordre précis entre 034/037/038/039 ni à une
-- table par domaine. PR-10 fonctionne pour les signaux CRMA (déjà mergée)
-- même si un autre domaine ne l'était pas encore (contrats §14 du plan).
--
-- ---------------------------------------------------------------------------
-- RLS GÉNÉRATION 2 — TENANT STRICT SUR LES SIX TABLES (comme 037 en entier)
-- ---------------------------------------------------------------------------
-- `company_id BIGINT NOT NULL` partout, aucune ligne globale : un IRO est par
-- nature propre à un tenant (contrairement aux référentiels CRMA/eau/nature
-- qui ont une portion globale). ENABLE + FORCE, policies scopées PAR COMMANDE
-- (SELECT/INSERT/UPDATE/DELETE), `DROP POLICY IF EXISTS` avant chaque CREATE
-- (rejouable par startup_event en dev), `current_setting('app.rls_bypass')` +
-- `NULLIF(current_setting('app.current_company_id'))::bigint` (pattern
-- 028/030/031/034/037). DÉFENSE EN PROFONDEUR APPLICATIVE OBLIGATOIRE EN PLUS
-- (contrats §7) : le PostgreSQL de CI se connecte en superuser, qui BYPASSE la
-- RLS — chaque requête de service porte un prédicat `company_id = %s` explicite.
--
-- Cette migration crée six tables neuves — pas de privilège propriétaire
-- requis, comme 028/030/031/034/037. Elle élargit AUSSI, à l'identique du
-- geste déjà appliqué par 011/012/035, la contrainte `audit_eventtype_check`
-- (DROP + ADD sous le même nom) pour admettre le nouveau littéral
-- `'materiality_decision'` — ni 011 ni 012 ne sont `requires_owner` pour ce
-- même geste sur la même table, donc 040 ne l'est pas non plus. Aucun calcul
-- exécuté par la migration, aucune donnée métier migrée, aucune source
-- externe ingérée, aucun LLM.

-- ===========================================================================
-- A. iros — entité centrale
-- ===========================================================================
CREATE TABLE IF NOT EXISTS iros (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    title                 TEXT NOT NULL,
    description           TEXT,
    iro_type              TEXT NOT NULL,
    -- Rattachement indicatif à la taxonomie des enjeux ESRS déjà utilisée par
    -- materialite_positions/materialite_service.py (ISSUE_LABELS/ISSUE_ESRS —
    -- ex. 'CC-1', 'WR-1', 'BD-1'). Vérifié par inspection intégrale de
    -- materialite_service.py (578 lignes) : cette taxonomie est un DICT
    -- PYTHON EN MÉMOIRE, pas une table SQL — donc TEXT libre, PAS de FK
    -- possible (rien à référencer en base).
    topic_code            TEXT,
    origin_domain         TEXT NOT NULL DEFAULT 'manual',
    -- Pointeur libre vers l'enregistrement source (ex.
    -- 'site_water_screening:123'), volontairement PAS une FK — voir note ci-dessus.
    origin_reference       TEXT,
    status                TEXT NOT NULL DEFAULT 'candidate',
    value_chain_location   TEXT,
    created_by             BIGINT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT iros_type_check CHECK (
        iro_type IN ('impact', 'risk', 'opportunity')
    ),
    CONSTRAINT iros_status_check CHECK (
        status IN ('candidate', 'under_assessment', 'assessed', 'decided', 'archived')
    ),
    CONSTRAINT iros_origin_domain_check CHECK (
        origin_domain IN ('water', 'nature', 'crma', 'energy', 'manual')
    ),
    CONSTRAINT iros_value_chain_check CHECK (
        value_chain_location IS NULL
        OR value_chain_location IN ('upstream', 'own_operations', 'downstream')
    )
);

CREATE INDEX IF NOT EXISTS idx_iros_company ON iros(company_id);
CREATE INDEX IF NOT EXISTS idx_iros_status ON iros(company_id, status);
CREATE INDEX IF NOT EXISTS idx_iros_type ON iros(company_id, iro_type);
CREATE INDEX IF NOT EXISTS idx_iros_origin ON iros(company_id, origin_domain, origin_reference);

-- ===========================================================================
-- B. impact_assessments — matérialité d'IMPACT, composantes séparées
-- ===========================================================================
CREATE TABLE IF NOT EXISTS impact_assessments (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    iro_id               BIGINT NOT NULL REFERENCES iros(id),
    polarity             TEXT NOT NULL,
    -- Impact AVÉRÉ (is_actual=true) vs POTENTIEL. Un impact avéré n'a pas
    -- besoin de probabilité — CHECK dédié ci-dessous.
    is_actual            BOOLEAN NOT NULL DEFAULT false,
    scale                INTEGER,
    scope                INTEGER,
    irremediability      INTEGER,
    likelihood           INTEGER,
    -- Horizons ESRS 1 §6.4 §77-81 : court = période des états financiers
    -- (~1 an) ; moyen = jusqu'à 5 ans ; long = au-delà. Valeurs par défaut
    -- documentées ici, pas codées en dur comme une vérité non paramétrable
    -- (l'énumération reste courte, un réglage par tenant restera possible
    -- sans migration de schéma).
    time_horizon         TEXT,
    -- Confiance : SÉPARÉE de toutes les composantes précédentes.
    confidence            INTEGER,
    methodology_code      TEXT NOT NULL DEFAULT 'CC-IRO-IMPACT',
    methodology_version   TEXT NOT NULL DEFAULT '0.1.0',
    -- Une entrée par composante (motif ScoreComponent simplifié de
    -- models/nature.py, lui-même motif de models/crma.py) :
    -- code/label/available/value/weight/contribution/rationale. Dérivé par le
    -- service depuis scale/scope/irremediability/likelihood — jamais un total
    -- opaque, jamais soumis tel quel par l'appelant.
    components            JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- INDICATIF seulement : une règle OR transparente et documentée
    -- (composante sévérité >= seuil), jamais une décision de matérialité.
    threshold_crossed      BOOLEAN,
    rationale               TEXT,
    calculated_at            TIMESTAMPTZ,
    prepared_by              BIGINT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT impact_assessments_polarity_check CHECK (
        polarity IN ('positive', 'negative')
    ),
    CONSTRAINT impact_assessments_scale_range_check CHECK (
        scale IS NULL OR (scale >= 0 AND scale <= 100)
    ),
    CONSTRAINT impact_assessments_scope_range_check CHECK (
        scope IS NULL OR (scope >= 0 AND scope <= 100)
    ),
    CONSTRAINT impact_assessments_irremediability_range_check CHECK (
        irremediability IS NULL OR (irremediability >= 0 AND irremediability <= 100)
    ),
    CONSTRAINT impact_assessments_likelihood_range_check CHECK (
        likelihood IS NULL OR (likelihood >= 0 AND likelihood <= 100)
    ),
    -- Un impact AVÉRÉ n'a pas de probabilité — la colonne doit rester vide.
    CONSTRAINT impact_assessments_likelihood_actual_check CHECK (
        is_actual = false OR likelihood IS NULL
    ),
    CONSTRAINT impact_assessments_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT impact_assessments_time_horizon_check CHECK (
        time_horizon IS NULL OR time_horizon IN ('short', 'medium', 'long')
    )
);

CREATE INDEX IF NOT EXISTS idx_impact_assessments_company ON impact_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_impact_assessments_iro
    ON impact_assessments(company_id, iro_id, calculated_at DESC);

-- ===========================================================================
-- C. financial_assessments — matérialité FINANCIÈRE, chaîne de transmission
-- ===========================================================================
CREATE TABLE IF NOT EXISTS financial_assessments (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    iro_id                BIGINT NOT NULL REFERENCES iros(id),
    likelihood            INTEGER,
    -- SÉPARÉE de likelihood — jamais multipliées ni combinées en base.
    magnitude             INTEGER,
    time_horizon          TEXT,
    confidence            INTEGER,
    methodology_code       TEXT NOT NULL DEFAULT 'CC-IRO-FINANCIAL',
    methodology_version    TEXT NOT NULL DEFAULT '0.1.0',
    -- Chaîne structurée (array d'étapes channel+rationale+mechanism,
    -- estimated_amount_eur optionnel PAR étape) — JAMAIS un chiffre unique.
    -- Non-vacuité vérifiée par CHECK ; complétude de chaque étape
    -- (channel/rationale non nuls) vérifiée côté modèle Pydantic + service —
    -- PostgreSQL interdit les sous-requêtes dans un CHECK, donc l'inspection
    -- élément par élément du tableau ne peut pas être portée ici.
    transmission_chain      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Dérivé du premier maillon de la chaîne, pour le filtrage uniquement.
    primary_channel          TEXT,
    components                JSONB NOT NULL DEFAULT '[]'::jsonb,
    threshold_crossed          BOOLEAN,
    rationale                    TEXT,
    calculated_at                 TIMESTAMPTZ,
    prepared_by                   BIGINT,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT financial_assessments_likelihood_range_check CHECK (
        likelihood IS NULL OR (likelihood >= 0 AND likelihood <= 100)
    ),
    CONSTRAINT financial_assessments_magnitude_range_check CHECK (
        magnitude IS NULL OR (magnitude >= 0 AND magnitude <= 100)
    ),
    CONSTRAINT financial_assessments_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
    ),
    CONSTRAINT financial_assessments_time_horizon_check CHECK (
        time_horizon IS NULL OR time_horizon IN ('short', 'medium', 'long')
    ),
    CONSTRAINT financial_assessments_primary_channel_check CHECK (
        primary_channel IS NULL
        OR primary_channel IN ('revenue', 'cost', 'asset_value', 'capital_cost', 'liability', 'other')
    ),
    -- Non-vacuité de la chaîne — le seul aspect de la règle §8 exprimable en CHECK.
    CONSTRAINT financial_assessments_transmission_chain_check CHECK (
        jsonb_array_length(transmission_chain) > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_financial_assessments_company ON financial_assessments(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_assessments_iro
    ON financial_assessments(company_id, iro_id, calculated_at DESC);

-- ===========================================================================
-- D. materiality_decisions — décision HUMAINE obligatoire, append-only
-- ===========================================================================
-- Pas de colonne `updated_at` (même choix que `source_releases`/
-- `observations`, 028) : une ligne immuable ne porte pas de colonne qui
-- suggère qu'elle se modifie.
CREATE TABLE IF NOT EXISTS materiality_decisions (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES companies(id),
    iro_id          BIGINT NOT NULL REFERENCES iros(id),
    -- Jamais nul — décision humaine obligatoire, jamais « le système ».
    decided_by      BIGINT NOT NULL,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_material     BOOLEAN NOT NULL,
    -- Quelle dimension a motivé la décision — généralisation du « impact OU
    -- financier » déjà codé dans materialite_service.compute_score.
    basis           TEXT NOT NULL,
    -- Jamais optionnelle.
    justification   TEXT NOT NULL,
    -- Append-only : une redécision insère une NOUVELLE ligne, ne réécrit
    -- jamais l'ancienne (trigger ci-dessous, jamais d'UPDATE applicatif).
    supersedes_id   BIGINT REFERENCES materiality_decisions(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT materiality_decisions_basis_check CHECK (
        basis IN ('impact', 'financial', 'both')
    ),
    CONSTRAINT materiality_decisions_justification_check CHECK (
        length(btrim(justification)) > 0
    ),
    CONSTRAINT materiality_decisions_not_self_superseding_check CHECK (
        supersedes_id IS NULL OR supersedes_id <> id
    )
);

CREATE INDEX IF NOT EXISTS idx_materiality_decisions_company ON materiality_decisions(company_id);
CREATE INDEX IF NOT EXISTS idx_materiality_decisions_iro
    ON materiality_decisions(company_id, iro_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_materiality_decisions_supersedes ON materiality_decisions(supersedes_id);

-- Append-only enforcement — motif `evidence_kernel_guard('frozen')` (028) /
-- `site_water_screening_immutability_guard` (037) : refus explicite plutôt
-- qu'un filtrage RLS silencieux à 0 ligne.
CREATE OR REPLACE FUNCTION materiality_decisions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'materiality_decisions: % sur la décision % refusé — ligne append-only, corriger via une nouvelle décision (supersedes_id)',
    TG_OP, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_materiality_decisions_guard ON materiality_decisions;
CREATE TRIGGER trg_materiality_decisions_guard
  BEFORE UPDATE OR DELETE ON materiality_decisions
  FOR EACH ROW EXECUTE FUNCTION materiality_decisions_guard();

-- ===========================================================================
-- E. iro_actions — actions liées à un IRO (calqué sur mitigation_actions 034 /
--    water_actions 037 / nature_actions 039, table PROPRE — pas d'ALTER sur
--    une table d'un autre domaine)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS iro_actions (
    id                            BIGSERIAL PRIMARY KEY,
    company_id                    BIGINT NOT NULL REFERENCES companies(id),
    iro_id                        BIGINT NOT NULL REFERENCES iros(id),
    action_type                   TEXT NOT NULL,
    title                         TEXT NOT NULL,
    description                   TEXT,
    status                        TEXT NOT NULL DEFAULT 'planned',
    owner                         TEXT,
    due_date                      DATE,
    completed_at                  TIMESTAMPTZ,
    expected_effect               TEXT,
    -- INTENTION déclarée — jamais soustraite automatiquement d'un score
    -- (même règle que 034/037/039).
    expected_risk_reduction_pct   NUMERIC,
    created_by                    BIGINT,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT iro_actions_type_check CHECK (
        action_type IN ('mitigation', 'adaptation', 'enhancement', 'monitoring', 'engagement', 'other')
    ),
    CONSTRAINT iro_actions_status_check CHECK (
        status IN ('planned', 'in_progress', 'completed', 'cancelled')
    ),
    CONSTRAINT iro_actions_reduction_range_check CHECK (
        expected_risk_reduction_pct IS NULL
        OR (expected_risk_reduction_pct >= 0 AND expected_risk_reduction_pct <= 100)
    )
);

CREATE INDEX IF NOT EXISTS idx_iro_actions_company ON iro_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_iro_actions_iro ON iro_actions(company_id, iro_id);
CREATE INDEX IF NOT EXISTS idx_iro_actions_status ON iro_actions(company_id, status);

-- ===========================================================================
-- F. disclosure_mappings — correspondance IRO ↔ exigence de disclosure
--    (table de correspondance PURE, aucune publication automatique)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS disclosure_mappings (
    id               BIGSERIAL PRIMARY KEY,
    company_id       BIGINT NOT NULL REFERENCES companies(id),
    iro_id           BIGINT NOT NULL REFERENCES iros(id),
    -- Libre : code de datapoint VSME (ex. 'C1-3', vsme_datapoints.code,
    -- migration 014) QUAND le rattachement existe, ou référence ESRS libre
    -- (ex. 'ESRS E1-6') sinon. PAS de FK vers vsme_datapoints — vérifié par
    -- inspection de 014/015 : ce catalogue est le sous-ensemble VOLONTAIREMENT
    -- SIMPLIFIÉ du standard VSME (47 datapoints B1-C9), pas le référentiel
    -- ESRS complet ; une FK stricte bloquerait toute correspondance à un
    -- point de donnée ESRS hors couverture VSME. Aucune autre table du dépôt
    -- ne référence vsme_datapoints.code par FK non plus (même choix, vérifié
    -- par grep).
    esrs_reference    TEXT,
    status            TEXT NOT NULL DEFAULT 'draft',
    notes             TEXT,
    created_by        BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT disclosure_mappings_status_check CHECK (
        status IN ('draft', 'mapped', 'disclosed')
    )
);

CREATE INDEX IF NOT EXISTS idx_disclosure_mappings_company ON disclosure_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_mappings_iro ON disclosure_mappings(company_id, iro_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_mappings_esrs ON disclosure_mappings(esrs_reference);

-- ===========================================================================
-- RLS GÉNÉRATION 2 — TENANT STRICT SUR LES SIX TABLES
-- ===========================================================================

-- ── iros ─────────────────────────────────────────────────────────────────
ALTER TABLE iros ENABLE ROW LEVEL SECURITY;
ALTER TABLE iros FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_iros ON iros;
CREATE POLICY tenant_isolation_iros ON iros
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_iros_insert ON iros;
CREATE POLICY tenant_isolation_iros_insert ON iros
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_iros_update ON iros;
CREATE POLICY tenant_isolation_iros_update ON iros
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_iros_delete ON iros;
CREATE POLICY tenant_isolation_iros_delete ON iros
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── impact_assessments ──────────────────────────────────────────────────
ALTER TABLE impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_assessments FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_impact_assessments ON impact_assessments;
CREATE POLICY tenant_isolation_impact_assessments ON impact_assessments
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_impact_assessments_insert ON impact_assessments;
CREATE POLICY tenant_isolation_impact_assessments_insert ON impact_assessments
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_impact_assessments_update ON impact_assessments;
CREATE POLICY tenant_isolation_impact_assessments_update ON impact_assessments
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_impact_assessments_delete ON impact_assessments;
CREATE POLICY tenant_isolation_impact_assessments_delete ON impact_assessments
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── financial_assessments ───────────────────────────────────────────────
ALTER TABLE financial_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_assessments FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_financial_assessments ON financial_assessments;
CREATE POLICY tenant_isolation_financial_assessments ON financial_assessments
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_financial_assessments_insert ON financial_assessments;
CREATE POLICY tenant_isolation_financial_assessments_insert ON financial_assessments
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_financial_assessments_update ON financial_assessments;
CREATE POLICY tenant_isolation_financial_assessments_update ON financial_assessments
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_financial_assessments_delete ON financial_assessments;
CREATE POLICY tenant_isolation_financial_assessments_delete ON financial_assessments
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── materiality_decisions ───────────────────────────────────────────────
-- UPDATE/DELETE restent RLS-visibles pour le tenant propriétaire : c'est le
-- trigger `materiality_decisions_guard` qui refuse ENSUITE systématiquement
-- le geste avec un message explicite (motif `observations`/`source_releases`,
-- 028) — sans ces policies, RLS filtrerait silencieusement à 0 ligne au lieu
-- de laisser le trigger lever une erreur.
ALTER TABLE materiality_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiality_decisions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_materiality_decisions ON materiality_decisions;
CREATE POLICY tenant_isolation_materiality_decisions ON materiality_decisions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_materiality_decisions_insert ON materiality_decisions;
CREATE POLICY tenant_isolation_materiality_decisions_insert ON materiality_decisions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_materiality_decisions_update ON materiality_decisions;
CREATE POLICY tenant_isolation_materiality_decisions_update ON materiality_decisions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_materiality_decisions_delete ON materiality_decisions;
CREATE POLICY tenant_isolation_materiality_decisions_delete ON materiality_decisions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── iro_actions ──────────────────────────────────────────────────────────
ALTER TABLE iro_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE iro_actions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_iro_actions ON iro_actions;
CREATE POLICY tenant_isolation_iro_actions ON iro_actions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_iro_actions_insert ON iro_actions;
CREATE POLICY tenant_isolation_iro_actions_insert ON iro_actions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_iro_actions_update ON iro_actions;
CREATE POLICY tenant_isolation_iro_actions_update ON iro_actions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_iro_actions_delete ON iro_actions;
CREATE POLICY tenant_isolation_iro_actions_delete ON iro_actions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── disclosure_mappings ─────────────────────────────────────────────────
ALTER TABLE disclosure_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_mappings FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_disclosure_mappings ON disclosure_mappings;
CREATE POLICY tenant_isolation_disclosure_mappings ON disclosure_mappings
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_disclosure_mappings_insert ON disclosure_mappings;
CREATE POLICY tenant_isolation_disclosure_mappings_insert ON disclosure_mappings
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_disclosure_mappings_update ON disclosure_mappings;
CREATE POLICY tenant_isolation_disclosure_mappings_update ON disclosure_mappings
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_disclosure_mappings_delete ON disclosure_mappings;
CREATE POLICY tenant_isolation_disclosure_mappings_delete ON disclosure_mappings
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- ÉLARGISSEMENT — audit_eventtype_check (nouveau littéral 'materiality_decision')
-- ===========================================================================
-- Chaque décision de matérialité (materiality_decision_service.decide) est
-- auditée via audit_service.log_event("materiality_decision", ...) — le
-- littéral Python (AuditEventType) ne suffit pas seul, la table audit_events
-- porte sa propre contrainte CHECK, déjà élargie deux fois par le passé
-- (011 : événements 2FA ; 012 : auditor_invite/auditor_access) selon le même
-- geste DROP + ADD sous le même nom, repris ici à l'identique. Ni 011 ni 012
-- ne sont `requires_owner` pour ce geste sur cette même table (vérifié dans
-- migration_manifest.py) — 040 ne l'est donc pas non plus pour cette raison.
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_eventtype_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_eventtype_check CHECK (event_type IN (
    'ingest','upload','cache_clear','login','export','validation','error',
    '2fa_enroll','2fa_success','2fa_fail','2fa_recovery',
    'auditor_invite','auditor_access','materiality_decision'
));

-- ===========================================================================
-- ACCÈS APPLICATIF — GRANT conditionnel (geste 027/028/030/031/033/034/037)
-- ===========================================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      iros, impact_assessments, financial_assessments, materiality_decisions,
      iro_actions, disclosure_mappings
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      iros_id_seq, impact_assessments_id_seq, financial_assessments_id_seq,
      materiality_decisions_id_seq, iro_actions_id_seq, disclosure_mappings_id_seq
      TO carbonco_app;
  END IF;
END $$;
