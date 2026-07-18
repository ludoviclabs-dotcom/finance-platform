# PR-05 — Exposition achats / fournisseurs · Plan d'implémentation

**Branche prévue :** `feat/procurement-exposure`
**Phase du plan d'architecture :** Phase 4 (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §10, §20) — « Exposition achats/fournisseurs ».
**Statut de ce document :** plan uniquement. Aucune écriture de code, aucune migration, aucune donnée. Rien commité hors `docs/carbonco/refonte/`.
**Contrats communs :** `WAVE_2_INTERFACE_CONTRACTS.md`.

> **Constat de départ (inspection lecture seule).** Le module fournisseurs est **déjà mûr** : tables `suppliers` / `supplier_questionnaire_tokens` / `supplier_answers` / `supplier_campaigns`, service `supplier_service` + `supplier_campaigns_service`, endpoints `/suppliers/*`, et surtout **deux pipelines « collecte → gate humain → Scope 3 » existants** : (a) campagne → invitation tokenisée → réponse publique → **revue** (`review_status` pending/accepted/flagged) → écrit `suppliers.ghg_estimate_tco2e` ; (b) import d'émissions (`import_screenings`, gate `pending→emitted` → `facts_events`). PR-05 **branche l'exposition achats sur ces briques**, ne les réinvente pas. Le noyau 028 (dont le commentaire nomme explicitement « achats » comme futur consommateur) fournit le sourcing/preuve.

---

## 1. Périmètre

Relier **achats → fournisseurs → produits → matières → facteurs → calcul → preuve**, avec un drill-down complet et des imports idempotents. Découpé en deux tranches ; **PR-05A** réserve la migration `030`.

**PR-05A (migration `030`) — Exposition & données :**
1. **Sites fournisseurs** (`supplier_sites`) et **produits fournisseurs** (`supplier_products`).
2. **Imports d'achats idempotents** (`purchase_imports` + `purchase_lines`) — avec **hash de contenu** (idempotence réelle, absente de l'actuel `import_screenings`) et gate de revue.
3. **BOM** (`bom_versions` / `bom_items`) et **correspondances matières** (`material_mappings`).
4. **Déclarations fournisseurs** (`supplier_metric_declarations`) et **PCF produit** (`product_carbon_footprints`), **sourcées** via le noyau (observation + release + preuve).
5. **File de résolution de mapping** (lignes non résolues → tâches de correction).

**PR-05B (migration `031+`, non réservée ici) — Calcul & exposition :**
6. **Hiérarchie Scope 3 cat. 1** explicite, `procurement_calculation_runs` / `procurement_line_results`, hotspots, couverture, **5 dimensions de score fournisseur** (pas un score ESG opaque), campagne fournisseur **depuis les hotspots**, Evidence Pack.

---

## 2. Hors périmètre

- **Pas de nouveau moteur de collecte** — réutiliser campagnes / tokens / revue existants.
- **Aucun fallback silencieux** de facteur ; chaque ligne conserve sa méthode et sa raison de repli.
- **Pas de score ESG unique opaque** — cinq dimensions séparées (§10.4 du plan).
- **IA = suggestions DRAFT revues uniquement** (mapping de colonnes, produit↔matière) — jamais une décision, jamais un calcul (PR-05 peut préparer les points d'ancrage mais l'IA elle-même relève de PR-11).
- **Pas d'énergie / Scope 2** (PR-06) ; **pas de matières critiques CRMA** détaillées (PR-07) — PR-05 pose les correspondances matières génériques, pas le scoring CRMA.
- **PR-05B (calcul) hors de PR-05A** — ce plan cadre les deux, réserve `030` pour A.
- Pas de refonte du module fournisseurs existant ; on l'**étend**.

---

## 3. Dépendances PR-03

| Élément | Rôle dans PR-05 |
|---|---|
| `observations` + `source_releases` + `evidence_artifacts` | **sourcer** une PCF fournisseur / une déclaration : `subject_type='supplier_product'`, `metric_code='pcf_kgco2e'`, `data_status`, `source_release_id`, `evidence_artifact_id` |
| `claim_evidence_links` (schéma seul en PR-03 → **PR-05 livre son service**) | lier une ligne d'achat / un résultat de calcul à sa preuve (`claim_type='purchase_line'`/`'procurement_run'`) |
| `artifact_service.register_artifact` | stocker le fichier d'achat brut + certificats PCF (Blob privé) |
| `license_policy` | un facteur/prix sous licence → vérifier `allow_derived_use` avant calcul |
| Enveloppe analytique `{data, meta, evidence}` (contrats §4, **À INTRODUCE**) | format des endpoints de calcul (PR-05B) — PR-05 est **candidate à créer** `models/analytics.py::AnalyticalEnvelope` (contrats §4) |
| helper `_http_error` partagé (contrats §6) | PR-05 est **candidate à le factoriser** dans `routers/_errors.py` |
| Colonnes de run partagées (contrats §4) | `procurement_calculation_runs` les reprend |

