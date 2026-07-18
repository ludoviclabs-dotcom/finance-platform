-- Migration 031 — Énergie & Scope 2 (PR-06A) : fondation « ledger énergie ».
--
-- Phase 5 du PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md (« Scope 2 dual »).
-- Modélise la consommation d'énergie de l'entreprise (compteurs, activités) et
-- les instruments contractuels market-based (REC/GO/PPA/tarif vert) avec leurs
-- allocations, PLUS des métadonnées de facteurs reliant un facteur du catalogue
-- (emission_factors) à une base location/market/residual_mix.
--
-- CE QUI N'EST PAS ICI (PR-06B, migration 032+) : le moteur de calcul Scope 2,
-- les totaux location-based / market-based, les runs de calcul. Cette migration
-- ne crée QUE le ledger de données — aucun calcul, aucun total, aucun LLM,
-- aucune donnée externe réelle ingérée.
--
-- Convention Wave 2 (contrats §7) : toutes les tables sont purement tenant
-- (`company_id BIGINT NOT NULL` — jamais de ligne globale, à la différence du
-- noyau Evidence Kernel 028). RLS gen-2 : ENABLE + FORCE + policies scopées par
-- commande (FOR SELECT/INSERT/UPDATE/DELETE) + garde `app.rls_bypass`, chaque
-- CREATE POLICY précédé d'un DROP POLICY IF EXISTS (rejouable par startup_event,
-- pattern 028). Comme ces tables n'ont pas de ligne globale, la clause de lecture
-- ne porte PAS la branche `company_id IS NULL` du noyau 028 (elle serait morte) :
-- lecture et écriture ont ici le même périmètre (le tenant courant).
--
-- Anti-double-allocation EN BASE (contrats / plan §11) : la somme des
-- `allocated_mwh` par instrument ne peut jamais dépasser son `volume_mwh`
-- (trigger), et un même instrument ne peut être alloué deux fois à la même
-- activité (contrainte UNIQUE). La garde n'est donc pas seulement applicative.

-- ---------------------------------------------------------------------------
-- A. energy_meters — compteurs physiques (électricité, gaz, chaleur, vapeur…)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_meters (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT NOT NULL REFERENCES companies(id),
    site_id       BIGINT REFERENCES sites(id),
    carrier       TEXT NOT NULL,
    meter_code    TEXT NOT NULL,
    label         TEXT,
    unit          TEXT NOT NULL DEFAULT 'MWh',
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT energy_meters_carrier_check CHECK (
        carrier IN ('electricity', 'gas', 'heat', 'steam', 'cooling', 'other')
    ),
    CONSTRAINT energy_meters_code_uniq UNIQUE (company_id, meter_code)
);

CREATE INDEX IF NOT EXISTS idx_energy_meters_company ON energy_meters(company_id);
CREATE INDEX IF NOT EXISTS idx_energy_meters_site ON energy_meters(site_id);
CREATE INDEX IF NOT EXISTS idx_energy_meters_carrier ON energy_meters(company_id, carrier);

