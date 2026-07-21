-- Migration 041 — AI Review Ledger (PR-11) : journal auditable de l'assistant IA
-- de REVUE et d'EXPLICATION cité (jamais un moteur de décision).
--
-- Couche IA de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §16 (§16.3
-- tables, §16.4 gate de publication) et gate Phase 9 (§20). Contrats gelés :
-- AI_GOVERNANCE_CONTRACTS.md (grounding, citations résolues, licence,
-- sensibilité, audit, revue humaine), PR11_DECISIONS.md D-4 (exactement 4
-- tables : ai_runs, ai_claims, ai_citations, ai_review_decisions).
--
-- Cette migration crée 4 tables neuves tenant-strictes (company_id NOT NULL,
-- jamais de ligne globale) + UN élargissement de audit_eventtype_check (nouveau
-- littéral 'ai_review_decision', geste DROP+ADD sous le même nom, identique à
-- 011/012/040). Aucun autre ALTER, aucun privilège propriétaire requis (comme
-- 028/030/040). Aucun LLM, aucun appel réseau, aucune donnée métier migrée,
-- aucune décision automatique, aucun score fusionné, aucun calcul réglementaire :
-- la migration crée uniquement le schéma du journal. Le contenu sensible en clair
-- n'est JAMAIS stocké par défaut (identifiants + hachages + sortie structurée).