**À CONFIRMER au démarrage :** `claim_evidence_links` n'a ni service ni endpoint en PR-03. PR-05 est la première à en avoir besoin → elle livre `services/intelligence/claim_link_service.py` (respectant `relation_type ∈ supports|contradicts|contextualizes|derived_from`) et le documente dans sa traçabilité pour que les PR suivantes le réutilisent.

---

## 4. Migration réservée : `030` (PR-05A)

**`030_procurement_exposure.sql`** — tables d'exposition (PR-05A). Le calcul (PR-05B) prendra `031+` (renuméroter au merge, contrats §10).

Contrat §7 : RLS `ENABLE`+`FORCE` (**génération 2**, pas la génération 1 « ENABLE seul » des tables 008b — le nouveau schéma doit être robuste), policies scopées `FOR SELECT/INSERT/UPDATE/DELETE`, `company_id BIGINT NOT NULL`, `DROP POLICY IF EXISTS`, GRANT conditionnel `carbonco_app`, sonde `_probe_030` + enregistrement, `build_full_db`→030, tests DB-gated dans le job CI.

> **Décision de cohérence RLS.** Les tables fournisseurs historiques (008b) sont en RLS **génération 1** (ENABLE sans FORCE, sans clause bypass). Les nouvelles tables PR-05 adoptent la **génération 2** (FORCE + bypass + NULLIF, comme 028) — **ne pas** rétro-modifier 008b (hors périmètre, fichiers historiques figés), mais documenter l'écart. Défense en profondeur applicative (contrats §7) obligatoire quel que soit le générateur.

---

## 5. Tables (PR-05A)

Repris de `PLAN_ACTION` §10.2, alignés Wave 2 (`id BIGSERIAL`, `company_id BIGINT NOT NULL`, RLS FORCE, `created_at`/`updated_at`).