-- ---------------------------------------------------------------------------
-- B. energy_activities — donnée d'activité (consommation) par site/vecteur/
--    période. Importée par CSV (gate de revue `review_status`, patron
--    import_screenings). Idempotence d'import EN BASE : la clé naturelle
--    (company_id, meter_id, period_start, period_end) est UNIQUE — réimporter
--    la même période pour le même compteur est un no-op (ON CONFLICT).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_activities (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            BIGINT NOT NULL REFERENCES companies(id),
    meter_id              BIGINT REFERENCES energy_meters(id),
    site_id               BIGINT REFERENCES sites(id),
    carrier               TEXT NOT NULL,
    quantity              NUMERIC NOT NULL,
    unit                  TEXT NOT NULL DEFAULT 'MWh',
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    import_id             TEXT,
    data_status           TEXT NOT NULL DEFAULT 'manual',
    evidence_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    review_status         TEXT NOT NULL DEFAULT 'pending',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT energy_activities_carrier_check CHECK (
        carrier IN ('electricity', 'gas', 'heat', 'steam', 'cooling', 'other')
    ),
    -- Vocabulaire aligné sur observations.data_status (contrats §2).
    CONSTRAINT energy_activities_data_status_check CHECK (
        data_status IN ('verified', 'estimated', 'manual', 'inferred')
    ),
    -- Gate de revue, aligné sur supplier_answers / ReviewStatusBadge (contrats §2/§9).
    CONSTRAINT energy_activities_review_status_check CHECK (
        review_status IN ('pending', 'accepted', 'flagged')
    ),
    CONSTRAINT energy_activities_period_check CHECK (period_end >= period_start),
    CONSTRAINT energy_activities_quantity_check CHECK (quantity >= 0),
    -- Idempotence d'import : une période donnée d'un compteur n'existe qu'une fois.
    CONSTRAINT energy_activities_idempotency_uniq UNIQUE (company_id, meter_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_energy_activities_company ON energy_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_energy_activities_meter ON energy_activities(meter_id);
CREATE INDEX IF NOT EXISTS idx_energy_activities_site ON energy_activities(company_id, site_id);
CREATE INDEX IF NOT EXISTS idx_energy_activities_carrier ON energy_activities(company_id, carrier);
CREATE INDEX IF NOT EXISTS idx_energy_activities_period ON energy_activities(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_energy_activities_review ON energy_activities(company_id, review_status);

-- ---------------------------------------------------------------------------
-- C. contractual_instruments — instruments market-based (REC/GO/PPA/tarif vert).
--    La preuve (certificat) est un evidence_artifact (Evidence Kernel 028).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractual_instruments (
    id                       BIGSERIAL PRIMARY KEY,
    company_id               BIGINT NOT NULL REFERENCES companies(id),
    instrument_type          TEXT NOT NULL,
    carrier                  TEXT NOT NULL DEFAULT 'electricity',
    reference                TEXT,
    volume_mwh               NUMERIC NOT NULL,
    valid_from               DATE NOT NULL,
    valid_to                 DATE NOT NULL,
    geography_code           TEXT,
    certificate_artifact_id  BIGINT REFERENCES evidence_artifacts(id),
    status                   TEXT NOT NULL DEFAULT 'active',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contractual_instruments_type_check CHECK (
        instrument_type IN ('rec', 'go', 'ppa', 'green_tariff')
    ),
    CONSTRAINT contractual_instruments_carrier_check CHECK (
        carrier IN ('electricity', 'gas', 'heat', 'steam', 'cooling', 'other')
    ),
    CONSTRAINT contractual_instruments_status_check CHECK (
        status IN ('active', 'expired', 'cancelled')
    ),
    CONSTRAINT contractual_instruments_volume_check CHECK (volume_mwh >= 0),
    CONSTRAINT contractual_instruments_validity_check CHECK (valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_contractual_instruments_company ON contractual_instruments(company_id);
CREATE INDEX IF NOT EXISTS idx_contractual_instruments_carrier ON contractual_instruments(company_id, carrier);
CREATE INDEX IF NOT EXISTS idx_contractual_instruments_validity ON contractual_instruments(company_id, valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- D. instrument_allocations — allocation d'un instrument à une activité énergie.
--    Anti-double-allocation EN BASE (voir triggers plus bas + UNIQUE ci-dessous).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instrument_allocations (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES companies(id),
    instrument_id       BIGINT NOT NULL REFERENCES contractual_instruments(id),
    energy_activity_id  BIGINT NOT NULL REFERENCES energy_activities(id),
    allocated_mwh       NUMERIC NOT NULL,
    allocated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    allocated_by        BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT instrument_allocations_amount_check CHECK (allocated_mwh > 0),
    -- Un même instrument ne peut être alloué deux fois à la même activité
    -- (empêche la double allocation conflictuelle de la même paire).
    CONSTRAINT instrument_allocations_pair_uniq UNIQUE (instrument_id, energy_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_instrument_allocations_company ON instrument_allocations(company_id);
CREATE INDEX IF NOT EXISTS idx_instrument_allocations_instrument ON instrument_allocations(instrument_id);
CREATE INDEX IF NOT EXISTS idx_instrument_allocations_activity ON instrument_allocations(energy_activity_id);

-- ---------------------------------------------------------------------------
-- E. energy_factor_metadata — relie un facteur (emission_factors, catalogue
--    global INTEGER) à un vecteur/zone/période et une BASE méthodologique.
--    Règle non négociable : une moyenne pays-average n'est JAMAIS market-based
--    (basis ∈ location | market | residual_mix). `source_release_id` si sourcé
--    (facteur licencié tracé par une release du noyau).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_factor_metadata (
    id                 BIGSERIAL PRIMARY KEY,
    company_id         BIGINT NOT NULL REFERENCES companies(id),
    ef_id              INTEGER REFERENCES emission_factors(id),
    carrier            TEXT NOT NULL,
    geography_code     TEXT,
    basis              TEXT NOT NULL,
    valid_from         DATE,
    valid_to           DATE,
    source_release_id  BIGINT REFERENCES source_releases(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT energy_factor_metadata_carrier_check CHECK (
        carrier IN ('electricity', 'gas', 'heat', 'steam', 'cooling', 'other')
    ),
    CONSTRAINT energy_factor_metadata_basis_check CHECK (
        basis IN ('location', 'market', 'residual_mix')
    )
);

CREATE INDEX IF NOT EXISTS idx_energy_factor_metadata_company ON energy_factor_metadata(company_id);
CREATE INDEX IF NOT EXISTS idx_energy_factor_metadata_ef ON energy_factor_metadata(ef_id);
CREATE INDEX IF NOT EXISTS idx_energy_factor_metadata_lookup
    ON energy_factor_metadata(company_id, carrier, geography_code, basis);

-- ---------------------------------------------------------------------------
-- RLS gen-2 — ENABLE + FORCE + policies scopées par commande + rls_bypass.
-- Tables purement tenant (company_id NOT NULL) : pas de branche de lecture
-- globale (`company_id IS NULL`), lecture = écriture = tenant courant. Chaque
-- CREATE POLICY précédé d'un DROP POLICY IF EXISTS (idempotence rejouable).
-- ---------------------------------------------------------------------------

-- ── energy_meters ───────────────────────────────────────────────────────────
ALTER TABLE energy_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_meters FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_energy_meters ON energy_meters;
CREATE POLICY tenant_isolation_energy_meters ON energy_meters
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_meters_insert ON energy_meters;
CREATE POLICY tenant_isolation_energy_meters_insert ON energy_meters
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_meters_update ON energy_meters;
CREATE POLICY tenant_isolation_energy_meters_update ON energy_meters
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_meters_delete ON energy_meters;
CREATE POLICY tenant_isolation_energy_meters_delete ON energy_meters
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── energy_activities ───────────────────────────────────────────────────────
ALTER TABLE energy_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_activities FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_energy_activities ON energy_activities;
CREATE POLICY tenant_isolation_energy_activities ON energy_activities
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_activities_insert ON energy_activities;
CREATE POLICY tenant_isolation_energy_activities_insert ON energy_activities
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_activities_update ON energy_activities;
CREATE POLICY tenant_isolation_energy_activities_update ON energy_activities
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_activities_delete ON energy_activities;
CREATE POLICY tenant_isolation_energy_activities_delete ON energy_activities
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── contractual_instruments ─────────────────────────────────────────────────
ALTER TABLE contractual_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractual_instruments FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_contractual_instruments ON contractual_instruments;
CREATE POLICY tenant_isolation_contractual_instruments ON contractual_instruments
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_contractual_instruments_insert ON contractual_instruments;
CREATE POLICY tenant_isolation_contractual_instruments_insert ON contractual_instruments
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_contractual_instruments_update ON contractual_instruments;
CREATE POLICY tenant_isolation_contractual_instruments_update ON contractual_instruments
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_contractual_instruments_delete ON contractual_instruments;
CREATE POLICY tenant_isolation_contractual_instruments_delete ON contractual_instruments
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── instrument_allocations ──────────────────────────────────────────────────
ALTER TABLE instrument_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instrument_allocations FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_instrument_allocations ON instrument_allocations;
CREATE POLICY tenant_isolation_instrument_allocations ON instrument_allocations
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_instrument_allocations_insert ON instrument_allocations;
CREATE POLICY tenant_isolation_instrument_allocations_insert ON instrument_allocations
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_instrument_allocations_update ON instrument_allocations;
CREATE POLICY tenant_isolation_instrument_allocations_update ON instrument_allocations
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_instrument_allocations_delete ON instrument_allocations;
CREATE POLICY tenant_isolation_instrument_allocations_delete ON instrument_allocations
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ── energy_factor_metadata ──────────────────────────────────────────────────
ALTER TABLE energy_factor_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_factor_metadata FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_energy_factor_metadata ON energy_factor_metadata;
CREATE POLICY tenant_isolation_energy_factor_metadata ON energy_factor_metadata
  FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_factor_metadata_insert ON energy_factor_metadata;
CREATE POLICY tenant_isolation_energy_factor_metadata_insert ON energy_factor_metadata
  FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_factor_metadata_update ON energy_factor_metadata;
CREATE POLICY tenant_isolation_energy_factor_metadata_update ON energy_factor_metadata
  FOR UPDATE
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );
DROP POLICY IF EXISTS tenant_isolation_energy_factor_metadata_delete ON energy_factor_metadata;
CREATE POLICY tenant_isolation_energy_factor_metadata_delete ON energy_factor_metadata
  FOR DELETE USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
  );

-- ---------------------------------------------------------------------------
-- Anti-double-allocation EN BASE — trigger sur instrument_allocations.
-- Refuse toute INSERT/UPDATE qui porterait la somme des `allocated_mwh` d'un
-- instrument au-delà de son `volume_mwh` (survente de garanties). La somme est
-- recalculée dans la transaction (voit les lignes déjà validées) ; sur UPDATE,
-- la ligne courante (OLD) est exclue pour ne pas se compter deux fois.
--
-- Le trigger s'exécute dans la transaction de l'appelant, où get_db(company_id)
-- a posé `app.current_company_id` (SET LOCAL). Sous FORCE ROW LEVEL SECURITY, le
-- propriétaire de la table RESTE soumis à la RLS : SECURITY DEFINER ne la
-- contourne donc PAS (seul un superuser ou un rôle BYPASSRLS le ferait). Ce
-- contournement n'est pas nécessaire ici — la policy `company_id =
-- app.current_company_id` laisse le trigger lire les lignes du tenant courant,
-- et comme un instrument et ses allocations sont tous du MÊME tenant, la somme
-- couvre bien la totalité. SECURITY DEFINER + search_path épinglé sont conservés
-- pour un rôle et un search_path d'exécution stables, pas pour un bypass de RLS.
-- ATTENTION couverture : le PostgreSQL de CI se connecte en superuser (bypass RLS
-- total), donc `migration-tests` n'exerce PAS ce chemin FORCE-RLS ; la correction
-- repose sur l'invariant mono-tenant + le SET LOCAL systématique du service, pas
-- sur le test. La garde primaire d'anti-survente est aussi appliquée côté service
-- (instruments_service.allocate_instrument) ; ce trigger en est le filet base.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION energy_allocation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_volume  NUMERIC;
  v_already NUMERIC;
BEGIN
  SELECT volume_mwh INTO v_volume
  FROM contractual_instruments
  WHERE id = NEW.instrument_id;

  IF v_volume IS NULL THEN
    RAISE EXCEPTION 'energy_scope2: instrument % introuvable pour allocation', NEW.instrument_id;
  END IF;

  SELECT COALESCE(SUM(allocated_mwh), 0) INTO v_already
  FROM instrument_allocations
  WHERE instrument_id = NEW.instrument_id
    AND (TG_OP <> 'UPDATE' OR id <> OLD.id);

  IF v_already + NEW.allocated_mwh > v_volume THEN
    RAISE EXCEPTION
      'energy_scope2: double allocation refusée — instrument % : % déjà alloués + % demandés dépassent le volume % MWh',
      NEW.instrument_id, v_already, NEW.allocated_mwh, v_volume;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instrument_allocations_guard ON instrument_allocations;
CREATE TRIGGER trg_instrument_allocations_guard
  BEFORE INSERT OR UPDATE ON instrument_allocations
  FOR EACH ROW EXECUTE FUNCTION energy_allocation_guard();

-- ---------------------------------------------------------------------------
-- Accès applicatif — même geste que 027/028 : si la migration est appliquée
-- par un rôle admin distinct du rôle applicatif (DATABASE_ADMIN_URL en prod via
-- db-migrate.yml), l'app (DATABASE_URL, rôle carbonco_app) a besoin d'un GRANT
-- explicite. No-op si carbonco_app est déjà propriétaire ou absent (dev/CI).
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      energy_meters, energy_activities, contractual_instruments,
      instrument_allocations, energy_factor_metadata
      TO carbonco_app;
    GRANT USAGE, SELECT ON SEQUENCE
      energy_meters_id_seq, energy_activities_id_seq, contractual_instruments_id_seq,
      instrument_allocations_id_seq, energy_factor_metadata_id_seq
      TO carbonco_app;
  END IF;
END $$;
