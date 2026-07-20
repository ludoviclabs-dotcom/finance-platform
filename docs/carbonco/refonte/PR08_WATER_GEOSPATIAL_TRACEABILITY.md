# PR-08 — Traçabilité : Géospatial, ledger eau et screening hydrique auditable

**Branche :** `feat/geospatial-sites-water` · **Base :** `origin/master` (`1de1e56`, migrations 001→035)
**Périmètre livré :** tranches A **et** B dans la même PR — migrations **036** (fondation, `requires_owner`) et **037** (screening/cibles/actions).
**Plans de référence :** `PR08_WATER_GEOSPATIAL_IMPLEMENTATION_PLAN.md`, `WAVE_4_INTERFACE_CONTRACTS.md`. Les décisions validées ci-dessous **priment** sur ces documents là où elles divergent.

---

## 1. Déviations assumées par rapport aux plans

| Sujet | Plan | Réalisé | Justification |
|---|---|---|---|
| **Numérotation** | Les docs Wave 4 réservaient 036=géo (PR-08A seule), 037=biodiversité, 038=IRO | **PR-08 = 036 ET 037** ; PR-09 → 038/039 ; PR-10 → 040 | Re-plan validé (mission) : PR-08 livre ses deux tranches ensemble. Règle Wave 2 §10 inchangée : le numéro réel est confirmé par `command=plan` avant apply. |
| **PostGIS** | « Question ouverte », lean PostGIS avec repli | **PAS de PostGIS, décision ferme** (voir §2) | Décision validée de la mission — le repli documenté DEVIENT la méthode nominale, nommée par `method_code`. |
| **`water_imports` (table)** | Non listée par le plan §5 | Créée (036) | Le plan exigeait l'idempotence « patron `purchase_import_service` » ; l'idempotence de CONTENU (sha256) exige une table d'import portant `UNIQUE(company_id, sha256)` — le plan citait d'ailleurs `import_id` sur `water_activities` sans définir sa cible. |
| **Clé naturelle de `water_activities`** | `(company_id, site_id, activity_type, period_start, period_end)` | + `source_type` dans l'unicité | Un site peut prélever la même période en eau de surface ET au réseau : exclure `source_type` fusionnerait silencieusement deux flux physiques distincts. |
| **`services/geo/geocode_service.py`** | Plan §6 : adaptateur `SourceAdapter` + `FakeAdapter` | Pas d'infrastructure d'adaptateur | Aucun appel réseau n'est permis : `provider`/`provider_ref` sont des métadonnées d'audit, les candidats viennent d'une saisie manuelle/fixture. Une hiérarchie d'adaptateurs sans aucun adaptateur réel serait du code mort ; le gate (la partie qui compte) est intégral. |
| **Carte Mapbox** | Plan §8 : carte de revue Mapbox + réouverture CSP `proxy.ts` | **Aucune carte externe** — représentation géographique textuelle (coordonnées, précision, statut, bbox) | Mission : « map-free geographic representation ». Bénéfice direct : aucun domaine à ouvrir dans la CSP (piège connu `/materials` évité par construction), aucune dépendance front nouvelle. |
| **CLI d'ingestion** | `scripts/intelligence/import_geospatial_dataset.py` | `apps/api/scripts/import_water_risk_areas.py` | Le dossier `scripts/intelligence/` n'existe pas ; les scripts opérateur vivent à plat dans `apps/api/scripts/` (précédent réel du dépôt). |
| **Page sites** | « localiser la page sites existante » | Aucune page `(app)/sites` n'existe (vérifié) → nouvelles pages `/sites-geo` et `/water` | Le router `/sites` v1 (GET/POST) reste inchangé ; l'extension est portée par des routes neuves. |
| **Entrée sidebar** | non spécifié | Pas d'entrée sidebar | Précédent PR-07 : la page BETA `/crma` n'a pas d'entrée sidebar non plus ; les pages sont accessibles par URL + `feature-status.json` (`href`). |

## 2. Décision géospatiale : PAS de PostGIS

