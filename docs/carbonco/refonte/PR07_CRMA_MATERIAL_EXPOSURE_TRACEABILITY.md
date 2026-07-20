# PR-07 — CRMA, aimants permanents et exposition matières critiques : traçabilité

**Branche :** `feat/crma-material-exposure` · **Base :** `origin/master` (`df13229`)
**Migration :** `034_crma_material_exposure.sql` (seule migration ajoutée)
**Spécification :** `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §12 (Phase 6) + prompt PR-07 (§ « PR-07 — CRMA / exposition matières »)
**Contrats respectés :** `WAVE_2_INTERFACE_CONTRACTS.md` §2 (data_status), §3 (evidence), §4 (enveloppe analytique), §5 (pagination), §6 (erreurs), §7 (RLS gen-2 + défense en profondeur), §8 (licence)

---

## 1. Ce qui a été construit

### Schéma — migration `034` (11 tables)

**Référentiels à portée mixte** (`company_id BIGINT` NULLABLE : `NULL` = ligne globale lisible par tous les tenants, non nul = ligne tenant) :

| Table | Rôle |
|---|---|
| `material_groups` | Regroupements de matières — familles industrielles **et** statuts réglementaires |
| `material_group_members` | Appartenance matière → groupe (porte le statut critique/stratégique) |
| `processing_stages` | Étapes **ordonnées** de la chaîne de valeur (`stage_order`, `is_upstream`) |
| `material_stage_observations` | Part d'un pays dans une matière **à une étape donnée** |
| `material_market_observations` | Prix / volumes de marché — `source_release_id` **NOT NULL** |
| `substitutes` | Alternatives, par étape et par application |
| `recycling_routes` | Filières de recyclage, avec étape de réinjection |
| `trade_or_regulatory_events` | Contrôles export, quotas, sanctions, incidents |

**Tables tenant strictes** (`company_id BIGINT NOT NULL`) :

| Table | Rôle |
|---|---|
| `company_material_exposures` | Exposition réelle : matière × BOM × fournisseur × site × stock |
| `crma_article24_assessments` | Évaluation Article 24 — `risk_score` et `confidence` en **deux colonnes** |
| `mitigation_actions` | Actions d'atténuation rattachées à une évaluation |

### Backend

| Fichier | Contenu |
|---|---|
| `apps/api/db/migrations/034_crma_material_exposure.sql` | 11 tables, RLS gen-2, GRANT conditionnel, semis des 8 étapes |
| `apps/api/models/crma.py` | Modèles Pydantic (miroir 1:1 des colonnes et des CHECK) |
| `apps/api/services/crma/scoring.py` | **Calcul PUR** du CarbonCo Material Exposure Score |
| `apps/api/services/crma/reference_service.py` | Groupes, statut réglementaire, étapes, substituts, recyclage, événements |
| `apps/api/services/crma/stage_service.py` | Observations par étape, chaîne de valeur, marché sous licence |
| `apps/api/services/crma/exposure_service.py` | Expositions tenant + orchestration du score + enveloppe analytique |
| `apps/api/services/crma/article24_service.py` | Évaluations, gate de revue, actions, rapport Article 24 |
| `apps/api/routers/crma.py` | 24 endpoints, préfixe `/crma` |
| `apps/api/main.py` | Enregistrement du routeur (`tags=["crma (PR-07)"]`) |

### Frontend

| Fichier | Contenu |
|---|---|
| `apps/carbon/lib/api/crma.ts` | Client typé + helpers de présentation (`riskBand`, `confidenceBand`, `formatPct`) |
| `apps/carbon/app/(app)/crma/page.tsx` | Page BETA : statut, score, chaîne de valeur, composantes, alternatives, recyclage, expositions/stocks, marché, actions, preuves |
| `apps/carbon/app/(app)/layout.tsx` | Entrée `pageConfig` pour `/crma` |
| `apps/carbon/data/feature-status.json` | Feature `crma-exposition-matieres`, `statut: "beta"` |

---

## 2. Le modèle d'étapes

**Chaîne de valeur (MVP aimants permanents), 8 étapes ordonnées :**

```
extraction (10, amont) → separation (20, amont) → refining (30) → metal_alloy (40)
  → powder (50) → magnet (60) → component (70) → product (80)
