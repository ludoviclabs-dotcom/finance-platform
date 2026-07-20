# PR-05A — Fondation exposition achats / fournisseurs / BOM · Traçabilité

**Périmètre :** tranche A du plan `PR05_PROCUREMENT_EXPOSURE_IMPLEMENTATION_PLAN.md` —
socle d'exposition et de données (migration `030`). **AUCUN** calcul Scope 3,
hotspot ou score fournisseur (tout cela = PR-05B, migration `031+`).
**Base :** `origin/master` (contient migration 028 Evidence Kernel + docs Wave 2).
Ne dépend d'aucun code PR-04/PR-06 non mergé.
**Statut : implémenté, en attente de CI PostgreSQL (`migration-tests`). PR non mergée automatiquement.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **HORS PÉRIMÈTRE (PR-05B)**.

---

## 1. Périmètre livré

| # | Élément | Statut | Preuve |
|---|---|---|---|
| 1 | Migration 030 (9 tables + RLS gen-2 + probe) | **FAIT** | `apps/api/db/migrations/030_procurement_exposure.sql` |
| 2 | Modèles Pydantic | **FAIT** | `apps/api/models/procurement.py` (+ claim link dans `models/intelligence.py`) |
| 3 | Services procurement (4) | **FAIT** | `apps/api/services/procurement/*.py` |
| 4 | `claim_link_service` (dette PR-03 comblée) | **FAIT** | `apps/api/services/intelligence/claim_link_service.py` |
| 5 | Router `/procurement` + `/products` + extensions `/suppliers/{id}/…` | **FAIT** | `apps/api/routers/procurement.py`, `products.py`, `suppliers.py` |
| 6 | Import idempotent par SHA-256 + gate + file de résolution | **FAIT** | `purchase_import_service.py`, tests dédiés |
| 7 | Déclarations & PCF sourcées (observation + preuve + claim link) | **FAIT** | `declarations_service.py` |
| 8 | Tests (unitaires purs + DB-gated + ledger) | **FAIT** | 4 fichiers `test_procurement_*` / `test_claim_links.py` |
| 9 | Frontend : vue exposition + file de résolution + gate (BETA) | **FAIT** | `apps/carbon/app/(app)/fournisseurs/exposition/page.tsx`, `lib/api/procurement.ts` |
| 10 | Calcul Scope 3 / hotspots / score 5-dim | **HORS PÉRIMÈTRE (PR-05B)** | — |

---

## 2. Migration 030 (`requires_owner=False`)

9 tables, toutes `id BIGSERIAL`, `company_id BIGINT NOT NULL`, `created_at`/`updated_at` :
`supplier_sites`, `supplier_products`, `purchase_imports`, `purchase_lines`,
`bom_versions`, `bom_items` (self-FK arbre), `material_mappings`,
`supplier_metric_declarations`, `product_carbon_footprints`.

**Idempotence de contenu** : `purchase_imports UNIQUE(company_id, sha256)` — améliore
`import_screenings` (022) qui n'a pas de hash. **Confidence séparé du statut** :
`material_mappings.confidence NUMERIC (CHECK 0-1)` distinct de `review_status`
(contrats §2). **Sourcing** : `supplier_metric_declarations` / `product_carbon_footprints`
portent `observation_id`, `evidence_artifact_id`, `source_release_id`, `data_status`.

**RLS génération 2** (pattern 028) : `ENABLE`+`FORCE`, 4 policies scopées par commande
(`SELECT`/`INSERT`/`UPDATE`/`DELETE`), `NULLIF(current_setting('app.current_company_id'))::bigint`,
`app.rls_bypass`, `DROP POLICY IF EXISTS` avant chaque `CREATE`. GRANT conditionnel
`carbonco_app` sur les 9 tables + séquences (même geste que 027/028).

**Sonde ledger** : `_probe_030` (existence des 9 tables + policy `tenant_isolation_<t>` +
`FORCE ROW LEVEL SECURITY`), enregistrée dans `MIGRATION_OBJECT_PROBES["030"]`.
`migration_manifest.py` → entrée `"030"`. `build_full_db` (fixtures) → `apply_upto("030")`.

**FK BIGINT → PK INTEGER** (`suppliers.id`, `products.id`, `companies.id` sont `SERIAL`) :
valide en PostgreSQL (comparaison croisée int4/int8), même geste que 028.

---

