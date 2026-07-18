-- Migration 030 — Exposition achats / fournisseurs (PR-05A) : sites & produits
-- fournisseurs, imports d'achats idempotents, lignes d'achat, BOM versionnées,
-- correspondances matières, déclarations fournisseurs et PCF produit sourcées.
--
-- Phase 4 de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §10/§20. Cette
-- tranche (PR-05A) pose UNIQUEMENT le socle d'exposition et de données — aucun
-- calcul Scope 3, aucun score fournisseur, aucun hotspot (tout cela relève de
-- PR-05B, migration 031+). Aucune donnée métier n'est migrée ici, aucune source
-- externe ingérée, aucun LLM.
--
-- RLS génération 2 (comme 028, PAS la génération 1 « ENABLE seul » des tables
-- 008b) : ENABLE + FORCE, policies scopées PAR COMMANDE (SELECT/INSERT/UPDATE/
-- DELETE), NULLIF(current_setting('app.current_company_id'))::bigint,
-- app.rls_bypass, DROP POLICY IF EXISTS avant chaque CREATE (rejouable par
-- startup_event/run_migrations() en dev). Toutes ces tables sont à portée
-- tenant STRICTE (`company_id BIGINT NOT NULL` — aucune ligne globale) ; la
-- branche de lecture `company_id IS NULL` du pattern 028 est conservée à
-- l'identique par cohérence (inerte sous NOT NULL). La défense en profondeur
-- applicative (prédicat de périmètre dans chaque requête de service) reste
-- OBLIGATOIRE en plus de la RLS (le PostgreSQL de CI se connecte en superuser
-- qui bypasse la RLS — cf. PR03_EVIDENCE_KERNEL_TRACEABILITY.md §15).
--
-- FK BIGINT vers des PK INTEGER historiques (suppliers.id, products.id,
-- companies.id sont SERIAL/int4) : valide en PostgreSQL (comparaison croisée
-- int4/int8 nativement supportée), même geste que 028 (company_id BIGINT
-- REFERENCES companies(id)).

-- ---------------------------------------------------------------------------
-- A. supplier_sites — sites physiques d'un fournisseur (géo réelle = PR-08)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_sites (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    supplier_id           BIGINT NOT NULL REFERENCES suppliers(id),
    name                  TEXT NOT NULL,
    address               TEXT,
    country_code          TEXT,
    latitude              NUMERIC,
    longitude             NUMERIC,
    geocode_review_status TEXT NOT NULL DEFAULT 'pending',
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT supplier_sites_geocode_review_check CHECK (
        geocode_review_status IN ('pending', 'accepted', 'flagged')
    )
);

