# X4B-PREP — Rapport des candidats de publication Water

**Statut : rapport technique. Aucune donnée publiée, aucune source approuvée,
aucun document canonique modifié.**

Ce rapport accompagne
[X4B_HUMAN_APPROVAL_PACKET.md](X4B_HUMAN_APPROVAL_PACKET.md), qui porte les
formulaires. Il décrit ce que la machinerie fait, ce qu'elle a établi, et ce
qu'elle n'a **pas** pu mesurer.

---
## 1. Ce qui est mesuré, et ce qui ne l'est pas

Les valeurs de ce rapport proviennent du run
[`30306257628`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30306257628)
du workflow `water-x4b-candidate-builder.yml`, déclenché manuellement sur
`master` au commit `c01b8841`, `candidate = all`. La traçabilité complète —
étapes, niveaux de preuve, limites — est dans
[X4B_WORKFLOW_RUN_EVIDENCE.md](X4B_WORKFLOW_RUN_EVIDENCE.md).

**Ce ne sont pas des estimations.** Le §5.4 du plan X4B l'exigeait : « ce n'est
pas une estimation à valider par le raisonnement : mesurer ». C'est fait.

L'estimation antérieure de 250–350 ko pour les 282 observations X3 se révèle
**correcte dans son ordre de grandeur** (396 551 octets mesurés, soit un peu
au-dessus de la fourchette haute) — mais elle n'a jamais valu mesure, et c'est
la mesure qui fait foi.

### 1.1 D'où viennent ces chiffres

Les snapshots candidats sont reconstruits depuis les **artefacts vérifiés**,
par `prepare_release()` — la fonction qui grave — et **jamais depuis la table
`observations`**, qui ne conserve qu'une projection du contrat P02. La base est
lue pour CONFRONTER (parité, registre, licence), jamais pour composer.

Le run a produit `25_parity.json` : **7 releases contrôlées**, préparé =
persisté = candidat sur les trois représentations. Aucune divergence.

### 1.2 Ce qui reste NON RELEVÉ

Cinq des dix-huit mesures du run ne sont pas transcrites ici : elles existent
dans l'artefact `water-x4b-prep-reports`, mais n'ont pas été reportées dans ce
document. Elles sont marquées **NON RELEVÉ** — ce qui ne veut pas dire « non
mesuré », et les deux ne doivent pas être confondus. Aucune n'est nécessaire à
la décision, puisque chacune porte sur une combinaison déjà dépassée par une de
ses parties.

## 2. Le constat qui commande les trois candidats

Mesuré sur les rapports X3, sans acquisition nouvelle :

| Source | Enregistrements / page | Dernière page | Conséquence |
|---|---|---|---|
| `HUBEAU_ADES` | 182 / 200 | **incomplète** | périmètre X3 **déjà exhaustif** sur sa fenêtre |
| `HUBEAU_QUALITE_SURFACE` | 50 / 50 | **saturée** | fenêtre demandée (91 jours) **tronquée** à 12 jours |
| `HUBEAU_BNPE_PRELEVEMENTS` | 50 / 50 | **saturée** | échantillon arbitraire sur un département entier |

Une page saturée signifie que des enregistrements ont pu rester de l'autre côté
de la borne. Publier un tel périmètre présenterait **une limite de pagination
comme une couverture territoriale** — c'est précisément ce que le §3.1 du
paquet de décision interdit, et la saturation en est la preuve mécanique, pas
l'opinion.

C'est le seul signal d'exhaustivité disponible, et le constructeur en fait une
règle dure : un périmètre qui déclare `expects_incomplete_last_page` et rend
une page saturée **fait échouer le run**. Une prétention d'exhaustivité non
vérifiée est pire qu'une absence de prétention.

## 3. Les trois candidats

### A — `minimal_pilot`

Une source, périmètre inchangé depuis X3 parce qu'il était déjà complet.

