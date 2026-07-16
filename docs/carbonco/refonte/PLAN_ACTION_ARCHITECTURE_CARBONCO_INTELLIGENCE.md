# CarbonCo Intelligence — Plan d’action et architecture d’exécution

**Version :** 1.0  
**Périmètre :** monorepo `finance-platform` — `apps/carbon` (Next.js) et `apps/api` (FastAPI/PostgreSQL)  
**Objectif :** transformer le module actuel « Matières critiques » en une plateforme d’intelligence décisionnelle auditable, reliée aux achats, fournisseurs, produits, sites, facteurs d’émission, évaluations de matérialité et pièces justificatives existantes.

---

## 1. Décision de cadrage

CarbonCo ne doit pas devenir un agrégateur généraliste de données de marché. Le produit cible doit transformer une information externe ou fournisseur en une chaîne vérifiable :

```text
Source et licence
    ↓
Release immuable et artefact brut
    ↓
Observation normalisée
    ↓
Exposition réelle de l’entreprise
    ↓
Calcul déterministe versionné
    ↓
Risque / impact / opportunité candidat
    ↓
Décision humaine et plan d’action
    ↓
Datapoint, preuve et export auditable
```

### Principes non négociables

1. PostgreSQL reste la source de vérité structurée.
2. Vercel Blob privé conserve les artefacts bruts et les pièces justificatives.
3. Une donnée publiée n’est jamais écrasée ; toute correction crée une nouvelle version.
4. Les données globales et les données tenant sont séparées.
5. Chaque valeur affichée porte une date, une source, un statut et une méthode.
6. Chaque résultat calculé conserve ses entrées, ses facteurs et sa version de méthodologie.
7. Les calculs sont déterministes ; le modèle linguistique n’effectue pas les calculs réglementaires.
8. L’IA ne peut produire que des suggestions ou des claims à revoir.
9. Un signal externe peut créer un IRO candidat, jamais une décision automatique de matérialité.
10. Le risque et le niveau de confiance sont deux grandeurs séparées.
11. Aucun prix ou flux sous licence restrictive n’est affiché sans droit explicite.
12. Aucun chantier ne passe en `LIVE` sans tests RLS, idempotence, traçabilité et export reproductible.

---

## 2. État actuel à réutiliser

Le dépôt contient déjà plusieurs briques structurantes :

- `apps/carbon` : interface Next.js, page publique `/materials`, Mapbox, Recharts, Framer Motion, Inngest, Vercel Blob, Upstash et SDK IA.
- `apps/api` : FastAPI, PostgreSQL/Neon, authentification, RLS, facteurs d’émission, facts versionnés, chaîne de hash, pièces justificatives, fournisseurs, campagnes, questionnaires, sites, produits et double matérialité.
- Le module fournisseurs dispose déjà du CRUD, des imports CSV, campagnes, invitations, réponses publiques et revue humaine.
- Le module `facts` dispose déjà de la provenance, de l’historique, des preuves et de la vérification de chaîne.
- Le module `materialite` dispose déjà de positions, scoring, évaluations archivées et exports.

La stratégie est donc **d’étendre ces domaines**, pas d’ouvrir un second backend ou un second modèle de données parallèle.

---

## 3. Architecture cible

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                            INTERFACE NEXT.JS                            │
│ Sources · Achats · Énergie · Matières · Eau · Nature · IRO · Exports │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ API authentifiée
┌───────────────────────────────▼─────────────────────────────────────────┐
│                              FASTAPI                                   │
│  Intelligence Core  │ Exposure Graph │ Method Engine │ Workflow/Review│
└───────────────┬───────────────┬───────────────┬─────────────────────────┘
                │               │               │
        ┌───────▼───────┐ ┌────▼────────┐ ┌────▼──────────────────────┐
        │ PostgreSQL    │ │ Blob privé  │ │ Inngest / GitHub Actions │
        │ Neon/PostGIS  │ │ raw/evidence│ │ tâches durables/imports   │
        └───────┬───────┘ └─────────────┘ └───────────────────────────┘
                │
        ┌───────▼──────────────────────────────────────────────────────┐
        │ Global reference data + tenant data + facts + IRO + audits │
        └──────────────────────────────────────────────────────────────┘
```

### Les cinq couches

#### Couche 1 — Source & Evidence Kernel

Registre des sources, licences, releases, artefacts, ingestions, observations et preuves.

#### Couche 2 — Référentiels globaux

Matières, groupes, étapes de transformation, pays, unités, facteurs, zones géographiques, réglementations et méthodologies.

#### Couche 3 — Exposure Graph tenant

Sites, fournisseurs, sites fournisseurs, achats, produits, versions de BOM, composants et correspondances matières.

#### Couche 4 — Method Engine

Calculs Scope 3, Scope 2, exposition matière, screening eau/nature et scores de qualité. Méthodes versionnées et testées.

#### Couche 5 — IRO, décisions et reporting

IRO candidats, évaluations impact/financières, décisions humaines, plans d’action, disclosures et Evidence Packs.

---

## 4. Organisation du code

L’implémentation doit respecter les conventions existantes du dépôt. La structure cible indicative est la suivante :

```text
apps/api/
  routers/
    intelligence_sources.py
    intelligence_ingestions.py
    procurement.py
    energy.py
    material_intelligence.py
    water.py
    nature.py
    iro.py
  services/
    intelligence/
      __init__.py
      source_service.py
      release_service.py
      artifact_service.py
      observation_service.py
      ingestion_service.py
      license_policy.py
      freshness_service.py
      adapters/
        base.py
        fake.py
      ai/
        task_service.py
        claim_service.py
        review_service.py
    calculations/
      registry.py
      units.py
      procurement.py
      scope2.py
      material_exposure.py
      water_screening.py
      nature_screening.py
  models/
    intelligence.py
    procurement.py
    energy.py
    materials.py
    water.py
    nature.py
    iro.py
  db/
    migration_runner.py
    migrations/
      028_schema_migrations.sql
      029_intelligence_core.sql
      030_intelligence_rls.sql
      031_procurement_exposure.sql
      032_energy_scope2.sql
      033_material_reference_crma.sql
      034_sites_geospatial.sql
      035_water.sql
      036_nature.sql
      037_iro_intelligence_links.sql
  scripts/
    intelligence/
      import_release.py
      validate_release.py
      publish_release.py
      import_geospatial_dataset.py
  tests/
    intelligence/
    procurement/
    energy/
    materials/
    water/
    nature/

