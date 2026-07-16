# Prompt Claude Code — PR-01 `fix/materials-data-trust`

Tu es lead engineer et data product architect sur le monorepo `finance-platform`.
Tu dois travailler uniquement sur la PR-01 « materials data trust ».
Ne commence aucun autre epic. Ne committe, ne pousse et ne crée aucune PR sans validation explicite.

## Objectif

Aligner entièrement les promesses publiques de `/materials` sur le fonctionnement réel, corriger le modèle critique/stratégique et rendre la qualité des données visible.

## Inspection obligatoire avant modification

- `apps/carbon/app/materials/page.tsx`
- `apps/carbon/lib/crm/dataLoader.ts`
- `apps/carbon/data/crm_full_34_snapshot_*.json`
- `apps/carbon/data/crm_price_history.json`
- `.github/workflows/materials-price-history.yml`
- `apps/carbon/scripts/append-price-history.mjs`
- tous les composants `apps/carbon/components/materials`
- tests Vitest et Playwright liés à materials, landing et feature registry
- conventions de badges UI existantes

## Étape 1 — Diagnostic

Produis d’abord un diagnostic précis :

- ce qui est statique ;
- ce que fait réellement le workflow hebdomadaire ;
- quelles assertions publiques sont trop fortes ;
- où `criticality_eu`, `criticality_score` et `china_dominant` sont utilisés ;
- combien de composants et tests seront touchés.

Termine ce diagnostic avant de modifier le code.

## Étape 2 — Modèle

Remplace le statut exclusif `criticality_eu` par :

```ts
is_critical_eu: boolean;
is_strategic_eu: boolean;
regulation_version: string | null;
```

Toutes les matières stratégiques doivent avoir `is_critical_eu=true`.

Renomme `criticality_score` en :

```ts
carbonco_supply_risk_score: number | null;
score_methodology_version: string | null;
score_confidence: number | null;
```

Le score ne doit jamais être présenté comme officiel UE.

Ne change aucune valeur numérique du snapshot sauf transformation de structure nécessaire.

Ne conserve pas `china_dominant` comme source de vérité. Dérive le statut affiché depuis `top_producers` pour l’étape actuellement disponible et affiche un avertissement : le snapshot ne distingue pas encore extraction, raffinage et transformation.

## Étape 3 — Transparence

Remplace les formulations publiques trop fortes par :

- Snapshot de démonstration ;
- Valeurs estimées ;
- Non destiné à un usage normatif ;
- Date du snapshot ;
- L’historique local est enrichi uniquement lorsqu’un nouveau snapshot daté est publié.

Rends `methodology_note` visible dans la page.

La phrase « aucune donnée inventée » doit disparaître tant que les valeurs restent `estimated`.
La phrase « mise à jour automatique des sources chaque lundi » doit disparaître.

## Étape 4 — Prix

Une série `price_history` avec moins de deux points indépendamment datés ne doit pas être présentée comme une tendance historique.

Aucun graphique ou badge ne doit simuler une série.

Le `trend_3m_pct` du snapshot peut être affiché uniquement comme estimation du snapshot, avec badge `ESTIMATED`, jamais comme historique observé si la série ne le permet pas.

## Étape 5 — Composants

Crée ou réutilise des composants accessibles :

- `DataStatusBadge`
- `MethodBadge` si nécessaire
- `StalenessWarning` si nécessaire

États : `VERIFIED`, `ESTIMATED`, `MANUAL`, `STALE`.

Adapte :

- hero ;
- snapshot banner ;
- filtres ;
- tableaux ;
- cartes ;
- treemap ;
- alertes ;
- dépendance Chine ;
- métadonnées si nécessaire.

## Étape 6 — Tests

Ajoute ou actualise les tests pour garantir :

- stratégique implique critique ;
- les filtres stratégique et critique ne sont pas mutuellement exclusifs ;
- score renommé partout ;
- `methodology_note` visible ;
- aucun texte de mise à jour automatique externe ;
- aucune tendance historique avec un seul point ;
- badges qualité corrects ;
- page statiquement rendable ;
- accessibilité de base.

## Contraintes

- TypeScript strict ;
- aucun `any` nouveau ;
- aucune dépendance supplémentaire sans justification ;
- aucun appel API runtime ;
- aucune donnée externe ajoutée ;
- aucun changement de positionnement global de CarbonCo ;
- préserver le responsive ;
- pas de commit ni de push.

## Commandes à exécuter

```bash
git diff --check
npm --prefix apps/carbon run lint
npm --prefix apps/carbon run test
npm --prefix apps/carbon run build
```

## Compte rendu final

Retourne :

1. diagnostic initial ;
2. fichiers modifiés ;
3. modèle avant/après ;
4. tests ajoutés ;
5. commandes et résultats ;
6. risques ou hypothèses restantes.

Puis arrête-toi.
