# Water Intelligence — Index de pilotage

Point d'entrée court du chantier CarbonCo Water Intelligence.

## Mission active

**Wave E-Interface & Closeout — dernière étape du chantier.** La suite n'est pas une vague : c'est une **revue humaine**, puis une décision de production.

Le chantier est passé d'une exécution prompt par prompt (P00 à P18) à un
regroupement en cinq vagues, décrit dans
[`ACCELERATED_CLOSEOUT_PACK_V2.md`](./ACCELERATED_CLOSEOUT_PACK_V2.md).

- P00 à P05, P03B et P03C : **fusionnés**.
- Wave A (P06 EEA/WISE/WEI+ + P09 Copernicus EDO) : **fusionnée** — PR #153,
  merge SHA `e36c97c`. Voir [`handoffs/WAVE_A_EU_CONNECTORS.md`](./handoffs/WAVE_A_EU_CONNECTORS.md).
- Blueprint UX/UI Wave C : **fusionné** — PR #154, merge SHA `a56ab62`.
  Dossier [`ux/`](./ux/), documentaire uniquement.
- Wave B (P07 hydrométrie/piézométrie + P08 prélèvements/qualité) :
  **fusionnée** — PR #155, merge SHA `daaf8f0`. Voir
  [`handoffs/WAVE_B_HUBEAU.md`](./handoffs/WAVE_B_HUBEAU.md).
- Wave C (P10 read model + P11 carte + P12 contenus) : **fusionnée** — PR #156,
  merge SHA `eb2a898`. Voir [`handoffs/WAVE_C_PUBLIC_DATA_PRODUCT.md`](./handoffs/WAVE_C_PUBLIC_DATA_PRODUCT.md).
- Wave D (P13 conformité + P14 synergies + P15 finance) : **fusionnée** — PR #157,
  merge SHA `618a222`. Voir [`handoffs/WAVE_D_DECISION_LAYER.md`](./handoffs/WAVE_D_DECISION_LAYER.md).
  Trois moteurs livrés, purs et testés ; le registre juridique nomme neuf textes
  et n'en instruit aucun.
- Wave E-Core (E0 pilotage, E1 vérité de la page publique, E2 contrats
  juridiques, E3 endpoints, E5 isolation tenant) : **fusionnée** — PR #158,
  merge SHA `7ea6772`. Le test tenant A/B contre un vrai PostgreSQL y
  a trouvé un défaut d'isolation réel, corrigé dans la même PR.
- Wave E-Interface & Closeout (E4 cockpit authentifié, E6 QA/E2E/sécurité,
  E7 Preview et dossier final) : **en cours** — branche
  `feat/water-intelligence-wave-e-ui-closeout`.

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
- [`contracts/`](./contracts/) — contrats de données P02, manifeste de fixtures, et les trois documents canoniques de la Wave D (`REGULATORY_REGISTRY.json`, `MODULE_BRIDGES.json`, `FINANCIAL_ENGINE.json`). Ces trois-là sont **émis par le backend** et miroités à l'octet près dans `apps/carbon` : les régénérer, jamais les éditer à la main.
- [`ux/`](./ux/) — blueprint UX/UI de la Wave C (PR #154). **Documentaire : ne pas modifier hors d'une vague qui le prévoit explicitement.**
- [`prompts/`](./prompts/) — chaque prompt P00 à P18 extrait sans altération du pack maître, un fichier par prompt.
