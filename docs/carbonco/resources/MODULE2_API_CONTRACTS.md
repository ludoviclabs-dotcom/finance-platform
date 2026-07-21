# MODULE 2 — Contrats d'API

> **Phase 2 — architecture définitive, docs-only.** Date : 2026-07-22. Aucun code créé.
> Router futur : **`apps/api/routers/resources.py`**, préfixe **`/resources`**, enregistré dans `main.py` (`tags=["resources (Module 2)"]`). Modèles Pydantic futurs : `apps/api/models/resources.py`. Services futurs : `apps/api/services/resources/*`.

## 0. Conventions gelées (héritées, à respecter à l'identique)

- **Auth** : lecture (`GET`) = `Depends(get_current_user)` (JWT réel, `user.company_id` — jamais `get_company_id` qui retombe sur le tenant 1) ; écriture (`POST`) = `Depends(require_analyst)`.
- **Garde base** : `require_db()` en tête de chaque handler (503 « Base de données indisponible » sans `DATABASE_URL`).
- **Garde schéma** : corps enveloppé dans `with schema_ready_guard():` — **obligatoire** ici car les tables arrivent avec 042/043 (motif `routers/water.py`). Pendant la fenêtre déploiement→migration : **503 `schema_not_ready`** (le front affiche « initialisation du schéma en cours »).
- **Erreurs métier** : `raise http_error(exc)` — convention lexicale figée (`routers/_errors.py`) : « introuvable » → **404**, « requis/requise » → **400**, sinon → **409**. Messages FR, jamais de SQL/secret/fuite cross-tenant.
- **Pagination** : `limit: int = Query(50, ge=1, le=200)`, `offset: int = Query(0, ge=0)` ; réponse `{ "items": [...], "total": int, "limit": int, "offset": int }` (motif `*ListResponse`, `models/crma.py`).
- **Sortie structurée uniquement** : pas de JSON non typé, chaque réponse a un modèle Pydantic.

## 0.1 Interdictions (contrat)

