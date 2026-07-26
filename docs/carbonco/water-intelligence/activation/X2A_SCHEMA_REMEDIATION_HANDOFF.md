# X2A — Handoff : correction des dérives de schéma détectées par X1

**Phase :** X2A — correction des dérives de schéma détectées pendant X1
**Branche :** `fix/water-connectors-x2a-schema-remediation`
**Base :** `master` à `5613561` (PR #162 et #163 fusionnées)
**Exécuté le :** 2026-07-26

**Écritures en base : 0. Publications : 0. Migrations : 0. Décisions de licence modifiées : 0.**

---

## 1. Ce que X1 avait trouvé, et ce que X2A corrige

X1 a validé sept sources en lecture seule et trouvé deux défauts réels de
schéma, tous deux documentés dans
`docs/carbonco/water-intelligence/activation/X1_LIVE_VALIDATION_HANDOFF.md`
§2. X2A les corrige — chacun dans son propre commit, jamais rafistolé au
passage d'une autre correction.

| Défaut trouvé par X1 | Cause | Correction X2A |
|---|---|---|
| Prélèvements : `annee_min`/`annee_max` ignorés en silence | Ces paramètres n'existent pas côté plateforme ; Hub'Eau ignore les paramètres inconnus au lieu de les rejeter | `annee`, une seule valeur par requête, orchestrée une fois par année |
| Hydrométrie : vocabulaire élaboré validé mais rejeté par la plateforme | Le parseur ciblait `obs_elab` en acceptant `{H, Q}` — le vocabulaire du temps réel, que `obs_elab` refuse en HTTP 400 | Bascule sur `observations_tr`, qui accepte réellement `H`/`Q` |

Un troisième point, non un défaut mais un trou d'outillage, est cadré dans le
même mouvement :

| Constat X1 | Cadrage X2A |
|---|---|
| EEA : conteneur officiel Excel/SHP, jamais obtenu, jamais décodé | Outillage d'inspection/conversion livré (`eea_artifact_inspector.py`) ; aucune donnée produite tant qu'aucun artefact réel n'a été vérifié par un humain |

---

## 2. BNPE — `annee_min`/`annee_max` → `annee`

### 2.1 Cause

Mesuré par X1 : sur `code_departement=34`, `count=9724` sans filtre,
`count=9724` avec `annee_min=2020&annee_max=2021` — identique —, `count=782`
avec `annee=2020`. Le socle déclarait une fenêtre à deux bornes
(`annee_min`/`annee_max`) qu'aucune n'implémente côté plateforme.

### 2.2 Correction

`services/water_intelligence/hubeau_transport.py` :

- `annee_min`/`annee_max` retirés de `allowed_parameters` de
  `prelevements.chroniques` — les envoyer lève désormais `HubeauQueryRefused`
  (« paramètre non déclaré »), jamais un envoi silencieux ;
- `annee` les remplace, seul dans `time_window_parameters` ;
- `HubeauEndpoint.time_window_parameters` généralisé de `tuple[str, str]` à
  `tuple[str, ...]` : certaines chroniques portent un couple début/fin, BNPE
  une seule valeur — aucune des deux formes n'est privilégiée par le socle ;
  `HubeauQuery.__post_init__` boucle sur ce tuple au lieu de le déballer à
  deux.

`scripts/water_intelligence/validate_hubeau.py` :
`run_prelevements_multi_year` orchestre une requête Hub'Eau **distincte par
année** demandée :

- `--max-years` **obligatoire**, vérifié **avant tout appel réseau** — une
  plage qui le dépasse est refusée, jamais silencieusement tronquée ;
- chaque année est parsée avec `WithdrawalsReleaseConfig(year_min=année,
  year_max=année)` — une fenêtre DÉGÉNÉRÉE à une seule valeur. Une ligne dont
  l'année réelle diffère lève `HubeauUsageSchemaError` **pour cette requête**,
  sans attendre qu'elle sorte d'une plage large qui l'aurait laissée passer ;
- budget d'octets borné PAR année (`--max-bytes`) ET globalement sur
  l'ensemble des années (`--max-total-bytes`, défaut = `--max-bytes`) ;
- chaque année exécute son propre `run_pipeline` (dry-run) ; les rapports
  sont agrégés en un `ValidationReport` unique — un échec sur une année
  n'efface pas le succès d'une autre, et apparaît explicitement dans
  `rejection_causes`, préfixé par l'année.

### 2.3 Résultat live (avant / après)

| | Avant (X1) | Après (X2A) |
|---|---|---|
| Verdict | `schema_drift` | `ready_for_staging` |
| Requête | `annee_min=2020&annee_max=2021` (inopérante) | `annee=2020` (année unique), puis `annee=2019` et `annee=2020` (plage réelle) |
| Résultat | 0 normalisé, 50 rejetés | Année unique : **50/50**. Plage 2019-2020 : **100/100**, **2 transferts HTTP distincts** (preuve directe de l'orchestration réelle) |

Rapports : `activation/reports/X2A_HUBEAU_PRELEVEMENTS.md` (année unique) et
`X2A_HUBEAU_PRELEVEMENTS_MULTIYEAR.md` (plage de deux ans).

---

## 3. Hydrométrie — `obs_elab` → `observations_tr`

### 3.1 Cause

Mesuré par X1 sur la station `O400101101` : `HIXM`/`HIXnJ`/`QINM`/`QmM`
répondent 200 sur `obs_elab` ; `H`/`Q`/`QmJ` y répondent 400. Le parseur
validait exactement le vocabulaire que l'endpoint interrogé refusait.

### 3.2 Décision et correction

Décision MVP : basculer sur `observations_tr`, VÉRIFIÉ EN DIRECT le
2026-07-26 (même station) — `grandeur_hydro=H` et `=Q` répondent 200 ; tout
autre code (essayé : `HIXM`) répond 400 avec « Wrong value(s), possibles
values are H or Q or H,Q » : la plateforme elle-même impose l'exclusivité du
vocabulaire déjà déclaré par le connecteur.

`services/water_intelligence/hubeau_transport.py` : nouvel endpoint
`hydrometrie.observations_tr` déclaré (`code_entite`, `grandeur_hydro`,
`date_debut_obs`/`date_fin_obs` — tous vérifiés en direct).
`hydrometrie.observations_elaborees` (`obs_elab`) **reste déclaré** — réel et
valide — mais aucune `HubeauFamily` n'y pointe plus.

`services/water_intelligence/connectors/hubeau_hydro.py` :
`parse_hydrometrie_pages` lit désormais `grandeur_hydro`, `date_obs`,
`resultat_obs` (noms réels d'`observations_tr`), sans repli vers les noms
`_elab`. `OBS_ELAB_STATUS = "derived_metrics_mapping_deferred"` documente
pourquoi `obs_elab` reste hors service : son vocabulaire élaboré n'a de
mapping d'unité vérifié dans aucune documentation officielle consultée, et
l'inventer romprait l'invariant « aucune dimension devinée ». Aucun fallback
automatique entre les deux endpoints n'existe — le choix reste explicite.

`HubeauMeasurement` porte désormais `status_label` (`libelle_statut` recopié
verbatim, jamais interprété), propagé jusque dans les métadonnées du draft.

### 3.3 Unités retenues

| Grandeur | Unité native | Conversion |
|---|---|---|
| `H` (hauteur) | millimètres (mm) | **Aucune** — jamais mm→m |
| `Q` (débit) | litres par seconde (l/s) | **Aucune** — jamais l/s→m³/s |

Aucun champ d'unité dans le payload réel (`unite`/`libelle_unite` valent
`null`) : ces deux valeurs viennent exclusivement de la table vérifiée du
connecteur (`HYDRO_QUANTITIES`), jamais de la source.

### 3.4 Résultat live (avant / après)

| | Avant (X1) | Après (X2A) |
|---|---|---|
| Verdict | `schema_drift` | `ready_for_staging` |
| Endpoint interrogé | `obs_elab` | `observations_tr` |
| Résultat | 0 normalisé, 32 rejetés (`HIXM` hors vocabulaire) | **200/200** normalisés, 0 rejeté (`grandeur_hydro=H`) |

Rapport : `activation/reports/X2A_HUBEAU_HYDROMETRIE.md`.

---

## 4. EEA — cadrage de l'acquisition (sans invention)

Aucun défaut à corriger ici : X1 avait déjà constaté que l'identité de la
release est vérifiable en direct, mais que le conteneur officiel (Excel +
SHP, derrière une interface Nextcloud) n'est ni récupérable par un GET borné,
ni décodable par le connecteur. X2A ne considère pas cela comme une panne et
cadre l'outillage manquant :

- `scripts/water_intelligence/eea_artifact_inspector.py` (nouveau) —
  `inspect_workbook()` ouvre un classeur LOCAL en lecture seule et constate
  feuilles et en-têtes réels, verbatim ; `has_macro_indicators()` signale un
  projet VBA sans jamais l'exécuter. Aucune dépendance ajoutée : `openpyxl`
  est déjà dans `requirements.txt` ;
- `ColumnMappingProfile` — correspondance feuille/colonnes → CSV canonique,
  VERSIONNÉE par release et signée (`verified_by`/`verified_on`) ;
  `MAPPING_PROFILES` reste **VIDE PAR CONSTRUCTION** : aucun artefact
  officiel réel n'a jamais été obtenu, et deviner une feuille ou une colonne
  romprait l'invariant déjà tenu par `eea_wei_plus.py` ;
- `validate_eea.py` inspecte désormais tout conteneur binaire local fourni
  via `--input`, et le convertit UNIQUEMENT si un profil vérifié existe pour
  la release demandée.

Le verdict `decoder_deferred` (X1) est retiré du vocabulaire d'EEA et
réservé à Copernicus, où il reste exact (décodeur RASTER non livré).
`manual_artifact_required` (nouveau, ajouté à `reporting.VERDICTS`) nomme
tel quel ce qui manque pour EEA : une vérification HUMAINE contre un
artefact réel, jamais une bibliothèque absente.

Résultat live : identité de release toujours vérifiée (code de jeu, titre,
licence CC-BY 4.0 concordent) ; verdict `manual_artifact_required`, sans
qu'aucune valeur n'ait été inventée. Rapport :
`activation/reports/X2A_EEA_WEI_PLUS.md`.

---

## 5. WRI et Copernicus — inchangés, revérifiés

| Source | Verdict | Constat |
|---|---|---|
| WRI_AQUEDUCT | `blocked` (`blocked_registration_required`) | Aucun appel réseau, comme en X1 — l'enregistrement reste non documenté |
| COPERNICUS_EDO | `decoder_deferred` (`source_verified_decoder_deferred`) | Un appel (identité du service), résultat inchangé — aucun décodage |

Les deux rapports `activation/reports/X1_WRI_AQUEDUCT.md` et
`X1_COPERNICUS_EDO.md` sont mis à jour en place (horodatage de la
revérification) ; aucune divergence de fond avec X1.

---

## 6. Limites restantes

- **BNPE** : l'orchestration multi-année n'a été vérifiée en direct que sur
  une plage de 2 ans (2019-2020). Le comportement à `--max-years` élevé
  (dizaines d'années) reste correct par construction (boucle identique) mais
  n'a pas été rejoué en direct sur une plage aussi large.
- **Hydrométrie** : `observations_tr` est validé sur UNE station
  (`O400101101`) et une fenêtre de quelques jours — suffisant pour qualifier
  le schéma, pas pour établir une couverture nationale.
- **EEA** : reste bloquée en pratique tant qu'un opérateur n'a pas obtenu un
  classeur officiel réel et rempli un `ColumnMappingProfile` vérifié. Aucune
  date ni engagement n'est pris ici sur ce point.
- **`obs_elab`** : demeure `derived_metrics_mapping_deferred`. Si ce
  vocabulaire devient nécessaire (ex. séries agrégées que `observations_tr`
  ne fournit pas), établir le mapping d'unité par grandeur AVANT de l'activer
  — jamais en l'inventant.

## 7. Sources prêtes pour X2B

Les quatre familles Hub'Eau sont désormais `ready_for_staging` : piézométrie,
qualité de surface, hydrométrie (corrigée) et prélèvements (corrigés).
EEA, WRI et Copernicus restent hors du périmètre d'ingestion X2B tant que
leurs conditions respectives (profil de correspondance, enregistrement,
décodeur) ne sont pas remplies.

---

## 8. Vérifications

| Suite | Résultat |
|---|---|
| `pytest tests/test_water_intelligence_operator_scripts.py` | **65 passés** |
| `pytest tests/test_water_intelligence_eea_artifact_inspector.py` | **17 passés** |
| `pytest tests/test_water_intelligence_hubeau_hydro.py` | **77 passés** |
| `pytest tests` (suite API complète) | **1 920 passés, 730 ignorés** (DB-gated) |
| `ruff check . --select=E,F,I --ignore=E501` | **All checks passed** |
| Exécutions live | 7 sources, dont 2 recettes BNPE (année unique + plage de 2 ans) |

Aucun appel réseau dans les tests (vérifié par AST, comme en X1). Aucune
base modifiée, aucune migration, aucun artefact brut dans Git, aucun
frontend touché, aucune source publiée, aucune décision humaine simulée.

## 9. Ce que X2A n'a pas fait

- aucune écriture en base ; aucun graveur Evidence Kernel (X2B) ;
- aucune release staging (X3) ;
- aucune décision de publication, aucune source approuvée (X4) ;
- aucune décision de licence changée — `unknown` reste `unknown` ;
- aucune refonte visuelle (Phase B) ;
- aucun artefact EEA obtenu ni committé — `MAPPING_PROFILES` reste vide.
