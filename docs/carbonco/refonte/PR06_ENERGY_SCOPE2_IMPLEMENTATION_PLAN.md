# PR-06 — Énergie & Scope 2 dual · Plan d'implémentation

**Branche prévue :** `feat/energy-scope2-dual`
**Phase du plan d'architecture :** Phase 5 (`PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §11, §20) — « Scope 2 dual ».
**Statut de ce document :** plan uniquement. Aucune écriture de code, aucune migration, aucune donnée. Rien commité hors `docs/carbonco/refonte/`.
**Contrats communs :** `WAVE_2_INTERFACE_CONTRACTS.md`.

> **Constat de départ (inspection lecture seule).** Le Scope 2 **dual existe déjà comme convention de données** : les codes de fact `CC.GES.SCOPE2_LB` (location-based) et `CC.GES.SCOPE2_MB` (market-based) circulent du classeur Excel → `facts_events` → `facts_current` et sont consommés à ~8 endroits. Ce qui **n'existe pas** : (1) un moteur de calcul Python (les émissions sont calculées dans Excel, `facts_events.ef_id` est toujours `NULL` à l'ingestion) ; (2) une modélisation de l'énergie au-delà de 2 scalaires (`CC.CONSO.ENERGIE` MWh, `CC.PART.ENR` %) ; (3) les instruments contractuels et leurs allocations. PR-06 **étend** cette convention, ne la réinvente pas.

---

## 1. Périmètre

Séparer strictement **la comptabilité Scope 2 de l'entreprise** (consommation de ses propres sites, location-based **et** market-based) de toute estimation proxy, et rendre le calcul **déterministe, reproductible et tracé** — là où il n'était qu'une valeur importée d'Excel.

**PR-06A (migration `031`) — Ledger énergie & instruments :**
1. Modéliser l'énergie : **compteurs** (`energy_meters`) et **activités** de consommation (`energy_activities`) par site / vecteur / période, avec quantité + unité.
2. Modéliser les **instruments contractuels** (`contractual_instruments`) — REC/GO/PPA — et leurs **allocations** (`instrument_allocations`) à des activités, sans double allocation.
3. **Métadonnées de facteurs énergie** (`energy_factor_metadata`) reliant un facteur (`emission_factors`) à une zone/période pour la hiérarchie location-based / market-based.
4. Imports d'activités énergie (CSV) idempotents + gate de revue (patron `import_screenings`).
5. **Consolider la sélection LB/MB** aujourd'hui dupliquée inline (voir §11) dans un helper unique partagé.

**PR-06B (migration `032+`, non réservée ici) — Moteur de calcul :**
6. `scope2_calculation_runs` / `scope2_line_results` : calcul location-based et market-based, hiérarchies de facteurs, trace de calcul, enveloppe analytique (contrats §4), approbation, export/evidence pack.

---

## 2. Hors périmètre

- **Aucun recalcul des valeurs Excel existantes** — PR-06 offre un **chemin alternatif** de calcul serveur ; les KPI historiques `CC.GES.SCOPE2_*` restent valides tant que le nouveau moteur n'est pas approuvé.
- **Pas de Scope 1 / Scope 3** (autres PR).
- **Pas de proxy fournisseur** de Scope 2 (chaîne de valeur) — c'est du procurement (PR-05), toujours étiqueté `estimated` et **séparé** de la compta entreprise.
- **Pas de géospatial** (sites sans géo — PR-08).
- **Pas de LLM**, pas de fallback silencieux de facteur.
- Pas de refonte du dashboard carbone ; on **ajoute** la vue Scope 2 dual.
- **PR-06B (moteur de calcul) est hors de PR-06A** — ce plan cadre les deux mais réserve `031` pour la tranche A uniquement.

---

## 3. Dépendances PR-03