```

`is_upstream` distingue l'amont extractif (`extraction`, `separation`) de la transformation. `stage_order` matérialise l'ordre amont → aval.

**Ces 8 lignes sont semées par la migration** (global, `company_id IS NULL`), via `SET LOCAL app.rls_bypass = 'on'` — l'idiome d'écriture globale des contrats §7. C'est un **vocabulaire structurel**, pas une donnée factuelle sur le monde : aucune part pays, aucun chiffre, aucun prix. Il n'y a donc aucune source externe à citer, et la prohibition « aucune donnée externe réelle ingérée » est respectée.

### Comment le schéma rend le mélange d'étapes impossible

`material_stage_observations.stage_code` est **NOT NULL**. Il n'existe donc, au niveau du schéma, aucune façon d'enregistrer une « part pays globale » qui fondrait extraction et raffinage. La contrainte d'unicité inclut l'étape (`company_id, material_id, stage_code, country_code, reference_year`), et l'index de calcul est `(material_id, stage_code, reference_year)` : tout agrégat passe nécessairement par une étape.

Côté calcul, `scoring.compute_stage_concentration` **lève** (`ScoringError`) si on lui passe une observation d'une autre étape que celle demandée — le mélange est une erreur bruyante, pas un arrondi silencieux.

Côté agrégation, la composante `stage_concentration` prend le **maximum** sur les étapes : elle *sélectionne* une étape (dont le `stage_code` est reporté dans la composante) au lieu de *fusionner* les étapes. Une moyenne entre extraction et raffinage produirait un chiffre ne décrivant aucun marché réel. Même geste pour `third_country_dependency`.

---

## 3. Le score : composantes et méthode versionnée

**Nom :** CarbonCo Material Exposure Score
**Méthode :** `CC-MATERIAL-EXPOSURE`, version `0.1.0` (`scoring.METHODOLOGY_CODE` / `METHODOLOGY_VERSION`)

### Composantes de risque (poids nominaux)

| Code | Poids | Mesure |
|---|---|---|
| `stage_concentration` | 0.30 | HHI de l'étape la plus concentrée (une étape nommée, pas une moyenne) |
| `third_country_dependency` | 0.15 | Part hors UE de l'étape la plus dépendante |
| `supplier_dependency` | 0.15 | HHI des fournisseurs du tenant |
| `substitutability` | 0.10 | Maturité de la meilleure alternative + pénalité de performance |
| `recycling_potential` | 0.10 | Maturité de la meilleure filière + contenu recyclé |
| `stock_coverage` | 0.10 | Couverture de stock en jours (la **plus faible** déclarée) |
| `regulatory_events` | 0.10 | Sévérité des événements **actifs** à la date d'analyse |

Chaque composante est un `ScoreComponent` portant `raw_value`/`raw_unit` (ce qui a été mesuré), `risk_value`, `weight`, `contribution`, `rationale` en français et `stage_code` le cas échéant. **Le score n'est jamais un nombre opaque** : `risk_score` est exactement la somme des `contribution` publiées (test `test_risk_score_equals_sum_of_contributions`).

### Composantes de confiance — dimension séparée

| Code | Poids | Mesure |
|---|---|---|
| `stage_coverage` | 0.30 | Étapes documentées / étapes totales |
| `data_quality` | 0.25 | Mix de `data_status` (verified 1.0 · manual 0.7 · estimated 0.5 · inferred 0.3) |
| `component_coverage` | 0.20 | Composantes de risque calculables / 7 |
| `freshness` | 0.15 | Écart d'années par rapport à la date d'analyse |
| `license_access` | 0.10 | Part des données de marché exploitables au regard de leur licence |

### Règles non négociables, et où elles sont tenues

| Règle | Implémentation | Test |
|---|---|---|
| Jamais présenté comme un score officiel UE | `scoring.DISCLAIMER` attaché à chaque résultat ; `Article24Report.is_official_eu_score = False` sérialisé dans l'export | `test_disclaimer_denies_official_eu_status`, `test_report_denies_official_eu_status_in_the_payload`, `crma-presentation.test.ts` |
| Risque ≠ confiance | Deux sorties, deux jeux de composantes, deux colonnes SQL, deux CHECK d'intervalle. Aucune ligne ne multiplie l'une par l'autre | `test_adding_data_quality_changes_confidence_not_risk`, `test_confidence_components_never_appear_in_risk_components` |
| Concentration par étape | `stage_code` NOT NULL ; partition avant calcul ; max et non moyenne | `test_extraction_and_refining_stay_separate`, `test_extraction_stays_separate_from_refining` (DB) |
| Extraction jamais mêlée au raffinage | `ScoringError` si une observation d'une autre étape est fournie | `test_observation_of_another_stage_is_rejected` |
| Prix affichés seulement si la licence l'autorise | `license_policy.evaluate` à **chaque lecture** ; `numeric_value` mis à `None` côté serveur | `test_price_is_withheld_when_display_not_allowed` |
| `allow_derived_use` avant tout calcul dérivé | Observations bloquées exclues et comptées → dégradent la **confiance** | `test_derived_use_refused_lowers_confidence_not_risk` |
| Méthodologie versionnée | `methodology_code`/`methodology_version` sur l'évaluation et dans `input_snapshot` | `test_input_snapshot_makes_the_calculation_reproducible` |
| Composantes séparées et inspectables | `components` JSONB, une entrée par composante avec sa justification | `test_components_are_stored_separately_and_inspectable` |

### Donnée absente ≠ risque nul

Une composante sans donnée est marquée `available=False` et **exclue** du calcul, les poids restants étant renormalisés. Elle n'est jamais comptée à zéro : compter « aucun substitut recensé » comme « risque de substitution nul » inverserait le sens de l'information. Corollaire assumé : moins il y a de composantes, plus la confiance baisse.

Cas particulier des événements : **aucun événement enregistré** → composante *indisponible* (« absence de donnée, pas absence d'événement »). **Des événements enregistrés mais aucun actif** → composante *disponible* au plancher 10 (le registre a bien été consulté). La distinction est testée (`test_no_events_recorded_is_unavailable_not_safe`, `test_events_recorded_but_none_active_is_available_and_low`).

Si **aucune** composante n'est disponible, `risk_score` vaut `None` avec un avertissement explicite — mieux vaut l'absence de score qu'un chiffre inventé.

---

## 4. Statut critique / stratégique : non exclusif

Le statut n'est **pas** porté par deux booléens sur une table `materials` (où rien n'empêcherait `strategic=true, critical=false`) mais par l'appartenance aux groupes `eu_critical` / `eu_strategic` dans `material_group_members`. Une matière peut donc appartenir aux deux — c'est structurellement non exclusif.

`reference_service.get_material_status` recompose `is_critical_eu` / `is_strategic_eu` et **signale** l'incohérence via `strategic_not_critical` au lieu de la corriger en silence : toute matière stratégique doit aussi être critique, et une violation doit remonter (jusque dans l'UI, testid `crma-status-inconsistent`). Testé par `test_strategic_without_critical_is_flagged_not_silently_fixed`.

---

## 5. Licence : ce qui est garanti

`material_market_observations.source_release_id` est **NOT NULL** — une donnée de marché sans source est impossible à insérer. La licence n'est **jamais dénormalisée** en base : elle est réévaluée par `license_policy.evaluate` à chaque lecture, pour qu'une licence révoquée produise un masquage immédiat.

Trois droits distincts sont appliqués :

- **`allow_store`** faux → l'enregistrement est **refusé** (rien n'est écrit).
- **`allow_display`** faux → `numeric_value`, `unit` et `currency` sont retirés de la réponse **côté serveur** (`value_withheld=True` + `license_reasons`). La valeur ne quitte pas l'API. Masquer seulement à l'affichage laisserait la donnée dans la charge utile JSON, donc accessible : ce ne serait pas une garantie.
- **`allow_derived_use`** faux → l'observation est exclue du calcul et comptée dans `license_blocked_count`, ce qui **dégrade la confiance, jamais le risque**.

Aucune décision de licence n'est prise par un LLM : `license_policy.evaluate` est déterministe et rend ses raisons.

---

## 6. Preuves et liens BOM

- Les observations d'étape citent `source_release_id` et `evidence_artifact_id` (Evidence Kernel, PR-03). Un CHECK SQL (`*_sourced_check`) interdit `data_status = 'verified'` sans release sur `material_stage_observations`, `substitutes`, `recycling_routes` et `trade_or_regulatory_events` : une ligne non sourcée doit s'avouer `estimated`/`manual`/`inferred`.
- `exposure_service.evidence_refs` renvoie des **références** (`artifact_id`, `source_code`, `release_key`, `stage_code`), jamais des URL (contrats §4, testé par `test_evidence_refs_expose_artifacts_not_urls`).
- `company_material_exposures` se rattache à `bom_items` et `material_mappings` (PR-05A), à `suppliers`, `supplier_sites` et `products`. Chaque FK est **vérifiée dans le périmètre du tenant avant insertion**, avec un message identique pour « inexistant » et « hors périmètre » (anti-IDOR, pas de fuite d'existence — contrats §6).

---

## 7. RLS et défense en profondeur

RLS **génération 2** sur les 11 tables : `ENABLE` + `FORCE`, policies scopées **par commande** (`SELECT`/`INSERT`/`UPDATE`/`DELETE`), `DROP POLICY IF EXISTS` avant chaque `CREATE` (rejouable par `startup_event` en dev), GRANT conditionnel `carbonco_app`.

- **Lecture** : `company_id IS NULL` (ligne globale) **OU** la ligne du tenant.
- **Écriture** : tenant **uniquement** — jamais `IS NULL`. Un test parcourt `pg_policies` et échoue si une clause `WITH CHECK` contient `company_id IS NULL` (`test_write_policies_never_allow_global_rows`).

**La RLS ne suffit pas en CI.** Le PostgreSQL de CI se connecte en superuser, qui **bypasse la RLS y compris `FORCE`**. Chaque requête de service porte donc son prédicat de périmètre explicite : `_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"` pour les référentiels, `_SCOPE = "company_id = %s"` pour les tables tenant. Dans `get_material_status`, le prédicat est écrit sur **chaque table jointe** séparément (pas de manipulation de chaîne). C'est ce doublon — et non la RLS — que vérifient les tests d'isolation.

