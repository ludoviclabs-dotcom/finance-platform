# PROMPT_CLAUDE_CODE_PR11_IMPLEMENTATION

> **À exécuter UNIQUEMENT après la fusion de la PR documentaire de cadrage PR-11**
> (celle qui introduit `AI_GOVERNANCE_CONTRACTS.md`, `PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN.md`,
> `PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md`, `PR11_DECISIONS.md` et ce fichier).
> **Ne pas exécuter ce prompt dans la session de cadrage.** Il suppose les décisions D-3 et D-4 tranchées.

---

Copier le bloc ci-dessous comme message de départ d'une nouvelle session Claude Code.

---

```
Tu implémentes PR-11 (assistant IA de revue et d'explication cité) — la DERNIÈRE PR du chantier
CarbonCo Intelligence. Session neuve : lis d'abord la mémoire automatique, puis vérifie l'état réel
avant de lui faire confiance.

CONTRAINTES DURES (non négociables) :
- Assistant de REVUE et d'EXPLICATION, jamais un moteur de décision. Toute sortie DRAFT / SUGGESTION /
  REVIEW_REQUIRED. L'IA ne décide jamais la matérialité, ne publie rien, ne mute aucune donnée métier,
  ne recalcule aucun déterministe.
- Respecte À LA LETTRE docs/carbonco/refonte/AI_GOVERNANCE_CONTRACTS.md (grounding, citations résolues,
  licence, sensibilité, RLS gen-2, audit, rétention, gate humaine, gates de merge).
- Aucun accès direct du modèle à PostgreSQL, à Vercel Blob, au réseau, ni à un outil arbitraire.
- Ne lance AUCUNE migration en production. N'appelle AUCun modèle payant en CI (mode demo/mock).
- Ne merge PAS la PR automatiquement. Aucun commit/push sans validation explicite de Ludo si la consigne
  de session l'exige.

0. LECTURE OBLIGATOIRE (dans cet ordre) :
   - MEMORY.md + carbonco-current-handoff.md ;
   - docs/carbonco/refonte/AI_GOVERNANCE_CONTRACTS.md ;
   - docs/carbonco/refonte/PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN.md ;
   - docs/carbonco/refonte/PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md ;
   - docs/carbonco/refonte/PR11_DECISIONS.md ;
   - PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md §16 + §20 ;
   - WAVE_2_INTERFACE_CONTRACTS.md (RLS gen-2, pagination, _errors, AnalyticalEnvelope, licence, badges) ;
   - PR10_IRO_DOUBLE_MATERIALITY_TRACEABILITY.md (schéma IRO, claim_link_service, evidence-pack) ;
   - migration 028_evidence_kernel.sql (colonnes réelles) et services/intelligence/license_policy.py.

1. VÉRIFIER L'ÉTAT RÉEL (ne rien supposer) :
   git rev-parse --show-toplevel ; git fetch origin ; git status --short ;
   git log origin/master -1 --oneline ; git worktree list ; git branch --all
   HTTP : GET /health (db=ok, storage=ok, version = master), GET /health/schema
   (schema_version=040 ou plus, up_to_date=true, pending_count=0, manual_required_count=0),
   GET /openapi.json (routes /iro/* présentes).
   Confirmer que la PR de cadrage PR-11 est bien mergée (les 4 docs + ce prompt sont sur master).
   Si l'état diffère, S'ARRÊTER et diagnostiquer.

2. CONFIRMER LES DÉCISIONS (PR11_DECISIONS.md) — bloquantes pour coder :
   - D-3 : cas d'usage MVP (recommandé UC-1 revue IRO + UC-2 explication S2/S3). NE PAS élargir sans « go ».
   - D-4 : migration 041 = 4 tables (ai_runs, ai_claims, ai_citations, ai_review_decisions).
   Si D-3/D-4 ne sont pas confirmées par Ludo, demander avant de coder.
   Défauts sûrs pour le reste : NEURAL_MODE=demo, off par défaut, non-streaming, 1 PR extensible.

3. WORKTREE + BRANCHE (vérifier `git branch --show-current` AVANT de coder) :
   Branche : feat/ai-evidence-review (nom fixé par PLAN §19).
   Worktree : .claude/worktrees/ai-evidence-review, créé depuis origin/master à jour.
   Réutiliser un worktree pré-existant s'il correspond ; sinon `git worktree add`.

4. IMPLÉMENTER (périmètre = PR11_AI_REVIEW_ASSISTANT_IMPLEMENTATION_PLAN.md §5-§10) :
   Backend (apps/api) — la frontière de confiance :
   - migration db/migrations/041_ai_review_ledger.sql : 4 tables, company_id NOT NULL, RLS gen-2
     complète (ENABLE+FORCE, policies par commande, DROP POLICY IF EXISTS, app.rls_bypass),
     ai_runs & ai_review_decisions append-only (trigger façon materiality_decisions), idempotence,
     GRANT carbonco_app. Ajouter _probe_041 + migration_manifest + compteurs ledger + _migration_fixtures.
   - services/intelligence/ai/ : provider.py (abstraction, demo/live, id modèle configuré, échec explicite,
     budget tokens/coût/timeout), grounding_service.py (reference pack sous RLS + licence + sensibilité +
     minimisation + input_hash), citation_service.py (résolution/validation tenant+licence+type↔id, stale),
     entailment_service.py (supported/partially_supported/contradicted/unsupported), review_service.py
     (orchestration + gate §16.4 : schema_valid AND citation_resolved AND license_allowed AND
     human_review=approved), review_decision_service.py (ai_review_decisions + geste métier humain +
     audit_service.log_event), prompts/ (versionnés en code, séparation instructions/données).
   - models/ai_review.py (Pydantic strict, no untyped JSON). routers/ai_review.py (prefix /ai, endpoints
     du §7, pagination {items,total,limit,offset}, _errors.py). Monter le router dans main.py.
   - Réutiliser (ne pas recréer) : claim_link_service, license_policy, artifact_service,
     observation_service, iro_service/materiality_decision_service, AnalyticalEnvelope, audit_service,
     get_db(company_id), utils/env.is_production.
   Frontend (apps/carbon) :
   - components/intelligence/{review-gate,source-drawer,evidence-list,license-warning}.tsx + iro-candidate-button.
     Badges DRAFT/AI SUGGESTION/REVIEW_REQUIRED, modèle+date, citations numérotées, panneau preuve,
     avertissements unsupported/contradicted/stale, accepter/rejeter/modifier + justification,
     feedback utile/inutile/incorrect, régénération explicite, états rate-limit / provider indisponible.
     AUCUN bouton « publier automatiquement ». Réutiliser useChat/SafeMarkdown pour le seul brouillon.
   - Boutons « Revue IA » sur /iro/[id] et le panneau Scope 2. lib/api.ts. Ne pas exposer confidential/restricted.

5. TESTER (PR11_AI_EVALUATION_AND_RED_TEAM_PLAN.md) :
   - unitaires + contractuels provider + « modèle simulé » (mock scénarisé, dataset E1-E13) en job `tests` ;
   - intégration DB-gated (RLS 041, isolation A/B, _probe_041, append-only) INSCRITE dans le job
     migration-tests de .github/workflows/api.yml (sinon inerte) ;
   - red-team : injection de prompt (documents=données), fuite tenant, sensibilité, licence — VERTS ;
   - vérifier les gates de merge = 0 (cross-tenant, sensitive, licence, decision-automation,
     deterministic-mutation, citations inventées) ; budget/timeout explicites.
   Aucun test CI obligatoire ne dépend d'un appel modèle payant/non déterministe.
   Rappel : pas de Postgres local (Windows sans docker) → la preuve DB vient de la CI ; prévoir un
   aller-retour CI. Re-synchroniser les compteurs ledger codés en dur au moindre rebase.

6. TRAÇABILITÉ + PR :
   - docs/carbonco/refonte/PR11_TRACEABILITY.md (fichiers, décisions appliquées, preuves de test,
     éléments reportés/hors périmètre).
   - git diff --check ; git status --short. Commit (message convenu). Push. Ouvrir une PR vers master.
   - NE PAS merger. NE PAS lancer la migration en production.

7. POST-MERGE (côté Ludo, hors code) : décision budgétaire + NEURAL_MODE=live si voulu ; DB Migrate
   plan→apply→verify pour 041 ; provisionner secrets/région ; surveiller coût/latence/acceptation.

Découpage : viser 1 PR (feat/ai-evidence-review) si le diff reste révisable ; sinon PR-11A
(ledger+provider+grounding+citations+sécurité+éval) puis PR-11B (endpoints+UI). Justifier le choix.
```

---

*Fin de PROMPT_CLAUDE_CODE_PR11_IMPLEMENTATION.md — ne pas exécuter avant fusion de la PR de cadrage.*
