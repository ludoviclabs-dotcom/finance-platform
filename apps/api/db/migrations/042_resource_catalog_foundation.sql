-- Migration 042 — Module 2 (Ressources stratégiques) : fondation catalogue
-- (PR-M2A). Référentiel canonique transversal des ressources + alias legacy +
-- statuts réglementaires sourcés + usages sectoriels.
--
-- Architecture : docs/carbonco/resources/MODULE2_DATA_MODEL.md §2,
-- MODULE2_RLS_AND_SECURITY.md, MODULE2_DECISIONS.md (arbitrages D-1..D-6).
--
-- ---------------------------------------------------------------------------
-- PRINCIPES NON NÉGOCIABLES MATÉRIALISÉS ICI
-- ---------------------------------------------------------------------------
-- 1. company_id BIGINT REFERENCES companies(id), JAMAIS tenant_id UUID. Un seul
--    schéma `public`. Aucune duplication d'Evidence Kernel / CRMA / Water /
--    Energy / Procurement : ce module RÉFÉRENCE (via source_release_id) et
--    orchestre, il ne recopie pas.
-- 2. D-2 — Le catalogue N'ÉCRASE PAS le legacy. `resource_catalog` est neuf ;
--    les anciens `material_id TEXT` de 030/034 restent valides et se rattachent
--    par `resource_aliases` (alias_kind='legacy_material_id'). AUCUN ALTER d'une
--    migration/table historique ici.
-- 3. STATUT RÉGLEMENTAIRE NON EXCLUSIF, SANS BOOLÉEN PERMANENT. Le statut est
--    porté par des LIGNES de `resource_regulatory_statuses` (une par régime :
--    crma, eudr, reach…), jamais par une colonne booléenne `is_critical` sur le
--    catalogue. Une ressource peut donc être critique CRMA ET dans le périmètre
--    EUDR simultanément, sans exclusion possible par construction.
-- 4. PAS DE FAIT RÉGLEMENTAIRE SANS SOURCE. `resource_regulatory_statuses`
--    porte `*_sourced_check` : `certainty='confirmed'` exige
--    `source_release_id NOT NULL` (Evidence Kernel). Une classification non
--    encore vérifiée reste possible mais s'avoue `probable`/`unresolved`. Idem
--    pour les tables factuelles (`data_status='verified'` exige une release).
-- 5. RLS GÉNÉRATION 2 (comme 028/030/034) : ENABLE + FORCE, policies scopées
--    PAR COMMANDE (SELECT/INSERT/UPDATE/DELETE), DROP POLICY IF EXISTS avant
--    chaque CREATE (rejouable par startup_event en dev). PORTÉE MIXTE : lecture
--    = ligne globale (`company_id IS NULL`) OU tenant ; écriture = tenant
--    UNIQUEMENT (jamais `IS NULL`). L'écriture globale (référentiel canonique)
--    passe par `app.rls_bypass = 'on'` (service admin d'import), jamais par un
--    tenant. C'est le pattern 034 à l'identique.
-- 6. DÉFENSE EN PROFONDEUR APPLICATIVE OBLIGATOIRE EN PLUS : le PostgreSQL de CI
--    se connecte en superuser, qui BYPASSE la RLS (FORCE compris). Chaque
--    requête des services `services/resources/*` porte donc un prédicat de
--    périmètre explicite (`_SCOPE_READ` / `company_id = %s`). Voir
--    MODULE2_RLS_AND_SECURITY.md §3.
--
-- Cette migration NE CRÉE QUE des tables neuves (aucun ALTER d'une table
-- existante) — pas de privilège propriétaire requis, comme 028/030/034
-- (requires_owner=False). AUCUNE donnée factuelle semée : les ressources
-- canoniques (hélium, bois…) sont des DONNÉES chargées par un service d'import
-- (Source Admin / Evidence Kernel), jamais par la migration.
--
-- FK BIGINT vers des PK INTEGER historiques (companies.id est SERIAL/int4) et
-- vers source_releases.id (BIGSERIAL, 028) : valide en PostgreSQL, même geste
-- que 028/030/034.

-- ===========================================================================
-- A. resource_catalog — référentiel canonique (portée mixte)
-- ===========================================================================
-- `company_id` NULLABLE : NULL = ligne canonique globale (lisible par tous les
-- tenants), non-null = extension propre au tenant. La clé de matière du module
-- est cet `id` (FK-validé), en remplacement conceptuel du `material_id TEXT`
-- libre — mais le legacy reste vivant via `resource_aliases` (D-2).
CREATE TABLE IF NOT EXISTS resource_catalog (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT REFERENCES companies(id),
    slug              TEXT NOT NULL,
    name              TEXT NOT NULL,
    name_fr           TEXT,
    primary_family    TEXT NOT NULL DEFAULT 'other',
    description       TEXT,
    data_status       TEXT NOT NULL DEFAULT 'manual',
    source_release_id BIGINT REFERENCES source_releases(id),
    created_by        BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_catalog_family_check CHECK (
        primary_family IN (
            'industrial_gas', 'biomass_fibre', 'energy_fuel',
            'critical_raw_material', 'other'
        )
    ),
    CONSTRAINT resource_catalog_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    -- Pas de fiche « vérifiée » sans release enregistrée.
    CONSTRAINT resource_catalog_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    )
);

