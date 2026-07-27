# X4B-PREP — Audit préalable à l'implémentation

**Statut : audit. Aucune donnée publiée, aucune décision signée, aucun
`approved` au registre.**

Cet audit précède le code de X4B-PREP, conformément au §1 de la consigne. Il
répond à huit questions avant qu'une ligne soit écrite, parce que trois des
défauts les plus coûteux de ce chantier (le drapeau `--environment staging` de
X3, le garde-fou anti-IDOR de la Wave E, les deux écarts trouvés en revue de la
PR #172) ont tous la même forme : **un mécanisme qui paraissait en place et ne
l'était pas**. Les chercher avant coûte une lecture ; les découvrir après coûte
une réacquisition.

---

## 0. Le blocage structurel de cette phase, établi d'emblée

**X4B-PREP ne peut pas produire les chiffres exacts que sa propre consigne
demande, et ce n'est pas un manque de méthode.**

| Fait | Preuve |
|---|---|
| Hub'Eau est injoignable depuis l'environnement d'exécution | `curl https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/chroniques…` → `curl: (56) CONNECT tunnel failed, response 403`. Le refus vient du proxy sortant, pas de la plateforme. |
| Le workflow de construction ne peut pas être déclenché depuis cette phase | GitHub n'expose `workflow_dispatch` que pour un fichier de workflow **présent sur la branche par défaut**. `water-x4b-candidate-builder.yml` naît dans cette PR, qui ne doit pas être fusionnée (§11 de la consigne). |

Conséquence, énoncée sans détour : les **machineries** des §4 à §7 (constructeur
de candidats, mesure de budget, diff ADES, rapports) sont livrées et testées ;
les **valeurs mesurées** qu'elles produisent ne le sont pas, parce qu'aucune
acquisition n'a eu lieu.

Ce qui est donc livré vide, et le restera jusqu'au premier `workflow_dispatch` :

- nombre exact d'observations par candidat ;
- taille exacte du JSON canonique, marge sous 100 000 octets, verdict
  `within_budget` / `over_budget` ;
- checksums du run X4B-PREP ;
- verdict du diff ADES (`byte_stable` / `transport_only_variation` /
  `content_changed`) ;
- exhaustivité réelle et nombre total de résultats par périmètre.

**Ces champs sont laissés explicitement vides dans les rapports, avec la mention
`NON MESURÉ — en attente du premier workflow_dispatch`.** Les remplir par
estimation produirait exactement ce que le §3.5 du paquet de décision interdit :
un ordre de grandeur raisonné présenté à la place d'une mesure. Le §5.4 du plan
X4B écrit déjà la règle — « ce n'est pas une estimation à valider par le
raisonnement : mesurer ».

## 1. Fichiers à modifier, et pourquoi chacun

| Fichier | Nature | Motif |
|---|---|---|
| `services/water_intelligence/source_attribution.py` | **nouveau** | Configuration canonique par `source_code` : libellé, URL officielle stable, cadence, date de dernière mise à jour. Point unique de vérité, importé par tous les producteurs d'attribution. |
| `models/water_intelligence.py` | modifié | `WaterSourceReference` gagne `source_information_url`, `source_refresh_cadence`, `source_last_updated_on`. |
| `apps/carbon/lib/water-intelligence/contracts.ts` | modifié | Miroir Zod des trois champs — sans quoi la parité de contrat est rompue. |
| `services/water_intelligence/public_snapshot.py` | modifié | Porte de publication : une source publiée sans URL officielle est **écartée avec motif**, jamais publiée muette. |
| `scripts/water_intelligence/validate_hubeau.py` | modifié | Deux sites (`:743`, `:937`) composent l'attribution **à l'acquisition** ; ils passent par la configuration canonique. |
| `services/water_intelligence/hubeau_transport.py` | modifié | `attribution()` devient un chemin par source ; le libellé plateforme indistinct cesse d'être le défaut. |
| `scripts/water_intelligence/staging_rehearsal.py` | modifié | `ATTRIBUTION` fixe (`:71`) semée dans le Source Registry → par source. |
| `scripts/water_intelligence/build_candidate_snapshots.py` | **nouveau** | Constructeur de candidats A/B/C, mesure de budget, lecture seule en base. |
| `.github/workflows/water-x4b-candidate-builder.yml` | **nouveau** | `workflow_dispatch` exclusif, PostgreSQL éphémère, aucun `contents: write`. |

## 2. Contrats concernés, et le risque de compatibilité qui a failli passer

### 2.1 Ce que porte `WaterSourceReference` aujourd'hui

`models/water_intelligence.py:98-114` — `source_code`, `release_key`,
`checksum_sha256`, `published_at`, `retrieved_at`, `observed_period_start`,
`observed_period_end`, `methodology_version`, `license`, `attribution`,
`warnings`. **Aucun champ de fraîcheur de source, aucune URL.** Le miroir Zod
(`contracts.ts:82-95`) est aligné, et n'en a pas davantage.

### 2.2 Le piège : `source_information_url` ne doit pas être requis *au modèle*

La consigne dit « `source_information_url` obligatoire pour **une source
publiée** ». La lecture naïve — `Field(min_length=1)` sur le modèle — casserait
deux documents canoniques :

| Document | Contient des `WaterSourceReference` | Effet d'un champ requis |
|---|---|---|
| `contracts/PUBLIC_SNAPSHOT_EMPTY.json` | **non** (`manifest: null`, `included_source_codes: []`) | aucun — compatible |
| `contracts/FIXTURE_MANIFEST.json` + son miroir | **oui, 4 références** | **rupture** : le document gelé cesserait de valider, et sa réécriture toucherait un miroir octet pour octet |

**Décision retenue : le champ est nullable au modèle, et l'obligation vit à la
porte de publication** (`assemble_public_snapshot`). Une source autorisée mais
dépourvue d'URL officielle sort en **exclusion motivée**, pas en publication
silencieuse. C'est la même discipline que la double barrière licence : le
contrat décrit ce qui peut exister, la porte décide ce qui peut sortir.

Conséquence vérifiée : `PUBLIC_SNAPSHOT_EMPTY.json` est **inchangé** par cette
extension, donc `TestDocumentParity::test_snapshot_document_matches_the_assembler`
reste vert sans réécriture d'aucun document canonique.

### 2.3 Compatibilité ascendante des documents existants

Trois champs nullables ajoutés, aucun champ retiré, aucun renommé, aucune valeur
par défaut inventée. Un document antérieur qui ne les porte pas reste valide, et
**un champ absent reste absent** — il n'est pas rendu comme `null` affiché, ni
comme « non renseigné » présenté en valeur métier.

## 3. Budget de snapshot — l'état de la question

| Fait | Valeur | Origine |
|---|---|---|
| Plafond contractuel | **100 000 octets non compressés** | contrat P02 §7, `max_manifest_bytes_uncompressed` |
| Comportement au dépassement | `SnapshotBudgetExceeded` — **jamais de troncature** | `public_snapshot.py:426-431` |
| Estimation X3 (282 observations) | 250 à 350 ko, soit 2,5 à 3,5× le budget | §3.5 du paquet — **estimation, non mesurée** |

L'extension de contrat du §2 **augmente** la taille par référence de source
(trois champs de plus). L'effet est borné : les champs vivent sur la
*référence de source*, pas sur chaque observation — donc le surcoût est de
l'ordre de trois valeurs × nombre de sources, pas × nombre d'observations. Cela
n'annule pas le dépassement attendu ; cela ne l'aggrave pas non plus
significativement. **À mesurer, pas à conclure.**

La conséquence structurante pour les candidats du §4 : un candidat n'est pas
« un périmètre intéressant », c'est **un périmètre qui tient dans 100 000
octets sans qu'aucune preuve soit retirée**. C'est le budget qui contraint le
périmètre, jamais l'inverse.

## 4. Champs de fraîcheur manquants — l'état exact

| Champ | Contrat aujourd'hui | Après extension | Valeur connue |
|---|---|---|---|
| `observed_period_start` / `_end` | présents | inchangés | connus pour les trois sources (X3) |
| `retrieved_at` | présent | inchangé | connu — 2026-07-26 pour X3, à réécrire par X4B |
| `source_refresh_cadence` | **absent** | ajouté, nullable | ADES quotidienne, Naïades continue, **BNPE non vérifiée** |
| `source_last_updated_on` | **absent** | ajouté, nullable | **non relevé pour les trois** |
| `source_information_url` | **absent** | ajouté, nullable, exigé à la publication | à fixer par source (§5) |

`source_last_updated_on` reste vide, et c'est délibéré : la consigne interdit de
le déduire d'un checksum ou d'une période observée, et aucun relevé direct n'a
pu être fait (§0). La Licence Ouverte 2.0 admettant une seconde voie de
conformité — indiquer l'URL pointant vers l'Information, la paternité restant
effectivement attribuée —, **c'est cette voie qui est retenue et documentée**,
via `source_information_url`. Le choix est écrit, pas subi.

## 5. Chemins d'attribution — les trois producteurs, et l'ordre qui compte

| Producteur | Emplacement | Ce qu'il estampille |
|---|---|---|
| `validate_hubeau.py:743` | acquisition, familles à fenêtre `date` | l'attribution de **chaque observation** |
| `validate_hubeau.py:937` | acquisition, prélèvements multi-années | idem, par année |
| `staging_rehearsal.py:71` | déclaration | l'attribution portée par le **Source Registry** |

Les trois passent par la configuration canonique. **L'ordre est contraignant :**
l'attribution étant estampillée à l'acquisition, elle doit être en place *avant*
la première acquisition — sinon il faut réacquérir. C'est l'étape 1 bis du §13
du plan X4B, ajoutée après la revue de la PR #172.

Règle de sûreté retenue : la configuration **lève** sur un `source_code`
inconnu. Un repli sur un libellé générique reproduirait exactement le défaut que
X4A a écarté — un libellé plateforme identique pour des jeux différents.

## 6. Stratégie de rollback

Inchangée par rapport au §9 du plan X4B, et c'est l'intérêt de la voie retenue :

| Étape | Geste |
|---|---|
| 1 | `git revert` du commit de publication — document canonique et miroir reviennent ensemble |
| 2 | Repasser la source de `approved` à `deferred`/`refused`, **avec motif** |
| 3 | Redéployer |
| 4 | Vérifier `is_empty: true` et un ETag **différent** |

X4B-PREP n'ajoute aucun état à défaire : il ne publie rien, n'écrit que dans un
PostgreSQL éphémère, et ne commit aucun snapshot. Son propre rollback est
l'abandon de la PR.

## 7. Périmètre exact des trois sources

| Source | Identifiants éprouvés (X3) | Ce qui doit changer pour un candidat éditorial |
|---|---|---|
| `HUBEAU_ADES` | station BSS `09892X0679/EXH70`, 2024-01-01 → 2024-03-31, 1 page de 200 | La page n'était pas saturée (182 < 200) : le périmètre X3 est **déjà exhaustif** sur sa fenêtre. C'est le seul des trois dans ce cas. |
| `HUBEAU_QUALITE_SURFACE` | département `34`, paramètres SANDRE 1339/1340, 1 page de 50 | Page **saturée** (50/50) : la fenêtre demandée a été tronquée à 2024-01-03 → 2024-01-15. Un candidat doit **resserrer la fenêtre** jusqu'à ce que la dernière page soit incomplète, ou paginer jusqu'à épuisement. |
| `HUBEAU_BNPE_PRELEVEMENTS` | département `34`, `annee=2020`, 1 page de 50 | Page **saturée** (50/50) sur un jeu qui compte 9 724 lignes départementales tous millésimes confondus : le périmètre X3 est un échantillon arbitraire, pas une couverture. Un candidat doit restreindre la géographie (commune ou ouvrages nommés) pour être exhaustif. |

**Aucun nouveau territoire n'est choisi ici.** Les identifiants restent ceux
éprouvés en X3 ; seules les fenêtres et la pagination bougent, dans le sens de
l'exhaustivité. Le choix éditorial final appartient au signataire (§9).

Constat qui doit rester visible jusqu'au signataire : **deux des trois
périmètres X3 sont des pages tronquées**, pas des ensembles complets. Les
publier tels quels rendrait une limite de pagination lisible comme une
couverture territoriale — le §3.1 du paquet le dit déjà, la mesure de
saturation le prouve.

## 8. Ce que cet audit ne fait pas

- Il ne publie rien, ne signe rien, ne modifie aucun snapshot public.
- Il ne choisit aucun territoire ni aucune option de publication.
- Il ne mesure aucun budget : il dit où et comment le mesurer.
- Il ne tranche pas la cadence BNPE, toujours non vérifiée.
- Il ne relève aucune `source_last_updated_on` : aucune n'a pu l'être.
