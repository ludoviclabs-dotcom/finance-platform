# Water Intelligence — Index de pilotage

Point d'entrée court du chantier CarbonCo Water Intelligence.

## Mission active

**Wave B — Famille Hub'Eau (MACRO-PROMPT B).**

Le chantier est passé d'une exécution prompt par prompt (P00 à P18) à un
regroupement en cinq vagues, décrit dans
[`ACCELERATED_CLOSEOUT_PACK_V2.md`](./ACCELERATED_CLOSEOUT_PACK_V2.md).

- P00 à P05, P03B et P03C : **fusionnés**.
- Wave A (P06 EEA/WISE/WEI+ + P09 Copernicus EDO) : **PR ouverte, non
  fusionnée** — voir [`handoffs/WAVE_A_EU_CONNECTORS.md`](./handoffs/WAVE_A_EU_CONNECTORS.md).
- Wave B : **à ne pas démarrer** avant revue humaine et fusion de Wave A.

## Frontière de routes (rappel)

- `/water` reste le cockpit entreprise authentifié **existant**, inchangé.
- `/water-intelligence` est la route **publique** cible du nouveau module.

## Documents à lire, dans l'ordre

1. [`WATER_INTELLIGENCE_PROMPT_PACK_V1.md`](./WATER_INTELLIGENCE_PROMPT_PACK_V1.md) — pack maître : décision d'architecture, budgets anti-volume, principes anti-hallucination, prompts P00 à P18.
2. [`ACCELERATED_CLOSEOUT_PACK_V2.md`](./ACCELERATED_CLOSEOUT_PACK_V2.md) — pack accéléré : regroupement des prompts restants en cinq macro-PR (Waves A à E).
3. [`WATER_SOURCE_REGISTRY_SEED_V1.csv`](./WATER_SOURCE_REGISTRY_SEED_V1.csv) — registre des 17 portails/sources fourni par l'opérateur.
4. [`CURRENT_TASK.md`](./CURRENT_TASK.md) — mission suivante isolée, prête à l'emploi.
5. [`PROJECT_STATE.yaml`](./PROJECT_STATE.yaml) — état machine-readable du chantier.
6. [`ACCEPTANCE_GATES.md`](./ACCEPTANCE_GATES.md) — checklist à valider avant de passer à la mission suivante.

## Autres documents de pilotage

- [`PROMPT_LEDGER.csv`](./PROMPT_LEDGER.csv) — suivi PR/merge/preview par prompt (P00 à P18).
- [`DECISION_LOG.md`](./DECISION_LOG.md) — décisions actées, du démarrage à la vague en cours.
- [`RISK_REGISTER.md`](./RISK_REGISTER.md) — risques identifiés, résolus et ouverts.
- [`handoffs/`](./handoffs/) — rapport de passation par prompt et par vague : ce qui est livré, ce qui ne l'est pas, les limites et les reliquats.
- [`contracts/`](./contracts/) — contrats de données P02 et manifeste de fixtures.
- [`prompts/`](./prompts/) — chaque prompt P00 à P18 extrait sans altération du pack maître, un fichier par prompt.
