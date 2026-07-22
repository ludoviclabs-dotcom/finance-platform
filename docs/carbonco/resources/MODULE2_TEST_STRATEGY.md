# MODULE 2 — Stratégie de test

> **Phase 2 — architecture définitive, docs-only.** Date : 2026-07-22. Aucun test réel écrit ici — ce document *fige* la matrice de tests que PR-M2A/B/C/D devront livrer.
> **Contrainte d'environnement** (héritée) : **pas de Docker/PostgreSQL local** sur cette machine Windows → tout test **DB-gated** n'est réellement exécuté qu'en **CI `migration-tests`** (`postgres:16`). Prévoir un aller-retour CI à chaque tranche touchant Postgres (leçon PR-02→PR-11).
> **Garde obligatoire** : tout test DB-gated porte `pytestmark = pytest.mark.skipif(not db_available())` — sinon il **échoue** (au lieu de skipper) dans le job `tests` (mode /tmp). Tout nouveau fichier DB-gated doit être **inscrit dans le job `migration-tests`** de `.github/workflows/api.yml` — sinon il est silencieusement inerte (piège vécu PR-03).

## 1. Ledger de migrations

- `test_build_plan_against_real_migrations_directory` (non-DB) : le dossier réel contient **042** puis **043** ; `discover_migrations()` les retourne (glob `*.sql`, sans exiger de contiguïté) → `len(versions)` et `written_count` **mis à jour** (piège des compteurs codés en dur auto-mergés — grep tous les `== 4x`/`len(versions)`/`written_count` et corriger à la main).
- `migration_manifest.py` : entrées **`"042"`** et **`"043"`** présentes, `requires_owner=False`, `transactional=True`, `note` non vide.
- Baseline : 042/043 apparaissent `pending` sur un ledger baseliné jusqu'à 041, `applied` après `apply`.

## 2. Sondes (`migration_probes.py`)

- **`_probe_042`** : les 6 tables existent (`_table_exists`) ; RLS FORCE + policy `tenant_isolation_<t>` sur chacune (`_policy_exists` + `_force_rls`) ; CHECK clés présents (`resource_catalog_sourced_check`, `resource_roles_role` CHECK, `resource_regulatory_statuses_sourced_check`) ; le semis global d'étapes (`resource_stage_applicability` non vide pour ≥1 famille) est présent.
- **`_probe_043`** : les 4 tables existent + RLS FORCE + policy ; **trigger d'immuabilité** `trg_resource_assessment_runs_guard` présent (`_trigger_exists`) — une base où les tables existent mais où le trigger a été retiré **n'est PAS** 043 (motif `_probe_040`/`_probe_041`) ; CHECK `company_resource_exposure_links_target_check` ; **et surtout** `_constraint_definition_contains(cur,'iros','iros_origin_domain_check','strategic_resources')` — le nom de contrainte est réutilisé (DROP+ADD), son existence seule ne distingue pas l'ancienne définition de la nouvelle (piège `audit_eventtype_check` 040/041).
- Enregistrement dans `MIGRATION_OBJECT_PROBES["042"|"043"]` ; `verify_object` ne renvoie plus `False`/`drift` pour ces versions.

## 3. RLS (DB-gated, superuser CI bypasse → double preuve)

- **Isolation A/B** : tenant A ne lit **jamais** les lignes tenant-strictes de B (`company_resource_exposure_links`, `resource_assessment_runs`, `resource_assessment_dimensions`). Testé **avec un rôle non-superuser** (`SET ROLE` + `app.current_company_id`) pour prouver la RLS FORCE réelle (motif `test/energy-rls-non-superuser`), **et** via le prédicat applicatif (garantie sous superuser).
- **Lecture globale** : une ligne `company_id IS NULL` de `resource_catalog`/`resource_stage_applicability` est lisible par A et B.
- **Écriture globale refusée à l'analyste** : un INSERT `company_id IS NULL` par un tenant est rejeté (policy INSERT) ; seul `app.rls_bypass` (semis/admin) l'autorise.
- **Anti-IDOR link** : `POST /resources/exposures/link` avec un `purchase_line_id` d'un AUTRE tenant → 404, aucune ligne créée (teardown : `session_replication_role=replica` pour purger malgré triggers, motif PR-03 ; purger `audit_events` avant `apply_upto` si 011 rejoue une contrainte étroite — piège 011 reconfirmé).

