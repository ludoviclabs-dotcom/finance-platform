# Wave A — Connecteurs européens (P06 EEA/WISE/WEI+ + P09 Copernicus EDO)

**Branche :** `feat/water-intelligence-wave-a-eu-connectors`
**Base :** `master` @ `43136be` (PR #152 fusionnée, Vercel `carbon` et
`carbonco-api` en production `READY` sur ce SHA).
**Périmètre :** MACRO-PROMPT A du pack accéléré v2 uniquement. Wave B non
lancée.

---

## 1. Ce qui est livré

| Commit | Objet |
|---|---|
| `docs(carbon)` | Dépôt du pack accéléré de finalisation v2 (`ACCELERATED_CLOSEOUT_PACK_V2.md`) |
| `fix(carbon)` | A1 — alignement du résolveur géographique WRI sur le contrat P03 §5.4 |
| `feat(carbon)` | A2 — connecteur EEA / WISE / WEI+ |
| `feat(carbon)` | A3 — connecteur Copernicus EDO (avec blocage documenté) |
| `docs(carbon)` | A4 — handoffs, catalogue, pilotage |

**Aucune donnée n'est publiée.** Les deux connecteurs tournent en dry-run à
travers le pipeline P03. Aucun frontend, aucune route, aucune migration,
aucun appel réseau au runtime ni en test, aucun fichier lourd versionné.

---

## 2. Sous-phase A2 — EEA / WISE / WEI+

### 2.1 Gate source — CONCLUANT

Deux releases sœurs inspectées sur le DataHub EEA et le catalogue SDI,
édition `01.00`, publiées le **29 janvier 2026** :

| Échelle | Code de jeu | DOI |
|---|---|---|
| Sous-unité | `eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00` | `10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba` |
| Bassin | `eea_v_3035_250_k_wei-riverbasin-level_p_2023_v01_r00` | `10.2909/f25b4715-d18b-4f87-b869-7e96fd385700` |

Faits **vérifiés** et portés par le code :

- étendue temporelle **2000-01-01 → 2023-12-31**, moyennes **trimestrielles** ;
- vocabulaire de trimestre officiel : `Q1: Jan., Feb., Mar. / Q2: Apr., May,
  Jun. / Q3: Jul., Aug., Sep. / Q4: Oc., Nov., Dec.` ;
- unité : **pourcentage** — « total water consumption as a percentage of the
  renewable freshwater resources available » ;
- seuils officiels : **au-dessus de 20 %** « under stress », **au-dessus de
  40 %** stress « severe » (comparaison **strictement supérieure**, conforme
  au libellé « values above ») ;
- identifiant de jointure : **`spatialUnitIdentifier`** (tableur) ↔
  `thematicId` (SHP), liaison « filtered by year and quarter » ;
- référentiel spatial **EPSG:3035**, échelle équivalente **1:250 000** ;
- licence : **« License CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
  Copyright holder: European Environment Agency (EEA). »**, accès public sans
  limitation → stockage, affichage et usage dérivé permis **sous réserve
  d'attribution** ;
- méthode (lignée officielle) : moyenne trimestrielle par sous-unité
  2000-2023, comblement de lacunes sur les prélèvements, retours modélisés à
  partir des capacités de stations d'épuration, apports Copernicus pour les
  débits sortants et bilans de réservoirs, **fortes incertitudes signalées
  pour la Suisse et la France**.

### 2.2 Ce qui reste `unknown` — jamais comblé

1. **Le vocabulaire d'en-tête du classeur officiel.** Seul le nom du champ de
   jointure est documenté ; les noms exacts des colonnes d'année, de
   trimestre et de valeur ne le sont pas. Le connecteur définit donc un
   **format tabulaire canonique explicite** et la conversion depuis le
   classeur reste un **geste opérateur documenté** — même traitement qu'en
   P05 pour le conteneur WRI.
2. **Les libellés officiels des unités spatiales.** Aucun n'est repris : le
   `label` d'une géographie est l'identifiant lui-même. C'est délibéré —
   c'est ce qui rend une jointure par nom structurellement impossible.

