# Water Intelligence — Découvrabilité

Branche : `feat/water-intelligence-discoverability`

Le module était **en production et introuvable**. Ce document dit pourquoi, ce
qui a été ajouté, et ce qui reste inchangé — c'est-à-dire tout le reste.

---

## 1. Pourquoi le module existait sans apparaître

`/water-intelligence`, `/water` et `/water/decision` répondaient toutes les
trois. Aucune ne figurait dans une navigation :

- `NAV_LINKS` (barre publique) contenait `/materials`, pas `/water-intelligence` ;
- le pied de page ne mentionnait ni l'un ni l'autre ;
- `app/sitemap.ts` ne déclarait **ni** `/materials` **ni** `/water-intelligence` ;
- `NAV_GROUPS` (barre latérale authentifiée) n'avait aucune entrée hydrique.

On ne pouvait donc y arriver qu'en connaissant l'URL par cœur.

La cause est mécanique, pas éditoriale : les cinq vagues du chantier ont livré
des routes, des contrats et des moteurs, et la navigation appartenait à un autre
périmètre. Personne ne l'a raccordée parce que personne n'en avait la charge.

## 2. La barre publique débordait déjà

`landing-page.tsx` portait ce commentaire, écrit avant cette branche :

> 9 liens text-sm + logo + 2 CTA ≈ 1520px > conteneur 1440px : le header
> débordait (liens sous les boutons).

« Accueil » avait déjà dû sortir du desktop pour que la barre tienne. Ajouter
« Eau & risques hydriques » — le libellé le plus long des dix — aurait ramené le
débordement, en pire.

**Décision :** `Métaux critiques` cesse d'être une entrée de premier niveau et
rejoint `Eau & risques hydriques` sous un menu **`Ressources`**. La barre perd
une entrée au lieu d'en gagner une, et le module devient atteignable en deux
gestes au lieu de zéro.

L'alternative compacte prévue (`Métaux & Eau`) n'a pas été retenue : elle aurait
tenu dans la barre, mais un intitulé qui énumère ses cibles ne survit pas à la
troisième. `Ressources` accueille la suivante sans changer de nom.

## 3. Points d'entrée ajoutés

| Surface | Ajout |
|---|---|
| Barre publique desktop | menu `Ressources` → `/materials` + `/water-intelligence` |
| Barre publique mobile | mêmes entrées, à plat sous un intertitre `Ressources` |
| Page d'accueil | section `Intelligence environnementale`, deux cartes |
| Pied de page, colonne Produit | `Métaux critiques` et `Eau & risques hydriques` |
| `app/sitemap.ts` | `/materials` et `/water-intelligence` |
| Barre latérale authentifiée | `Eau & stress hydrique` (`/water`) et `Décision hydrique` (`/water/decision`) |
| En-tête du groupe `(app)` | titre et sous-titre de `/water`, qui n'en avait pas |

`/produit` n'a **pas** été touchée : `PRODUCT_MODULES` décrit les huit étapes du
pipeline CSRD (collecte, calcul, audit, rapport, scopes, OTI). Y insérer un
module thématique aurait mélangé deux taxonomies sans rendre service à personne.

## 4. Accessibilité du menu

- ouverture **par bouton**, jamais par survol seul ;
- `aria-expanded`, `aria-haspopup`, `aria-controls` ;
- **Échap** ferme **et rend le focus au déclencheur** ;
- clic extérieur (`pointerdown`) ferme ;
- flèches haut/bas, `Home`/`End` parcourent les entrées ;
- tabuler hors du menu le ferme ;
- **rendu conditionnel** plutôt que masquage CSS : un menu fermé mais présent
  dans le DOM reste tabulable, et l'utilisateur clavier traverserait des liens
  qu'il ne voit pas ;
- aucun paquet ajouté — ni Radix, ni Headless UI ;
- transitions neutralisées sous `prefers-reduced-motion`, et le menu fonctionne
  sans elles.

### Un défaut introduit puis corrigé

`/water` et `/water/decision` forment la première paire parent/enfant de la barre
latérale. `isNavItemActive` marquait actif tout préfixe : sur `/water/decision`,
**les deux entrées s'allumaient**. Une option `exact` a été ajoutée à `NavItem`
et posée sur `/water`. Le comportement de préfixe des autres entrées est
inchangé, et un test le vérifie sur `/resources/exposures`.

## 5. Distinction public / authentifié

La section d'accueil nomme les trois surfaces et leur régime :