| Rubrique | Valeur |
|---|---|
| Source | `HUBEAU_ADES` |
| Géographie | station BSS `09892X0679/EXH70` (identifiant officiel) |
| Période | 2024-01-01 → 2024-03-31 |
| Pagination | 200 × 2 pages — **1 page récupérée** |
| Observations | **182**, 0 rejetée |
| Checksum du payload | `54ac8e5b…6ee00b` — identique à X3 |
| Taille canonique | **255 121 octets** |
| Marge sous 100 000 octets | **−155 121** |
| Verdict | **`over_budget`** — dépasse de plus du double |
| Exhaustivité | ✅ **confirmée** — 182 < 200, dernière page non saturée |
| Risque d'interprétation | Une station ne documente aucun territoire : la surface doit nommer la station, jamais un département, et ne produire aucune moyenne territoriale. |

### B — `balanced_pilot`

Les trois sources, chacune resserrée jusqu'à l'exhaustivité.

| Source | Géographie | Période | Pagination | Ce qui change vs X3 |
|---|---|---|---|---|
| `HUBEAU_ADES` | station BSS `09892X0679/EXH70` | 2024-01-01 → 2024-03-31 | 200 × 2 | rien — déjà exhaustif |
| `HUBEAU_QUALITE_SURFACE` | département `34`, SANDRE 1339 + 1340 | 2024-01-01 → **2024-01-31** | **200 × 5** | trimestre → mois, 1×50 → 5×200 : c'est la borne de pagination X3, pas la source, qui avait réduit la période à douze jours |
| `HUBEAU_BNPE_PRELEVEMENTS` | commune INSEE **`34172`** | `annee=2020` | 200 × 5 | département → commune : un département de milliers de lignes ne peut pas être exhaustif en une page |

Mesures du run :

| Source | Observations | Octets | Marge | Exhaustivité | Verdict |
|---|---|---|---|---|---|
| `HUBEAU_ADES` | 182 | 255 121 | −155 121 | ✅ | **`over_budget`** |
| `HUBEAU_QUALITE_SURFACE` | 78 | 111 324 | −11 324 | ✅ 78 < 200 | **`over_budget`** |
| `HUBEAU_BNPE_PRELEVEMENTS` | 3 | **6 120** | **+93 880** | ✅ 3 < 200 | ✅ **`within_budget`** |
| **Ensemble** | **263** | **371 144** | −271 144 | — | **`over_budget`** |

Le resserrement de la fenêtre QUALITE (trimestre → janvier, 1×50 → 5×200) a
bien produit ce qu'il visait : **78 observations exhaustives** au lieu de 50
tronquées. Le périmètre est désormais complet — mais il pèse 111 324 octets,
soit 11 324 de trop. **Un périmètre exhaustif et hors budget reste hors
budget** : c'est un progrès de méthode, pas un candidat publiable.

Le passage de BNPE du département à la commune INSEE `34172` a produit
3 observations exhaustives, à 6 120 octets — **la seule mesure du run qui
tienne dans le budget**.

Risques d'interprétation, par source :

- **Naïades** — aucune conclusion de conformité nulle part ; la conformité
  relève exclusivement du registre juridique. Les codes de remarque sont
  transportés verbatim, aucune censure n'est déduite. L'allowlist SANDRE doit
  être validée explicitement avant publication.
- **BNPE** — couverture partielle **par construction** : usages exonérés de
  redevance inconnus, volumes < 10 000 m³ non déclarés. Une absence n'est
  **jamais** un prélèvement nul, et aucun total communal ne doit être présenté
  comme le prélèvement de la commune.
- **Trois périmètres hétérogènes** : aucune comparaison entre sources n'est
  valide.

### C — `x3_technical_sample`

Reproduction stricte des bornes X3. **Non recommandé pour publication.**

