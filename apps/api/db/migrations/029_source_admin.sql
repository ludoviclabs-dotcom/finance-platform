-- Migration 029 — Source Admin (PR-04) : vue de fraîcheur des sources.
--
-- Phase 3 de PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §20 — « Registre
-- de sources et premier import maîtrisé ». PR-04 CONSOMME surtout le schéma
-- Evidence Kernel (028) ; le seul objet de schéma neuf est cette vue, qui
-- agrège par source sa dernière release et l'état de son cycle de vie pour
-- `GET /health/intelligence` et la page de fraîcheur front.
--
-- Aucune nouvelle TABLE : la source démo `CARBONCO_DEMO_SNAPSHOT`, sa release
-- et ses observations sont des DONNÉES, créées via les services PR-03 + le CLI
-- d'import (checksum, licence, immutabilité, RLS corrects) — jamais un INSERT
-- en dur dans une migration (WAVE_2_INTERFACE_CONTRACTS.md §4, note « Le
-- snapshot démo est une DONNÉE, pas du schéma »).
--
-- ─────────────────────────────────────────────────────────────────────────
-- PIÈGE RLS (contrats §7, risque du plan §11) : une vue s'exécute par défaut
-- avec les droits de son PROPRIÉTAIRE (`security_definer` implicite), ce qui
-- BYPASSERAIT la RLS des tables sous-jacentes et exposerait les sources d'un
-- tenant à un autre. `WITH (security_invoker = true)` (PostgreSQL ≥ 15 ; Neon
-- et le conteneur CI tournent en 16) force l'application de la RLS de
-- `source_registry`/`source_releases` avec les droits de l'APPELANT — la vue
-- n'affiche donc que ce que l'appelant a le droit de lire (ses sources + les
-- sources globales `company_id IS NULL`). Défense en profondeur en plus :
-- `freshness_service` ajoute son prédicat de périmètre explicite à chaque
-- requête sur cette vue (même raison qu'en 028 — le PostgreSQL de CI se
-- connecte en superuser et bypasse toute RLS, `security_invoker` compris).
-- ─────────────────────────────────────────────────────────────────────────

-- Rejouable (startup_event/run_migrations en dev local, fixtures de test) :
-- CREATE OR REPLACE VIEW est idempotent tant que la liste de colonnes ne
-- rétrécit pas. `security_invoker` est posé via WITH (...) — conservé par le
-- REPLACE.
CREATE OR REPLACE VIEW source_freshness
WITH (security_invoker = true) AS
SELECT
    s.id                            AS source_id,
    s.company_id                    AS company_id,
    s.code                          AS code,
    s.publisher                     AS publisher,
    s.title                         AS title,
    s.source_type                   AS source_type,
    s.active                        AS active,
    -- Colonnes de licence : la vue les expose pour que freshness_service
    -- passe directement la ligne à license_policy.evaluate() sans requête
    -- supplémentaire (mêmes clés que celles lues par la policy).
    s.automated_access_allowed      AS automated_access_allowed,
    s.storage_allowed               AS storage_allowed,
    s.commercial_use_allowed        AS commercial_use_allowed,
    s.redistribution_allowed        AS redistribution_allowed,
    s.derived_use_allowed           AS derived_use_allowed,
    s.display_allowed               AS display_allowed,
    s.attribution_text              AS attribution_text,
    r.last_release_id               AS last_release_id,
    r.last_release_key              AS last_release_key,
    r.last_release_status           AS last_release_status,
    r.last_release_at               AS last_release_at,
    COALESCE(r.published_release_count, 0)   AS published_release_count,
    COALESCE(r.total_release_count, 0)       AS total_release_count
FROM source_registry s
LEFT JOIN LATERAL (
    -- Dernière release de la source (par date effective : published_at si
    -- publiée, sinon retrieved_at), + compteurs de cycle de vie. LATERAL pour
    -- une seule ligne par source, corrélée sur s.id.
    SELECT
        sr.id           AS last_release_id,
        sr.release_key  AS last_release_key,
        sr.status       AS last_release_status,
        COALESCE(sr.published_at, sr.retrieved_at) AS last_release_at,
        (SELECT count(*) FROM source_releases p
          WHERE p.source_id = s.id AND p.status = 'published') AS published_release_count,
        (SELECT count(*) FROM source_releases t
          WHERE t.source_id = s.id) AS total_release_count
    FROM source_releases sr
    WHERE sr.source_id = s.id
    ORDER BY COALESCE(sr.published_at, sr.retrieved_at) DESC NULLS LAST, sr.id DESC
    LIMIT 1
) r ON TRUE;

-- Accès applicatif — même geste que 028 : si la migration est appliquée par un
-- rôle admin distinct (DATABASE_ADMIN_URL en prod via db-migrate.yml), l'app
-- (carbonco_app) a besoin d'un GRANT SELECT explicite sur la vue. No-op si
-- carbonco_app est déjà propriétaire (env neuf) ou absent (dev/CI sans ce rôle).
-- Une vue security_invoker respecte de toute façon la RLS des tables sous
-- l'identité de carbonco_app — le GRANT ne donne que le droit de SELECT la vue,
-- pas de contourner l'isolation.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app') THEN
    GRANT SELECT ON source_freshness TO carbonco_app;
  END IF;
END $$;
