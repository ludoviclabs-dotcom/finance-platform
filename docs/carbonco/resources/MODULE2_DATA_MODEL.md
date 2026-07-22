# MODULE 2 — Modèle de données cible

> **Phase 2 — architecture définitive, docs-only.** Date : 2026-07-22 · Branche : `docs/strategic-resources-architecture` · Base : `origin/master` `c29baf3` (schéma **041**).
> **Aucun fichier SQL réel créé ici.** Ce document *fige* le modèle ; il ne l'implémente pas.
> Migrations **réservées** (vérifié contre `apps/api/db/migrations/` + `migration_manifest.py` : dernière = **041**, aucun trou, aucun 042 non mergé) :
> - **N = 042** — Fondation catalogue ressources.
> - **N+1 = 043** — Expositions & moteur d'assessment.

## 0. Invariants hérités (non négociables)

- **Un schéma unique** (`public`). Pas de schéma PostgreSQL séparé. Clé tenant = **`company_id BIGINT REFERENCES companies(id)`** partout — **jamais** `tenant_id UUID`.
- **Ne pas dupliquer** l'Evidence Kernel (028), CRMA (034), Water (036/037), Energy (031/033), Procurement (030/032), IRO (040). MODULE 2 **référence** ces objets, il ne les recopie pas.
- **RLS gen-2 FORCE** partout (détail dans `MODULE2_RLS_AND_SECURITY.md`).
- **Sourcé-ou-avoué** : toute table factuelle porte `data_status ∈ {verified,estimated,manual,inferred}` + `source_release_id` (Evidence Kernel) ; CHECK `*_sourced_check` : `data_status='verified' ⇒ source_release_id NOT NULL`.
- **risque ≠ confiance** : deux colonnes distinctes, deux CHECK d'intervalle séparés, jamais fusionnées.
- **Migrations idempotentes** : `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` avant `CREATE POLICY`, seeds `ON CONFLICT DO NOTHING`.
- **FK BIGINT → PK INTEGER historiques** valide en PostgreSQL (companies.id, suppliers.id sont SERIAL/int4 ; même geste que 028/030/034).

## 1. Rappels d'arbitrage matérialisés dans le schéma

| Arbitrage | Matérialisation |
|---|---|
| **D-1** rôles multiples, non exclusifs | Table d'association **`resource_roles`** (jamais de colonne booléenne `is_fuel`/`is_material`) — motif `material_group_members` (034). Le pont **`company_resource_exposure_links`** porte le rôle exercé par CHAQUE lien. |
| **D-2** catalogue sans casse du legacy | **`resource_catalog`** neuf + **`resource_aliases`** (`legacy_material_id`/CAS/EC/HS-CN/REACH/…). Les `material_id TEXT` de 030/034 **restent valides** ; rapprochement par alias, **aucun ALTER destructif** ni renommage des tables CRMA. |
| **D-3** pas de score pays inventé | Aucune table/colonne de « country risk score ». La dépendance pays reste **`third_country_dependency`** dérivée à la volée par le moteur (part hors UE). WGI = option v2 **gatée** (ingérée via Evidence Kernel avec `source_release_id`, jamais codée). |
| **D-4** pas de nouveau moteur carbone | Aucune colonne `factor_kgco2e`, aucun facteur d'émission. `company_resource_exposure_links` **pointe** vers `energy_activities`/`purchase_lines`/… ; l'intensité carbone est **lue** depuis Scope 2/3/PCF/Energy/Procurement, jamais recalculée ici. Intensités **ressources** (m³/unité, kg/unité, kg/M€…) avec dénominateur documenté seulement. |
| **D-5** lignée IRO | `resource_assessment_runs.iro_signal_id → iros(id)` ; l'émission pose `iros.origin_domain='strategic_resources'` + `origin_reference='resource_assessment_run:<id>'`. **Migration 043 élargit** `iros_origin_domain_check` (DROP+ADD même nom, précédent 040/041 `audit_eventtype_check`). Matérialité = **humaine**, `materiality_decisions` (040), jamais par ce module. |
| **D-6** étapes pilotées DB | **`resource_stage_applicability`** (famille → étapes, ordre par famille) + extension du semis **global** de `processing_stages` (034) pour les familles non-aimant. `scoring.py` lit ce vocabulaire au lieu de ses constantes `STAGE_ORDER`. |

---

