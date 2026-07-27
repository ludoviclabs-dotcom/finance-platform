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

## 1. Avertissement de lecture — ce paquet n'est pas encore décidable

Les colonnes « observations exactes », « tailles exactes » et « checksums
exacts du run » sont **vides**. Elles ne se remplissent que par un
`workflow_dispatch` de `water-x4b-candidate-builder.yml`, qui n'a pas pu avoir
lieu : Hub'Eau est injoignable depuis l'environnement de la phase
(`CONNECT tunnel failed, response 403`), et GitHub n'expose `workflow_dispatch`
que pour un workflow présent sur la branche par défaut.

**Signer sans ces valeurs reviendrait à approuver un périmètre dont on ignore
s'il tient dans le budget.** Le §5.4 du plan X4B l'interdit déjà en toutes
lettres. L'ordre correct est : fusionner la machinerie, déclencher le workflow,
reporter les mesures ici, puis signer.

## 2. Les trois options

### Option A — pilote minimal

| Rubrique | Valeur |
|---|---|
| Sources | `HUBEAU_ADES` seule |
| Périmètre | station BSS `09892X0679/EXH70`, 2024-01-01 → 2024-03-31 |
| Pourquoi | Seule des trois dont l'acquisition X3 n'était **pas tronquée** (182 sur une page de 200) |
| Observations exactes | **NON MESURÉ** |
| Taille exacte / marge | **NON MESURÉ** |
| Checksum exact du run | **NON MESURÉ** |
| Attribution | `Source : Hub'Eau — API Piézométrie. Données issues d'ADES et des partenaires du Système d'information sur l'eau. Licence Ouverte / Etalab 2.0. Source officielle : https://hubeau.eaufrance.fr/page/api-piezometrie. Consultées le <date>.` |
| URL officielle | <https://hubeau.eaufrance.fr/page/api-piezometrie> |
| Cadence source | intégration **quotidienne** des mises à jour ADES — relevée |
| Dernière mise à jour source | **non relevée** — conformité portée par l'URL officielle |
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

Observations exactes, tailles exactes, checksums exacts : **NON MESURÉ**.

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

## 4. Recommandation technique

**NON DISPONIBLE** tant que les budgets ne sont pas mesurés. Le constructeur
recommandera automatiquement le plus grand candidat conforme au budget sans
perte de provenance — et cette recommandation ne vaudra **aucune approbation
humaine** : elle dira ce qui tient techniquement, pas ce qu'il est juste de
publier.

## 5. Risques résiduels, à connaître avant de signer

| # | Risque | État |
|---|---|---|
| 1 | Budget de 100 000 octets probablement dépassé par les 282 observations X3 | **estimé** (250–350 ko), non mesuré |
| 2 | Variation de checksum ADES entre X2A et X3, même longueur | **non expliquée** — exige un diff, `content_changed` bloquerait ADES |
| 3 | Cadence de mise à jour BNPE | **non vérifiée** — mensuelle non confirmée, annuelle déclarée sur data.gouv.fr |
| 4 | `source_last_updated_on` des trois sources | **non relevée** — conformité de paternité portée par l'URL officielle |
| 5 | Licence vérifiée au niveau **plateforme**, pas jeu par jeu | `license_scope = platform` inchangé |
| 6 | Allowlist SANDRE (Naïades) | à **valider explicitement** avant publication |
| 7 | Couverture partielle BNPE par construction | permanente — doit être affichée **à côté des valeurs**, pas en pied de page |
| 8 | Cadences ADES et Naïades relevées par lecture indexée | relevé direct horodaté **encore dû** |
| 9 | Aucune couche géographique | permanent en l'état — la carte ne montera pas |

## 6. Formulaire de décision — **non signé**

Un seul formulaire : l'option choisie détermine les sources. Ne pas grouper les
sources sans nommer leur périmètre.

| Champ | Valeur | Décision |
|---|---|---|
| **Option retenue** (`A` / `B` / `C` / aucune) | | |
| Sources approuvées (énumérées, jamais « les sources Hub'Eau ») | | |
| Périmètres approuvés (géographie + période, par source) | | |
| Attributions retenues (libellé exact, octet pour octet) | | |
| URLs officielles retenues | | |
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
- Ce n'est pas un état mesuré : les chiffres exacts manquent, et sont nommés
  comme manquants.
- Ce n'est pas une garantie de faisabilité : le budget peut refuser les trois
  options, et c'est un résultat possible du premier dispatch.