Il existe pour deux usages, et deux seulement : comparer les checksums, et
mesurer l'écart de budget entre un échantillon de recette et un périmètre
éditorial. Deux de ses trois périmètres sont des pages saturées.
## 4. Budgets — mesurés

Budget P02 : **100 000 octets**, non compressés, sur la charge servie. Non
relevé, non contourné, aucune troncature, aucune preuve retirée.

**Chaque mesure est indexée sur un CANDIDAT.** Une combinaison de sources n'a
pas de sens en dehors d'un candidat : `HUBEAU_ADES` figure dans les trois avec
une `release_key` différente, et `HUBEAU_QUALITE_SURFACE` y porte deux fenêtres
distinctes — janvier pour `balanced_pilot`, le trimestre pour
`x3_technical_sample`.

### A — `minimal_pilot` (ADES seule)

| # | Périmètre | Observations | Octets | Marge | Verdict |
|---|---|---|---|---|---|
| A.1 | ADES | 182 | **255 121** | −155 121 | **`over_budget`** |
| A.★ | candidat exact | 182 | **255 121** | −155 121 | **`over_budget`** |

A.1 et A.★ sont la même mesure : ce candidat n'a qu'une source.

### B — `balanced_pilot`

| # | Combinaison | Observations | Octets | Marge | Verdict |
|---|---|---|---|---|---|
| B.1 | ADES | 182 | 255 121 | −155 121 | **`over_budget`** |
| B.2 | QUALITE | 78 | **111 324** | **−11 324** | **`over_budget`** |
| B.3 | BNPE | 3 | **6 120** | **+93 880** | ✅ **`within_budget`** |
| B.4 | ADES + QUALITE | 260 | NON RELEVÉ | — | `over_budget` (B.1 seule dépasse) |
| B.5 | ADES + BNPE | 185 | NON RELEVÉ | — | `over_budget` (B.1 seule dépasse) |
| B.6 | QUALITE + BNPE | 81 | **116 783** | −16 783 | **`over_budget`** |
| B.7 | ADES + QUALITE + BNPE | 263 | **371 144** | −271 144 | **`over_budget`** |
| B.★ | candidat exact | 263 | **371 144** | −271 144 | **`over_budget`** |

**B.3 est la seule mesure conforme au budget de tout le run.**

Détail de B.3, la seule qui puisse être publiée :

| Fait | Valeur |
|---|---|
| Observations | 3 |
| JSON canonique non compressé | **6 120 octets** |
| gzip (informatif, jamais le budget) | 1 239 octets |
| Poids de provenance | 915 octets (15 % de la charge) |
| Marge sous 100 000 | **93 880 octets** |
| Exhaustivité | ✅ dernière page non saturée (3 < 200) |

### C — `x3_technical_sample`

| # | Combinaison | Observations | Octets | Marge | Verdict |
|---|---|---|---|---|---|
| C.1–C.6 | (six combinaisons) | — | NON RELEVÉ | — | — |
| C.7 | ADES + QUALITE + BNPE | 282 | **396 551** | −296 551 | **`over_budget`** |
| C.★ | candidat exact | 282 | **396 551** | −296 551 | **`over_budget`** |

### 4.1 Le fait qui commande la décision

**Une seule des dix-huit mesures tient dans le budget : BNPE sur le périmètre
équilibré, à 6 120 octets.** Toutes les autres le dépassent, ADES de plus du
double à elle seule.

Ce n'est pas un problème de budget trop serré : c'est le poids de l'enveloppe
de preuve par observation. Chaque observation porte sa provenance complète —
attribution, URL officielle, cadence, checksum, licence — et c'est
précisément ce qui la rend auditable. **L'alléger rendrait le budget tenable en
rendant la donnée non auditable**, ce que l'interdit §7 du plan proscrit.

Deux conséquences, et une seule est acceptable :

- ❌ retirer de la provenance pour faire entrer ADES — **exclu** ;
- ✅ **restreindre le périmètre** jusqu'à ce qu'il tienne avec sa provenance
  intacte — c'est ce que fait B.3.

