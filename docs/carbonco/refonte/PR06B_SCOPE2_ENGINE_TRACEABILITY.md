# PR-06B — Moteur Scope 2 dual & Evidence Pack · Traçabilité

**Périmètre :** tranche B de PR-06 (`PR06_ENERGY_SCOPE2_IMPLEMENTATION_PLAN.md` §5 « PR-06B indicatif », §6, §7, §9, §10) — le **moteur de calcul** Scope 2 location-based **et** market-based, par-dessus la fondation « ledger énergie » de PR-06A (migration 031).
**Base :** branche `feat/scope2-calculation-engine`, sur `origin/master` (`df13229`, migrations jusqu'à 031 incluses).
**Migration ajoutée :** `033_scope2_calculation_engine.sql` — **seule** nouvelle migration du diff.
**Statut : implémenté, en attente de revue et de CI PostgreSQL (`migration-tests`). PR non mergée automatiquement.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **REPORTÉ**.

---

## 1. Périmètre livré

| # | Élément | Statut | Preuve |
|---|---|---|---|
| 1 | Migration 033 (2 tables + RLS gen-2 + 2 triggers d'immutabilité + CHECK d'interdits) | **FAIT** | `apps/api/db/migrations/033_scope2_calculation_engine.sql` |
| 2 | Moteur PUR : deux hiérarchies de facteurs, contrôles, agrégation, confiance | **FAIT** | `apps/api/services/calculations/scope2.py` |
| 3 | Conversion d'unités centralisée (risque plan §11) | **FAIT** | `apps/api/services/calculations/units.py` |
| 4 | Orchestration DB : chargement, persistance, trace, approbation, licence | **FAIT** | `apps/api/services/calculations/scope2_runs.py` |
| 5 | Enveloppe analytique `{data, meta, evidence}` (contrats §4) | **FAIT** | `apps/api/models/analytics.py` |
| 6 | Endpoints `/energy/scope2/*` (6 routes) | **FAIT** | `apps/api/routers/energy.py` |
| 7 | Evidence Pack d'un run (ZIP signé, reproductible bit à bit) | **FAIT** | `apps/api/services/export_package.py` |
| 8 | Ledger : manifest 033, sonde `_probe_033`, fixtures → 033, job CI | **FAIT** | `migration_manifest.py`, `migration_probes.py`, `_migration_fixtures.py`, `.github/workflows/api.yml` |
| 9 | Frontend : totaux LB/MB côte à côte, Trace, warnings, Evidence Pack, BETA | **FAIT** | `apps/carbon/components/energy/scope2-engine-panel.tsx`, `lib/api/energy.ts`, `data/feature-status.json` |
| 10 | Tests (104 purs + 28 DB-gated) | **FAIT** | `tests/test_scope2_engine.py`, `test_scope2_units.py`, `test_scope2_runs.py` |

---

## 2. Migration 033 (`033_scope2_calculation_engine.sql`)

`requires_owner=False` — ne crée QUE des tables neuves, aucun `ALTER` d'une table existante (comme 028/030/031). Aucun calcul exécuté par la migration, aucune donnée métier migrée.

| Table | Rôle | Points clés |
|---|---|---|
| `scope2_calculation_runs` | Un calcul daté et versionné | Colonnes communes contrats §4 (`methodology_code/version`, `input_snapshot`, `factor_versions`, `result`, `warnings`, `confidence`, `coverage_pct`, `calculated_at`, `approved_at`, `approved_by`) + `input_fingerprint` (SHA-256 du snapshot canonique) et `geography_code`. CHECK : statut, période, bornes 0-100, **approbation jamais anonyme** (`status='approved'` ⇒ `approved_at` ET `approved_by` non nuls) |
| `scope2_line_results` | Trace de calcul persistée | Une ligne par (activité, base, **segment**). `selection_level` et `selection_reason` **NOT NULL** |

**Interdits méthodologiques posés EN BASE, pas seulement dans le moteur :**

- `scope2_lines_market_purity_check` : une ligne `basis='market'` ne peut PAS porter `factor_basis='location'` — « une moyenne nationale présentée comme market-based » est refusée par PostgreSQL. Prouvé par un INSERT SQL direct contournant le moteur (`test_contrainte_base_refuse_une_ligne_market_location`).
- `scope2_lines_fallback_reason_check` : `factor_basis='documented_fallback'` ⇒ `fallback_reason` obligatoire — aucun repli sans motif écrit.
- `selection_level` / `selection_reason` NOT NULL : traduction schéma de « aucun facteur choisi silencieusement ».
- `data_quality` CHECK sur le vocabulaire `observations.data_status` (contrats §2).

**Immutabilité (2 triggers).** `trg_scope2_runs_immutable` refuse toute modification de `input_snapshot`, `input_fingerprint`, `result`, `factor_versions`, méthodologie, période, zone et `company_id` ; seuls `status`/`approved_at`/`approved_by`/`updated_at` restent modifiables — **approuver un run ne peut pas en changer discrètement les chiffres**. `trg_scope2_lines_immutable` interdit tout UPDATE d'une ligne de trace (recalculer = nouveau run ; la suppression suit la CASCADE du run parent).

Les deux fonctions de trigger sont **volontairement sans `SECURITY DEFINER`** : elles ne lisent aucune autre table. Le commentaire de la migration rappelle que, sous `FORCE ROW LEVEL SECURITY`, `SECURITY DEFINER` **ne contourne pas** la RLS (seuls un superuser ou un rôle `BYPASSRLS` le font) — aucun commentaire du dépôt ne prétend le contraire.

**RLS gen-2.** Pattern 028/030/031 : `ENABLE` + `FORCE`, policies scopées par commande (`FOR SELECT/INSERT/UPDATE/DELETE`), garde `app.rls_bypass`, `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY` (rejouable). Tables purement tenant (`company_id BIGINT NOT NULL`) ⇒ pas de branche de lecture `company_id IS NULL` (elle serait morte), comme en 031. **GRANT** conditionnel `carbonco_app` sur les 2 tables + séquences.

**Numérotation.** `032` est réservée à une PR sœur (tranche calcul procurement) non mergée : ce diff saute donc de 031 à 033. Le ledger trie par préfixe et **n'exige aucune contiguïté** — le trou est sans effet, ce qui est explicitement asserté par `test_build_plan_against_real_migrations_directory`. Le numéro définitif reste attribué au merge (contrats §10) ; `command=plan` avant `apply`.

---

## 3. Hiérarchie LOCATION-BASED (`select_location_factor`)

Ordre strict, chaque niveau testé isolément :

| Niveau | Règle | Condition d'admissibilité |
|---|---|---|
| 1 | Facteur de réseau **sous-national** | `geo_level(zone_facteur) == 'subnational'` ET zone **exacte** (ex. `FR-IDF`) |
| 2 | Facteur **national** | zone du facteur = zone de l'activité si nationale, sinon sa **parente** (`FR-IDF` → `FR`) |
| 3 | Facteur **régional explicitement documenté** | `geo_level == 'regional'` **ET `source_release_id` non nul** — un facteur régional non sourcé est **rejeté** (« explicitement documenté » est une condition, pas un vœu). Warning de précision dégradée |
| 4 | **`CalculationError` explicite** | message nommant activité, vecteur, zone, période et « hiérarchie épuisée » |

**Granularité de zone déterministe et documentée** (`geo_level`) : tiret ⇒ sous-national (ISO 3166-2) ; code supranational connu (`EU`, `OECD`, `WORLD`…) ⇒ régional ; 2 lettres ⇒ national (ISO 3166-1) ; **tout le reste ⇒ régional** (jamais promu national par défaut).

Filtres transverses appliqués avant toute hiérarchie : vecteur (`carrier`), **compatibilité d'année** (la fenêtre de validité doit couvrir **toute** la période — un facteur valable sur la moitié de la période est incompatible, pas « à peu près bon »), unité convertible, et **licence** (`allow_derived_use`).

Seuls les candidats `basis='location'` entrent ici : un facteur `market` ou `residual_mix` n'est pas un facteur de réseau (test dédié).

---

## 4. Hiérarchie MARKET-BASED (`select_instrument_factor` + `select_market_factor`)

| Niveau | Règle | Étiquetage |
|---|---|---|
| 1 | **Instrument contractuel valide alloué** (part couverte) | `factor_basis='contractual_instrument'`, taux = `INSTRUMENT_EMISSION_RATE_KGCO2E_PER_MWH` (constante nommée et documentée, jamais un 0 magique). `data_quality='verified'` **seulement si** un certificat est attaché ; sinon `estimated` + warning |
| 2 | **Facteur fournisseur admissible** (`basis='market'`) | `factor_basis='market'`. Sourcé ⇒ `verified` ; non sourcé ⇒ `estimated` + warning « jamais comme facteur contractuel vérifié » |
| 3 | **Mix résiduel compatible** (`basis='residual_mix'`) | `factor_basis='residual_mix'` + warning ; `residual_mix_used` remonté dans le résultat |
| 4 | **Repli, UNIQUEMENT si la méthodologie l'autorise explicitement** | `Methodology.allow_market_fallback` — **faux par défaut**. Étiqueté `documented_fallback` (jamais `location`), `fallback_reason` obligatoire, `data_quality='estimated'`, warning « ce n'est PAS un résultat market-based au sens strict ». Sans autorisation : **`CalculationError` explicite** |

**Structurellement impossible de maquiller une moyenne nationale en market-based** : la sélection MB n'interroge QUE des candidats `basis ∈ {market, residual_mix}`, et le seul chemin par lequel un facteur de réseau peut intervenir (niveau 4) l'étiquette `documented_fallback` — refusé autrement par le CHECK SQL.

---

## 5. Contrôles obligatoires

| Contrôle | Comportement | Preuve |
|---|---|---|
| **Aucune double allocation** | Même instrument alloué 2× à la même activité ⇒ **erreur explicite** (la base l'interdit déjà via `UNIQUE`, le moteur ne s'y fie pas aveuglément au moment de calculer) | `test_double_allocation_meme_instrument_erreur` |
| **Quantité couverte ≤ consommation** | Somme des allocations valides > MWh consommés ⇒ **erreur explicite** | `test_quantite_couverte_superieure_a_la_consommation_erreur` |
| **Volume utilisé ≤ volume de l'instrument** | Contrôle **transverse** (toutes activités du run) ⇒ erreur « survente de garanties » | `test_volume_utilise_superieur_au_volume_instrument_erreur` |
| **Périodes compatibles** | Activité hors fenêtre de validité de l'instrument ⇒ allocation **exclue + warning** (la couverture ne rétroagit pas) | `test_periode_incompatible_exclue_avec_warning` |
| **Zones compatibles** | Intégré aux deux hiérarchies (niveau suivant, puis erreur) | tests de hiérarchie |
| **Technologie (vecteur) compatible** | `carrier` instrument ≠ activité ⇒ exclusion + warning ; facteur d'un autre vecteur ⇒ écarté | `test_vecteur_incompatible_exclu_avec_warning` |
| **Année compatible** | Facteur ne couvrant pas toute la période ⇒ écarté | `test_annee_incompatible_exclue` |
| **Unités convertibles** | Unité non énergétique ⇒ **erreur explicite** (jamais de conversion « au mieux ») | `test_unite_non_convertible_erreur_explicite` |
| **Quantité non couverte visible** | Ligne de trace dédiée `segment='uncovered'` + `uncovered_mwh` dans le résultat | `test_part_non_couverte_visible_dans_la_trace` |
| **Instrument expiré / non actif** | Exclusion + warning | `test_instrument_expire_exclu_avec_warning`, `test_instrument_non_actif_exclu` |
| **Aucun facteur choisi silencieusement** | `level` + `reason` obligatoires sur chaque sélection, NOT NULL en base | `test_trace_serialisable_et_complete` |

**Traitement des facteurs manquants — décision assumée.** Le niveau terminal de chaque hiérarchie lève bien une `CalculationError` explicite. Au niveau du RUN, `calculate()` **capture** ces erreurs par activité et par base, les conserve intégralement dans `missing_factors` (message d'erreur inclus), **exclut** la quantité concernée des totaux (**jamais substituée par zéro**), marque le run `is_complete=False` et **interdit son approbation**. Motif : la trace doit montrer **tout** ce qui manque, pas seulement le premier problème — tout en garantissant qu'un total amputé ne devienne jamais un KPI officiel. Les erreurs d'**intégrité** (double allocation, sur-couverture, survente) ne sont pas capturées : elles font échouer le run entier.

---

## 6. Sorties, reproductibilité et Evidence Pack

**Sorties** (`Scope2Result` → `result_to_dict`) : total location-based, total market-based, consommation totale et calculée, couverture contractuelle (MWh + %), quantité non couverte, `residual_mix_used`, `missing_factors`, `warnings`, `confidence`, `coverage_pct`, `factor_versions` (facteurs **réellement utilisés**, pas les candidats), `trace` complète.

**Confiance** (0-100 entier, contrats §4) : moyenne des scores de niveau **pondérée par les MWh**, moins des pénalités pour la part en attente de revue (−15 × part) et la part non calculée (−50 × part). Déterministe, documentée, **distincte** de `data_status` et d'un score de risque (contrats §2).

**Reproductibilité.** Le moteur est PUR : aucune I/O, aucun aléa, aucune lecture d'horloge (`today` est un paramètre explicite). Les candidats sont triés par un **ordre total** (sourcé d'abord, puis validité la plus récente, puis `ef_id`) — sans quoi deux exécutions pourraient retenir deux facteurs différents. `build_input_snapshot` gèle les entrées sous forme canonique triée, `fingerprint` en donne le SHA-256. Prouvé : mêmes entrées ⇒ mêmes sorties, ordre d'entrée sans influence, empreinte sensible au moindre changement, et (DB-gated) deux runs successifs sur les mêmes données portent la même empreinte et les mêmes totaux.

**Evidence Pack** (`export_package.assemble_scope2_pack`, fonction PURE). Réutilise la convention de pack existante (`manifest.json` signé + `CHECKSUMS.sha256` vérifiable par `sha256sum -c`) — un auditeur qui sait vérifier un pack CarbonCo sait vérifier celui-ci. Contenu : `run.json`, `result.json`, `calculation_trace.json`, `input_snapshot.json`, `factors.json`, `warnings.json`, `README.txt`. **Reproductible bit à bit** : les entrées ZIP portent un horodatage fixe (`_ZIP_EPOCH`) parce que `writestr` estampille sinon l'heure courante — deux générations du même run donnent le même `package_hash`. Le `README.txt` énonce les interdits respectés **et** ce qui n'est pas garanti (un run `draft` n'est pas un résultat officiel). `build_scope2_evidence_pack` enregistre le pack dans `export_packages` (domaine `scope2_run`) pour que `/verify/{hash}` puisse l'attester.

---

## 7. Endpoints, enveloppe et non-régression

**6 routes** sous `/energy/scope2/` (l'app charge 244 routes au total) :

| Endpoint | Perm | Réponse |
|---|---|---|
| `POST /energy/scope2/calculate` | analyst | `AnalyticalEnvelope[Scope2ResultData]` (201) |
| `GET /energy/scope2/runs` | viewer | `{items,total,limit,offset}` (pagination §5) |
| `GET /energy/scope2/runs/{id}` | viewer | enveloppe + trace |
| `GET /energy/scope2/runs/{id}/trace` | viewer | trace seule |
| `POST /energy/scope2/runs/{id}/approve` | **admin** | enveloppe |
| `GET /energy/scope2/runs/{id}/evidence-pack` | analyst | ZIP + `X-Package-Hash` / `X-Manifest-Hash` |

`meta.status` vaut `verified` **seulement** si le run est approuvé ET que chaque ligne est vérifiée ; sinon `estimated` — jamais l'inverse.

**Non-régression des consommateurs `CC.GES.SCOPE2_LB/MB`.** Aucun code de beges / actions / pdf / vsme / esg / copilot n'est modifié. Le moteur n'écrit dans la chaîne de preuve **qu'à l'approbation** d'un run complet, qui émet **les deux** facts (`CC.GES.SCOPE2_LB` **et** `CC.GES.SCOPE2_MB`, jamais un seul — le Scope 2 reste dual jusque dans `facts_events`). Tant qu'aucun run n'est approuvé, les KPI historiques importés d'Excel restent la vérité. Suites `test_beges.py` + `test_actions.py` + `test_scope2_selection.py` + `test_export_package.py` : **50 passed, 3 skipped**, inchangé.

Le helper LB/MB de PR-06A (`services/carbon/scope2_selection.py`) est **réutilisé** (constantes de codes de fact importées, pas recopiées) et sa règle « présence, pas véracité » est re-testée ici : `LB = 0` reste une donnée légitime qui prime sur un MB non nul.

---

## 8. Déviations, choix et coordination (honnêtes)

- **`models/analytics.py` créé par cette PR.** Les contrats §4 désignaient PR-05B comme créatrice probable ; le module était absent de `master` au moment d'écrire PR-06B. Il est donc créé ici avec la **forme générique minimale du contrat** et rien de spécifique au Scope 2. **Si PR-05B est mergée en premier, le rebase doit conserver UNE SEULE copie** : garder la version de `master`, vérifier qu'elle porte bien `data/meta/evidence`, `MethodRef`, `QualityMeta`, `EvidenceRef`, et retirer ce fichier du diff. Une note en tête du module le rappelle.
- **`routers/_errors.py` réutilisé, copie locale de PR-06A supprimée.** PR-06A portait un `_http_error`/`_require_db` locaux « en attendant un module commun mergé » ; PR-05A l'a depuis introduit. `routers/energy.py` s'y branche : convention lexicale et comportement **identiques**, un doublon en moins.
- **Taux d'émission d'un instrument contractuel = 0 kgCO2e/MWh**, exposé en constante nommée et documentée. `contractual_instruments` ne porte pas de colonne de taux et PR-06B **n'altère aucune table de 031** ; la convention (l'attribut acheté EST la caractéristique d'émission de la production associée) est donc explicitée dans le code, dans la trace (`selection_reason`) et dans le README du pack. **Reporté** : un taux par instrument si un besoin réel apparaît (exigerait une migration ultérieure, pas un ALTER de 031).
- **Zone de réseau fournie par la requête** (`geography_code` obligatoire, surcharge optionnelle par site via `site_geographies`). `sites` (027) ne porte pas de code géographique et `energy_activities` non plus ; deviner la zone aurait été un choix silencieux. Le géospatial reste PR-08.
- **Compatibilité de zone des instruments : partielle**, comme en PR-06A. L'allocation contrôle vecteur, période, expiration et volume ; la compatibilité géographique stricte instrument↔activité reste reportée (`contractual_instruments.geography_code` est en place pour ce futur contrôle). Les zones **sont** pleinement contrôlées côté **facteurs**, dans les deux hiérarchies.
- **`aggregation_service.CarbonKpis` (perte de `scope2Mb`) NON modifié** — inchangé depuis PR-06A. Le plan §8/§10 le marque « À CONFIRMER » (changement transverse au dashboard consolidé) ; le panneau PR-06B lit les deux totaux directement depuis l'enveloppe du run, sans passer par le consolidé. Reste à trancher hors de cette PR.
- **`review_activity` toujours non exposé en HTTP** (décision PR-06A inchangée). Le run signale les activités `pending` par un warning et permet de les exclure (`include_pending=false`).
- **Composants front `CalculationTrace` / `LicenseWarning` non extraits en composants partagés.** La trace est rendue par `scope2-engine-panel.tsx` (table accessible avec `<caption>` et en-têtes `scope="col"`) et l'avertissement de licence remonte par le canal générique des `warnings`. Les extraire prématurément en `components/intelligence/` risquait un doublon avec les PR sœurs de la vague 3 développées en parallèle — à factoriser quand une seconde PR en aura besoin.

---

## 9. Tests

| Fichier | Contenu | DB-gated |
|---|---|---|
| `test_scope2_units.py` | Conversions kWh/MWh/GWh/MJ/GJ/Wh/kJ/TJ, alias, facteur par kWh → par MWh, **erreur explicite** sur unité non énergétique — **35 cas, jamais skippés** | Non |
| `test_scope2_engine.py` | Zones ; hiérarchie LB niveau par niveau + erreur ; hiérarchie MB niveau par niveau + refus/autorisation du repli ; interdits méthodologiques ; contrôles d'allocation ; agrégation ; LB=0 légitime ; MB=0 légitime ; confiance ; reproductibilité ; Evidence Pack — **69 cas, jamais skippés** | Non |
| `test_scope2_runs.py` | Sonde 033 ; run nominal persisté ; trace ; **CHECK SQL d'interdit market/location** ; licence `allow_derived_use` ; hiérarchies bout en bout ; reproductibilité ; **immutabilité (runs et lignes)** ; approbation (2 facts, refus d'un run incomplet, refus de double approbation) ; **isolation tenant** ; Evidence Pack depuis la base ; parité moteur pur ↔ persistance — **28 cas** | Oui |
| `tests/_scope2_fixtures.py` | Schéma → 033 + 2 companies (`s2-test-a/b`) + site + compteur + 4 facteurs de test (`S2TEST-*`) + helpers d'insertion + teardown (`session_replication_role=replica`). Exposé via `conftest.py` (évite le faux positif F811, patron PR-03/PR-06A) | — |

**Ledger :** `test_migration_runner.py` (corpus réel **32 → 33**, `assert "033" in versions`, `actions["033"] == "apply"`, + assertion documentant que la **non-contiguïté** due au 032 réservé est sans effet) ; `test_migration_ledger.py` (**4** assertions `written_count` **33 → 34**) ; `test_migration_probes.py` (paramétré sur les clés de sondes — `_probe_033` couvert automatiquement via `build_full_db → 033`).

**Exécuté localement (pas de PostgreSQL / Docker dans ce shell — DB-gated skippés, EXPECTED) :**

- `pytest tests/test_scope2_units.py tests/test_scope2_engine.py` → **104 passed**.
- `pytest tests/test_scope2_runs.py` → **28 skipped** (DATABASE_URL absent — exécutés uniquement par le job CI `migration-tests`).
- `pytest tests/test_beges.py tests/test_actions.py tests/test_scope2_selection.py tests/test_export_package.py` → **50 passed, 3 skipped** (preuve de non-régression des consommateurs LB/MB et du pack existant).
- `pytest tests/test_migration_runner.py::test_build_plan_against_real_migrations_directory` → **passed** (033 détectée `apply`, corpus 33).
- Suite complète (`--ignore=tests/test_health_storage_probe.py`) : **796 passed, 294 skipped, 5 failed**. Les 5 échecs + l'erreur de collecte ignorée sont **pré-existants et sans rapport** : `ModuleNotFoundError: No module named 'vercel'` (paquet `vercel==0.6.0` de `requirements.txt` non installé dans ce shell, installé en CI) — mêmes échecs qu'en PR-06A, **zéro régression**.
- `ruff check . --select=E,F,I --ignore=E501` → **All checks passed**.
- `git diff --check` → propre.

**CI (`.github/workflows/api.yml`, job `migration-tests`)** : ajout de `tests/test_scope2_runs.py` au bloc PostgreSQL — **seul** job avec un vrai `postgres:16`. Sans cette inscription, le fichier skipperait silencieusement et ne prouverait rien (leçon PR-03 §15).

**Frontend :** `npm ci --legacy-peer-deps` puis `npm run lint` → **0 error**, 20 warnings **tous pré-existants** (aucun dans les fichiers PR-06B) ; `npm run build` → **succès**, route `/scopes` construite.

**Ce qui n'est prouvé QUE par la CI** (aucun PostgreSQL local) : l'applicabilité réelle de 033 après 031, la sonde `_probe_033`, l'isolation tenant, les triggers d'immutabilité, le CHECK d'interdit market/location, l'émission des facts à l'approbation, et la reproductibilité bout en bout. Aller-retour CI prévu (leçon PR-02/03).

---

## 10. Interface frontend

- `lib/api/energy.ts` **étendu** (types `Scope2*`, `AnalyticalEnvelope<T>`, 6 appels dont le téléchargement authentifié du pack — pas d'URL signée permanente, contrats §3).
- `components/energy/scope2-engine-panel.tsx` : **les deux totaux tCO2e côte à côte** dans une grille `md:grid-cols-2`, aucun onglet, aucune bascule qui pourrait en masquer un. Plus : identité du run (méthode versionnée, statut, empreinte), bandeau « brouillon ⇒ ne remplace aucun KPI », confiance / couverture / statut, **facteurs manquants** en rouge avec le message d'erreur, **warnings**, **Trace de calcul** dépliable (niveau + raison + facteur + qualité par ligne), bouton **Evidence Pack**, et un bandeau final énonçant les garanties méthodologiques. États loading / empty / error. Badge **BETA**.
- `components/pages/scopes-page.tsx` : `<Scope2EnginePanel />` ajouté sous le panneau de fondation PR-06A.
- `data/feature-status.json` : entrée BETA `moteur-scope2-dual` (43 features) ; la description de `energie-scope2-dual` perd sa phrase « le moteur arrive en tranche suivante », désormais fausse.

---

## 11. Confirmations explicites

- **Une seule nouvelle migration** : `apps/api/db/migrations/033_scope2_calculation_engine.sql` (vérifié : aucun autre `0NN.sql` dans le diff). **Aucune modification des migrations 001-031.**
- **Aucune écriture prod.** `033` suit le chemin `db-migrate.yml` (workflow manuel protégé) comme 001-031 ; aucun `apply` par Claude, aucune migration exécutée contre une base réelle.
- **Aucun LLM, aucun connecteur externe, aucun accès réseau, aucune donnée externe réelle ingérée.**
- **Aucun fallback silencieux de facteur** : le niveau terminal de chaque hiérarchie est une erreur explicite ; le seul repli possible exige une autorisation méthodologique explicite, un `fallback_reason` obligatoire, un étiquetage `documented_fallback` et un warning.
- **Les trois interdits méthodologiques sont testés**, et deux d'entre eux sont en plus garantis par un CHECK PostgreSQL.
- **Non-régression** des consommateurs `CC.GES.SCOPE2_LB/MB` : aucun de leurs fichiers n'est touché ; les KPI historiques restent valides tant qu'aucun run n'est approuvé.
- **PR non mergée automatiquement, aucun auto-merge.**

---

## 12. Opérations post-merge (Ludo, hors code)

1. **Backup** (`backup.yml`) avant écriture.
2. **DB Migrate** → `plan` (confirmer `033` en `apply`, pending ; renuméroter si une PR sœur a pris le numéro entre-temps) → `apply` → `verify` (`{"anomalies": []}`, exerce `_probe_033`).
3. `GET /health/schema` → `schema_version: "033"`, `up_to_date: true`, `pending_count: 0`.
4. Vérif applicative : `GET /energy/scope2/runs` (JWT) → 200 liste vide ; `/scopes` affiche le panneau moteur BETA en état « aucun calcul enregistré » et les KPI Scope 2 historiques restent inchangés.
5. Premier run réel : déclarer au moins un `energy_factor_metadata` `basis='location'` pour la zone, puis `POST /energy/scope2/calculate`. Vérifier que la trace nomme le niveau retenu et que le run reste `draft`.
6. Observation 24-48 h (permissions `carbonco_app` sur les 2 nouvelles tables). Consigner `MIGRATIONS_RUNBOOK.md` §9.
