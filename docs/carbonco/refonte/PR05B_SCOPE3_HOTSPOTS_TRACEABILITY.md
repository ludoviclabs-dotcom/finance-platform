# PR-05B — Moteur Scope 3 achats, hotspots et campagnes fournisseurs · Traçabilité

**Périmètre :** tranche B du plan `PR05_PROCUREMENT_EXPOSURE_IMPLEMENTATION_PLAN.md`
(§5 « PR-05B indicatif », §6, §7, §9, §10) — **calcul**, hotspots, sélection humaine,
campagnes ciblées, score fournisseur, Evidence Pack.
**Migration réservée :** `032_procurement_scope3_hotspots.sql` (seule ajoutée).
**Base :** `origin/master` (`df13229`), migrations 001-031 mergées.
Ne dépend d'aucun code PR-04/PR-06 non mergé.
**Statut : implémenté, `migration-tests` VERTE (390 tests PostgreSQL passés, dont les
~40 tests DB-gated de cette PR). PR non mergée automatiquement.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **HORS PÉRIMÈTRE**.

---

## 1. Périmètre livré

| # | Élément | Statut | Preuve |
|---|---|---|---|
| 1 | Migration 032 (3 tables + RLS gen-2 + CHECK métier + probe) | **FAIT** | `apps/api/db/migrations/032_procurement_scope3_hotspots.sql` |
| 2 | Enveloppe analytique canonique `{data, meta, evidence}` | **FAIT** | `apps/api/models/analytics.py` |
| 3 | Moteur PUR — hiérarchie 5 méthodes, conversions, incertitude | **FAIT** | `apps/api/services/calculations/procurement.py` |
| 4 | Orchestrateur de run (snapshot immuable, idempotence, gate) | **FAIT** | `apps/api/services/procurement/calculation_run_service.py` |
| 5 | Hotspots + **sélection humaine** + campagne contrôlée | **FAIT** | `apps/api/services/procurement/hotspots_service.py` |
| 6 | Score fournisseur — **5 dimensions séparées** | **FAIT** | `apps/api/services/procurement/scoring.py` |
| 7 | Evidence Pack de run (vérifiable par `inspect_zip` existant) | **FAIT** | `apps/api/services/procurement/evidence_pack.py` |
| 8 | Endpoints `/procurement/*` + `/suppliers/{id}/risk\|evidence-quality` | **FAIT** | `apps/api/routers/procurement.py`, `suppliers.py` |
| 9 | Tests (purs + DB-gated + ledger) | **FAIT** | 4 fichiers `test_procurement_{calculation,hotspots,scoring,evidence_pack}.py` |
| 10 | Frontend : couverture, méthodes, non résolu, hotspots, drill-down, campagne, Evidence Pack (BETA) | **FAIT** | `apps/carbon/app/(app)/fournisseurs/scope3/page.tsx` |
| 11 | Référentiel matières CRMA / scoring matières critiques | **HORS PÉRIMÈTRE (PR-07)** | — |
| 12 | Suggestions IA de mapping (`ai_draft`) | **HORS PÉRIMÈTRE (PR-11)** | ancrage typé seulement, rien d'exécuté |

---

## 2. Migration 032 (`requires_owner=False`)

3 tables, `id BIGSERIAL`, `company_id BIGINT NOT NULL`, RLS **génération 2** (ENABLE +
FORCE, 4 policies scopées par commande, `DROP POLICY IF EXISTS` avant chaque `CREATE`,
GRANT conditionnel `carbonco_app`) — pattern identique à 028/030/031.

| Table | Rôle |
|---|---|
| `procurement_calculation_runs` | Un run : méthodologie versionnée, **snapshot d'entrée immuable**, `input_fingerprint`, facteurs employés, résultat, avertissements, couverture, confiance, gate d'approbation. |
| `procurement_line_results` | Un résultat **par ligne d'achat** : méthode, rang, facteur (id + version), conversion explicite, incertitude, qualité, confiance, `fallback_reason`, `method_trace`, références de preuve. |
| `procurement_hotspot_selections` | La **décision humaine** sur un hotspot (retenu / écarté / transformé en campagne). |

### Règles métier portées EN BASE (pas seulement en Python)

