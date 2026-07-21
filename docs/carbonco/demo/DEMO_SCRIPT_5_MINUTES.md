# DEMO_SCRIPT_5_MINUTES — mode « guided » (~5 min, 10 étapes)

> **100 % FICTIF · IA SIMULÉE · ZÉRO APPEL EXTERNE.** Script complet du mode `guided` :
> parcours pas-à-pas des **dix étapes**, avec points de discours, explication déterministe
> des **quatre cas de revue IA**, et moments « Explorer dans l'application ».
> Chiffres canoniques : [`ASTERION_SCENARIO.md`](./ASTERION_SCENARIO.md).

## Mode d'emploi

- Route : **`/demo/asterion-motion`**, mode **guided**.
- **Flèche droite / espace** = étape suivante ; **flèche gauche** = étape précédente ;
  **R** = reset ; **Échap** = quitter le tour.
- Chaque étape propose un bouton **« Explorer dans l'application »** qui ouvre la vraie page
  du tenant démo (nécessite un seed préalable — cf.
  [`DEMO_PRESENTER_GUIDE.md`](./DEMO_PRESENTER_GUIDE.md)). Le cockpit figé, lui, fonctionne
  hors-ligne sans seed.
- Durée indicative **~5 min**. Timings cumulés donnés à titre de rythme, pas de contrainte.

---

## 1 · Situation — `0:00 → 0:25`
**Focus :** carte d'identité Asterion, compteur *12 000 moteurs / an*.
**Discours :**
> « Asterion Motion, équipementier fictif, assemble douze mille moteurs E-Drive X4 par an —
> un moteur synchrone à aimants permanents. Sous CSRD, quatre fronts : climat, ressources
> critiques, eau, double matérialité. Nous allons dérouler toute la chaîne CarbonCo. »

**À souligner :** tout est fictif et cohérent ; l'objectif est de montrer la *méthode*.
**Explorer :** `/dashboard` — le tableau de bord réel du tenant démo.

## 2 · Import des achats — `0:25 → 0:50`
**Focus :** import, total *5,8 M€*, nomenclature E-Drive X4, badges de statut par ligne.
**Discours :**
> « Point de départ : cinq virgule huit millions d'euros d'achats. La nomenclature du moteur
> — aimants NdFeB, cuivre, aluminium — est rattachée. Regardez : chaque ligne porte déjà une
> source, une date et un statut. Rien n'entre sans provenance. »

**À souligner :** les aimants sont `estimated`, le cuivre et l'aluminium `manual` — la
distinction de statut existe **dès l'import**.
**Explorer :** `/fournisseurs/scope3`.

## 3 · Scope 3 — hotspots — `0:50 → 1:25`
**Focus :** barres de hotspots ; *Aimants* surlignés, badge *61,8 %*.
**Discours :**
> « Trois mille quatre cent quatre-vingts tonnes de CO2 sur les achats. Un hotspot domine :
> les aimants, soixante et un virgule huit pour cent. Ce pourcentage est un **calcul
> déterministe** du moteur Scope 3 — pas une estimation d'IA. En ordre de grandeur, cela
> attribue environ deux mille cent cinquante tonnes aux seuls aimants. »

**À souligner :** le hotspot oriente toute la suite (CRMA, IRO). La part est *dérivée*, pas
saisie.
**Explorer :** `/scopes`.

## 4 · CRMA — matières critiques — `1:25 → 1:55`
**Focus :** fiche criticité NdFeB, compteur *dépendance 92 %* avec pastille `estimated`.
**Discours :**
> « Les aimants NdFeB sont critiques *et* stratégiques au sens du règlement CRMA 2024. La
> dépendance aux terres rares lourdes est **estimée à quatre-vingt-douze pour cent**. Notez
> le mot : *estimée*. La plateforme ne la maquille jamais en chiffre vérifié — la pastille
> reste `estimated`. »