-- Unicité du slug : une fois par tenant, une fois en global (partial index sur
-- company_id IS NULL — geste 034 material_groups).
CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_catalog_slug_tenant
    ON resource_catalog (company_id, slug) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_resource_catalog_slug_global
    ON resource_catalog (slug) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_resource_catalog_family ON resource_catalog(primary_family);
CREATE INDEX IF NOT EXISTS idx_resource_catalog_company ON resource_catalog(company_id);

-- ===========================================================================
-- B. resource_aliases — alias legacy & identifiants externes (D-2, portée mixte)
-- ===========================================================================
-- Rapproche le catalogue des identifiants EXISTANTS sans réécrire les tables
-- CRMA : `alias_kind='legacy_material_id'` mappe un ancien `material_id` (030/
-- 034) vers une ressource. L'index de reverse-lookup rend le pont efficace.
CREATE TABLE IF NOT EXISTS resource_aliases (
    id          BIGSERIAL PRIMARY KEY,
    company_id  BIGINT REFERENCES companies(id),
    resource_id BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE,
    alias_kind  TEXT NOT NULL,
    alias_value TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_aliases_kind_check CHECK (
        alias_kind IN ('legacy_material_id', 'cas', 'ec', 'hs_cn', 'reach', 'internal', 'other')
    ),
    CONSTRAINT resource_aliases_uniq UNIQUE (resource_id, alias_kind, alias_value)
);

