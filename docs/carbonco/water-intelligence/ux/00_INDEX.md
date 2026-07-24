# Water Intelligence — dossier UX / UI

Documents de conception de l'interface publique `/water-intelligence`. **Documentaire uniquement** : aucun de ces fichiers ne décrit du code livré, et aucun ne modifie l'état de pilotage du chantier (`PROJECT_STATE.yaml`, `PROMPT_LEDGER.csv`, `CURRENT_TASK.md` restent la seule source de vérité sur l'avancement).

## Contenu

| Document | Objet |
|---|---|
| [`WAVE_C_UX_UI_BLUEPRINT.md`](./WAVE_C_UX_UI_BLUEPRINT.md) | Blueprint maître de Wave C : architecture de l'information, parcours, sections, matrice données → composant, états, design tokens, interactions de la carte, animations, accessibilité, performance, dépendances Wave B, réutilisation |
| [`WAVE_C_WIREFRAMES.md`](./WAVE_C_WIREFRAMES.md) | Wireframes textuels desktop / tablette / mobile des dix sections et des deux vues de la carte |
| [`WAVE_C_COMPONENT_SPECS.md`](./WAVE_C_COMPONENT_SPECS.md) | Spécification des 16 composants et critères d'acceptation de chacun |

Ordre de lecture : blueprint → wireframes → specs.

## Portée

- **Wave C** = P10 (read model public) + P11 (carte multi-échelle) + P12 (contenus sourcés), plus les deux *previews* non fonctionnelles de Wave D (conformité P13, passerelle financière P15).
- Ce dossier **ne lance pas** Wave C et ne préempte aucune décision de séquencement.

## Ce que ces documents ne contiennent pas

Aucun fait, aucun chiffre, aucune date, aucun statut juridique, aucune donnée géographique. Toute valeur y apparaît sous forme d'emplacement (`{champ}`, `n.c.`, `—`), conformément à la règle 5 de l'en-tête invariant du pack maître et à la décision P04B.

Les seules valeurs concrètes citées sont des constantes **déjà présentes dans le dépôt** : tokens `--wi-*` de `apps/carbon/app/water-intelligence/water-intelligence.css`, budgets de [`../contracts/P02_DATA_CONTRACTS.md`](../contracts/P02_DATA_CONTRACTS.md) §7, seuil `STALE_AFTER_DAYS` de `apps/api/services/intelligence/freshness_service.py`, et l'échelle typographique du shell P04.

## Frontière rappelée

`/water` reste le cockpit entreprise authentifié, inchangé. `/water-intelligence` est la surface publique. Aucun de ces documents ne propose de modifier le cockpit, de faire remonter une donnée tenant vers la surface publique, ni d'introduire un score hydrique composite — voir [`../01_ADR_SURFACES_AND_ROUTES.md`](../01_ADR_SURFACES_AND_ROUTES.md).
