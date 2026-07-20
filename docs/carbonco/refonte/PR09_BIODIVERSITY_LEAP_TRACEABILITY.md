# PR-09 — Traçabilité : Biodiversité, TNFD LEAP et risques nature auditables

**Branche :** `feat/nature-leap` · **Base :** `origin/master` (`09d3358`, migrations 001→037, Waves 1-3 + PR-08 mergées)
**Périmètre livré :** tranches A **et** B dans la même PR — migrations **038** (fondation Locate/Evaluate, `requires_owner=false`) et **039** (Assess/Prepare : risques, opportunités, actions, brouillons TNFD, `requires_owner=false`).
**Plans de référence :** `PR09_BIODIVERSITY_LEAP_IMPLEMENTATION_PLAN.md`, `WAVE_4_INTERFACE_CONTRACTS.md`, et **précédent direct** `PR08_WATER_GEOSPATIAL_TRACEABILITY.md`. Les décisions validées ci-dessous **priment** sur ces documents là où elles divergent.

---

## 1. Déviations assumées par rapport aux plans

| Sujet | Plan | Réalisé | Justification |
|---|---|---|---|
| **Numérotation** | Le plan PR-09 réservait `037` (avant que PR-08 tranche B ne le prenne réellement) ; `WAVE_4_INTERFACE_CONTRACTS.md` §13 réservait `037` à PR-09 et `038` à PR-10 | **PR-09 = 038 ET 039** ; PR-10 → numéro à confirmer au merge | État réel du dépôt vérifié à l'ouverture de la branche : 38 fichiers déjà mergés (001-037, PR-08 complète). Même discipline que PR-08 l'a déjà appliquée pour sa propre re-numérotation (036/037 au lieu du 036 seul initialement prévu). Le numéro réel reste confirmé par `command=plan` avant apply. |
| **`site_nature_intersections` : `relation_kind`/`distance_km`** | Le plan §5 esquissait `relation_kind TEXT` (intersects/within/buffer_km) et `distance_km NUMERIC` | **`matched BOOLEAN` + `bbox_candidate BOOLEAN`**, miroir exact du contrat de retour de `geo.match_point_to_area` | `services/calculations/geo.py` ne calcule PAS de distance géodésique ni de relation `buffer_km` — il n'expose qu'un point-dans-polygone exact (frontière = intérieur) et un pré-filtre bbox. Un point n'a pas de notion géométrique de « within » distincte de « intersects ». Inventer `relation_kind`/`distance_km` aurait exigé soit d'étendre `geo.py` avec une fonctionnalité non spécifiée et non testée par PR-08, soit de la dupliquer localement — les deux sont exclus par la règle « réutiliser, ne jamais dupliquer ». Le champ FK est nommé `feature_id` (repris tel quel du plan). |
| **`nature_features.sensitivity` défaut** | Plan §5 : `DEFAULT 'public'` | Conservé tel quel (`'public'`), MÊME vocabulaire que `evidence_artifacts.sensitivity` (028) qui défaut à `'internal'` | Choix délibéré, pas un oubli : un référentiel de zones (aires protégées, KBA) est majoritairement de connaissance publique, contrairement à une pièce justificative interne (`evidence_artifacts`). Le vocabulaire (`public/internal/confidential/restricted`) est identique ; seul le défaut diffère, par domaine. |
| **`leap_assessments.status` vs `review_status` par ligne** | Le plan ne distinguait pas explicitement les deux | **Deux vocabulaires séparés, intentionnellement** : `leap_assessments.status` (`draft/under_review/approved`, motif document `crma_article24_assessments`) pour le dossier LUI-MÊME ; `review_status` (`pending/accepted/flagged`) sur CHAQUE ligne de fait (intersections, dépendances, impacts, risques, opportunités, actions) | Un dossier LEAP est un document à faire approuver dans son ensemble (comme un rapport Article 24) ; une ligne de fait individuelle a un cycle de revue plus léger (accepter/signaler). Fusionner les deux aurait empêché d'approuver un dossier contenant encore des lignes `pending`. |
| **`nature_risks`/`nature_opportunities` : composantes** | Plan §5/§8 indicatif, pas de liste de composantes figée | **3 composantes risque** (`dependency_exposure`, `impact_severity`, `site_sensitivity`) et **2 composantes opportunité** (`positive_impact_potential`, `dependency_leverage`), toutes dérivées de données déjà en base (038) — aucune nouvelle table de saisie | Garde le scope proportionné : les composantes exploitent directement `nature_dependencies`/`nature_impacts`/`site_nature_intersections` ACCEPTÉS plutôt que d'inventer un nouveau formulaire de saisie de composantes ad hoc. `likelihood` n'est PAS une composante calculée : c'est une entrée humaine transmise telle quelle (voir §5). |
| **Carte Mapbox pour Locate** | Plan §10 : « Carte Locate » | **Aucune carte externe** — tableau/listes textuelles (référentiel, intersections, dossiers) | Même décision que PR-08 (§10.1 de sa traçabilité) : représentation géographique SANS carte externe évite d'ouvrir un domaine CSP (`apps/carbon/proxy.ts`) et une dépendance front nouvelle. PR-08 a déjà tranché « map-free » pour ce même domaine géospatial ; PR-09 le réutilise, ne re-décide pas la question. |
| **`MethodBadge`/`ConfidenceBadge` réutilisés** | `WAVE_4_INTERFACE_CONTRACTS.md` §12 anticipait leur création par le screening eau (PR-08 tranche B) | **Ni `/water` ni `/crma` ne les utilisent réellement** (vérifié en lisant le code : chips locales inline `MethodChip`/`StatusChip`) | Le contrat anticipait un besoin qui ne s'est pas matérialisé tel quel. PR-09 suit la pratique RÉELLE des deux dernières pages du domaine (chips locales inline, `QualitativeChip`/`ReviewChip` dans `app/(app)/nature/page.tsx`), pas la prédiction du contrat. |
| **Entrée sidebar** | Non spécifié | Pas d'entrée sidebar (mais entrée `pageConfig` du header ajoutée) | Précédent RÉEL vérifié : ni `/water` ni `/crma` n'ont d'entrée dans `components/layout/sidebar.tsx::navGroups` — accessibles par URL directe + `feature-status.json` (`href`). En revanche `/crma` A une entrée dans `app/(app)/layout.tsx::pageConfig` (titre de page) alors que `/water` n'en a pas (omission probable côté PR-08, pas un choix documenté) — PR-09 suit le choix le plus complet (`crma`) plutôt que l'oubli (`water`). |
| **CLI d'ingestion** | Plan §12 : `apps/api/scripts/intelligence/import_geospatial_dataset.py` (réutilisé/étendu depuis PR-08) | `apps/api/scripts/import_nature_features.py`, NOUVEAU fichier, structure calquée sur `import_water_risk_areas.py` | Le chemin `scripts/intelligence/import_geospatial_dataset.py` cité par le plan n'existe PAS dans le dépôt réel (PR-08 a créé `scripts/import_water_risk_areas.py`, à plat dans `apps/api/scripts/`) — même correction que PR-08 avait déjà appliquée pour la même raison. |
| **ESRS E4 (`feature-status.json`)** | Non spécifié | La ligne `esrs[].id="ESRS E4"` N'EST PAS passée à un statut différent de `"planifie"` | Vérifié : PR-08 n'a PAS fait passer la ligne `esrs[].id="ESRS E3"` à `"beta"` malgré la livraison complète du module eau — cette ligne suit un critère de disponibilité export CSRD distinct de `features[].statut`. Seule `features[]` reçoit la nouvelle entrée `biodiversite-tnfd-leap` (statut `beta`), à l'identique du traitement réel de l'eau. |