- **Aucun** `CREATE EXTENSION`, aucun type `geography`/`geometry`, aucun `ST_*` — vérifié par test (`test_pr08_migrations_contain_no_postgis_reference`, qui scanne le code exécutable des fichiers 036/037).
- Coordonnées canoniques : `latitude`/`longitude NUMERIC(9,6)` (bornes CHECK en base).
- Zones : `bbox_min_lat/max_lat/min_lon/max_lon` (**pré-filtre uniquement**, indexé) + `boundary_geojson JSONB` (GeoJSON `Polygon`/`MultiPolygon`, anneaux intérieurs/trous inclus), la bbox étant **dérivée** de la géométrie par `compute_bbox` — jamais saisie à la main.
- Moteur pur et RÉUTILISABLE : `apps/api/services/calculations/geo.py` (aucune I/O, aucune horloge, déterministe). **PR-09 doit l'importer, jamais le recopier.**
- **Codes de méthode (vocabulaire fermé, CHECK en base)** : `geojson_point_in_polygon_v1` (résultat), `geojson_bbox_prefilter_v1` (pré-filtre — n'est jamais un résultat), `manual_coordinates_v1` (saisie de coordonnées). Jamais présentés comme ST_Intersects.
- PostGIS reste une **optimisation future optionnelle** (migration dédiée + bascule de `method_code` explicite) — pas un prérequis, pas un fallback silencieux.

### Convention de frontière (testée)

Ray-casting pair/impair avec **frontière = intérieur** (`on-boundary = inside`) : un site exactement sur une arête **ou un sommet** d'une zone est DANS la zone ; le **bord d'un trou** appartient au polygone (donc dedans) ; l'intérieur strict d'un trou est dehors. Choix de précaution : un point limite est signalé pour revue humaine plutôt qu'exclu silencieusement. Tests : arête, sommet, bord de trou, intérieur de trou, MultiPolygon, faux positif bbox éliminé.

## 3. Migration 036 — `requires_owner=true` (pourquoi)

`ALTER TABLE sites` : `sites` (027) a été appliquée manuellement en production (Neon SQL Editor, 2026-07-04) et appartient à `neondb_owner` — `carbonco_app` ne peut pas l'altérer. Précédent direct : 027 elle-même (`ALTER TABLE actions`). Chemin d'application : `DATABASE_ADMIN_URL` + `mark-manual-verified`, jamais le chemin automatique. Conséquences testées : `plan` → `actions["036"] == "blocked_manual"`, `has_blocking_issues=True` ; `baseline` sur base vide → `manual_required` écrit pour **027 ET 036** (`written_count == 2`).

Contenu 036 : colonnes géo nullables + CHECK sur `sites` (dont `sites_geocode_accepted_check` : jamais d'acceptation anonyme) ; `site_geocode_candidates` (append-only par **trigger** : seule la revue `proposed→accepted/rejected` est permise, DELETE refusé) ; `water_imports` ; `water_activities` ; `water_permits` ; `water_risk_areas` (`source_release_id NOT NULL` — une zone sans release est impossible ; portée mixte tenant/globale, motif 034). RLS gen-2 sur les 5 tables neuves ; la RLS 027 de `sites` n'est PAS retro-modifiée (contrats Wave 4 §7.2) mais couvre automatiquement les colonnes ajoutées. GRANT conditionnels `carbonco_app` + séquences.

## 4. Migration 037 — screening/cibles/actions (`requires_owner=false`)

Tables neuves uniquement : `site_water_screenings` (snapshot d'entrée + résultat **immuables par trigger**, précédent 033 ; `risk_category` et `confidence` en **deux colonnes** avec CHECK séparés, précédent 034 ; `iro_signal` = signal humain avec justification/auteur/date obligatoires par CHECK — jamais une décision, aucune table `*_iro_candidates`, contrats §10) ; `water_targets` ; `water_actions` (`expected_reduction_m3` = intention déclarée, jamais appliquée à un résultat). RLS gen-2 tenant stricte, GRANT conditionnels.

## 5. Règles du moteur de screening (toutes testées)

- **Refus explicites, jamais silencieux** : position non `accepted` (le gate s'applique aussi en lecture : `get_accepted_position` est la seule lecture autorisée) ; précision `country` ; référentiel vide (« pas de donnée ≠ pas de risque ») ; licence sans `allow_derived_use` sur une zone candidate (refus **global** nommant les sources — exclure ces zones en silence fausserait le résultat).
- **Risque ≠ confiance** : le risque = max ordinal des zones appariées ; données périmées (`stale`, seuil 365 j sur `retrieved_at`) et précision dégradent **la confiance uniquement** — testé dans les deux sens.
- **Reproductibilité** : snapshot canonique (trié, sans horloge) + `input_fingerprint` sha256 ; mêmes entrées ⇒ mêmes sorties octet pour octet ; recalculer = un **nouveau** run (l'ancien est immuable).
- « Aucune zone appariée » → `risk_category=NULL` + warning explicite, `coverage_pct=NULL` — jamais rendu comme risque nul (backend ET frontend).
- Enveloppe analytique **partagée** (`models/analytics.py::AnalyticalEnvelope[WaterScreeningData]`) — import direct, conformément à Wave 4 §9 (correction de la dérive PR-07).

## 6. Protection « schéma pas encore migré » (design + preuve)

La production déploie le code AVANT l'application de 036/037 (036 = étape manuelle Neon). Design : `routers/_errors.py::schema_ready_guard()` (context manager, additif — aucun module existant modifié fonctionnellement) intercepte les SQLSTATE `42P01` (undefined_table) et `42703` (undefined_column) via `pgcode` et lève `HTTPException(503, detail="schema_not_ready")`. **Toutes** les routes neuves (`/water/*`, `/sites/geo`, `/sites/{id}/geocode-candidates*`, `/sites/{id}/geocode/flag`) l'utilisent ; les routes existantes (`GET/POST /sites`) ne sélectionnent AUCUNE colonne 036 et restent intactes. Toute autre exception repart inchangée (pas de 503 fourre-tout).

Preuve : `tests/test_water_schema_not_ready.py` (DB-gated) réinitialise le schéma à 001-035 exactement, puis vérifie : 503 `schema_not_ready` sur les deux familles de routes (UndefinedTable ET UndefinedColumn), et non-régression de `GET/POST /sites` pendant la fenêtre. Ce module est inscrit **en dernier** du job `migration-tests` (il réinitialise le schéma partagé du conteneur). Frontend : `SchemaNotReadyError` → « initialisation du schéma en cours » sur `/water` et `/sites-geo`.

## 7. Gates de revue humaine

- Géocodage : candidat `proposed` → revue analyste (`accepted`/`rejected`), réviseur = utilisateur du JWT ; l'acceptation promeut `sites.latitude/longitude` ; la **saisie manuelle passe par le même gate** ; `flag` remet une position acceptée hors calculs. Aucune coordonnée utilisable avant `accepted` (testé service + API + moteur).
- Ledger eau : imports (`pending→validated/rejected`, un rejet marque `flagged` les activités), activités, permis, cibles, actions — vocabulaire unique `pending/accepted/flagged` (030/031).

## 8. Ledger — arithmétique et sémantique

38 fichiers `.sql` (008b compris) : `len(versions) == 38` ; `written_count` plein = **39** (000 + 38) aux 4 endroits ; base vide = **2** écritures `manual_required` (027 + 036) ; `build_full_db` → `apply_upto("037")` ; fixtures de domaine (energy/procurement 035, scope2 033, intelligence 029, crma 034) inchangées — leurs docstrings pinnent un plafond de domaine, pas le corpus complet. Sondes `_probe_036`/`_probe_037` enregistrées (colonnes, tables, FORCE RLS, triggers append-only/immutabilité, CHECK porteurs de règles).

## 9. Ce qui n'est prouvé qu'en CI

Poste local sans PostgreSQL/Docker : **tous les tests DB-gated** (`test_sites_geo`, `test_water_ledger`, `test_water_screening_api`, `test_water_schema_not_ready`, + corpus ledger/probes) skippent localement. La preuve d'exécution est le log du job `migration-tests` (invocation pytest + compteurs). Les tests purs (géométrie 25, moteur screening 14) et le corpus sans DB passent localement.

## 10. Hors périmètre (inchangé)

Pas de contenu PR-09/PR-10 (biodiversité, table `iros`) ; pas d'ingestion externe réelle (toutes les zones de test sont fictives et le disent) ; pas de LLM ; pas de fusion `supplier_sites` ; pas de retrofit RLS de `sites` 027 ; pas d'écriture de production ; PostGIS = optimisation future optionnelle documentée.

## 11. Post-merge (opérateur)

1. Backup ; 2. `db-migrate.yml` → `plan` (attendu : 036 `blocked_manual`, 037 `apply`) ; 3. appliquer **036 manuellement** via `DATABASE_ADMIN_URL`/Neon SQL Editor puis `mark-manual-verified 036` ; 4. `apply` (037) ; 5. `verify` + `/health/schema` `up_to_date:true`, `schema_version:"037"` ; 6. vérifier que `/water` et `/sites-geo` sortent de « initialisation du schéma en cours » ; 7. observation 24-48h (GRANTs `carbonco_app`, non-régression `/sites`, `energy_meters`, `actions`).
