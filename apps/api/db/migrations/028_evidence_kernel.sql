-- Migration 028 — Evidence Kernel (PR-03) : noyau partagé sources/releases/
-- artefacts/ingestions/observations/liens de preuve.
--
-- Couche 1 de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §3 : registre
-- des sources externes, licences, releases immuables, artefacts bruts,
-- observations normalisées et liens preuve↔claim. Fondation réutilisable par
-- les futurs modules (achats, Scope 2, matières, eau, biodiversité, double
-- matérialité) — aucun module métier n'est construit dans cette migration.
--
-- company_id NULL = donnée globale (ex. un référentiel partagé entre tous les
-- tenants) ; company_id NOT NULL = donnée privée d'un tenant. Nouveau dans ce
-- schéma — aucune table historique (001-027) n'a de ligne globale, toujours
-- NOT NULL. La RLS ci-dessous étend donc le pattern 009/027 (ENABLE+FORCE+
-- NULLIF+rls_bypass) avec une clause `company_id IS NULL` en LECTURE
-- seulement (jamais en écriture — un tenant ne peut jamais créer/modifier une
-- ligne globale, seul `app.rls_bypass` ou un service admin le peut).
--
-- Aucune donnée externe réelle n'est ingérée par cette migration : elle crée
-- uniquement le schéma. Aucun adaptateur, aucun scraping, aucun LLM.

-- ---------------------------------------------------------------------------
-- A. source_registry — registre des sources externes et leur licence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_registry (
    id                          BIGSERIAL PRIMARY KEY,
    company_id                  BIGINT REFERENCES companies(id),
    code                        TEXT NOT NULL,
    publisher                   TEXT NOT NULL,
    title                       TEXT NOT NULL,
    source_type                 TEXT NOT NULL,
    adapter_kind                TEXT,
    base_uri                    TEXT,
    license_code                TEXT,
    automated_access_allowed    BOOLEAN NOT NULL DEFAULT FALSE,
    storage_allowed             BOOLEAN NOT NULL DEFAULT FALSE,
    commercial_use_allowed      BOOLEAN NOT NULL DEFAULT FALSE,
    redistribution_allowed      BOOLEAN NOT NULL DEFAULT FALSE,
    derived_use_allowed         BOOLEAN NOT NULL DEFAULT FALSE,
    display_allowed              BOOLEAN NOT NULL DEFAULT FALSE,
    attribution_text            TEXT,
    terms_uri                   TEXT,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    created_by                  BIGINT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT source_registry_source_type_check CHECK (
        source_type IN ('api', 'file', 'webpage', 'manual', 'licensed_feed')
    )
);

-- Unicité de `code` : globale parmi les sources globales, par tenant parmi
-- les sources privées (deux tenants — ou un tenant et le registre global —
-- peuvent réutiliser le même code sans collision, deux index partiels
-- distincts plutôt qu'un UNIQUE(company_id, code) qui traiterait NULL comme
-- "distinct à chaque fois" et laisserait deux sources globales homonymes).
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_registry_code_global_uniq
    ON source_registry (code) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_source_registry_code_tenant_uniq
    ON source_registry (company_id, code) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_source_registry_company ON source_registry(company_id);

-- ---------------------------------------------------------------------------
-- B. source_releases — release immuable d'une source (une fois publiée)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_releases (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           BIGINT NOT NULL REFERENCES source_registry(id),
    company_id          BIGINT REFERENCES companies(id),
    release_key         TEXT NOT NULL,
    published_at        TIMESTAMPTZ,
    retrieved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_from          TIMESTAMPTZ,
    valid_to            TIMESTAMPTZ,
    checksum_sha256     TEXT NOT NULL,
    blob_key            TEXT,
    mime_type           TEXT,
    schema_version      TEXT,
    status              TEXT NOT NULL,
    supersedes_id       BIGINT REFERENCES source_releases(id),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_by          BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT source_releases_status_check CHECK (
        status IN ('detected', 'quarantined', 'validated', 'published', 'superseded', 'blocked_license')
    ),
    -- Idempotence de détection : redétecter la même release (même source,
    -- même clé, mêmes octets) ne crée jamais de doublon.
    CONSTRAINT source_releases_idempotency_uniq UNIQUE (source_id, release_key, checksum_sha256)
);

