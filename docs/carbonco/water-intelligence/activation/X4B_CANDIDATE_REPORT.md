# X4B-PREP — Rapport des candidats de publication Water

**Statut : rapport technique. Aucune donnée publiée, aucune source approuvée,
aucun document canonique modifié.**

Ce rapport accompagne
[X4B_HUMAN_APPROVAL_PACKET.md](X4B_HUMAN_APPROVAL_PACKET.md), qui porte les
formulaires. Il décrit ce que la machinerie fait, ce qu'elle a établi, et ce
qu'elle n'a **pas** pu mesurer.

---

## 1. Ce qui est mesuré, et ce qui ne l'est pas

Les valeurs mesurées de ce rapport proviennent d'un `workflow_dispatch` de
`.github/workflows/water-x4b-candidate-builder.yml`. **Ce déclenchement n'a pas
eu lieu**, et ne pouvait pas avoir lieu depuis la phase qui produit ce
document :

| Fait | Preuve |
|---|---|
| Hub'Eau injoignable depuis l'environnement d'exécution | `curl https://hubeau.eaufrance.fr/…` → `curl: (56) CONNECT tunnel failed, response 403` — refus du proxy sortant, pas de la plateforme |
| Le workflow ne peut pas être déclenché | GitHub n'expose `workflow_dispatch` que pour un fichier présent sur la **branche par défaut** ; celui-ci naît dans une PR qui ne doit pas être fusionnée |

Sont donc marqués **`NON MESURÉ`** ci-dessous, et le resteront jusqu'au premier
dispatch : nombres d'observations, tailles exactes, marges de budget, verdicts
de budget, checksums du run, verdict du diff ADES, exhaustivité réelle.

**Ces champs ne sont pas estimés.** Le §5.4 du plan X4B écrit déjà la règle —
« ce n'est pas une estimation à valider par le raisonnement : mesurer ». Un
ordre de grandeur inscrit à la place d'une mesure se lit comme une mesure trois
semaines plus tard.

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
| Pagination | 200 × 2 pages |
| Observations | **NON MESURÉ** (référence X3 : 182) |
| Taille canonique | **NON MESURÉ** |
| Marge sous 100 000 octets | **NON MESURÉ** |
| Verdict | **NON MESURÉ** |
| Exhaustivité | **NON MESURÉ** — attendue, la page X3 n'était pas saturée |
| Risque d'interprétation | Une station ne documente aucun territoire : la surface doit nommer la station, jamais un département, et ne produire aucune moyenne territoriale. |

### B — `balanced_pilot`

Les trois sources, chacune resserrée jusqu'à l'exhaustivité.

| Source | Géographie | Période | Pagination | Ce qui change vs X3 |
|---|---|---|---|---|
| `HUBEAU_ADES` | station BSS `09892X0679/EXH70` | 2024-01-01 → 2024-03-31 | 200 × 2 | rien — déjà exhaustif |
| `HUBEAU_QUALITE_SURFACE` | département `34`, SANDRE 1339 + 1340 | 2024-01-01 → **2024-01-31** | **200 × 5** | trimestre → mois, 1×50 → 5×200 : c'est la borne de pagination X3, pas la source, qui avait réduit la période à douze jours |
| `HUBEAU_BNPE_PRELEVEMENTS` | commune INSEE **`34172`** | `annee=2020` | 200 × 5 | département → commune : un département de milliers de lignes ne peut pas être exhaustif en une page |

Observations, tailles, marges, verdicts : **NON MESURÉ**.

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

## 4. Budgets — les dix mesures attendues

Le workflow mesure les **sept combinaisons de sources** puis les **trois
candidats exacts**. Toutes sont `NON MESURÉ`.

| # | Combinaison | Observations | Octets | gzip | Provenance | Marge | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | ADES | — | — | — | — | — | **NON MESURÉ** |
| 2 | QUALITE | — | — | — | — | — | **NON MESURÉ** |
| 3 | BNPE | — | — | — | — | — | **NON MESURÉ** |
| 4 | ADES + QUALITE | — | — | — | — | — | **NON MESURÉ** |
| 5 | ADES + BNPE | — | — | — | — | — | **NON MESURÉ** |
| 6 | QUALITE + BNPE | — | — | — | — | — | **NON MESURÉ** |
| 7 | ADES + QUALITE + BNPE | — | — | — | — | — | **NON MESURÉ** |
| A | `minimal_pilot` | — | — | — | — | — | **NON MESURÉ** |
| B | `balanced_pilot` | — | — | — | — | — | **NON MESURÉ** |
| C | `x3_technical_sample` | — | — | — | — | — | **NON MESURÉ** |

Ce qui est connu sans mesure : le §3.5 du paquet **estime** les 282
observations de X3 à 250–350 ko, soit 2,5 à 3,5 fois le plafond. C'est une
estimation, elle est signalée comme telle, et elle ne remplace aucune ligne du
tableau.

Quatre interdits, appliqués par le code et non par consigne :

1. aucune troncature — l'assembleur lève, le constructeur **rapporte** la
   levée et ne réassemble pas avec une garde désactivée ;
2. aucun relèvement du plafond — il est lu depuis l'assembleur, jamais
   redéfini ;
3. aucune preuve retirée — le poids de la provenance est mesuré **à part**,
   précisément parce que c'est ce qu'on serait tenté d'alléger en premier ;
4. le gzip est informatif — le budget porte sur les octets non compressés.

**La recommandation automatique** retient le plus grand candidat conforme, sans
perte de provenance. Elle ne vaut **aucune approbation humaine** : elle dit ce
qui tient techniquement, pas ce qu'il est juste de publier.

## 5. Diff ADES

Le fait à expliquer, connu depuis X3 : deux checksums différents pour un nombre
d'octets **identique**.

| Exécution | Paramètres | Octets | Checksum |
|---|---|---|---|
| X2A | `--page-size 100` | 52 139 | `52bc5f94759d7c96b06ef2853fd417342e2a9e409f77e2900af9ad2518bbd7c6` |
| X3 | `--page-size 200` | 52 139 | `54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b` |
| X4B-PREP | — | **NON MESURÉ** | **NON MESURÉ** |

Même longueur et contenu différent excluent un ajout ou un retrait : quelque
chose a été **remplacé par une chaîne de même longueur**. L'hypothèse — les
URL de pagination `size=100` et `size=200` comptent le même nombre de
caractères — reste une hypothèse.

Le constructeur rend un verdict **nommé**, et n'en invente aucun :

| Verdict | Sens | Suite |
|---|---|---|
| `byte_stable` | checksum identique à X3 | consigner, continuer |
| `transport_only_variation_unproven` | même longueur, checksum différent | **provisoire** — exige un diff octet à octet hors dépôt avant publication ; tant qu'il n'est pas produit, ce n'est pas `transport_only_variation` |
| `content_changed` | checksum **et** longueur diffèrent | **BLOQUE ADES** — le run échoue |

Verdict du run : **NON MESURÉ**.

Le checksum de publication sera celui de l'artefact **exact** retenu dans la PR
de publication, jamais celui de X3 par défaut.

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