| Élément | Rôle dans PR-06 |
|---|---|
| Enveloppe analytique `{data, meta, evidence}` (contrats §4) — **À INTRODUCE** | format des endpoints de calcul Scope 2 (PR-06B) |
| `observations` (Evidence Kernel) | une activité énergie / un facteur licencié peut être **sourcé** par une observation + release (ex. mix résiduel national d'un fournisseur d'énergie) |
| `evidence_artifacts` + `artifact_service` | pièces justificatives des instruments (certificats REC/GO) via le proxy authentifié |
| `license_policy` | un facteur de mix résiduel sous licence → vérifier `allow_derived_use` avant calcul |
| Contrats RLS / pagination / erreurs / défense en profondeur | §5/§6/§7 des contrats communs |

**À CONFIRMER :** faut-il que les facteurs d'énergie/mix résiduel deviennent des `observations` du noyau (traçables par release) ou restent-ils dans `emission_factors` (catalogue global sans RLS) ? Recommandation : **facteurs génériques → `emission_factors`** (comme aujourd'hui) ; **mix résiduel/instrument spécifique fournisseur → observation** (sourcé, daté, licencié). À trancher au démarrage de PR-06A.

---

## 4. Migration réservée : `031` (PR-06A)

**`031_energy_scope2.sql`** — tables énergie + instruments (PR-06A). Le moteur de calcul (PR-06B) prendra `032+` (à renuméroter au merge, contrats §10).

Respecte le contrat §7 : RLS `ENABLE`+`FORCE`, policies scopées `FOR SELECT/INSERT/UPDATE/DELETE`, `company_id BIGINT NOT NULL` (tables purement tenant), `DROP POLICY IF EXISTS` avant `CREATE POLICY`, GRANT conditionnel `carbonco_app`, sonde `_probe_031` + enregistrement, `build_full_db`→031, tests DB-gated inscrits dans le job CI `migration-tests`.

**Note prod (leçon 027) :** l'`ALTER`/GRANT peut exiger `neondb_owner` → si la migration touche une table existante propriété de `neondb_owner`, la marquer `requires_owner=true` dans `migration_manifest.py` et l'appliquer via Neon + `mark-manual-verified`. Les **tables neuves** (créées par `carbonco_app`) ne l'exigent pas (comme 028).

---

## 5. Tables (PR-06A)

Repris de `PLAN_ACTION` §11.2, adaptés aux conventions Wave 2. Toutes : `id BIGSERIAL`, `company_id BIGINT NOT NULL`, RLS FORCE, `created_at`/`updated_at`.

| Table | Colonnes clés | Notes |
|---|---|---|
| `energy_meters` | `site_id BIGINT REFERENCES sites(id)`, `carrier TEXT` (electricity/gas/heat/steam/…), `meter_code TEXT`, `unit TEXT`, `active BOOLEAN` | `UNIQUE(company_id, meter_code)`. `carrier` en CHECK. |
| `energy_activities` | `meter_id`, `site_id`, `carrier`, `quantity NUMERIC`, `unit TEXT`, `period_start DATE`, `period_end DATE`, `import_id`, `data_status`, `evidence_artifact_id`, `review_status` | La donnée d'activité (consommation). `review_status` gate (pending/accepted/flagged) comme `supplier_answers`. |
| `contractual_instruments` | `instrument_type TEXT` (rec/go/ppa/green_tariff), `carrier`, `volume_mwh NUMERIC`, `valid_from DATE`, `valid_to DATE`, `geography_code TEXT`, `certificate_artifact_id BIGINT REFERENCES evidence_artifacts(id)`, `status TEXT` | Instrument market-based. `certificate_artifact_id` → preuve (Evidence Kernel). |
| `instrument_allocations` | `instrument_id`, `energy_activity_id`, `allocated_mwh NUMERIC`, `allocated_at`, `allocated_by` | **Contrainte anti-double-allocation** (voir §11). |
| `energy_factor_metadata` | `ef_id INTEGER REFERENCES emission_factors(id)`, `carrier`, `geography_code`, `basis TEXT` (location/market/residual_mix), `valid_from`, `valid_to`, `source_release_id BIGINT REFERENCES source_releases(id) NULL` | Relie un facteur à une zone/période/base pour la hiérarchie de sélection. `source_release_id` si sourcé (licence). |