CREATE INDEX IF NOT EXISTS idx_source_releases_company ON source_releases(company_id);
CREATE INDEX IF NOT EXISTS idx_source_releases_source ON source_releases(source_id);
CREATE INDEX IF NOT EXISTS idx_source_releases_status ON source_releases(status);
CREATE INDEX IF NOT EXISTS idx_source_releases_checksum ON source_releases(checksum_sha256);
CREATE INDEX IF NOT EXISTS idx_source_releases_supersedes ON source_releases(supersedes_id);

-- ---------------------------------------------------------------------------
-- C. evidence_artifacts — pièce brute (PDF/CSV/capture...) rattachée à une
--    release et/ou citée par une observation ou un claim
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evidence_artifacts (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT REFERENCES companies(id),
    source_release_id   BIGINT REFERENCES source_releases(id),
    blob_key            TEXT NOT NULL,
    sha256              TEXT NOT NULL,
    filename            TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    size_bytes          BIGINT,
    page_reference      TEXT,
    table_reference     TEXT,
    cell_reference      TEXT,
    excerpt             TEXT,
    sensitivity         TEXT NOT NULL DEFAULT 'internal',
    created_by          BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT evidence_artifacts_sensitivity_check CHECK (
        sensitivity IN ('public', 'internal', 'confidential', 'restricted')
    )
);

CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_company ON evidence_artifacts(company_id);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_source_release ON evidence_artifacts(source_release_id);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_sha256 ON evidence_artifacts(sha256);