C'est le choix de conception le plus important de cette migration : les garanties
non négociables sont des `CHECK`, donc elles tiennent même si un futur appelant les
oublie.

| Contrainte | Ce qu'elle empêche |
|---|---|
| `procurement_line_results_fallback_reason_check` | **Aucun repli silencieux** : tout `method_rank > 1` exige une `fallback_reason` non vide. |
| `procurement_line_results_unresolved_null_check` | **Aucune valeur inventée** : une ligne `unresolved` ne peut PAS porter de `result_tco2e` (ni 0, ni estimation). |
| `procurement_line_results_method_rank_coherent_check` | Cohérence méthode ↔ rang : impossible d'enregistrer « spend_based » au rang 1 et de fausser tous les agrégats de couverture. |
| `procurement_runs_fingerprint_active_uniq` (index **partiel**) | Idempotence : au plus un run **actif** par (tenant, empreinte). Partiel (`WHERE status <> 'superseded'`) pour que le recalcul forcé puisse produire un nouveau run **sans détruire** l'archivé — voir §12bis. |
| `procurement_hotspot_selection_uniq` | Sélection idempotente : re-sélectionner met à jour, n'empile pas. |
| `procurement_hotspot_campaign_status_check` | Pas de campagne « fantôme » rattachée à un hotspot écarté. |

**Sonde ledger** : `_probe_032` vérifie les 3 tables + policy + FORCE RLS **et**
l'existence de `procurement_line_results_fallback_reason_check`. Nouveau helper
`_constraint_exists` ajouté à `migration_probes.py` : quand une règle métier est portée
par un CHECK, sa disparition est une dérive de schéma qui doit être détectée — même
raisonnement que la sonde 031 pour son trigger.

**Aucun trigger** dans cette migration — donc aucune remarque `SECURITY DEFINER` à
formuler (rappel : `SECURITY DEFINER` ne bypasse **pas** `FORCE RLS`).

---

## 3. Hiérarchie de méthode — le cœur de la PR

Ordre **non négociable**, implémenté comme une cascade explicite dans
`services/calculations/procurement.py::compute_line` :

| Rang | Méthode | Condition |
|---|---|---|
| 1 | `supplier_pcf_verified` | PCF fournisseur **vérifiée par tiers** ET unité **comparable** (même dimension physique, convertible) |
| 2 | `supplier_specific_hybrid` | PCF auto-déclarée comparable, **ou** intensité GES déclarée par le fournisseur **acceptée en revue** × dépense |
| 3 | `average_physical` | Facteur physique moyen × masse BOM (préférée) ou quantité de la ligne |
| 4 | `spend_based_economic` | Facteur monétaire × dépense |
| 5 | `unresolved` | **Aucune valeur** — la ligne reste dans les résultats avec ses raisons |

### Garanties et où elles sont vérifiées

| Garantie | Mise en œuvre | Test |
|---|---|---|
| **Aucun fallback silencieux** | Chaque niveau essayé laisse une entrée dans `method_trace` (retenu **ou** écarté, avec sa raison) ; `fallback_reason` agrège les raisons des niveaux supérieurs écartés ; CHECK SQL en renfort | `TestNoSilentFallbackPure` (paramétré sur 4 contextes) |
| **Aucune valeur inventée** | `unresolved` ⇒ `result_tco2e = None`, jamais `0.0` | `test_level_5_unresolved_has_no_value_at_all`, `test_unresolved_lines_are_present_with_null_not_zero` |
| **Méthode + facteur visibles** | `calculation_method`, `method_rank`, `factor_id`, `factor_version`, `factor_source` sur chaque ligne, affichés dans l'UI via `MethodBadge` | `TestMethodHierarchyPure`, `LinesPanel` |
| **Conversions explicites** | `convert_units` refuse deux dimensions différentes (retourne `None`, jamais une approximation) ; `conversion_factor` / `converted_unit` / `conversion_note` conservés | `TestUnitConversionPure`, `test_incomparable_units_force_fallback_not_a_guess` |
| **Reproductibilité** | Fonctions pures, sans horloge ni aléatoire, arrondi fixe `_ROUNDING = 9` ; `input_fingerprint` = SHA-256 canonique | `TestReproducibilityPure`, `test_pack_is_reproducible_byte_for_byte` |
| **Snapshot d'entrée immuable** | `input_snapshot JSONB` fige les lignes retenues ; un run reste relisible même si les achats changent | `test_pack_embeds_the_immutable_input_snapshot` |
| **Confiance ≠ risque ≠ statut** | `confidence` et `data_quality` sur la ligne ; le risque vit dans `scoring.py`, jamais fusionné | `test_confidence_is_a_separate_axis_from_data_quality` |
| **Gate humain** | Seuls les imports `validated`/`emitted` entrent dans un calcul ; seules les déclarations `accepted` et les mappings matières `accepted` sont utilisés | `test_pending_import_cannot_be_calculated`, `test_pending_declaration_never_used` |