apps/carbon/
  app/
    ... groupe protégé existant .../
      intelligence/
        sources/page.tsx
        ingestions/page.tsx
      procurement/page.tsx
      energy/page.tsx
      materials/exposure/page.tsx
      water/page.tsx
      nature/page.tsx
      materialite/iros/page.tsx
  components/
    intelligence/
      data-status-badge.tsx
      method-badge.tsx
      confidence-badge.tsx
      source-drawer.tsx
      evidence-list.tsx
      calculation-trace.tsx
      review-gate.tsx
      license-warning.tsx
      staleness-warning.tsx
    procurement/
    energy/
    material-intelligence/
    water/
    nature/
    iro/
  lib/
    api/
      intelligence.ts
      procurement.ts
      energy.ts
      materials.ts
      water.ts
      nature.ts
      iro.ts
    schemas/
      intelligence.ts

.github/workflows/
  db-migrate.yml
  intelligence-source-check.yml
  intelligence-heavy-import.yml

docs/carbonco/
  INTELLIGENCE_DATA_ARCHITECTURE.md
  DATA_LICENSE_POLICY.md
  METHODOLOGY_REGISTRY.md
  OPERATIONS_RUNBOOK.md
  prompts/
```

Le chemin exact du groupe de routes protégées doit être déterminé après inspection du dépôt. Ne pas créer un nouveau système de navigation ou d’authentification.

---

## 5. Stratégie de migrations

### 5.1 Problème à corriger

Le système actuel ne doit plus considérer l’existence d’une seule table comme preuve que l’intégralité du schéma est à jour. Les migrations nouvelles doivent être enregistrées individuellement avec leur checksum.

### 5.2 Table `schema_migrations`

```text
schema_migrations
- version TEXT PRIMARY KEY
- checksum TEXT NOT NULL
- status TEXT NOT NULL
  applied | baseline | pending_manual | failed
- applied_at TIMESTAMPTZ
- execution_ms INTEGER
- applied_by TEXT
- notes TEXT
```

### 5.3 Comportement du runner

1. Créer le ledger s’il n’existe pas.
2. Acquérir un verrou PostgreSQL advisory pour empêcher deux cold starts de migrer simultanément.
3. Lors du premier déploiement du ledger :
   - si le schéma historique jusqu’à `sites` est confirmé, inscrire une ligne `baseline-027` ;
   - sinon exécuter le bootstrap historique et contrôler les tables attendues ;
   - ne jamais inscrire automatiquement une migration historiquement absente.
4. Pour les migrations `028+` :
   - calculer le SHA-256 du fichier ;
   - refuser qu’une migration appliquée ait changé de checksum ;
   - exécuter chaque migration dans une transaction ;
   - inscrire `applied` uniquement après commit ;
   - arrêter immédiatement sur erreur.
5. Les migrations nécessitant un rôle propriétaire utilisent un en-tête `mode: manual-owner` et apparaissent `pending_manual` dans la santé du système.
6. Ajouter `GET /health/schema` : version attendue, version appliquée, migrations en attente, erreurs.
7. Production : `AUTO_MIGRATE=0` par défaut. Les migrations sont déclenchées via un workflow GitHub protégé ou une commande opérateur.
8. Local/test : `AUTO_MIGRATE=1` autorisé.

### 5.4 Workflow de migration

```text
workflow_dispatch
→ environnement GitHub protégé
→ DATABASE_ADMIN_URL
→ python -m db.migration_runner apply
→ vérification /health/schema
→ déploiement applicatif
```

---

## 6. Evidence Kernel

### 6.1 `source_registry`

```text
id BIGSERIAL PK
company_id INTEGER NULL
code TEXT NOT NULL
publisher TEXT NOT NULL
title TEXT NOT NULL
source_type TEXT NOT NULL
adapter_kind TEXT
base_uri TEXT
license_code TEXT
automated_access_allowed BOOLEAN NOT NULL DEFAULT FALSE
storage_allowed BOOLEAN NOT NULL DEFAULT FALSE
commercial_use_allowed BOOLEAN NOT NULL DEFAULT FALSE
redistribution_allowed BOOLEAN NOT NULL DEFAULT FALSE
derived_use_allowed BOOLEAN NOT NULL DEFAULT FALSE
display_allowed BOOLEAN NOT NULL DEFAULT FALSE
attribution_required BOOLEAN NOT NULL DEFAULT FALSE
attribution_text TEXT
terms_uri TEXT
retention_days INTEGER
visibility TEXT NOT NULL DEFAULT 'internal'
active BOOLEAN NOT NULL DEFAULT TRUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(company_id, code)
```

`company_id IS NULL` représente une source globale. Une source privée appartient à un tenant.

### 6.2 `source_releases`

```text
id BIGSERIAL PK
company_id INTEGER NULL
source_id BIGINT FK
release_key TEXT NOT NULL
published_at TIMESTAMPTZ
retrieved_at TIMESTAMPTZ NOT NULL
valid_from DATE
valid_to DATE
checksum_sha256 TEXT NOT NULL
blob_key TEXT
mime_type TEXT
schema_version TEXT
status TEXT NOT NULL
  detected | quarantined | validated | published | superseded | blocked_license
supersedes_id BIGINT NULL
metadata JSONB NOT NULL DEFAULT '{}'
created_at TIMESTAMPTZ
UNIQUE(source_id, release_key, checksum_sha256)
```

Une release `published` est immuable. Une correction crée une nouvelle release avec `supersedes_id`.

### 6.3 `evidence_artifacts`

```text
id BIGSERIAL PK
company_id INTEGER NULL
source_release_id BIGINT NULL
blob_key TEXT NOT NULL
sha256 TEXT NOT NULL
filename TEXT
mime_type TEXT
page_reference TEXT
table_reference TEXT
cell_reference TEXT
excerpt TEXT
sensitivity TEXT NOT NULL
  public | internal | confidential | restricted