-- ---------------------------------------------------------------------------
-- D. ingestion_runs — exécution d'une détection/import pour une source
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT REFERENCES companies(id),
    source_id           BIGINT NOT NULL REFERENCES source_registry(id),
    source_release_id   BIGINT REFERENCES source_releases(id),
    adapter_kind        TEXT,
    idempotency_key     TEXT NOT NULL,
    status              TEXT NOT NULL,
    detected_count      INTEGER NOT NULL DEFAULT 0,
    accepted_count      INTEGER NOT NULL DEFAULT 0,
    rejected_count      INTEGER NOT NULL DEFAULT 0,
    warning_count       INTEGER NOT NULL DEFAULT 0,
    error_summary       TEXT,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    created_by          BIGINT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT ingestion_runs_status_check CHECK (
        status IN ('pending', 'running', 'quarantined', 'validated', 'published', 'failed', 'blocked_license')
    ),
    CONSTRAINT ingestion_runs_idempotency_key_uniq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_company ON ingestion_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON ingestion_runs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source_release ON ingestion_runs(source_release_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON ingestion_runs(status);

-- ---------------------------------------------------------------------------
-- E. observations — fait normalisé, toujours rattaché à une release, jamais
--    modifié après création (une correction insère une nouvelle ligne)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS observations (
    id                      BIGSERIAL PRIMARY KEY,
    company_id              BIGINT REFERENCES companies(id),
    subject_type            TEXT NOT NULL,
    subject_key             TEXT NOT NULL,
    metric_code             TEXT NOT NULL,
    numeric_value           NUMERIC,
    text_value               TEXT,
    boolean_value            BOOLEAN,
    unit                     TEXT,
    geography_code          TEXT,
    stage_code               TEXT,
    observed_at              TIMESTAMPTZ,
    valid_from               TIMESTAMPTZ,
    valid_to                 TIMESTAMPTZ,
    source_release_id        BIGINT NOT NULL REFERENCES source_releases(id),
    evidence_artifact_id     BIGINT REFERENCES evidence_artifacts(id),
    data_status              TEXT NOT NULL,
    confidence                NUMERIC,
    methodology_version       TEXT,
    supersedes_id              BIGINT REFERENCES observations(id),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT observations_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    -- Au moins une des 3 valeurs typées doit être renseignée.
    CONSTRAINT observations_value_presence_check CHECK (
        (CASE WHEN numeric_value IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN text_value    IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN boolean_value IS NOT NULL THEN 1 ELSE 0 END) >= 1
    ),
    CONSTRAINT observations_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

CREATE INDEX IF NOT EXISTS idx_observations_company ON observations(company_id);
CREATE INDEX IF NOT EXISTS idx_observations_source_release ON observations(source_release_id);
-- Motif de lecture principal (drill-down sujet → métrique → historique).
CREATE INDEX IF NOT EXISTS idx_observations_subject
    ON observations(subject_type, subject_key, metric_code, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_metric_code ON observations(metric_code);
CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON observations(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_supersedes ON observations(supersedes_id);

-- ---------------------------------------------------------------------------
-- F. claim_evidence_links — lien entre un claim applicatif (code+clé libres,
--    ex. "material_exposure:REE-NdFeB") et une pièce qui le supporte/contredit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS claim_evidence_links (
    id                      BIGSERIAL PRIMARY KEY,
    company_id              BIGINT REFERENCES companies(id),
    claim_type              TEXT NOT NULL,
    claim_key                TEXT NOT NULL,
    evidence_artifact_id       BIGINT NOT NULL REFERENCES evidence_artifacts(id),
    relation_type              TEXT NOT NULL,
    created_by                 BIGINT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT claim_evidence_links_relation_type_check CHECK (
        relation_type IN ('supports', 'contradicts', 'contextualizes', 'derived_from')
    )
);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_company ON claim_evidence_links(company_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_artifact ON claim_evidence_links(evidence_artifact_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_claim ON claim_evidence_links(claim_type, claim_key);

-- ---------------------------------------------------------------------------
-- RLS — pattern 009/027 (ENABLE + FORCE + NULLIF + rls_bypass) étendu d'une
-- clause de lecture globale. Chaque commande est scopée explicitement
-- (FOR SELECT / INSERT / UPDATE / DELETE) plutôt qu'une policy ALL unique :
-- lecture et écriture n'ont PAS la même règle ici (une ligne globale est
-- lisible par tous mais jamais écrite par un tenant), contrairement aux
-- tables historiques où les deux expressions coïncidaient.
-- ---------------------------------------------------------------------------

-- ── source_registry ─────────────────────────────────────────────────────────
-- Idempotent : DROP POLICY IF EXISTS puis CREATE (pattern 009) — nécessaire
-- pour rester rejouable par le déclencheur startup_event/run_migrations()
-- (confort dev local, cf. main.py) sans échouer sur "policy already exists".
ALTER TABLE source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_registry FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_source_registry ON source_registry;
CREATE POLICY tenant_isolation_source_registry ON source_registry
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_source_registry_insert ON source_registry;
CREATE POLICY tenant_isolation_source_registry_insert ON source_registry
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_source_registry_update ON source_registry;
CREATE POLICY tenant_isolation_source_registry_update ON source_registry
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── source_releases ─────────────────────────────────────────────────────────
ALTER TABLE source_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_releases FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_source_releases ON source_releases;
CREATE POLICY tenant_isolation_source_releases ON source_releases
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_source_releases_insert ON source_releases;
CREATE POLICY tenant_isolation_source_releases_insert ON source_releases
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
-- UPDATE/DELETE : RLS n'autorise que la ligne du tenant (comme les autres
-- commandes) — c'est le trigger evidence_kernel_guard('source_release')
-- ci-dessous qui refuse ensuite le geste avec un message explicite plutôt
-- que de laisser RLS filtrer silencieusement 0 ligne.
DROP POLICY IF EXISTS tenant_isolation_source_releases_update ON source_releases;
CREATE POLICY tenant_isolation_source_releases_update ON source_releases
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_source_releases_delete ON source_releases;
CREATE POLICY tenant_isolation_source_releases_delete ON source_releases
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── evidence_artifacts ──────────────────────────────────────────────────────
ALTER TABLE evidence_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_artifacts FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_evidence_artifacts ON evidence_artifacts;
CREATE POLICY tenant_isolation_evidence_artifacts ON evidence_artifacts
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_evidence_artifacts_insert ON evidence_artifacts;
CREATE POLICY tenant_isolation_evidence_artifacts_insert ON evidence_artifacts
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_evidence_artifacts_update ON evidence_artifacts;
CREATE POLICY tenant_isolation_evidence_artifacts_update ON evidence_artifacts
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_evidence_artifacts_delete ON evidence_artifacts;
CREATE POLICY tenant_isolation_evidence_artifacts_delete ON evidence_artifacts
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── ingestion_runs ──────────────────────────────────────────────────────────
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ingestion_runs ON ingestion_runs;
CREATE POLICY tenant_isolation_ingestion_runs ON ingestion_runs
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_ingestion_runs_insert ON ingestion_runs;
CREATE POLICY tenant_isolation_ingestion_runs_insert ON ingestion_runs
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_ingestion_runs_update ON ingestion_runs;
CREATE POLICY tenant_isolation_ingestion_runs_update ON ingestion_runs
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── observations ────────────────────────────────────────────────────────────
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_observations ON observations;
CREATE POLICY tenant_isolation_observations ON observations
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_observations_insert ON observations;
CREATE POLICY tenant_isolation_observations_insert ON observations
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
-- UPDATE/DELETE restent RLS-visibles pour le tenant propriétaire : c'est
-- evidence_kernel_guard('frozen') qui refuse ENSUITE systématiquement le
-- geste (aucune UPDATE/DELETE d'observation, jamais — correction = nouvelle
-- ligne + supersedes_id). Sans ces policies, RLS filtrerait silencieusement
-- à 0 ligne au lieu de laisser le trigger lever une erreur explicite.
DROP POLICY IF EXISTS tenant_isolation_observations_update ON observations;
CREATE POLICY tenant_isolation_observations_update ON observations
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_observations_delete ON observations;
CREATE POLICY tenant_isolation_observations_delete ON observations
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── claim_evidence_links ────────────────────────────────────────────────────
ALTER TABLE claim_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence_links FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_claim_evidence_links ON claim_evidence_links;
CREATE POLICY tenant_isolation_claim_evidence_links ON claim_evidence_links
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_claim_evidence_links_insert ON claim_evidence_links;
CREATE POLICY tenant_isolation_claim_evidence_links_insert ON claim_evidence_links
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_claim_evidence_links_delete ON claim_evidence_links;
CREATE POLICY tenant_isolation_claim_evidence_links_delete ON claim_evidence_links
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ---------------------------------------------------------------------------
-- Immutabilité — fonction trigger générique unique (documentée), pas une
-- fonction par table. Le mode (TG_ARGV[0]) sélectionne la règle :
--   'frozen'            : toute UPDATE/DELETE refusée sans exception
--                          (observations — correction = nouvelle ligne).
--   'source_release'    : transitions libres tant que le statut n'est pas
--                          'published' ; une fois 'published', seule la
--                          transition status: published -> superseded (et
--                          RIEN d'autre) reste permise ; 'superseded' est
--                          ensuite gelé à son tour ; DELETE toujours refusé
--                          (registre append-only).
--   'evidence_artifact'  : DELETE et modification de sha256/blob_key refusés
--                          si l'artefact est référencé par au moins une
--                          observation ou un claim_evidence_link ; les
--                          autres colonnes (métadonnées descriptives)
--                          restent librement modifiables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION evidence_kernel_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_mode TEXT := TG_ARGV[0];
  v_referenced BOOLEAN;
BEGIN
  IF v_mode = 'frozen' THEN
    RAISE EXCEPTION 'evidence_kernel: % sur % refusé — ligne immuable, corriger via supersedes_id',
      TG_OP, TG_TABLE_NAME;

  ELSIF v_mode = 'source_release' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'evidence_kernel: DELETE sur source_releases (id=%) refusé — registre append-only', OLD.id;
    END IF;
    IF OLD.status = 'superseded' THEN
      RAISE EXCEPTION 'evidence_kernel: UPDATE sur source_releases (id=%) refusé — statut superseded gelé', OLD.id;
    ELSIF OLD.status = 'published' THEN
      IF NEW.status = 'superseded'
         AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id
         AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
         AND NEW.release_key IS NOT DISTINCT FROM OLD.release_key
         AND NEW.checksum_sha256 IS NOT DISTINCT FROM OLD.checksum_sha256
         AND NEW.blob_key IS NOT DISTINCT FROM OLD.blob_key
         AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
         AND NEW.valid_from IS NOT DISTINCT FROM OLD.valid_from
         AND NEW.valid_to IS NOT DISTINCT FROM OLD.valid_to
         AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
      THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'evidence_kernel: UPDATE sur source_releases (id=%) refusé — seule la transition published->superseded est permise sur une ligne publiée', OLD.id;
    END IF;
    RETURN NEW;

  ELSIF v_mode = 'evidence_artifact' THEN
    SELECT EXISTS (
      SELECT 1 FROM observations WHERE evidence_artifact_id = OLD.id
      UNION ALL
      SELECT 1 FROM claim_evidence_links WHERE evidence_artifact_id = OLD.id
    ) INTO v_referenced;

    IF TG_OP = 'DELETE' THEN
      IF v_referenced THEN
        RAISE EXCEPTION 'evidence_kernel: DELETE sur evidence_artifacts (id=%) refusé — artefact référencé', OLD.id;
      END IF;
      RETURN OLD;
    END IF;
    IF v_referenced AND (NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.blob_key IS DISTINCT FROM OLD.blob_key) THEN
      RAISE EXCEPTION 'evidence_kernel: UPDATE sur evidence_artifacts (id=%) refusé — sha256/blob_key immuables sur un artefact référencé', OLD.id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_observations_immutable ON observations;
CREATE TRIGGER trg_observations_immutable
  BEFORE UPDATE OR DELETE ON observations
  FOR EACH ROW EXECUTE FUNCTION evidence_kernel_guard('frozen');

DROP TRIGGER IF EXISTS trg_source_releases_guard ON source_releases;
CREATE TRIGGER trg_source_releases_guard
  BEFORE UPDATE OR DELETE ON source_releases
  FOR EACH ROW EXECUTE FUNCTION evidence_kernel_guard('source_release');

DROP TRIGGER IF EXISTS trg_evidence_artifacts_guard ON evidence_artifacts;
CREATE TRIGGER trg_evidence_artifacts_guard
  BEFORE UPDATE OR DELETE ON evidence_artifacts
  FOR EACH ROW EXECUTE FUNCTION evidence_kernel_guard('evidence_artifact');

-- ---------------------------------------------------------------------------
-- Accès applicatif — même geste que 027 : si la migration est appliquée par
-- un rôle admin distinct du rôle applicatif (DATABASE_ADMIN_URL en prod via
-- db-migrate.yml), l'app (DATABASE_URL, rôle carbonco_app) a besoin d'un GRANT
-- explicite sur les nouvelles tables. No-op si carbonco_app est déjà
-- propriétaire (environnement neuf) ou absent (dev/CI sans ce rôle).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      source_registry, source_releases, evidence_artifacts,
      ingestion_runs, observations, claim_evidence_links
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      source_registry_id_seq, source_releases_id_seq, evidence_artifacts_id_seq,
      ingestion_runs_id_seq, observations_id_seq, claim_evidence_links_id_seq
      TO carbonco_app;
  END IF;
END $$;