### 2.3 Décisions structurantes

- **Aucune moyenne inter-bassins.** Le WEI+ est un **ratio**. En faire la
  moyenne arithmétique entre unités spatiales supposerait une pondération par
  les volumes, que cette release ne publie pas : ce serait un chiffre
  inventé. L'agrégat UE (`WeiPlusPeriodAggregate`) est donc une
  **distribution de comptes** — unités totales, renseignées, non
  renseignées, au-dessus de chacun des deux seuils — plus la **couverture**.
  Aucun champ `mean`/`avg` n'existe, et un test l'interdit explicitement.
- **La saison est portée par le `metric_code`** (`eea_wei_plus.subunit.q3.value_pct`)
  en plus de la date d'observation (premier jour du trimestre). Voir la
  limite P03 en §5.1.
- **Couverture ≠ stress.** Deux dimensions distinctes ; une couverture faible
  n'est jamais présentée comme un stress faible.
- **Comparatif borné.** `bounded_periods()` refuse au-delà de
  `MAX_COMPARISON_PERIODS` (8) plutôt que de tronquer en silence.
- **Descripteur de couche sans géométrie.** `feature_count` borné à 1 000
  (budget P02) ; `payload_bytes_gzip=None` tant qu'aucune géométrie n'existe
   — un poids annoncé sans mesure serait inventé. Les frontières officielles
  restent hors dépôt.

### 2.4 Geste opérateur

1. Télécharger la release voulue depuis le DataHub EEA (classeur Excel).
2. La convertir en CSV canonique **format long**, une ligne par unité et par
   trimestre :
   `spatialUnitIdentifier,year,quarter,wei_plus_pct[,unit]`.
3. Fournir ces octets au connecteur avec une `release_key` explicite.

---

## 3. Sous-phase A3 — Copernicus EDO

### 3.1 Gate source — CONCLUANT sur l'identité, BLOQUANT sur l'accès

Produit retenu : **Combined Drought Indicator (CDI) v4.1**, Copernicus
Emergency Management Service / European Drought Observatory (JRC).

Faits **vérifiés** et portés par le code :

- pas de temps **décadaire** (10 jours) ; archives proposées **depuis 2012** ;
- résolution **1/24 de degré décimal** (« around 5 km at the Equator »),
  CRS **EPSG:4326**, emprise `xmin -25 / xmax 51 / ymin 22 / ymax 72` ;
- **sept classes**, codes 0 à 6, recopiées verbatim : `0 No drought`,
  `1 Watch`, `2 Warning`, `3 Alert`, `4 Recovery`,
  `5 Temporary Soil Moisture recovery`, `6 Temporary vegetation recovery` ;
- licence : accès **« free, full and open »** au titre du **règlement (UE)
  2021/696**, sans garantie. **Ce n'est pas une licence Creative Commons** et
  le code ne la présente pas comme telle ;
- attribution imposée : `Generated using Copernicus Emergency Management
  Service information [année]`, et `Contains modified Copernicus Emergency
  Management Service information [année]` dès adaptation ;
- **avertissement officiel en vigueur**, transporté verbatim jusqu'au
  lecteur : le modèle hydrologique donne un signal trop sec à l'est de la
  Pologne ; LFI, SMI Anomaly et **CDI** doivent être interprétés avec
  prudence **depuis la mi-mai 2025**, surtout dans la partie orientale du
  domaine (correctif annoncé pour la prochaine mise à jour EDO, EFAS v6.0,
  fin 2026).

### 3.2 Blocage — assumé, documenté, non contourné

Le portail officiel ne propose que **deux formats : GeoTIFF (`tif`) et
NetCDF (`nc`)** — vérifié directement sur son sélecteur de format. **Aucun
export tabulaire ou CSV n'existe.**

Les décoder correctement (compression, tuilage, valeurs manquantes,
géoréférencement) exigerait **GDAL/rasterio** ou **netCDF4/h5py/xarray** :
dépendances lourdes qu'**aucun ADR n'autorise** et qu'aucune mesure d'impact
ne justifie à ce stade. Par ailleurs **aucun paramétrage WMS/WCS n'a pu être
vérifié** — point d'entrée, nom de couche et format de réponse restent
`unknown`, et les inventer aurait été une fabrication.