-- ---------------------------------------------------------------------------
-- A. ai_runs — une ligne par invocation modèle (provenance + coût + statut).
--    Cycle de vie contrôlé : 'pending' -> terminal ; review_status évolue par
--    décision humaine. Les colonnes de PROVENANCE sont immuables (trigger 'run').
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_runs (
    id                      BIGSERIAL PRIMARY KEY,
    company_id              BIGINT NOT NULL REFERENCES companies(id),
    created_by              BIGINT,
    use_case                TEXT NOT NULL,
    subject_type            TEXT NOT NULL,
    subject_key             TEXT NOT NULL,
    provider                TEXT NOT NULL,
    model                   TEXT NOT NULL,
    model_version           TEXT,
    prompt_version          TEXT NOT NULL,
    policy_version          TEXT NOT NULL,
    -- SHA-256 du reference pack minimisé envoyé au modèle (jamais le contenu clair).
    input_hash              TEXT NOT NULL,
    -- Snapshot des références AUTORISÉES (résolues sous RLS + licence) : liste
    -- d'objets {resource_type, internal_id, ...}. Aucun extrait sensible.
    allowed_reference_ids   JSONB NOT NULL DEFAULT '[]',
    status                  TEXT NOT NULL DEFAULT 'pending',
    tokens_input            INTEGER,
    tokens_output           INTEGER,
    cost_estimate           NUMERIC,
    latency_ms              INTEGER,
    error_code              TEXT,
    review_status           TEXT NOT NULL DEFAULT 'needs_review',
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_runs_use_case_check CHECK (
        use_case IN ('iro_review', 'calc_explanation')
    ),
    CONSTRAINT ai_runs_status_check CHECK (
        status IN ('pending', 'succeeded', 'failed', 'blocked_license', 'refused')
    ),
    CONSTRAINT ai_runs_review_status_check CHECK (
        review_status IN ('draft', 'needs_review', 'approved', 'rejected')
    ),
    CONSTRAINT ai_runs_provider_model_check CHECK (
        length(provider) > 0 AND length(model) > 0
    ),
    CONSTRAINT ai_runs_input_hash_check CHECK (length(input_hash) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_company ON ai_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_subject
    ON ai_runs(company_id, use_case, subject_type, subject_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status ON ai_runs(status);
CREATE INDEX IF NOT EXISTS idx_ai_runs_review_status ON ai_runs(review_status);

-- ---------------------------------------------------------------------------
-- B. ai_claims — une affirmation atomique produite par le modèle (frozen).
--    output_label ∈ DRAFT/SUGGESTION/REVIEW_REQUIRED (étiquetage obligatoire).
--    support_status = résultat d'entailment claim↔preuve.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_claims (
    id                      BIGSERIAL PRIMARY KEY,
    run_id                  BIGINT NOT NULL REFERENCES ai_runs(id),
    company_id              BIGINT NOT NULL REFERENCES companies(id),
    claim_index             INTEGER NOT NULL,
    claim_text              TEXT NOT NULL,
    structured_payload      JSONB NOT NULL DEFAULT '{}',
    output_label            TEXT NOT NULL,
    support_status          TEXT NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_claims_output_label_check CHECK (
        output_label IN ('DRAFT', 'SUGGESTION', 'REVIEW_REQUIRED')
    ),
    CONSTRAINT ai_claims_support_status_check CHECK (
        support_status IN ('supported', 'partially_supported', 'contradicted', 'unsupported')
    ),
    CONSTRAINT ai_claims_run_index_uniq UNIQUE (run_id, claim_index)
);

CREATE INDEX IF NOT EXISTS idx_ai_claims_company ON ai_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_claims_run ON ai_claims(run_id);

-- ---------------------------------------------------------------------------
-- C. ai_citations — citation RÉSOLUE vers une ressource interne réelle (frozen).
--    JAMAIS une URL inventée : chaque ligne pointe un id interne validé sous
--    RLS + licence + sensibilité. Distincte de claim_evidence_links (humain) :
--    une citation modèle ne devient un lien de preuve validé QUE par un geste
--    humain (accept) qui, lui, écrit dans claim_evidence_links.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_citations (
    id                      BIGSERIAL PRIMARY KEY,
    run_id                  BIGINT NOT NULL REFERENCES ai_runs(id),
    claim_id                BIGINT NOT NULL REFERENCES ai_claims(id),
    company_id              BIGINT NOT NULL REFERENCES companies(id),
    resource_type           TEXT NOT NULL,
    internal_id             BIGINT NOT NULL,
    source_id               BIGINT,
    release_id              BIGINT,
    artifact_id             BIGINT,
    observation_id          BIGINT,
    -- {page_reference, table_reference, cell_reference, excerpt?} — excerpt
    -- présent UNIQUEMENT si allow_display ET sensibilité ∈ (public, internal).
    locator                 JSONB NOT NULL DEFAULT '{}',
    data_status             TEXT,
    sensitivity             TEXT,
    license_ok              BOOLEAN NOT NULL DEFAULT FALSE,
    retrieved_at            TIMESTAMPTZ,
    stale                   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_citations_resource_type_check CHECK (
        resource_type IN ('source', 'release', 'artifact', 'observation', 'claim_link', 'calc_result')
    ),
    CONSTRAINT ai_citations_data_status_check CHECK (
        data_status IS NULL OR data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT ai_citations_sensitivity_check CHECK (
        sensitivity IS NULL OR sensitivity IN ('public', 'internal', 'confidential', 'restricted')
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_citations_company ON ai_citations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_citations_run ON ai_citations(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_citations_claim ON ai_citations(claim_id);
CREATE INDEX IF NOT EXISTS idx_ai_citations_artifact ON ai_citations(artifact_id);

-- ---------------------------------------------------------------------------
-- D. ai_review_decisions — décision humaine accept/reject/modify (append-only,
--    motif materiality_decisions 040). reviewer + justification obligatoires.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_review_decisions (
    id                      BIGSERIAL PRIMARY KEY,
    run_id                  BIGINT NOT NULL REFERENCES ai_runs(id),
    company_id              BIGINT NOT NULL REFERENCES companies(id),
    decision                TEXT NOT NULL,
    reviewer_id             BIGINT NOT NULL,
    justification           TEXT NOT NULL,
    modified_output         JSONB,
    feedback                TEXT,
    supersedes_id           BIGINT REFERENCES ai_review_decisions(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ai_review_decisions_decision_check CHECK (
        decision IN ('accept', 'reject', 'modify')
    ),
    CONSTRAINT ai_review_decisions_justification_check CHECK (
        length(btrim(justification)) > 0
    ),
    CONSTRAINT ai_review_decisions_feedback_check CHECK (
        feedback IS NULL OR feedback IN ('useful', 'not_useful', 'incorrect')
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_review_decisions_company ON ai_review_decisions(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_decisions_run
    ON ai_review_decisions(company_id, run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_review_decisions_supersedes ON ai_review_decisions(supersedes_id);

-- ---------------------------------------------------------------------------
-- RLS — pattern gen-2 (009/027/028/040) tenant STRICT (company_id NOT NULL,
-- jamais de ligne globale, donc pas de clause `company_id IS NULL`). ENABLE +
-- FORCE + policies par commande + DROP POLICY IF EXISTS (idempotent).
-- Défense en profondeur applicative EN PLUS (le Postgres de CI se connecte en
-- superuser et bypasse RLS) : chaque service porte son prédicat company_id=%s.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['ai_runs', 'ai_claims', 'ai_citations', 'ai_review_decisions']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);

        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s ON %1$s', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation_%1$s ON %1$s
              FOR SELECT USING (
                current_setting('app.rls_bypass', true) = 'on'
                OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
              )$f$, t);

        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s_insert ON %1$s', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation_%1$s_insert ON %1$s
              FOR INSERT WITH CHECK (
                current_setting('app.rls_bypass', true) = 'on'
                OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
              )$f$, t);

        -- UPDATE/DELETE restent RLS-visibles pour le tenant propriétaire : ce
        -- sont les triggers ci-dessous (ai_review_ledger_guard) qui refusent
        -- ENSUITE le geste avec un message explicite, plutôt qu'un filtrage RLS
        -- silencieux à 0 ligne (motif evidence_kernel_guard / materiality_decisions).
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s_update ON %1$s', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation_%1$s_update ON %1$s
              FOR UPDATE
              USING (
                current_setting('app.rls_bypass', true) = 'on'
                OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
              )
              WITH CHECK (
                current_setting('app.rls_bypass', true) = 'on'
                OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
              )$f$, t);

        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%1$s_delete ON %1$s', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation_%1$s_delete ON %1$s
              FOR DELETE USING (
                current_setting('app.rls_bypass', true) = 'on'
                OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
              )$f$, t);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Immutabilité — fonction trigger unique, mode par TG_ARGV[0] :
--   'run'    : DELETE refusé ; UPDATE autorisé UNIQUEMENT si les colonnes de
--              PROVENANCE sont inchangées (statut/coût/latence/tokens/erreur/
--              review_status/completed_at peuvent évoluer — cycle de vie légal).
--   'frozen' : toute UPDATE/DELETE refusée (ai_claims, ai_citations,
--              ai_review_decisions — correction = nouvelle ligne / décision).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_review_ledger_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_mode TEXT := TG_ARGV[0];
BEGIN
  IF v_mode = 'frozen' THEN
    RAISE EXCEPTION
      'ai_review_ledger: % sur % refusé — ligne append-only (corriger via une nouvelle ligne)',
      TG_OP, TG_TABLE_NAME;

  ELSIF v_mode = 'run' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'ai_review_ledger: DELETE sur ai_runs (id=%) refusé — journal append-only', OLD.id;
    END IF;
    IF NOT (
         NEW.company_id            IS NOT DISTINCT FROM OLD.company_id
     AND NEW.created_by            IS NOT DISTINCT FROM OLD.created_by
     AND NEW.use_case              IS NOT DISTINCT FROM OLD.use_case
     AND NEW.subject_type          IS NOT DISTINCT FROM OLD.subject_type
     AND NEW.subject_key           IS NOT DISTINCT FROM OLD.subject_key
     AND NEW.provider              IS NOT DISTINCT FROM OLD.provider
     AND NEW.model                 IS NOT DISTINCT FROM OLD.model
     AND (NEW.model_version IS NOT DISTINCT FROM OLD.model_version OR OLD.model_version IS NULL)
     AND NEW.prompt_version        IS NOT DISTINCT FROM OLD.prompt_version
     AND NEW.policy_version        IS NOT DISTINCT FROM OLD.policy_version
     AND NEW.input_hash            IS NOT DISTINCT FROM OLD.input_hash
     AND NEW.allowed_reference_ids IS NOT DISTINCT FROM OLD.allowed_reference_ids
     AND NEW.created_at            IS NOT DISTINCT FROM OLD.created_at
    ) THEN
      RAISE EXCEPTION
        'ai_review_ledger: UPDATE sur ai_runs (id=%) refusé — colonnes de provenance immuables', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_runs_guard ON ai_runs;
CREATE TRIGGER trg_ai_runs_guard
  BEFORE UPDATE OR DELETE ON ai_runs
  FOR EACH ROW EXECUTE FUNCTION ai_review_ledger_guard('run');

DROP TRIGGER IF EXISTS trg_ai_claims_guard ON ai_claims;
CREATE TRIGGER trg_ai_claims_guard
  BEFORE UPDATE OR DELETE ON ai_claims
  FOR EACH ROW EXECUTE FUNCTION ai_review_ledger_guard('frozen');

DROP TRIGGER IF EXISTS trg_ai_citations_guard ON ai_citations;
CREATE TRIGGER trg_ai_citations_guard
  BEFORE UPDATE OR DELETE ON ai_citations
  FOR EACH ROW EXECUTE FUNCTION ai_review_ledger_guard('frozen');

DROP TRIGGER IF EXISTS trg_ai_review_decisions_guard ON ai_review_decisions;
CREATE TRIGGER trg_ai_review_decisions_guard
  BEFORE UPDATE OR DELETE ON ai_review_decisions
  FOR EACH ROW EXECUTE FUNCTION ai_review_ledger_guard('frozen');

-- ---------------------------------------------------------------------------
-- ÉLARGISSEMENT — audit_eventtype_check (nouveau littéral 'ai_review_decision').
-- Chaque décision humaine sur une revue IA (review_decision_service.record) est
-- auditée via audit_service.log_event("ai_review_decision", ...). Le littéral
-- Python (AuditEventType) ne suffit pas : audit_events porte sa propre CHECK,
-- déjà élargie par 011/012/040 selon ce même geste DROP+ADD sous le même nom,
-- repris ici à l'identique (aucun requires_owner pour ce geste sur cette table).
-- ---------------------------------------------------------------------------
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_eventtype_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_eventtype_check CHECK (event_type IN (
    'ingest','upload','cache_clear','login','export','validation','error',
    '2fa_enroll','2fa_success','2fa_fail','2fa_recovery',
    'auditor_invite','auditor_access','materiality_decision','ai_review_decision'
));

-- ---------------------------------------------------------------------------
-- Accès applicatif — même geste que 028/040 : GRANT conditionnel à carbonco_app
-- si le rôle existe (No-op en dev/CI sans ce rôle).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      ai_runs, ai_claims, ai_citations, ai_review_decisions
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      ai_runs_id_seq, ai_claims_id_seq, ai_citations_id_seq, ai_review_decisions_id_seq
      TO carbonco_app;
  END IF;
END $$;