created_by TEXT
created_at TIMESTAMPTZ
UNIQUE(company_id, sha256, blob_key)
```

### 6.4 `ingestion_runs`

```text
id BIGSERIAL PK
company_id INTEGER NULL
source_id BIGINT FK
source_release_id BIGINT NULL
adapter_code TEXT
adapter_version TEXT
idempotency_key TEXT NOT NULL UNIQUE
status TEXT NOT NULL
  queued | fetching | validating | quarantined | publishing | completed | failed
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
rows_seen INTEGER
rows_valid INTEGER
rows_rejected INTEGER
error_code TEXT
error_detail TEXT
metrics JSONB
triggered_by TEXT
```

### 6.5 `observations`

```text
id BIGSERIAL PK
company_id INTEGER NULL
subject_type TEXT NOT NULL
subject_key TEXT NOT NULL
metric_code TEXT NOT NULL
numeric_value NUMERIC NULL
text_value TEXT NULL
boolean_value BOOLEAN NULL
json_value JSONB NULL
unit TEXT NULL
geography_code TEXT NULL
stage_code TEXT NULL
observed_at TIMESTAMPTZ NULL
valid_from DATE NULL
valid_to DATE NULL
source_release_id BIGINT NOT NULL
evidence_artifact_id BIGINT NULL
confidence_code TEXT NOT NULL
  verified | estimated | manual | inferred
methodology_version TEXT NULL
supersedes_id BIGINT NULL
published_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```

Contraintes :

- exactement une colonne de valeur non nulle ;
- index `(subject_type, subject_key, metric_code, observed_at DESC)` ;
- index sur `source_release_id` ;
- index partiel sur les observations actives non supersédées ;
- immutabilité après publication.

### 6.6 RLS

Pour toutes les tables de ce noyau :

```text
READ  : company_id IS NULL OR company_id = current tenant
WRITE : company_id = current tenant
GLOBAL WRITE : uniquement avec rls_bypass/service admin
```

Les artefacts `confidential` et `restricted` sont toujours servis via le proxy authentifié déjà utilisé pour les preuves.

---

## 7. Contrat API transversal

Tous les résultats analytiques utilisent une enveloppe commune :

```json
{
  "data": {},
  "meta": {
    "as_of": "2026-06-30",
    "status": "estimated",
    "method": {
      "code": "CC-METHOD",
      "version": "1.0.0"
    },
    "quality": {
      "confidence": 62,
      "coverage_pct": 80,
      "warnings": []
    }
  },
  "evidence": [
    {
      "artifact_id": 415,
      "source_code": "SOURCE",
      "release_key": "2026",
      "page_reference": "p. 43"
    }
  ]
}
```

### Endpoints du noyau

```text
GET    /intelligence/sources
POST   /intelligence/sources
GET    /intelligence/sources/{id}
PATCH  /intelligence/sources/{id}
GET    /intelligence/sources/{id}/releases
POST   /intelligence/sources/{id}/releases
GET    /intelligence/releases/{id}
POST   /intelligence/releases/{id}/validate
POST   /intelligence/releases/{id}/publish
POST   /intelligence/releases/{id}/supersede
GET    /intelligence/ingestions
GET    /intelligence/ingestions/{id}
GET    /intelligence/observations
GET    /intelligence/observations/{id}
GET    /intelligence/observations/{id}/evidence
GET    /intelligence/freshness
```

Permissions :

- lecture : utilisateur authentifié du tenant ;
- création source tenant : analyste ;
- publication/supersession : administrateur ou rôle dédié `data_steward` si le dépôt gère l’ajout d’un rôle ;
- publication d’une source globale : service admin uniquement.

---

## 8. Adaptateurs et orchestration

### 8.1 Interface d’adaptateur

```python
class SourceAdapter(Protocol):
    code: str
    version: str

    def detect_releases(self, source: SourceConfig) -> list[DetectedRelease]: ...
    def fetch_release(self, release: DetectedRelease) -> DownloadedArtifact: ...
    def parse(self, artifact: DownloadedArtifact) -> Iterable[RawRecord]: ...
    def normalize(self, record: RawRecord) -> Iterable[ObservationDraft]: ...
```

Chaque adaptateur doit être :

- idempotent ;
- testable hors réseau via fixtures ;
- sans logique de calcul métier ;
- incapable de publier si la licence ne l’autorise pas ;
- versionné dans le code.

### 8.2 Événements Inngest

```text
intelligence.source.check.requested
intelligence.release.detected
intelligence.release.download.requested
intelligence.release.validation.requested
intelligence.release.publish.requested
intelligence.release.published
intelligence.exposure.recalculate.requested
intelligence.risk.assessment.requested
```

### 8.3 Répartition des charges

- Petites API JSON/CSV : Inngest peut orchestrer les appels.
- Gros PDF, shapefiles, GeoPackages ou datasets lourds : GitHub Actions protégé ou CLI local d’administration.
- Aucune ingestion lourde dans une requête utilisateur.
- Aucune donnée externe téléchargée au rendu de `/materials`.

### 8.4 Idempotence

```text
idempotency_key = source_id + release_key + checksum_sha256 + adapter_version
```

---

## 9. Method Engine

### 9.1 Registre des méthodologies

```text
methodologies
- id
- code
- version
- status: draft | approved | retired
- formula_json
- parameter_schema JSONB
- unit_rules JSONB
- fallback_hierarchy JSONB
- effective_from
- effective_to
- evidence_release_ids JSONB
- checksum
- approved_by
- approved_at
```

### 9.2 Résultats de calcul

Chaque domaine possède sa table de runs, mais partage les attributs suivants :

```text
run_id
company_id
methodology_code
methodology_version
input_snapshot JSONB
factor_versions JSONB
result JSONB
warnings JSONB
confidence INTEGER
coverage_pct NUMERIC
calculated_at
approved_at
approved_by
```

### 9.3 Interface de calcul

```python
class CalculationMethod(Protocol):
    code: str
    version: str

    def validate(self, input_data) -> ValidationReport: ...
    def calculate(self, input_data) -> CalculationResult: ...
    def trace(self, result) -> list[CalculationStep]: ...
