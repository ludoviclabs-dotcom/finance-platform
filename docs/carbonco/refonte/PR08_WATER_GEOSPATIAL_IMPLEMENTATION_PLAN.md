# PR-08 — Géospatial (sites) et eau · Plan d'implémentation

**Branche prévue :** `feat/geospatial-sites-water`
**Phase du plan d'architecture :** Phase 7 (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §13, §20) — « PostGIS et eau ».
**Statut de ce document :** plan uniquement. Aucune écriture de code, aucune migration, aucune donnée. Rien commité hors `docs/carbonco/refonte/`.
**Contrats communs :** `WAVE_2_INTERFACE_CONTRACTS.md`, `WAVE_4_INTERFACE_CONTRACTS.md` (référence primaire pour tout choix géospatial/eau — ce plan n'y revient pas en détail, il applique).

> **Constat de départ (inspection lecture seule, vérifiée).** `sites` (migration 027) est une table minimale — `id, company_id INTEGER, name, location TEXT (adresse libre), naf_code, activity_type` — **sans aucune coordonnée**. `grep -rli postgis apps/api apps/carbon` renvoie zéro résultat : PostGIS n'existe nulle part dans ce dépôt aujourd'hui. Le seul précédent géographique réel est `supplier_sites` (030) : `latitude`/`longitude NUMERIC` + `geocode_review_status` (pending/accepted/flagged) portés directement sur la ligne, sans géométrie. `sites` est déjà référencée par `energy_meters.site_id`/`energy_activities.site_id` (031) et `actions.site_id` (027) — l'étendre profite immédiatement au Scope 2 et à la MACC sans FK supplémentaire.

---

## 1. Périmètre

Doter le tenant d'une représentation géographique fiable et **revue humainement** de ses propres sites, puis y adosser un ledger de données eau (prélèvements, consommation, rejets, permis) et un référentiel de zones de stress hydrique, préparant un screening versionné (tranche B). Découpé en deux tranches ; **PR-08A** réserve la migration `036`.

**PR-08A (migration `036`) — Fondation géospatiale et ledger eau :**
1. **Extension de `sites`** (027) : coordonnées, précision, provenance du géocodage, colonne `geom` PostGIS conditionnelle (`WAVE_4_INTERFACE_CONTRACTS.md` §3).
2. **`site_geocode_candidates`** : historique append-only des propositions de géocodage, gate de revue humaine (jamais de confiance automatique en un géocodeur).
3. **Ledger eau** (`water_activities`, `water_permits`) : donnée d'activité par site (prélèvement/consommation/rejet), import idempotent + gate de revue, patron `energy_activities`/`purchase_import_service`.
4. **Référentiel `water_risk_areas`** (zones de stress hydrique, catalogue mixte tenant/global) : ingéré exclusivement via Source Admin + licence — **aucune donnée externe sans source et release enregistrées**.
5. **Aucun calcul de screening dans cette tranche** — pas de `site_water_screenings`, pas de score, pas de signal IRO.

**PR-08B (indicatif, migration non réservée ici) — Screening et scénarios :**
6. `site_water_screenings` : intersection site × zone (`ST_Intersects` si PostGIS disponible, repli boîte-englobante documenté sinon), résultat versionné dans l'enveloppe analytique (`AnalyticalEnvelope`).
7. `water_targets`/`water_actions` : cibles et actions rattachées à un screening.
8. Signal explicite « à examiner comme IRO » sur un screening dépassant un seuil — jamais une table de candidats séparée (`WAVE_4_INTERFACE_CONTRACTS.md` §10) ; la promotion effective en IRO reste l'affaire de PR-10.

---

## 2. Hors périmètre

- **Pas de PostGIS présumé disponible sans vérification** — la question de privilège (`CREATE EXTENSION postgis`) est ouverte (`WAVE_4_INTERFACE_CONTRACTS.md` §3) ; si elle bloque, PR-08A livre quand même `latitude`/`longitude` (toujours utiles) et diffère `geom`/`ST_Intersects`.
- **Aucune conclusion de matérialité automatique** — gate Phase 7 du plan : *« aucun screening silencieux sur une position incertaine »*. PR-08 (A ou B) ne décide jamais qu'un risque est matériel.
- **Pas de nouvelle table de candidats IRO** (`water_iro_candidates` du plan §13.2 n'est pas créée — décision justifiée dans `WAVE_4_INTERFACE_CONTRACTS.md` §10).
- **Pas de fusion avec `supplier_sites`** (030) — décision et justification en `WAVE_4_INTERFACE_CONTRACTS.md` §8 ; `supplier_sites` reste hors périmètre de PR-08.
- **Pas de scraping en direct ni d'appel réseau au chargement d'une page** — tout dataset eau externe passe par Source Admin (source + release + artefact), ingestion lourde via CLI/GitHub Actions protégé (plan §8.3), jamais dans une requête utilisateur.
- **PR-08B (calcul) hors de PR-08A** — ce plan cadre les deux, réserve `036` pour A uniquement.
- Pas de refonte de la page `/sites` existante au-delà de ce qui est nécessaire pour exposer géocodage et eau ; on **étend**.

---

## 3. Dépendances

| Élément | Rôle dans PR-08 |
|---|---|
| `sites` (027) + `sites_service.py` + `routers/sites.py` | table et service étendus ; `GET/POST /sites` existants restent compatibles (colonnes nullables) |
| `source_registry`/`source_releases`/`evidence_artifacts` (028) | sourcer tout dataset eau/géocodage externe — `WAVE_4_INTERFACE_CONTRACTS.md` §4 |
| `claim_evidence_links` + `claim_link_service.py` (livré PR-05A) | lier un screening/permis à une preuve complémentaire — **réutilisé**, pas de nouveau service |
| `models/analytics.py::AnalyticalEnvelope` (créé PR-05B, réutilisé PR-06B) | forme des endpoints de calcul PR-08B — import direct, pas de redéfinition locale (leçon PR-07, `WAVE_4_INTERFACE_CONTRACTS.md` §9) |
| `routers/_errors.py::http_error`/`require_db` (livré PR-05A) | erreurs HTTP — importé, pas recopié |
| `energy_meters.site_id`/`energy_activities.site_id` (031) | bénéficient automatiquement de la géolocalisation de `sites` sans modification |
| `supplier_sites` (030) | précédent de vocabulaire (`geocode_review_status` pending/accepted/flagged) — aligné, pas fusionné |
| `import_screening_service.py`, `services/procurement/purchase_import_service.py` | patron d'import idempotent + gate de revue pour `water_activities` |
| `license_policy.evaluate` | vérifier `allow_display`/`allow_derived_use` avant d'utiliser une donnée de zone sous licence |

**À CONFIRMER au démarrage :** privilège `CREATE EXTENSION postgis` (`WAVE_4_INTERFACE_CONTRACTS.md` §3) — à trancher avant d'écrire le DDL de `geom`, pas après.

---

## 4. Migration réservée : `036` (PR-08A)

**`036_geospatial_sites_water.sql`** — extension `sites` + `site_geocode_candidates` + ledger eau (PR-08A). Le screening (PR-08B) prendra un numéro non réservé ici (renumérotation au merge, `WAVE_4_INTERFACE_CONTRACTS.md` §13).

**Particularité par rapport à 028/030/031/034 : cette migration touche une table EXISTANTE (`sites`).** `ALTER TABLE sites ADD COLUMN ...` doit être marqué `requires_owner=true` dans `migration_manifest.py` — précédent direct : 027 (`ALTER TABLE actions`, même raison). Prévoir explicitement, dès la rédaction du DDL, un en-tête `mode: manual-owner`, une application via `DATABASE_ADMIN_URL` + `mark-manual-verified` (pas via le chemin `carbonco_app` automatique), et — si la question PostGIS (§3 des contrats Wave 4) n'est pas résolue avant l'écriture — **scinder le DDL** en deux étapes indépendantes dans le même fichier : (a) colonnes `latitude`/`longitude`/`geocode_*` (toujours applicables), (b) `CREATE EXTENSION IF NOT EXISTS postgis` + colonne `geom` (conditionnelle, appliquée seulement une fois le privilège confirmé). Les nouvelles tables (`site_geocode_candidates`, `water_activities`, `water_permits`, `water_risk_areas`) sont des `CREATE TABLE` purs — comme 028/030/031/034, elles n'exigent **pas** de privilège propriétaire.

Respecte par ailleurs le contrat §7 (Wave 2 + deltas Wave 4 §7) : RLS gen-2 sur les tables neuves (`ENABLE`+`FORCE`, policies par commande, `DROP POLICY IF EXISTS`, `app.rls_bypass`), sonde `_probe_036` (`apps/api/db/migration_probes.py`) + enregistrement dans `MIGRATION_OBJECT_PROBES`, `build_full_db` mis à jour, tests DB-gated inscrits dans le job CI `migration-tests`, GRANT conditionnel `carbonco_app`.

---

## 5. Tables (PR-08A)

Toutes les tables neuves : `id BIGSERIAL`, RLS FORCE, `created_at`/`updated_at`. `company_id` en `BIGINT` sauf sur `sites` (reste `INTEGER`, table historique non retypée dans cette vague).

| Table | Colonnes clés | Notes |
|---|---|---|
| `sites` (ALTER) | `+ latitude NUMERIC(9,6)`, `longitude NUMERIC(9,6)`, `geocode_precision`, `geocode_provider`, `geocode_provider_ref`, `geocode_review_status TEXT NOT NULL DEFAULT 'pending'` (pending/accepted/flagged), `geocode_reviewed_by`, `geocode_reviewed_at`, `geom geography(Point,4326)` (conditionnel §4/§3 contrats) | `requires_owner=true`. Colonnes nullables — `GET/POST /sites` existants inchangés tant que non étendus. |
| `site_geocode_candidates` | `company_id BIGINT NOT NULL`, `site_id BIGINT REFERENCES sites(id)`, `provider TEXT` (code adaptateur ou `'manual'`), `provider_ref`, `latitude`, `longitude`, `precision`, `source_release_id BIGINT REFERENCES source_releases(id)`, `evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id)`, `status TEXT NOT NULL DEFAULT 'proposed'` (proposed/accepted/rejected), `reviewed_by`, `reviewed_at` | Append-only — jamais de mise à jour d'une ligne acceptée ; une correction ajoute un nouveau candidat. |
| `water_activities` | `company_id BIGINT NOT NULL`, `site_id BIGINT REFERENCES sites(id)`, `activity_type TEXT` (withdrawal/consumption/discharge), `source_type TEXT` (surface/groundwater/municipal/other), `quantity_m3 NUMERIC`, `period_start DATE`, `period_end DATE`, `import_id`, `data_status`, `evidence_artifact_id`, `review_status TEXT NOT NULL DEFAULT 'pending'` (pending/accepted/flagged) | Calqué sur `energy_activities` (031) — même vocabulaire `data_status`/`review_status`, même idempotence d'import `(company_id, site_id, activity_type, period_start, period_end)` UNIQUE. |
| `water_permits` | `company_id BIGINT NOT NULL`, `site_id BIGINT REFERENCES sites(id)`, `permit_type TEXT`, `authorized_volume_m3 NUMERIC`, `valid_from DATE`, `valid_to DATE`, `issuing_authority TEXT`, `evidence_artifact_id BIGINT REFERENCES evidence_artifacts(id)`, `status TEXT` (active/expired/revoked) | Preuve = pièce jointe (autorisation administrative) via Evidence Kernel. |
| `water_risk_areas` | `company_id BIGINT NULL` (référentiel mixte, motif 034), `code TEXT`, `label TEXT`, `area_kind TEXT` (basin/aquifer/custom), `baseline_stress_category TEXT`, `geom geography(MultiPolygon,4326)` **ou**, si PostGIS bloqué, `bbox_min_lat/max_lat/min_lon/max_lon NUMERIC` + `boundary_geojson JSONB` (polygone en JSON, évalué côté Python), `source_release_id BIGINT NOT NULL REFERENCES source_releases(id)`, `data_status` | **Toujours sourcée** (`source_release_id NOT NULL`, même discipline que `material_market_observations`, 034) — aucune zone sans dataset licencié. |

**PR-08B (indicatif, non réservé) :** `site_water_screenings` (colonnes de run partagées `WAVE_2_INTERFACE_CONTRACTS.md` §4 : `methodology_code/version`, `input_snapshot`, `result`, `warnings`, `confidence`, `coverage_pct`, `calculated_at`, `approved_at`, `approved_by`, + `iro_signal BOOLEAN`/`iro_signal_rationale TEXT` pour le signal de promotion décrit en §1) ; `water_targets`/`water_actions` (calqués sur `mitigation_actions`, 034, avec `expected_effect` jamais appliqué automatiquement au résultat).

---

## 6. Services

### PR-08A
| Service | Responsabilité |
|---|---|
| `services/geo/geocode_service.py` | Interface d'adaptateur de géocodage (miroir `SourceAdapter` Protocol du noyau), `FakeAdapter` testable hors réseau, proposition de candidats (`site_geocode_candidates`), gate de revue (`accept`/`flag`), promotion du candidat accepté vers `sites.latitude/longitude/geom`. Aucune écriture de `sites` sans passage par ce gate — y compris la saisie manuelle. |
| `services/water/activities_service.py` | Import CSV d'activités eau, idempotent (patron `purchase_import_service`/`activities_service` énergie), gate de revue, défense en profondeur (`company_id = %s`). |
| `services/water/permits_service.py` | CRUD permis, preuve obligatoire via `artifact_service.register_artifact`. |
| `services/water/risk_areas_service.py` | Ingestion du référentiel de zones (appelé par le CLI d'administration / le workflow GitHub Actions protégé, jamais par un endpoint utilisateur direct) — vérifie `license_policy.evaluate` avant toute lecture d'un prix/dataset sous licence restrictive. |

### PR-08B (indicatif)
- `services/calculations/water_screening.py` : `CalculationMethod` (validate/calculate/trace) ; `ST_Intersects` si `geom` disponible, sinon pré-filtre boîte-englobante + distance haversine avec `meta.method.code` nommant explicitement l'approximation utilisée (`WAVE_4_INTERFACE_CONTRACTS.md` §3/§11) ; risque et confiance séparés selon le motif `services/crma/scoring.py` (§6 des contrats Wave 4) ; aucun fallback silencieux.

### Réutilisés (ne pas dupliquer)
`sites_service.py` (étendu, pas remplacé), `artifact_service.register_artifact`, `license_policy.evaluate`, `observation_service` (pour tout indicateur scalaire simple type `water_stress_baseline`), `claim_link_service.py`, `audit_service.log_event`, `export_package` (Evidence Pack, PR-08B).

---

## 7. Endpoints

### PR-08A (extension `/sites`, préfixe `/water`)
- `GET /sites/{id}/geocode-candidates` — `get_current_user`.
- `POST /sites/{id}/geocode-candidates` — `require_analyst` — propose un candidat (adaptateur ou saisie manuelle, même gate).
- `POST /sites/{id}/geocode-candidates/{candidate_id}/review` — `require_analyst` — accepte/flag ; l'acceptation promeut `sites.latitude/longitude/geom`.
- `POST /water/activities/import` — `require_analyst` — upload CSV → activités `pending`.
- `GET /water/activities` — `get_current_user` — pagination + filtres indexés (site, type, période).
- `POST/GET /water/permits` — `require_analyst`/`get_current_user`.
- `GET /water/risk-areas` — `get_current_user` — lecture seule ; **aucun endpoint d'écriture exposé aux utilisateurs** pour ce référentiel (ingestion = CLI/GitHub Actions protégé uniquement, plan §8.3).

### PR-08B (indicatif)
- `POST /water/screenings/calculate` — `require_analyst` — `AnalyticalEnvelope`.
- `GET /water/screenings/{id}` — `get_current_user`.
- `POST /water/screenings/{id}/flag-for-iro` — `require_analyst` — pose `iro_signal=true` (ne crée jamais de ligne `iros` elle-même, §1/§2).

Tous : pagination (`WAVE_2_INTERFACE_CONTRACTS.md` §5), erreurs (§6, `routers/_errors.py`), isolation (§7), licence (§8).

---

## 8. Interface frontend

**Étendre** la gestion des sites (localiser précisément la page/le composant actuels au démarrage de PR-08 — inspection obligatoire, aucune page `apps/carbon/app/(app)/sites/` dédiée n'a été confirmée à ce jour ; `routers/sites.py` suggère une gestion peut-être intégrée à une autre vue) + nouvelle vue **Eau**.

- **Carte de revue de géocodage** : candidats proposés sur fond Mapbox (dépendance déjà présente dans le dépôt), acceptation/flag explicite. **Piège CSP connu** (`WAVE_4_INTERFACE_CONTRACTS.md` §12) : tout nouvel usage de Mapbox doit rouvrir `apps/carbon/proxy.ts` pour `connect-src` (domaine Mapbox) et `worker-src blob:` — à vérifier par un test d'intégration front dédié, pas découvert après déploiement.
- **Vue Eau** : activités par site (tableau, `ReviewStatusBadge`), permis, zones de stress hydrique (carte, lecture seule).
- Réutiliser `DataStatusBadge`, `ReviewStatusBadge`, `KpiProvenanceDrawer`, `ExportButtons`/`ExportPackageCard` ; créer `LicenseWarning`/`MethodBadge`/`ConfidenceBadge` si aucune autre PR Wave 4 ne les a créés en premier (`WAVE_4_INTERFACE_CONTRACTS.md` §12).
- Client API : `apps/carbon/lib/api/water.ts` (+ extension de `apps/carbon/lib/api/sites.ts` si ce fichier existe — à confirmer au démarrage).

---

## 9. Tests

- **Unitaires** : géocodage (candidat proposé ≠ accepté tant que non revu ; saisie manuelle soumise au même gate) ; parse CSV activités eau (patron `csv_import_parsers`) ; `water_screening` (PR-08B : composante manquante exclue et renormalisée, jamais comptée à zéro ; méthode boîte-englobante nommée explicitement si PostGIS indisponible).
- **DB-gated (job `migration-tests`)** : migration `036` applicable après `035`(si mergée)/034 ; `ALTER TABLE sites` en mode `requires_owner` correctement détecté et bloquant sans intervention manuelle ; RLS + défense en profondeur sur les tables neuves (tenant A ne voit pas les sites/activités eau de B) ; `sites` existante non régressée (`GET/POST /sites` toujours verts) ; idempotence d'import activités eau ; `water_risk_areas` refuse une ligne sans `source_release_id`.
- **API** : endpoints sites/eau (auth analyst/admin, pagination, 404 sans fuite d'existence) ; `POST /sites/{id}/geocode-candidates/{id}/review` refuse une acceptation par un rôle non analyste.
- **Ledger** : `036` `pending` sur base `034` (ou `035` si mergée avant) ; `plan`/`apply`/`verify` verts ; `_probe_036`.
- **Non-régression** : `energy_meters`/`energy_activities` (031) et `actions` (027) continuent de fonctionner avec `sites` étendue.
- **Frontend** : carte de revue, vue eau, badges, états loading/empty/error/stale ; accessibilité clavier de la carte de revue (pas seulement à la souris).

---

## 10. Fichiers à créer / modifier

### Créés (PR-08A, backend)
- `apps/api/db/migrations/036_geospatial_sites_water.sql`
- `apps/api/services/geo/__init__.py`, `geocode_service.py`
- `apps/api/services/water/__init__.py`, `activities_service.py`, `permits_service.py`, `risk_areas_service.py`
- `apps/api/models/geo.py`, `apps/api/models/water.py`
- `apps/api/routers/water.py`
- `apps/api/scripts/intelligence/import_geospatial_dataset.py` (ingestion `water_risk_areas` hors runtime, plan §4)
- `apps/api/tests/test_geocode_candidates.py`, `test_water_activities.py`, `test_water_permits.py`, `test_water_risk_areas.py`

### Modifiés (PR-08A, backend)
- `apps/api/main.py` (router `/water`, extension `/sites`)
- `apps/api/routers/sites.py`, `apps/api/services/sites_service.py` (colonnes géo, sans casser `GET/POST /sites`)
- `apps/api/db/migration_manifest.py` (`036`, `requires_owner=true`), `migration_probes.py` (`_probe_036`), `tests/_migration_fixtures.py`
- `.github/workflows/api.yml` (tests DB-gated dans `migration-tests`)

### Créés (frontend)
- `apps/carbon/lib/api/water.ts`
- `apps/carbon/components/geo/*` (carte de revue de géocodage), `apps/carbon/components/water/*`

### Modifiés (frontend)
- Page(s) de gestion des sites (à localiser précisément au démarrage) ; `apps/carbon/proxy.ts` (CSP Mapbox, si nouvel usage) ; feature flag BETA (fichier exact à confirmer — `data/feature-status.json` d'après le précédent CRMA, PR07 traçabilité).

### PR-08B (indicatif, non dans PR-08A)
`db/migrations/0XX_water_screening_engine.sql` (numéro non réservé), `services/calculations/water_screening.py`, `site_water_screenings`/`water_targets`/`water_actions`, endpoints `/water/screenings/*`.

---

## 11. Risques

| Risque | Mitigation |
|---|---|
| **Privilège `CREATE EXTENSION postgis` bloqué ou non confirmé à temps** | Décision de repli documentée (§4, boîte-englobante nommée explicitement) ; `latitude`/`longitude` livrées indépendamment de `geom` ; vérification empirique sur une branche Neon de test **avant** d'écrire le DDL en dur. |
| **`ALTER TABLE sites` refusé en production faute de rôle propriétaire** | `requires_owner=true` posé dès la conception (pas découvert à l'`apply`) ; application via `DATABASE_ADMIN_URL` + `mark-manual-verified`, précédent 027 déjà éprouvé. |
| **Géocodeur externe traité comme source de vérité** | Gate de revue humaine strict sur `site_geocode_candidates`, y compris pour la saisie manuelle ; aucune analyse géospatiale sur un site `pending`/`flagged`. |
| **Table de candidats IRO dupliquée par domaine** | Décision gelée : PR-08 n'en crée pas, signal explicite seulement (`WAVE_4_INTERFACE_CONTRACTS.md` §10). |
| **Zone de risque hydrique affichée sans licence vérifiée** | `source_release_id NOT NULL` sur `water_risk_areas` ; `license_policy.evaluate` avant affichage/usage dérivé. |
| **Régression sur `sites`/`energy_meters`/`actions`** (tables historiques dépendantes) | Colonnes ajoutées nullables, aucune contrainte NOT NULL nouvelle sur `sites` ; tests de non-régression explicites. |
| Pas de PostgreSQL local | CI `migration-tests` = seule preuve ; aller-retour prévu (leçon PR-02/03). |
| Numéro `036` déjà pris (si `035` merge après PR-08, ou hors ordre) | `command=plan` avant apply ; renuméroter au merge (`WAVE_4_INTERFACE_CONTRACTS.md` §13). |

---

## 12. Étapes d'implémentation

**PR-08A :**
1. Confirmer le privilège `CREATE EXTENSION postgis` (test empirique sur branche Neon) — bloquant pour la forme exacte du DDL `sites`/`water_risk_areas`.
2. Migration `036` (extension `sites` `requires_owner=true` + `site_geocode_candidates` + ledger eau) + sonde + fixtures + job CI.
3. `geocode_service` (candidats, gate de revue, promotion) + tests.
4. `water/activities_service`, `permits_service`, `risk_areas_service` (+ défense en profondeur).
5. Router `/water` + extension `/sites/{id}/geocode-candidates`.
6. CLI d'ingestion `water_risk_areas` (hors runtime).
7. Frontend : carte de revue, vue eau (vérifier CSP Mapbox).
8. Tests complets ; `git diff --check` ; lint.

**PR-08B (PR séparée ultérieure) :** moteur de screening, cibles/actions, signal de promotion IRO.

---

## 13. Critères de merge (PR-08A)

- CI verte (`tests`, `migration-tests`, front, `validate`, `security-audit`, `gitleaks`).
- `ruff`/`git diff --check` propres ; TS strict.
- Question PostGIS tranchée avant merge (installée et testée, **ou** repli boîte-englobante explicitement documenté et nommé dans le code — jamais une décision implicite).
- `ALTER TABLE sites` appliqué avec succès en mode `requires_owner` sur un environnement de test représentatif de la production.
- Aucune régression sur `GET/POST /sites`, `energy_meters`/`energy_activities`, `actions`.
- Gate de revue de géocodage garanti (aucune coordonnée `pending`/`flagged` n'entre dans un calcul).
- Isolation tenant testée (RLS gen-2 + défense en profondeur) sur toutes les nouvelles tables.
- Aucune donnée de zone sans source/release/licence vérifiée.
- Aucune écriture prod par Claude. PR non mergée automatiquement.

---

## 14. Opérations post-merge

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `036` `pending`, seul, et le statut `requires_owner` de l'étape `sites`) → `apply` (chemin `DATABASE_ADMIN_URL`) → `verify` → `/health/schema` `up_to_date:true` `schema_version:"036"`.
3. Vérification applicative : `GET /sites` (JWT) → toujours 200, sites existants intacts avec colonnes géo `NULL` ; `POST /sites/{id}/geocode-candidates` → candidat `proposed` ; revue → `accepted` → `sites.latitude/longitude` peuplés.
4. Si `geom`/PostGIS différés : consigner explicitement dans `MIGRATIONS_RUNBOOK.md` la décision et le suivi (migration de rattrapage prévue).
5. Observation 24-48h (permissions `carbonco_app` sur les nouvelles tables, comportement de `sites` étendue). Consigner `MIGRATIONS_RUNBOOK.md` §9.
6. **Gate Phase 7** (à l'issue de PR-08B) : « site géocodé vérifié, import géospatial hors runtime, screening eau, IRO candidats » (au sens du signal §1, pas d'une table dédiée) — vérifié.
7. PR-08B planifiée séparément une fois PR-08A stabilisée en prod.
