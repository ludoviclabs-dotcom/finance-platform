# PR-M2B — Expositions & assessments des ressources stratégiques : traçabilité

**Branche :** `feat/resources-assessment-engine` · **Base :** `origin/master` `14e57b1` (PR #127 mergée, schéma `042`)
**Migration ajoutée :** `043_resource_exposures_assessments.sql` (seule migration — **043 vérifié**, dernière du dossier = 042)
**Architecture :** `MODULE2_DATA_MODEL.md` §3, `MODULE2_RLS_AND_SECURITY.md`, `MODULE2_TEST_STRATEGY.md` · **Décisions :** D-1..D-6, A-1..A-6

---

## 1. Ce qui a été construit

### Schéma — migration `043` (4 tables neuves)

| Table | Portée | Rôle |
|---|---|---|
| `resource_supply_observations` | mixte | Part pays PAR ÉTAPE (entrée du HHI), sourcée |
| `company_resource_exposure_links` | tenant strict | Pont vers BOM/achat/énergie/eau/déclaration (D-1), CHECK « une seule cible » |
| `resource_assessment_runs` | tenant strict | Run IMMUABLE (risque, confiance, couverture, `input_hash`) |
| `resource_assessment_dimensions` | tenant strict | Composantes du run (risque ET confiance, `detail` séparé, provenance) |

RLS gen-2 FORCE + policies par commande. **Triggers d'immutabilité** : `trg_resource_run_immutable` (input_snapshot/input_hash/chiffres figés, motif `scope2_run_immutability_guard` 033) et `trg_resource_dimension_immutable` (append-only). **Aucun ALTER** — `requires_owner=False`. `iros_origin_domain_check` **non élargie** (émission IRO reportée ; `iro_signal_id` = FK nullable forward-compat).

### Backend

| Fichier | Contenu |
|---|---|
| `db/migrations/043_resource_exposures_assessments.sql` | 4 tables, RLS gen-2, 2 triggers d'immutabilité, GRANT conditionnel |
| `db/migration_manifest.py` / `db/migration_probes.py` | entrée `"043"` + `_probe_043` (tables + RLS FORCE + **triggers d'immutabilité** + CHECK cible/source) |
| `models/resources.py` | modèles supply/exposure/assessment + `ResourceAssessmentResult`/`ResourceDimension` (sortie pure) |
| `services/resources/scoring.py` | **calcul PUR** — HHI 0-10000, couverture, risque≠confiance, `input_hash`, sensibilité OAT |
| `services/resources/supply_service.py` | observations (garde source) |
| `services/resources/exposure_link_service.py` | pont d'exposition (anti-IDOR, D-4 : aucun carbone) |
| `services/resources/assessment_service.py` | orchestration (gate licence), run immuable + dimensions, alertes dérivées |
| `routers/resources.py` | +9 endpoints (supply, exposures, assessments, dimensions, alerts) |

### Tests

| Fichier | Job | Contenu |
|---|---|---|
| `tests/test_resources_scoring.py` | `tests` (non-DB) | **21 tests statistiques PURS** (voir §3) |
| `tests/test_resources_assessment.py` | `migration-tests` (DB) | sonde 043, RLS A/B, source, licence, reproductibilité, immutabilité, IDOR, API |
| `tests/_resources_fixtures.py` | — | schéma→043, cleanup tables M2B, `seed_global_supply` |
| `.github/workflows/api.yml` | — | `test_resources_assessment.py` inscrit dans `migration-tests` |

---

## 2. Méthodes mathématiques validées (`scoring.py`)

- **HHI = Σ parts² au barème canonique 0-10000** (`herfindahl(scale=10000)`). Réutilise la MÉTHODE de `services/crma/scoring.py` — CRMA (0-100) **non modifié**, aucune régression (`herfindahl(scale=100)` disponible).
- **`observed_hhi`** (étape la plus concentrée, sélection jamais fusion), **`coverage_pct`** (marché documenté), **`missing_share_pct`** (`100 − observed_total`). Garde de couverture (`MIN_STAGE_COVERAGE_PCT=50`) : sous le seuil, HHI **publié mais signalé** — la confiance baisse, le risque non.
- **Dimensions de substituabilité SÉPARÉES** : `detail={maturity, penalty_pct, maturity_residual}` — jamais un opaque unique.
- **`evidence_coverage`** (part des observations sourcées) + confiance dédiée.
- **Risque ≠ confiance** : deux sorties, jamais multipliées. Manquant ≠ zéro (composante exclue, poids renormalisés). **Données obligatoires manquantes ⇒ `risk_score=None`** (aucun indice inventé).
- **`input_hash`** : sha256 déterministe des ENTRÉES → reproductibilité. **Analyse de sensibilité OAT** (±20 % sur les poids, bande de stabilité, tornado).

---

## 3. Tests obligatoires (mission) — couverture

| Test | Où | Statut |
|---|---|---|
| monopole = 10 000 | `test_resources_scoring::TestHhi/TestComputeStage` | ✅ (exécuté local) |
| quatre parts égales = 2 500 | idem | ✅ |
| couverture incomplète | `test_partial_coverage_reported` / `test_low_coverage_flags_but_still_scores` | ✅ |
| parts invalides | `test_invalid_share_rejected` | ✅ |
| années différentes | `test_mixed_years_rejected` | ✅ |
| étapes différentes | `test_mixed_stage_rejected` | ✅ |
| unités incompatibles | `test_incompatible_units_rejected` / `test_share_and_volume_mix_rejected` | ✅ |
| absence de source | `test_verified_without_source_rejected` (DB) | ⏳ CI |
| licence bloquante | `test_blocked_license_degrades_confidence_not_risk` (DB) | ⏳ CI |
| reproductibilité | `test_reproducible_input_hash_and_score` (pur) + `test_run_is_reproducible` (DB) | ✅ / ⏳ |
| tenant A/B | `test_*_tenant_isolated` (DB) | ⏳ CI |
| immutabilité | `test_run_is_immutable_in_db` (DB, trigger) | ⏳ CI |

---

## 4. Écarts de périmètre assumés

- **Émission de signal IRO (D-5) reportée** : `iros_origin_domain_check` non élargie ; `iro_signal_id` reste une FK nullable inutilisée. Évite un ALTER dans 043 (reste new-tables-only). À implémenter dans une tranche ultérieure (avec la migration `DROP/ADD CONSTRAINT` documentée dans `MODULE2_DATA_MODEL.md` §3.E).
- **`resource_roles` / `resource_stage_applicability` (D-1/D-6) toujours reportés** : le rôle est porté par la colonne CHECK `company_resource_exposure_links.role` ; les étapes proviennent des observations. La table de vocabulaire d'étapes par famille (D-6) reste à venir.
- **Union legacy `material_stage_observations`** (034) dans le HHI : reportée — l'assessment lit `resource_supply_observations`. Le pont substituts, lui, réutilise les `substitutes` CRMA via l'alias legacy (D-2).
- **Alertes** : dérivées lecture seule (dépendance élevée, données périmées), aucune table neuve ni règle persistée.

---

## 5. Vérifications exécutées

**Locales (sans Docker/PostgreSQL) :**
- `py_compile` : OK. `ruff check . --select=E,F,I --ignore=E501` (depuis `apps/api`, comme CI) : **All checks passed**.
- **`test_resources_scoring.py` : 21 passed** (le cœur mathématique, prouvé en local).
- Suite **non-DB** complète : **1019 passed / 713 skipped / 0 failed** (les 18 skips M2B = DB-gated).
- `from main import app` : 375 routes, `/resources/assessments`, `/resources/exposures/link`, `/resources/alerts` présents. `git diff --check` propre.

**DB-gated — CI `migration-tests` UNIQUEMENT** (pas de Postgres local — aller-retour CI attendu) : sonde 043, RLS A/B, immutabilité (trigger), reproductibilité, source, licence, anti-IDOR, API.

**Compteurs de ledger** : `build_full_db` 042→043 ; runner `len` 43→44 + asserts 043 + test « dernière version » 042→043 ; ledger `written_count` 44→45 ×4.

---

## 6. Opérations post-merge (Ludo, hors code)

`db-migrate.yml` → `plan` (confirmer 043 seule pending) → `apply` → `verify` → `/health/schema` `schema_version=043`.

## 7. NEXT_ACTION

**Frontend (PR-M2C)** — cockpit `/resources` (catalogue, fiche, expositions, assessments, méthodologie). Une PR à la fois, sur décision de Ludo. Cf. `MODULE2_IMPLEMENTATION_PLAN.md`.