### Incertitude & qualité — statut honnête de ces nombres

`METHOD_PROFILES` attache à chaque méthode une incertitude (10 % → 70 %) et une qualité
(0,95 → 0,25). **Ce sont des PARAMÈTRES CONVENTIONNELS de la méthodologie versionnée
`CC-SCOPE3-CAT1 v1.0.0`, pas des incertitudes mesurées sur la donnée réelle du
fournisseur.** Le module le dit explicitement dans son docstring, et `methodology.md` de
l'Evidence Pack le répète pour le lecteur externe. Les faire évoluer impose de changer
`METHODOLOGY_VERSION`, donc de recalculer explicitement.

---

## 4. Score fournisseur — 5 dimensions, jamais fusionnées

`services/procurement/scoring.py` — chaque dimension est une fonction **pure** de
comptages explicites :

| Code | Dimension | Direction | Base |
|---|---|---|---|
| `evidence_maturity` | Maturité des preuves | ↑ favorable | part sourcée (60 %) + vérifiée par tiers (40 %) |
| `ghg_data_quality` | Qualité des données GES | ↑ favorable | moyenne des `METHOD_PROFILES` pondérée par les lignes |
| `supply_concentration` | Concentration d'approvisionnement | ↑ **risque** | part de la dépense analysée |
| `location_exposure` | Exposition géographique | ↑ **risque** | origines inconnues (70 %) + dispersion multi-pays (30 %) |
| `compliance_response` | Conformité & réponse | ↑ favorable | taux de réponse (60 %) + réponses acceptées en revue (40 %) |

- **Aucun score agrégé.** `SupplierScoreCard` n'a aucun champ `score`/`rating`/`total` — un
  test le vérifie par introspection du modèle (`test_scorecard_model_has_no_aggregate_field`),
  pour qu'un ajout futur casse la CI plutôt que de passer inaperçu. Le champ
  `no_aggregate_score: Literal[True]` porte ce refus jusqu'au client.
- **`direction` obligatoire** sur chaque dimension : sans elle, « 80 » se lit aussi bien
  comme excellent que comme très exposé. L'UI colore selon la direction, pas selon la
  valeur brute.
- **Absence de donnée ⇒ `value = None`**, jamais `0` — avec un avertissement. Un trou
  d'information n'est pas une mauvaise performance (`TestMissingDataIsNotZero`).
- **Aucun score de risque pays normatif** (géopolitique, gouvernance, droits humains) :
  `location_exposure` reste descriptif (ce que l'on SAIT de l'origine). Un tel score
  serait un jugement opaque, hors périmètre, et exigerait une source qualifiée citable.
  Vérifié par `test_no_normative_country_risk_is_applied`.

---

## 5. Hotspots — détecter n'est pas décider

- `detect_hotspots` : agrégation déterministe, lecture seule, tri secondaire sur la clé
  pour lever les ex æquo. 4 dimensions (`supplier`, `supplier_product`, `category`,
  `country`), table de correspondance **fermée** (le `hotspot_type` vient d'un `Literal`
  Pydantic — aucune interpolation de valeur utilisateur dans le SQL).
- **Chaque hotspot expose sa part NON RÉSOLUE** (`unresolved_line_count`,
  `unresolved_spend_amount`) à côté de sa contribution : c'est « aucun fallback
  silencieux » transposé au niveau agrégé — un poste massivement non calculé ne doit pas
  passer pour un petit contributeur.