**PR-06B (indicatif, `032+`) :** `scope2_calculation_runs` (colonnes partagées §4 des contrats : `methodology_code/version`, `input_snapshot`, `factor_versions`, `result`, `warnings`, `confidence`, `coverage_pct`, `calculated_at`, `approved_at`, `approved_by`) ; `scope2_line_results` (par activité : basis LB/MB, ef_id, ef_version, activity_value, activity_unit, result_tco2e, uncertainty, data_quality, fallback_reason, warnings).

---

## 6. Services

### PR-06A
| Service | Responsabilité |
|---|---|
| `services/energy/meters_service.py` | CRUD compteurs (tenant), défense en profondeur (contrats §7). |
| `services/energy/activities_service.py` | CRUD/import activités énergie ; gate de revue ; idempotence import (patron `import_screening_service`). |
| `services/energy/instruments_service.py` | CRUD instruments ; **allocation contrôlée** (refuse la double allocation, quantité couverte ≤ consommation, période/zone compatibles, instrument expiré signalé). |
| `services/carbon/scope2_selection.py` | **Helper LB/MB unique** — extrait la logique dupliquée (`beges_export.py:81-110`, `actions_service.py:298-304`) : « préférer LB, se rabattre sur MB seulement si LB absent (sur présence, pas sur valeur — LB=0 est légitime) ». Réutilisé partout. |

### PR-06B (indicatif)
- `services/calculations/scope2.py` : `CalculationMethod` (validate/calculate/trace), hiérarchies location-based (`facteur sous-national → national → régional documenté → erreur explicite`) et market-based (`instrument valide alloué → facteur fournisseur admissible → mix résiduel → fallback documenté`). **Aucun fallback silencieux** ; conversion d'unités centralisée (**À INTRODUCE**, cf. §11) ; arrondis en sortie d'affichage uniquement, valeurs brutes conservées.

### Réutilisés
`emission_factors` (catalogue), `facts_service.emit_fact` (émettre un fact Scope 2 récapitulatif après approbation d'un run), `baseline_service` (un run approuvé peut alimenter un gel avec `ef_version`), `import_screening_service` (patron d'import), `export_package`/`beges_export` (le helper LB/MB consolidé les sert), `observation_service`/`artifact_service` (sourcing facteurs/instruments).

---

## 7. Endpoints

### PR-06A (préfixe `/energy`)
- `GET/POST /energy/meters` — list (`get_current_user`) / create (`require_analyst`).
- `POST /energy/activities/import` — `require_analyst` — upload CSV → activités `pending` (gate de revue).
- `GET /energy/activities` — `get_current_user` — pagination + filtres indexés (site, carrier, période).
- `POST /energy/instruments` / `GET /energy/instruments` — `require_analyst` / `get_current_user`.
- `POST /energy/instruments/{id}/allocate` — `require_analyst` — allocation contrôlée (refus explicite si double/dépassement).

### PR-06B (indicatif)
- `POST /energy/scope2/calculate` — `require_analyst` — enveloppe analytique (contrats §4), LB + MB.
- `GET /energy/scope2/runs/{id}` — `get_current_user`.
- `POST /energy/scope2/runs/{id}/approve` — `require_admin`.
- `GET /energy/scope2/runs/{id}/evidence-pack` — `require_analyst` — via `export_package`.

Tous : pagination §5, erreurs §6 (helper `_http_error` partagé), isolation §7, licence §8 (vérifier `allow_derived_use` d'un facteur sourcé avant de l'utiliser).

---

## 8. Interface frontend

**Étendre** la page `apps/carbon/app/(app)/scopes/page.tsx` (existante) plutôt qu'en créer une nouvelle, + une page énergie dédiée si nécessaire.