**Aucun trigger n'a été ajouté par cette migration**, donc aucune allégation sur `SECURITY DEFINER` n'est faite nulle part. (Rappel du piège connu : `SECURITY DEFINER` ne bypasse **pas** `FORCE RLS` ; seuls superuser/BYPASSRLS le font.)

---

## 8. Ledger de migrations

| Point d'ancrage | Modification |
|---|---|
| `db/migration_manifest.py` | Entrée `"034"` (`requires_owner=False`, `transactional=True`, note détaillée) |
| `db/migration_probes.py` | `_probe_034` + enregistrement dans `MIGRATION_OBJECT_PROBES` |
| `tests/_migration_fixtures.py` | `build_full_db` → `apply_upto(conn, "034")` |
| `tests/test_migration_runner.py` | `len(versions) == 32` → **33** ; `"034" in versions` ; `actions["034"] == "apply"` ; nouveau test `test_build_plan_detects_034_pending_on_baselined_ledger` |
| `tests/test_migration_ledger.py` | Les **4** `written_count == 33` → **34** (lignes 144, 254, 304, 523) |
| `.github/workflows/api.yml` | 3 fichiers DB-gated ajoutés au job `migration-tests` + libellé de l'étape |

`_probe_034` sonde les 11 tables, leur policy `tenant_isolation_<table>`, `FORCE ROW LEVEL SECURITY`, **et** la présence des 8 étapes globales : une base où les tables existent mais où le vocabulaire d'étapes manque produirait des chaînes de valeur vides sans erreur — elle est incomplète et doit rester détectée comme telle (même logique que le trigger sondé par `_probe_031`).

