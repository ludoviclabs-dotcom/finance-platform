# X4B — Paquet d'approbation humaine

**Statut : `unsigned` — aucune décision n'est rendue dans ce document.**
**Aucune donnée n'est publiée. Aucune source n'est `approved` au registre.**

Ce paquet présente les trois options de première publication Water et porte les
formulaires de décision. Les formulaires sont **vides**, et un formulaire vide
vaut « non décidé », jamais « accepté par défaut ».

Détail technique :
[X4B_CANDIDATE_REPORT.md](X4B_CANDIDATE_REPORT.md). Audit préalable :
[X4B_PREIMPLEMENTATION_AUDIT.md](X4B_PREIMPLEMENTATION_AUDIT.md).

---

## 1. Avertissement de lecture — ce paquet est désormais décidable

Les mesures existent. Elles viennent du run
[`30306257628`](https://github.com/ludoviclabs-dotcom/finance-platform/actions/runs/30306257628),
déclenché manuellement sur `master` au commit `c01b8841`, `candidate = all`.
Traçabilité complète dans
[X4B_WORKFLOW_RUN_EVIDENCE.md](X4B_WORKFLOW_RUN_EVIDENCE.md).

**Le résultat central est brutal et simplifie la décision : sur dix-huit
mesures, une seule tient dans le budget de 100 000 octets.**

| Option | Observations | Octets | Verdict |
|---|---|---|---|
| A — `minimal_pilot` (ADES) | 182 | 255 121 | ❌ `over_budget` |
| B — `balanced_pilot` (3 sources) | 263 | 371 144 | ❌ `over_budget` |
| C — `x3_technical_sample` | 282 | 396 551 | ❌ `over_budget` |
| **BNPE seule, périmètre B** | **3** | **6 120** | ✅ **`within_budget`** |

Aucune des trois options telles qu'elles étaient formulées n'est publiable.
Une quatrième, plus étroite, l'est — cf. §4.

**Ce que signer signifierait quand même.** Les mesures ne rendent pas la
décision automatique : le périmètre éditorial, les limites à afficher et
l'opportunité de publier trois observations restent des jugements humains.

## 2. Les trois options

### Option A — pilote minimal

| Rubrique | Valeur |
|---|---|
| Sources | `HUBEAU_ADES` seule |
| Périmètre | station BSS `09892X0679/EXH70`, 2024-01-01 → 2024-03-31 |
| Pourquoi | Seule des trois dont l'acquisition X3 n'était **pas tronquée** (182 sur une page de 200) |
| Observations | **182**, 0 rejetée |
| Taille / marge | **255 121 octets** — marge **−155 121** ❌ |
| Checksum du run | `54ac8e5b…6ee00b` — **identique à X3**, `byte_stable` |
| Verdict budget | ❌ **`over_budget`** — 2,5× le plafond |
| Attribution | `Source : Hub'Eau — API Piézométrie. Données issues d'ADES et des partenaires du Système d'information sur l'eau. Licence Ouverte / Etalab 2.0. Source officielle : https://hubeau.eaufrance.fr/page/api-piezometrie. Consultées le <date>.` |
| URL officielle | <https://hubeau.eaufrance.fr/page/api-piezometrie> |
| Cadence source | intégration **quotidienne** des mises à jour ADES — relevée |
| Dernière mise à jour source | ⛔ **NON RELEVÉE — bloque la publication de cette attribution** (cf. §5, risque 4) |
| Limite principale | Une station ne documente **aucun territoire** |

### Option B — pilote équilibré

| Source | Périmètre | Attribution | Cadence |
|---|---|---|---|
| `HUBEAU_ADES` | station `09892X0679/EXH70`, T1 2024 | API Piézométrie / ADES + partenaires SIE | quotidienne |
| `HUBEAU_QUALITE_SURFACE` | département `34`, SANDRE 1339+1340, **janvier 2024** | API Qualité des cours d'eau / Naïades, transmises par les Agences de l'eau | **continue** |
| `HUBEAU_BNPE_PRELEVEMENTS` | commune INSEE **`34172`**, `annee=2020` | API Prélèvements en eau / BNPE + gestion des redevances par les agences et offices de l'eau | **NON VÉRIFIÉE** |

URLs officielles : <https://hubeau.eaufrance.fr/page/api-piezometrie> ·
<https://hubeau.eaufrance.fr/page/api-qualite-cours-deau> ·
<https://hubeau.eaufrance.fr/page/api-prelevements-eau>

Mesures du run :

| Source | Observations | Octets | Marge | Verdict |
|---|---|---|---|---|
| `HUBEAU_ADES` | 182 | 255 121 | −155 121 | ❌ `over_budget` |
| `HUBEAU_QUALITE_SURFACE` | 78 (exhaustif) | 111 324 | **−11 324** | ❌ `over_budget` |
| `HUBEAU_BNPE_PRELEVEMENTS` | 3 (exhaustif) | **6 120** | **+93 880** | ✅ `within_budget` |
| **Ensemble (option B)** | **263** | **371 144** | −271 144 | ❌ `over_budget` |

**Dernière mise à jour source : ⛔ NON RELEVÉE pour les trois sources** — cf.
§5, risque 4. Elle bloque la publication de leurs attributions.

Limites : aucune conclusion de conformité (Naïades) ; couverture partielle par
construction et « une absence n'est jamais un zéro » (BNPE) ; aucune
comparaison entre les trois sources n'est valide.

### Option C — échantillon technique X3

Reproduction des bornes X3, **non recommandée pour publication éditoriale** :
deux de ses trois périmètres sont des pages saturées, donc des ensembles
tronqués présentés comme des périmètres. Conservée pour la comparaison de
checksums et la mesure d'écart de budget.

## 3. Mode de publication et état de la carte

| Rubrique | Valeur | Décidable ici ? |
|---|---|---|
| `publication_mode` | `table_first` | non — conservé |
| `geo_layers` | `deferred` | non — conservé |
| État de la carte | **« Aucune couche géographique publiée »** ; `WiMapFrame` ne monte pas de carte | non — mécanique, `layer_count == 0` |
| Table équivalente | alimentée, rendue côté serveur | — |

Publier des observations **ne change pas** l'état de la carte. Une absence de
carte n'est pas une couverture nulle, et l'écran doit continuer de l'expliquer.

## 4. Recommandation technique — `bnpe_minimal_pilot_v1`

**Cette recommandation ne vaut aucune approbation humaine.** Elle dit ce qui
tient techniquement, pas ce qu'il est juste de publier.

Aucune des trois options A/B/C ne tient dans le budget. La seule mesure
conforme du run est BNPE sur le périmètre resserré du pilote équilibré. Elle
constitue donc une **quatrième option**, plus étroite que toutes celles
formulées avant mesure.

| Rubrique | Valeur |
|---|---|
| Source | `HUBEAU_BNPE_PRELEVEMENTS` |
| Géographie | commune INSEE **`34172`** (identifiant officiel stable) |
| Période | `annee=2020` |
| Observations | **3** |
| Checksum source | `c9b8d10e9f1059fd49db51a45d6890ff1cebe546084eeac03d871742a74bd2e9` |
| Snapshot mesuré | **6 120 octets** |
| Marge sous 100 000 | **93 880 octets** |
| Exhaustivité | ✅ prouvée — 3 < 200, dernière page non saturée |
| Provenance | complète, 915 octets, rien retiré |

### 4.1 Classement des options

| Option | Classement | Motif |
|---|---|---|
| **`bnpe_minimal_pilot_v1`** | ✅ **recommandée** | seule conforme au budget, exhaustive, provenance intacte |
| A — `minimal_pilot` (ADES) | ❌ non recommandée | 255 121 octets — 2,5× le budget |
| B — `balanced_pilot` complet | ❌ non recommandée | 371 144 octets |
| C — `x3_technical_sample` | 🚫 **bloquée** | 396 551 octets **et** deux périmètres tronqués |

Les priorités du §9 du plan sont respectées dans l'ordre : périmètre exhaustif
d'abord, provenance complète ensuite, budget ensuite, faible risque
d'interprétation ensuite. **La diversité des sources arrive après**, et c'est
pourquoi trois observations d'une source valent mieux que 263 hors budget.

### 4.2 Statuts recommandés par source

| Source | Statut recommandé |
|---|---|
| `HUBEAU_BNPE_PRELEVEMENTS` | `candidate_for_v1_publication` |
| `HUBEAU_ADES` | `deferred_over_budget` |
| `HUBEAU_QUALITE_SURFACE` | `deferred_over_budget` |
| `HUBEAU_HYDROMETRIE` | `subdaily_identity_collision` |
| `EEA_WEI_PLUS` | `manual_artifact_required` |
| `WRI_AQUEDUCT` | `blocked_registration_required` |
| `COPERNICUS_EDO` | `source_verified_decoder_deferred` |

`deferred_over_budget` n'est **pas** un refus de la source : ADES est
`byte_stable` et son périmètre est exhaustif. C'est un report faute de place,
et la question qu'il pose au signataire est celle du périmètre, pas de la
qualité.

### 4.3 ⛔ Ce que cette recommandation ne lève PAS

`bnpe_minimal_pilot_v1` est la seule option **conforme au budget**. Elle n'est
pas pour autant publiable en l'état : `source_last_updated_on` n'est relevé
pour **aucune** des trois sources, BNPE comprise, et le dépôt établit déjà que
tant que ce champ est vide, le libellé d'attribution de la source **n'est pas
publiable** (X4A §2.2, `RISK_REGISTER.md`).

L'URL officielle rend la source **citable** ; elle ne rend pas l'attribution
**conforme**. Ce sont deux choses différentes, et les confondre est précisément
le défaut que la revue de X4A avait déjà signalé une fois.

**Conséquence pratique** : relever la date de dernière mise à jour de la BNPE
est un prérequis à la publication, pas une formalité postérieure. Le formulaire
§6 porte désormais un champ pour elle.

### 4.4 Ce que la recommandation ne dit pas

Trois observations sur une commune, c'est peu. La question de savoir si une
telle publication a un **sens éditorial** — plutôt que de démontrer seulement
que la chaîne fonctionne — n'est pas technique et n'est pas tranchée ici.

## 5. Risques résiduels, à connaître avant de signer

| # | Risque | État |
|---|---|---|
| 1 | Budget de 100 000 octets | ✅ **MESURÉ** — dépassé par 17 des 18 mesures ; seule BNPE/`34172` tient (6 120 o) |
| 2 | Variation de checksum ADES X3 → X4B-PREP | ✅ **RÉSOLU** — `byte_stable`, checksum identique sur 52 139 octets |
| 2 bis | Variation de checksum ADES X2A → X3, même longueur | **toujours non expliquée** — hors périmètre du run, reste due |
| 2 ter | Diff d'**identités** ADES (ajoutées / supprimées / modifiées) | **non produit** — le verdict porte sur les octets bruts, pas sur les identités |
| 3 | Cadence de mise à jour BNPE | **non vérifiée** — mensuelle non confirmée, annuelle déclarée sur data.gouv.fr |
| 4 | `source_last_updated_on` des trois sources | ⛔ **NON RELEVÉE — BLOQUANT.** La Licence Ouverte 2.0 exige la source **et la date de dernière mise à jour de l'Information réutilisée**. Le dépôt écrit déjà que **tant que ce champ est vide, le libellé d'attribution de la source n'est pas publiable** (X4A §2.2, `RISK_REGISTER.md`). L'URL officielle **ne remplace pas** ce fait : elle rend la source citable, pas l'attribution conforme. **S'applique aussi à BNPE**, donc à `bnpe_minimal_pilot_v1`. |
| 5 | Licence vérifiée au niveau **plateforme**, pas jeu par jeu | `license_scope = platform` inchangé |
| 6 | Allowlist SANDRE (Naïades) | à **valider explicitement** avant publication |
| 7 | Couverture partielle BNPE par construction | permanente — doit être affichée **à côté des valeurs**, pas en pied de page |
| 8 | Cadences ADES et Naïades relevées par lecture indexée | relevé direct horodaté **encore dû** |
| 9 | Aucune couche géographique | permanent en l'état — la carte ne montera pas |
| 10 | Publication de **3 observations** | le périmètre conforme est très étroit : la valeur éditoriale d'une telle publication est une question humaine, pas technique |
| 11 | Un contrôle de sécurité sauté par l'échec d'une étape métier | **corrigé** — les trois étapes de sortie passent en `if: always()`, mais cette exécution n'a pas encore été observée sur un run |

## 6. Formulaire de décision — **non signé**

Un seul formulaire : l'option choisie détermine les sources. Ne pas grouper les
sources sans nommer leur périmètre.

| Champ | Valeur | Décision |
|---|---|---|
| **Option retenue** (`A` / `B` / `C` / `bnpe_minimal_pilot_v1` / aucune) | | |
| Sources approuvées (énumérées, jamais « les sources Hub'Eau ») | | |
| Périmètres approuvés (géographie + période, par source) | | |
| Attributions retenues (libellé exact, octet pour octet) | | |
| URLs officielles retenues | | |
| **`source_last_updated_on`** par source — **bloquant tant qu'il est vide** | | |
| `display_allowed` | | |
| `derived_use_allowed` | | |
| Cadence BNPE — issue retenue (relever / annuelle data.gouv.fr / non vérifiée assumée) | | |
| Limites à afficher | | |
| `reviewer` | | |
| `reviewed_on` | | |
| **Décision** (`approved` / `rejected` / `deferred`) | | |
| Motif (obligatoire, quel que soit le verdict) | | |

## 7. Après signature

1. Reporter la décision, **y compris un refus ou un ajournement**, dans
   [`DECISION_LOG.md`](../DECISION_LOG.md).
2. Reporter un `approved` dans `CURRENT_DECISIONS`
   (`services/water_intelligence/publication_decisions.py`) avec `reviewed_by`
   **et** `reviewed_on` — la construction refuse un `approved` sans les deux.
3. Exécuter X4B selon
   [X4_PUBLICATION_IMPLEMENTATION_PLAN.md](X4_PUBLICATION_IMPLEMENTATION_PLAN.md),
   **uniquement** pour les sources signées, et en respectant l'étape 1 bis :
   les attributions par jeu sont déjà en place, le sort de la cadence doit
   l'être aussi.

## 8. Ce que ce document n'est pas

- Ce n'est pas une décision. Aucun champ n'est rempli, et aucun ne doit l'être
  par un modèle.
- Ce n'est plus un état non mesuré : les budgets, les comptes d'observations
  et le checksum ADES viennent du run `30306257628`. Ce qui manque encore est
  nommé comme manquant, jamais estimé.
- Ce n'est pas une autorisation de publier : le budget a **refusé les trois
  options**, et une condition de paternité reste **non levée** pour les trois
  sources (§5, risque 4). Une mesure conforme au budget ne rend pas une
  attribution conforme à sa licence.