## 3. Services (`apps/api/services/procurement/`)

| Module | Responsabilité |
|---|---|
| `supplier_sites_service.py` | CRUD sites & produits fournisseurs ; garde de périmètre du fournisseur (anti-IDOR). |
| `purchase_import_service.py` | Parse CSV **pur** (réutilise `csv_import_parsers`), import **idempotent sha256**, mapping auto CONSERVATEUR (mappé seulement si `product_external_code` correspond à **exactement un** `supplier_products.product_code` du tenant), file de résolution, gate `pending→validated/rejected`. |
| `bom_service.py` | BOM versionnée + arbre d'items (résolution `parent_index`→id serveur, parents avant enfants), mapping matières + gate de revue. |
| `declarations_service.py` | Déclarations & PCF **sourcées** via `observation_service` + `claim_link_service`. |
| `intelligence/claim_link_service.py` | **Nouveau** — voir §4. |

**Défense en profondeur** (contrats §7) : chaque requête porte son prédicat de périmètre
explicite EN PLUS de la RLS. Tables procurement à portée tenant STRICTE (`company_id NOT NULL`,
aucune ligne globale) → prédicat `company_id = %s` en lecture et écriture. Nécessaire car le
PostgreSQL de CI se connecte en superuser (bypass RLS).

**Aucun fallback silencieux** : une ligne d'achat non rattachée reste `unmapped`
(file de résolution) ou `needs_review` (pas de donnée d'activité), jamais devinée.
Le cas **ambigu** (un `product_code` partagé par plusieurs fournisseurs du même
tenant — l'unicité `supplier_products` porte sur `(company_id, supplier_id,
product_code)`, pas sur le code seul) est couvert par un statut dédié
`ambiguous` durci en base par une contrainte CHECK — voir
`docs/carbonco/refonte/WAVE_3_STABILIZATION_TRACEABILITY.md` §1 pour le détail
complet (migration 035, `_auto_map`, 5 tests DB-gated dédiés).
**Aucun LLM** : `material_mappings.mapping_method='ai_draft'` est un point d'ancrage réservé
(PR-11), documenté ; aucune logique IA en PR-05A.

---

## 4. `claim_link_service` — contrat pour réutilisation (comble la dette PR-03)

`claim_evidence_links` (migration 028) n'avait ni service ni endpoint en PR-03. PR-05A livre
`services/intelligence/claim_link_service.py`. **Les PR suivantes (liens IRO PR-10, etc.)
le réutilisent — ne pas le redupliquer.**

| Fonction | Signature | Notes |
|---|---|---|
| `create_link` | `(*, company_id, payload: ClaimEvidenceLinkCreate, created_by=None) -> ClaimEvidenceLinkResponse` | Vérifie que l'artefact cité est dans le périmètre (le sien ou global) avant d'insérer. |
| `get_link` | `(*, company_id, link_id) -> ClaimEvidenceLinkResponse` | 404-like (`ClaimLinkError`) si hors périmètre. |
| `list_links` | `(*, company_id, claim_type=None, claim_key=None, limit, offset) -> tuple[list, int]` | Filtres sur `(claim_type, claim_key)`. |
| `validate_relation_type` | `(relation_type) -> None` | Garde défensive : `relation_type ∈ {supports, contradicts, contextualizes, derived_from}` (`VALID_RELATION_TYPES`, dérivé du `Literal` Pydantic = source unique alignée au CHECK SQL). |

**Modèles** : `ClaimEvidenceLinkCreate` / `ClaimEvidenceLinkListResponse` ajoutés à
`models/intelligence.py` (foyer naturel de la table du noyau).
**Conventions `claim_type`/`claim_key` posées par PR-05A** : `supplier_declaration` /
`product_carbon_footprint` (claim_key = id de la ligne). Réservés PR-05B : `purchase_line`,
`procurement_run`. Pas d'endpoint HTTP en PR-05A (service consommé en interne) — délibéré,
§7 du plan ne l'exige pas.

---

## 5. Sourcing — conventions d'observation (contrats §1/§2, à réutiliser)

| Objet | `subject_type` | `subject_key` | `metric_code` |
|---|---|---|---|
| Déclaration produit | `supplier_product` | `supplier_product:{id}` | celui de la déclaration (pass-through) |
| Déclaration fournisseur | `supplier` | `supplier:{id}` | celui de la déclaration (pass-through) |
| PCF | `supplier_product` | `pcf:{supplier_product_id}` | `pcf_kgco2e` |

Exemples de `metric_code` de déclaration (libres, portés par la ligne) : `ghg_scope1_tco2e`,
`ghg_scope2_tco2e`, `ghg_scope3_tco2e`, `ghg_intensity_tco2e_per_meur`, `renewable_share_pct`.
Une valeur AVEC `source_release_id` → observation immuable créée (citée par `observation_id`) ;
une valeur SANS release reste `manual` sans observation (honnête, pas un faux « vérifié »).

---

## 6. Endpoints

`/procurement` (`get_current_user` en lecture — JWT réel, PAS `get_company_id` ; `require_analyst`
en écriture) : `POST/GET /imports`, `GET /imports/{id}`, `/imports/{id}/lines|errors|resolution-queue`,
`POST /imports/{id}/resolve-mappings`, `POST /imports/{id}/review`, `POST/GET /declarations`,
`GET /declarations/{id}`, `POST/GET /pcfs`, `GET /pcfs/{id}`.
`/products` (router dédié) : `POST/GET /{id}/boms`, `GET /{id}/boms/{version}`,
`POST /{id}/boms/{version}/map-materials`, `POST /{id}/boms/{version}/mappings/{mid}/review`.
`/suppliers` (extensions) : `GET/POST /{id}/sites`, `GET/POST /{id}/products` — routes paramétrées
+ suffixe, aucun conflit d'ordonnancement avec les routes littérales (`/scope3`, `/campaigns`).

Pagination §5, erreurs §6 (helper partagé `routers/_errors.py`, voir §8), isolation §7.

---

## 7. Frontend (BETA)

- `apps/carbon/lib/api/procurement.ts` : client typé (réutilise `API_BASE_URL`/`getAuthToken` du
  client principal, pas de second mécanisme d'auth).
- `apps/carbon/app/(app)/fournisseurs/exposition/page.tsx` : vue exposition — import CSV idempotent,
  liste d'imports, drill-down lignes, **file de résolution** (marquer résolu), **gate de revue**
  (valider/rejeter), KPIs honnêtes (dépense couverte, % résolu) ; états loading/empty/error,
  `aria-label`. **Aucun chiffre d'émission** (PR-05B).
- `apps/carbon/app/(app)/fournisseurs/page.tsx` : lien « Exposition achats » + badge BETA.
- `apps/carbon/data/feature-registry` (`data/feature-status.json`) : feature `exposition-achats`
  statut `beta`.

---

## 8. Déviations / décisions (justifiées)

1. **`routers/_errors.py` introduit** (candidat À CONFIRMER, contrats §6) : `http_error` + `require_db`
   factorisés, utilisés par les nouveaux routers (procurement/products/suppliers-extensions).
   `routers/intelligence.py` (PR-03 mergé, testé) conserve sa copie locale identique — non rebranché
   pour ne pas déstabiliser une surface figée. Documenté dans le module.
2. **Router `/products` dédié** pour `/products/{id}/boms` (le CRUD DPP vit sous `/dpp/products` →
   `/products` racine libre, aucune capture de chemin). Honnête au contrat d'URL du plan §7.
3. **RLS : clause de lecture globale `OR company_id IS NULL` conservée** sur des tables `NOT NULL`
   (donc inerte) — copie byte-identique de 028 pour reconnaissance/relecture. La défense en
   profondeur des services est plus stricte (`company_id = %s`), ce qui est le but.
4. **Artefact de l'import brut non enregistré dans le chemin d'import** : l'idempotence repose sur
   `sha256` stocké sur `purchase_imports` (pas besoin du noyau). Le sourcing par `evidence_artifacts`
   + `claim_link` est appliqué là où il est REQUIS (déclarations/PCF). Lier un fichier d'achat brut
   reste possible via `claim_link_service` (`claim_type='purchase_import'`) pour une PR ultérieure.
5. **`emitted`** (gate) reste un statut valide RÉSERVÉ à PR-05B (scellement vers le calcul) ;
   `review_import` s'arrête à `validated`/`rejected` en PR-05A.
6. **Re-upload idempotent renvoie 201 + `already_imported=true`** (plutôt que 200) — le flag porte
   la sémantique d'idempotence ; aucun doublon de ligne créé.

---

## 9. Tests — exécutés vs skippés (pas de PostgreSQL local, comme PR-02/03)

| Fichier | Purs (exécutés) | DB-gated (skippés local, CI `migration-tests`) |
|---|---|---|
| `test_claim_links.py` | validation `relation_type` (Literal + service) | create/scope/list/CHECK SQL |
| `test_procurement_imports.py` | parse CSV (`,`/`;`, dates FR), logique sha256 | import idempotent, mapping auto, gate, file de résolution, isolation |
| `test_procurement_bom.py` | validation arbre `parent_index` | arbre BOM (self-FK), drill-down, mapping+gate, unicité version, isolation |
| `test_procurement_declarations.py` | — | déclaration/PCF sourcée = observation + claim link ; manuel = sans observation ; isolation |
| `test_migration_runner.py` | 030 = `apply` sur ledger baseliné (mocké) | — |

**Résultats locaux** :
- `pytest tests/test_procurement_*.py tests/test_claim_links.py tests/test_migration_runner.py` →
  **44 passed, 27 skipped** (DB-gated).
- Suite complète (`pytest --ignore=tests/test_health_storage_probe.py`) → **642 passed, 224 skipped,
  5 failed** — les 5 échecs sont préexistants (`ModuleNotFoundError: vercel`, `test_storage_adapter.py`,
  cf. PR03 §10), **zéro régression**.
- `ruff check . --select=E,F,I --ignore=E501` → **All checks passed**.
- Frontend : `npm ci` (915 pkgs) ; `eslint` → **0 erreur** (mes fichiers propres) ; `tsc --noEmit` →
  0 erreur dans mes fichiers (seules erreurs préexistantes `@vercel/analytics`/`mapbox-gl` ailleurs) ;
  `next build` → **succès**, route `/fournisseurs/exposition` compilée.

CI : `test_claim_links.py`, `test_procurement_imports.py`, `test_procurement_bom.py`,
`test_procurement_declarations.py` ajoutés au job `migration-tests` (`.github/workflows/api.yml`).
Ledger : `test_migration_ledger.py` `written_count` 30→31 (30 fichiers `.sql` + `000`) ;
`test_migration_runner.py` corpus 29→30 (+030).

---

## 10. Prohibitions dures — confirmations

- **Aucun calcul Scope 3, aucun hotspot, aucun score fournisseur** (tout PR-05B). Vérifié : aucune
  table `procurement_*_runs`/`*_results`, aucun `services/calculations/`, aucun `scoring.py`.
- **Aucune migration 001-029 modifiée** — seul `030_procurement_exposure.sql` ajouté (vérifié : un
  seul nouveau `0NN.sql` dans le diff ; 029 absent de cette branche, = PR-04).
- **Aucun LLM, aucune décision IA** — `ai_draft` = ancrage typé documenté, rien d'exécuté.
- **Aucune écriture prod** — aucune migration appliquée contre une base réelle, aucun appel réseau
  sortant dans le code livré. PR non mergée automatiquement.
- **Aucune dépendance à du code PR-04/PR-06 non mergé.**

---

## 11. Fichiers partagés / infra touchés

`main.py` (routers procurement/products), `db/migration_manifest.py` (`030`),
`db/migration_probes.py` (`_probe_030`), `tests/_migration_fixtures.py` (`build_full_db`→030),
`tests/conftest.py` (fixtures procurement), `tests/test_migration_runner.py` +
`tests/test_migration_ledger.py` (compteurs 30→31 / 29→30), `.github/workflows/api.yml`
(4 fichiers DB-gated), `routers/suppliers.py` (sites/products + import `_errors`),
`models/intelligence.py` (modèles claim link), `apps/carbon/…/fournisseurs/page.tsx` +
`data/feature-status.json`.

---

## 12. Opérations post-merge (Ludo, hors code)

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `030` seule en `apply`) → `apply` → `verify`
   (`{"anomalies": []}`, exerce `_probe_030`) → `GET /health/schema` : `schema_version:"030"`,
   `up_to_date:true`.
3. Vérif applicative : `POST /procurement/imports` (JWT analyst) avec un CSV de test → lignes ;
   re-upload du même contenu → `already_imported:true`, aucun doublon.
4. Observation 24-48h (permissions `carbonco_app` sur les 9 nouvelles tables). Consigner
   `MIGRATIONS_RUNBOOK.md` §9.
5. PR-05B (calcul/scoring) planifiée séparément une fois PR-05A stabilisée.