## 4. Services (`services/resources/*`)

- `catalog_service` : résolution slug `global ∪ tenant` ; alias reverse-lookup (`legacy_material_id` → resource) ; unicité slug par scope.
- `regulatory_service` : `certainty='confirmed'` refusé sans `source_release_id` (CHECK + garde service).
- `exposure_link_service` : validation « exactement une cible cohérente avec `link_kind` » ; `_assert_in_scope` sur chaque FK ; **aucune écriture de facteur carbone** (D-4).
- `assessment_service` : orchestration `scoring.py` ; création d'un **nouveau** run (jamais UPDATE d'un run non-draft) ; supersession ; émission **optionnelle** d'un signal IRO (`origin_domain='strategic_resources'`) sans décision de matérialité.

## 5. API (`routers/resources.py`)

- Rôles : `GET`=`get_current_user`, `POST`=`require_analyst` (un `get_current_user` sur un POST → 401/403).
- `require_db()` → 503 sans DB ; `schema_ready_guard()` → **503 `schema_not_ready`** quand les tables 042/043 manquent (simulé en supprimant une table dans une base de test, motif water).
- Pagination : `{items,total,limit,offset}` ; `limit` borné `[1,200]`, `offset >= 0`.
- Erreurs lexicales : « introuvable » → 404, « requis/requise » → 400, sinon 409 ; jamais de SQL/fuite cross-tenant dans le message.

## 6. Calculs & HHI (tests PURS, non-DB — `scoring.py`)

