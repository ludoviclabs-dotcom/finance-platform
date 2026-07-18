# PR-06A — Fondation énergie & Scope 2 · Traçabilité

**Périmètre :** tranche A de PR-06 (`PR06_ENERGY_SCOPE2_IMPLEMENTATION_PLAN.md`) — **ledger énergie & instruments**, migration `031`. Le moteur de calcul Scope 2 dual (totaux LB/MB en tCO2e, runs de calcul) est **PR-06B, hors périmètre**.
**Base :** branche `feat/energy-scope2-dual`, à jour sur `master` (`4653f1b`, inclut migration 028 Evidence Kernel + les plans Wave 2). Aucune dépendance à du code PR-04/PR-05 non mergé.
**Statut : implémenté, en attente de revue et de CI PostgreSQL (`migration-tests`). PR non mergée automatiquement.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **HORS PÉRIMÈTRE (PR-06B)**.

---

## 1. Périmètre livré

| # | Élément | Statut | Preuve |
|---|---|---|---|
| 1 | Migration 031 (5 tables + RLS gen-2 + trigger anti-double-allocation) | **FAIT** | `apps/api/db/migrations/031_energy_scope2.sql` |
| 2 | Helper LB/MB consolidé + refactor beges/actions (sans changement de comportement) | **FAIT** | `apps/api/services/carbon/scope2_selection.py` |
| 3 | Services énergie (meters/activities/instruments + allocation contrôlée) | **FAIT** | `apps/api/services/energy/*.py` |
| 4 | Modèles Pydantic + router `/energy` (10 endpoints) | **FAIT** | `apps/api/models/energy.py`, `apps/api/routers/energy.py` |
| 5 | Ledger : manifest 031, sonde `_probe_031`, fixtures → 031 | **FAIT** | `migration_manifest.py`, `migration_probes.py`, `tests/_migration_fixtures.py` |
| 6 | Tests (unitaires purs + DB-gated) + inscription CI | **FAIT** | 4 fichiers `tests/test_*` + `.github/workflows/api.yml` |
| 7 | Frontend : vue Scope 2 dual (BETA), activités, instruments/alertes | **FAIT** | `apps/carbon/components/energy/energy-scope2-panel.tsx`, `lib/api/energy.ts` |
| 8 | Moteur de calcul Scope 2 (LB/MB totals, runs) | **HORS PÉRIMÈTRE** | PR-06B (migration 032+) |

---

## 2. Migration 031 (`031_energy_scope2.sql`)

`requires_owner=False` (manifeste) — ne crée QUE des tables neuves, aucun `ALTER` d'une table existante (comme 028, à l'inverse de 027). Aucune donnée métier migrée, aucune source externe ingérée.

**Tables (toutes `id BIGSERIAL`, `company_id BIGINT NOT NULL REFERENCES companies(id)`, `created_at`/`updated_at`, RLS gen-2 FORCE) :**

| Table | Rôle | Points clés |
|---|---|---|
| `energy_meters` | Compteurs (électricité/gaz/chaleur/vapeur/froid/autre) | `carrier` CHECK ; `UNIQUE(company_id, meter_code)` ; `site_id → sites(id)` |
| `energy_activities` | Donnée d'activité (consommation) par compteur/période | `data_status` CHECK (vocab observations) ; `review_status` CHECK (pending/accepted/flagged) ; `evidence_artifact_id → evidence_artifacts(id)` ; **idempotence** `UNIQUE(company_id, meter_id, period_start, period_end)` ; CHECK `period_end >= period_start`, `quantity >= 0` |
| `contractual_instruments` | Instruments market-based (rec/go/ppa/green_tariff) | `volume_mwh >= 0` ; `valid_to >= valid_from` ; `certificate_artifact_id → evidence_artifacts(id)` ; `status` CHECK |
| `instrument_allocations` | Allocation instrument → activité | `allocated_mwh > 0` ; **`UNIQUE(instrument_id, energy_activity_id)`** ; **trigger anti-survente** |
| `energy_factor_metadata` | Relie un facteur (`emission_factors`, INTEGER) à une base | `basis` CHECK **location/market/residual_mix** ; `source_release_id → source_releases(id)` (nullable, sourcing licence) |

**RLS gen-2.** Pattern 028 (ENABLE + FORCE + policies scopées par commande `FOR SELECT/INSERT/UPDATE/DELETE` + garde `app.rls_bypass` + `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY`, rejouable). **Différence assumée vs 028 :** ces tables étant purement tenant (`company_id NOT NULL`, jamais de ligne globale), la clause de lecture **n'inclut pas** la branche `company_id IS NULL` du noyau (elle serait morte) — lecture = écriture = tenant courant. Documenté en tête du fichier.

