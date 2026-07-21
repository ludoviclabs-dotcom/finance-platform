# PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN

> **Documentaire — plan d'implémentation de PR-11.** Aucun code / migration / appel modèle produit ici.
> Base : `origin/master` @ `93a513a`, schéma `040`. À lire avec `AI_GOVERNANCE_CONTRACTS.md`,
> `PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md`, `PR11_DECISIONS.md`.
> PR-11 est la **dernière PR** du plan Intelligence (`PLAN_ACTION…` §19 : branche `feat/ai-evidence-review`).

---

## 1. Inventaire réel de l'IA existante (base `93a513a`)

Inspection en lecture seule du dépôt réel (pas du plan). **Le LLM vit aujourd'hui entièrement dans le
frontend Next.js**, jamais dans l'API Python.

### 1.1 Backend `apps/api` — AUCUN LLM

- `routers/copilot.py` : 2 endpoints **déterministes**, aucun modèle.
  - `GET /copilot/tools` → `services/copilot_tools.py::build_copilot_tools_bundle(company_id)` : bundle
    typé de KPIs (carbon/vsme/esg/finance/alerts/health).
  - `POST /copilot/rag-search` → `services/esrs_corpus.py::search` : recherche lexicale dans un corpus
    ESRS **statique** (~60 entrées), **sans auth** (données normatives publiques).
- `services/intelligence/` (Evidence Kernel, PR-03+) : `source_service`, `release_service`,
  `artifact_service`, `observation_service`, `ingestion_service`, `claim_link_service`,
  `license_policy`, `freshness_service`, `snapshot_migration`, `adapters/`. **Déterministe, aucun LLM.**
- Aucun SDK Anthropic/OpenAI, aucun appel `api.anthropic.com`/gateway côté Python (vérifié : seuls des
  faux positifs dans `.venv`).

### 1.2 Frontend `apps/carbon` — tout le LLM

- **SDK** : `ai@^6.0.158`, `@ai-sdk/anthropic@^3.0.69`, `@ai-sdk/react@^3.0.160`.
- **Abstraction fournisseur** : `lib/ai/provider.ts` — `NEURAL_MODE ∈ {demo,live}` (défaut `demo` =
  réponses scriptées, **zéro appel payant**), `isLiveAi()`, `demoStreamResponse()` (flux « UI message »
  compatible `useChat` sans appel modèle).
- **Route copilote** : `app/api/copilot/route.ts` — `verifyBearerToken` (JWT) → `checkCopilotRateLimit`
  (Upstash) → `streamText({model:"anthropic/claude-sonnet-4.6", system, messages})` →
  `toUIMessageStreamResponse()`. `maxDuration=60`. Système construit de `/copilot/tools` (KPIs
  déterministes) + RAG ESRS. Citations **texte libre** (`(ESRS E1-6 §44-55)`), non résolues contre une base.
- **Route variante marketing** : `app/api/value-mapping-variant/route.ts` — même pattern, **SANS auth,
  SANS rate-limit** (dette de sécurité, §Risques). Restreinte à `allowedFacts`.
- **UI chat** : `components/pages/copilot-page.tsx` (`useChat` de `@ai-sdk/react`, `SafeMarkdown`,
  panneau « Sources de données grounded » = santé de données, **pas** des citations de preuve).
