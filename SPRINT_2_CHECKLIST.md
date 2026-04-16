# Sprint 2 — Phase 1.B « Couche preuve backend »

> **Durée** : 2 semaines (S3–S4), ~13 jours ouvrés
> **Objectif** : Provenance auditable — chaque KPI retrouve sa source, son facteur et son hash
> **Jalon final** : `/facts/{code}/trail < 500ms p95`, RLS isolée 100 %, ≥500 facteurs queryables

---

## Pré-requis (J0 — avant de démarrer)

- [ ] Phase 1.A mergée sur `master` (ingest utilisateur + template opérationnels)
- [ ] `git checkout -b phase-1b-provenance`
- [ ] Vérifier que `psql $DATABASE_URL` se connecte
- [ ] Lire [PHASE1_INGESTION_PLAN.md](docs/carbonco/PHASE1_INGESTION_PLAN.md)
- [ ] Récupérer `Facteurs_Emission.xlsx` ADEME Base Empreinte v2025.0 et le placer dans `apps/api/data/factors/`

---

## J1 (lundi S3) — Migration `emission_factors`

**Objectif** : stocker ≥500 facteurs ADEME versionnés, queryables par `ef_id`.

### Tâches

- [ ] Créer `apps/api/db/migrations/001_emission_factors.sql` :
  - Colonnes : `id SERIAL PK`, `ef_code TEXT`, `label TEXT`, `scope INTEGER`, `category TEXT`, `factor_kgco2e NUMERIC(12,4)`, `unit TEXT`, `source TEXT`, `version TEXT`, `valid_from DATE`, `valid_until DATE`, `raw JSONB`
  - Unique : `(ef_code, version)`
  - Index : `(scope, category)`, `(version)`
- [ ] Créer `apps/api/scripts/extract_factors.py` : parse `Facteurs_Emission.xlsx` → insertions bulk
- [ ] Écrire test `apps/api/tests/test_emission_factors.py` : compter ≥500 rows, vérifier intégrité `factor_kgco2e > 0`
- [ ] Commit : `feat(phase-1b): migration emission_factors + extracteur ADEME (J1)`

**DoD** : `SELECT COUNT(*) FROM emission_factors WHERE version='v2025.0';` ≥ 500.

---

## J2 (mardi S3) — Modèle Pydantic + endpoint `/factors`

- [ ] Créer `apps/api/models/factors.py` (`EmissionFactor`, `FactorQuery`)
- [ ] Créer `apps/api/routers/factors.py` :
  - `GET /factors?scope=1&category=energy&version=v2025.0`
  - `GET /factors/{ef_code}?version=v2025.0`
- [ ] Pagination (limit/offset), rate limit 60/60s par user
- [ ] Brancher dans `main.py`
- [ ] Tests `test_factors_router.py` (HTTP 200 + pagination)
- [ ] Commit : `feat(phase-1b): router /factors + modèle Pydantic (J2)`

**DoD** : `curl /factors?limit=10` retourne 10 facteurs, total >500.

---

## J3 (mercredi S3) — Table `facts_events` + hash Merkle chaîné

- [ ] Migration `apps/api/db/migrations/002_facts_events.sql` :
  - `id SERIAL PK`, `company_id INT FK`, `code TEXT` (ex: `carbon.scope1Tco2e`), `value NUMERIC`, `unit TEXT`, `ef_id INT REFERENCES emission_factors(id)`, `source_path TEXT` (ex: `upload:CarbonCo_v2.xlsx!Synthese_GES!C10`), `computed_at TIMESTAMPTZ`, `hash_prev TEXT`, `hash_self TEXT`, `meta JSONB`
  - Unique : `(company_id, code, computed_at)`
  - Index : `(company_id, code)`, `(computed_at DESC)`
- [ ] Fonction `_compute_hash(prev, code, value, ef_id, company_id, computed_at)` : SHA-256 sur tuple ordonné
- [ ] Test : `pytest apps/api/tests/test_facts_hash.py` fixture 100 events, chaîne vérifiable
- [ ] Commit : `feat(phase-1b): table facts_events + hash chaîné (J3)`

