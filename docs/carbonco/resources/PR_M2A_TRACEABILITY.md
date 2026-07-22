# PR-M2A — Catalogue & statuts réglementaires des ressources : traçabilité

**Branche :** `feat/resources-catalog-foundation` · **Base :** `origin/master` `f30cfc5` (PR #126 mergée, schéma `041`)
**Migration ajoutée :** `042_resource_catalog_foundation.sql` (seule migration — **042 vérifié réellement**, dernière du dossier = 041)
**Architecture :** `MODULE2_DATA_MODEL.md`, `MODULE2_API_CONTRACTS.md`, `MODULE2_RLS_AND_SECURITY.md`, `MODULE2_TEST_STRATEGY.md` · **Décisions :** `MODULE2_DECISIONS.md` (D-1..D-6, A-1..A-6)

---

## 1. Ce qui a été construit

### Schéma — migration `042` (4 tables neuves, portée mixte tenant/globale)

| Table | Rôle |
|---|---|
| `resource_catalog` | Référentiel canonique (slug, famille, `source_release_id`) |
| `resource_aliases` | Alias legacy / externes (`legacy_material_id`/CAS/EC/HS-CN/REACH…), pont D-2 |
| `resource_regulatory_statuses` | Statut par régime (crma/eudr/reach…), **sourcé**, NON exclusif |
| `resource_sector_uses` | Usages sectoriels (classification supply-chain seulement) |

RLS gen-2 FORCE + policies par commande + GRANT conditionnel `carbonco_app`. **Aucun ALTER d'une table existante** (requires_owner=False). **Aucune donnée semée.**

### Backend

| Fichier | Contenu |
|---|---|
| `apps/api/db/migrations/042_resource_catalog_foundation.sql` | 4 tables, RLS gen-2, GRANT conditionnel |
| `apps/api/db/migration_manifest.py` | entrée `"042"` (requires_owner=False, transactional=True) |
| `apps/api/db/migration_probes.py` | `_probe_042` (tables + RLS FORCE + policy + CHECK sourcés) + registre |
| `apps/api/models/resources.py` | modèles Pydantic (Literal miroir des CHECK 042) |
| `apps/api/services/resources/catalog_service.py` | catalogue, résolution slug, alias, usages, reverse-lookup legacy |
| `apps/api/services/resources/regulatory_service.py` | statuts réglementaires, garde source |
| `apps/api/routers/resources.py` | 5 endpoints GET `/resources/catalog[...]`, `schema_ready_guard` |
| `apps/api/main.py` | enregistrement du routeur (`tags=["resources (Module 2 / PR-M2A)"]`) |

### Tests

| Fichier | Contenu |
|---|---|
| `apps/api/tests/_resources_fixtures.py` | schéma→042, 2 companies, ressource globale, cleanup |
| `apps/api/tests/test_resources_catalog.py` | lecture globale, isolation, source obligatoire, pont alias, usages, RLS gen-2 |
| `apps/api/tests/test_resources_regulatory.py` | statut non exclusif, source `confirmed`, isolation, filtre régime, **flux API** |
| `apps/api/tests/conftest.py` | enregistrement des fixtures resources |
| `.github/workflows/api.yml` | 2 fichiers de test inscrits dans le job `migration-tests` |
| `_migration_fixtures.py`, `test_migration_runner.py`, `test_migration_ledger.py` | **compteurs ledger mis à jour** (voir §4) |

---

## 2. Périmètre — écart assumé vs `MODULE2_DATA_MODEL.md` §2

La mission PR-M2A liste **4 tables** ; le modèle cible en groupait 6 dans la migration 042. **`resource_roles` (D-1)** et **`resource_stage_applicability` (D-6)** sont **reportés à PR-M2B (migration 043)**, là où ils sont réellement consommés (rôles exercés par le pont d'exposition ; vocabulaire d'étapes par le moteur d'assessment). Aucune perte : le catalogue + la réglementation ne dépendent d'aucun des deux. Écart documenté ici, `MODULE2_DATA_MODEL.md` reste la cible (non modifié dans cette PR).

---

## 3. Garanties (mission) — comment elles sont tenues

| Garantie | Mécanisme |
|---|---|
| **aucune donnée réglementaire sans source_release** | CHECK `resource_regulatory_statuses_sourced_check` (`certainty='confirmed' ⇒ source_release_id NOT NULL`) **+** garde service ; test `confirmed`-sans-source rejeté. Idem `data_status='verified'` sur catalog/uses. |
| **statuts non exclusifs** | Une **ligne par régime** dans `resource_regulatory_statuses`, jamais un booléen ; test « crma ET eudr coexistent ». |
| **ressources globales en lecture** | RLS SELECT = `company_id IS NULL OR = tenant` ; test « la ressource globale est vue par A et B ». |
| **aucune écriture globale par un tenant** | Policies INSERT/UPDATE = `company_id = tenant` (jamais `IS NULL`) ; service écrit toujours `company_id` ; test `with_check` ne contient jamais `company_id IS NULL`. |
| **aucun booléen réglementaire permanent** | Aucune colonne `is_critical`/`is_strategic` — statut porté par des lignes. |
| **aucun ancien material_id supprimé** | `resource_aliases(alias_kind='legacy_material_id')` + `find_by_legacy_material_id` ; test de reverse-lookup. Aucune table 030/034 touchée. |
| **aliases pour identifiants historiques** | `resource_aliases` (legacy/CAS/EC/HS-CN/REACH/internal/other). |
| **aucune migration historique modifiée** | 042 ne crée que des tables neuves, **zéro ALTER** ; manifeste requires_owner=False ; `git diff` ne touche aucun `.sql` existant. |
| **données structurelles strictement nécessaires** | 042 **ne sème AUCUNE ligne** — les ressources canoniques sont des DONNÉES chargées via Source Admin / Evidence Kernel (hors migration). |

**Sécurité Défense/Spatial :** `resource_sector_uses.use_label`/`criticality_note` = classification d'usage seulement. Aucune colonne technique ; aucune recette/formulation/proportion/paramètre de fabrication/propergol/propulsion — par conception (`MODULE2_RLS_AND_SECURITY.md` §7).

---

## 4. Compteurs de ledger mis à jour (obligatoire à chaque migration)

- `_migration_fixtures.py::build_full_db` : `apply_upto("041")` → **`"042"`**.
- `test_migration_runner.py` : `len(versions) == 42` → **43** ; ajout `assert "041"/"042" in versions`, `assert actions["042"] == "apply"` ; test « dernière version pending » repointé **041 → 042**.
- `test_migration_ledger.py` : 4× `written_count == 43 (000+42 fichiers)` → **44 (000+43 fichiers, 001-042 dont 008b)**.
- `migration_probes.py` : `_probe_042` enregistré → `test_migration_probes.py` (paramétré sur `MIGRATION_OBJECT_PROBES`) le couvre automatiquement (False sur base vide, True sur base pleine).

---

## 5. Vérifications exécutées

**Locales (cette machine, sans Docker/PostgreSQL) :**
- `py_compile` : OK sur tous les fichiers nouveaux/modifiés.
- `ruff check . --select=E,F,I --ignore=E501` (depuis `apps/api`, exactement comme la CI) : **All checks passed**.
- Suite **non-DB** complète (job `tests`, mode /tmp) : **998 passed, 695 skipped, 0 failed** — les 695 skips incluent les tests DB-gated resources.
- `from main import app` : 366 routes, `/resources/catalog` présent.
- `git diff --check` : propre.

**DB-gated — CI `migration-tests` (`postgres:16`) UNIQUEMENT** (contrainte connue : pas de Postgres local, CI = seule preuve réelle — aller-retour attendu comme sur PR-02→PR-11) : sonde `_probe_042`, RLS A/B, CHECK `sourced`, pont alias, flux API. **À surveiller au premier run.**

---

## 6. Opérations post-merge (Ludo, hors code)

1. `db-migrate.yml` → `command=plan` (confirmer 042 seule pending) → `baseline`/`apply` selon l'état → `verify` → `/health/schema` `schema_version=042, up_to_date=true`.
2. Charger les ressources canoniques (données) via le service d'import / Source Admin — jamais par la migration.

## 7. NEXT_ACTION

**PR-M2B — Expositions & assessments** (migration 043 : `resource_supply_observations`, `company_resource_exposure_links`, `resource_assessment_runs`, `resource_assessment_dimensions`, `resource_roles`, `resource_stage_applicability`, élargissement `iros_origin_domain_check`). Une PR à la fois, sur décision explicite de Ludo. Cf. `MODULE2_IMPLEMENTATION_PLAN.md`.