```

### 9.4 Règles

- aucun fallback silencieux ;
- conversion d’unité centralisée ;
- arrondis uniquement en sortie d’affichage ;
- conservation des valeurs brutes ;
- méthodes approuvées immuables ;
- tests golden sur chaque version.

---

## 10. Architecture fournisseurs et achats

### 10.1 Objectif

Relier les données fournisseurs et achats aux produits, matières, facteurs et preuves. Le module existant de campagnes reste le moteur de collecte.

### 10.2 Tables

```text
supplier_sites
- id, company_id, supplier_id, name, address, country_code
- latitude, longitude, geom, geocode_review_status

supplier_products
- id, company_id, supplier_id, product_code, product_name
- category_code, origin_country, manufacturing_site_id

purchase_imports
- id, company_id, filename, sha256, period_start, period_end
- status, row_count, accepted_count, rejected_count, imported_by, imported_at

purchase_lines
- id, company_id, import_id, supplier_id, supplier_external_code
- product_id, product_external_code, purchase_date
- quantity, unit, spend_amount, currency, category_code, origin_country
- raw_row_json, mapping_status

bom_versions
- id, company_id, product_id, version, valid_from, valid_to
- status, source_artifact_id

bom_items
- id, company_id, bom_version_id, parent_item_id
- component_code, component_name, quantity, unit
- supplier_id, supplier_product_id

material_mappings
- id, company_id, bom_item_id, material_id
- mass_value, mass_unit, mass_fraction
- mapping_method, confidence, review_status, reviewed_by

supplier_metric_declarations
- id, company_id, supplier_id, supplier_product_id
- metric_code, value, unit, reporting_year, boundary, methodology
- primary_data_pct, assurance_status, evidence_artifact_id, review_status

product_carbon_footprints
- id, company_id, supplier_product_id
- cradle_boundary, value_kgco2e, declared_unit, reference_flow
- reporting_period, methodology, verification_status, evidence_artifact_id

procurement_calculation_runs
procurement_line_results
```

### 10.3 Hiérarchie Scope 3 catégorie 1

```text
1. PCF fournisseur vérifiée et comparable
2. Méthode fournisseur spécifique / hybride
3. Facteur physique moyen par produit ou matière
4. Facteur économique par catégorie de dépense
5. Ligne non résolue avec tâche de correction
```

Chaque ligne conserve :

```text
calculation_method
factor_id
factor_version
activity_value
activity_unit
result_tco2e
uncertainty_band
data_quality
fallback_reason
warnings
```

### 10.4 Score fournisseur

Ne pas produire un score ESG opaque unique. Présenter cinq dimensions :

1. maturité des preuves ;
2. qualité des données GES ;
3. concentration d’approvisionnement ;
4. exposition géographique ;
5. statut de conformité et de réponse.

### 10.5 API

```text
POST   /procurement/imports
GET    /procurement/imports/{id}
GET    /procurement/imports/{id}/errors
POST   /procurement/imports/{id}/resolve-mappings
GET    /procurement/hotspots
GET    /procurement/exposures/materials
GET    /procurement/exposures/countries
POST   /procurement/calculate
GET    /procurement/runs/{id}
GET    /procurement/runs/{id}/evidence-pack

GET    /suppliers/{id}/sites
POST   /suppliers/{id}/sites
GET    /suppliers/{id}/products
POST   /suppliers/{id}/products
GET    /suppliers/{id}/risk
GET    /suppliers/{id}/evidence-quality

