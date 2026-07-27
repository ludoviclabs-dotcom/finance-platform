# X4A — Attributions canoniques et fraîcheur des trois sources candidates

**Statut : complément de X4A. Aucune décision n'est rendue, aucune donnée n'est
publiée, aucun code n'est modifié.**

Ce document solde deux des six points laissés ouverts par
[X4_PUBLICATION_DECISION_PACKET.md](X4_PUBLICATION_DECISION_PACKET.md) :

- **§3.2** — deux libellés d'attribution coexistaient dans le dépôt, aucun
  n'étant propre au jeu de données ;
- **§3.4** — la cadence de mise à jour côté source n'était documentée pour
  aucune des trois sources.

Il les solde **sur le plan documentaire uniquement**. Les formulaires du §5 du
paquet restent non signés, le registre
`services/water_intelligence/publication_decisions.py` reste inchangé (les sept
sources demeurent `proposed`/`refused`), et le snapshot public reste vide.

**Un écart est remonté et non résolu** : la cadence BNPE n'a pas pu être
vérifiée comme mensuelle, et un relevé officiel la donne annuelle (§3).

---

## 1. Attributions canoniques, une par jeu de données

### 1.1 Ce qui est remplacé, et pourquoi

Les deux libellés préexistants sont conservés en l'état dans le code — X4A ne
modifie aucun connecteur — mais **aucun des deux n'est publiable tel quel** :

| Origine | Défaut |
|---|---|
| `hubeau_transport.attribution()` | Cite les trois éditeurs de la plateforme (OFB, SCV, BRGM) **indistinctement**, pour les trois jeux. Un jeu piézométrique ADES n'est pas produit par le Service Central Vigicrues ; l'énumération globale attribue à chaque jeu des producteurs qui ne le concernent pas. |
| `staging_rehearsal.ATTRIBUTION` | Cite la plateforme (`Hub'Eau / eaufrance.fr`) **sans aucun producteur**. La Licence Ouverte impose de citer l'auteur du jeu de données ; nommer le point d'accès ne le fait pas. |

Les trois libellés ci-dessous corrigent les deux défauts à la fois : ils
distinguent **le point d'accès** (Hub'Eau, et l'API précise), **le système
d'information source** (ADES, Naïades, BNPE) et **les producteurs ou
contributeurs** réellement concernés par ce jeu — sans désigner l'OFB, le BRGM
ou le SCV comme producteur unique, ce qu'aucune preuve du dossier n'établit.

### 1.2 Les trois libellés

**`HUBEAU_ADES`**

```text
Source : Hub'Eau — API Piézométrie. Données issues d'ADES et des partenaires
du Système d'information sur l'eau. Licence Ouverte / Etalab 2.0.
Consultées le <date>.
```

**`HUBEAU_QUALITE_SURFACE`**

```text
Source : Hub'Eau — API Qualité des cours d'eau. Données issues de Naïades et
transmises par les Agences de l'eau. Licence Ouverte / Etalab 2.0.
Consultées le <date>.
```

**`HUBEAU_BNPE_PRELEVEMENTS`**

```text
Source : Hub'Eau — API Prélèvements en eau. Données issues de la BNPE et de la
gestion des redevances par les agences et offices de l'eau.
Licence Ouverte / Etalab 2.0. Consultées le <date>.
```

`<date>` est la date de consultation réelle de l'acquisition publiée, jamais une
date d'assemblage ni la date du jour. Pour les acquisitions de référence de X3,
elle vaut **2026-07-26** ; X4B réacquiert, donc X4B la réécrit.

### 1.3 Ces trois libellés sont incomplets au regard de la Licence Ouverte 2.0

