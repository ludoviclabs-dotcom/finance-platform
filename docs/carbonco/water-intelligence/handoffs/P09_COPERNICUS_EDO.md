# P09 — Connecteur Copernicus EDO (Combined Drought Indicator)

**Livré dans :** Wave A (`feat/water-intelligence-wave-a-eu-connectors`).
**Contexte de vague, gate complet et décisions :**
[`WAVE_A_EU_CONNECTORS.md`](./WAVE_A_EU_CONNECTORS.md) §3.

> **Statut formel : `source_verified_decoder_deferred`**
> (`connectors/copernicus_edo.py::CONNECTOR_STATUS`, constante testée). Ni un
> échec de source, ni une source vivante : l'identité est **vérifiée et
> outillée** ; le décodage raster est **volontairement reporté** par décision
> MVP explicite — **aucune valeur de sécheresse n'est produite**. Voir §3 et
> §6.

---

## 1. Fichiers

| Fichier | Contenu |
|---|---|
| `apps/api/services/water_intelligence/connectors/copernicus_edo.py` | Identité vérifiée, configuration de snapshot décadaire, identification de conteneur, inspection d'artefact, intégration P03, statut formel `CONNECTOR_STATUS` |
| `apps/api/tests/test_water_intelligence_copernicus_edo.py` | 51 tests |

Aucun raster versionné : les artefacts de test sont des en-têtes de
conteneur minimaux construits en mémoire.

## 2. Identité vérifiée

- Produit : **Combined Drought Indicator (CDI) v4.1** (CEMS / EDO, JRC).
- Pas de temps : **décade** (10 jours) ; archives **depuis 2012**.
- Résolution **1/24 de degré décimal** (~5 km à l'équateur), **EPSG:4326**,
  emprise `-25 / 51 / 22 / 72`.
- **Sept classes**, codes 0-6, verbatim : `No drought`, `Watch`, `Warning`,
  `Alert`, `Recovery`, `Temporary Soil Moisture recovery`,
  `Temporary vegetation recovery`.
- Licence : **accès « free, full and open », règlement (UE) 2021/696**.
  Ce n'est **pas** du Creative Commons ; un test empêche de le présenter
  comme tel.
- Attribution : `Generated using Copernicus Emergency Management Service
  information [année]` / `Contains modified …` dès adaptation.
- **Avertissement officiel actif** transporté verbatim : signal trop sec du
  modèle hydrologique à l'est de la Pologne, CDI à interpréter avec prudence
  **depuis la mi-mai 2025**.

## 3. Blocage — pourquoi aucune observation n'est produite

Le portail officiel ne propose que **GeoTIFF** et **NetCDF** ; **aucun export
tabulaire n'existe**. Les décoder exigerait GDAL/rasterio ou
netCDF4/h5py/xarray — dépendances lourdes sans ADR. Aucun paramétrage
WMS/WCS n'a pu être vérifié.

Le connecteur lève donc `EdoRasterDecodingUnavailableError` au stage
`normalize`. Le pipeline produit un rapport qui **nomme le blocage** —
plutôt qu'un lot vide silencieux ou des valeurs approchées. Simuler une
couche raster était explicitement interdit par le prompt P09 ; c'est la
raison d'être de ce choix.

## 4. Critères d'acceptation P09

| Critère | État |
|---|---|
| Snapshot daté et reproductible | ✅ `EdoSnapshotConfig` (année, mois, décade) ; `release_key` déterministe ; aucun mot-clé mouvant n'existe par construction |
| Attribution visible | ✅ libellés officiels exacts, y compris la variante « modified » |
| Couche sous budget | ✅ `MAX_PAYLOAD_BYTES` sur l'artefact ; aucune couche produite (blocage) |
| Date et statut de fraîcheur affichés | ⛔ dépend de P10/P11 — non applicable tant qu'aucune valeur n'est produite |
| Absence rendue comme indisponible, jamais faible | ✅ le blocage est rapporté comme une **erreur nommée**, jamais comme une absence de sécheresse |

## 5. Interdictions P09 — comment elles sont tenues

- **Aucun appel WMS/WCS depuis le navigateur** : aucun frontend touché,
  aucun client HTTP importé (AST).
- **Aucune date flottante** : la décade est obligatoire et bornée ; aucune
  horloge implicite (AST : pas de `now()`/`today()`/`utcnow()`).
- **Aucune animation automatique d'archives** : rien de temporel n'est
  produit.
- **Aucune fusion avec le score de stress** : espaces de noms disjoints,
  aucun import ni identifiant `wei` dans le connecteur (AST).
- **Aucune fausse précision locale** : aucune valeur n'est produite du tout.

## 6. Décision MVP formalisée — `source_verified_decoder_deferred`

Cette décision a été explicitement demandée en revue de la PR #153 et
formalisée dans le commit de clôture de Wave A :

> Copernicus EDO est vérifié mais son décodage raster est reporté.

Garanties tenues pour le MVP (vérifiées par tests, dont une analyse AST des
imports/appels — pas une recherche de sous-chaîne, qui matcherait aussi la
docstring expliquant le blocage) :

- aucune dépendance GDAL/rasterio/netCDF4/xarray/h5py ajoutée ;
- aucune tentative de deviner un endpoint WMS/WCS (aucun littéral d'URL dans
  le module) ;
- aucune couche simulée, aucune valeur Copernicus publiée
  (`records_publishable == 0` systématiquement) ;
- source exclue des snapshots P10 (`PROJECT_STATE.yaml`, bloc
  `sources.COPERNICUS_EDO`) ;
- connecteur, configuration, tests et blocage conservés intacts.

Le statut est exposé comme une constante testée
(`copernicus_edo.CONNECTOR_STATUS == "source_verified_decoder_deferred"`),
délibérément distincte d'un statut d'échec : ni `"fail"` ni `"error"`
n'apparaissent dans le nom, `"verified"` et `"deferred"` si. Réévaluation
future réservée à une **ADR dédiée** — trois voies déjà documentées :

1. **ADR + dépendance raster** (rasterio ou netCDF4) : justification, licence,
   impact de taille, tests. Direct mais coûteux.
2. **Vérifier un service WMS/WCS officiel** (endpoint, couche, paramètres,
   format de réponse) et enregistrer les réponses comme artefacts opérateur.
   Léger, mais exige une vérification de source non réalisée à ce stade.
3. **Renoncer au CDI** pour la vague publique et documenter l'absence comme
   « indisponible » — jamais comme « pas de sécheresse ».

Tant que l'arbitrage n'est pas rendu, `COPERNICUS_EDO` doit être **exclu du
snapshot public** (P10) et inscrit comme exclusion explicite dans le manifest.
