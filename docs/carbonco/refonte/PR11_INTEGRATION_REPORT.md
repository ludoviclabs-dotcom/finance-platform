# PR11_INTEGRATION_REPORT — Assistant IA cité et sous revue humaine

> Rapport d'intégration de PR-11, dernière PR du chantier CarbonCo Intelligence.
> État au 2026-07-21, mis à jour après réconciliation finale (PR #120) : migration 041
> appliquée en prod et déploiement Vercel confirmés — plus aucune étape EN ATTENTE.

## 1. PR et merge

| Élément | Valeur |
|---|---|
| PR cadrage | [#118](https://github.com/ludoviclabs-dotcom/finance-platform/pull/118) — MERGED (`c9f62af`), 5 docs, 2 P2 Codex corrigés |
| PR fonctionnelle | [#119](https://github.com/ludoviclabs-dotcom/finance-platform/pull/119) — **MERGED** (`950b127`) |
| PR clôture (ce rapport + readiness) | [#120](https://github.com/ludoviclabs-dotcom/finance-platform/pull/120) — **MERGED** |
| `origin/master` actuel | **`a4e5252`** (merge #120) |
| Branche | `feat/ai-evidence-review` |

## 2. Migration 041

- `apps/api/db/migrations/041_ai_review_ledger.sql` — 4 tables neuves tenant-strictes
  (`ai_runs`, `ai_claims`, `ai_citations`, `ai_review_decisions`) + élargissement
  `audit_eventtype_check` (`+ai_review_decision`). RLS gen-2 FORCE, triggers append-only,
  GRANT conditionnel. `requires_owner=false`. Ledger : `_probe_041`, manifest, fixtures,
  compteurs (discover len 42, written_count 43).
- **Appliquée en prod : CONFIRMÉE** — `/health/schema` = `schema_version=041, up_to_date=true,
  pending_count=0, manual_required_count=0` (workflow DB Migrate exécuté, §4).

## 3. CI (verte sur le merge)

| Job | Résultat |
|---|---|
| `validate` (ruff E,F,I) | ✅ pass |
| `tests` (pytest /tmp) | ✅ pass |
| `migration-tests` (Postgres 16) | ✅ pass — 041 appliquée, `_probe_041`, **tests DB-gated IA (RLS A/B, append-only, pipeline, exclusion sensibilité/licence/derived-use/inventée, create_iro, provider indisponible)** |
| `security-audit` (pip-audit + npm audit) | ✅ pass (3 avis npm transitifs pré-existants corrigés via `npm audit fix`) |
| `gitleaks` | ✅ pass |
| `build` / `lint-and-build` (frontend) | ✅ pass (typecheck, 186 vitest, build) |
| Vercel previews (carbon / carbonco-api / finance-platform) | ✅ Ready |

**Revue Codex** : P1 (exiger `allow_derived_use` avant d'envoyer un artefact au modèle) +
P2 (persister `model_version` du provider) — **corrigés (`77cb705`) et threads résolus** avant merge.

## 4. DB Migrate (EXÉCUTÉ — confirmé)

Le workflow **`DB Migrate`** (`db-migrate.yml`, `workflow_dispatch`, environnement protégé
`production-db`) est le SEUL chemin d'écriture schéma en prod. Séquence `plan` → `apply` →
`verify` exécutée avec approbation manuelle de Ludo à chaque étape.

**Résultat confirmé en direct (réconciliation finale)** : `/health/schema` =
`{"schema_version":"041","up_to_date":true,"pending_count":0,"manual_required_count":0}`.

## 5. Vercel prod (déployé — confirmé)

Déploiement prod automatique sur merge, confirmé en direct pour `carbon` et `carbonco-api` :
`/health` `version=a4e5252eb78d`, `db=ok`, `storage=ok`. `/ai/review/*` et le frontend PR-11
sont servis (503 `schema_not_ready` levé, 041 appliquée).

## 6. Vérifications post-migration (confirmées, réconciliation finale)

- ✅ `/health` `version=a4e5252eb78d`, `db=ok`, `storage=ok`.
- ✅ `/health/schema` `schema_version=041`, `up_to_date=true`, `pending_count=0`,
  `manual_required_count=0`.
- ✅ `/openapi.json` contient `/ai/review/iro/{iro_id}`, `/ai/review/calc/{envelope_ref}`,
  `/ai/review/runs`, `/ai/review/runs/{run_id}`, `/ai/review/runs/{run_id}/decision`.
- ✅ Endpoint IA non authentifié → `401 {"detail":"Token manquant"}` (GET `/ai/review/runs` et
  POST `/ai/review/iro/{id}`) ; mode demo opérationnel ; aucune requête payante déclenchée.
- ✅ `/iro` servi (distinct d'un 404 réel, gate d'authentification standard de l'app).

## 7. Limitations

- **Live NON activé** (`AI_REVIEW_MODE=demo`) — voir `AI_LIVE_ACTIVATION_RUNBOOK.md`.
- **UC-2 Scope 3** = fast-follow (`calc_explanation` supporte `scope2:{id}` uniquement).
- Entailment `supported` réservé à corroboration déterministe (UC-2) ; UC-1 au mieux
  `partially_supported` (revue humaine).
- Preuve DB uniquement par CI (pas de Postgres local — contrainte de tout le chantier).
