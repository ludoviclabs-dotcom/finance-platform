-- Migration 027 — Sites physiques : modélisation multi-sites pour la MACC.
--
-- Un site = une implantation physique (usine, entrepôt, datacenter). Chaque
-- levier MACC peut être rattaché à un site (actions.site_id NULLABLE — NULL =
-- « entreprise entière », comportement historique intact). MACC filtrable par
-- site ; le rollup groupe = la MACC sans filtre. La trajectoire reste au niveau
-- entreprise (facts_current n'a pas de dimension site — baseline entreprise).
--
-- RLS : pattern 009 (ENABLE + FORCE + NULLIF + rls_bypass), PAS le pattern 020
-- (ENABLE seul) — dans un environnement neuf cette table est créée par
-- carbonco_app qui en devient PROPRIÉTAIRE, et un propriétaire ignore le RLS
-- non forcé. FORCE est donc requis pour l'isolation multi-tenant.
--
-- Prod : les tables existantes appartiennent à neondb_owner → carbonco_app ne
-- peut pas exécuter l'ALTER TABLE actions. Appliquer ce fichier MANUELLEMENT
-- dans le Neon SQL editor (même flow que le bootstrap du 04/07/2026). Le GRANT
-- conditionnel ci-dessous couvre ce cas (l'app garde l'accès à la table).

CREATE TABLE IF NOT EXISTS sites (
    id            BIGSERIAL PRIMARY KEY,
    company_id    INTEGER NOT NULL,
    name          TEXT NOT NULL,
    location      TEXT,
    naf_code      TEXT,
    activity_type TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sites_company_name_uniq UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);

ALTER TABLE actions ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES sites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_actions_site ON actions(company_id, site_id);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites FORCE  ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sites' AND policyname='tenant_isolation_sites') THEN
    CREATE POLICY tenant_isolation_sites ON sites
      USING (current_setting('app.rls_bypass', true) = 'on'
             OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sites' AND policyname='tenant_isolation_sites_insert') THEN
    CREATE POLICY tenant_isolation_sites_insert ON sites
      FOR INSERT WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
             OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::int);
  END IF;
END $$;

-- Accès applicatif quand la migration est appliquée par neondb_owner (prod).
-- No-op utile : si carbonco_app est déjà propriétaire (environnement neuf),
-- le GRANT ne change rien.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sites TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE sites_id_seq TO carbonco_app;
  END IF;
END $$;