**Anti-double-allocation EN BASE (exigence non négociable).** Deux mécanismes :
1. `UNIQUE(instrument_id, energy_activity_id)` — un instrument ne peut être alloué deux fois à la même activité.
2. Trigger `energy_allocation_guard()` `BEFORE INSERT OR UPDATE` — refuse toute allocation portant `SUM(allocated_mwh)` d'un instrument au-delà de son `volume_mwh` (survente de garanties). Sur `UPDATE`, la ligne courante (`OLD.id`) est exclue du cumul. `SECURITY DEFINER SET search_path = public` : agrège les allocations du même instrument même sous FORCE RLS ; ne lit que des lignes du même instrument (donc du même tenant que `NEW`), aucune fuite.

Prouvé aux deux niveaux par test (`test_energy_instruments.py`) : refus lisible côté service **et** barrière SQL directe (INSERT contournant le service → `energy_scope2: …` / violation `UNIQUE`).

**GRANT** conditionnel `carbonco_app` sur les 5 tables + séquences (même geste que 027/028) — no-op si le rôle est déjà propriétaire ou absent (dev/CI).

---

## 3. Consolidation LB/MB (refactor sans changement de comportement)

**Constat de départ.** La règle « préférer le location-based (LB) ; se rabattre sur le market-based (MB) seulement si LB **ABSENT** — sur la *présence*, pas la valeur (LB = 0 est légitime) » était dupliquée inline :
- `beges_export._reduce_scope_rows` (≈ l. 89-110) ;
- `actions_service.baseline_total` (≈ l. 298-304).

**Consolidation.** `services/carbon/scope2_selection.py` (fonction PURE, aucun I/O, aucun LLM) :
- `CODE_SCOPE2_LB` / `CODE_SCOPE2_MB` (codes de fact) ;
- `select_scope2(lb, mb) -> Scope2Selection | None` — présence testée sur `is not None`, jamais sur la véracité ;
- `select_scope2_from_facts(mapping) -> Scope2Selection | None` — variante lisant les deux codes par présence.

**Refactor.** `beges_export` et `actions_service` délèguent désormais à ce helper (mêmes littéraux de code via les constantes). **Comportement identique**, prouvé par :
- les tests existants `test_beges.py::TestScopeReduce` (LB=0 prime, repli MB, ordre indifférent) — **verts avant ET après** ;
- `test_scope2_selection.py::TestConsumerParity` — vérifie la parité helper ↔ `beges._reduce_scope_rows` ;
- suites `test_beges.py` + `test_actions.py` complètes — **27 passed, 1 skipped** (le skip = test CRUD actions DB-gated) avant/après.

`actions_service.baseline_total` est DB-gated (lit `facts_current`) — pas de test unitaire pur direct dans le dépôt ; sa délégation est ligne-pour-ligne équivalente et le helper est couvert exhaustivement (incl. le cas `from_facts` qui reproduit exactement son motif dict).

---

## 4. Services (`apps/api/services/energy/`)