| Table | Colonnes clés | Notes |
|---|---|---|
| `supplier_sites` | `supplier_id BIGINT REFERENCES suppliers(id)`, `name`, `address`, `country_code`, `latitude`/`longitude` (nullable — géo réelle = PR-08), `geocode_review_status` | Pas de PostGIS ici (PR-08). |
| `supplier_products` | `supplier_id`, `product_code`, `product_name`, `category_code`, `origin_country`, `manufacturing_site_id BIGINT REFERENCES supplier_sites(id)` | `UNIQUE(company_id, supplier_id, product_code)`. |
| `purchase_imports` | `filename`, `sha256 TEXT`, `period_start`, `period_end`, `status`, `row_count`, `accepted_count`, `rejected_count`, `imported_by`, `imported_at` | **`UNIQUE(company_id, sha256)`** → idempotence de contenu (améliore `import_screenings` qui n'en a pas). Gate `pending→validated→emitted` (patron import_screenings). |
| `purchase_lines` | `import_id`, `supplier_id`, `supplier_external_code`, `product_id`, `product_external_code`, `purchase_date`, `quantity`, `unit`, `spend_amount`, `currency`, `category_code`, `origin_country`, `raw_row_json JSONB`, `mapping_status` | `mapping_status ∈ unmapped/mapped/needs_review/resolved`. |
| `bom_versions` | `product_id BIGINT REFERENCES products(id)`, `version`, `valid_from`, `valid_to`, `status`, `source_artifact_id BIGINT REFERENCES evidence_artifacts(id)` | BOM versionnée + preuve. |
| `bom_items` | `bom_version_id`, `parent_item_id BIGINT REFERENCES bom_items(id)`, `component_code`, `component_name`, `quantity`, `unit`, `supplier_id`, `supplier_product_id` | Arbre (self-FK). |
| `material_mappings` | `bom_item_id`, `material_id` (référentiel matières — global, cf. PR-07 ; nullable/texte tant que PR-07 absente), `mass_value`, `mass_unit`, `mass_fraction`, `mapping_method`, `confidence NUMERIC` (0-1), `review_status`, `reviewed_by` | `confidence` séparé du statut (contrats §2). |
| `supplier_metric_declarations` | `supplier_id`, `supplier_product_id`, `metric_code`, `value`, `unit`, `reporting_year`, `boundary`, `methodology`, `primary_data_pct`, `assurance_status`, `evidence_artifact_id`, `source_release_id`, `data_status`, `review_status` | **Sourcée** (release + preuve, contrats §3). |
| `product_carbon_footprints` | `supplier_product_id`, `cradle_boundary`, `value_kgco2e`, `declared_unit`, `reference_flow`, `reporting_period`, `methodology`, `verification_status`, `evidence_artifact_id`, `source_release_id`, `data_status` | PCF vérifiée = niveau 1 de la hiérarchie Scope 3. |

**PR-05B (indicatif, `031+`) :** `procurement_calculation_runs` (colonnes partagées contrats §4) ; `procurement_line_results` (par ligne : `calculation_method`, `factor_id`, `factor_version`, `activity_value`, `activity_unit`, `result_tco2e`, `uncertainty_band`, `data_quality`, `fallback_reason`, `warnings`).

---

## 6. Services

### PR-05A
| Service | Responsabilité |
|---|---|
| `services/procurement/supplier_sites_service.py` | CRUD sites & produits fournisseurs (défense en profondeur). |
| `services/procurement/purchase_import_service.py` | Import CSV d'achats **idempotent par sha256** ; parse (réutilise le patron `csv_import_parsers`) ; gate de revue ; file de résolution des lignes non mappées. |
| `services/procurement/bom_service.py` | BOM versionnée + items + correspondances matières ; revue des mappings. |
| `services/procurement/declarations_service.py` | Déclarations fournisseurs & PCF, **sourcées** via `observation_service`/`artifact_service` (release + preuve). |
| `services/intelligence/claim_link_service.py` | **Nouveau** — service manquant de PR-03 pour `claim_evidence_links` (lier preuve↔ligne d'achat/résultat). |

### PR-05B (indicatif)
- `services/calculations/procurement.py` : **hiérarchie Scope 3 cat. 1** explicite —
  1. PCF fournisseur vérifiée et comparable → 2. méthode fournisseur spécifique/hybride → 3. facteur physique moyen (produit/matière) → 4. facteur économique par catégorie de dépense → 5. **ligne non résolue + tâche de correction**.
  Chaque ligne conserve `calculation_method/factor_id/factor_version/.../fallback_reason/warnings`. **Aucun fallback silencieux.**
- `services/procurement/scoring.py` : **5 dimensions séparées** (maturité des preuves, qualité des données GES, concentration d'approvisionnement, exposition géographique, statut de conformité/réponse) — jamais un score ESG opaque unique ; risque ≠ confiance.

### Réutilisés (ne pas dupliquer)
`supplier_service`, `supplier_campaigns_service` (campagne **depuis hotspots** en PR-05B), la **revue** (`review_answer`, patron gate), `emission_factors` (catalogue — la **hiérarchie de sélection est nouvelle**, absente aujourd'hui), `facts_service.emit_fact` (sceller un run approuvé), `import_screening_service` (patron), `export_package` (Evidence Pack), `observation_service`/`artifact_service`/`license_policy` (sourcing/licence).

---

## 7. Endpoints

### PR-05A (préfixe `/procurement`, + extensions `/suppliers/{id}/…`)
- `POST /procurement/imports` — `require_analyst` — upload CSV achats → `purchase_imports` (idempotent sha256), lignes `pending`.
- `GET /procurement/imports/{id}` / `GET /procurement/imports/{id}/errors` — `get_current_user`.
- `POST /procurement/imports/{id}/resolve-mappings` — `require_analyst` — file de résolution (mapping ligne→produit/matière), revue.
- `GET /suppliers/{id}/sites` / `POST /suppliers/{id}/sites` — `get_current_user` / `require_analyst`.
- `GET /suppliers/{id}/products` / `POST /suppliers/{id}/products` — idem.
- `POST /products/{id}/boms` / `GET /products/{id}/boms/{version}` / `POST /products/{id}/boms/{version}/map-materials` — `require_analyst` / `get_current_user`.

### PR-05B (indicatif)
- `GET /procurement/hotspots`, `/procurement/exposures/materials`, `/procurement/exposures/countries` — enveloppe analytique (contrats §4).
- `POST /procurement/calculate` — `require_analyst`.
- `GET /procurement/runs/{id}` / `GET /procurement/runs/{id}/evidence-pack` — via `export_package`.
- `GET /suppliers/{id}/risk` / `GET /suppliers/{id}/evidence-quality` — 5 dimensions.

Tous : pagination §5, erreurs §6, isolation §7, licence §8.

> **Piège d'ordonnancement de routes.** Le router `/suppliers` déclare déjà `/scope3`, `/campaigns`, `/import-csv`, `/answers/*` **avant** `/{supplier_id}` pour éviter la capture de chemin (`routers/suppliers.py`). PR-05 respecte le même ordre pour toute route littérale ajoutée.

---

## 8. Interface frontend

**Étendre** `apps/carbon/app/(app)/fournisseurs/page.tsx` + nouvelle **vue « Exposition achats »**.

- **Exposition achats** : dépenses & masse couvertes, % résolu/non résolu, top émissions, top matières critiques, top pays/fournisseurs concentrés, taux de données primaires, méthodes de calcul, tâches de collecte.
- **Drill-down** : achat → fournisseur → produit → matière → facteur → calcul → **preuve** (chaque niveau porte date/source/statut/méthode).
- **File de résolution** : lignes non mappées à corriger (avec suggestions IA `DRAFT` **revues** — ancrage seulement en PR-05).
- **Score fournisseur** : 5 dimensions affichées **séparément** (jamais un chiffre unique) ; risque et confiance distincts.
- Réutiliser `DataStatusBadge`, `ReviewStatusBadge`, `KpiWithProvenance`, `KpiProvenanceDrawer`, `ExportButtons`, `ExportPackageCard` ; créer `EvidenceList`, `CalculationTrace`, `ReviewGate`, `ConfidenceBadge`, `MethodBadge` (contrats §9, si pas déjà créés par PR-04).
- Client API : `apps/carbon/lib/api/procurement.ts`.

---

## 9. Tests

- **Unitaires** : parse CSV achats (variantes délimiteur/encodage, patron `csv_import_parsers`) ; hiérarchie Scope 3 (chaque niveau + « ligne non résolue » + **aucun fallback silencieux**) ; 5 dimensions de score (séparation risque/confiance) ; `claim_link_service` (relations valides/invalides).
- **DB-gated (job `migration-tests`)** : migration `030` applicable après 028 ; RLS + **défense en profondeur** (tenant A ne voit pas les achats de B) ; import **idempotent par sha256** (rejouer le même fichier = aucun doublon) ; gate de revue (`pending→accepted/flagged`, transition idempotente comme l'existant) ; PCF/déclaration sourcée = observation + release + preuve cohérentes ; immutabilité des observations sourcées (trigger 028).
- **API** : endpoints procurement (auth analyst/admin, pagination, 404 sans fuite d'existence) ; drill-down cohérent.
- **Ledger** : `030` `pending` sur base 028 ; `plan`/`apply`/`verify` verts ; `_probe_030`.
- **Non-régression** : le module fournisseurs existant (campagnes, revue, scope3_summary) inchangé.
- **Frontend** : vue exposition, drill-down, file de résolution, badges ; états loading/empty/error ; accessibilité.

---

## 10. Fichiers à créer / modifier

### Créés (PR-05A, backend)
- `apps/api/db/migrations/030_procurement_exposure.sql`
- `apps/api/services/procurement/__init__.py`, `supplier_sites_service.py`, `purchase_import_service.py`, `bom_service.py`, `declarations_service.py`
- `apps/api/services/intelligence/claim_link_service.py` (**comble le manque PR-03**)
- `apps/api/models/procurement.py`
- `apps/api/routers/procurement.py`
- `apps/api/tests/test_procurement_imports.py`, `test_procurement_bom.py`, `test_procurement_declarations.py`, `test_claim_links.py`

### Modifiés (PR-05A, backend)
- `apps/api/main.py` (router `/procurement`)
- `apps/api/routers/suppliers.py` (+ `/suppliers/{id}/sites|products`) et `routers/…` produits (`/products/{id}/boms`)
- `apps/api/db/migration_manifest.py`, `migration_probes.py`, `tests/_migration_fixtures.py`
- `.github/workflows/api.yml` (tests DB-gated dans `migration-tests`)
- (Candidat) `apps/api/routers/_errors.py` (factoriser `_http_error`), `apps/api/models/analytics.py` (enveloppe) — contrats §4/§6

### Créés (frontend)
- `apps/carbon/lib/api/procurement.ts`
- `apps/carbon/components/procurement/*` (+ composants transverses `EvidenceList`/`CalculationTrace`/`ReviewGate` si pas déjà créés)

### Modifiés (frontend)
- `apps/carbon/app/(app)/fournisseurs/page.tsx` (+ vue exposition) ; `lib/feature-registry.ts` (BETA)

### PR-05B (indicatif, non dans PR-05A)
`db/migrations/031_procurement_engine.sql`, `services/calculations/procurement.py`, `services/procurement/scoring.py`, `procurement_calculation_runs`/`procurement_line_results`, endpoints hotspots/exposures/calculate/runs.

---

## 11. Risques

| Risque | Mitigation |
|---|---|
| **Import d'achats non idempotent** (double comptage) | `purchase_imports UNIQUE(company_id, sha256)` + gate `pending→emitted` ; test de re-run. Améliore l'existant `import_screenings` (pas de hash). |
| **Fallback silencieux de facteur** masquant un trou de données | Hiérarchie explicite 1→5, `fallback_reason` obligatoire, niveau 5 = tâche de correction (jamais un chiffre inventé) ; test dédié. |
| **Score ESG opaque** contraire au principe §1.10 | 5 dimensions séparées ; risque ≠ confiance ; revue de conception. |
| **`claim_evidence_links` sans service** (dette PR-03) | PR-05 le livre proprement (contrats §1) et le documente pour réutilisation. |
| **RLS génération 1 sur les tables 008b** vs génération 2 sur les neuves | Nouvelles tables en gen 2 (FORCE) + défense en profondeur ; ne pas rétro-modifier 008b ; documenter l'écart. |
| **`get_company_id` défaut tenant 1** sur les GET (pas un gate d'auth) | Les écritures/sensibles passent par `require_analyst`/`get_current_user` (JWT réel) ; ne pas exposer d'achat via un endpoint en `get_company_id` seul. |
| Prix/facteur sous licence utilisé sans droit | `license_policy` avant calcul dérivé ; warning tracé. |
| Pas de PostgreSQL local | CI `migration-tests` = seule preuve ; aller-retour prévu (leçon PR-02/03). |
| Numéro `030` déjà pris | `command=plan` avant apply ; renuméroter au merge (contrats §10). |

---

## 12. Étapes d'implémentation

**PR-05A :**
1. Migration `030` (sites/produits/imports/lignes/BOM/mappings/déclarations/PCF) + sonde + fixtures + job CI.
2. `claim_link_service` (comble PR-03) + tests.
3. `purchase_import_service` (idempotent sha256 + gate revue + file de résolution).
4. `supplier_sites_service`, `bom_service`, `declarations_service` (sourcing via noyau) + défense en profondeur.
5. Router `/procurement` + extensions `/suppliers/{id}/…`, `/products/{id}/boms`.
6. Frontend : client API, vue exposition, drill-down, file de résolution.
7. Tests complets ; `git diff --check` ; lint.

**PR-05B (PR séparée ultérieure) :** hiérarchie de calcul, runs, hotspots, exposures, 5 dimensions de score, campagne depuis hotspots, Evidence Pack.

---

## 13. Critères de merge (PR-05A)

- CI verte (`tests`, `migration-tests`, front, `validate`, `security-audit`, `gitleaks`).
- `ruff`/`git diff --check` propres ; TS strict.
- Import achats **idempotent par contenu** garanti (test de re-run).
- Gate de revue respecté (rien n'alimente le calcul sans validation humaine).
- Isolation tenant testée (RLS gen 2 + défense en profondeur) sur toutes les nouvelles tables.
- Toute donnée sourcée = observation + release + preuve cohérentes ; immutabilité respectée.
- Aucun score opaque ; aucun fallback silencieux ; IA limitée à des suggestions DRAFT revues.
- Module fournisseurs existant non régressé.
- Aucune écriture prod par Claude. PR non mergée automatiquement.

---

## 14. Opérations post-merge

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `030` pending, seul) → `apply` → `verify` → `/health/schema` `up_to_date:true` `schema_version:"030"`.
3. Vérification applicative : `POST /procurement/imports` (JWT analyst) avec un CSV de test → lignes `pending` ; re-upload du même fichier → aucun doublon (idempotence).
4. Observation 24-48h (permissions `carbonco_app` sur les nouvelles tables). Consigner `MIGRATIONS_RUNBOOK.md` §9.
5. **Gate Phase 4** (à l'issue de PR-05B) : « import idempotent et drill-down complet jusqu'à la preuve » — vérifié.
6. PR-05B planifiée séparément une fois PR-05A stabilisée.