| Route | Régime | Dit sur l'accueil |
|---|---|---|
| `/water-intelligence` | public | CTA principal `Explorer Water Intelligence` |
| `/water` | authentifié | `Accéder au cockpit entreprise` — **Connexion requise** |
| `/water/decision` | authentifié | `cockpit décisionnel` — **Connexion requise** |

Sans cette mention, un visiteur cliquant sur `/water` serait renvoyé vers
`/login` sans comprendre pourquoi.

## 6. Textes de statut

Repris mot pour mot du module, et vérifiés par test :

- `Infrastructure opérationnelle`
- `7 sources officielles instrumentées`
- `Licences vérifiées`
- `Données publiques en attente de validation humaine`
- `Stress, sécheresse, nappes, prélèvements, qualité et réglementation`

Ces libellés décrivent l'état de **l'infrastructure**, jamais l'état de l'eau.

### Formulations bannies

Un test échoue si l'une réapparaît : *données en temps réel*, *carte actuellement
alimentée*, *surveillance active*, *conformité automatique*, *couverture mondiale
complète*. Aucun chiffre hydrique n'est affiché — un test refuse toute valeur
suivie de `m³`, `%`, `mm`, `L/s` ou `hm³` sur la carte Eau.

Une carte d'accueil est exactement l'endroit où « 7 sources officielles » se lit
comme « 7 sources affichées » si rien ne l'en empêche.

## 7. Ce qui reste non publié

**Rien n'a changé de ce côté, et c'est le point.**

- Les sept sources ont une licence vérifiée ; **aucune décision de publication
  n'est signée**. Toutes restent exclues du snapshot public.
- `WRI_AQUEDUCT` reste `decision_refused` — l'enregistrement WRI n'est pas fait.
- `COPERNICUS_EDO` reste `decision_refused` — décodage raster reporté.
- Les quatre sources Hub'Eau et EEA WEI+ restent
  `decision_proposed_not_reviewed`.
- Le registre juridique nomme neuf textes et n'en instruit aucun.
- Aucun connecteur, aucune règle juridique, aucune migration n'a été touché.
- Les dix formulaires de [`HUMAN_DECISION_PACKET.md`](./HUMAN_DECISION_PACKET.md)
  restent **non signés**, et la checklist visuelle **non cochée**.

Rendre un module visible n'autorise aucune donnée. Cette branche déplace des
liens ; elle ne publie rien.

## 8. Tests

`apps/carbon/tests/water-intelligence-discoverability.test.tsx` — 31 contrôles.
Le menu est **réellement monté** (React 19 `act` + `createRoot`) : « ouvre au
clavier », « ferme avec Échap », « rend le focus au déclencheur » et « ne laisse
aucun lien tabulable fermé » sont des affirmations sur le comportement.

`apps/carbon/e2e/public/discoverability.spec.ts` — parcours réel dans le
navigateur, sur les six projets de la matrice publique : section rendue, CTA
suivi jusqu'à `/water-intelligence`, menu ouvert au clavier seul puis navigué à
la flèche, tiroir mobile, pied de page, `sitemap.xml`, `/materials` toujours en
200, et aucun `company_id` / `tenant_id` / `site_id` dans un href public.

| Suite | Résultat |
|---|---|
| Vitest | **690 / 690** |
| Playwright public | **174 passés, 6 ignorés** (les 6 sont les tests de dropdown sur projets mobiles, où il n'existe pas) |
| TypeScript | 0 erreur |
| ESLint | 0 erreur (24 avertissements préexistants) |
| Build Next.js | succès — `/`, `/materials`, `/water-intelligence`, `/water`, `/water/decision` émises |

## 9. Limites

- **Aucune vérification visuelle humaine n'a été réalisée** sur cette branche non
  plus. Les tests contrôlent la structure et les cibles, pas l'apparence. La
  cohérence visuelle revendiquée (fond clair, vert/cyan, mêmes rayons et
  espacements) vient de la réutilisation des classes existantes et de `Reveal` —
  elle n'a pas été constatée à l'œil.
- Le menu déroulant n'existe qu'au-delà du point de rupture `lg` ; en dessous,
  les deux entrées sont listées à plat. Deux implémentations, un seul jeu de
  cibles (`RESOURCE_MENU_ENTRIES`) — une seconde liste finirait par diverger.
- La section d'accueil est en Server-rendered client component, comme le reste de
  `landing-page.tsx` : elle hérite du poids de ce fichier, elle ne l'aggrave pas.
- Aucune analytique n'est posée sur les nouveaux liens : rien ne mesurera encore
  si le module est réellement trouvé. C'est précisément la donnée que P18 exige
  avant de rouvrir la question de l'URL publique.