**À souligner :** *estimé ≠ vérifié* — ce sera décisif à l'étape IA (cas n°2).
**Explorer :** `/crma`.

## 5 · Scope 2 — double reporting — `1:55 → 2:25`
**Focus :** colonnes *LB 1 860* / *MB 1 090*, jauge *couverture 54 %*.
**Discours :**
> « Scope 2 en double comptage. Location-based : mille huit cent soixante tonnes, le mix
> réseau. Market-based : mille quatre-vingt-dix, après instruments contractuels. Le
> market-based est plus bas parce que la couverture bas-carbone atteint cinquante-quatre pour
> cent. Ces résultats sont déterministes — l'IA ne les recalculera jamais. »

**À souligner :** MB < LB est *cohérent* avec 54 % de couverture ; c'est aussi le calcul que
l'IA citera pour le statut `supported` (voir §Cas IA).
**Explorer :** `/scopes`.

## 6 · Eau & nature — `2:25 → 2:55`
**Focus :** prélèvement *72 000 m³*, carte de stress hydrique *élevé*, indicateur *confiance
0,81*, repère TNFD.
**Discours :**
> « Soixante-douze mille mètres cubes prélevés. Le site siège est en stress hydrique élevé,
> avec une confiance de zéro virgule quatre-vingt-un. Deux dimensions séparées : le
> **niveau de risque** d'un côté, la **confiance** du screening de l'autre. On ne confond
> jamais les deux. »

**À souligner :** *risque ≠ confiance* — principe de gouvernance affiché tel quel.
**Explorer :** `/water`.

## 7 · IRO — double matérialité — `2:55 → 3:25`
**Focus :** morphing hotspot aimants → carte IRO « Dépendance critique aux aimants terres
rares (E-Drive X4) » ; panneaux *Impact* (échelle 4 / portée 3 / irrémédiabilité 3) et
*Finance* (exposition *1,4 M€*, `estimated`) **séparés**.
**Discours :**
> « Le hotspot devient un sujet de double matérialité : un IRO candidate, "dépendance
> critique aux aimants terres rares". Côté finance, exposition indicative d'un virgule
> quatre million d'euros — une fourchette, jamais une certitude. Impact et finance restent
> deux panneaux : aucun score de matérialité unique. »

**À souligner :** l'IRO est le **sujet** de la revue IA qui suit (UC-1).
**Explorer :** `/iro`.

## 8 · Revue IA citée — `3:25 → 4:20` — *cœur de la démonstration*
**Focus :** la **trace fonctionnelle** défile, puis les **quatre cartes de claims**.
**Discours :**
> « L'assistant IA prend l'IRO en entrée. Regardez la trace — ce sont des étapes
> *fonctionnelles*, jamais un raisonnement interne : il sélectionne les preuves du tenant, il
> **écarte** ce qui est confidentiel ou sous licence sans droit d'affichage, il résout chaque
> citation vers une preuve réelle, puis il confronte chaque affirmation. Le verdict de chaque
> affirmation est **calculé par le backend**, pas déclaré par le modèle. »

Enchaîner sur les quatre cartes (détail déterministe au §« Les 4 cas IA » ci-dessous) :
soutenu, partiellement soutenu, contredit, non étayé.
**À souligner :** deux artefacts sont **exclus** dans la trace — la grille tarifaire
(*sensibilité*) et le benchmark (*licence*) : la minimisation des preuves est visible.
**Explorer :** `/iro` (onglet revue IA).

## 9 · Décision humaine — `4:20 → 4:45`
**Focus :** `ReviewGate` — *Accepter / Rejeter / Modifier* + justification.
**Discours :**
> « Rien n'est automatique. Le relecteur accepte, rejette ou modifie chaque affirmation, avec
> justification. Accepter déclenche un geste métier — créer un IRO candidate — mais jamais une
> publication. La décision de matérialité, elle, reste exclusivement humaine. »