---

## 2. Réutilisation du moteur géométrique PR-08 — preuve, pas déclaration

`services/calculations/nature_locate.py` **n'implémente aucune géométrie** : `compute_intersection` appelle `services.calculations.geo.match_point_to_area` (bbox pré-filtre + point-dans-polygone exact, frontière = intérieur — convention documentée et testée dans `geo.py`, non re-décrite ici). Vérifié par test d'introspection (`tests/test_nature_locate_engine.py::TestGeoEngineReuse`) :

- `inspect.getsource(nature_locate)` contient `from services.calculations.geo import` et `match_point_to_area` ;
- `inspect.getsource(compute_intersection)` appelle littéralement `match_point_to_area(` ;
- absence textuelle de toute primitive géométrique locale (`_point_in_ring`, `_point_on_segment`, `point_in_boundary`, `normalize_boundary`, `compute_bbox` — aucune redéfinie) ;
- `nature_locate.METHOD_POINT_IN_POLYGON is geo.METHOD_POINT_IN_POLYGON` (même objet, pas une copie de chaîne).

Fonctionnellement couvert : cas **Polygon** simple, cas **MultiPolygon** (correspondance dans le second polygone, faux positif bbox de l'enveloppe globale éliminé par le point-dans-polygone), hors-bbox, reproductibilité (empreinte sha256 identique à entrées identiques).

`site_nature_intersections` (038) porte le même vocabulaire fermé `method_code` que `site_water_screenings` (037) et `site_geocode_candidates`/`water_risk_areas` (036) : `geojson_point_in_polygon_v1` / `geojson_bbox_prefilter_v1` / `manual_coordinates_v1`. En pratique, seul `geojson_point_in_polygon_v1` sort de `match_point_to_area` (le pré-filtre n'est jamais un `method_code` final, règle documentée dans `geo.py` lui-même) — les deux autres valeurs restent admises dans le CHECK par cohérence avec le vocabulaire fermé partagé, pas parce qu'elles sont produites ici.

## 3. Migration 038 — fondation Locate/Evaluate (`requires_owner=false`)

Six tables neuves, aucun ALTER : `nature_features` (référentiel sourcé — `source_release_id NOT NULL`, portée mixte tenant/globale motif `water_risk_areas` 036, masquage par `sensitivity`) ; `site_nature_intersections` (fait géométrique **immuable par trigger**, motif `site_water_screening_immutability_guard` 037 — recalculer crée une NOUVELLE ligne, review_status redémarre à `pending`) ; `nature_dependencies` / `nature_impacts` (deux tables **structurellement disjointes** — voir §4) ; `leap_assessments` / `leap_assessment_sites` (dossier LEAP, association M:N vers `sites`).

RLS gen-2 complète sur les 6 tables : `nature_features` en portée mixte (lecture tenant OU globale, écriture tenant uniquement via `app.rls_bypass`, motif `water_risk_areas`/`material_groups`) ; les 5 autres en tenant STRICT. GRANT conditionnel `carbonco_app` + séquences. Sonde `_probe_038` : 6 tables + RLS FORCE + policy scopée + trigger d'immutabilité + `nature_features_bbox_lat_check` + `leap_assessments_approval_check` (une approbation sans `approved_by` identifié ne peut pas exister).

## 4. Séparation dépendance/impact — preuve, pas déclaration

TNFD distingue strictement DÉPENDRE d'un service écosystémique et IMPACTER un écosystème — directions opposées, jamais confondues. Preuve structurelle (pas seulement une convention de nommage) :

- **Schéma** : `nature_dependencies` porte `ecosystem_service`/`dependency_level` ; `nature_impacts` porte `pressure_type`/`impact_kind`/`magnitude_qualitative`. Aucune des deux tables ne porte les colonnes métier de l'autre — vérifié en base par `tests/test_nature_ledger.py::TestDependenciesImpactsSeparation::test_dependencies_and_impacts_never_conflated_in_a_single_query` (introspection de `cur.description` sur les deux tables réelles, pas une assertion sur du code Python).
- **Modèles Pydantic** : test dédié (`test_dependency_and_impact_models_share_no_business_field`) soustrait les champs de bookkeeping génériques (id/company_id/site_id/bom_item_id/material_id/rationale/data_status/review_status/source_release_id/evidence_artifact_id/created_at/updated_at) des deux `model_fields` et vérifie l'ensemble résultant **disjoint**.
- **Services** : `dependencies_service.py` et `impacts_service.py` sont deux modules séparés, aucune fonction commune de lecture/écriture croisée.
- **Frontend** : `app/(app)/nature/page.tsx`, section Evaluate — deux `<div>` distincts (`nature-dependencies-card` / `nature-impacts-card`) dans une grille, jamais une liste unique.

La pression (au sens TNFD : changement d'usage des terres/eau, exploitation de ressources, changement climatique, pollution, espèces invasives) est un ATTRIBUT de `nature_impacts` (`pressure_type`), pas une table séparée — elle n'existe pas indépendamment d'un impact qui la matérialise (motif du plan §2, confirmé).

## 5. Migration 039 — Assess/Prepare (`requires_owner=false`)

Quatre tables neuves, aucun ALTER, tenant STRICT (contrairement à `nature_features`, ces artefacts sont propres au tenant) : `nature_risks` / `nature_opportunities` (risque·opportunité, aléa et confiance **trois colonnes séparées**, motif `crma_article24_assessments` 034) ; `nature_actions` (calquée `mitigation_actions`/`water_actions`, ancrage obligatoire risque/opportunité/dossier) ; `tnfd_disclosure_drafts` (`is_official_tnfd_disclosure` verrouillé `false` par CHECK — garantie de SCHÉMA, pas seulement de discipline applicative). Sonde `_probe_039` : 4 tables + RLS FORCE + policy + `nature_risks_score_range_check` + `nature_risks_confidence_range_check` + `tnfd_disclosure_drafts_never_certified_check` (le CHECK le plus critique de toute la PR : sa disparition autoriserait une ligne « certifiée » — vérifié par test qui tente de le contourner directement en SQL).

### `likelihood` : indépendance prouvée, pas seulement déclarée

`services/calculations/nature_scoring.py` calcule `risk_score`/`opportunity_score`/`confidence` à partir des données ACCEPTÉES (dépendances, impacts, intersections). `likelihood` (aléa) est un **jugement humain transmis tel quel** — il n'est JAMAIS dérivé du score. Preuve par test (`test_nature_scoring_engine.py::TestLikelihoodIndependence`) :
- faire varier `likelihood` seul (même données) ne change JAMAIS `risk_score` ;
- faire varier les données seules (même `likelihood`) ne change JAMAIS `likelihood`.

### Absence de donnée ≠ risque nul — preuve, pas déclaration

Motif `services/crma/scoring.py` (PR-07) étendu à l'identique : une composante sans donnée ACCEPTÉE est `available=False`, EXCLUE (poids renormalisés parmi les composantes disponibles), jamais comptée à zéro. `risk_score`/`opportunity_score` valent `None` si aucune composante n'est calculable. La CONFIANCE reste calculée dans ce cas — c'est son rôle : `test_confidence_degrades_with_pending_rows_not_the_score` construit deux scénarios à données ACCEPTÉES identiques mais `total_rows` différent (lignes `pending` en plus dans le périmètre) et prouve que le score reste identique pendant que la confiance baisse.

### `nature_risks` ≠ `nature_opportunities` — même preuve structurelle qu'au §4

`test_never_conflated_with_risk_table` introspecte `cur.description` des deux tables réelles : `opportunity_score` absent de `nature_risks`, `risk_score` absent de `nature_opportunities`.

## 6. Masquage des données sensibles — mécanisme, pas juste une convention

`nature_features.sensitivity` (`public/internal/confidential/restricted`, vocabulaire IDENTIQUE à `evidence_artifacts.sensitivity` 028) pilote deux comportements distincts, jamais mélangés :

1. **`GET /nature/features` (liste standard, `get_current_user`)** — `features_service.list_features` retire INCONDITIONNELLEMENT `boundary_geojson` et les 4 colonnes bbox pour toute ligne `confidential`/`restricted`, quel que soit l'appelant (`geometry_withheld=true`). Aucune génération de région approximative (aucun référentiel géographique de repli dans ce dépôt) : la ligne masquée expose `code`/`label`/`feature_kind`/`sensitivity` sans aucune coordonnée — jamais une coordonnée arrondie qui laisserait deviner la position réelle. Déviation assumée par rapport au plan §6 (« version généralisée, région sans le polygone exact ») : construire une génération de région exigerait un référentiel géographique de repli qui n'existe pas dans ce dépôt ; la sécurité par défaut (rien plutôt qu'une approximation qui pourrait fuiter) a été préférée.
2. **`GET /nature/features/{id}/geometry` (`require_admin`)** — seule route qui renvoie `boundary_geojson`/bbox réels, quelle que soit la sensibilité. `features_service.get_feature_geometry` ne masque JAMAIS (le masquage est une responsabilité du ROUTEUR, testée à ce niveau).

Testé : `test_confidential_feature_geometry_withheld_in_list` / `test_restricted_feature_geometry_withheld_in_list` / `test_public_feature_geometry_visible_in_list` (service) ; `test_feature_geometry_endpoint_requires_admin` (API : `analyst` → 403, `admin` → 200 avec géométrie réelle).

Cette même règle s'applique à `site_nature_intersections` : l'intersection expose `matched`/`method_code`/`feature_code` mais jamais la géométrie de la zone elle-même (portée par `nature_features`, pas dupliquée sur la ligne d'intersection) — l'exposition de la géométrie précise reste centralisée au seul point `GET /nature/features/{id}/geometry`.

## 7. Protection « schéma pas encore migré » (design + preuve, DEUX fenêtres)

Identique au design `routers/_errors.py::schema_ready_guard()` de PR-08 (§6 de sa traçabilité, non re-décrit). PR-09 introduit DEUX fenêtres de déploiement séparées (038 puis 039, ni l'une ni l'autre `requires_owner`) :

- `tests/test_nature_schema_not_ready.py::TestSchemaNotReady` (fixture `pre038_company`, reset + `apply_upto("037")`) : 503 sur toutes les routes tranche A (`/nature/features`, `/nature/features/{id}/geometry`, `/nature/dependencies`, `/nature/impacts`, `/nature/leap-assessments`, `/nature/sites/{id}/locate`) ; non-régression `/sites`.
- `tests/test_nature_schema_not_ready.py::TestSchemaNotReadyTrancheB` (fixture `pre039_company`, reset + `apply_upto("038")`) : 503 sur les routes tranche B (`/nature/risks`, `/nature/risks/calculate`, `/nature/opportunities`, `/nature/actions`, `/nature/disclosure-drafts`) ; non-régression des routes tranche A déjà migrées (038 EST posée dans cette fenêtre — `POST/GET /nature/leap-assessments` fonctionnent).

Ce fichier reste enregistré APRÈS `test_water_schema_not_ready.py` dans `.github/workflows/api.yml` (deux fichiers de reset consécutifs, aucune régression : aucun des deux n'utilise `admin_token`/`analyst_token`/`viewer_token` — session-scoped, résolus via `/auth/login` — ils mintent leurs JWT directement via `create_access_token`, contournant le risque documenté de perte de compte de test post-reset). Déviation assumée par rapport au précédent PR-08 (qui n'a jamais testé le 503 de ses propres routes tranche B) : PR-09 couvre EXPLICITEMENT les deux fenêtres, jugé nécessaire vu que le brief l'exige explicitement pour cette PR.

## 8. Gates de revue humaine — vocabulaire, jamais une conclusion automatique

- `site_nature_intersections.review_status` (`pending/accepted/flagged`) : le FAIT géométrique est posé par le calcul, mais reste `pending` — sa portée (dépendance, impact, risque en aval) exige une acceptation humaine explicite. Recalculer (`locate_site`) crée une NOUVELLE ligne à `pending`, jamais une ré-acceptation implicite d'une ancienne ligne.
- `nature_dependencies`/`nature_impacts`/`nature_risks`/`nature_opportunities`/`nature_actions.review_status` : même vocabulaire fermé, réutilisé partout dans la PR — aucun 4e vocabulaire.
- `leap_assessments.phase` avance d'UN cran, précondition VÉRIFIÉE par transition (jamais une progression automatique) : `evaluate` exige ≥1 site rattaché ; `assess` exige ≥1 dépendance OU impact ACCEPTÉ (pas seulement calculé/déclaré) ; `prepare` exige ≥1 risque OU opportunité ACCEPTÉ ; `completed` exige ≥1 brouillon de disclosure préparé (jamais `approved` — `completed` constate que le cycle LEAP a été parcouru, pas qu'une publication a eu lieu).
- `leap_assessments.status`/`tnfd_disclosure_drafts.status` (`draft/under_review/approved`) : `leap_service.review()` et `disclosure_service.review()` **mirrors** `services/crma/article24_service.py::review()` à l'identique (motif imposé par contrats §6) — `reviewed_by` non optionnel pour approuver, refus d'approuver un dossier en `locate` (rien à approuver), refus de réapprouver un dossier déjà `approved` (rouvrir la revue d'abord).
- `tnfd_disclosure_drafts.status` n'inclut PAS `'published'` dans son vocabulaire (`CHECK ... IN ('draft','under_review','approved')`) — une publication automatique n'est même pas représentable en base, vérifié par test lisant `pg_get_constraintdef` directement.

## 9. Ledger — arithmétique et sémantique

40 fichiers `.sql` (008b compris) : `len(versions) == 40` ; `written_count` plein = **41** (000 + 40) aux 4 endroits ; `build_full_db` → `apply_upto("039")` ; 038 et 039 sont toutes deux `requires_owner=false` (tables neuves uniquement) → toujours `action="apply"`, jamais `blocked_manual` (contrairement à 036/027). Sondes `_probe_038`/`_probe_039` enregistrées. Fixtures de domaine existantes (water/energy/procurement/scope2/intelligence/crma) inchangées — leurs docstrings pinnent un plafond de domaine, pas le corpus complet ; `_nature_fixtures.py::NATURE_CEILING = "039"` documente le plafond propre à ce domaine, même convention.

## 10. Ce qui n'est prouvé qu'en CI

Poste local sans PostgreSQL/Docker : **tous les tests DB-gated** (`test_nature_ledger.py`, `test_nature_assess_prepare.py`, `test_nature_schema_not_ready.py`, + corpus ledger/probes) skippent localement. La preuve d'exécution est le log du job `migration-tests` (invocation pytest + compteurs — voir rapport final). Les tests purs (`test_nature_locate_engine.py`, `test_nature_scoring_engine.py`) et le corpus sans DB (`test_migration_runner.py`) passent localement (confirmé : `pytest -q` complet exécuté avant chaque commit, 0 échec).

## 11. Hors périmètre (inchangé)

Pas de contenu PR-10 (table `iros`, décision de matérialité — `nature_risks`/`nature_opportunities` ne sont JAMAIS promus automatiquement en IRO, aucune table `*_iro_candidates`, motif contrats §10) ; pas d'ingestion externe réelle (toutes les zones de test sont fictives et le disent) ; pas de LLM comme décideur ; pas de publication automatique de disclosure ; pas de nouveau modèle géospatial (réutilisation stricte PR-08) ; pas de carte Mapbox ; pas d'écriture de production.

## 12. Post-merge (opérateur)

1. Backup ; 2. `db-migrate.yml` → `plan` (attendu : 038 `apply`, 039 `apply` — ni l'une ni l'autre `blocked_manual`, à la différence de 036) ; 3. `apply` (038 puis 039) ; 4. `verify` + `/health/schema` `up_to_date:true`, `schema_version:"039"` ; 5. vérifier que `/nature` sort de « initialisation du schéma en cours » ; 6. observation 24-48h (GRANTs `carbonco_app`, non-régression `/water`, `/sites`, `energy_meters`, `actions`).