## 2. Migration 042 (N) — Fondation catalogue ressources

> **`requires_owner=False`, `transactional=True`** (ne crée que des tables neuves, aucun ALTER d'une table existante — même profil que 028/030/034). Manifeste `migration_manifest.py["042"]` à ajouter. Sonde `_probe_042` à ajouter (voir `MODULE2_TEST_STRATEGY.md`).
> **Aucune donnée factuelle semée.** Seuls des **vocabulaires structurels** (étapes, applicabilité) sont semés en lignes globales via `SET LOCAL app.rls_bypass='on'` (idiome 034 §3bis) — pas une donnée sur le monde, donc pas de source à citer. Les ressources canoniques (hélium, bois…) sont des **DONNÉES**, chargées par un service d'import (PR-M2A), **pas par la migration**.

### 2.A `resource_catalog` — référentiel canonique
- **Finalité** : identifiant canonique unique d'une ressource (D-2), remplace conceptuellement le `material_id TEXT` libre.
- **Portée** : **mixte** — `company_id` NULLABLE (`NULL` = ligne canonique globale lisible par tous ; non-null = extension tenant).
- **Colonnes / types** :
  - `id BIGSERIAL PRIMARY KEY`
  - `company_id BIGINT REFERENCES companies(id)` (nullable)
  - `slug TEXT NOT NULL` (kebab, ex. `helium`, `natural-rubber`)
  - `name TEXT NOT NULL`, `name_fr TEXT`
  - `primary_family TEXT NOT NULL` — CHECK `IN ('industrial_gas','biomass_fibre','energy_fuel','critical_raw_material','other')` (famille de rattachement par défaut pour le vocabulaire d'étapes ; **le rôle réel est porté par `resource_roles`**, D-1)
  - `description TEXT`
  - `data_status TEXT NOT NULL DEFAULT 'manual'` — CHECK `IN ('verified','estimated','manual','inferred')`
  - `source_release_id BIGINT REFERENCES source_releases(id)`
  - `created_by BIGINT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at …`
- **CHECK** : `resource_catalog_sourced_check` : `data_status <> 'verified' OR source_release_id IS NOT NULL`.
- **Clés / index** : `uq_resource_catalog_slug_tenant` UNIQUE `(company_id, slug) WHERE company_id IS NOT NULL` ; `uq_resource_catalog_slug_global` UNIQUE `(slug) WHERE company_id IS NULL` (motif `material_groups` 034) ; `idx_resource_catalog_family (primary_family)`.
- **FK** : `company_id`→companies, `source_release_id`→source_releases.
- **Immutable/mutable** : **mutable** (référentiel éditable par un analyste ; historique via `updated_at`).
- **Idempotence** : `CREATE TABLE IF NOT EXISTS` ; ré-import de la même ressource = upsert sur le slug scoping.
- **Lien Evidence Kernel** : `source_release_id` (provenance de la fiche).
- **RLS attendue** : lecture `company_id IS NULL OR = tenant` ; écriture **tenant uniquement** ; global via `app.rls_bypass`.
- **Exemple** : `(NULL,'helium','Helium','Hélium','industrial_gas',…,'verified', <release USGS>)`.
- **Limites** : le slug canonique global est arbitré à l'import ; collisions résolues par `resource_aliases`, pas par duplication.

### 2.B `resource_roles` — rôles NON exclusifs (D-1)
- **Finalité** : porter les rôles multiples d'une ressource sans booléen exclusif.
- **Portée** : mixte (suit le scope de la ressource).
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT REFERENCES companies(id)` (nullable) · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE` · `role TEXT NOT NULL` CHECK `IN ('material','feedstock','energy_carrier','process_input','industrial_gas','nuclear_fuel','biomass','water')` · `created_at`.
- **Clés** : `resource_roles_uniq` UNIQUE `(resource_id, role)` ; `idx_resource_roles_role (role)`.
- **Immutable/mutable** : mutable (ajout/retrait de rôle). **Idempotence** : `ON CONFLICT (resource_id, role) DO NOTHING`.
- **RLS** : idem 2.A. **Lien EK** : indirect (via la ressource).
- **Exemple** : hydrogène → 3 lignes `('energy_carrier'),('feedstock'),('process_input')` (D-1 : jamais forcé exclusif).
- **Limites** : le rôle décrit l'usage-type ; l'exposition réelle et son rôle exercé sont dans `company_resource_exposure_links`.

### 2.C `resource_aliases` — alias legacy & identifiants externes (D-2)
- **Finalité** : rapprocher le catalogue des identifiants existants **sans réécrire** les tables CRMA.
- **Portée** : mixte.
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT REFERENCES companies(id)` (nullable) · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE` · `alias_kind TEXT NOT NULL` CHECK `IN ('legacy_material_id','cas','ec','hs_cn','reach','internal','other')` · `alias_value TEXT NOT NULL` · `created_at`.
- **Clés / index** : `resource_aliases_uniq` UNIQUE `(resource_id, alias_kind, alias_value)` ; `idx_resource_aliases_lookup (alias_kind, alias_value)` (**reverse-lookup** `legacy material_id → resource_id`, cœur du pont legacy).
- **Immutable/mutable** : mutable. **Idempotence** : ON CONFLICT DO NOTHING.
- **RLS** : idem 2.A. **Lien EK** : indirect.
- **Exemple** : `(<helium>,'legacy_material_id','helium')`, `(<helium>,'cas','7440-59-7')`.
- **Limites** : un même `alias_value` peut, en théorie, viser deux ressources dans deux scopes tenant différents — l'unicité est par `resource_id`, la résolution se fait toujours dans le périmètre du tenant + global.

### 2.D `resource_regulatory_statuses` — statut réglementaire sourcé
- **Finalité** : matérialiser en base les faits de `REGULATORY_SOURCE_MATRIX.md` (CRMA/EUDR/REACH/…), sourcés. Sert **D-5** (regime='crma' → origin_domain IRO).
- **Portée** : mixte (majoritairement global).
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT REFERENCES companies(id)` (nullable) · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE` · `regime TEXT NOT NULL` CHECK `IN ('crma','eudr','reach','clp','red_iii','cbam','euratom','dual_use','gas_sos','esrs','other')` · `regulation_ref TEXT` (ex. `'Reg (UE) 2024/1252'`) · `list_or_annex TEXT` (ex. `'Annexe II — Critique'`) · `listing_status TEXT NOT NULL` CHECK `IN ('listed','not_listed','in_scope','out_of_scope','in_force','adopted_not_applicable','proposed','delayed')` · `validity_note TEXT` · `certainty TEXT NOT NULL` CHECK `IN ('confirmed','probable','unresolved')` · `source_release_id BIGINT REFERENCES source_releases(id)` · `verified_on DATE` · `created_by BIGINT` · `created_at` · `updated_at`.
- **CHECK** : `resource_regulatory_statuses_sourced_check` : `certainty <> 'confirmed' OR source_release_id IS NOT NULL` (aucune classification « confirmée » sans source primaire — miroir de la règle EK).
- **Clés / index** : UNIQUE `(company_id, resource_id, regime, regulation_ref)` ; `idx_resource_reg_status_resource (resource_id, regime)`.
- **Immutable/mutable** : mutable (le droit évolue ; `updated_at` + `verified_on`).
- **RLS** : idem 2.A. **Lien EK** : `source_release_id` obligatoire dès `confirmed`.
- **Exemples** : `(<helium>,'crma','Reg (UE) 2024/1252','Annexe II — Critique','listed','confirmed',<release JRC RMIS>)` ; `(<xenon>,'crma','Reg (UE) 2024/1252',NULL,'not_listed','confirmed',<release>)`.
- **Limites** : le texte verbatim d'annexe reste `UNRESOLVED` côté matrice tant que EUR-Lex n'est pas ouvert — `certainty='probable'` autorisé sans release, `confirmed` non.

### 2.E `resource_sector_uses` — usages sectoriels (classification supply-chain SEULEMENT)
- **Finalité** : quels secteurs consomment la ressource — **classification supply-chain**, jamais un contenu technique/opérationnel.
- **Portée** : mixte.
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT REFERENCES companies(id)` (nullable) · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id) ON DELETE CASCADE` · `sector_code TEXT` (libre, indicatif) · `use_label TEXT NOT NULL` · `criticality_note TEXT` · `data_status TEXT NOT NULL DEFAULT 'manual'` (CHECK 4 valeurs) · `source_release_id BIGINT REFERENCES source_releases(id)` · `created_by` · `created_at` · `updated_at`.
- **CHECK** : `resource_sector_uses_sourced_check` (verified⇒release).
- **Clés** : UNIQUE `(company_id, resource_id, sector_code, use_label)`.
- **Immutable/mutable** : mutable. **RLS** : idem 2.A.
- **⚠️ Sécurité (CD-9/D-9)** : `use_label`/`criticality_note` décrivent **l'usage-secteur** (« refroidissement IRM », « aérospatial »), **JAMAIS** de recette, formulation, proportion, paramètre de propulsion ou de propergol. Contrainte de contenu documentée dans `MODULE2_RLS_AND_SECURITY.md`.
- **Exemple** : `(<helium>,'semiconductors','Refroidissement & atmosphère inerte')`.
- **Limites** : `sector_code` est indicatif (pas de FK vers une taxonomie sectorielle SQL — aucune n'existe en base ; même constat que `iros.topic_code`, 040:107-113).

### 2.F `resource_stage_applicability` — vocabulaire d'étapes par famille (D-6)
- **Finalité** : dire **quelles étapes** de chaîne de valeur s'appliquent à quelle **famille**, et **dans quel ordre** — piloté DB, jamais codé en dur.
- **Portée** : mixte (majoritairement global).
- **Réutilise** `processing_stages` (034) : les `stage_code` référencés doivent exister dans `processing_stages` (semis global étendu par 042 pour les familles non-aimant : ex. `air_separation`, `purification`, `liquefaction`, `cultivation`, `harvest`, `primary_processing`, `conversion`, `enrichment`…). **Nouveaux `stage_code` = vocabulaire structurel générique, aucun paramètre opérationnel.**
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT REFERENCES companies(id)` (nullable) · `family TEXT NOT NULL` (CHECK = mêmes valeurs que `primary_family`) · `stage_code TEXT NOT NULL` · `stage_order INTEGER NOT NULL` (ordre **au sein de la famille** — c'est CE qui diffère du `stage_order` global de `processing_stages`) · `is_upstream BOOLEAN NOT NULL DEFAULT false` · `notes TEXT` · `created_at`.
- **Clés / index** : UNIQUE `(company_id, family, stage_code)` ; `idx_resource_stage_applicability_family (family, stage_order)`.
- **Immutable/mutable** : mutable (vocabulaire versionnable). **Idempotence** : semis `ON CONFLICT DO NOTHING`.
- **RLS** : lecture globale+tenant, écriture globale via `app.rls_bypass` (semis migration), tenant peut ajouter ses propres étapes.
- **Exemple (famille `industrial_gas`)** : `('industrial_gas','air_separation',10,true)`, `('industrial_gas','purification',20,false)`, `('industrial_gas','liquefaction',30,false)`, `('industrial_gas','distribution',40,false)`.
- **Limites** : `scoring.py` devra lire ce vocabulaire (au lieu de `STAGE_ORDER`/`UPSTREAM_STAGES` codés aimant) — dette de refactor documentée dans `METHODOLOGY_AND_ALGORITHMS.md` §D-7 et reprise en PR-M2B.

---

## 3. Migration 043 (N+1) — Expositions & assessments

> **`requires_owner=False`** (à confirmer à l'implémentation) **, `transactional=True`.** Crée 4 tables neuves **+ un seul ALTER** : l'élargissement `iros_origin_domain_check` (DROP+ADD **même nom**, ajout du littéral `'strategic_resources'`) — geste identique à `audit_eventtype_check` en 040/041, tous deux `requires_owner=False` au manifeste. La sonde `_probe_043` doit vérifier le **CONTENU** de la contrainte (pas seulement son nom), motif `_constraint_definition_contains` (035/040/041).
> Manifeste `["043"]` + `_probe_043` à ajouter.

### 3.A `resource_supply_observations` — parts pays par étape (fondation HHI)
- **Finalité** : part d'un pays dans une ressource **à une étape donnée** (production/réserves/flux) — l'entrée du HHI. Miroir FK-validé de `material_stage_observations` (034).
- **Portée** : mixte (observation globale lisible + tenant).
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT REFERENCES companies(id)` (nullable) · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id)` · `stage_code TEXT NOT NULL` · `country_code TEXT NOT NULL` · `metric_code TEXT NOT NULL` (CHECK `IN ('production','reserves','refining_capacity','trade_export','trade_import')`) · `share_pct NUMERIC` · `volume_value NUMERIC` · `volume_unit TEXT` · `reference_year INTEGER NOT NULL` · `data_status TEXT NOT NULL DEFAULT 'estimated'` (CHECK 4) · `confidence NUMERIC` (CHECK 0-1, **séparé**) · `methodology_version TEXT` · `source_release_id BIGINT REFERENCES source_releases(id)` · `evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id)` · `observed_at TIMESTAMPTZ` · `created_by` · `created_at` · `updated_at`.
- **CHECK** : `share_pct` 0-100 ; `confidence` 0-1 ; `resource_supply_observations_sourced_check` (verified⇒release).
- **Clés / index** : `resource_supply_observations_uniq` UNIQUE `(company_id, resource_id, stage_code, country_code, reference_year, metric_code)` (idempotent, interdit le double-comptage HHI) ; index `(resource_id, stage_code, reference_year)`, `(country_code)`, `(source_release_id)`.
- **Immutable/mutable** : mutable (correction possible), mais **idempotent** par la clé unique.
- **Lien EK** : `source_release_id`/`evidence_artifact_id`.
- **RLS** : lecture globale+tenant, écriture tenant (global via bypass admin).
- **Réconciliation legacy (D-2)** : pour une ressource **déjà CRMA** (hélium/silicium/charbon à coke), le moteur d'assessment lit **l'union** de `resource_supply_observations` (resource_id) **et** de `material_stage_observations` legacy résolues via `resource_aliases.alias_kind='legacy_material_id'`. Aucune recopie, aucun ALTER de 034.
- **Exemple** : `(NULL,<helium>,'extraction','US','production',40,…,2025,'estimated',<release USGS>)`.
- **Limites** : biais de couverture incomplète (`observed_total < 100 %`) traité par le moteur (cf. `METHODOLOGY_AND_ALGORITHMS.md` §B.1), pas par le schéma.

### 3.B `company_resource_exposure_links` — pont d'exposition (D-1)
- **Finalité** : relier une ressource à un objet **existant** d'un autre module (BOM, achat, énergie, eau, déclaration fournisseur) ou une saisie manuelle — **orchestration, pas duplication** (D-1/D-4).
- **Portée** : **tenant strict** (`company_id NOT NULL`).
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT NOT NULL REFERENCES companies(id)` · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id)` · `role TEXT NOT NULL` (CHECK = vocabulaire `resource_roles`) · `link_kind TEXT NOT NULL` CHECK `IN ('bom_item','purchase_line','energy_activity','water_activity','supplier_declaration','manual')` · FK nullables : `bom_item_id BIGINT REFERENCES bom_items(id)` · `purchase_line_id BIGINT REFERENCES purchase_lines(id)` · `energy_activity_id BIGINT REFERENCES energy_activities(id)` · `water_activity_id BIGINT REFERENCES water_activities(id)` · `supplier_declaration_id BIGINT REFERENCES supplier_metric_declarations(id)` · `manual_note TEXT` · magnitudes tenant : `annual_mass_kg NUMERIC` · `annual_spend_eur NUMERIC` · `share_of_supply_pct NUMERIC` (0-100) · `stock_coverage_days NUMERIC` · `data_status TEXT NOT NULL DEFAULT 'manual'` · `confidence NUMERIC` · `notes TEXT` · `created_by` · `created_at` · `updated_at`.
- **CHECK** : `company_resource_exposure_links_target_check` — **exactement une** cible cohérente avec `link_kind` (ex. `link_kind='bom_item' ⇒ bom_item_id NOT NULL AND (purchase_line_id,…) NULL` ; `link_kind='manual' ⇒ tous les *_id NULL AND manual_note NOT NULL`). `share_of_supply_pct` 0-100 ; `stock_coverage_days >= 0`.
- **Clés / index** : `idx_crel_company (company_id)`, `idx_crel_resource (company_id, resource_id)`, un index par FK cible.
- **Immutable/mutable** : mutable. **Idempotence** : pas de clé métier naturelle unique (un lien = une relation explicite) ; ré-exécution idempotente au niveau service.
- **Lien EK** : indirect (magnitudes = données propres du tenant, aucune licence externe). **D-4** : l'intensité carbone n'est **jamais** stockée ici — elle est **lue** depuis le module de l'objet lié.
- **RLS** : tenant strict. **Défense applicative** : chaque FK cible est vérifiée `company_id = tenant` avant insertion (anti-IDOR, motif `exposure_service._assert_in_scope`, 034).
- **Exemple** : `(<tenant>,<helium>,'process_input','purchase_line',purchase_line_id=…, annual_spend_eur=120000)`.
- **Limites** : `manual_assessment` = `link_kind='manual'` + `manual_note` (aucune table `manual_assessment` n'existe ni n'est créée — c'est une saisie libre, pas un objet).

### 3.C `resource_assessment_runs` — run d'assessment IMMUTABLE (risque+confiance séparés)
- **Finalité** : instantané figé et reproductible d'un calcul d'exposition ressource. Modèle **run** (motif `scope2_calculation_runs` 033 / `procurement_calculation_runs` 032), **pas** le modèle mutable de `crma_article24_assessments`.
- **Portée** : tenant strict.
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT NOT NULL REFERENCES companies(id)` · `resource_id BIGINT NOT NULL REFERENCES resource_catalog(id)` · `assessment_year INTEGER NOT NULL` · `status TEXT NOT NULL DEFAULT 'draft'` CHECK `IN ('draft','computed','approved','superseded')` · `supersedes_id BIGINT REFERENCES resource_assessment_runs(id)` · `risk_score NUMERIC` (CHECK 0-100) · `confidence NUMERIC` (CHECK 0-100, **séparé**) · `coverage_pct NUMERIC` (0-100) · `methodology_code TEXT NOT NULL DEFAULT 'CC-RESOURCE-EXPOSURE'` (O-8, cf. §4) · `methodology_version TEXT NOT NULL DEFAULT '0.1.0'` · `input_snapshot JSONB NOT NULL DEFAULT '{}'` (reproductibilité) · `drivers JSONB NOT NULL DEFAULT '[]'` · `warnings JSONB NOT NULL DEFAULT '[]'` · `sensitivity JSONB` (bande OAT, O-5 ; nullable) · `iro_signal_id BIGINT REFERENCES iros(id)` (D-5, nullable) · `calculated_at TIMESTAMPTZ` · `prepared_by BIGINT` · `approved_by BIGINT` · `approved_at` · `created_at` · `updated_at`.
- **CHECK** : `risk_score`/`confidence`/`coverage_pct` bornés séparément ; `resource_assessment_runs_approval_check` : `status <> 'approved' OR approved_by IS NOT NULL`.
- **Immutable** : trigger `trg_resource_assessment_runs_guard` — une fois `status <> 'draft'`, `risk_score`/`confidence`/`input_snapshot`/`methodology_*` **non réécrivables** ; recalcul ⇒ **nouveau run** avec `supersedes_id` (motif immuabilité `scope2_calculation_runs` 033 / append-only `materiality_decisions` 040). DELETE refusé hors draft.
- **Clés / index** : `idx_rar_current` UNIQUE `(company_id, resource_id, assessment_year) WHERE status <> 'superseded'` (un run courant par ressource-année, historique préservé) ; `(company_id, status)`.
- **Lien EK** : `input_snapshot` capture les `source_release_id` des observations utilisées.
- **RLS** : tenant strict + défense applicative.
- **D-5** : si le run dépasse un seuil de dépendance, le service peut créer un `iros` (`origin_domain='strategic_resources'`) et poser `iro_signal_id`. **Proposition seulement** — jamais une décision de matérialité.
- **Limites** : `risk_score=NULL` autorisé (aucune composante disponible ⇒ pas de nombre inventé) ; la confiance reste calculée.