**Trou de numérotation assumé.** Master s'arrête à `031` ; `032` et `033` sont réservées à d'autres tranches parallèles et absentes du dossier. Le ledger n'exige **aucune contiguïté** (il trie sur le préfixe numérique), ce qui est désormais explicitement testé (`test_build_plan_detects_034_pending_on_baselined_ledger` vérifie que `034` reste la dernière du plan malgré le trou). Le compte de fichiers passe bien de 32 à 33, conformément aux compteurs figés.

`_energy_fixtures.py` (`apply_upto(conn, "031")`) est **volontairement laissé inchangé** : c'est le fixture propre à PR-06A, la migration 034 ne le concerne pas, et le modifier créerait un conflit inutile avec les tranches sœurs.

---

## 9. Déviations par rapport au plan, assumées

| Déviation | Raison |
|---|---|
| **Pas de table `materials`** ; `material_id` reste `TEXT` sans FK | Le référentiel matières relève de `033_material_reference_crma.sql` (arborescence cible du plan), **non fusionnée**. PR-07 ne peut pas dépendre d'un travail non mergé. `TEXT` est exactement le type déjà retenu par `material_mappings.material_id` (migration 030), dont le commentaire annonçait « référentiel matières global = PR-07 ». Une migration ultérieure pourra promouvoir ces colonnes en FK. |
| **Pas de `material_exposure_runs` / `material_exposure_results`** (présentes au plan §12.3) | Hors du périmètre de tables fixé pour cette PR. Le score est calculé **à la demande** par une fonction pure et persisté, quand il doit l'être, dans `crma_article24_assessments` (`components`, `drivers`, `input_snapshot`, `calculated_at`) — ce qui couvre la reproductibilité exigée par les contrats §4 sans ajouter de table non prévue. Une tranche B pourra introduire les runs si l'historisation fine devient nécessaire. |
| **`mitigation_actions`** et non `crma_mitigation_actions` (nom du plan §12.3) | Nom fixé par le périmètre de tables de cette PR. |
| **Composante « volatilité des prix » non implémentée** (plan §12.4 : « volatilité seulement si données licenciées ») | Aucune série de prix réelle n'existe (prohibition d'ingestion externe), donc aucune volatilité calculable honnêtement. La plomberie de licence est en place (`market_usability`) et alimente déjà la confiance ; la composante de risque pourra être ajoutée quand une source licenciée existera. Ne pas l'implémenter valait mieux que produire une volatilité sur des données inventées. |
| **`DataStatusBadge` non utilisé tel quel dans la page `/crma`** | Ce badge est explicitement « stylé pour les surfaces sombres du module /materials » (`text-emerald-300` etc.) ; la page vit dans le shell thémé `(app)` et l'utiliser en thème clair aurait été une régression de contraste. La **fonction de mapping partagée** `dataStatusToBadge` est en revanche réutilisée (contrats §2 : une seule logique de vocabulaire), avec un rendu de pastille thémé. Un passage ultérieur pourra ajouter une variante claire au composant partagé. |
| **`/crma` absente de la sidebar** | Comme `/intelligence/sources` (PR-04), une page BETA interne ne s'ajoute pas au menu principal sans décision produit. La feature est déclarée dans `feature-status.json` avec son `href`. |

