# PR11_INTEGRATION_REPORT — Assistant IA cité et sous revue humaine

> Rapport d'intégration de PR-11, dernière PR du chantier CarbonCo Intelligence.
> État au 2026-07-21. Certaines étapes de production dépendent de l'approbation
> humaine `production-db` (voir §4) — marquées **EN ATTENTE** ci-dessous.

## 1. PR et merge

| Élément | Valeur |
|---|---|
| PR cadrage | [#118](https://github.com/ludoviclabs-dotcom/finance-platform/pull/118) — MERGED (`c9f62af`), 5 docs, 2 P2 Codex corrigés |
| PR fonctionnelle | [#119](https://github.com/ludoviclabs-dotcom/finance-platform/pull/119) — **MERGED** |
| Merge commit | **`950b127`** (`origin/master`) |
| Branche | `feat/ai-evidence-review` |

## 2. Migration 041

- `apps/api/db/migrations/041_ai_review_ledger.sql` — 4 tables neuves tenant-strictes
  (`ai_runs`, `ai_claims`, `ai_citations`, `ai_review_decisions`) + élargissement
  `audit_eventtype_check` (`+ai_review_decision`). RLS gen-2 FORCE, triggers append-only,
  GRANT conditionnel. `requires_owner=false`. Ledger : `_probe_041`, manifest, fixtures,
  compteurs (discover len 42, written_count 43).
- **Appliquée en prod : EN ATTENTE** (workflow DB Migrate, approbation `production-db`, §4).

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

## 4. DB Migrate (EN ATTENTE — approbation humaine)

Le workflow **`DB Migrate`** (`db-migrate.yml`, `workflow_dispatch`, environnement protégé
`production-db`) est le SEUL chemin d'écriture schéma en prod. **Chaque commande exige
l'approbation manuelle de Ludo.** Séquence à exécuter :

1. `command=plan` → confirmer que **041 est la seule version `pending`**. *(Run `plan` déjà
   déclenché : `29824686552`, en attente d'approbation.)*
2. `command=apply` → applique 041.
3. `command=verify` → contrôle objet-par-objet.

**Résultat attendu après apply+verify** : `/health/schema` =
`{"schema_version":"041","up_to_date":true,"pending_count":0,"manual_required_count":0}`.

## 5. Vercel prod (auto — en cours)

Le déploiement prod de `950b127` est automatique sur merge. Au moment du rapport, `/health`
`version` reflète encore `c9f62af8b47e` (déploiement en cours). Une fois déployé + 041 appliquée :
`/ai/review/*` (503 `schema_not_ready` tant que 041 absente) et le frontend PR-11 seront servis.

## 6. Vérifications post-migration (à faire après §4/§5)

- `/health` `version` = `950b127…`, `db=ok`, `storage=ok`.
- `/health/schema` `schema_version=041`, `up_to_date=true`.
- `/openapi.json` contient `/ai/review/iro/{iro_id}`, `/ai/review/calc/{envelope_ref}`,
  `/ai/review/runs`, `/ai/review/runs/{run_id}`, `/ai/review/runs/{run_id}/decision`.
- Endpoint IA non authentifié → 401 propre ; mode demo opérationnel ; aucune requête payante.
- Non-régression : `/iro`, Scope 2/3, pages historiques.

## 7. Limitations

- **Live NON activé** (`AI_REVIEW_MODE=demo`) — voir `AI_LIVE_ACTIVATION_RUNBOOK.md`.
- **UC-2 Scope 3** = fast-follow (`calc_explanation` supporte `scope2:{id}` uniquement).
- Entailment `supported` réservé à corroboration déterministe (UC-2) ; UC-1 au mieux
  `partially_supported` (revue humaine).
- Preuve DB uniquement par CI (pas de Postgres local — contrainte de tout le chantier).