POST   /products/{id}/boms
GET    /products/{id}/boms/{version}
POST   /products/{id}/boms/{version}/map-materials
```

### 10.6 Interface

Vue « Exposition achats » :

- dépenses et masse couvertes ;
- pourcentage résolu/non résolu ;
- top émissions ;
- top matières critiques ;
- top pays/fournisseurs concentrés ;
- taux de données primaires ;
- méthodes de calcul ;
- tâches de collecte ;
- drill-down achat → fournisseur → produit → matière → facteur → calcul → preuve.

---

## 11. Architecture énergie et Scope 2

### 11.1 Séparation obligatoire

- **Comptabilité Scope 2 de l’entreprise :** consommation de ses propres sites, location-based et market-based.
- **Estimation fournisseur :** proxy de chaîne de valeur, toujours étiqueté `estimated`.

### 11.2 Tables

```text
energy_meters
energy_activities
contractual_instruments
instrument_allocations
energy_factor_metadata
scope2_calculation_runs
scope2_line_results
```

### 11.3 Hiérarchie location-based

```text
facteur sous-national compatible
→ facteur national compatible
→ facteur régional documenté
→ erreur explicite
```

### 11.4 Hiérarchie market-based

```text
instrument contractuel valide et alloué
→ facteur fournisseur admissible
→ mix résiduel compatible
→ fallback autorisé et documenté
```

### 11.5 Contrôles

- aucune double allocation ;
- quantité couverte <= consommation ;
- période et zone compatibles ;
- unité convertible ;
- instrument expiré signalé ;
- quantité non couverte conservée.

### 11.6 API

```text
GET    /energy/meters
POST   /energy/meters
POST   /energy/activities/import
GET    /energy/activities
POST   /energy/instruments
GET    /energy/instruments
POST   /energy/instruments/{id}/allocate
POST   /energy/scope2/calculate
GET    /energy/scope2/runs/{id}
POST   /energy/scope2/runs/{id}/approve
GET    /energy/scope2/runs/{id}/evidence-pack
```

---

## 12. Architecture matières critiques et CRMA

### 12.1 Modèle réglementaire

Le statut doit être non exclusif :

```text
is_critical_eu BOOLEAN
is_strategic_eu BOOLEAN
regulation_version_id
```

Toute matière stratégique est aussi critique.

### 12.2 Tables globales

```text
materials
material_groups
material_group_members
processing_stages
material_stage_observations
material_market_observations
substitutes
recycling_routes
trade_or_regulatory_events
```

Les parts pays sont toujours attachées à une étape : extraction, séparation, raffinage, transformation, composant.

### 12.3 Tables tenant

```text
company_material_exposures
material_exposure_runs
material_exposure_results
crma_article24_assessments
crma_mitigation_actions
```

### 12.4 Score

Nom : **CarbonCo Material Exposure Score**.

Composantes :

- concentration géographique ;
- concentration par étape ;
- dépendance fournisseur ;
- dépendance pays tiers ;
- substituabilité ;
- maturité du recyclage ;
- couverture de stock ;
- événements commerciaux/réglementaires ;
- volatilité seulement si données licenciées ;
- qualité des données.

Le résultat expose séparément :

```json
{
  "risk_score": 78,
  "confidence": 54,
  "drivers": []
}
```

### 12.5 MVP

- terres rares pour aimants permanents ;
- NdFeB et SmCo ;
- étapes extraction → aimant → composant ;
- BOM et fournisseurs ;
- rapport Article 24 ;
- aucun prix non licencié.

---

## 13. Architecture géospatiale et eau

### 13.1 Extension `sites`

```text
latitude NUMERIC(9,6)
longitude NUMERIC(9,6)
geom geography(Point,4326)
geocode_precision TEXT
geocode_provider TEXT
geocode_provider_id TEXT
geocode_review_status TEXT
geocode_reviewed_by TEXT
geocode_reviewed_at TIMESTAMPTZ
```

Index GiST sur `geom`.

Workflow :

```text
adresse importée
→ coordonnées proposées
→ validation sur carte
→ statut verified
→ analyses géospatiales autorisées
```

### 13.2 Tables eau

```text
water_activities
water_permits
water_dataset_releases
water_risk_areas
site_water_screenings
water_targets
water_actions
water_iro_candidates
```

### 13.3 Pipeline

```text
sites vérifiés
→ ST_Intersects
→ indicateurs de bassin bruts
→ volumes propres
→ screening versionné
→ IRO candidat
→ revue humaine
```

Le module produit un screening, jamais une conclusion automatique de matérialité.

---

## 14. Architecture biodiversité / TNFD LEAP

### 14.1 Tables

```text
nature_dataset_releases
nature_features
site_nature_intersections
nature_dependencies
nature_impacts
leap_assessments
leap_assessment_sites
nature_risks
nature_opportunities
nature_actions
tnfd_disclosure_drafts
```

### 14.2 Workflow

```text
Locate
→ Evaluate
→ Assess
→ Prepare
```

Règles :

- proximité != impact ;
- dépendance != risque financier ;
- données sensibles masquées ;
- licence par dataset ;
- IRO soumis à revue ;
- aucun rapport déclaré prêt à publier automatiquement.

---

## 15. IRO et double matérialité

Étendre le module actuel avec :

```text
iros
iro_evidence_links
impact_assessments
financial_assessments
materiality_decisions
disclosure_mappings
```

### Workflow

```text
signal matière/eau/énergie/nature
→ IRO candidat
→ évaluation impact
→ évaluation financière
→ consultation/justification
→ décision humaine
→ archive
→ disclosures et actions
```

Le score 2D existant peut rester un outil de visualisation et de tri. Il ne doit pas remplacer les attributs et justifications sous-jacents.

---

## 16. Architecture IA

### 16.1 Utilisations autorisées

- proposition de mapping de colonnes ;
- extraction structurée avec page/table ;
- suggestion produit–matière ;
- résumé de release ;
- génération d’un brouillon de questionnaire ;
- brouillon narratif ;
- détection d’incohérences ;
- proposition d’IRO candidat.

### 16.2 Utilisations interdites

- calcul final d’émissions ;
- sélection silencieuse d’un facteur ;
- décision de matérialité ;
- invention d’une valeur ;
- modification d’une donnée validée ;
- publication sans preuve ;
- déclaration qu’une source a été consultée sans artefact.

### 16.3 Tables

```text
ai_tasks
ai_runs
ai_claims
ai_citations
ai_review_decisions
```

### 16.4 Gate de publication

```text
schema_valid
AND citation_resolved
AND license_allowed
AND human_review = approved
```

---

## 17. Composants UI transverses

Créer une fois :

```text
<DataStatusBadge />
<MethodBadge />
<ConfidenceBadge />
<SourceDrawer />
<EvidenceList />
<CalculationTrace />
<ReviewGate />
<LicenseWarning />
<StalenessWarning />
<IroCandidateButton />
```

Vocabulaire stable :

```text
VERIFIED · ESTIMATED · MANUAL · INFERRED · STALE
LICENSED · BLOCKED · DRAFT · BETA · LIVE · ROADMAP
```

---

## 18. Sécurité et observabilité

### Sécurité

- RLS FORCE sur toute donnée tenant ;
- Blob privé et téléchargement proxy ;
- validation du type réel des fichiers ;
- taille maximale ;
- aucune clé dans `NEXT_PUBLIC_*` ;
- séparation `DATABASE_URL` applicative et `DATABASE_ADMIN_URL` migration ;
- rate limiting sur imports, calculs et IA ;
- audit de toute publication, approbation, supersession et export ;
- suppression logique, jamais destruction d’une release publiée ;
- exports tenant-scoped.

### Observabilité

- Sentry pour erreurs applicatives ;
- logs JSON avec `request_id`, `company_id`, `run_id`, `source_id` ;
- métriques : succès ingestion, durée, lignes rejetées, fraîcheur, taux de mapping, couverture, erreurs licence ;
- `/health/schema` ;
- `/health/intelligence` ;
- tableau interne de fraîcheur des sources.

---

## 19. Stratégie de branches et PR

Ne jamais développer tous les modules dans une seule branche.

```text
PR-01 fix/materials-data-trust
PR-02 feat/schema-migration-ledger
PR-03 feat/intelligence-evidence-kernel
PR-04 feat/intelligence-source-admin
PR-05 feat/procurement-exposure
PR-06 feat/energy-scope2-dual
PR-07 feat/crma-material-exposure
PR-08 feat/geospatial-sites-water
PR-09 feat/nature-leap
PR-10 feat/iro-intelligence-links
PR-11 feat/ai-evidence-review
```

Chaque PR :

- migration limitée ;
- feature flag ;
- tests ;
- documentation ;
- aucun push/merge automatique par Claude Code ;
- validation preview avant fusion.

---

## 20. Roadmap et portes de sortie

### Phase 0 — Vérité des données `/materials`

**Durée indicative :** 2 à 4 jours.

Livrables :

- textes publics conformes au fonctionnement réel ;
- `is_critical_eu` et `is_strategic_eu` ;
- score renommé CarbonCo ;
- badges de qualité ;
- aucune tendance sur un seul point ;
- méthodologie visible ;
- tests.

Gate : aucune promesse d’automatisation ou de donnée vérifiée non démontrée.

### Phase 1 — Ledger de migrations

**Durée indicative :** 3 à 5 jours.

Livrables : runner strict, baseline 027, checksums, advisory lock, workflow GitHub, health schema, tests.

Gate : nouvelle migration détectable et reproductible sur base vide et base existante.

### Phase 2 — Evidence Kernel

**Durée indicative :** 7 à 10 jours.

Livrables : tables, RLS, services, API, Blob privé, licence, FakeAdapter, UI sources interne, tests.

Gate : une release fictive peut être détectée, téléchargée, validée, publiée, supersédée et auditée.

### Phase 3 — Registre de sources et premier import maîtrisé

**Durée indicative :** 5 à 7 jours.

Livrables : CLI d’import, fixtures, source démo CarbonCo, migration du snapshot actuel vers une release `estimated`, page de fraîcheur.

Gate : aucune donnée publique ne vient d’un fichier sans release et source enregistrées.

### Phase 4 — Exposition achats/fournisseurs

**Durée indicative :** 10 à 15 jours.

Livrables : imports, mappings, BOM, calculs, hotspots, campagne fournisseur, Evidence Pack.

Gate : import idempotent et drill-down complet jusqu’à la preuve.

### Phase 5 — Scope 2 dual

**Durée indicative :** 7 à 10 jours.

Livrables : ledger énergie, instruments, allocations, double calcul, trace, export.

Gate : double allocation impossible et calcul reproductible.

### Phase 6 — CRMA / aimants permanents

**Durée indicative :** 10 à 15 jours.

Livrables : étapes matière, exposition client, score versionné, Article 24, actions.

Gate : aucune concentration globale ne mélange extraction et transformation.

### Phase 7 — PostGIS et eau

**Durée indicative :** 10 à 15 jours.

Livrables : site géocodé vérifié, import géospatial hors runtime, screening eau, IRO candidats.

Gate : aucun screening silencieux sur une position incertaine.

### Phase 8 — Nature LEAP

**Durée indicative :** 15 à 20 jours.

Livrables : Locate/Evaluate/Assess/Prepare, licences, masquage, export.

Gate : proximité, dépendance, impact et risque restent distincts.

### Phase 9 — IRO transverse et IA revue

**Durée indicative :** 10 à 15 jours.

Livrables : IRO liés aux signaux, claims IA cités, review gate, disclosures.

Gate : aucun claim IA publié sans revue et preuve.

---

## 21. Matrice de tests obligatoire

### Unitaires

- licence ;
- conversions d’unités ;
- fallback ;
- scores ;
- validation de claims ;
- déterminisme.

### Intégration PostgreSQL

- migrations depuis base vide ;
- baseline depuis schéma existant ;
- RLS tenant/global ;
- immutabilité ;
- supersession ;
- advisory lock ;
- PostGIS.

### API

- auth/roles ;
- pagination ;
- idempotence ;
- erreurs structurées ;
- téléchargement evidence ;
- exports.

### Frontend

- badges ;
- source drawer ;
- calculation trace ;
- review gate ;
- clavier/ARIA ;
- mobile ;
- états loading/empty/error/stale.

### E2E

- importer → mapper → calculer → revoir → exporter ;
- source → release → observation → exposition → IRO candidat ;
- accès cross-tenant refusé.

### Données

- fixture valide ;
- schéma invalide ;
- licence interdite ;
- date future ;
- unité inconnue ;
- doublon ;
- correction supersédée ;
- historique à un seul point.

---

## 22. Variables d’environnement

À confirmer avec les conventions existantes :

```text
DATABASE_URL
DATABASE_ADMIN_URL
AUTO_MIGRATE=0
BLOB_READ_WRITE_TOKEN
CRON_SERVICE_TOKEN
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
ANTHROPIC_API_KEY ou configuration AI Gateway existante
CARBONCO_API_BASE_URL
SOURCE_ADAPTERS_ENABLED
INTELLIGENCE_PUBLIC_DATA_MODE=demo|verified
MAPBOX_TOKEN uniquement si déjà utilisé selon la convention actuelle
```

Ne jamais mettre les secrets en `NEXT_PUBLIC_*`.

---

## 23. Definition of Done globale

Un module peut passer en `LIVE` seulement si :

- chaque valeur affiche date, source et statut ;
- chaque source a une licence enregistrée ;
- chaque calcul a méthode et version ;
- une estimation est distincte d’une donnée vérifiée ;
- risque et confiance sont séparés ;
- les imports sont idempotents ;
- le RLS est testé ;
- les preuves sont privées ;
- l’IA ne publie rien sans revue ;
- la matérialité est décidée humainement ;
- l’export est reproductible ;
- les textes publics correspondent au fonctionnement réel ;
- lint, tests, build et `git diff --check` passent.

---

# 24. Runbook terminal — démarrage immédiat

## Préparation

```bash
cd /chemin/vers/finance-platform
git status --short
git switch master
git pull --ff-only
```

Ne pas continuer si le working tree contient des modifications non comprises.

---

## PR-01 — Vérité et intégrité de `/materials`

```bash
git switch -c fix/materials-data-trust
claude
```

Colle le prompt suivant.

### Prompt Claude Code PR-01

```text
Tu es lead engineer et data product architect sur le monorepo finance-platform.
Tu dois travailler uniquement sur la PR-01 « materials data trust ».
Ne commence aucun autre epic. Ne committe, ne pousse et ne crée aucune PR sans validation explicite.