---

## 10. Tests

### Exécutés localement (sans PostgreSQL) — **755 passés**

| Suite | Résultat |
|---|---|
| `tests/test_crma_scoring.py` | **31 passés** — la méthode elle-même (concentration par étape, séparation risque/confiance, donnée absente ≠ risque nul, licence, monotonies, déterminisme, disclaimer) |
| `tests/test_migration_runner.py` | 27 passés (dont le nouveau test 034) |
| Suite backend complète | 724 passés · 333 skippés (DB-gated, attendu) |
| `apps/carbon` vitest | **172 passés** (dont 10 nouveaux `crma-presentation.test.ts`) |
| `ruff check .` | All checks passed |
| `npm run lint` | 0 erreur (20 warnings pré-existants, aucun dans les fichiers CRMA) |
| `npm run build` | Compilé ; route `/crma` présente ; `/materials` et `/materials/[id]` intacts |

`services/crma/scoring.py` est **sans I/O** précisément pour cela : les règles du score sont prouvées partout, pas seulement en CI.

### Prouvés en CI uniquement (DB-gated, job `migration-tests`)

| Fichier | Couverture |
|---|---|
| `tests/test_crma_reference.py` | Vocabulaire des 8 étapes semées ; critique **vs** stratégique non exclusif ; incohérence signalée ; substituts et filières ; `verified` sans source refusé ; RLS `ENABLE`+`FORCE` sur les 11 tables ; policies par commande (pas de `ALL`) ; écriture globale interdite ; isolation tenant |
| `tests/test_crma_exposure.py` | Idempotence des observations ; **extraction non mêlée au raffinage contre une vraie base** ; enveloppe analytique ; gating de licence (affichage retenu, stockage refusé, usage dérivé → confiance) ; liens BOM/mapping ; anti-IDOR ; concentration fournisseur ; stock minimal retenu ; références de preuve sans URL |
| `tests/test_crma_article24.py` | Cycle de vie ; recalcul qui n'approuve jamais ; approbation exigeant un humain ; évaluation approuvée non recalculable ; composantes inspectables ; `input_snapshot` reproductible ; action sans effet sur le score ; rapport complet et démenti « score officiel » ; isolation tenant |

**Résultat CI confirmé :** le job `migration-tests` est **vert** (`356 passed`), ce qui prouve que la migration `034` s'applique réellement (semis des 8 étapes sous `app.rls_bypass`, contraintes, index partiels) et que les trois fichiers CRMA **tournent bien** — ils ne sont pas silencieusement collectés à vide.