Conformément à la consigne P09 (« si aucun chemin robuste n'existe : livrer
gate source, configuration, contrat, fixtures et tests ; documenter le
blocage ; ne pas simuler une couche raster »), le connecteur livre :

- l'identité vérifiée de la source (ci-dessus) ;
- `EdoSnapshotConfig` : décade **explicite** (année, mois, décade), bornes de
  validité, clé de release déterministe `copernicus-edo-cdi-v4.1-YYYYMMdD`.
  Aucun mot-clé mouvant n'existe **par construction** — il n'y a aucun chemin
  pour demander « la dernière carte » ;
- `identify_payload_format()` : identification du **conteneur** par nombre
  magique (TIFF/BigTIFF, NetCDF classic/64-bit, HDF5). C'est une
  identification de format, **jamais un décodage de pixels** ;
- `inspect_artifact()` : budget (`MAX_PAYLOAD_BYTES`), format déclaré ==
  format observé, checksum SHA-256 déterministe ;
- un `normalizer` qui valide l'artefact puis lève
  **`EdoRasterDecodingUnavailableError`**. Branché sur `run_pipeline`, il
  produit un rapport d'exécution qui **nomme le blocage** — jamais un lot
  vide qui aurait l'air normal, jamais une valeur de sécheresse inventée.

### 3.3 Sécheresse courante ≠ stress structurel

Invariant tenu par construction : les espaces de noms de métriques sont
disjoints (`copernicus_edo.cdi.` vs `eea_wei_plus.`), les `source_code` et
les `MethodRef` diffèrent, et **aucun chemin de code** du connecteur EDO ne
référence le WEI+ ni ses seuils (vérifié sur l'AST : ni import, ni
identifiant). La docstring, elle, mentionne délibérément le WEI+ pour
*expliquer* la distinction — c'est de la documentation, pas un couplage.

### 3.4 Pour débloquer (décision humaine requise)

Trois voies, à arbitrer hors de cette vague :

1. **ADR + dépendance raster** (rasterio ou netCDF4) avec justification,
   analyse de licence, impact de taille et tests — le chemin le plus direct,
   le plus coûteux.
2. **Vérifier un service WMS/WCS officiel** (endpoint, couche, paramètres,
   format de réponse) et enregistrer des réponses comme artefacts opérateur.
   Léger, mais exige une vérification de source qui n'a pas pu être faite ici.
3. **Renoncer au CDI** pour la vague publique et documenter l'absence comme
   « indisponible », jamais comme « pas de sécheresse ».

---

## 4. Commit A1 — résolveur géographique WRI

Le préflight P06 demandait de vérifier qu'une géographie inconnue lève bien
`PipelineDataUnavailableError` au stage `derive`. **Ce n'était pas le cas.**

`build_geography_resolver()` du connecteur WRI levait `AqueductSchemaError`
(donc `AdapterError`), alors que `derive_observations()` ne capture que
`PipelineDataUnavailableError` autour du résolveur (contrat P03 §5.4). Une
géographie inconnue serait donc remontée en **exception nue** hors de
`run_pipeline()`, cassant la garantie « toujours un rapport » pour un cas
pourtant attendu. C'est exactement l'écart signalé — et volontairement non
corrigé — en P03C §6.

Correction : `AqueductGeographyUnavailableError(PipelineDataUnavailableError)`.
N'hérite **volontairement pas** d'`AqueductError`/`AdapterError` : les deux
familles restent distinctes, un même échec n'est jamais capturable à deux
stages différents. Aucune règle métier, licence, attribution ou décision
d'enregistrement WRI n'est touchée.

Le même contrat est appliqué d'emblée au connecteur EEA
(`WeiPlusGeographyUnavailableError`).

---

## 5. Limites connues et risques résiduels

### 5.1 P03 aplatit la période sur une date unique

