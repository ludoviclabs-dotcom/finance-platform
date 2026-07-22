# MODULE 2 — RAPPORT D'INTÉGRATION FINALE

> **Module :** Ressources stratégiques & dépendances industrielles étendues.
> **Date :** 2026-07-22 · **Base finale :** `origin/master` = `6479e11` (Merge PR #132).
> **Statut :** `MODULE2_MVP_COMPLETE` — appliqué et **vérifié en production de bout en bout**.

---

## 0. Verdict

| Axe | État | Preuve |
|---|---|---|
| Code Module 2 (M2A→M2D) | ✅ **MERGÉ** | #127/#128/#129/#130 + docs #125/#126 (§1) |
| Migration 043 en base de production | ✅ **APPLIQUÉE** | DB Migrate apply run `29934245339`, `/health/schema=043` (§3) |
| Runtime Python Vercel | ✅ **RÉPARÉ (autodetect)** | PR #131 `17828b2` — plus d'erreur builder (§4) |
| Migrations de démarrage en prod | ✅ **DÉSACTIVÉES** | PR #132 `6479e11` — plus de `permission denied` (§5) |
| Déploiement prod `carbonco-api` | ✅ **READY** | `dpl_9Jm8JXbLmKbsK3mDHUYDiEeKhn27`, `/health`=`6479e11` (§4, §6) |
| Frontend `carbon` | ✅ **LIVE** | `carbon-snowy-nine.vercel.app`, 0 régression (§6) |
| Endpoints (`/health`, `/health/schema`, `/openapi.json`, `/resources/*`) | ✅ | §6 |
| RLS · Evidence Kernel · aucune source live | ✅ | §2 |
| Smoke tests | ✅ | §7 |
| Erreurs runtime | ✅ **propres** | §6 |

**Conclusion : le MVP Module 2 est complet, en production, et vérifié.** Les deux
correctifs d'infrastructure découverts pendant l'intégration (runtime Python Vercel,
migrations au cold start) sont **résolus, mergés et confirmés en production**. Aucune
dette bloquante. `NEXT_ACTION = pack EUDR ou audit produit final` (`MODULE2_FUTURE_PACKS.md`).

---

## 1. PR — état de merge

| PR | Objet | Merge commit | État |
|---|---|---|---|
| [#125](https://github.com/ludoviclabs-dotcom/finance-platform/pull/125) | Cadrage (docs) | `c29baf3` | ✅ MERGED |
| [#126](https://github.com/ludoviclabs-dotcom/finance-platform/pull/126) | Architecture (docs) | `f30cfc5` | ✅ MERGED |
| [#127](https://github.com/ludoviclabs-dotcom/finance-platform/pull/127) | **PR-M2A** catalogue + migration 042 | `14e57b1` | ✅ MERGED |
| [#128](https://github.com/ludoviclabs-dotcom/finance-platform/pull/128) | **PR-M2B** moteur d'assessment + migration 043 | `79c3dbf` | ✅ MERGED |
| [#129](https://github.com/ludoviclabs-dotcom/finance-platform/pull/129) | **PR-M2C** cockpit `/resources` | `d7d7505` | ✅ MERGED |
| [#130](https://github.com/ludoviclabs-dotcom/finance-platform/pull/130) | **PR-M2D** démo Asterion ressources | `184db69` | ✅ MERGED |
| [#131](https://github.com/ludoviclabs-dotcom/finance-platform/pull/131) | **fix** runtime Python Vercel (autodetect) | `17828b2` | ✅ MERGED |
| [#132](https://github.com/ludoviclabs-dotcom/finance-platform/pull/132) | **fix** migrations réservées à DB Migrate | `6479e11` | ✅ MERGED |

---

## 2. Migrations 042/043, RLS, Evidence Kernel, aucune source live (revue de code)

- **042** (`resource_catalog`, `resource_aliases`, `resource_regulatory_statuses`,
  `resource_sector_uses`) + **043** (`resource_supply_observations`,
  `company_resource_exposure_links`, `resource_assessment_runs`,
  `resource_assessment_dimensions`) : présentes, au manifeste (`requires_owner=False`),
  sondées (`_probe_042`/`_probe_043`). **Zéro ALTER** de table historique ; `iros_origin_domain_check` non élargie.
- **RLS gen-2** : `ENABLE` + `FORCE` sur les 8 tables, policies par commande, portée mixte
  (lecture globale+tenant / écriture tenant) ou tenant-strict, défense applicative `_SCOPE_READ`
  + anti-IDOR `_assert_in_scope`. **Triggers d'immutabilité** sur runs + dimensions.
- **Evidence Kernel (028)** : `source_release_id` + `evidence_artifact_id` référencés,
  gardes `*_sourced_check` (`verified`/`confirmed` ⇒ release). **risque ≠ confiance** (colonnes séparées).
- **Aucune source externe live** : 0 appel HTTP (`services/resources`, `demo`, frontend
  `components/resources`, `app/demo/asterion-resources`) ; démo `resources.json` `synthetic=true` ;
  client `lib/api/resources.ts` n'appelle que `${API_BASE_URL}`.

## 3. Migration 043 — application vérifiée (DB Migrate, environnement protégé `production-db`)

Chaîne `plan → apply → verify` via `.github/workflows/db-migrate.yml` (seul chemin d'écriture
schéma prod, approbation humaine requise).

| Étape | Run | Résultat JSON |
|---|---|---|
| **plan** | [`29933098011`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/29933098011) | `has_blocking_issues=false` ; `items` : 043 = `pending`/`apply`, **43 autres** `applied`/`baseline`/`skip` ; **aucun** checksum mismatch (« inchangé ») ; `requires_owner=False` (conforme manifeste) |
| **apply** | [`29934245339`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/29934245339) | `applied_count=1` ; `applied=[{version:"043", execution_ms:938}]` ; aucune erreur |
| **verify** | [`29935638849`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/29935638849) | Rapport formel réservé au gate `production-db` ; **valeurs cross-confirmées** par `/health/schema` (lecture directe du ledger, ci-dessous) et par le `plan` (has_blocking_issues=false) |

**`/health/schema` en production (post-application)** :
```json
{"schema_version":"043","up_to_date":true,"pending_count":0,"manual_required_count":0}
```
→ conforme aux six critères requis (`schema_version=043`, `up_to_date=true`, `pending_count=0`,
`manual_required_count=0`, aucune anomalie, aucune divergence checksum).

## 4. Correctif runtime Python Vercel (PR #131)

- **Cause** : `apps/api/vercel.json` épinglait `"runtime": "@vercel/python@4.3.1"`, incompatible
  avec le builder Vercel courant (`@vercel/python@6.51.1`). Tous les builds `carbonco-api` M2B→M2D
  échouaient en `ERROR` au chargement du builder (`version-mismatch`), **avant** le code — la
  production restait figée sur M2A (`14e57b1`, schéma 042).
- **Correctif** : suppression du pin (1 fichier, 1 ligne). Vercel auto-détecte Python 3.12 (`uv`),
  installe `requirements.txt`, compile — **build 11-13 s**.
- **Résultat** : `carbonco-api` production `READY` (`dpl_DzXeKnf`, puis `dpl_9Jm8JXb` post-#132),
  plus aucune erreur builder. `/health` sert le bon commit.

## 5. Correctif migrations au démarrage (PR #132)

- **Cause** : le nouveau builder Vercel **invoque** les events lifespan/startup ASGI (contrairement
  à l'ancienne hypothèse). Le hook `@app.on_event("startup")` appelait `run_migrations()` sans
  condition → tentative `CREATE TABLE` au cold start avec le rôle applicatif → `permission denied
  for schema public` (capturé, non fatal, mais bruyant et contraire au principe « DB Migrate seul
  chemin d'écriture schéma »).
- **Correctif** : garde `main._maybe_run_startup_migrations` — désactivée par défaut, opt-in **local**
  via `RUN_STARTUP_MIGRATIONS=1`, **jamais** sur Vercel (prod/preview) ni en production (double garde
  `VERCEL` + `is_production()`). No-op tracé en **info** sobre. Aucune migration SQL, aucun privilège
  PostgreSQL modifié, aucune vraie erreur DB masquée. Commentaires obsolètes + runbook corrigés.
  Tests : **8 cas** (`test_startup_migrations.py`).
- **Preuve production** (`dpl_9Jm8JXb`, commit `6479e11`) : cold start logue
  `Startup migrations disabled; use DB Migrate workflow` ; **zéro** `permission denied`. La dernière
  occurrence de l'erreur date de `16:13:31` sur l'ancien déploiement `dpl_DzXeKnf` (pré-#132) — arrêtée.

## 6. Production — endpoints, déploiements, runtime

**`carbonco-api`** (`prj_7CMvi3jYo0EBrbFTfr863KjprGKb`) — production `dpl_9Jm8JXbLmKbsK3mDHUYDiEeKhn27`,
`READY`, commit `6479e11`, alias officiel `carbonco-api-ludovics-projects-159c139c.vercel.app` :

| Endpoint | Résultat |
|---|---|
| `/health` | `200` — `status=ok`, `version=6479e11922e1`, `db=ok`, `storage=ok`, `worker=worker` |
| `/health/schema` | `200` — `schema_version=043`, `up_to_date=true`, `pending_count=0`, `manual_required_count=0` |
| `/openapi.json` | `200` — OpenAPI 3.1.0, « Finance Platform API » v0.1.0 |
| `/resources/catalog` | `401` (route présente, protégée — jamais 404/500) |
| `/resources/alerts` | `401` (route présente, protégée — jamais 404/500) |

**`carbon`** (frontend) — `carbon-snowy-nine.vercel.app` sert l'application complète (cockpit ESG),
déploiement production `READY` sur master, aucune régression sur les parcours historiques.

**Erreurs runtime** : le cluster `permission denied for schema public` s'arrête à `16:13:31`
(`lastDeployment=dpl_DzXeKnf`, pré-#132) ; le déploiement production courant (`dpl_9Jm8JXb`) n'en
produit **aucune**. Aucune autre erreur nouvelle liée au Module 2.

## 7. Smoke tests

| Suite | Résultat |
|---|---|
| Backend non-DB complet (`pytest -q`) | **1030 passed / 714 skipped / 0 failed** (dont 8 nouveaux `test_startup_migrations`) |
| Backend DB-gated (CI `migration-tests`) | **vert** ×2 (2m16/2m20, Postgres réel : RLS, immutabilité, IDOR, licence, source, idempotence) |
| Moteur pur ressources + démo | 24 passed ; `demo_verify` **parité 5/5** (silicium/hélium/xénon/hydrogène/charbon à coke) |
| Frontend `carbon` | vitest **246/246**, `tsc` 0, eslint 0 err, `next build` OK |
| Statique backend | `ruff` (E,F,I) propre, `py_compile` OK |
| CI PR #131 / #132 | tous verts (`tests`, `validate`, `security-audit`, `gitleaks`, `migration-tests`, 3 Vercel) |

## 8. Dettes résiduelles

**Bloquantes : aucune.**

**Non bloquantes :**
- `ensure_schema()` (`db/migrations.py`) reste du **code historique inerte** (middleware retiré
  PR-02C, non recâblé) — conservé et testé, candidat à suppression dans un futur nettoyage hors périmètre.
- Le rapport **formel** `DB Migrate verify` (run `29935638849`) reste en attente d'approbation du
  gate `production-db` ; l'état appliqué est **cross-confirmé** par `/health/schema` (ledger) et le `plan`.
- Warning `@app.on_event("startup")` déprécié par FastAPI (pré-existant, non lié au Module 2).
- Reports fonctionnels documentés (non-dettes) : émission IRO `strategic_resources` (D-5), tables
  `resource_roles`/`resource_stage_applicability` (D-1/D-6), risque-pays v2 WGI (D-3) — cf.
  `MODULE2_FINAL_READINESS.md` §3.

## 9. Références

Migrations `apps/api/db/migrations/042_*.sql`, `043_*.sql` · `main.py` (`_maybe_run_startup_migrations`)
· `routers/resources.py`, `routers/health.py`, `services/resources/*` · `apps/carbon/app/(app)/resources/*`,
`apps/carbon/app/demo/asterion-resources/` · `MIGRATIONS_RUNBOOK.md` · `MODULE2_{FINAL_READINESS,FUTURE_PACKS,HANDOFF}.md`.