CREATE INDEX IF NOT EXISTS idx_supplier_sites_company ON supplier_sites(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_sites_supplier ON supplier_sites(supplier_id);

-- ---------------------------------------------------------------------------
-- B. supplier_products — référentiel produit d'un fournisseur
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_products (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    supplier_id           BIGINT NOT NULL REFERENCES suppliers(id),
    product_code          TEXT NOT NULL,
    product_name          TEXT,
    category_code         TEXT,
    origin_country        TEXT,
    manufacturing_site_id BIGINT REFERENCES supplier_sites(id),
    created_by            BIGINT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un code produit est unique par fournisseur au sein d'un tenant.
    CONSTRAINT supplier_products_code_uniq UNIQUE (company_id, supplier_id, product_code)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_company ON supplier_products(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_site ON supplier_products(manufacturing_site_id);

-- ---------------------------------------------------------------------------
-- C. purchase_imports — import d'un fichier d'achats, idempotent par CONTENU
--    (sha256). Améliore import_screenings (022) qui n'a pas de hash de contenu.
--    Gate de revue pending -> validated -> emitted (patron import_screenings).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_imports (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT NOT NULL REFERENCES companies(id),
    filename          TEXT NOT NULL,
    sha256            TEXT NOT NULL,
    period_start      DATE,
    period_end        DATE,
    status            TEXT NOT NULL DEFAULT 'pending',
    row_count         INTEGER NOT NULL DEFAULT 0,
    accepted_count    INTEGER NOT NULL DEFAULT 0,
    rejected_count    INTEGER NOT NULL DEFAULT 0,
    error_summary     TEXT,
    imported_by       BIGINT,
    imported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT purchase_imports_status_check CHECK (
        status IN ('pending', 'validated', 'emitted', 'rejected')
    ),
    -- Idempotence de CONTENU : rejouer le même fichier (mêmes octets) ne crée
    -- jamais de doublon d'import pour ce tenant.
    CONSTRAINT purchase_imports_sha256_uniq UNIQUE (company_id, sha256)
);

CREATE INDEX IF NOT EXISTS idx_purchase_imports_company ON purchase_imports(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_imports_status ON purchase_imports(status);

-- ---------------------------------------------------------------------------
-- D. purchase_lines — lignes d'un import d'achats, avec statut de mapping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_lines (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    import_id             BIGINT NOT NULL REFERENCES purchase_imports(id),
    supplier_id           BIGINT REFERENCES suppliers(id),
    supplier_external_code TEXT,
    product_id            BIGINT REFERENCES supplier_products(id),
    product_external_code TEXT,
    purchase_date         DATE,
    quantity              NUMERIC,
    unit                  TEXT,
    spend_amount          NUMERIC,
    currency              TEXT,
    category_code         TEXT,
    origin_country        TEXT,
    raw_row_json          JSONB NOT NULL DEFAULT '{}',
    mapping_status        TEXT NOT NULL DEFAULT 'unmapped',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT purchase_lines_mapping_status_check CHECK (
        mapping_status IN ('unmapped', 'mapped', 'needs_review', 'resolved')
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_lines_company ON purchase_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_import ON purchase_lines(import_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_supplier ON purchase_lines(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_mapping_status ON purchase_lines(mapping_status);

-- ---------------------------------------------------------------------------
-- E. bom_versions — nomenclature (Bill Of Materials) versionnée d'un produit
--    interne, rattachée à une pièce de preuve (evidence_artifacts, 028).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bom_versions (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id),
    product_id         BIGINT NOT NULL REFERENCES products(id),
    version            TEXT NOT NULL,
    valid_from         DATE,
    valid_to           DATE,
    status             TEXT NOT NULL DEFAULT 'draft',
    source_artifact_id BIGINT REFERENCES evidence_artifacts(id),
    created_by         BIGINT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bom_versions_status_check CHECK (
        status IN ('draft', 'active', 'superseded', 'archived')
    ),
    CONSTRAINT bom_versions_product_version_uniq UNIQUE (company_id, product_id, version)
);

CREATE INDEX IF NOT EXISTS idx_bom_versions_company ON bom_versions(company_id);
CREATE INDEX IF NOT EXISTS idx_bom_versions_product ON bom_versions(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_versions_artifact ON bom_versions(source_artifact_id);

-- ---------------------------------------------------------------------------
-- F. bom_items — composants d'une BOM (arbre via parent_item_id auto-référent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bom_items (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id),
    bom_version_id      BIGINT NOT NULL REFERENCES bom_versions(id),
    parent_item_id      BIGINT REFERENCES bom_items(id),
    component_code      TEXT,
    component_name      TEXT,
    quantity            NUMERIC,
    unit                TEXT,
    supplier_id         BIGINT REFERENCES suppliers(id),
    supplier_product_id BIGINT REFERENCES supplier_products(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_company ON bom_items(company_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_version ON bom_items(bom_version_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_parent ON bom_items(parent_item_id);

-- ---------------------------------------------------------------------------
-- G. material_mappings — correspondance composant BOM -> matière (référentiel
--    matières global = PR-07 ; ici material_id nullable/texte tant qu'absent).
--    confidence (0-1) SÉPARÉ du review_status (contrats §2 : risque ≠ confiance
--    ≠ statut). mapping_method laisse un point d'ancrage 'ai_draft' pour de
--    futures suggestions IA REVUES (jamais une décision automatique).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_mappings (
    id             BIGSERIAL PRIMARY KEY,
    company_id     BIGINT NOT NULL REFERENCES companies(id),
    bom_item_id    BIGINT NOT NULL REFERENCES bom_items(id),
    material_id    TEXT,
    mass_value     NUMERIC,
    mass_unit      TEXT,
    mass_fraction  NUMERIC,
    mapping_method TEXT NOT NULL DEFAULT 'manual',
    confidence     NUMERIC,
    review_status  TEXT NOT NULL DEFAULT 'pending',
    reviewed_by    BIGINT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT material_mappings_method_check CHECK (
        mapping_method IN ('manual', 'ai_draft', 'rule_based', 'imported')
    ),
    CONSTRAINT material_mappings_review_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    CONSTRAINT material_mappings_confidence_range_check CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    )
);

CREATE INDEX IF NOT EXISTS idx_material_mappings_company ON material_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_material_mappings_item ON material_mappings(bom_item_id);
CREATE INDEX IF NOT EXISTS idx_material_mappings_review ON material_mappings(review_status);

-- ---------------------------------------------------------------------------
-- H. supplier_metric_declarations — déclaration chiffrée d'un fournisseur,
--    SOURCÉE (evidence_artifact_id + source_release_id, contrats §3). data_status
--    dans le vocabulaire observations (verified/estimated/manual/inferred).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_metric_declarations (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    supplier_id          BIGINT NOT NULL REFERENCES suppliers(id),
    supplier_product_id  BIGINT REFERENCES supplier_products(id),
    metric_code          TEXT NOT NULL,
    value                NUMERIC,
    unit                 TEXT,
    reporting_year       INTEGER,
    boundary             TEXT,
    methodology          TEXT,
    primary_data_pct     NUMERIC,
    assurance_status     TEXT,
    observation_id       BIGINT REFERENCES observations(id),
    evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id),
    source_release_id    BIGINT REFERENCES source_releases(id),
    data_status          TEXT NOT NULL DEFAULT 'manual',
    review_status        TEXT NOT NULL DEFAULT 'pending',
    created_by           BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT supplier_metric_declarations_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT supplier_metric_declarations_review_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    )
);

CREATE INDEX IF NOT EXISTS idx_supplier_metric_declarations_company ON supplier_metric_declarations(company_id);
CREATE INDEX IF NOT EXISTS idx_supplier_metric_declarations_supplier ON supplier_metric_declarations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_metric_declarations_release ON supplier_metric_declarations(source_release_id);

-- ---------------------------------------------------------------------------
-- I. product_carbon_footprints — PCF déclarée d'un produit fournisseur,
--    SOURCÉE. Une PCF vérifiée est le niveau 1 de la hiérarchie Scope 3 cat. 1
--    (le calcul lui-même = PR-05B).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_carbon_footprints (
    id                   BIGSERIAL PRIMARY KEY,
    company_id           BIGINT NOT NULL REFERENCES companies(id),
    supplier_product_id  BIGINT NOT NULL REFERENCES supplier_products(id),
    cradle_boundary      TEXT,
    value_kgco2e         NUMERIC,
    declared_unit        TEXT,
    reference_flow       TEXT,
    reporting_period     TEXT,
    methodology          TEXT,
    verification_status  TEXT,
    observation_id       BIGINT REFERENCES observations(id),
    evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id),
    source_release_id    BIGINT REFERENCES source_releases(id),
    data_status          TEXT NOT NULL DEFAULT 'manual',
    created_by           BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT product_carbon_footprints_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT product_carbon_footprints_verification_check CHECK (
        verification_status IS NULL OR verification_status IN (
            'unverified', 'self_declared', 'third_party_verified'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_product_carbon_footprints_company ON product_carbon_footprints(company_id);
CREATE INDEX IF NOT EXISTS idx_product_carbon_footprints_product ON product_carbon_footprints(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_product_carbon_footprints_release ON product_carbon_footprints(source_release_id);

-- ---------------------------------------------------------------------------
-- RLS — génération 2 (pattern 028). Chaque table : ENABLE + FORCE, puis 4
-- policies scopées par commande. SELECT autorise rls_bypass / global (inerte
-- ici, NOT NULL) / tenant ; INSERT/UPDATE/DELETE autorisent rls_bypass /
-- tenant uniquement (jamais IS NULL — un tenant n'écrit jamais une ligne
-- globale). DROP POLICY IF EXISTS avant chaque CREATE (idempotence).
-- ---------------------------------------------------------------------------

-- ── supplier_sites ──────────────────────────────────────────────────────────
ALTER TABLE supplier_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_sites FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_supplier_sites ON supplier_sites;
CREATE POLICY tenant_isolation_supplier_sites ON supplier_sites
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_sites_insert ON supplier_sites;
CREATE POLICY tenant_isolation_supplier_sites_insert ON supplier_sites
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_sites_update ON supplier_sites;
CREATE POLICY tenant_isolation_supplier_sites_update ON supplier_sites
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_sites_delete ON supplier_sites;
CREATE POLICY tenant_isolation_supplier_sites_delete ON supplier_sites
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── supplier_products ───────────────────────────────────────────────────────
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_supplier_products ON supplier_products;
CREATE POLICY tenant_isolation_supplier_products ON supplier_products
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_products_insert ON supplier_products;
CREATE POLICY tenant_isolation_supplier_products_insert ON supplier_products
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_products_update ON supplier_products;
CREATE POLICY tenant_isolation_supplier_products_update ON supplier_products
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_products_delete ON supplier_products;
CREATE POLICY tenant_isolation_supplier_products_delete ON supplier_products
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── purchase_imports ────────────────────────────────────────────────────────
ALTER TABLE purchase_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_imports FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_purchase_imports ON purchase_imports;
CREATE POLICY tenant_isolation_purchase_imports ON purchase_imports
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_purchase_imports_insert ON purchase_imports;
CREATE POLICY tenant_isolation_purchase_imports_insert ON purchase_imports
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_purchase_imports_update ON purchase_imports;
CREATE POLICY tenant_isolation_purchase_imports_update ON purchase_imports
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_purchase_imports_delete ON purchase_imports;
CREATE POLICY tenant_isolation_purchase_imports_delete ON purchase_imports
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── purchase_lines ──────────────────────────────────────────────────────────
ALTER TABLE purchase_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_lines FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_purchase_lines ON purchase_lines;
CREATE POLICY tenant_isolation_purchase_lines ON purchase_lines
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_purchase_lines_insert ON purchase_lines;
CREATE POLICY tenant_isolation_purchase_lines_insert ON purchase_lines
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_purchase_lines_update ON purchase_lines;
CREATE POLICY tenant_isolation_purchase_lines_update ON purchase_lines
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_purchase_lines_delete ON purchase_lines;
CREATE POLICY tenant_isolation_purchase_lines_delete ON purchase_lines
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── bom_versions ────────────────────────────────────────────────────────────
ALTER TABLE bom_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_versions FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_bom_versions ON bom_versions;
CREATE POLICY tenant_isolation_bom_versions ON bom_versions
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_bom_versions_insert ON bom_versions;
CREATE POLICY tenant_isolation_bom_versions_insert ON bom_versions
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_bom_versions_update ON bom_versions;
CREATE POLICY tenant_isolation_bom_versions_update ON bom_versions
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_bom_versions_delete ON bom_versions;
CREATE POLICY tenant_isolation_bom_versions_delete ON bom_versions
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── bom_items ───────────────────────────────────────────────────────────────
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_bom_items ON bom_items;
CREATE POLICY tenant_isolation_bom_items ON bom_items
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_bom_items_insert ON bom_items;
CREATE POLICY tenant_isolation_bom_items_insert ON bom_items
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_bom_items_update ON bom_items;
CREATE POLICY tenant_isolation_bom_items_update ON bom_items
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_bom_items_delete ON bom_items;
CREATE POLICY tenant_isolation_bom_items_delete ON bom_items
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── material_mappings ───────────────────────────────────────────────────────
ALTER TABLE material_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_mappings FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_material_mappings ON material_mappings;
CREATE POLICY tenant_isolation_material_mappings ON material_mappings
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_mappings_insert ON material_mappings;
CREATE POLICY tenant_isolation_material_mappings_insert ON material_mappings
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_mappings_update ON material_mappings;
CREATE POLICY tenant_isolation_material_mappings_update ON material_mappings
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_material_mappings_delete ON material_mappings;
CREATE POLICY tenant_isolation_material_mappings_delete ON material_mappings
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── supplier_metric_declarations ────────────────────────────────────────────
ALTER TABLE supplier_metric_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_metric_declarations FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_supplier_metric_declarations ON supplier_metric_declarations;
CREATE POLICY tenant_isolation_supplier_metric_declarations ON supplier_metric_declarations
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_metric_declarations_insert ON supplier_metric_declarations;
CREATE POLICY tenant_isolation_supplier_metric_declarations_insert ON supplier_metric_declarations
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_metric_declarations_update ON supplier_metric_declarations;
CREATE POLICY tenant_isolation_supplier_metric_declarations_update ON supplier_metric_declarations
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_supplier_metric_declarations_delete ON supplier_metric_declarations;
CREATE POLICY tenant_isolation_supplier_metric_declarations_delete ON supplier_metric_declarations
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── product_carbon_footprints ───────────────────────────────────────────────
ALTER TABLE product_carbon_footprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_carbon_footprints FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_product_carbon_footprints ON product_carbon_footprints;
CREATE POLICY tenant_isolation_product_carbon_footprints ON product_carbon_footprints
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_product_carbon_footprints_insert ON product_carbon_footprints;
CREATE POLICY tenant_isolation_product_carbon_footprints_insert ON product_carbon_footprints
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_product_carbon_footprints_update ON product_carbon_footprints;
CREATE POLICY tenant_isolation_product_carbon_footprints_update ON product_carbon_footprints
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_product_carbon_footprints_delete ON product_carbon_footprints;
CREATE POLICY tenant_isolation_product_carbon_footprints_delete ON product_carbon_footprints
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ---------------------------------------------------------------------------
-- Accès applicatif — même geste que 027/028 : si la migration est appliquée
-- par un rôle admin distinct du rôle applicatif (DATABASE_ADMIN_URL en prod
-- via db-migrate.yml), l'app (rôle carbonco_app) a besoin d'un GRANT explicite
-- sur les nouvelles tables/séquences. No-op si carbonco_app est propriétaire
-- (environnement neuf) ou absent (dev/CI sans ce rôle).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      supplier_sites, supplier_products, purchase_imports, purchase_lines,
      bom_versions, bom_items, material_mappings, supplier_metric_declarations,
      product_carbon_footprints
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      supplier_sites_id_seq, supplier_products_id_seq, purchase_imports_id_seq,
      purchase_lines_id_seq, bom_versions_id_seq, bom_items_id_seq,
      material_mappings_id_seq, supplier_metric_declarations_id_seq,
      product_carbon_footprints_id_seq
      TO carbonco_app;
  END IF;
END $$;