**À souligner :** la gate est un vrai composant produit ; l'IA n'a **aucun** pouvoir d'écriture
métier.
**Explorer :** `/iro`.

## 10 · Evidence Pack — `4:45 → 5:15`
**Focus :** dossier auditable, colonnes *source · date · statut · méthode* ; ouverture du
`SourceDrawer` sur une citation.
**Discours :**
> « Tout ce qu'on vient de voir se referme ici : un dossier auditable. Chaque chiffre remonte
> à sa preuve, avec sa date, son statut et sa méthode. Estimé n'est pas vérifié ; risque n'est
> pas confiance ; l'IA cite, l'humain décide. C'est la promesse de CarbonCo Intelligence. »

**À souligner :** cliquer une citation ouvre la preuve — la boucle preuve↔chiffre est fermée.
**Explorer :** `/intelligence/sources`.

---

## Les 4 cas de revue IA — pourquoi chaque statut, déterministiquement

Les statuts ne sont **jamais déclarés par le modèle** : ils sont calculés par
`entailment_service` à partir des preuves seedées. Trois viennent de **UC-1 (revue de
l'IRO)** ; le quatrième de **UC-2 (explication de calcul Scope 2)**.

**Cas 1 — « Les aimants représentent 61,8 % du Scope 3 » → `supported`.**
Voie **UC-2** : l'affirmation cite le **résultat de calcul déterministe** (`calc_result`).
Toutes les citations sont résolues, exactes et fraîches → corroboration exacte. C'est la
**seule** voie qui produit `supported` dans le provider demo : un statut « soutenu » exige une
**explication de calcul**, pas une simple observation. (Concrètement, l'enveloppe de calcul
citée est celle du Scope 2 market-based, cohérente avec la couverture 54 %.)

**Cas 2 — « La dépendance aux terres rares lourdes dépasse 90 % » → `partially_supported`.**
Voie **UC-1** : l'affirmation cite l'observation `heavy_rare_earth_dependency_pct = 92 %`,
de statut **`estimated`** (`artifact-dependency-study`). La citation est bien résolue, mais la
preuve est **estimée**, non corroborée par un calcul déterministe → le maximum atteignable est
**partiel**. *Estimé ≠ vérifié*, appliqué au statut de support.

**Cas 3 — « Le contenu recyclé déclaré est de 80 % » → `contradicted`.**
Voie **UC-1** : l'affirmation cite l'audit masse-bilan tiers (`artifact-recycled-audit`) qui
**prouve 35 %** (statut `verified`), face à une déclaration fournisseur de 80 %. L'écart
chiffré déclenche un **flag de contradiction** + citation résolue → **contredit**. La
plateforme n'aplanit pas le conflit : elle le **montre**.

**Cas 4 — « Un fournisseur alternatif est qualifiable sous 90 jours » → `unsupported`.**
Voie **UC-1** : aucune référence interne ne soutient l'affirmation (aucun marqueur de
citation). Le pipeline ne trouve rien à résoudre → **non étayé**. L'IA le signale au lieu de
l'inventer.

En complément, l'assistant émet des **questions de revue** (« Quelle est la source et la date
de l'estimation 92 % ? », « La méthode du taux recyclé est-elle auditée ? ») et des
**suggestions d'action** (« diversifier la source d'aimants », « documenter la méthode du taux
recyclé »), toutes en `SUGGESTION`, jamais promues sans geste humain.

## Points de gouvernance à marteler

- **L'IA est consultative** : elle cite et propose ; **l'humain décide** (gate obligatoire).
- **Chaque valeur** = source + date + statut + méthode.
- **Estimé ≠ vérifié** (cas 2), **risque ≠ confiance** (étape 6), **contradiction montrée,
  pas masquée** (cas 3), **non-preuve assumée** (cas 4).
- **Zéro modèle payant, zéro réseau, zéro activation live.** Reset borné au tenant démo.

*Fin de DEMO_SCRIPT_5_MINUTES.md.*