- ❌ Aucun **appel externe live** (pas d'ingestion réseau au fil de l'eau — l'ingestion passe par les services Evidence Kernel/CLI, hors requête utilisateur).
- ❌ Aucune **écriture globale** (`company_id IS NULL`) par un analyste tenant — l'écriture globale est réservée au chemin admin (`app.rls_bypass`).
- ❌ Aucun **contournement** des modules existants : les liens d'exposition référencent `bom_items`/`purchase_lines`/`energy_activities`/`water_activities`/`supplier_metric_declarations` — jamais de recopie, jamais de recalcul carbone (D-4).
- ❌ Aucun **résultat sans preuve** quand `data_status='verified'` : garanti par les CHECK `*_sourced_check` (schéma) + la vérification de licence à la lecture (`license_policy.evaluate`).

---

## 1. Endpoints — catalogue (lecture)

### `GET /resources/catalog`
- **Rôle** : `get_current_user`. **Params** : `family?` (filtre), `role?` (filtre via `resource_roles`), `q?` (recherche slug/nom), `limit`, `offset`.
- **Réponse** : `ResourceCatalogListResponse { items: ResourceCatalogItem[], total, limit, offset }`. `ResourceCatalogItem { id, slug, name, name_fr, primary_family, roles: string[], data_status, has_source: bool }`.
- **Source** : `resource_catalog` (global + tenant) + agrégat `resource_roles`.
- **Erreurs** : 503 (`require_db`/`schema_not_ready`).
- **Tenant** : lecture `company_id IS NULL OR = tenant`. **Modules liés** : —.
- **Exemple** : `{"items":[{"slug":"helium","name_fr":"Hélium","primary_family":"industrial_gas","roles":["industrial_gas","process_input"],"data_status":"verified","has_source":true}],"total":1,"limit":50,"offset":0}`.

### `GET /resources/catalog/{slug}`
- **Rôle** : `get_current_user`. **Params** : `slug` (path).
- **Réponse** : `ResourceCatalogDetail { id, slug, name, name_fr, primary_family, description, roles, aliases_count, regulations_count, uses_count, data_status, source_release_id }`.
- **Source** : `resource_catalog` (+ compteurs enfants). **Erreurs** : **404** si slug introuvable (message « ressource introuvable »).
- **Tenant** : résolution du slug dans `global ∪ tenant`.

### `GET /resources/catalog/{slug}/aliases`
- **Rôle** : `get_current_user`. **Réponse** : `ResourceAliasListResponse { items: {alias_kind, alias_value}[], total, limit, offset }`.
- **Source** : `resource_aliases`. **Usage** : exposer le pont legacy (`legacy_material_id`, CAS…). **Erreurs** : 404 slug.

### `GET /resources/catalog/{slug}/regulations`
- **Rôle** : `get_current_user`. **Réponse** : `ResourceRegulationListResponse { items: {regime, regulation_ref, list_or_annex, listing_status, certainty, verified_on, has_source}[], total, limit, offset }`.
- **Source** : `resource_regulatory_statuses`. **Contrat** : `certainty='confirmed'` ⇒ `has_source=true` (jamais une classification confirmée sans release). **Erreurs** : 404 slug.
- **Exemple** : `{"items":[{"regime":"crma","regulation_ref":"Reg (UE) 2024/1252","list_or_annex":"Annexe II — Critique","listing_status":"listed","certainty":"confirmed","has_source":true}],...}`.

### `GET /resources/catalog/{slug}/uses`
- **Rôle** : `get_current_user`. **Réponse** : `ResourceUseListResponse { items: {sector_code, use_label, criticality_note, data_status}[], ... }`.
- **Source** : `resource_sector_uses`. **⚠️ Sécurité** : `use_label`/`criticality_note` = classification supply-chain seulement (aucun contenu technique). **Erreurs** : 404 slug.

### `GET /resources/catalog/{slug}/supply`
- **Rôle** : `get_current_user`. **Params** : `reference_year?`, `metric_code?`, `stage_code?`, `limit`, `offset`.
- **Réponse** : `ResourceSupplyResponse { resource_slug, reference_year, value_chain: StageConcentration[], stages_with_data, stages_total }` — **concentration PAR ÉTAPE** (motif `/crma/materials/{id}/value-chain`), HHI par étape, `observed_total_pct` reporté honnêtement, **jamais** de moyenne inter-étapes.
- **Source** : `resource_supply_observations` **∪** legacy `material_stage_observations` (via `resource_aliases`, D-2) ; étapes lues depuis `resource_stage_applicability` (D-6). **Modules liés** : réutilise `services/crma/scoring.py` (`build_value_chain`, `compute_stage_concentration`). **Erreurs** : 404 slug.

---

## 2. Endpoints — expositions (tenant)

### `GET /resources/exposures`
- **Rôle** : `get_current_user`. **Params** : `resource_slug?`, `link_kind?`, `role?`, `limit`, `offset`.
- **Réponse** : `ResourceExposureListResponse { items: ResourceExposureItem[], total, limit, offset }`. `ResourceExposureItem { id, resource_slug, role, link_kind, linked_ref, annual_mass_kg, annual_spend_eur, share_of_supply_pct, stock_coverage_days, data_status }` — `linked_ref` = pointeur lisible (ex. `"purchase_line:842"`), jamais l'objet complet d'un autre module.
- **Source** : `company_resource_exposure_links` (**tenant strict**). **Modules liés** : `bom_items`/`purchase_lines`/`energy_activities`/`water_activities`/`supplier_metric_declarations` (lecture indirecte).

### `POST /resources/exposures/link`
- **Rôle** : **`require_analyst`**. **Corps** : `ResourceExposureLinkCreate { resource_slug, role, link_kind, bom_item_id?|purchase_line_id?|energy_activity_id?|water_activity_id?|supplier_declaration_id?|manual_note?, annual_mass_kg?, annual_spend_eur?, share_of_supply_pct?, stock_coverage_days? }`.
- **Réponse** : `ResourceExposureItem` (201).
- **Validation** : exactement une cible cohérente avec `link_kind` (sinon **400** « cible requise ») ; la cible doit appartenir au tenant (**anti-IDOR** : `company_id=%s` vérifié avant insertion — sinon **404** « … introuvable », jamais de fuite d'existence cross-tenant) ; `role` ∈ vocabulaire.
- **Tenant** : écriture tenant stricte. **D-4** : n'écrit **aucune** intensité carbone — le lien sert à *lire* l'empreinte depuis le module cible. **Erreurs** : 400/404/409, 503.

---

## 3. Endpoints — assessments (tenant, runs immuables)

### `GET /resources/assessments`
- **Rôle** : `get_current_user`. **Params** : `resource_slug?`, `assessment_year?`, `status?`, `current_only?` (défaut true → exclut `superseded`), `limit`, `offset`.
- **Réponse** : `ResourceAssessmentListResponse { items: ResourceAssessmentSummary[], ... }`. `ResourceAssessmentSummary { run_id, resource_slug, assessment_year, status, risk_score, confidence, coverage_pct, methodology_code, methodology_version, calculated_at }` — **risque et confiance côte à côte, jamais fusionnés**.
- **Source** : `resource_assessment_runs`.

### `POST /resources/assessments`
- **Rôle** : **`require_analyst`**. **Corps** : `ResourceAssessmentRunCreate { resource_slug, assessment_year, as_of? }`.
- **Comportement** : calcule un **nouveau run immuable** via `services/resources/assessment_service` → `scoring.py` (pur, paramétré par famille). Si un run courant existe pour (resource, year), il passe `superseded` et le nouveau porte `supersedes_id`. **N'approuve jamais** (statut `computed`). Peut **proposer** un signal IRO (`origin_domain='strategic_resources'`, D-5) — jamais décider la matérialité.
- **Réponse** : `ResourceAssessmentDetail` (201) incluant `dimensions`, `drivers`, `warnings`, `sensitivity?`, `iro_signal_id?`.
- **Contrat** : `risk_score` peut être `null` (aucune composante disponible ⇒ pas de nombre inventé) ; `confidence` toujours calculée ; données bloquées par licence **dégradent la confiance, pas le risque**. **Erreurs** : 400 (« année requise »), 404 (ressource), 409, 503.

### `GET /resources/assessments/{run_id}`
- **Rôle** : `get_current_user`. **Réponse** : `ResourceAssessmentDetail { run_id, resource_slug, assessment_year, status, risk_score, confidence, coverage_pct, methodology_code, methodology_version, drivers, warnings, sensitivity?, iro_signal_id?, dimensions: ResourceAssessmentDimension[], disclaimer }`. `disclaimer` = méthode CarbonCo versionnée, **jamais** une note officielle UE/CRMA.
- **Source** : `resource_assessment_runs` (+ enfants). **Erreurs** : 404 run (scopé tenant).

### `GET /resources/assessments/{run_id}/dimensions`
- **Rôle** : `get_current_user`. **Réponse** : `ResourceAssessmentDimensionListResponse { items: ResourceAssessmentDimension[], total, limit, offset }`. `ResourceAssessmentDimension { kind: 'risk'|'confidence', dimension_code, available, risk_value?, weight?, contribution?, raw_value?, raw_unit?, stage_code?, rationale, source_release_ids }`.
- **Source** : `resource_assessment_dimensions`. **Contrat** : `kind` sépare risque et confiance ; `source_release_ids` trace chaque driver (provenance par composante). **Erreurs** : 404 run.

---

## 4. `GET /resources/alerts` (dérivé, lecture seule)
- **Rôle** : `get_current_user`. **Params** : `severity?`, `limit`, `offset`.
- **Réponse** : `ResourceAlertListResponse { items: ResourceAlert[], total, limit, offset }`. `ResourceAlert { kind, severity, resource_slug, message, origin_ref, as_of }` — `kind ∈ {'active_trade_event','high_dependency','stale_supply_data','license_blocked'}`.
- **Source** : **dérivé, aucune table neuve** — agrège les `trade_or_regulatory_events` **actifs à la date** (034, résolus via alias pour les ressources CRMA), les `resource_assessment_runs` à risque élevé du tenant, et les observations périmées (fraîcheur). Réutilise la logique « événements actifs à `as_of` » de `scoring.py::_events_component`.
- **Interdiction** : pas de règle d'alerte persistée nouvelle (le module `alert_rules` 021 reste la brique si un jour on veut des seuils configurables — hors MVP). **Erreurs** : 503.

---

## 5. Modèles Pydantic (résumé, `models/resources.py` futur)

`ResourceCatalogItem/Detail`, `ResourceRole`, `ResourceAlias`, `ResourceRegulation`, `ResourceUse`, `StageConcentration` (réutilisé de `models/crma.py`), `ResourceSupplyResponse`, `ResourceExposureItem/Create`, `ResourceAssessmentSummary/Detail/RunCreate`, `ResourceAssessmentDimension`, `ResourceAlert`, + les `*ListResponse { items, total, limit, offset }`. **Aucun modèle ne fusionne risque et confiance ; aucun ne porte de facteur carbone.**

→ Sécurité/RLS : `MODULE2_RLS_AND_SECURITY.md`. Tests : `MODULE2_TEST_STRATEGY.md`.