**DoD** : test hash_chain 100 events vert, chaque hash_self dépend de hash_prev.

---

## J4 (jeudi S3) — Service `facts_service.py`

- [ ] Créer `apps/api/services/facts_service.py` :
  - `emit_fact(code, value, ef_id, source_path, company_id, meta) -> FactEvent`
  - `get_trail(code, company_id) -> list[FactEvent]`
  - `verify_chain(company_id) -> ChainVerification`
- [ ] Tests unitaires ≥85% coverage
- [ ] Commit : `feat(phase-1b): facts_service avec emit/trail/verify (J4)`

**DoD** : `emit_fact` + `get_trail` fonctionnels, coverage ≥85%.

---

## J5 (vendredi S3) — Vue matérialisée `facts_current`

- [ ] Migration `003_facts_current.sql` :
  ```sql
  CREATE MATERIALIZED VIEW facts_current AS
    SELECT DISTINCT ON (company_id, code)
      company_id, code, value, unit, ef_id, source_path, computed_at, hash_self
    FROM facts_events
    ORDER BY company_id, code, computed_at DESC;
  ```
- [ ] Index unique `(company_id, code)` + `REFRESH` déclenché après insert (trigger ou application)
- [ ] Benchmarks : `EXPLAIN ANALYZE` sur 10k events < 50ms
- [ ] Commit : `feat(phase-1b): vue facts_current + refresh (J5)`

**DoD** : `SELECT * FROM facts_current` < 50ms sur 10k events.

---

## J6 (lundi S4) — Adapter `carbon_service.py` pour écrire des facts

- [ ] Dans `_build_snapshot_from_workbooks`, après chaque champ calculé, appeler `emit_fact(code, value, ef_id=None|resolved, source_path, company_id, meta)`
- [ ] Mapping `SNAPSHOT_FIELD_TO_CODE` (ex: `carbon.scope1Tco2e` → `CC.GES.SCOPE1`)
- [ ] Propager `company_id` via param (nouvelle signature — rétro-compat via default=1)
- [ ] Étendre pour `esg_service.py` + `finance_service.py` (uniquement KPIs quantitatifs)
- [ ] Tests d'intégration : ingest master → vérifier N facts créés en DB
- [ ] Commit : `feat(phase-1b): émission facts depuis carbon/esg/finance_service (J6)`

**DoD** : ingest master crée ≥30 facts par domaine carbon.

---

## J7 (mardi S4) — RLS Postgres `ENABLE ROW LEVEL SECURITY`

- [ ] Migration `004_rls_policies.sql` :
  ```sql
  ALTER TABLE snapshots      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE facts_events   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE audit_events   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE alert_rules    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE products       ENABLE ROW LEVEL SECURITY;

  CREATE POLICY tenant_isolation_snapshots ON snapshots
    USING (company_id = current_setting('app.current_company_id')::int);
  -- … idem pour chaque table
  ```
- [ ] Setter `SET LOCAL app.current_company_id = $1;` en début de chaque transaction dans `get_db()`
- [ ] Rôle `carbonco_app` avec `BYPASSRLS` retiré (laisser uniquement superuser bypass)
- [ ] Commit : `feat(phase-1b): RLS policies + session-setting tenant (J7)`

**DoD** : `SET app.current_company_id = 1; SELECT * FROM snapshots WHERE company_id=2;` retourne 0 rows.

---

## J8 (mercredi S4) — Test d'isolation RLS

- [ ] Fixture : créer company_B + user_B + seeder facts distincts
- [ ] Test `test_rls_isolation.py` :
  - Login user_A → `GET /facts/*` ne retourne que facts company_A
  - Login user_B → ne voit pas facts company_A
  - Admin `BYPASSRLS` → voit les deux
- [ ] Test perf RLS : `EXPLAIN ANALYZE` sur 50k facts, index utilisé
- [ ] Commit : `test(phase-1b): isolation RLS 100% + perf (J8)`

**DoD** : 3 tests RLS verts, EXPLAIN montre `Index Scan using idx_facts_company_code`.