- **Rate limit** : `lib/rate-limit.ts` (Upstash Redis, 20/min + 200/j, **fail-open**).
- **Embeddings/vecteur** : `@upstash/vector` + `VOYAGE_API_KEY` (extraction de datapoints via Inngest,
  `inngest/functions/extract-datapoint*.ts`) — **autre surface IA** (extraction depuis documents importés →
  cible d'injection de prompt).
- **CSP** : `proxy.ts` autorise gateway + anthropic dans `connect-src`.
- **CI** : `.github/workflows/` = `api.yml`, `frontend.yml`, `e2e.yml`, `neural*.yml`, `secrets-scan.yml`.
  Test e2e copilote : `e2e/tests/12-copilot.spec.ts`. Aucun workflow/gate IA dédié.
- **Variables d'environnement** (noms seulement) : `ANTHROPIC_API_KEY`, `NEURAL_MODE`,
  `UPSTASH_REDIS_REST_URL/TOKEN` (+ `KV_REST_API_URL/TOKEN`), `UPSTASH_VECTOR_REST_URL/TOKEN`,
  `VOYAGE_API_KEY`, `AUTH_JWT_SECRET`, `API_BASE`/`NEXT_PUBLIC_API_BASE(_URL)`.

### 1.3 Substrat d'ancrage disponible (déjà en prod, schéma 040)

- **Evidence Kernel** (028) : `source_registry`, `source_releases` (immuable), `evidence_artifacts`
  (`sensitivity`, locators `page/table/cell/excerpt`), `observations` (`data_status`
  verified/estimated/manual/inferred, `confidence` 0-1), `claim_evidence_links`
  (`relation_type` supports/contradicts/contextualizes/derived_from), `ingestion_runs`.
  Immutabilité via `evidence_kernel_guard()` (frozen / source_release / evidence_artifact).
- **Enveloppe analytique** `models/analytics.py::AnalyticalEnvelope` `{data, meta, evidence}`
  (`meta.method{code,version}`, `meta.quality{confidence 0-100, coverage_pct, warnings}`,
  `evidence[]{artifact_id, source_code, release_key, page_reference}`).
- **IRO / double matérialité** (040) : `iros` (status candidate/…/decided, `origin_domain`,
  `origin_reference` TEXT libre), `impact_assessments`, `financial_assessments`,
  `materiality_decisions` (**append-only**, `decided_by`/`justification` NOT NULL, trigger
  `trg_materiality_decisions_guard`), `iro_actions`, `disclosure_mappings`. Preuves IRO **réutilisent**
  `claim_link_service` (`claim_type='iro'`, `claim_key='iro:{id}'`) — pas de `iro_evidence_links`.
  Endpoint pack de preuve : `GET /iro/iros/{id}/evidence-pack` (ZIP signé).
- **Licence** : `license_policy.evaluate(source)` (déterministe). **Audit** : `audit_service.log_event`
  / `audit_events` (`audit_eventtype_check` élargi par 011/012/040).

### 1.4 Verdict d'inventaire

| Catégorie | Constat |
|---|---|
| **Réutilisable tel quel** | AI SDK + AI Gateway + `lib/ai/provider.ts` (demo/live) ; `useChat`/`SafeMarkdown` ; Upstash rate-limit ; JWT ; Evidence Kernel + `claim_link_service` + `license_policy` + `AnalyticalEnvelope` + `audit_service` ; RLS gen-2 ; `/iro/*` + evidence-pack. |
| **Réutilisable en durcissant** | Rate-limit (fail-open → fail-safe pour surfaces coûteuses) ; provider (centraliser l'id modèle, l'exposer côté backend). |
| **Obsolète / insuffisant pour PR-11** | Citations texte-libre du copilote (non résolues) ; RAG ESRS statique (≠ Evidence Kernel) ; « Sources grounded » = santé de données, pas des preuves. |
| **Dangereux** | `value-mapping-variant` **sans auth ni rate-limit** (endpoint LLM public) ; rate-limit **fail-open** ; extraction Inngest = ingestion de documents non fiables (surface d'injection). |
| **Manquant (à créer)** | Grounding sur Evidence Kernel ; citations structurées résolues ; sortie structurée validée ; ledger de run IA (audit/coût/tokens) ; gate de revue humaine ; étiquetage DRAFT/SUGGESTION/REVIEW_REQUIRED ; harnais d'évaluation ; UI de revue (`ReviewGate`, drawer preuve, feedback). |

---

## 2. Principe produit (rappel)

Assistant **de revue et d'explication**, jamais moteur de décision. Toute sortie `DRAFT` / `SUGGESTION` /
`REVIEW_REQUIRED`, alimentant un **humain** qui reste seul à muter la donnée métier. Détail des règles :
`AI_GOVERNANCE_CONTRACTS.md`.

---

## 3. MVP retenu (2 cas d'usage)

Sur les 8 cas d'usage candidats (§9 du brief), recommandation : **UC-1 + UC-2**.

### UC-1 — Revue d'un IRO candidate avec preuves *(pièce maîtresse)*

- **Valeur** : culmination de tout le chantier Intelligence (double matérialité, gate §20 du plan).
- **Données prêtes** : `iros` + `impact/financial_assessments` + preuves via `claim_link_service` +
  `GET /iro/iros/{id}/evidence-pack`.
- **Risque maîtrisé** : l'IA produit une **`REVIEW_REQUIRED`** (synthèse + questions + contradictions +
  données manquantes) qui **alimente** la décision humaine `materiality_decisions.decide()` ; elle ne décide
  jamais. Aligné §16.1 (« proposition d'IRO candidat ») et §16.2 (jamais la matérialité).
- **Auditable** : la décision humaine est déjà tracée/append-only ; le run IA se greffe en amont.

### UC-2 — Explication d'un résultat Scope 2 / Scope 3 déterministe *(risque le plus bas)*

- **Valeur** : explicabilité d'un chiffre réglementaire.
- **Données prêtes** : moteurs Scope 2 (033) / Scope 3 (032) exposés via `AnalyticalEnvelope`
  (`data` + `meta.method` + `evidence`).
- **Risque minimal** : l'IA **explique un calcul déjà fait**, ne recalcule jamais (§16.2, principe 1.7).
  L'enveloppe **est** la vérité terrain → entailment machine-vérifiable (l'explication doit être cohérente
  avec `meta.method`/`data`/`evidence`).
- **Évaluation propre** : la référence déterministe rend l'éval nette et bon marché.

### Justification comparative

| Critère | UC-1 IRO | UC-2 Explain S2/S3 | UC-3 CRMA | UC-4 Eau | UC-5 LEAP | UC-6 Contra | UC-7 Manquants | UC-8 Narratif |
|---|---|---|---|---|---|---|---|---|
| Valeur utilisateur | ★★★ | ★★ | ★★ | ★ | ★ | ★★ | ★★ | ★★ |
| Données prêtes | ★★★ | ★★★ | ★★ | ★★ | ★★ | ★★★ | ★★★ | ★★ |
| Risque (bas=mieux) | ★★ | ★★★ | ★★ | ★★ | ★★ | ★ | ★★★ | ★ |
| Facilité d'éval | ★★ | ★★★ | ★★ | ★★ | ★ | ★ | ★★★ | ★ |
| Auditabilité | ★★★ | ★★★ | ★★ | ★★ | ★★ | ★★ | ★★ | ★★ |
| Coût | ★★ | ★★★ | ★★ | ★★ | ★★ | ★★ | ★★★ | ★ |

UC-1 (valeur + centralité gate) et UC-2 (risque/éval minimaux) couvrent les **deux archétypes**
(« revue sur preuves » et « explication d'un déterministe »). **Fast-follow** proposé (hors MVP) :
UC-7 (données manquantes, très bas risque) puis UC-6 (contradictions). UC-8 (narratif de disclosure)
reste `DRAFT` strict et vient plus tard. Décision figée dans `PR11_DECISIONS.md` (D-3).

---

## 4. Architecture

**Décision structurante : le backend Python possède la frontière de confiance.** Le grounding,
l'assemblage du reference pack (sous RLS + licence + sensibilité), la résolution/validation des citations,
le ledger de run, la sortie structurée validée et la gate de publication sont **backend-owned**. Le modèle
est appelé via une **abstraction fournisseur** ; il ne voit qu'un pack minimisé et pré-autorisé.

```
Frontend (apps/carbon)                 Backend (apps/api)                        Modèle
────────────────────────               ──────────────────────                    ───────
ReviewGate / SourceDrawer   ──POST──▶  /ai/review/{use_case}
EvidenceList / feedback                  1. authz + tenant (RLS gen-2)
                                         2. build reference pack  ◀── Evidence Kernel / IRO / AnalyticalEnvelope
                                         3. licence(allow_display) + sensibilité + minimisation
                                         4. provider.generate(...)  ──────────────────────▶  (AI Gateway/Anthropic)
                                         5. valider JSON (schema_valid)             ◀──────  sortie structurée
                                         6. résoudre citations (citation_resolved, tenant/licence)
                                         7. entailment (supported/…/unsupported)
                                         8. persister ai_runs/ai_claims/ai_citations
                                         9. renvoyer résultat structuré + citations
◀── rendu revue + statuts ──────────────
Accept/Reject/Modify        ──POST──▶  /ai/review/runs/{id}/decision
                                         → ai_review_decisions (append-only)
                                         → geste métier humain (iro_service / claim_link_service)
```

Raisons :

- Les données à ancrer (Evidence Kernel, IRO, enveloppes) et leur RLS/licence vivent **dans l'API Python**.
  Faire l'ancrage/validation ailleurs dupliquerait la sécurité et casserait l'audit.
- **MVP non-streaming** pour la sortie **autoritative** (structurée + citations) : plus simple à valider et
  à auditer. L'affichage progressif du **brouillon** textuel peut réutiliser le pattern `useChat`/stream
  existant plus tard (décision D-5), mais jamais comme source autoritative.
- **Abstraction fournisseur backend** : `provider.generate()` peut appeler le **Vercel AI Gateway**
  (réutilise le crédit existant) ou l'API Anthropic. L'id modèle est configuré, jamais codé en dur.
  Mode `demo` (mock déterministe) conservé côté backend pour CI/local.

**Interdits d'architecture (MVP)** : aucun browsing libre ; aucun outil réseau arbitraire ; **aucun accès
direct du modèle à PostgreSQL** ; **aucun accès direct à Vercel Blob** ; **aucune action métier sans
médiation backend**.

---

## 5. Migration 041 — **OUI** (minimale, 4 tables)

Une migration `041_ai_review_ledger.sql` est **justifiée** : le ledger de run IA (provenance/coût/citations/
revue) n'est exprimable ni par `audit_events` (pas de colonnes tokens/coût/model/prompt-version/citations)
ni par `claim_evidence_links` (réutiliser cette table pour des citations *modèle* mélangerait preuve validée
humaine et proposition non validée — **interdit**, §5 des contrats). Prochain numéro : **041** (ledger à 040,
41 fichiers `.sql` 001-040 incl. 008b).

Aligné sur `PLAN…` §16.3 (`ai_tasks, ai_runs, ai_claims, ai_citations, ai_review_decisions`) mais **resserré
à 4 tables** pour le MVP.

| Table | Retenue ? | Justification |
|---|---|---|
| **`ai_runs`** | ✅ | 1 ligne/invocation. `company_id NOT NULL`, `created_by`, `use_case`, `subject_type`/`subject_key` (absorbe `ai_tasks`), `provider`, `model`, `model_version`, `prompt_version`, `policy_version`, `input_hash`, `allowed_reference_ids` JSONB, `status` (pending/succeeded/failed/blocked_license/refused), `tokens_input/output`, `cost_estimate`, `latency_ms`, `error_code`, `review_status` (draft/needs_review/approved/rejected), timestamps. |
| **`ai_claims`** | ✅ | 1 ligne/affirmation atomique produite. `output_label` (DRAFT/SUGGESTION/REVIEW_REQUIRED), `support_status` (supported/partially_supported/contradicted/unsupported), texte + payload structuré. |
| **`ai_citations`** | ✅ | 1 ligne/citation, **résolue** vers un id interne réel. `resource_type`, `internal_id`, `source_id`/`release_id`/`artifact_id`/`observation_id`, locator, `data_status`, `sensitivity`, `license_ok`, `retrieved_at`, `stale`. **Séparée de `claim_evidence_links`.** |
| **`ai_review_decisions`** | ✅ | Décision humaine (accept/reject/modify), reviewer, justification, `feedback` (useful/not/incorrect), timestamps. **Append-only** (trigger type `materiality_decisions`). |
| `ai_tasks` | ❌ (fusionnée) | Pas d'orchestration multi-run au MVP → `subject_*` porté par `ai_runs`. Réintroduite si besoin de tâches multi-tentatives. |
| `ai_prompt_versions` / `ai_policy_versions` | ❌ | Versionnées **en code** (`services/intelligence/ai/prompts/`, constante + hash) → `prompt_version`/`policy_version` = colonnes de `ai_runs`. Éviter de dupliquer du contenu repo en base. Promouvoir en table si prompts éditables par tenant. |
| `ai_feedback` | ❌ (fusionnée) | Colonne `feedback` sur `ai_review_decisions` au MVP. |
| `ai_evaluation_results` | ❌ | Résultats d'éval = artefacts CI / rapports JSON, **pas** une table prod. |

Toutes les tables : `company_id NOT NULL`, RLS gen-2 complète (`ENABLE`+`FORCE`, policies par commande,
`DROP POLICY IF EXISTS`, `app.rls_bypass`), défense-en-profondeur applicative, sonde `_probe_041` +
entrée `migration_manifest`, GRANT `carbonco_app`. `ai_runs`/`ai_review_decisions` append-only.
Idempotence (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`). **Confirmé par `PR11_DECISIONS.md` (D-4).**

---

## 6. Services backend (à créer)

Sous `apps/api/services/intelligence/ai/` (emplacement prévu par `PLAN…` §4) :

- `provider.py` — abstraction fournisseur : `generate(request) -> ModelResult` ; modes `demo` (mock
  déterministe) / `live` (gateway/Anthropic) ; id modèle configuré ; **échec explicite** si indisponible
  (jamais de substitution silencieuse) ; budget tokens/coût/timeout appliqués.
- `grounding_service.py` — construit le reference pack par use case (UC-1 IRO, UC-2 enveloppe S2/S3) :
  lecture RLS, filtrage `license_policy.evaluate` (`allow_display`/`allow_derived_use`) + sensibilité,
  minimisation des extraits, `input_hash`, `allowed_reference_ids`.
- `citation_service.py` — résout et valide chaque citation contre la base (tenant, licence, sensibilité,
  cohérence type↔id) ; calcule `stale` ; renvoie `unsupported` si non résolue.
- `entailment_service.py` — attribue `supported/partially_supported/contradicted/unsupported` (déterministe
  d'abord : présence/valeur ; le jugement modèle est secondaire et lui-même non autoritatif).
- `review_service.py` — orchestration : run → validation JSON → citations → entailment → gate §16.4 →
  persistance `ai_runs/ai_claims/ai_citations` ; applique l'étiquetage DRAFT/SUGGESTION/REVIEW_REQUIRED.
- `review_decision_service.py` — enregistre la décision humaine (`ai_review_decisions`) et déclenche le
  **geste métier humain** (jamais d'écriture modèle ; pour un IRO accepté :
  `iro_service.create_iro(company_id=…, payload=IroCreate(…), created_by=…)`, qui force déjà
  `status='candidate'` — **pas de `create_candidate` parallèle**) ; `audit_service.log_event`.
- `prompts/` — prompts **versionnés en code** (constante `PROMPT_VERSION`, séparation instructions/données).
- `models/ai_review.py` — Pydantic strict (sortie modèle, citation, résultat de revue) ; **no untyped JSON**.

Réutilisés (non recréés) : `claim_link_service.{create_link,list_links}`, `license_policy.evaluate`,
`artifact_service`, `observation_service`, `iro_service.create_iro(payload=IroCreate(…))` (force déjà
`status='candidate'`) / `materiality_decision_service.decide`, `audit_service.log_event`,
`AnalyticalEnvelope` (`models/analytics.py`), `utils/env.py::is_production`,
**`get_db` importé depuis `apps/api/db/database.py`** (`from db.database import get_db` ;
`get_db(company_id=…)` pose `SET LOCAL app.current_company_id`), `db/tenant.py::get_company_id`.

---

## 7. Endpoints (à créer)

Router `apps/api/routers/ai_review.py`, monté `prefix="/ai"` dans `main.py`. Contrats gelés Wave 2 :
pagination `{items,total,limit,offset}`, erreurs via `routers/_errors.py` (introuvable→404, requis→400,
sinon→409 ; DB down→503 ; hors périmètre→404 jamais 403). Exceptions `AiReviewError`.

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/ai/review/iro/{iro_id}` | UC-1 : lance une revue d'IRO candidate → run structuré + citations (`REVIEW_REQUIRED`). |
| `POST` | `/ai/review/calc/{envelope_ref}` | UC-2 : explication d'un résultat S2/S3 déterministe (`REVIEW_REQUIRED`). |
| `GET` | `/ai/review/runs/{run_id}` | Détail d'un run (claims + citations + statuts). |
| `GET` | `/ai/review/runs` | Liste paginée des runs du tenant (filtres use_case/subject/status). |
| `POST` | `/ai/review/runs/{run_id}/decision` | Décision humaine accept/reject/modify (+feedback) ; geste métier. |

Toutes authentifiées (JWT, `get_company_id`), rate-limitées (par tenant + utilisateur), budgétées.

---

## 8. Frontend (à créer / réutiliser)

**À CRÉER** (n'existent pas encore) :

- `components/intelligence/review-gate.tsx` (`ReviewGate`) — carte de revue : badge `DRAFT`/`AI SUGGESTION`/
  `REVIEW_REQUIRED`, modèle + date, citations numérotées, avertissements `unsupported`/`contradicted`/`stale`,
  boutons accepter/rejeter/modifier + justification, feedback (utile/inutile/incorrect), régénération
  explicite, états `rate-limit` / `provider indisponible`. **Aucun bouton « publier auto ».**
- `components/intelligence/iro-candidate-button.tsx` (`IroCandidateButton`) — promotion humaine d'un signal
  en IRO candidate (déjà prévu §17), câblée à `POST /iro/iros` (jamais un `create_candidate`).

**DÉJÀ EXISTANTS — à RÉUTILISER tels quels** (créés en Wave 2 / PR-04, `components/intelligence/`) :

- `source-drawer.tsx` (`SourceDrawer`) / `evidence-list.tsx` (`EvidenceList`) — panneau de preuve
  (ouvre l'artefact d'origine, locators).
- `license-warning.tsx` (`LicenseWarning`) — badge `LICENSED`/`BLOCKED` + réserve ;
  `staleness-warning.tsx` (`StalenessWarning`) — état `stale`.
- Autres réutilisés : `useChat`/`SafeMarkdown` (pour le **brouillon** narratif seulement),
  `DataStatusBadge` + `dataStatusToBadge` (`components/ui/data-status-badge.tsx`), `FeatureStatusBadge`,
  animations, `lib/ai/provider.ts` (demo/live).

Intégration MVP : bouton « Revue IA » sur la page IRO (`/iro/[id]`) et sur le panneau Scope 2
(`scope2-engine-panel.tsx`). UX cohérente, accessible (aria), sans substitution silencieuse de modèle.

---

## 9. Tests (voir plan d'éval dédié pour le détail)

- **Unitaires** (job `tests`, `/tmp`) : provider mock, validation JSON, étiquetage, mapping erreurs.
- **Contractuels provider** : forme requête/réponse, budget/timeout, échec explicite si indisponible.
- **Modèle simulé (mock)** : grounding, résolution de citations, entailment, gate §16.4 — **déterministes**.
- **Intégration DB-gated** (job `migration-tests`, Postgres `postgres:16`) : RLS gen-2 des tables 041,
  isolation tenant A/B, sonde `_probe_041`, ledger. **Inscrire les tests DB-gated dans `migration-tests`**
  (piège connu : un test DB-gated non inscrit y est silencieusement inerte).
- **Évaluations avec vrai modèle** : **optionnelles**, hors CI obligatoire (workflow manuel).
- **Red-team / injection de prompt** : gate de merge.

Aucun test CI obligatoire ne dépend d'un appel modèle payant/non déterministe.

---

## 10. Fichiers à créer / modifier (prévision)

**Créer (backend)** : `db/migrations/041_ai_review_ledger.sql` ; `db/migration_probes.py::_probe_041`
(+ `migration_manifest.py`, compteurs ledger, `_migration_fixtures.py`) ; `services/intelligence/ai/*`
(provider, grounding, citation, entailment, review, review_decision, prompts/) ; `models/ai_review.py` ;
`routers/ai_review.py` ; tests `tests/test_ai_review_*.py` + fixtures.
**Modifier (backend)** : `main.py` (monter le router) ; `.github/workflows/api.yml` (inscrire les tests
DB-gated dans `migration-tests`).
**Créer (frontend)** : `components/intelligence/review-gate.tsx` +
`components/intelligence/iro-candidate-button.tsx` (les SEULS nouveaux) ; hooks/appels API ; tests.
**Réutiliser (frontend, existants)** : `components/intelligence/{source-drawer,evidence-list,license-warning,staleness-warning}.tsx`,
`components/ui/data-status-badge.tsx` (+`dataStatusToBadge`).
**Modifier (frontend)** : pages `/iro/[id]` et panneau Scope 2 (bouton « Revue IA ») ; `lib/api.ts` ;
éventuellement `lib/rate-limit.ts` (fail-safe) ; `value-mapping-variant/route.ts` (auth+rate-limit — dette).
**Docs** : `PR11_TRACEABILITY.md` (au moment du code).

---

## 11. Découpage d'implémentation

Voir `PR11_DECISIONS.md` (D-6). **Recommandation : une seule PR fonctionnelle** `feat/ai-evidence-review`
si le diff reste révisable et si les garanties se testent ensemble (le grounding, les citations et la revue
n'ont de sens qu'ensemble). **Repli en 2 tranches** seulement si le diff explose :

- **PR-11A** : migration 041 + ledger + provider abstraction + grounding + citations + entailment +
  sécurité (RLS/licence/sensibilité) + **évaluations** (mock). *Testable de bout en bout sans UI.*
- **PR-11B** : endpoints métier + UI de revue + intégrations pages IRO/Scope 2.

Chaque tranche part de `master` à jour, CI verte, aucune migration prod déclenchée par Claude.

---

## 12. Risques

- **Injection de prompt** via artefact importé (PDF/CSV/extraction Inngest) → données non fiables,
  séparation instructions/données, tests d'injection (gate).
- **Fuite cross-tenant / sensibilité** → RLS gen-2 + défense applicative + tests A/B (gate).
- **Citation inventée / non pertinente** → résolution obligatoire + entailment (gate).
- **Confusion estimation/vérification & calcul/opinion** → labels + « explique, ne recalcule pas » (UC-2).
- **Rate-limit fail-open & endpoint marketing sans auth** → durcir (fail-safe, auth) avant tout mode `live`.
- **Coût / timeout / streaming interrompu / provider indisponible** → budgets explicites, états UI, sortie
  autoritative backend-only.
- **Piège CI DB-gated** non inscrit dans `migration-tests` (inerte) — leçon PR-03.
- **Pas de Postgres local** (Windows sans docker) → preuve DB uniquement par CI ; prévoir un aller-retour.
- **Compteurs ledger** codés en dur à re-synchroniser au rebase (leçon Wave 2).

---

## 13. Critères de merge

Repris de `AI_GOVERNANCE_CONTRACTS.md` §13 : cross-tenant=0, sensitive=0, licence=0, decision-automation=0,
deterministic-mutation=0, citations-inventées=0, unsupported marqué, injection verte, budget/timeout
explicites, aucun test obligatoire dépendant d'un modèle payant. CI complète verte (api/frontend/e2e/
migration-tests/secrets-scan). Aucune migration prod jouée par Claude ; **PR non mergée automatiquement.**

---

## 14. Post-merge (côté Ludo, hors code)

1. Revue humaine + merge de la PR fonctionnelle.
2. Décision budgétaire + `NEURAL_MODE=live` (sinon reste en `demo`, zéro coût).
3. `DB Migrate` : `plan` (041 seule pending) → `apply` → `verify` → `/health/schema` `up_to_date:true`
   `schema_version "041"`.
4. Provisionner secrets (clé gateway/fournisseur, région) ; vérifier CSP/observabilité coûts.
5. Surveiller premiers runs réels (coût, latence, taux d'acceptation humaine).

*Fin de PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN.md.*