OBJECTIF
Aligner entièrement les promesses publiques de /materials sur le fonctionnement réel, corriger le modèle critique/stratégique et rendre la qualité des données visible.

INSPECTION OBLIGATOIRE AVANT MODIFICATION
- apps/carbon/app/materials/page.tsx
- apps/carbon/lib/crm/dataLoader.ts
- apps/carbon/data/crm_full_34_snapshot_*.json
- apps/carbon/data/crm_price_history.json
- .github/workflows/materials-price-history.yml
- apps/carbon/scripts/append-price-history.mjs
- tous les composants apps/carbon/components/materials
- tests Vitest et Playwright liés à materials, landing et feature registry
- conventions de badges UI existantes

ÉTAPE 1 — DIAGNOSTIC
Produis d’abord un diagnostic précis :
- ce qui est statique ;
- ce que fait réellement le workflow hebdomadaire ;
- quelles assertions publiques sont trop fortes ;
- où criticality_eu et criticality_score sont utilisés ;
- combien de composants et tests seront touchés.
Attends d’avoir terminé le diagnostic avant de modifier.

ÉTAPE 2 — MODÈLE
Remplace le statut exclusif criticality_eu par :
- is_critical_eu: boolean
- is_strategic_eu: boolean
- regulation_version: string | null
Toutes les matières stratégiques doivent avoir is_critical_eu=true.