### Deux défauts que seul le CI pouvait révéler

1. **Fixtures non résolues.** Les fixtures définies dans `_crma_fixtures.py` doivent être **ré-exportées par `tests/conftest.py`** (comme `_energy_`, `_intelligence_` et `_procurement_fixtures`), sinon pytest échoue au setup avec « fixture `crma_schema` not found ». Le défaut est **invisible en local** : sans `DATABASE_URL`, les marqueurs `skipif` court-circuitent les tests *avant* toute résolution de fixture, donc la suite passe au vert en les comptant comme skippés. Pour vérifier localement sans PostgreSQL, pointer `DATABASE_URL` vers un port fermé : l'erreur doit devenir une `OperationalError` de connexion, **pas** « fixture not found ».
2. **Ruff plus strict en CI qu'en local.** Le job `validate` lance `ruff check . --select=E,F,I --ignore=E501`, qui active **isort** — absent de la configuration ruff du dépôt utilisée par un simple `ruff check .`. Pour isort, des blocs d'import séparés par des commentaires ne forment qu'**un seul** bloc à trier : les quatre modules de fixtures doivent rester en ordre alphabétique. Valider avec la commande exacte de la CI, pas seulement `ruff check .`.

### Note gitleaks

Le scan de secrets a d'abord signalé `material_id="test-secret-mat"` dans les tests d'isolation (règle `generic-api-key` : le mot « secret » suivi d'une affectation de chaîne). Ce n'était pas un secret mais un identifiant de matière fictive. Les identifiants ont été **renommés** (`test-isolated-*`) plutôt qu'ajoutés à une allowlist, qui aurait affaibli le scan pour tout le dépôt. La branche a ensuite été **écrasée en un seul commit** : la chaîne subsistait dans l'historique de la branche, que le scan déclenché par `pull_request` parcourt intégralement (contrairement au scan `push`, qui ne voit que les commits poussés). L'arbre est inchangé par cet écrasement — même hash `de6e265`.

---

## 11. Prohibitions respectées

- **Aucune modification des migrations 001–031.** Seul `034_crma_material_exposure.sql` est ajouté.
- **Aucune écriture de production.** Aucun script d'application ; `db-migrate.yml` reste le seul chemin d'écriture schéma.
- **Aucune source externe, aucun scraping, aucun accès réseau.** Aucune donnée CRMA réelle n'est ingérée. Les fixtures utilisent des pays fictifs (`XA`, `XB`, …) et des matières préfixées `test-`, toutes `estimated`. Le seul contenu semé par la migration est le vocabulaire des 8 étapes, structurel et sans chiffre.
- **Aucun LLM décideur.** Aucun appel de modèle. `license_policy.evaluate` est déterministe ; le score est arithmétique et reproductible ; l'approbation Article 24 exige un utilisateur humain identifié.
- **Aucun prix affiché sans droit de licence** (§5 ci-dessus).
- **Aucun score opaque** : composantes séparées, `risk_score` = somme des contributions publiées.
- **Aucun score présenté comme officiel UE** : `disclaimer` sur chaque résultat, `is_official_eu_score=False` dans l'export, garde-fou côté front.
- **`/materials` non régressé** : aucun fichier du module touché ; `materials-data-trust.test.ts` et `feature-registry.test.ts` verts ; les deux routes se prérendent toujours.

---

## 12. Reliquats

1. **Composante de volatilité des prix** — à ajouter quand une source licenciée réelle existera (§9).
2. **Runs d'exposition historisés** (`material_exposure_runs`/`results`) — si l'historisation fine devient nécessaire.
3. **Promotion de `material_id` en FK** vers `materials` une fois `033` fusionnée.
4. **Variante claire de `DataStatusBadge`** pour permettre sa réutilisation directe dans le shell `(app)`.
5. **Export Article 24 en fichier** (PDF/paquet) — le rapport est aujourd'hui exposé en JSON typé (`GET /crma/assessments/{id}/report`) ; le brancher sur `services/export_package.py` relève d'une tranche ultérieure.
6. **Rattachement automatique BOM → exposition** — aujourd'hui l'exposition est déclarée explicitement ; dériver les expositions depuis `material_mappings` acceptés serait le prolongement naturel côté PR-05B.