---

## J9 (jeudi S4) — Endpoints `/facts/*`

- [ ] Créer `apps/api/routers/facts.py` :
  - `GET /facts?code=carbon.scope1Tco2e&company_id=auto` (latest per code, depuis `facts_current`)
  - `GET /facts/{code}/trail` (historique complet, pagination)
  - `GET /facts/verify` (exécute `verify_chain` + retourne `{status, broken_at?}`)
- [ ] Rate limit 60/60s
- [ ] Brancher dans `main.py`
- [ ] Commit : `feat(phase-1b): router /facts (trail + verify) (J9)`

**DoD** : `GET /facts/carbon.scope1Tco2e/trail` retourne <500ms p95 sur 100 events.

---

## J10 (vendredi S4) — Migration hash sur `audit_events` existants

- [ ] Ajouter colonnes `hash_prev TEXT`, `hash_self TEXT` à `audit_events`
- [ ] Script `apps/api/scripts/migrate_audit_hash.py` : recalcule les hash par ordre chronologique pour tous les events existants
- [ ] Backfill en 1 transaction
- [ ] Test : `verify_audit_chain()` vert sur données réelles
- [ ] Commit : `feat(phase-1b): migration hash audit_events (J10)`

**DoD** : 100 % des audit_events ont `hash_self`, chaîne valide depuis le début.

---

## J11 (lundi S5 — tampon) — Tests d'intégration + bench perf

- [ ] Test E2E `apps/carbon/e2e/tests/05-provenance-api.spec.ts` :
  - Login → ingest template → appel `/facts/carbon.scope1Tco2e/trail` → 1 event
  - Nouvel ingest → 2 events, hash_prev du 2e = hash_self du 1er
- [ ] Benchmark p50/p95/p99 sur `/facts/*/trail` avec 1k events (locust ou k6)
- [ ] Ajuster index si besoin
- [ ] Commit : `test(phase-1b): E2E provenance + bench perf (J11)`

**DoD** : p95 < 500ms, E2E vert.

---

## J12 (mardi S5) — Review + merge + déploiement

- [ ] Review solo : relire la diff Phase 1.B (≥15 fichiers)
- [ ] Créer PR `phase-1b-provenance` → `master` : titre `feat(phase-1b): couche preuve backend (facts_events, RLS, emission_factors)`
- [ ] Merger
- [ ] Déploiement Vercel prod automatique
- [ ] Vérification prod :
  - [ ] `/factors?limit=1` retourne un facteur
  - [ ] Nouvel ingest via upload → snapshot + facts crées
  - [ ] `/facts/verify` retourne `{status: "ok"}`
- [ ] Mettre à jour `SPRINT_LOG.md` avec bilan Phase 1.B

**DoD** : prod stable, `/facts/verify` ok, 0 régression sur tests Phase 0 et Phase 1.A.

---

## Checklist finale Phase 1.B

- [ ] ≥500 emission_factors en DB, versionnés `v2025.0`
- [ ] facts_events append-only avec hash Merkle chaîné
- [ ] facts_service.py avec emit/trail/verify + coverage ≥85%
- [ ] Vue matérialisée facts_current < 50ms sur 10k events
- [ ] carbon/esg/finance_service émettent ≥30 facts/ingest
- [ ] RLS activée sur snapshots, facts_events, audit_events, alert_rules, products
- [ ] Test isolation RLS 100 % (user_A ne voit pas company_B)
- [ ] /facts/{code}/trail < 500ms p95
- [ ] audit_events historique rehashé, chaîne vert
- [ ] PR mergée sur master, prod stable
- [ ] SPRINT_LOG.md à jour

---

## Ressources

- **Plan global** : [PLAN_REFONTE_90J.md](PLAN_REFONTE_90J.md)
- **Log** : [SPRINT_LOG.md](SPRINT_LOG.md)
- **Spec technique** : [docs/carbonco/PHASE1_INGESTION_PLAN.md](docs/carbonco/PHASE1_INGESTION_PLAN.md)
- **Checklist Phase 1.A** : plan de session dans `.claude/plans/`