- **Vue Scope 2 dual** : LB **et** MB côte à côte, jamais l'un masquant l'autre (le PDF le fait déjà — `pdf_service.py:419-427` — s'aligner). Réutiliser `KpiWithProvenance`, `DataStatusBadge`.
- **Activités énergie** : tableau (site, vecteur, période, quantité, statut de revue) avec `ReviewStatusBadge`.
- **Instruments & allocations** : liste des instruments, couverture par activité, alerte instrument expiré / double allocation. `LicenseWarning` (**à créer**) si facteur mix résiduel sous licence.
- **Trace de calcul** (PR-06B) : `CalculationTrace` (**à créer**, contrats §9) — hiérarchie de facteurs retenue, fallback documenté.
- Client API : `apps/carbon/lib/api/energy.ts`.

**Corriger un écart existant** : `aggregation_service.CarbonKpis` (l.48) **perd `scope2Mb`** (seul LB remonte au dashboard consolidé). PR-06 doit décider si le consolidé porte les deux (recommandé, pour cohérence avec le snapshot) — **À CONFIRMER**, changement transverse à cadrer.

---

## 9. Tests

- **Unitaires** : `scope2_selection` (LB préféré, MB en repli sur présence, LB=0 légitime) ; allocation (double allocation refusée, dépassement refusé, période/zone incompatibles refusées, instrument expiré signalé) ; hiérarchies de facteurs PR-06B (chaque niveau + erreur explicite, jamais de fallback silencieux) ; conversions d'unités (kWh↔MWh) déterministes.
- **DB-gated (job `migration-tests`)** : migration `031` applicable après 028 (et 029/030 si mergées avant) ; RLS + **défense en profondeur** (tenant A ne voit pas l'énergie de B) ; import activités idempotent + gate de revue ; `instrument_allocations` contrainte anti-double-allocation au niveau base.
- **API** : endpoints énergie (auth, pagination, 404 sans fuite) ; calcul Scope 2 (PR-06B) reproductible (mêmes entrées → mêmes sorties).
- **Ledger** : `031` détectée `pending` ; `plan`/`apply`/`verify` verts ; `_probe_031`.
- **Non-régression** : les KPI `CC.GES.SCOPE2_LB/MB` existants et leurs 8 consommateurs (beges, actions, pdf, vsme, esg, copilot) restent inchangés tant que le moteur PR-06B n'est pas approuvé.
- **Frontend** : vue dual LB/MB, badges, états loading/empty/error ; accessibilité.

---

## 10. Fichiers à créer / modifier

### Créés (PR-06A, backend)
- `apps/api/db/migrations/031_energy_scope2.sql`
- `apps/api/services/energy/__init__.py`, `meters_service.py`, `activities_service.py`, `instruments_service.py`
- `apps/api/services/carbon/scope2_selection.py` (helper consolidé)
- `apps/api/models/energy.py`
- `apps/api/routers/energy.py`
- `apps/api/tests/test_energy_meters.py`, `test_energy_instruments.py`, `test_energy_import.py`, `test_scope2_selection.py`

### Modifiés (PR-06A, backend)
- `apps/api/main.py` (router `/energy`)
- `apps/api/db/migration_manifest.py`, `migration_probes.py`, `tests/_migration_fixtures.py`
- `.github/workflows/api.yml` (tests DB-gated dans `migration-tests`)
- `apps/api/services/beges_export.py`, `services/actions_service.py` — **remplacer la logique LB/MB dupliquée** par `scope2_selection` (refactor sans changement de comportement, couvert par tests existants)

### Créés (frontend)
- `apps/carbon/lib/api/energy.ts`
- `apps/carbon/components/energy/*` (+ `LicenseWarning`, `CalculationTrace` si pas déjà créés par une PR Wave 2 antérieure)

### Modifiés (frontend)
- `apps/carbon/app/(app)/scopes/page.tsx` (vue dual)
- `apps/carbon/lib/feature-registry.ts` (entrée BETA énergie)
- éventuellement `services/aggregation_service.py` + `models/carbon.py` (porter `scope2Mb` au consolidé — **À CONFIRMER**)

### PR-06B (indicatif, non dans PR-06A)
`db/migrations/032_scope2_engine.sql`, `services/calculations/scope2.py` + `units.py`, `scope2_calculation_runs`/`scope2_line_results`, endpoints `/energy/scope2/*`.

---

## 11. Risques

| Risque | Mitigation |
|---|---|
| **Refactor LB/MB casse les consommateurs existants** (beges, actions, pdf…) | Extraire à l'identique la règle actuelle (« LB préféré sur présence, LB=0 légitime ») ; couvrir par les tests existants de beges/actions **avant** refacto. |
| **Double allocation d'un instrument** (survente de garanties) | Contrainte base : somme des `allocated_mwh` par instrument ≤ `volume_mwh` ; `UNIQUE`/trigger empêchant deux allocations conflictuelles ; test dédié. |
| **Fallback silencieux de facteur** (masque un trou de données) | Hiérarchie explicite, `fallback_reason` obligatoire, erreur explicite au dernier niveau ; test « aucun fallback silencieux ». |
| **Absence d'utilitaire de conversion d'unités** (kWh/MWh/MJ) | **À INTRODUCE** `services/calculations/units.py` centralisé (PR-06A ou B) ; jamais de conversion inline dispersée. |
| **`scope2Mb` absent du consolidé** | Décision cadrée en §8 ; changement transverse testé. |
| **Facteur mix résiduel sous licence restrictive utilisé sans droit** | `license_policy.evaluate` avant tout calcul dérivé ; warning tracé dans `meta.quality.warnings`. |
| Pas de PostgreSQL local | CI `migration-tests` = seule preuve ; aller-retour prévu (leçon PR-02/03). |
| Numéro `031` déjà pris | `command=plan` avant apply ; renuméroter au merge (contrats §10). |

---

## 12. Étapes d'implémentation

**PR-06A :**
1. `scope2_selection` (helper) + tests, PUIS refacto beges/actions vers lui (comportement inchangé).
2. Migration `031` (meters/activities/instruments/allocations/factor_metadata) + sonde + fixtures + job CI.
3. Services meters/activities/instruments (+ défense en profondeur) + allocation contrôlée.
4. Import CSV activités (idempotent + gate de revue).
5. Router `/energy` + modèles.
6. Frontend : vue Scope 2 dual, activités, instruments (badges, licence).
7. Tests complets ; `git diff --check` ; lint.

**PR-06B (PR séparée ultérieure) :** moteur de calcul, runs, trace, approbation, evidence pack, enveloppe analytique.

---

## 13. Critères de merge (PR-06A)

- CI verte (`tests`, `migration-tests`, front, `validate`, `security-audit`, `gitleaks`).
- `ruff`/`git diff --check` propres ; TS strict.
- Refacto LB/MB **sans changement de comportement** (tests beges/actions verts avant/après).
- Isolation tenant testée (RLS + défense en profondeur) sur meters/activities/instruments/allocations.
- Anti-double-allocation garanti **en base** (pas seulement en Python).
- Séparation stricte compta entreprise vs proxy fournisseur (aucune fuite conceptuelle vers PR-05).
- Aucun LLM, aucun fallback silencieux, aucune donnée externe réelle.
- Aucune écriture prod par Claude. PR non mergée automatiquement.

---

## 14. Opérations post-merge

1. **Backup** avant écriture.
2. `db-migrate.yml` → `plan` (confirmer `031` pending, seul) → `apply` → `verify` → `/health/schema` `up_to_date:true` `schema_version:"031"`.
3. Vérification applicative : `GET /energy/meters` (JWT) → 200 liste vide ; `/scopes` affiche LB/MB inchangés.
4. Observation 24-48h (permissions `carbonco_app` sur les nouvelles tables). Consigner `MIGRATIONS_RUNBOOK.md` §9.
5. **Gate Phase 5** (à l'issue de PR-06B) : « double allocation impossible et calcul reproductible » — vérifié.
6. PR-06B planifiée séparément une fois PR-06A stabilisée en prod.
