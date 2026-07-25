> **Aucune mission active.**
> Le chantier Water Intelligence attend une **revue humaine**, puis une décision
> de production. Il n'y a pas de vague suivante à préparer.

# Revue humaine — état d'entrée

**Branche :** `feat/water-intelligence-wave-e-ui-closeout`
**PR :** #159 — **ouverte en Draft, non fusionnée**
**Base :** `master` @ `7ea6772` (PR #158, Wave E-Core).

---

## Ce qui est livré

| Vague | Statut | PR | Merge SHA |
|---|---|---|---|
| Wave A — connecteurs européens | fusionnée | #153 | `e36c97c` |
| Blueprint UX/UI | fusionné | #154 | `a56ab62` |
| Wave B — famille Hub'Eau | fusionnée | #155 | `daaf8f0` |
| Wave C — produit public | fusionnée | #156 | `eb2a898` |
| Wave D — couche décisionnelle | fusionnée | #157 | `618a222` |
| Wave E-Core — E0/E1/E2/E3/E5 | fusionnée | #158 | `7ea6772` |
| Wave E-Interface & Closeout | **Draft** | **#159** | — |

Les quatre endpoints de la Wave E-Core ont désormais un consommateur : la route
authentifiée `/water/decision`. Détail complet et vérifié :
[`FINAL_TRACEABILITY.md`](./FINAL_TRACEABILITY.md).

Aucune migration dans la PR #159 ; la dernière reste `043`.

## Ce qu'un humain doit faire maintenant

### 1. Regarder les pages

Aucune vérification visuelle n'a été réalisée. Aucune page n'a été affichée,
aucune capture n'existe. Les tests contrôlent la structure du DOM et des ratios
de contraste calculés — jamais une apparence.

La checklist est livrée **non cochée** dans
[`HUMAN_DECISION_PACKET.md`](./HUMAN_DECISION_PACKET.md), formulaire 9.

### 2. Décider

Dix formulaires **non signés** : publication de chacune des sept sources,
désignation d'un réviseur juridique, validation éditoriale, hypothèses
financières, politique E2E, vérification visuelle, décision de production.

### 3. Optionnel — exécuter les E2E authentifiés

Statut : `prepared_not_executed_environment_not_configured`. Le workflow, sa
configuration et neuf scénarios sont écrits ; rien n'a tourné. L'environnement
`e2e-preview` et ses secrets n'existent pas, et n'ont volontairement pas été
créés par le modèle. Procédure :
[`E2E_AUTHENTICATED_RUNBOOK.md`](./E2E_AUTHENTICATED_RUNBOOK.md).

## Contraintes constantes, tenues

- aucune donnée tenant sur `/water-intelligence` ;
- aucune source approuvée par le modèle ;
- aucun texte juridique instruit ;
- aucune probabilité ni taux d'actualisation par défaut ;
- aucun score composite ;
- aucune migration ;
- **aucune dépendance ajoutée** ;
- aucun appel externe au runtime ni en test ;
- aucune fixture présentée comme donnée réelle.

## Ce que le modèle ne peut pas faire, et n'a pas prétendu faire

- **Cocher une vérification visuelle.** Les Previews frontales sont derrière le
  SSO de l'équipe Vercel : l'état des déploiements est vérifiable par API, le
  rendu ne l'est pas. Aucune tentative d'authentification n'a été faite.
- **Exécuter les E2E authentifiés** tant que l'environnement GitHub et ses
  secrets n'existent pas — les créer est une décision humaine.
- **Signer une décision de publication**, désigner un réviseur juridique, ou
  fournir une hypothèse financière.
- **Fusionner la PR #159** ou promouvoir quoi que ce soit en production.

Un rapport qui prétendrait le contraire serait faux, et c'est le seul défaut
que ce chantier n'a jamais toléré.

## Deux constats laissés à un arbitrage humain

1. `--color-muted-foreground` est employée dans 37 fichiers et déclarée nulle
   part : la hiérarchie « texte atténué » est perdue dans toute l'application,
   `/water` compris. Le correctif tient en une ligne, mais il change l'apparence
   de 36 pages hors du périmètre audité, qu'aucun humain n'a regardées. Le
   contraste n'en souffre pas — il est plus élevé. Défaut cosmétique, correction
   à décider.
2. `/water/decision` embarque 265 kB de zod pour valider les réponses à
   l'exécution. Le retirer supprimerait la garantie de contrat posée par la
   Wave E. Mesuré et consigné, pas tranché en douce.