La Licence Ouverte / Open Licence 2.0 conditionne la réutilisation à la mention
de la paternité de l'Information : **sa source (a minima le nom du Concédant)
et la date de la dernière mise à jour de l'Information réutilisée**
(<https://www.data.gouv.fr/pages/legal/licences/etalab-2.0>).

Les trois libellés ci-dessus portent une date de **consultation**
(« Consultées le … »). Ce n'est pas la même chose : la date de consultation dit
quand *nous* avons lu, la date de dernière mise à jour dit quand *la source* a
changé pour la dernière fois. `retrieved_on` ne fournit pas le second fait — le
§2 le dit déjà de la fraîcheur, et la conséquence vaut aussi pour l'attribution.

**Conséquence à assumer : en l'état, les trois libellés ne satisfont pas la
condition de paternité de la licence.** Il manque un fait, et ce fait ne
s'invente pas : la date de dernière mise à jour doit être **relevée par jeu**
avant publication, puis portée dans le libellé, la date de consultation étant
conservée à côté comme provenance.

Un quatrième champ est donc ouvert et **non renseigné** :
`source_last_updated_on` (§2.2). Tant qu'il est vide pour une source, le libellé
d'attribution de cette source **n'est pas publiable** — pas parce qu'il est mal
rédigé, mais parce qu'il lui manque une mention exigée par la licence.

La licence admet une seconde voie de conformité : indiquer l'URL pointant vers
l'Information, à condition que la paternité reste effectivement attribuée.
Retenir cette voie plutôt que la date relevée est un choix éditorial — il
appartient au signataire, et il n'est pas fait ici.

### 1.4 Trois précisions qui ne doivent pas se perdre

1. **`license_scope` reste `platform`.** La Licence Ouverte / Etalab 2.0 a été
   relevée au niveau de la plateforme Hub'Eau (Wave B), **pas jeu par jeu**.
   Les trois libellés nomment la licence sans prétendre l'avoir vérifiée sur la
   fiche de chaque jeu. `source_status.py` reste inchangé, et le point §3.3 du
   paquet de décision reste ouvert : ces libellés ne le referment pas.
2. **« Transmises par » et « issues de » ne sont pas « produites par ».**
   Naïades reçoit des données transmises par les Agences de l'eau ; la BNPE
   consolide des données issues de la gestion des redevances par les agences et
   offices de l'eau. Un contributeur supplémentaire est documenté côté BNPE
   (DEAL Mayotte) et n'apparaît pas dans le libellé : celui-ci nomme le
   mécanisme de collecte, pas une liste exhaustive de contributeurs. Si le
   signataire veut une énumération exhaustive, elle doit être relevée jeu par
   jeu avant d'être écrite.
3. **La forme de l'apostrophe est normalisée sur la convention du dépôt**
   (apostrophe droite `'`, comme partout ailleurs dans `docs/carbonco/`). Ce
   détail n'est pas cosmétique : le libellé publié finira comparé **octet pour
   octet** entre le document canonique et son miroir front
   (`TestDocumentParity`). La forme exacte doit donc être figée au moment de la
   signature, pas au moment du commit du snapshot.

### 1.5 Pages officielles utilisées

| Fait | Page |
|---|---|
| API Piézométrie, données ADES, partenaires du système d'information sur l'eau, cadence | <https://hubeau.eaufrance.fr/page/api-piezometrie> |
| API Qualité des cours d'eau, données Naïades transmises par les Agences de l'eau | <https://hubeau.eaufrance.fr/page/api-qualite-cours-deau> |
| Synchronisation continue avec Naïades introduite en v2 de l'API | <https://hubeau.eaufrance.fr/news/nouvelle-version-de-lapi-qualite-des-cours-deau> |
| Mise à disposition en continu des données physico-chimie (Naïades) | <https://www.eaufrance.fr/actualites/naiades-mise-disposition-en-continu-des-donnees-physicochimie-du-bassin-loire-bretagne> |
| API Prélèvements en eau, BNPE, gestion des redevances par les agences et offices de l'eau | <https://hubeau.eaufrance.fr/page/api-prelevements-eau> |
| BNPE — présentation et journal des données diffusées | <https://bnpe.eaufrance.fr/presentation> · <https://bnpe.eaufrance.fr/acces-donnees/journal-donnees-diffusees> |
| Fréquence de mise à jour déclarée du jeu « Prélèvements en eau » (Système d'Information sur l'Eau) | <https://www.data.gouv.fr/datasets/prelevements-en-eau> |
| Licence Ouverte / Open Licence (Etalab) | <https://www.etalab.gouv.fr/licence-ouverte-open-licence> |

## 2. Fraîcheur et temporalité — trois champs distincts, plus celui qu'exige la licence

### 2.1 Pourquoi trois champs et pas un

Une seule « date de fraîcheur » confondrait trois faits sans rapport : la
fréquence à laquelle la source se met à jour, la période que les données
décrivent, et le moment où nous les avons lues. Les trois sont nécessaires, et
aucun ne se déduit des deux autres.

| Champ | Ce qu'il dit | Ce qu'il ne dit pas |
|---|---|---|
| `source_refresh_cadence` | À quelle fréquence la source intègre de nouvelles données | Que **nos** données sont récentes, ni quand la source a changé pour la dernière fois |
| `observed_period` | La période que les observations décrivent | Quand elles ont été publiées |
| `retrieved_on` | Quand nous avons interrogé l'API | Que la source n'a pas changé depuis, ni quand elle a changé avant |

Un **quatrième** champ est exigé, non par la lisibilité mais par la licence :

| Champ | Ce qu'il dit | Pourquoi il est obligatoire |
|---|---|---|
| `source_last_updated_on` | Date de la **dernière mise à jour de l'Information réutilisée**, côté source | Condition de paternité de la Licence Ouverte 2.0 (§1.3). Aucun des trois autres champs ne la porte : une cadence n'est pas une date, et une date de consultation est la nôtre, pas celle de la source. |

### 2.2 Les trois sources

| Source | `source_refresh_cadence` | `observed_period` | `retrieved_on` | `source_last_updated_on` |
|---|---|---|---|---|
| `HUBEAU_ADES` | Intégration **quotidienne** des mises à jour de la base ADES dans l'API — **vérifié** | 2024-01-01 → 2024-03-31 | 2026-07-26 | **NON RELEVÉ** |
| `HUBEAU_QUALITE_SURFACE` | **Synchronisation continue** avec la base Naïades depuis la v2 de l'API — **vérifié** | 2024-01-03 → 2024-01-15 | 2026-07-26 | **NON RELEVÉ** |
| `HUBEAU_BNPE_PRELEVEMENTS` | **NON VÉRIFIÉE** — cf. §3 | 2020-01-01 → 2020-12-31 | 2026-07-26 | **NON RELEVÉ** |

`source_last_updated_on` n'est renseigné pour aucune des trois sources, et
**n'est pas déductible** de ce que le dossier X3 contient : ni le checksum, ni
la période observée, ni la date de consultation ne disent quand le jeu a été mis
à jour pour la dernière fois. Le relever est un geste d'instruction à faire
avant publication — pas un calcul.

`observed_period` de `HUBEAU_QUALITE_SURFACE` est la période **réellement
observée**, plus courte que la fenêtre demandée (2024-01-01 → 2024-03-31) : la
borne de pagination l'a tronquée. C'est la période réelle qui se publie, jamais
la fenêtre demandée.

### 2.3 La règle d'affichage, et l'énoncé qu'elle interdit

Une API fréquemment synchronisée ne rend pas une observation historique
« actuelle ». `HUBEAU_ADES` se met à jour tous les jours **et** ne porte ici que
des mesures de janvier à mars 2024 : les deux énoncés sont vrais ensemble, et
les fusionner en « données à jour » serait faux.

Les trois champs se rendent donc **séparément et toujours ensemble** :

```text
Source synchronisée quotidiennement
Période observée : janvier à mars 2024
Consultée le : 26 juillet 2026
```

```text
Source synchronisée en continu
Période observée : 3 au 15 janvier 2024
Consultée le : 26 juillet 2026
```

```text
Cadence de mise à jour de la source : non vérifiée
Période observée : année 2020
Consultée le : 26 juillet 2026
```

Sont interdits, quelle que soit la mise en page : « données à jour », « données
actuelles », « dernière mise à jour : 26 juillet 2026 » (c'est la date de
consultation, pas celle de la donnée), et l'affichage d'une cadence sans la
période qu'elle accompagne.

## 3. Écart remonté — la cadence BNPE n'est pas mensuelle, et n'est pas vérifiée

La consigne de cette phase annonçait pour la BNPE une **mise à jour mensuelle
documentée**. La vérification ne la confirme pas, et relève un fait contraire :

| Constat | Origine |
|---|---|
| Aucune page officielle relevée n'énonce de cadence **mensuelle** pour l'API Prélèvements en eau ni pour la BNPE | <https://hubeau.eaufrance.fr/page/api-prelevements-eau>, <https://bnpe.eaufrance.fr/presentation> |
| Le jeu « Prélèvements en eau » publié par le Système d'Information sur l'Eau déclare une mise à jour **annuelle** | <https://www.data.gouv.fr/datasets/prelevements-en-eau> |
| L'API elle-même n'accepte qu'**une année par requête** (`annee=<AAAA>`) ; `annee_min`/`annee_max` sont ignorés en silence | Vérifié en direct en X1, corrigé en X2A — cf. `RISK_REGISTER.md` et [X2A_SCHEMA_REMEDIATION_HANDOFF.md](X2A_SCHEMA_REMEDIATION_HANDOFF.md) |

Le grain annuel de la donnée et une cadence de publication annuelle sont
cohérents entre eux ; une cadence mensuelle ne l'est avec ni l'un ni l'autre.

**Rien n'est tranché ici.** Écrire « mise à jour mensuelle » sur la foi de la
consigne reproduirait exactement le défaut que le §3.4 du paquet de décision
dénonce — publier une fraîcheur non relevée. `source_refresh_cadence` de
`HUBEAU_BNPE_PRELEVEMENTS` reste donc **non vérifiée**, et le signataire tranche
entre trois issues :

1. faire relever la cadence sur la fiche officielle du jeu, et l'écrire ;
2. retenir la cadence **annuelle** déclarée sur data.gouv.fr, en citant cette
   page comme source de la cadence ;
3. publier `HUBEAU_BNPE_PRELEVEMENTS` avec une cadence explicitement « non
   vérifiée » — acceptable, à condition que la surface le rende comme une
   absence de relevé et non comme une absence de mise à jour.

## 4. Deux écarts qui rendraient X4B inopérant — vérifiés dans le code

Instruire un libellé et une cadence dans un document ne les fait pas arriver sur
la surface publique. Deux chemins manquent, l'un et l'autre constatés dans le
code, et **tous deux doivent être traités par X4B avant la réacquisition** — le
plan a été complété en conséquence (§2 et §13 de
[X4_PUBLICATION_IMPLEMENTATION_PLAN.md](X4_PUBLICATION_IMPLEMENTATION_PLAN.md)).

### 4.1 L'attribution est estampillée à l'acquisition, pas à l'assemblage

`scripts/water_intelligence/validate_hubeau.py` compose l'attribution de chaque
observation **au moment de l'acquisition**, depuis le socle :

| Emplacement | Appel |
|---|---|
| `validate_hubeau.py:743` | `attribution=transport_mod.attribution(accessed_on=…)` |
| `validate_hubeau.py:937` | `attribution=transport_mod.attribution(…)` |
| `staging_rehearsal.py:71` | `ATTRIBUTION` fixe, semée dans le Source Registry |

Le §3.1 du plan X4B réexécute le workflow **non modifié**. Conséquence
mécanique : une réacquisition menée telle quelle réestampillerait les 282
observations avec le libellé composé que le §1.1 déclare non publiable, et le
snapshot assemblé ensuite le porterait. Le remplacement des libellés doit donc
précéder la réacquisition, source par source — il ne peut pas être fait après
coup sans réacquérir une seconde fois.

### 4.2 Le contrat public ne sait pas transporter une cadence

`WaterSourceReference` (`models/water_intelligence.py:98-114`) porte
`retrieved_at`, `observed_period_start`, `observed_period_end` et `attribution`
— **aucun champ de cadence**. Son miroir Zod ne l'a pas davantage
(`apps/carbon/lib/water-intelligence/contracts.ts:87-88`).

Conséquence : `source_refresh_cadence` ne peut pas atteindre la surface
publique, et l'affichage en trois lignes du §2.3 est **impossible en l'état** —
le champ serait perdu à la sérialisation, sans erreur, ce qui est le pire des
cas. Ajouter le champ touche le contrat P02, son miroir TypeScript, les
documents canoniques et leurs tests de parité : c'est une **décision
d'architecture**, de même nature que le budget de 100 ko, et elle se tranche
avant X4B plutôt qu'au milieu.

Tant qu'elle n'est pas tranchée, deux options seulement, toutes deux au
signataire : étendre le contrat, ou publier sans cadence en le disant — jamais
approuver une cadence que la surface ne saura pas rendre.

## 5. Méthode de vérification, et sa limite

Les faits du §1 et du §2 ont été relevés sur les pages officielles listées en
§1.4, **lues par indexation** et non téléchargées directement : depuis
l'environnement d'exécution de cette phase, toute connexion HTTPS vers
`*.eaufrance.fr` est refusée au niveau du proxy sortant (`CONNECT tunnel
failed, response 403`). Aucun octet n'a donc été acquis auprès de Hub'Eau par
cette phase — ce qui est cohérent avec X4A, qui ne réacquiert rien.

Conséquence à assumer explicitement : les cadences « quotidienne » (ADES) et
« continue » (Naïades) sont **vérifiées par lecture indexée de la page
officielle**, pas par un relevé direct horodaté. Pour un fait destiné à être
publié, c'est un niveau de preuve inférieur à celui des checksums du dossier X3.
Le relevé direct — page officielle ouverte, date de relevé consignée — reste à
faire par le signataire, et le §4.4 du plan X4B est le bon endroit pour
l'inscrire.

## 6. Ce que ce document ne fait pas

- Il ne signe aucune décision : aucun `reviewer`, aucun `reviewed_on`, aucun
  verdict n'est rempli, ici ni dans le paquet de décision.
- Il ne rend pas les trois libellés publiables : `source_last_updated_on` reste
  non relevé pour les trois sources, et la condition de paternité de la Licence
  Ouverte 2.0 n'est donc satisfaite par aucun d'eux (§1.3).
- Il ne referme pas le §3.3 du paquet : la licence reste vérifiée au niveau
  plateforme, pas jeu par jeu.
- Il ne tranche ni l'extension du contrat P02 à un champ de cadence, ni l'ordre
  exact des étapes de X4B (§4) : il les nomme et les remonte.
- Il ne modifie ni `hubeau_transport.py`, ni `staging_rehearsal.py`, ni aucun
  connecteur : les deux libellés préexistants restent en place tels quels, et
  leur remplacement éventuel dans le code relève de X4B, après signature.
- Il ne démarre pas X4B, ne publie aucune donnée, ne touche aucun snapshot
  public, ne crée aucune infrastructure.