### 3.D `resource_assessment_dimensions` — composantes par run (immutable)
- **Finalité** : persister CHAQUE composante inspectable d'un run (`ScoreComponent`/`ConfidenceComponent` de `scoring.py`) — jamais un total opaque.
- **Portée** : tenant strict (enfant du run).
- **Colonnes** : `id BIGSERIAL PK` · `company_id BIGINT NOT NULL REFERENCES companies(id)` · `run_id BIGINT NOT NULL REFERENCES resource_assessment_runs(id) ON DELETE CASCADE` · `kind TEXT NOT NULL` CHECK `IN ('risk','confidence')` (**sépare risque et confiance**) · `dimension_code TEXT NOT NULL` (ex. `stage_concentration`,`third_country_dependency`,`supplier_dependency`,`substitutability`,`recycling_potential`,`stock_coverage`,`regulatory_events` / `stage_coverage`,`data_quality`,`component_coverage`,`freshness`,`license_access`) · `available BOOLEAN NOT NULL` · `risk_value NUMERIC` · `weight NUMERIC` · `contribution NUMERIC` · `raw_value NUMERIC` · `raw_unit TEXT` · `stage_code TEXT` (étape sélectionnée — jamais fusionnée) · `rationale TEXT` · `source_release_ids JSONB NOT NULL DEFAULT '[]'` (**provenance par composante** — comble le gap B.5) · `created_at`.
- **CHECK** : `resource_assessment_dimensions_uniq` UNIQUE `(run_id, kind, dimension_code)`.
- **Immutable** : enfant d'un run figé ; `ON DELETE CASCADE` du run ; trigger d'append-only optionnel (le run parent gèle déjà l'ensemble).
- **RLS** : tenant strict. **Lien EK** : `source_release_ids` traçant chaque driver à ses releases.
- **Exemple** : `(run, 'risk','stage_concentration',true,72.0,0.30,21.6,72.0,'HHI (0-100)','extraction','Étape la plus concentrée…',[<release>])`.
- **Limites** : `kind='confidence'` porte `value` dans `raw_value` (pas de `risk_value`) — jamais additionné au risque.

### 3.E ALTER unique — élargissement `iros_origin_domain_check` (D-5)
- **Geste** : `ALTER TABLE iros DROP CONSTRAINT iros_origin_domain_check; ALTER TABLE iros ADD CONSTRAINT iros_origin_domain_check CHECK (origin_domain IN ('water','nature','crma','energy','manual','strategic_resources'));` — **même nom**, ajout du seul littéral `'strategic_resources'`. Précédent exact : `audit_eventtype_check` en 040 (`materiality_decision`) et 041 (`ai_review_decision`), tous deux `requires_owner=False`.
- **Sonde** : `_probe_043` doit utiliser `_constraint_definition_contains(cur,'iros','iros_origin_domain_check','strategic_resources')` — le nom réutilisé ne distingue pas l'ancienne de la nouvelle définition.
- **Limite** : aucune donnée `iros` insérée par la migration (l'émission de signal est un acte de service, tenant, runtime).

---

## 4. Points de modèle laissés à l'implémentation (non bloquants)

- **O-8 (nom de méthode)** : proposé `methodology_code='CC-RESOURCE-EXPOSURE' 0.1.0`, distinct du frontend illustratif `CC-SUPPLY-RISK-0.1` et du backend `CC-MATERIAL-EXPOSURE` (CRMA). À confirmer en PR-M2B — le champ est une colonne, pas un enum figé.
- **Réutilisation vs extension de `scoring.py`** : le moteur est **paramétré par famille** (poids/étapes lus depuis `resource_stage_applicability`), pas cloné (CD-2). Détail dans `METHODOLOGY_AND_ALGORITHMS.md` §D-7.
- **Country-risk (D-3)** : aucune table ici. Si v2 WGI est un jour gaté, ce sera une source EK + une dimension `country_risk` supplémentaire dans `resource_assessment_dimensions` (`source_release_ids` obligatoire), jamais une colonne codée.

## 5. Récapitulatif tables

| Migration | Table | Portée | Immutable | Lien EK |
|---|---|---|---|---|
| 042 | `resource_catalog` | mixte | non | source_release_id |
| 042 | `resource_roles` | mixte | non | indirect |
| 042 | `resource_aliases` | mixte | non | indirect |
| 042 | `resource_regulatory_statuses` | mixte | non | source_release_id (⇐ confirmed) |
| 042 | `resource_sector_uses` | mixte | non | source_release_id |
| 042 | `resource_stage_applicability` | mixte | non | — (vocabulaire) |
| 043 | `resource_supply_observations` | mixte | non (idempotent) | source_release_id/artifact |
| 043 | `company_resource_exposure_links` | tenant | non | indirect (D-4) |
| 043 | `resource_assessment_runs` | tenant | **oui (trigger)** | input_snapshot |
| 043 | `resource_assessment_dimensions` | tenant | **oui (enfant figé)** | source_release_ids |
| 043 | *ALTER* `iros_origin_domain_check` | — | — | — |

→ Contrats API : `MODULE2_API_CONTRACTS.md`. RLS & sécurité : `MODULE2_RLS_AND_SECURITY.md`. Tests : `MODULE2_TEST_STRATEGY.md`. Découpage PR : `MODULE2_IMPLEMENTATION_PLAN.md`.
