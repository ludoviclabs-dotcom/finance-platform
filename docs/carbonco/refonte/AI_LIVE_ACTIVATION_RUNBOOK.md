# AI_LIVE_ACTIVATION_RUNBOOK — Activation live (payante) de l'assistant IA

> **Ne PAS exécuter dans le cadre de PR-11.** Runbook de référence pour activer,
> plus tard et avec une décision explicite, le mode `live` (appel modèle réel,
> coût à l'usage) de l'assistant IA de revue/explication. Par défaut le système
> reste en `demo` (déterministe, zéro coût, aucun secret requis).

## 0. Pré-requis (décisions à confirmer avant toute activation)

| Décision | Défaut sûr actuel | À confirmer |
|---|---|---|
| Fournisseur / modèle | `demo` | Provider (Vercel AI Gateway) + `AI_REVIEW_MODEL` exact |
| Région de traitement | aucune (demo) | Traitement UE si disponible ; documenter la région effective |
| Budget | plafond contexte `MAX_INPUT_TOKENS` | Plafond coût/run + coût/jour par tenant |
| Quotas | `RATE_LIMIT_PER_MIN` (DB, fail-safe) | Confirmer/ajuster ; fail-safe en live |
| Opt-in tenant | off par défaut | Activer par tenant explicitement |

## 1. Variables d'environnement (NOMS uniquement — jamais de valeur ici)

Backend (`apps/api`) : `AI_REVIEW_MODE` (`demo`→`live`), `AI_REVIEW_MODEL`,
`AI_REVIEW_PROVIDER`, la clé/credential du gateway (nom à définir selon le
provider ; **ne jamais** committer). Frontend : `NEURAL_MODE` reste `demo` pour
le copilote/marketing sauf décision séparée. **Ne pas** activer `live` sans avoir
provisionné le budget et la région.

## 2. Séquence d'activation (contrôlée)

1. Vérifier que PR-11 est mergée, migration 041 appliquée (`/health/schema`
   `schema_version=041, up_to_date=true`).
2. Provisionner le secret provider (interface Vercel, jamais en clair dans le repo).
3. Poser `AI_REVIEW_MODEL` + `AI_REVIEW_PROVIDER` + `AI_REVIEW_MODE=live` en
   **preview** d'abord.
4. Activer l'opt-in du/des tenant(s) pilote(s) uniquement.
5. Test manuel (voir §3) sur le tenant pilote.
6. Observer coût/latence/erreurs 24-48h (`ai_runs.cost_estimate`/`latency_ms`/`error_code`).
7. Étendre progressivement.

## 3. Test manuel post-activation

- Lancer une revue UC-1 (IRO) et une explication UC-2 (Scope 2) sur des données
  du tenant pilote. Vérifier : sortie étiquetée REVIEW_REQUIRED ; citations
  résolues et ouvrables ; aucun contenu confidential/restricted exposé ; `ai_runs`
  journalise provider/model/tokens/cost/latency ; la revue humaine accept/reject/
  modify fonctionne et est append-only.
- Vérifier qu'un provider indisponible produit un run `failed` explicite (pas de
  substitution silencieuse).

## 4. Rollback / désactivation d'urgence

- **Immédiat** : `AI_REVIEW_MODE=demo` (revient aux réponses déterministes, zéro
  coût, sans redéploiement de code — variable d'environnement). Les endpoints
  restent disponibles en demo.
- **Par tenant** : retirer l'opt-in du tenant.
- **Total** : `AI_REVIEW_MODE=demo` + retirer le secret provider. Aucune donnée
  n'est perdue (le journal `ai_*` reste intact et append-only).

## 5. Monitoring

- Coût/latence agrégés depuis `ai_runs` (par tenant, use_case, jour).
- Taux d'erreur (`ai_runs.status='failed'`, `error_code`).
- Taux d'acceptation humaine (`ai_review_decisions.decision`).
- Alerte sur dépassement de budget (plafond coût/jour) → couper (`demo`).

## 6. Garde-fous permanents (ne jamais désactiver)

Grounding sous RLS + licence + sensibilité ; citations résolues ; entailment
déterministe ; gate de publication ; append-only du journal ; aucune décision de
matérialité automatique ; aucune écriture métier par le modèle ; documents traités
comme données non fiables. L'activation live NE change AUCUN de ces contrats.