`derive_observations()` fixe `period_start == period_end ==
draft.observed_at.date()` et **ne recopie pas** `ObservationDraft.metadata`
dans le candidat `WaterMetricObservation`. Une période trimestrielle ne peut
donc pas être portée telle quelle par le read model P02 aujourd'hui.

Contournement retenu, sans modifier P03 : le trimestre est encodé dans le
`metric_code` (`…q3.value_pct`) et la date d'observation est le premier jour
du trimestre — l'information reste complète et non ambiguë. **À arbitrer en
P10** : soit `derive` propage `period_start`/`period_end` et les métadonnées
du draft, soit la convention de `metric_code` devient la règle officielle.

### 5.2 Incertitudes de source à propager

- WEI+ : incertitudes élevées signalées par l'EEA pour la **Suisse** et la
  **France** (données modélisées en baseline).
- CDI : avertissement officiel actif depuis la **mi-mai 2025** (§3.1).

Ces deux faits ne doivent pas disparaître entre la source et le lecteur.

### 5.3 Décision WRI — toujours ouverte

L'enregistrement demandé par WRI pour partager/adapter Aqueduct **n'est
toujours pas effectué**. Aucune valeur Aqueduct ne peut être publiée
publiquement tant qu'un humain n'a pas tranché. Wave A ne modifie pas cette
décision et n'y touche pas.

### 5.4 Licences vérifiées ≠ publication autorisée

CC-BY 4.0 (EEA) et l'accès libre CEMS **permettent** stockage, affichage et
usage dérivé sous attribution. Cela ne vaut **pas** décision de publication :
la porte de licence reste pilotée par l'appelant (`license_decision` de
`run_pipeline`). Aucun connecteur ne construit de `WaterLicenseDecision` —
deux tests l'interdisent explicitement. Sans décision fournie, tout est
`value_withheld`.

---

## 6. Ce qui n'est PAS livré

- aucune donnée publiée sur `/water-intelligence` ;
- aucune modification du cockpit `/water` ;
- aucune migration (dernière en base : `043`) ;
- aucun frontend, aucune route, aucun composant ;
- aucun `source_registry` réel, aucun graveur Evidence Kernel
  (`publish_dry_run(dry_run=False)` lève toujours) ;
- aucune couche cartographique, aucune géométrie ;
- aucune dépendance nouvelle ;
- aucun décodage de grille raster (§3.2).

---

## 7. Validation

| Contrôle | Résultat |
|---|---|
| Tests EEA WEI+ | 79 |
| Tests Copernicus EDO | 48 |
| Tests WRI (dont 4 nouveaux A1) | 68 |
| Tests P03/P03B/P03C, contrats, catalogue | inchangés, verts |
| Suite Water Intelligence complète | verte |
| Suite API complète | verte |
| `ruff` | propre |
| Frontend / migration / fichier lourd / fetch runtime | aucun |

---

## 8. Passage à Wave B

Wave B (`feat/water-intelligence-wave-b-hubeau`) mutualise transport,
pagination, bornes et référentiels Hub'Eau. Points d'attention hérités :

1. Le socle Hub'Eau sera le **premier transport réellement réseau** du
   chantier : `Transport.fetch_page()` (contrat P03) est le seul point
   d'insertion prévu, avec allowlist d'hôtes, timeout, retry borné, backoff
   et limites de pages/octets.
2. Le contrat d'erreur est désormais établi et outillé des deux côtés :
   `AdapterError` en `parse`/`normalize`, `PipelineDataUnavailableError` en
   `derive`. Les sous-connecteurs Hub'Eau doivent le respecter d'emblée.
3. La limite §5.1 (période aplatie) touchera aussi les chroniques Hub'Eau :
   l'arbitrage P10 devra être rendu avant, ou la convention `metric_code`
   reprise à l'identique.
4. Hub'Eau expose de vraies séries temporelles : la règle « aucun historique
   complet non borné » sera bien plus contraignante qu'ici — prévoir fenêtre
   temporelle et filtre géographique **obligatoires**, comme le prescrit le
   MACRO-PROMPT B.
