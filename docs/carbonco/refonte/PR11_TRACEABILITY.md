# PR11_TRACEABILITY — Assistant IA cité, grounding et revue humaine

> Traçabilité d'implémentation de PR-11 (dernière PR du chantier CarbonCo
> Intelligence). Base : `origin/master` @ `c9f62af` (après merge PR #118).
> Branche : `feat/ai-evidence-review`. À lire avec `AI_GOVERNANCE_CONTRACTS.md`,
> `PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN.md`,
> `PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md`, `PR11_DECISIONS.md`.

## 1. Décisions appliquées

- **D-3** — MVP = **UC-1** (revue d'un IRO candidate avec preuves) + **UC-2**
  (explication d'un résultat déterministe Scope 2). Scope 3 : fast-follow
  documenté (§Limitations). Les 6 autres cas d'usage : non implémentés.
- **D-4** — Migration **041** = exactement **4 tables** (`ai_runs`, `ai_claims`,
  `ai_citations`, `ai_review_decisions`) + 1 élargissement de `audit_eventtype_check`.
  Pas de `ai_tasks`/`ai_prompt_versions`/`ai_policy_versions`/`ai_feedback`/
  `ai_evaluation_results`.
- Défauts sûrs : `AI_REVIEW_MODE=demo` (défaut, zéro appel payant), non-streaming
  pour la sortie structurée, prompts/policies versionnés en code, aucun prompt/
  réponse brut conservé (identifiants + `input_hash` + sortie structurée), une
  seule PR fonctionnelle, quotas fail-safe (DB-backed), aucune activation live.

## 2. Architecture

Le **backend Python possède la frontière de confiance** : grounding (reference
pack sous RLS + licence + sensibilité + minimisation), résolution/validation des
citations, entailment déterministe, gate de publication, journal auditable. Le
modèle est appelé via une abstraction fournisseur et ne voit qu'un pack
pré-autorisé — aucun accès direct DB/Blob/réseau, aucune écriture métier.

```
POST /ai/review/{iro|calc} → grounding_service.build_pack (RLS+licence+sensibilité)
  → ai_runs (pending) → provider.generate (demo/live) → validation Pydantic
  → citation_service.resolve_claim → entailment_service.support_status
  → ai_claims + ai_citations (persistés) → ai_runs (succeeded) → ReviewRunResponse
POST /ai/review/runs/{id}/decision → review_decision_service.record
  → ai_review_decisions (append-only) → geste métier humain (iro_service.create_iro)
  → audit_service.log_event("ai_review_decision")
```

## 3. Migration 041 (`apps/api/db/migrations/041_ai_review_ledger.sql`)

- `requires_owner=false`, transactionnelle, tables neuves uniquement.
- **`ai_runs`** — provenance (company_id NOT NULL, created_by, use_case,
  subject_type/key, provider, model, model_version, prompt_version,
  policy_version, input_hash, allowed_reference_ids JSONB) + cycle de vie
  (status, review_status) + usage (tokens_input/output, cost_estimate,
  latency_ms, error_code) + timestamps. Trigger `trg_ai_runs_guard` mode `run` :
  DELETE refusé ; UPDATE refusé si une colonne de PROVENANCE change (statut/
  usage/review_status/completed_at restent modifiables).
- **`ai_claims`** — output_label (DRAFT/SUGGESTION/REVIEW_REQUIRED), support_status
  (supported/partially_supported/contradicted/unsupported), claim_text,
  structured_payload. `frozen` (append-only).
- **`ai_citations`** — citation RÉSOLUE (resource_type, internal_id, source/
  release/artifact/observation_id, locator, data_status, sensitivity, license_ok,
  stale). `frozen`. SÉPARÉE de `claim_evidence_links` (humain).
- **`ai_review_decisions`** — decision (accept/reject/modify), reviewer_id NOT NULL,
  justification NOT NULL (CHECK non-vide), modified_output, feedback, supersedes_id.
  `frozen` (append-only, motif materiality_decisions 040).
- RLS gen-2 FORCE, policies par commande, `DROP POLICY IF EXISTS`, tenant strict.
  Défense-en-profondeur applicative (`company_id = %s`) dans chaque service.
- Fonction trigger unique `ai_review_ledger_guard()` (modes `run`/`frozen`).
- Élargissement `audit_eventtype_check` (+`'ai_review_decision'`, DROP+ADD 011/012/040).
- GRANT conditionnel `carbonco_app`. Idempotence (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
- Ledger : `migration_manifest.py` (041), `migration_probes.py` (`_probe_041`),
  `_migration_fixtures.py` (`apply_upto("041")`), compteurs
  (`test_migration_runner.py` len 41→42, dernière version 040→041 ; nouveau test
  `test_build_plan_detects_041_pending_on_baselined_ledger` ; `test_migration_ledger.py`
  written_count 42→43). `test_migration_probes.py` couvre `_probe_041`
  automatiquement (paramétré sur `MIGRATION_OBJECT_PROBES`).

## 4. Services (`apps/api/services/intelligence/ai/`)

- `provider.py` — `generate(request) -> GenerateResult`. `demo` (déterministe,
  zéro coût) / `live` (échec explicite `ProviderUnavailable` — non activé, aucun
  appel payant). Modèle configuré par `AI_REVIEW_MODEL` (jamais codé en dur),
  plafond `MAX_INPUT_TOKENS` (`BudgetExceeded`). Injectable en test.
- `prompts/` — `PROMPT_VERSION`/`POLICY_VERSION` + prompts système versionnés en
  code, séparation stricte instructions/données (défense injection).
- `grounding_service.py` — `build_pack` UC-1 (IRO + preuves via `claim_link_service`,
  artefacts joints à leur release/source, licence `license_policy.evaluate`,
  exclusion confidential/restricted et licence bloquante, extraits tronqués,
  `stale` calculé) et UC-2 (run Scope 2 via `scope2_runs.get_run`/`get_trace`,
  jamais recalculé).
- `citation_service.py` — résolution contre le pack (ensemble AUTORISÉ) : toute
  citation vers un ref_id inconnu (inventé), cross-tenant, non affichable ou
  sensible est REJETÉE.
- `entailment_service.py` — statut déterministe, calculé par le système (jamais
  déclaré par le modèle) : 0 citation → unsupported ; contradiction → contradicted ;
  résolu non corroboré/partiel/stale → partially_supported ; résolu+corroboré+frais
  → supported.
- `review_service.py` — orchestration + persistance + gate + rate-limit fail-safe
  (`RATE_LIMIT_PER_MIN`, DB-backed par tenant/utilisateur) + `get_run_detail`/`list_runs`.
- `review_decision_service.py` — décision humaine append-only + geste métier
  (`iro_service.create_iro(payload=IroCreate(...))`, jamais `create_candidate`) +
  `audit_service.log_event`.
- `models/ai_review.py` — modèles Pydantic stricts (no untyped JSON).

## 5. Endpoints (`apps/api/routers/ai_review.py`, préfixe `/ai`, monté dans main.py)

`POST /ai/review/iro/{iro_id}`, `POST /ai/review/calc/{envelope_ref}`,
`GET /ai/review/runs`, `GET /ai/review/runs/{run_id}`,
`POST /ai/review/runs/{run_id}/decision`. Auth JWT (`require_analyst` en écriture,
`get_current_user` en lecture), pagination `{items,total,limit,offset}`, erreurs
via `routers/_errors.py` (introuvable→404, requis→400, sinon→409 ; DB down→503 ;
`schema_ready_guard`→503 `schema_not_ready` tant que 041 n'est pas migré ;
provider indisponible→503 ; quota→429). Vérifié : les 5 routes montées
(`from main import app` → 360 routes, dont `/ai/review/*`).

## 6. Frontend (`apps/carbon`)

- CRÉÉS : `components/intelligence/review-gate.tsx` (badges DRAFT/AI SUGGESTION/
  REVIEW_REQUIRED, modèle+date, citations numérotées, panneau de preuve,
  support_status/stale/licence/sensibilité, accepter/rejeter/modifier +
  justification, feedback, régénération, états rate-limit/provider indisponible,
  coût/tokens ; AUCUN bouton publier-auto) et `iro-candidate-button.tsx`
  (promotion humaine via `POST /iro/iros`).
- RÉUTILISÉS : `components/intelligence/{source-drawer,evidence-list,license-warning,
  staleness-warning}.tsx`, `components/ui/data-status-badge.tsx`.
- Intégrations : bouton « Revue IA » sur `/iro/[id]`, « Explication IA » sur le
  panneau Scope 2. Pas de streaming pour la sortie structurée.
- Durcissement `app/api/value-mapping-variant/route.ts` (auth + rate-limit / demo).
- (Détail exact + statut lint/typecheck/vitest/build : voir la section frontend
  du récapitulatif de PR / journal d'implémentation.)

## 7. Grounding, citations, sécurité, licences, sensibilité

- Grounding backend-only, sous RLS + `license_policy.evaluate` (allow_display /
  allow_derived_use) + exclusion confidential/restricted + minimisation des extraits.
- Citation résolue contre l'ensemble autorisé : **inventée/cross-tenant/bloquée/
  sensible = rejetée** → claim `unsupported`. `ai_citations` distinct de
  `claim_evidence_links` : une citation modèle ne devient un lien validé que par
  un geste humain (accept).
- Gate de publication : `schema_valid AND citation_resolved AND license_allowed
  AND human_review = approved`. Le service produit les 3 premiers ; `human_review`
  reste humain.

## 8. Rétention

Aucun prompt/réponse brut conservé par défaut : `ai_runs` garde `input_hash`
(SHA-256 du pack) + `allowed_reference_ids` (identifiants) ; `ai_claims`/
`ai_citations` = sortie structurée + citations. Aucun extrait confidential/
restricted stocké (exclu au grounding). Opt-in tenant pour tout contenu clair =
non implémenté (défaut sûr = ne pas conserver).

## 9. Évaluation & red-team (tests)

- **`tests/test_ai_review_logic.py`** (job `tests`, DB-free, 12 cas) : provider
  demo déterministe/gratuit ; no-refs→unsupported ; budget→BudgetExceeded ; live
  sans/avec modèle→ProviderUnavailable ; **citation inventée→unsupported** ;
  **cross-pack→non résolu** ; **licence/confidential/restricted→rejetées** ;
  matrice entailment complète ; **citation exacte-non-pertinente≠supported (E11)** ;
  **injection de prompt dans une référence n'altère jamais les instructions** ;
  grounding UC-2 (méthode/total du run, jamais recalculé ; Scope 3→erreur claire).
- **`tests/test_ai_review_ledger.py`** (job `migration-tests`, DB-gated, Postgres) :
  pipeline complet UC-1 ; **exclusion sensibilité/licence/citations inventées**
  (allowed_reference_ids + ai_citations vérifiés → 0 fuite) ; **isolation RLS
  A/B** ; **append-only** (ai_claims/ai_citations/ai_review_decisions UPDATE/DELETE
  refusés ; ai_runs provenance immuable, review_status modifiable) ; **décision
  accept→create_iro candidate** + append-only + supersedes ; **provider
  indisponible→run `failed` journalisé** ; décision cross-tenant→introuvable.
  Fixtures : `tests/_ai_review_fixtures.py` (schéma 041, 2 tenants, IRO + 3 preuves).
- Aucun test CI obligatoire n'appelle un vrai modèle (provider stub/demo).
- Vérifié en local (venv projet) : 12 logic + 34 migration-runner passés, ruff
  clean, app importe (5 routes `/ai`). Les tests DB-gated sont prouvés en CI
  (`migration-tests`, Postgres 16) — pas de Postgres local (contrainte du chantier).

## 10. Limitations & activation live reportée

- **UC-2 Scope 3** : non implémenté (fast-follow) — `calc_explanation` supporte
  `scope2:{id}` uniquement, `scope3:*` renvoie une erreur claire.
- **Entailment `supported`** : réservé à une corroboration déterministe (UC-2
  valeur du run). En UC-1, la pertinence sémantique n'est pas vérifiable
  déterministiquement → au mieux `partially_supported` (revue humaine requise) —
  choix conservateur/honnête (E11).
- **Live NON activé** : `AI_REVIEW_MODE=demo` par défaut ; `live` échoue
  explicitement (aucun appel payant, aucun secret requis en CI). Activation =
  `AI_LIVE_ACTIVATION_RUNBOOK.md` (hors PR-11) : modèle/région/budget/quotas/
  secrets/opt-in tenant à confirmer.
- **Preuve DB** : uniquement par CI (pas de Postgres local Windows) — prévoir un
  aller-retour CI, comme tout le chantier.