Exception métier UNIQUE `EnergyError` (contrats §6). Défense en profondeur : `company_id = %s` explicite sur chaque requête (RLS primaire + doublon anti-IDOR, patron `source_service`/`evidence_service` — indispensable pour l'isolation en CI où le rôle `postgres` bypasse la RLS).

| Module | Responsabilité |
|---|---|
| `meters_service.py` | CRUD compteurs ; unicité `meter_code` par tenant (`ON CONFLICT`) ; contrôle `site_id` en périmètre. |
| `activities_service.py` | `parse_activities_csv` (PUR) ; `import_activities` **idempotent** (`ON CONFLICT DO NOTHING`, `import_id` contenu-adressé) + warnings compteur inconnu ; `list_activities` (filtres site/carrier/période/revue) ; `review_activity` (gate pending→accepted/flagged, **service-only**, cf. §7). |
| `instruments_service.py` | CRUD instruments (couverture/expiry dérivées en lecture) ; **`allocate_instrument` contrôlée** : refuse instrument expiré/non actif, vecteur incompatible, période hors validité, double allocation (paire), dépassement de volume. |
| `../carbon/scope2_selection.py` | Helper LB/MB (§3). |

---

## 5. Endpoints (`routers/energy.py`, préfixe `/energy`)

`_http_error` lexical local (même convention que `intelligence.py` ; module partagé `routers/_errors.py` « à confirmer » en PR-05, non créé ici pour ne pas préempter une PR sœur). `_require_db()` → 503. Pagination `limit`(1-200)/`offset` + enveloppe `{items,total,limit,offset}` (contrats §5).

| Endpoint | Perm |
|---|---|
| `GET /energy/meters` · `POST /energy/meters` · `GET /energy/meters/{id}` | viewer / analyst / viewer |
| `POST /energy/activities/import` · `GET /energy/activities` · `GET /energy/activities/{id}` | analyst / viewer / viewer |
| `GET /energy/instruments` · `POST /energy/instruments` · `GET /energy/instruments/{id}` | viewer / analyst / viewer |
| `POST /energy/instruments/{id}/allocate` | analyst |

Les 5 endpoints du plan §7 sont livrés ; les `GET …/{id}` sont ajoutés (lectures triviales, patron `intelligence.py`). L'app charge **210 routes** (200 + 10 énergie). Isolation → 404 (jamais 403).

---

## 6. Tests

| Fichier | Contenu | DB-gated |
|---|---|---|
| `test_scope2_selection.py` | Helper LB/MB : LB préféré, LB=0 légitime, repli MB sur présence, parité beges — **12 cas, jamais skippés** | Non |
| `test_energy_import.py` | `parse_activities_csv` (8 cas purs, jamais skippés) + import idempotent, gate de revue, warning compteur inconnu, isolation | Partiel |
| `test_energy_meters.py` | CRUD, unicité meter_code, site en périmètre, isolation tenant (RLS + défense en profondeur) | Oui |
| `test_energy_instruments.py` | Couverture/expiry, **anti-double-allocation service ET SQL direct**, dépassement, vecteur/période incompatibles, instrument expiré, isolation | Oui |
| `tests/_energy_fixtures.py` | Schéma → 031 + 2 companies (`en-test-a/b`) + 1 site chacune + teardown (`session_replication_role=replica`). Fixtures exposées via `conftest.py` (évite le faux positif F811, patron PR-03) | — |

**Ledger :** `test_migration_ledger.py` (assertions `written_count` **30 → 31**), `test_migration_runner.py` (corpus réel **29 → 30**, `assert "031" in versions`, `actions["031"] == "apply"`), `test_migration_probes.py` (paramétré sur les clés de sondes — `_probe_031` couvert automatiquement via `build_full_db → 031`).

**Exécuté localement (pas de PostgreSQL / Docker dans ce shell — DB-gated skippés, EXPECTED) :**
- `pytest test_scope2_selection.py` → **12 passed**.
- `pytest test_beges.py test_actions.py` → **27 passed, 1 skipped** (preuve refactor sans régression).
- `pytest test_migration_runner.py::test_build_plan_against_real_migrations_directory` → **passed** (031 détectée `apply`, corpus 30).
- Suite complète : **643 passed, 220 skipped, 5 failed** — les 5 échecs sont pré-existants et sans rapport (`ModuleNotFoundError: vercel`, cf. PR-03 §10), **zéro régression**. Les +25 skips = tests énergie DB-gated (meters/instruments/import), exécutés uniquement par le job CI `migration-tests`.
- `ruff check . --select=E,F,I --ignore=E501` → **All checks passed**.

**CI (`.github/workflows/api.yml`, job `migration-tests`)** : ajout de `test_energy_meters.py`, `test_energy_instruments.py`, `test_energy_import.py` au bloc PostgreSQL (seul job avec un vrai `postgres:16`). Sans cela, ils skipperaient silencieusement (leçon PR-03 §15). `test_scope2_selection.py` et les cas de parsing pur tournent dans le job `tests` (mode /tmp).

**Frontend :** `tsc --noEmit` (0 erreur sur les fichiers énergie ; les 3 erreurs résiduelles étaient dans `.next/dev/types/routes.d.ts`, cache généré périmé et gitignoré — disparues après `rm -rf .next`), `eslint .` (**exit 0**, 19 warnings pré-existants hors périmètre), `next build` (**succès**, route `/scopes` construite).

---

## 7. Interface frontend

- `lib/api/energy.ts` : client typé (snake_case, miroir de `models/energy.py`), réutilise `API_BASE_URL` + `getAuthToken` de `@/lib/api`.
- `components/energy/energy-scope2-panel.tsx` : section **Scope 2 dual** (colonnes location-based **et** market-based **côte à côte, aucune masquée**), tableau d'activités (badge de revue énergie), instruments avec **barre de couverture + alerte d'expiration**, badge **BETA** (`FeatureStatusBadge status="beta"`), états loading/empty/error. **Aucun total d'émissions Scope 2 (tCO2e)** — uniquement des quantités d'énergie (MWh) ; bandeau méthodologique explicite (« une moyenne pays-average n'est jamais market-based », « les totaux LB/MB arrivent en PR-06B »).
- Extension de `components/pages/scopes-page.tsx` (rendue par `app/(app)/scopes/page.tsx`) : `<EnergyScope2Panel />` ajouté sous les priorités de réduction.
- `data/feature-status.json` : entrée BETA `energie-scope2-dual` (le registre `feature-registry.ts` lit ce JSON — pas de statut codé en dur).

---

## 8. Déviations, choix et reports (honnêtes)

- **Pas de table d'imports dédiée (6ᵉ table).** Le plan §5 énumère 5 tables et modélise l'`import_id` comme colonne d'`energy_activities`. L'idempotence est donc garantie par la **clé naturelle UNIQUE** `(company_id, meter_id, period_start, period_end)` + `import_id` contenu-adressé, sans réintroduire une table façon `import_screenings`. Fidèle au plan, évite la sur-modélisation.
- **`review_activity` non exposé en HTTP.** La liste d'endpoints du plan §7 pour PR-06A n'inclut pas de route de revue. Le gate est implémenté et testé côté service (précédent exact : les transitions release de PR-03, service-only). À exposer si un besoin UI réel se confirme.
- **Compatibilité « zone » d'allocation : partielle.** L'allocation contrôle **vecteur + période + expiration + volume** (les garde-fous concrets et DB-enforçables de PR-06A). La compatibilité **géographique** stricte est reportée : les activités portent un `site_id`, pas de `geography_code`, et le géospatial est explicitement PR-08 (plan §2). `contractual_instruments.geography_code` et `energy_factor_metadata.geography_code` sont en place pour ce futur contrôle.
- **`energy_factor_metadata.company_id NOT NULL`.** Conforme à l'instruction « toutes les tables : `company_id BIGINT NOT NULL` ». Chaque tenant curate ses métadonnées de facteurs (base/zone/période/sourcing licence) ; RLS uniforme. Le facteur référencé (`emission_factors`) reste, lui, un catalogue global.
- **`aggregation_service.CarbonKpis` (perte de `scope2Mb`) NON modifié.** Le plan §8/§10 marque ce portage « À CONFIRMER » (changement transverse au dashboard consolidé). Laissé intact pour rester strictement behaviour-preserving et sans risque de régression ; la vue dual PR-06A lit LB et MB directement, sans passer par le consolidé. À trancher avec le portage complet en PR-06B.
- **Helper d'erreurs router local** (pas de `routers/_errors.py` partagé) : évite de préempter la décision « à confirmer » de PR-05 (contrats §6).

---

## 9. Confirmations explicites

- **Aucun calcul Scope 2, aucun total LB, aucun total MB** (tCO2e) — tout cela est PR-06B. PR-06A ne produit que le **ledger de données** + la sélection LB/MB pour les consommateurs mono-total existants.
- **Anti-double-allocation garanti EN BASE** (contrainte `UNIQUE` + trigger), pas seulement en Python — prouvé par test SQL direct.
- **Aucun LLM, aucun fallback silencieux de facteur, aucun connecteur externe, aucune donnée externe réelle ingérée.**
- **Séparation stricte** compta entreprise (ce module) vs proxy fournisseur (PR-05) — aucune fuite conceptuelle.
- **`beges_export`/`actions_service` refactorés sans changement de comportement** (tests verts avant/après).
- **Aucune migration exécutée contre une base réelle.** `031` suit le chemin `db-migrate.yml` (workflow manuel protégé) comme 001-028 ; aucun `apply` par Claude.
- **Une seule nouvelle migration** : `apps/api/db/migrations/031_energy_scope2.sql` (vérifié : aucun autre `0NN.sql` dans le diff).
- **PR non mergée automatiquement.**

---

## 10. Opérations post-merge (Ludo, hors code)

1. **Backup** (`backup.yml`) avant écriture.
2. **DB Migrate** → `plan` (confirmer `031` seule en `apply`, pending) → `apply` → `verify` (`{"anomalies": []}`, exerce `_probe_031`).
3. `GET /health/schema` → attendu `schema_version: "031"`, `up_to_date: true`, `pending_count: 0`.
4. Vérif applicative : `GET /energy/meters` (JWT) → 200 liste vide ; `/scopes` affiche la section dual BETA + LB/MB historiques inchangés.
5. Observation 24-48h (permissions `carbonco_app` sur les 5 nouvelles tables). Consigner `MIGRATIONS_RUNBOOK.md` §9.
6. PR-06B (moteur de calcul dual) planifiée séparément une fois PR-06A stabilisée.
