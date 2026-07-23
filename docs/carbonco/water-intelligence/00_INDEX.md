# Water Intelligence — Index de pilotage

Point d'entrée court du chantier CarbonCo Water Intelligence.

## Mission active

**P00 — Audit immuable et ADR de frontière.**

Aucun prompt suivant (P01 à P18) ne doit être lancé avant que P00 soit fusionné.

## Frontière de routes (rappel)

- `/water` reste le cockpit entreprise authentifié **existant**, inchangé.
- `/water-intelligence` est la route **publique** cible du nouveau module.

## Documents à lire, dans l'ordre

1. [`WATER_INTELLIGENCE_PROMPT_PACK_V1.md`](./WATER_INTELLIGENCE_PROMPT_PACK_V1.md) — pack maître : décision d'architecture, budgets anti-volume, principes anti-hallucination, prompts P00 à P18.
2. [`WATER_SOURCE_REGISTRY_SEED_V1.csv`](./WATER_SOURCE_REGISTRY_SEED_V1.csv) — registre des 17 portails/sources fourni par l'opérateur.
3. [`CURRENT_TASK.md`](./CURRENT_TASK.md) — prompt P00 isolé, prêt à l'emploi.
4. [`PROJECT_STATE.yaml`](./PROJECT_STATE.yaml) — état machine-readable du chantier.
5. [`ACCEPTANCE_GATES.md`](./ACCEPTANCE_GATES.md) — checklist à valider avant de passer au prompt suivant.

## Autres documents de pilotage

- [`PROMPT_LEDGER.csv`](./PROMPT_LEDGER.csv) — suivi PR/merge/preview par prompt (P00 à P18).
- [`DECISION_LOG.md`](./DECISION_LOG.md) — décisions actées au démarrage du chantier.
- [`RISK_REGISTER.md`](./RISK_REGISTER.md) — risques initiaux identifiés.
- [`prompts/`](./prompts/) — chaque prompt P00 à P18 extrait sans altération du pack maître, un fichier par prompt.