Renomme criticality_score en :
- carbonco_supply_risk_score: number | null
- score_methodology_version: string | null
- score_confidence: number | null
Le score ne doit jamais être présenté comme officiel UE.

Ne change aucune valeur numérique du snapshot sauf transformation de structure nécessaire.

Ne conserve pas china_dominant comme source de vérité. Dérive le statut affiché depuis top_producers pour l’étape actuellement disponible et affiche un avertissement : le snapshot ne distingue pas encore extraction, raffinage et transformation.

ÉTAPE 3 — TRANSPARENCE
Remplace les formulations publiques trop fortes par :
- Snapshot de démonstration
- Valeurs estimées
- Non destiné à un usage normatif
- Date du snapshot
- L’historique local est enrichi uniquement lorsqu’un nouveau snapshot daté est publié

Rends methodology_note visible dans la page.

La phrase « aucune donnée inventée » doit disparaître tant que les valeurs restent estimated.
La phrase « mise à jour automatique des sources chaque lundi » doit disparaître.

ÉTAPE 4 — PRIX
Une série price_history avec moins de deux points indépendamment datés ne doit pas être présentée comme une tendance historique.
Aucun graphique ou badge ne doit simuler une série.
Le trend_3m_pct du snapshot peut être affiché uniquement comme estimation du snapshot, avec badge ESTIMATED, jamais comme historique observé si la série ne le permet pas.

ÉTAPE 5 — COMPOSANTS
Crée ou réutilise des composants accessibles :
- DataStatusBadge
- MethodBadge si nécessaire
- StalenessWarning si nécessaire
États : VERIFIED, ESTIMATED, MANUAL, STALE.

Adapte :
- hero ;
- snapshot banner ;
- filtres ;
- tableaux ;
- cartes ;
- treemap ;
- alertes ;
- dépendance Chine ;
- métadonnées si nécessaire.

ÉTAPE 6 — TESTS
Ajoute/actualise les tests pour garantir :
- stratégique implique critique ;
- les filtres stratégique et critique ne sont pas mutuellement exclusifs ;
- score renommé partout ;
- methodology_note visible ;
- aucun texte de mise à jour automatique externe ;
- aucune tendance historique avec un seul point ;
- badges qualité corrects ;
- page statiquement rendable ;
- accessibilité de base.

CONTRAINTES
- TypeScript strict ;
- aucun any nouveau ;
- aucune dépendance supplémentaire sans justification ;
- aucun appel API runtime ;
- aucune donnée externe ajoutée ;
- aucun changement de positionnement global de CarbonCo ;
- préserver le responsive ;
- pas de commit/push.

COMMANDES À EXÉCUTER
- git diff --check
- npm --prefix apps/carbon run lint
- npm --prefix apps/carbon run test
- npm --prefix apps/carbon run build

À LA FIN
Retourne :
1. diagnostic initial ;
2. fichiers modifiés ;
3. modèle avant/après ;
4. tests ajoutés ;
5. commandes et résultats ;
6. risques ou hypothèses restantes.
Puis arrête-toi.
```

Après Claude :

```bash
git diff --check
npm --prefix apps/carbon run lint
npm --prefix apps/carbon run test
npm --prefix apps/carbon run build
git status --short
```

---

## PR-02 — Ledger de migrations

Après fusion de PR-01 :

```bash
git switch master
git pull --ff-only
git switch -c feat/schema-migration-ledger
claude
```

### Prompt Claude Code PR-02

```text
Tu travailles uniquement sur le ledger de migrations de finance-platform.
Ne construis pas encore les tables d’intelligence. Ne committe et ne pousse rien.

OBJECTIF
Remplacer le contrôle de schéma fondé sur une seule sentinelle par un registre strict, compatible base existante, base vide, local, tests et Vercel serverless.