CREATE INDEX IF NOT EXISTS idx_resource_aliases_lookup ON resource_aliases(alias_kind, alias_value);
CREATE INDEX IF NOT EXISTS idx_resource_aliases_resource ON resource_aliases(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_aliases_company ON resource_aliases(company_id);

-- ===========================================================================
-- C. resource_regulatory_statuses — statut réglementaire SOURCÉ (portée mixte)
-- ===========================================================================
-- Matérialise en base les faits de REGULATORY_SOURCE_MATRIX.md (CRMA/EUDR/
-- REACH/CLP/RED III/CBAM/Euratom/dual-use/ESRS). Une LIGNE par régime : c'est
-- ce qui rend le statut NON EXCLUSIF (aucun booléen). `regime='crma'` pilotera
-- la lignée IRO en aval (D-5, migration 043). `certainty='confirmed'` exige une
-- release (source primaire).
CREATE TABLE IF NOT EXISTS resource_regulatory_statuses (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT REFERENCES companies(id),
    resource_id       BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE,
    regime            TEXT NOT NULL,
    regulation_ref    TEXT,
    list_or_annex     TEXT,
    listing_status    TEXT NOT NULL,
    validity_note     TEXT,
    certainty         TEXT NOT NULL DEFAULT 'probable',
    source_release_id BIGINT REFERENCES source_releases(id),
    verified_on       DATE,
    created_by        BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_regulatory_statuses_regime_check CHECK (
        regime IN (
            'crma', 'eudr', 'reach', 'clp', 'red_iii', 'cbam',
            'euratom', 'dual_use', 'gas_sos', 'esrs', 'other'
        )
    ),
    CONSTRAINT resource_regulatory_statuses_listing_check CHECK (
        listing_status IN (
            'listed', 'not_listed', 'in_scope', 'out_of_scope',
            'in_force', 'adopted_not_applicable', 'proposed', 'delayed'
        )
    ),
    CONSTRAINT resource_regulatory_statuses_certainty_check CHECK (
        certainty IN ('confirmed', 'probable', 'unresolved')
    ),
    -- Aucune classification « confirmée » sans source primaire enregistrée.
    CONSTRAINT resource_regulatory_statuses_sourced_check CHECK (
        certainty <> 'confirmed' OR source_release_id IS NOT NULL
    ),
    CONSTRAINT resource_regulatory_statuses_uniq UNIQUE (
        company_id, resource_id, regime, regulation_ref
    )
);

CREATE INDEX IF NOT EXISTS idx_resource_reg_status_resource
    ON resource_regulatory_statuses(resource_id, regime);
CREATE INDEX IF NOT EXISTS idx_resource_reg_status_company ON resource_regulatory_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_resource_reg_status_release
    ON resource_regulatory_statuses(source_release_id);

-- ===========================================================================
-- D. resource_sector_uses — usages sectoriels (CLASSIFICATION SUPPLY-CHAIN)
-- ===========================================================================
-- Quels secteurs consomment la ressource. ⚠️ SÉCURITÉ (MODULE2_RLS_AND_SECURITY
-- §7) : `use_label`/`criticality_note` décrivent un USAGE-SECTEUR (« aérospatial »,
-- « refroidissement IRM »), JAMAIS une recette, formulation, proportion,
-- paramètre de fabrication, instruction de propergol ni paramètre opérationnel
-- de propulsion. Aucune colonne technique n'existe ici, par conception.
CREATE TABLE IF NOT EXISTS resource_sector_uses (
    id                BIGSERIAL PRIMARY KEY,
    company_id        BIGINT REFERENCES companies(id),
    resource_id       BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE,
    sector_code       TEXT,
    use_label         TEXT NOT NULL,
    criticality_note  TEXT,
    data_status       TEXT NOT NULL DEFAULT 'manual',
    source_release_id BIGINT REFERENCES source_releases(id),
    created_by        BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT resource_sector_uses_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    CONSTRAINT resource_sector_uses_sourced_check CHECK (
        data_status <> 'verified' OR source_release_id IS NOT NULL
    ),
    CONSTRAINT resource_sector_uses_uniq UNIQUE (company_id, resource_id, sector_code, use_label)
);

CREATE INDEX IF NOT EXISTS idx_resource_sector_uses_resource ON resource_sector_uses(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_sector_uses_company ON resource_sector_uses(company_id);

-- ===========================================================================
-- PARTIE 2 — RLS GÉNÉRATION 2 (portée mixte : lecture globale+tenant, écriture tenant)
-- ===========================================================================
-- Policies par commande, DROP avant CREATE. Lecture = ligne globale
-- (company_id IS NULL) OU tenant ; écriture = tenant UNIQUEMENT (jamais IS NULL).

-- ── resource_catalog ────────────────────────────────────────────────────────
ALTER TABLE resource_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_catalog FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_catalog ON resource_catalog;
CREATE POLICY tenant_isolation_resource_catalog ON resource_catalog
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_catalog_insert ON resource_catalog;
CREATE POLICY tenant_isolation_resource_catalog_insert ON resource_catalog
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_catalog_update ON resource_catalog;
CREATE POLICY tenant_isolation_resource_catalog_update ON resource_catalog
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_catalog_delete ON resource_catalog;
CREATE POLICY tenant_isolation_resource_catalog_delete ON resource_catalog
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── resource_aliases ────────────────────────────────────────────────────────
ALTER TABLE resource_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_aliases FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_aliases ON resource_aliases;
CREATE POLICY tenant_isolation_resource_aliases ON resource_aliases
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_aliases_insert ON resource_aliases;
CREATE POLICY tenant_isolation_resource_aliases_insert ON resource_aliases
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_aliases_update ON resource_aliases;
CREATE POLICY tenant_isolation_resource_aliases_update ON resource_aliases
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_aliases_delete ON resource_aliases;
CREATE POLICY tenant_isolation_resource_aliases_delete ON resource_aliases
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── resource_regulatory_statuses ────────────────────────────────────────────
ALTER TABLE resource_regulatory_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_regulatory_statuses FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_regulatory_statuses ON resource_regulatory_statuses;
CREATE POLICY tenant_isolation_resource_regulatory_statuses ON resource_regulatory_statuses
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_regulatory_statuses_insert ON resource_regulatory_statuses;
CREATE POLICY tenant_isolation_resource_regulatory_statuses_insert ON resource_regulatory_statuses
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_regulatory_statuses_update ON resource_regulatory_statuses;
CREATE POLICY tenant_isolation_resource_regulatory_statuses_update ON resource_regulatory_statuses
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_regulatory_statuses_delete ON resource_regulatory_statuses;
CREATE POLICY tenant_isolation_resource_regulatory_statuses_delete ON resource_regulatory_statuses
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── resource_sector_uses ────────────────────────────────────────────────────
ALTER TABLE resource_sector_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_sector_uses FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_resource_sector_uses ON resource_sector_uses;
CREATE POLICY tenant_isolation_resource_sector_uses ON resource_sector_uses
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_sector_uses_insert ON resource_sector_uses;
CREATE POLICY tenant_isolation_resource_sector_uses_insert ON resource_sector_uses
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_sector_uses_update ON resource_sector_uses;
CREATE POLICY tenant_isolation_resource_sector_uses_update ON resource_sector_uses
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_resource_sector_uses_delete ON resource_sector_uses;
CREATE POLICY tenant_isolation_resource_sector_uses_delete ON resource_sector_uses
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ===========================================================================
-- PARTIE 3 — ACCÈS APPLICATIF
-- ===========================================================================
-- Même geste que 028/030/034 : si la migration est appliquée par un rôle admin
-- distinct du rôle applicatif (DATABASE_ADMIN_URL en prod via db-migrate.yml),
-- l'app (rôle carbonco_app) a besoin d'un GRANT explicite sur les nouvelles
-- tables/séquences. No-op si carbonco_app est propriétaire (environnement neuf)
-- ou absent (dev/CI sans ce rôle).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      resource_catalog, resource_aliases, resource_regulatory_statuses,
      resource_sector_uses
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      resource_catalog_id_seq, resource_aliases_id_seq,
      resource_regulatory_statuses_id_seq, resource_sector_uses_id_seq
      TO carbonco_app;
  END IF;
END $$;