> **Échelle HHI = canonique DOJ 0–10000** pour MODULE 2 (arbitré par les valeurs de test imposées de ce brief). Réconciliation avec `scoring.py` (qui calcule aujourd'hui en 0–100 pour CRMA) : paramétrer `herfindahl_pct(shares, scale=10000)` — **défaut `scale=100` inchangé pour CRMA (aucune régression)**, MODULE 2 passe `scale=10000`. La valeur affichée/stockée est le **HHI brut 0–10000** (`raw_value`, `raw_unit='HHI'`) ; la **contribution au composite** utilise `risk_value = HHI/100` (0–100), donc la pondération reste identique. Ceci **résout** l'item ouvert §D-2 de `METHODOLOGY_AND_ALGORITHMS.md` (échelle) et lève le libellé impropre « HHI % ».

Tests HHI **obligatoires** :
- **Monopole** (un pays 100 %) → **HHI = 10000**.
- **Quatre parts égales** (25/25/25/25) → **HHI = 2500** ; `N_eff = 4`.
- **Couverture partielle** : parts observées sommant à `T < 100 %` → HHI renormalisé au total observé, `observed_total_pct` **reporté honnêtement** ; test que la **bande de couverture** `[Σp², Σp²+(1−T)²]` (×scale) encadre le point ; **garde de couverture minimale** déclenche (HHI d'étape retiré/signalé si couverture trop faible).
- **Parts invalides** (négatives ou > 100) → `ScoringError` (jamais un HHI silencieux).
- **Années différentes** : observations d'années différentes **non mélangées** dans un même HHI d'étape.
- **Étapes différentes** : `compute_stage_concentration` **lève** `ScoringError` si une observation d'une autre étape est fournie — **jamais** de moyenne inter-étapes (`max`/sélection d'étape, `stage_code` reporté).
- **Absence de source** : une observation `data_status='verified'` sans `source_release_id` est refusée (CHECK, DB-gated).
- **Confidence séparée** : ajouter une donnée de qualité change la **confiance**, jamais le **risque** ; `risk_score` invariant à toute entrée de confiance.
- **Aucun score si gate échoue** : aucune composante disponible → `risk_score = None` (jamais un nombre inventé), `confidence` calculée quand même.
- **Sensibilité (O-5)** : perturber le poids d'une composante **indisponible** = **0** effet ; la bande de stabilité contient `S0` ; OAT sauté proprement si `risk_score is None`.

## 7. Couverture partielle, source_release, licence, Evidence Kernel

- **Couverture partielle** : cf. §6 (biais renormalisation surfacé, pas masqué).
- **`source_release` obligatoire** : CHECK `*_sourced_check` sur `resource_catalog`/`resource_regulatory_statuses`/`resource_sector_uses`/`resource_supply_observations` (DB-gated).
- **Licence** : une observation d'une source `derived_use_allowed=false` **dégrade la confiance, pas le risque** ; jamais servie brute. Test du **gate O-10** : FAOSTAT/Eurostat restreint avec `commercial_use_allowed=false` → `allow_derived_use` **bloqué** tant que le modèle n'est pas étendu (test qui échoue si un calcul dérivé commercial passe).
- **Evidence Kernel** : `resource_assessment_dimensions.source_release_ids` trace chaque driver ; aller-retour composante → release.

## 8. Alias legacy & intégration CRMA

- **Alias legacy** : `resource_aliases('legacy_material_id', 'helium')` résout vers la ressource ; `/resources/catalog/helium/supply` renvoie l'**union** des `resource_supply_observations` et des `material_stage_observations` legacy (034) — **sans** recopie ni ALTER de 034.
- **Intégration CRMA** : une ressource déjà CRMA (hélium/silicium/charbon à coke) est scorée par le **même** moteur ; le résultat est cohérent qu'il vienne de l'entrée legacy ou du catalogue.

## 9. Liens Water/Energy/Procurement & signal IRO

- **Link Procurement** : `link_kind='purchase_line'` référence un `purchase_lines` du tenant ; magnitude `annual_spend_eur` lisible ; **aucun** recalcul Scope 3 (lecture du module 032 seulement).
- **Link Energy** : `link_kind='energy_activity'` → lecture de l'empreinte Scope 2 depuis 031/033, jamais recalculée (D-4).
- **Link Water** : `link_kind='water_activity'` → 036/037.
- **Signal IRO** : un run à dépendance élevée peut créer un `iros` `origin_domain='strategic_resources'`, `origin_reference='resource_assessment_run:<id>'` ; **`materiality_decisions` reste humaine** (aucune décision automatique) ; test que le module **ne décide jamais** la matérialité.

## 10. Frontend futur (PR-M2C) & Demo futur (PR-M2D)

- **Frontend** : vitest sur les composants `/resources` (réutilise `DataStatusBadge`, `Reveal`, `AnimatedCounter`) ; Playwright sur les parcours (catalogue → fiche → exposition → assessment) ; `data-status`/`confidence` affichés à côté du risque, jamais l'agrégat seul.
- **Demo (Asterion)** : seed **synthétique** (motif `demo-scenario.yml`), **zéro migration**, **zéro appel IA payant**, **zéro appel externe** ; `verify` = parité **arithmétique** (pas de reverse-engineering) ; gitleaks allowlist des fixtures (piège « key »).

## 11. Sécurité Défense / Spatial (test de non-régression de contenu)

- Un test/lint de **contenu** (grep de garde, motif `claims-guard.test.ts`) échoue si un seed, une fixture ou un champ introduit l'un des interdits de `MODULE2_RLS_AND_SECURITY.md` §7 : recette, formulation, proportion, paramètre de fabrication, propergol, paramètre de propulsion (`kgCO2e/kN`…). Critère de merge de chaque PR.

## 12. Récap — quel job exécute quoi

| Catégorie | Job CI | DB requise |
|---|---|---|
| Ledger (build_plan), calculs/HHI purs, sensibilité, garde de contenu | `tests` (mode /tmp) | non |
| Probes, RLS A/B, source_release CHECK, immutabilité runs, licence, IDOR | `migration-tests` (`postgres:16`) | **oui** |
| Frontend, Demo e2e | `lint-and-build` / Playwright | non (mock API) |