- `select_hotspot` : gate humain. **Les chiffres sont relus depuis le run**, jamais
  recopiés depuis le client (`test_selection_figures_come_from_the_run_not_the_client`).
- `create_campaign_from_selection` : refus **bruyant** si la sélection n'est pas
  `selected`, n'est pas de type `supplier`, ou ne porte pas un fournisseur du tenant.
  Le moteur de campagnes (024, `supplier_campaigns_service`) est **réutilisé** tel quel —
  création + invitation tokenisée + revue des réponses restent son affaire.

---

## 6. Enveloppe analytique — `models/analytics.py` est **CANONIQUE**

Les contrats §4 marquaient `models/analytics.py::AnalyticalEnvelope` « À INTRODUIRE par
la première PR Wave 2 qui expose un endpoint de calcul ». **PR-05B le crée : cette
version est la canonique.** Une PR sœur (PR-06B Scope 2) développée en parallèle pourrait
créer un module de même nom ; en cas de collision au merge, **conserver celui-ci** et y
rebrancher l'autre domaine, plutôt que de garder deux enveloppes divergentes.

Choix portés par les types, pas seulement par la doc :
- `AnalyticalMeta.method` **non optionnel** — pas de calcul sans méthode versionnée ;
- `DataStatus` **importé** de `models.intelligence`, jamais redéclaré (une seule source
  d'énumération) ;
- `confidence_to_display()` : point de conversion **unique** 0-1 (backend) → 0-100
  (présentation), pour que les deux échelles ne se mélangent jamais dans le stockage ;
- `EvidenceRef` ne contient **aucune URL** — que des références (`artifact_id`,
  `source_code`, `release_key`). Le téléchargement passe par le proxy authentifié.
- Générique (`Generic[DataT]`) : chaque domaine garde son `data` typé, pas de `dict` opaque.

Endpoints en enveloppe : `/runs/{id}/coverage`, `/runs/{id}/trace/{line_id}`,
`/hotspots`, `/exposures/{dimension}`. Les listes restent en enveloppe de **pagination**
(§5) : `{items, total, limit, offset}`.

---

## 7. Evidence Pack — réutilise le mécanisme existant

`services/procurement/evidence_pack.py` compose un ZIP auto-suffisant (`manifest.json`,
`run.json`, `line_results.json`, `coverage.json`, `methodology.md`, `README.txt`,
`CHECKSUMS.sha256`) en réutilisant `export_package` (mêmes helpers de hash/checksums,
même forme de manifest, même enregistrement dans `export_packages`).

**Conséquence directe :** `inspect_zip()` / `verify_zip()` — donc la page publique
`/verify/{hash}` — fonctionnent sur un pack de run **sans une ligne de code
supplémentaire**. Aucun second mécanisme de preuve n'est introduit (contrats §3).
Vérifié par `test_pack_passes_the_existing_integrity_checker`.

**Reproductibilité byte-à-byte** : manifest sans horodatage + entrées ZIP à date figée
(`1980-01-01`). Deux exports du même run donnent des octets identiques — c'est ce qui
rend la reproductibilité vérifiable de l'extérieur
(`test_pack_is_reproducible_byte_for_byte`).

---

## 8. Isolation tenant (contrats §7)

RLS gen-2 sur les 3 tables **et** défense en profondeur applicative : chaque requête de
service porte son prédicat `company_id = %s` explicite. Nécessaire parce que le
PostgreSQL de CI se connecte en **superuser**, qui bypasse la RLS y compris `FORCE` —
sans ce doublon, aucun test d'isolation ne passerait en CI (leçon PR-03 §15).

Exception documentée : `emission_factors` est un catalogue **global** (pas de
`company_id`) ; `_load_factors` n'a donc pas de prédicat de périmètre, délibérément et
avec un commentaire dans le code.

Tests d'isolation : run, line results, couverture, trace, liste de runs, détection de
hotspots, sélection, campagne, liste de sélections, scorecard, Evidence Pack — tous en
`TestCalculationIsolationDb` / `TestHotspotsIsolationDb` / `TestScoringDb`. Message
« introuvable » ⇒ **404, jamais 403** (pas de fuite d'existence, contrats §6).

---

## 9. Licence (contrats §8)

`license_policy.evaluate` (déterministe, sans LLM) est appelé sur la release de la donnée
réellement utilisée par chaque ligne (PCF d'abord, puis déclaration). Si
`allow_derived_use` est faux, un **avertissement tracé** est posé sur la ligne et
remonté au run — la valeur reste utilisée.

**Décision assumée :** le contrat §8 prescrit « warning sinon », pas un blocage. Nous
suivons le contrat plutôt que de durcir unilatéralement. Une politique plus stricte
(déclasser la ligne au niveau suivant avec une `fallback_reason` de licence) serait un
changement de contrat Wave 2, à trancher explicitement — le moteur y est prêt (il suffit
de transformer l'avertissement en échec de niveau dans `_try_supplier_pcf_verified` /
`_try_supplier_specific`).

---

## 10. Déviations / décisions justifiées

1. **Troisième table `procurement_hotspot_selections`** (le brief en nommait deux). La
   « sélection humaine des hotspots » et la « création contrôlée de campagne depuis les
   hotspots sélectionnés » exigent une persistance : qui a retenu quoi, quand, pourquoi,
   et quelle campagne en est née. Un hotspot étant une agrégation (pas une ligne), il n'y
   avait aucun endroit existant où porter cette décision. Ajoutée dans la **même**
   migration 032.
2. **Colonnes de preuve sur `procurement_line_results`** (`evidence_artifact_id`,
   `source_release_id`, `observation_id`) : rend le drill-down « résultat → pièce » direct
   et alimente `evidence[]` de l'enveloppe, au lieu de re-déduire après coup quelle source
   avait servi.
3. **Modèles PR-05B ajoutés à `models/procurement.py`** (plutôt qu'un module séparé) :
   foyer documenté du domaine par le plan §10, un seul site d'import pour le router.
4. **`/suppliers/{id}/risk` et `/suppliers/{id}/evidence-quality` servent la MÊME fiche.**
   Le plan §7 nomme deux chemins ; les cinq dimensions sont indissociables. Exposer un
   « score de risque » seul rouvrirait la porte au chiffre unique opaque interdit par
   §1.10. Les deux URL du plan sont honorées, aucune ne renvoie un score réduit.
5. **Recalcul forcé ⇒ `superseded`, jamais suppression** : l'historique reste auditable.
6. **`ORDER BY result_tco2e DESC NULLS LAST`** sur les lignes : les résultats chiffrés
   d'abord, les non résolus ensuite — mais dans **la même liste**, jamais filtrés par
   défaut ni relégués à un écran secondaire.
7. **Front : palette thème-aware** (`var(--color-*)` + variantes `dark:`) plutôt que la
   palette zinc sombre de `components/intelligence/`. La vue vit dans le groupe `(app)`
   aux côtés de `/fournisseurs/exposition`, qui supporte clair et sombre ; une page
   lisible seulement en sombre aurait été un défaut d'affichage.

---

## 11. Tests — exécutés vs skippés (pas de PostgreSQL local, comme PR-02/03/05A)

| Fichier | Purs (exécutés localement) | DB-gated (skippés local, CI `migration-tests`) |
|---|---|---|
| `test_procurement_calculation.py` | conversions d'unités, 5 méthodes, ordre de priorité, aucun fallback silencieux, incertitude, reproductibilité, agrégation | run bout en bout, idempotence, recalcul forcé, gate d'import, couverture, trace, approbation + fact, isolation (4 tests) |
| `test_procurement_hotspots.py` | gardes de dimension inconnue | classement déterministe, part non résolue, sélection idempotente, chiffres relus du run, campagne (créée / refusée × 2), exposition pays, isolation (4 tests) |
| `test_procurement_scoring.py` | absence de score agrégé, 5 dimensions, directions, données manquantes ≠ 0, chaque dimension | scorecard depuis la base, fournisseur inconnu, isolation |
| `test_procurement_evidence_pack.py` | canonicalisation JSON, contenu de `methodology.md` | contenu du pack, `inspect_zip`, reproductibilité byte-à-byte, manifest sans date, lignes non résolues, checksums, isolation |
| `test_migration_runner.py` | corpus 32→**33**, `032` = `apply` | — |

**Résultats locaux (Windows, sans Docker/PostgreSQL) :**
- `pytest tests/test_procurement_*.py` → **62 passed, 38 skipped** (DB-gated).
- Suite complète (`pytest -q --ignore=tests/test_health_storage_probe.py`) →
  **754 passed, 304 skipped, 5 failed** — les 5 échecs sont **préexistants**
  (`ModuleNotFoundError: vercel` dans `test_storage_adapter.py`, cf. PR-03 §10 et
  PR-05A §9), **zéro régression**.
- `python -m pytest tests/test_migration_runner.py::test_build_plan_against_real_migrations_directory` → **passed** (valide le ledger sans PostgreSQL).
- `ruff check . --select=E,F,I --ignore=E501` → **All checks passed**.
- Frontend : `npm ci --legacy-peer-deps` (915 pkgs) ; `npm run lint` → **0 erreur**
  (20 warnings, tous préexistants, aucun dans mes fichiers) ; `npm run build` →
  **succès**, route `/fournisseurs/scope3` compilée.

**CI :** les 4 fichiers sont ajoutés au job `migration-tests` de
`.github/workflows/api.yml`. Sans cela ils ne tourneraient **nulle part** et passeraient
silencieusement.

---

## 12. Compteurs de ledger mis à jour (piège connu)

| Fichier | Avant | Après |
|---|---|---|
| `tests/test_migration_runner.py` (`len(versions)`) | 32 | **33** (+ `"032"` dans les asserts de présence et `actions["032"] == "apply"`) |
| `tests/test_migration_ledger.py` (`written_count`, **4 occurrences** ≈ l. 144, 254, 304, 523) | 33 | **34** |
| `db/migration_manifest.py` | — | entrée `"032"` |
| `db/migration_probes.py` | — | `_probe_032` + enregistrement + helper `_constraint_exists` |
| `tests/_migration_fixtures.py` | `apply_upto("031")` | `apply_upto("032")` |
| `tests/_procurement_fixtures.py` | `apply_upto("030")` | `apply_upto("032")` + 3 tables et effets de bord au teardown |

---

## 12bis. Ce que la CI a trouvé et qui a été corrigé (aller-retour assumé)

L'aller-retour CI annoncé au §15 a bien eu lieu, en quatre passages :

| Passage | Résultat | Nature des échecs |
|---|---|---|
| 1 (`c2d1439`) | 378 passed, **11 failed** | 3 défauts réels (ci-dessous) |
| 2 (`38acfa7`) | 388 passed, **2 failed** | hypothèses de test invalidées par le partage de données |
| 3 (`d857eda`) | 389 passed, **1 failed** | régression introduite par le refactor du passage 2 |
| 4 (`3f64108`) | **390 passed, 0 failed** | — `migration-tests` **verte** |

Les tests DB-gated de cette PR ont donc **réellement tourné** en CI (ils sont skippés
localement, faute de PostgreSQL). Défauts trouvés et corrigés :

1. **Clé de hotspot NULL sur les lignes non rattachées** (9 échecs). Les dimensions
   `category`/`country` avaient leur `COALESCE`, pas `supplier`/`supplier_product` : une
   ligne d'achat non mappée produisait `hotspot_key = NULL`, rejeté par Pydantic.
   Corrigé par une clé stable `UNKNOWN_KEY = 'inconnu'`. **Le fond compte plus que le
   symptôme** : un poste non rattaché doit rester VISIBLE au classement avec sa dépense
   et ses lignes non résolues — l'escamoter aurait été précisément le trou silencieux que
   cette PR s'interdit. Aucune campagne n'est possible dessus (pas de fournisseur à
   interroger) ; test dédié
   `test_unmapped_lines_form_a_visible_unknown_bucket`.
2. **`UNIQUE(company_id, input_fingerprint)` incompatible avec le recalcul forcé.**
   L'idempotence et la conservation de l'historique se contredisaient : le run archivé
   occupait la clé et bloquait son remplaçant. Remplacé par un **index unique partiel**
   (`WHERE status <> 'superseded'`), et la recherche d'idempotence exclut désormais les
   runs archivés (même prédicat des deux côtés).
3. **Test de niveau 2 non déterministe.** Il réutilisait le code produit partagé `SKU-A`
   alors que `two_companies_proc` est de portée module : plusieurs fournisseurs du tenant
   finissaient par porter un `SKU-A`, et la ligne était rattachée à un autre fournisseur
   que celui portant la déclaration. Test rendu univoque (`SKU-INTENSITY`).

   **Défaut PR-05A signalé au passage, NON corrigé ici** (hors périmètre, code mergé) :
   `purchase_import_service._auto_map` fait
   `SELECT id, supplier_id FROM supplier_products WHERE company_id = %s AND product_code = %s`
   puis `fetchone()` — **sans `ORDER BY` ni `LIMIT`**. Or l'unicité porte sur
   `(company_id, supplier_id, product_code)` : deux fournisseurs d'un même tenant peuvent
   légitimement partager un code produit. Le rattachement est alors **arbitraire**, et une
   ligne d'achat peut être imputée au mauvais fournisseur — ce qui fausserait ensuite les
   hotspots et le score de concentration. À traiter dans une PR dédiée (rendre le mapping
   déterministe, ou le refuser en le renvoyant en file de résolution quand il est ambigu —
   ce second choix est le plus cohérent avec « aucun fallback silencieux »).

4. **Régression du refactor de test** (passage 3 → 4). En isolant les données de chaque
   test, `_validated_import` est passé de « reçoit un CSV » à « reçoit un marqueur et
   construit le CSV » — mais un appelant lui passait encore un CSV complet. Les deux
   paramètres étant des `str`, rien ne le signalait avant l'exécution : le CSV entier
   était interpolé comme marqueur et le parseur rejetait le résultat. Corrigé par un
   paramètre `csv_text` explicite et optionnel. Rappel utile : un refactor de signature
   entre deux types identiques ne se voit qu'à l'exécution.

---

## 13. Prohibitions dures — confirmations

- **Aucune migration 001-031 modifiée** — seul `032_procurement_scope3_hotspots.sql`
  ajouté (vérifié : un seul nouveau `.sql` dans le diff).
- **Aucun LLM** nulle part dans le chemin de calcul, de sélection de méthode, de
  détection de hotspot ou de scoring. La sélection de facteur est une **correspondance
  exacte de catégorie**, jamais un rapprochement flou. `mapping_method='ai_draft'` reste
  un ancrage typé réservé à PR-11, rien n'est exécuté.
- **Aucun score ESG opaque** — garanti par l'absence structurelle de champ agrégé, testée.
- **Aucun fallback silencieux** — garanti en Python **et** par un CHECK SQL.
- **Aucune écriture prod** — aucune migration appliquée contre une base réelle, aucun
  appel réseau sortant dans le code livré. PR non mergée automatiquement.
- **Aucune dépendance à du code PR-04/PR-06 non mergé.**

---

## 14. Fichiers partagés / infra touchés

`db/migration_manifest.py` (`032`), `db/migration_probes.py` (`_probe_032` +
`_constraint_exists`), `tests/_migration_fixtures.py` (`build_full_db`→032),
`tests/_procurement_fixtures.py` (schéma→032, helpers PR-05B, teardown élargi),
`tests/test_migration_runner.py` + `tests/test_migration_ledger.py` (compteurs),
`.github/workflows/api.yml` (4 fichiers DB-gated), `models/procurement.py` (modèles
PR-05B), `models/analytics.py` (**créé — canonique**), `routers/procurement.py`
(endpoints PR-05B), `routers/suppliers.py` (`/risk`, `/evidence-quality`),
`apps/carbon/lib/api/procurement.ts`, `apps/carbon/app/(app)/fournisseurs/page.tsx`
(lien), `apps/carbon/data/feature-status.json` (feature `scope3-achats-hotspots`, BETA).

**`main.py` n'est PAS modifié** : les routers `/procurement` et `/products` y sont déjà
enregistrés depuis PR-05A ; PR-05B ne fait qu'étendre leurs endpoints.

---

## 15. Ce qui n'est prouvé QUE par la CI — et qui l'est effectivement

Aucun PostgreSQL ni Docker sur le poste de développement (Windows) : **tous** les tests
DB-gated sont skippés localement. Ils ont bien tourné en CI (`migration-tests` verte au
4ᵉ passage, **390 passed**, cf. §12bis). Ne sont donc vérifiés QUE là :

- l'applicabilité de la migration 032 après 031, et ses contraintes CHECK ;
- `_probe_032` et l'absence de faux `drift_detected` après `apply` ;
- l'isolation tenant réelle (RLS + défense en profondeur) ;
- le run de bout en bout, l'idempotence par fingerprint, le gate d'import ;
- la création de campagne depuis un hotspot et ses refus ;
- l'Evidence Pack (contenu, intégrité, reproductibilité).

L'aller-retour CI annoncé (leçon PR-02/03/05A) a effectivement été nécessaire — voir
§12bis pour ce qu'il a révélé.

> **Note sur `gitleaks`.** Un des deux runs dupliqués du workflow a échoué pendant
> l'incident d'API GitHub du 2026-07-20 : l'action plante sur
> `GET /repos/.../pulls/109/commits` (HTTP 503) **avant** de scanner quoi que ce soit —
> aucun secret n'est en cause. Le run jumeau, au même commit, est vert. À relancer si le
> check reste rouge.

---

## 16. Points ouverts / risques honnêtes

1. **`input_snapshot` peut devenir volumineux** sur un import de plusieurs milliers de
   lignes (une entrée JSON par ligne). C'est le prix de l'immuabilité réelle du snapshot.
   Si cela devient un problème de taille, la piste est de stocker le snapshot comme
   `evidence_artifact` (Blob) et de ne garder que son SHA-256 en base — non fait ici pour
   ne pas complexifier une première version.
2. **Résolution de facteur volontairement conservatrice** : correspondance **exacte** de
   `category_code` (minuscules) avec `emission_factors.category`. Un catalogue dont les
   catégories ne correspondent pas aux codes des fichiers d'achat produira beaucoup de
   lignes `unresolved` — c'est le comportement voulu (visible et corrigeable) plutôt
   qu'un rapprochement flou, mais cela demandera un travail de correspondance de
   référentiel côté données, hors périmètre de cette PR.
3. **Intensité fournisseur en `tCO2e/M€` uniquement** (`INTENSITY_METRIC_CODES` liste
   fermée de 2 codes). Une déclaration exprimée dans une autre unité n'est pas
   réinterprétée — elle est ignorée pour le niveau 2. Élargir le catalogue de
   `metric_code` demande de le documenter ici (contrats §1).
4. **Pas d'endpoint HTTP pour `claim_link_service`** sur les résultats de calcul : les
   `claim_type` `purchase_line` / `procurement_run` étaient réservés par PR-05A §4 mais ne
   sont pas encore consommés — les références de preuve passent par les colonnes de
   `procurement_line_results`. À rebrancher si une PR ultérieure a besoin de liens
   preuve↔run explicites.
5. **Frontend non testé en E2E** : aucun `.spec.ts` Playwright ajouté pour
   `/fournisseurs/scope3` (la page exige un backend avec PostgreSQL et des données
   d'achat validées). Lint et build passent ; le rendu réel n'a pas été exercé.

---

## 17. Opérations post-merge (Ludo, hors code)

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `032` seule en `apply`) → `apply` → `verify`
   (`{"anomalies": []}`, exerce `_probe_032`) → `GET /health/schema` :
   `schema_version:"032"`, `up_to_date:true`.
3. Vérif applicative : importer un CSV d'achats, le **valider** en revue, puis
   `POST /procurement/calculate` → vérifier que le total s'affiche **avec** son taux de
   couverture et ses lignes non résolues ; relancer le même calcul → `already_calculated:true`,
   aucun doublon.
4. Vérifier un Evidence Pack : télécharger, `sha256sum -c CHECKSUMS.sha256`, puis déposer
   le ZIP sur `/verify` → statut `authentic`.
5. Observation 24-48 h (permissions `carbonco_app` sur les 3 nouvelles tables). Consigner
   `MIGRATIONS_RUNBOOK.md` §9.