## 5. Diff ADES

| Acquisition | Checksum brut | Octets |
|---|---|---|
| X2A | `52bc5f94…bbd7c6` | 52 139 |
| X3 | `54ac8e5b…6ee00b` | 52 139 |
| **X4B-PREP** `x3_technical_sample` | **`54ac8e5b…6ee00b`** | **52 139** |

**Verdict du run : `byte_stable`.**

Le checksum X4B-PREP est **identique** à celui de X3, sur le même nombre
d'octets. Aucune variation à expliquer entre X3 et X4B-PREP : la source rend le
même contenu sur le même périmètre.

> **Le premier verdict rendu par le run était faux.** Il annonçait
> `content_changed` — donc un blocage d'ADES — parce que `command_diff_ades`
> lisait le payload brut Hub'Eau au lieu du rapport validé, y trouvait `null`
> et `0`, et concluait « checksum ET longueur diffèrent ». Un blocage prononcé
> sur une absence de preuve prise pour une preuve d'absence. Corrigé ; détail
> en §3 de [X4B_WORKFLOW_RUN_EVIDENCE.md](X4B_WORKFLOW_RUN_EVIDENCE.md).

### 5.1 Ce que ce verdict ne dit pas

- **La variation X2A → X3 reste non expliquée** : même longueur, checksum
  différent. Elle est hors du périmètre de ce run — la comparaison qui commande
  la publication est X3 → X4B-PREP — mais elle n'est pas résolue pour autant, et
  reste au registre des risques.
- **Le diff d'identités** (ajoutées / supprimées / modifiées) n'est pas produit :
  le verdict porte sur les octets bruts. Les 182 observations, 0 rejetée, dans
  les trois candidats sont *cohérentes* avec une stabilité d'identités ; elles
  ne la **démontrent** pas.

## 6. Table-first et géographie

`publication_mode = table_first`, `geo_layers = deferred` — inchangés.

Aucune couche géographique n'existe et rien dans le dépôt n'en produit :
`coverage.layer_count == 0`, donc `WiMapFrame` conserve son état **« aucune
couche géographique publiée »** et ne monte pas de carte, même avec des
observations publiées. **Aucune fausse couche n'est créée.**

Ce que le candidat peut alimenter, sans couche : la table, les synthèses, la
provenance, les périodes, les unités, les métriques, les filtres.

Audit des identifiants déjà disponibles pour une phase géographique future —
aucun n'est utilisé ici :

| Source | Identifiant porté | Nature | Coordonnées |
|---|---|---|---|
| `HUBEAU_ADES` | code BSS (`09892X0679/EXH70`) | identifiant de point de mesure officiel | non portées par le contrat P02 |
| `HUBEAU_QUALITE_SURFACE` | code station Naïades, code département | identifiants officiels | non portées |
| `HUBEAU_BNPE_PRELEVEMENTS` | code ouvrage, code commune INSEE | identifiants officiels | non portées |

Constat pour la phase géographique : les trois sources portent des
**identifiants officiels stables**, donc une jointure par code est possible —
aucune jointure par nom ne sera jamais nécessaire. Ce qui manque est le
**référentiel géométrique** (contours ou points), qu'aucune de ces API ne
fournit dans les réponses acquises. Le produire est un travail distinct, avec
sa propre licence à vérifier.

## 7. Ce que ce rapport n'établit pas

- Aucun budget mesuré, aucun verdict, aucun checksum de run.
- Aucune exhaustivité prouvée — seulement exigée par le code.
- Aucune cadence BNPE : toujours non vérifiée (X4A §3).
- Aucune `source_last_updated_on` : aucune n'a pu être relevée. C'est la voie
  de l'URL officielle stable qui porte la conformité de paternité.
- Aucune recommandation éditoriale : le choix du périmètre publié est humain.