INSPECTION OBLIGATOIRE
- apps/api/db/migrations.py
- apps/api/db/database.py
- apps/api/db/tenant.py
- tous les fichiers apps/api/db/migrations/*.sql
- apps/api/main.py
- apps/api/routers/health.py
- tests de migrations et santé
- workflows GitHub existants
- configuration Vercel apps/api

ARCHITECTURE ATTENDUE
1. schema_migrations(version, checksum, status, applied_at, execution_ms, applied_by, notes).
2. advisory lock PostgreSQL.
3. baseline contrôlée du schéma historique jusqu’à 027.
4. checksum obligatoire pour 028+.
5. transaction par migration.
6. arrêt strict sur erreur pour 028+.
7. support des migrations manual-owner.
8. GET /health/schema.
9. CLI : python -m db.migration_runner status|plan|apply|verify.
10. AUTO_MIGRATE=0 par défaut en production ; comportement local/test documenté.
11. workflow .github/workflows/db-migrate.yml en workflow_dispatch avec environnement protégé et DATABASE_ADMIN_URL.

RÈGLES DE BOOTSTRAP
- Ne marque jamais aveuglément toutes les migrations historiques comme appliquées.
- Si la structure historique attendue est confirmée, inscris baseline-027 avec une note détaillée.
- Si elle ne l’est pas, le statut doit rester incomplet et explicite.
- Le endpoint de santé doit signaler les migrations manuelles et les écarts.

TESTS
- base vide ;
- base existante baseline 027 ;
- checksum modifié ;
- migration échouée ;
- deux runners concurrents ;
- migration manual-owner ;
- AUTO_MIGRATE off/on ;
- health endpoint.

DOCUMENTATION
Créer docs/carbonco/MIGRATIONS_RUNBOOK.md.

COMMANDES
- python -m pytest -q
- git diff --check

À LA FIN
Résume architecture, bootstrap, fichiers, tests, commandes, opérations manuelles et risques. Puis arrête-toi.
```

---

## PR-03 — Evidence Kernel

```bash
git switch master
git pull --ff-only
git switch -c feat/intelligence-evidence-kernel
claude
```

### Prompt Claude Code PR-03

```text
Construis uniquement le noyau partagé sources/releases/artefacts/ingestions/observations.
Ne construis pas encore achats, énergie, eau ou nature.

Inspecte les patterns RLS, facts, evidence, audit, Blob privé, auth, rate limit, clients API et tests.

LIVRABLES
- migrations intelligence core + RLS ;
- services source/release/artifact/ingestion/observation/license ;
- stockage privé ;
- immutabilité ;
- supersession ;
- endpoints /intelligence ;
- modèle de réponse analytique commun ;
- interface SourceAdapter ;
- FakeAdapter ;
- composants DataStatusBadge, MethodBadge, ConfidenceBadge, SourceDrawer, EvidenceList, LicenseWarning, StalenessWarning ;
- page interne Sources sous feature flag BETA ;
- événements Inngest minimaux ;
- documentation INTELLIGENCE_DATA_ARCHITECTURE.md et DATA_LICENSE_POLICY.md.

TESTS
- RLS global/tenant ;
- licence bloquée ;
- idempotence ;
- immutabilité ;
- supersession ;
- artefact hashé ;
- publication ;
- auth ;
- UI accessible.

Aucun adaptateur réel, aucun scraping, aucune donnée externe, aucun LLM dans le chemin de publication.
Ne committe et ne pousse rien.
```

---

## PR-04 — Source admin et migration du snapshot démo

Prompt abrégé :

```text
Construis la page interne de gestion des sources, le CLI d’import de release, les fixtures et un adaptateur local-file.
Importe le snapshot courant /materials comme source CARBONCO_DEMO_SNAPSHOT, release estimated et non normative.
Préserve la page publique avec fallback statique tant que l’API n’est pas saine.
Ajoute fraîcheur, statut, release et preuve visibles.
N’ajoute aucune nouvelle valeur externe.
```

---

## PR-05 — Exposition achats/fournisseurs

Prompt abrégé :

```text
Étends le module fournisseurs existant. Crée les tables achats, sites fournisseurs, produits fournisseurs, BOM, mappings matières, déclarations, PCF et runs de calcul.
Implémente imports idempotents, file de résolution, hiérarchie Scope 3 explicite, hotspots, couverture, dimensions de score, campagne fournisseur depuis hotspots et Evidence Pack.
Réutilise les campagnes/tokens/review gates existants.
Aucun fallback silencieux. IA seulement pour suggestions DRAFT revues.
```

---

## PR-06 — Scope 2 dual

Prompt abrégé :

```text
Crée ledger énergie, instruments contractuels, allocations, métadonnées facteurs et calculs Scope 2 location-based/market-based.
Aucune double allocation, unités normalisées, hiérarchies testées, trace de calcul et export.
Sépare strictement comptabilité entreprise et proxy fournisseur.
```

---

## PR-07 — CRMA / exposition matières

Prompt abrégé :

```text
Crée référentiels matières/groupes/étapes, observations par étape, substituts, recyclage, événements, expositions tenant et rapport Article 24.
MVP terres rares pour aimants NdFeB/SmCo.
Score nommé CarbonCo Material Exposure Score, versionné ; risque et confiance séparés.
Aucun prix sans licence et droit d’affichage.
```

---

## PR-08 — PostGIS et eau

Prompt abrégé :

```text
Ajoute PostGIS via procédure owner documentée, étends sites, confirmation de géocodage, tables eau, import dataset hors runtime, ST_Intersects, volumes propres, screening versionné, IRO candidat et export.
Aucune matérialité automatique.
```

---

## PR-09 — Nature LEAP

Prompt abrégé :

```text
Construis Locate/Evaluate/Assess/Prepare, datasets nature licenciés, intersections, dépendances, impacts, risques, actions et brouillon de disclosure.
Masque les données sensibles ; bloque les licences incompatibles ; revue humaine obligatoire.
```

---

## PR-10 — IRO Intelligence links

Prompt abrégé :

```text
Étends materialite avec iros, evidence links, impact assessments, financial assessments, decisions et disclosure mappings.
Les signaux externes créent uniquement des candidats.
Archive immuable et Evidence Pack.
```

---

## PR-11 — IA avec preuves et revue

Prompt abrégé :

```text
Crée ai_tasks, ai_runs, ai_claims, ai_citations et ai_review_decisions.
Sorties JSON strictes, prompts versionnés, citations obligatoires, licence vérifiée, revue humaine.
Aucun calcul réglementaire ni publication automatique.
```

---

## 25. Commandes de validation générales

```bash
git diff --check

cd apps/api
python -m pytest -q
cd ../..

npm --prefix apps/carbon run lint
npm --prefix apps/carbon run test
npm --prefix apps/carbon run build

# E2E uniquement lorsque l’environnement de test est disponible
npm --prefix apps/carbon run e2e
```

---

## 26. Première action recommandée

Commencer par PR-01. Ne lancer PR-02 qu’après validation de la première. Cette séquence corrige immédiatement le risque de confiance public et prépare ensuite une fondation durable pour toutes les données futures.
