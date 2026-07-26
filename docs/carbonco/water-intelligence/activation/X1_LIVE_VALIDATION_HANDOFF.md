# X1.7 — Handoff : validation live des connecteurs Eau

**Phase :** X1 — validation live en lecture seule
**Branche :** `feat/water-connectors-live-validation`
**Base :** `master` à `5c189e9` (PR #162 fusionnée)
**Exécuté le :** 2026-07-26

**Écritures en base : 0. Publications : 0. Sources approuvées : 0. Migrations : 0.**

---

## 1. Verdict par source

| Source | Connexion | HTTP | Format reçu | Pages | Octets | Checksum (SHA-256) | Reçus | Normalisés | Rejetés | Absents | Unités | Périodes | Géographies | Warn. | Durée | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **EEA_WEI_PLUS** | établie | 200 | `application/json` (fiche ISO 19115) | 0 | 0 | — | 0 | 0 | 0 | 0 | — | 2000-01-01 → 2023-12-31 (déclarée) | — | 1 | 0,43 s | `decoder_deferred` |
| **HUBEAU_HYDROMETRIE** | établie | 200 | `application/json` | 1 | 12 451 | `738ed7f6089496b2…` | 0 | 0 | **32** | 0 | — | — | — | 0 | 0,14 s | `schema_drift` |
| **HUBEAU_ADES** (piézométrie) | établie | 200 | `application/json` | 1 | 52 139 | `52bc5f94759d7c96…` | **182** | **182** | 0 | 0 | `m NGF`, `m` | 2024-01-01 → 2024-03-31 | 1 station | 2 | 0,19 s | `ready_for_staging` |
| **HUBEAU_BNPE_PRELEVEMENTS** | établie | 206 | `application/json` | 1 | 46 369 | `338178bd32cc2df1…` | 0 | 0 | **50** | 0 | — | — | — | 0 | 0,15 s | `schema_drift` |
| **HUBEAU_QUALITE_SURFACE** | établie | 206 | `application/json` | 1 | 293 799 | `cc88d7071ad05926…` | **50** | **50** | 0 | 0 | `mg(NO3)/L`, `mg(NO2)/L` | 2024-01-03 → 2024-01-15 | 21 stations | 3 | 0,21 s | `ready_for_staging` |
| **WRI_AQUEDUCT** | *aucune, volontairement* | — | — | 0 | 0 | — | 0 | 0 | 0 | 0 | — | — | — | 1 | 0 s | `blocked` |
| **COPERNICUS_EDO** | établie | 200 | `text/html` | 0 | 0 | — | 0 | 0 | 0 | 0 | — | — | — | 2 | 0,40 s | `decoder_deferred` |

Rapports détaillés : `activation/reports/X1_*.md`. Chacun porte la table des
transferts, les bornes demandées, les paramètres de recette et le rapport JSON
structuré.

### Causes de rejet

- **HUBEAU_HYDROMETRIE** — `HubeauSchemaError : page 1 ligne 1 : grandeur 'HIXM' hors vocabulaire officiel ['H', 'Q']`
- **HUBEAU_BNPE_PRELEVEMENTS** — `HubeauUsageSchemaError : page 1 ligne 1 : année 2008 hors de la fenêtre demandée (2020-2021)`

---

## 2. Les deux défauts trouvés par la validation live

Aucun n'était visible en fixture. Les deux ont été trouvés au premier appel
réel, et aucun n'a été corrigé ici : X1 constate, X2 corrige.

### 2.1 Hydrométrie — le connecteur valide contre le mauvais vocabulaire

`parse_hydrometrie_pages` cible `obs_elab` — son docstring le dit — mais
valide `grandeur_hydro_elab` contre `HYDRO_QUANTITIES = {"Q", "H"}`, qui est
le vocabulaire du **temps réel** (`observations_tr`).

Mesuré, pas supposé. Sur la station `O400101101`, du 2026-06-01 au 2026-06-07 :

| `grandeur_hydro_elab` demandée | Réponse |
|---|---|
| `HIXM` | 200, `count=1` |
| `HIXnJ` | 206, `count=7` |
| `QINM` | 200, `count=1` |
| `QmM` | 200, `count=1` |
| `QmJ` | **400** `InvalidRequest` |
| `H` | **400** `InvalidRequest` |
| `Q` | **400** `InvalidRequest` |

Les deux seules valeurs que le connecteur accepte sont donc précisément celles
que la plateforme refuse.

Aggravant : **le payload ne porte aucun champ d'unité**. Les 14 champs servis
sont `code_methode`, `code_qualification`, `code_site`, `code_station`,
`code_statut`, `date_obs_elab`, `date_prod`, `grandeur_hydro_elab`,
`latitude`, `libelle_methode`, `libelle_qualification`, `libelle_statut`,
`longitude`, `resultat_obs_elab`. L'unité vient donc entièrement de la table
du connecteur — qui n'a pas d'entrée pour ces grandeurs. Élargir le
vocabulaire sans établir l'unité de chacune produirait des valeurs sans
dimension : c'est pourquoi rien n'a été élargi ici.

**Pour X2 :** établir, source officielle à l'appui, l'unité de chaque grandeur
élaborée retenue, puis étendre `HYDRO_QUANTITIES` — ou restreindre le
connecteur à `observations_tr`, dont le vocabulaire correspond déjà.

### 2.2 Prélèvements — la fenêtre temporelle n'est pas appliquée

Le socle déclare `annee_min`/`annee_max` comme fenêtre obligatoire de
`prelevements/chroniques`. La plateforme ne les implémente pas, et Hub'Eau
**ignore les paramètres inconnus au lieu de les rejeter**.

La preuve est un compte, pas une opinion — `code_departement=34` :

| Requête | `count` |
|---|---|
| sans filtre d'année | **9 724** |
| `annee_min=2020&annee_max=2021` | **9 724** |
| `annee=2020` | **782** |

Les deux premières lignes sont identiques : la borne n'existe pas. Le
paramètre réellement implémenté est `annee`.

C'est le défaut le plus sérieux des deux, parce qu'il est silencieux. Un
opérateur croit collecter deux années et reçoit tout l'historique depuis 2008 —
exactement l'« import national non borné » que le socle prétend interdire. Il
n'échoue bruyamment aujourd'hui que par accident : le parseur rejette ensuite
chaque ligne hors fenêtre. Le jour où quelqu'un assouplira ce rejet, la borne
aura disparu sans que rien ne le signale.

**Pour X2 :** remplacer `annee_min`/`annee_max` par `annee` dans
`_ENDPOINT_SPECS`, et ajouter un test qui refuse un paramètre de fenêtre non
implémenté par la plateforme.

---

## 3. Deux constats d'infrastructure

### 3.1 EEA — le conteneur officiel n'est pas décodable

La fiche ISO 19115 de la release épinglée répond en 200 (54 903 octets), et
les trois vérifications d'identité concordent : code de jeu
`eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00`, titre « Water
Exploitation Index plus (WEI+) at sub unit level, 2023 », licence CC-BY 4.0.

Mais la fiche décrit elle-même la distribution : « Spatial data in SHP format.
WEI+ data in Excel format ». Le connecteur ne décode ni l'un ni l'autre, et
documente pourquoi : les noms de colonnes du classeur officiel ne sont pas
publiés, donc il refuse de les deviner et impose un format canonique
(`spatialUnitIdentifier`, `year`, `quarter`, `wei_plus_pct`, `unit`).

Le chemin de téléchargement `webdav/datastore/public/<dataset_code>` redirige
vers une interface Nextcloud : le conteneur n'est pas récupérable par un GET
simple et borné.

**Pour X2 :** livrer la conversion classeur → CSV canonique comme geste
opérateur documenté, avec son checksum. `validate_eea --input <csv>` valide
déjà ce chemin de bout en bout.

### 3.2 Copernicus — le service a changé de domaine

`edo.jrc.ec.europa.eu` redirige désormais en trois sauts vers
`drought.emergency.copernicus.eu`. **Le Fetcher a refusé de suivre** : le
nouvel hôte n'était pas dans l'allowlist. C'est le comportement voulu — une
allowlist qui s'étend au gré des `Location` reçus n'est plus une allowlist.

L'hôte a ensuite été ajouté **à la main**, sur deux motifs vérifiables : la
redirection vient de l'hôte JRC déjà tenu pour officiel, et le domaine cible
est celui du Copernicus EMS, l'opérateur que le connecteur nomme lui-même
comme producteur du CDI. La chaîne complète est journalisée dans le rapport.

Aucun raster n'a été téléchargé, aucun octet décodé.

---

## 4. Ce qui a été livré

### Commandes opérateur — `apps/api/scripts/water_intelligence/`

| Fichier | Rôle |
|---|---|
| `fetcher.py` | Le SEUL module qui ouvre une connexion. HTTPS, allowlist par appel, timeout, budget d'octets, redirections revalidées à chaque saut, jamais d'URL venue d'une réponse, journal expurgé, checksum. |
| `validate_hubeau.py` | Les quatre familles. Acquisition bornée puis rejeu local du même payload dans le pipeline. |
| `validate_eea.py` | Vérification d'identité de release + validation d'un extrait canonique. |
| `discover_hubeau.py` | Découverte bornée d'un identifiant de station — aucun territoire en dur. |
| `verify_excluded_sources.py` | WRI (aucun réseau) et Copernicus (identité seule). |
| `replay.py` | `Transport` P03 sans notion d'URL, pour rejouer les octets déjà acquis. |
| `reporting.py` | Rapport expurgé. Refuse un verdict inconnu, un `dry_run=False`, un `records_publishable > 0`, un paramètre sensible non masqué. |

### Garanties structurelles, vérifiées par les tests

- `services/water_intelligence` n'importe **jamais** `scripts` — le paquet de
  services reste sans réseau, ce que vérifiait déjà son propre test AST.
- Seul `fetcher.py` importe un client réseau, dans tout `scripts/water_intelligence`.
- Aucun script n'importe de client de base de données.
- `dry_run=False` n'apparaît dans aucun script.
- Toute mention de `license_decision` vaut `license_decision=None` : la porte
  de licence reste fermée, donc `records_publishable` vaut 0 partout.
- Les tests eux-mêmes n'ouvrent aucune socket : `OperatorFetcher` reçoit son
  ouvreur par injection, et un test AST du fichier de tests refuse qu'on en
  construise un sans ouvreur injecté.

### Un défaut trouvé par ces tests

`test_a_refusal_is_journalised` a échoué à sa première exécution : une URL
refusée par l'allowlist **avant** tout transfert ne laissait aucune trace dans
le journal. Le rapport aurait affiché une table de transferts vide, laissant
croire que rien n'avait été tenté. Corrigé : le refus préalable est journalisé
comme les autres.

---

## 5. Vérifications

| Suite | Résultat |
|---|---|
| `pytest tests/test_water_intelligence_operator_scripts.py` | **44 passés** |
| `pytest tests` (suite API complète) | **1 872 passés, 730 ignorés** (DB-gated) |
| `ruff check . --select=E,F,I --ignore=E501` | **All checks passed** |
| Exécutions live | 7 sources, 12 transferts réels, tous bornés |

---

## 6. Ce que X1 n'a pas fait

- aucune écriture en base ; aucun graveur Evidence Kernel (X2) ;
- aucune release staging (X2) ;
- aucune décision de publication, aucune source approuvée (X4) ;
- aucune migration ;
- aucun frontend modifié ;
- aucune décision de licence changée — `unknown` reste `unknown` ;
- aucun connecteur corrigé : les deux défauts sont **documentés**, pas
  rattrapés ;
- aucune donnée committée. Les rapports portent des compteurs, des checksums
  et au plus cinq identifiants de station en échantillon ; jamais un extrait.

---

## 7. Entrée de X2

Ordre suggéré, du plus bloquant au moins bloquant :

1. **Corriger `annee_min`/`annee_max` → `annee`** (§2.2). C'est le seul défaut
   qui peut produire une collecte non bornée en silence.
2. **Trancher le vocabulaire hydrométrique** (§2.1) : étendre avec les unités
   établies, ou se restreindre à `observations_tr`.
3. **Livrer la conversion du classeur EEA** vers le CSV canonique (§3.1).
4. Puis seulement : graveur Evidence Kernel, releases staging, tests contre un
   vrai PostgreSQL.

Les deux sources `ready_for_staging` — **piézométrie** et **qualité de
surface** — sont les seules dont X2 peut ingérer un payload sans rien corriger
d'abord.
