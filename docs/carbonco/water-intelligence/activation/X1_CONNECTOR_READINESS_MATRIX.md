# X1.1 — Matrice de préparation live des connecteurs Eau

**Phase :** X1 — validation live en lecture seule
**Établie le :** 2026-07-26, sur `master` à `5c189e9`
**Méthode :** lecture du code livré, pas des fixtures.

> **Mise à jour X2A (2026-07-26)** — les sections 3.1 (hydrométrie) et 3.3
> (prélèvements) sont corrigées pour refléter l'état RÉEL après remédiation :
> le tableau ci-dessous, lui, reste tel qu'établi par X1 et documente
> l'analyse qui a conduit aux deux correctifs. Détail complet, y compris les
> résultats live après correction :
> `docs/carbonco/water-intelligence/activation/X2A_SCHEMA_REMEDIATION_HANDOFF.md`.

> Le pack l'exige explicitement : « Ne pas conclure "live" sur la seule base
> des fixtures ». Chaque colonne ci-dessous a donc été renseignée en ouvrant
> le module concerné. La colonne **acquisition réelle** distingue ce qui existe
> (un parseur, un normaliseur) de ce qui manque (un moyen d'obtenir les
> octets) — c'est cette colonne, et elle seule, qui décide si une source est
> validable en X1.

---

## 1. Vue d'ensemble

| Source | Module | Acquisition réelle avant X1 | Blocage résiduel |
|---|---|---|---|
| EEA WEI+ | `connectors/eea_wei_plus.py` | ❌ octets fournis par l'opérateur | conteneur officiel Excel/SHP non décodé |
| Hub'Eau hydrométrie | `connectors/hubeau_hydro.py` | ⚠️ socle borné, aucun `Fetcher` | vocabulaire de grandeurs |
| Hub'Eau piézométrie | `connectors/hubeau_hydro.py` | ⚠️ socle borné, aucun `Fetcher` | aucun |
| Hub'Eau prélèvements | `connectors/hubeau_withdrawals_quality.py` | ⚠️ socle borné, aucun `Fetcher` | filtre d'année inopérant |
| Hub'Eau qualité surface | `connectors/hubeau_withdrawals_quality.py` | ⚠️ socle borné, aucun `Fetcher` | aucun |
| WRI Aqueduct | `connectors/wri_aqueduct.py` | ❌ interdite | enregistrement WRI non documenté |
| Copernicus EDO | `connectors/copernicus_edo.py` | ❌ hors périmètre | décodeur raster reporté |

Le `Fetcher` manquant est livré par X1
(`scripts/water_intelligence/fetcher.py`). Les blocages résiduels sont ceux
que la validation live a **révélés**, pas ceux qu'on anticipait.

---

## 2. EEA / WISE / WEI+

| Rubrique | Valeur |
|---|---|
| Module | `services/water_intelligence/connectors/eea_wei_plus.py` |
| Code source | `EEA_WEI_PLUS` |
| Format attendu par le connecteur | CSV canonique long, `TextPageDecoder` |
| Format réellement publié | Excel (WEI+) + SHP (spatial), joints par `spatialUnitIdentifier` / `thematicId` |
| Release / version | `eea_v_3035_250_k_wei-subunit-level_p_2023_v01_r00`, édition `01.00`, DOI `10.2909/b16bd284-f2ec-4164-90b7-674c1de399ba` — et la release sœur `riverbasin` |
| Acquisition réelle | Non. Le module ne télécharge rien et le documente. |
| Parser | `parse_wei_plus_csv` — schéma CLOS : toute colonne hors `CANONICAL_COLUMNS` est refusée |
| Normalizer | `build_normalizer(config)` |
| Geography resolver | `build_geography_resolver(rows)` — `spatialUnitIdentifier` uniquement, jamais un libellé |
| Period resolver | `build_period_resolver()` — trimestre → `period_start`/`period_end` |
| Licence | CC-BY 4.0, détenteur EEA — **lue** sur la fiche officielle, jamais décidée ici |
| Attribution | `WeiPlusReleaseConfig.attribution()`, composée (l'EEA ne publie pas de gabarit imposé) |
| Budgets | `MAX_LAYER_FEATURES = 1000`, `MAX_COMPARISON_PERIODS = 8` |
| Paramètres obligatoires | `release_key` explicite ; `scale` ∈ {`subunit`, `riverbasin`} ; unité déclarée = `%` |
| Blocage | Les noms de colonnes du classeur officiel ne sont pas publiés. Le connecteur refuse de les deviner et impose un format canonique. |
| Outillage opérateur (X2A) | `scripts/water_intelligence/eea_artifact_inspector.py` — inspecte un classeur local RÉEL (feuilles, en-têtes, macro) et convertit vers le CSV canonique UNE FOIS qu'un `ColumnMappingProfile` vérifié existe. `MAPPING_PROFILES` reste **VIDE** : aucun artefact officiel réel n'a été obtenu (lien de téléchargement → interface Nextcloud). Verdict tant qu'aucun profil n'existe : `manual_artifact_required` (remplace `decoder_deferred`, réservé depuis X2A à Copernicus). |
| Commande | `python -m scripts.water_intelligence.validate_eea --release subunit [--input <fichier_local_ou_url>] --dry-run --report <chemin>` |

---

## 3. Hub'Eau — socle commun

| Rubrique | Valeur |
|---|---|
| Module | `services/water_intelligence/hubeau_transport.py` |
| Hôte allowlisté | `hubeau.eaufrance.fr` uniquement (`hubeau.brgm-rec.fr`, recette, exclu) |
| Endpoints composables | 6, déclarés — aucune URL arbitraire, aucun suivi du champ `next` |
| Licence | Licence Ouverte Etalab ; éditeurs OFB, SCV, BRGM |
| Attribution | `hubeau_transport.attribution(accessed_on=…)` |
| Budgets plateforme | profondeur `page × size ≤ 20 000` ; `size ≤ 20 000` |
| Budgets du socle | `DEFAULT_MAX_PAGES = 5`, `DEFAULT_MAX_TOTAL_BYTES = 5 000 000`, `DEFAULT_TIMEOUT_SECONDS = 20` |
| Reprises | `HubeauRetryPolicy` — 3 tentatives, backoff ×2, uniquement sur 429/500/502/503/504 et timeout |
| Acquisition réelle avant X1 | **Aucune.** Le `Fetcher` est un point d'injection ; personne ne le fournissait. |
| Statut licence au catalogue | `unknown` pour les quatre familles — donc aucune valeur publiable, par construction |

### 3.1 Hydrométrie

**État X1 (avant correction), pour mémoire :**

| Rubrique | Valeur |
|---|---|
| Code source | `HUBEAU_HYDROMETRIE` |
| Endpoint | `hydrometrie.observations_elaborees` → `/api/v2/hydrometrie/obs_elab` |
| Filtre géographique obligatoire | `code_entite` |
| Fenêtre obligatoire | `date_debut_obs_elab` / `date_fin_obs_elab` |
| Parser | `parse_hydrometrie_pages` |
| Vocabulaire attendu | `HYDRO_QUANTITIES = {Q → débit l/s, H → hauteur mm}` |
| **Vocabulaire réellement servi** | `HIXM`, `HIXnJ`, `QINM`, `QmM` — et `H`/`Q` sont **rejetés en HTTP 400** par la plateforme |
| Blocage | Le connecteur valide contre le vocabulaire du temps réel (`observations_tr`), alors que son parseur cible les observations **élaborées**. Aucune unité n'est servie par la source : la table du connecteur est la seule origine de l'unité, et elle n'a pas d'entrée pour ces grandeurs. |

**État X2A (après correction, VÉRIFIÉ EN DIRECT le 2026-07-26) :**

| Rubrique | Valeur |
|---|---|
| Endpoint | `hydrometrie.observations_tr` → `/api/v2/hydrometrie/observations_tr` (nouvel endpoint déclaré au socle) |
| Fenêtre | `date_debut_obs` / `date_fin_obs` |
| Vocabulaire | `grandeur_hydro` ∈ {`H`, `Q`} — VÉRIFIÉ accepté (HTTP 200), tout autre code (essayé : `HIXM`) refusé en HTTP 400 par la plateforme elle-même |
| Champs réels | `code_station`, `grandeur_hydro`, `date_obs`, `resultat_obs`, `libelle_statut` — aucun champ d'unité, `HYDRO_QUANTITIES` reste la seule source d'unité |
| `obs_elab` | Reste déclaré au socle (endpoint réel), statut `hubeau_hydro.OBS_ELAB_STATUS = "derived_metrics_mapping_deferred"` — aucune `HubeauFamily` n'y pointe plus, aucun fallback automatique |
| Blocage | Aucun. |
| Résultat live (X2A) | 200/200 lignes reçues, normalisées, 0 rejet |
| Commande | `validate_hubeau --source hydrometrie --geography-type code_entite --geography-code <code>` |

### 3.2 Piézométrie

| Rubrique | Valeur |
|---|---|
| Code source | `HUBEAU_ADES` |
| Endpoint | `piezometrie.chroniques` → `/api/v1/niveaux_nappes/chroniques` |
| Filtre géographique obligatoire | `code_bss` |
| Fenêtre obligatoire | `date_debut_mesure` / `date_fin_mesure` |
| Parser | `parse_piezometrie_pages` |
| Vocabulaire | `niveau_nappe_eau` (m NGF) et `profondeur_nappe` (m) — deux métriques distinctes, de sens opposé |
| Blocage | Aucun. Vocabulaire et unités concordent avec le payload réel. |
| Commande X1 | `validate_hubeau --source piezometrie --geography-type code_bss --geography-code <code>` |

### 3.3 Prélèvements (BNPE)

**État X1 (avant correction), pour mémoire :**

| Rubrique | Valeur |
|---|---|
| Code source | `HUBEAU_BNPE_PRELEVEMENTS` |
| Endpoint | `prelevements.chroniques` → `/api/v1/prelevements/chroniques` |
| Filtre géographique obligatoire | `code_commune_insee`, `code_departement` ou `code_ouvrage` |
| Fenêtre déclarée par le socle | `annee_min` / `annee_max` |
| **Fenêtre réellement implémentée** | `annee` — `annee_min`/`annee_max` sont **ignorés en silence** |
| Blocage | La borne temporelle n'existe pas côté plateforme. Hub'Eau ignore les paramètres inconnus au lieu de les rejeter : l'opérateur croit sa collecte bornée à deux années et reçoit tout l'historique. |

**État X2A (après correction, VÉRIFIÉ EN DIRECT le 2026-07-26) :**

| Rubrique | Valeur |
|---|---|
| Fenêtre | `annee` — une SEULE valeur par requête, refusée si `annee_min`/`annee_max` sont fournis (`HubeauQueryRefused`, paramètre non déclaré) |
| Orchestration | `scripts.water_intelligence.validate_hubeau.run_prelevements_multi_year` — une requête Hub'Eau PAR ANNÉE demandée, `--max-years` obligatoire (refus avant tout appel réseau si dépassé), budget d'octets borné par année ET cumulé (`--max-total-bytes`) |
| Contrat par ligne | Chaque année parsée avec `WithdrawalsReleaseConfig(year_min=année, year_max=année)` — une ligne d'une autre année lève `HubeauUsageSchemaError` pour CETTE requête, jamais masquée par une plage large |
| Parser | `parse_withdrawals_pages` (inchangé) ; unité `m3` ; volume absent ≠ volume nul |
| Blocage | Aucun. |
| Résultat live (X2A) | Année unique (2020) : 50/50. Plage réelle 2019-2020 (`--max-years 2`) : **2 transferts HTTP distincts**, un par année, 100/100 normalisés. |
| Commande | `validate_hubeau --source prelevements --geography-type code_departement --geography-code <code> --date-from <AAAA> --date-to <AAAA> --max-years <n>` |

### 3.4 Qualité des rivières (Naïades)

| Rubrique | Valeur |
|---|---|
| Code source | `HUBEAU_QUALITE_SURFACE` |
| Endpoint | `qualite_rivieres.analyses` → `/api/v2/qualite_rivieres/analyse_pc` |
| Filtre géographique obligatoire | `code_station`, `code_commune` ou `code_departement` |
| Fenêtre obligatoire | `date_debut_prelevement` / `date_fin_prelevement` |
| Parser | `parse_quality_pages` — un paramètre hors allowlist est **refusé**, jamais ignoré |
| Allowlist SANDRE | `1340` Nitrates, `1339` Nitrites — chacune sourcée sur le référentiel |
| Blocage | Aucun. |
| Commande X1 | `validate_hubeau --source qualite_surface --parameter-code 1340 --parameter-code 1339 …` |

---

## 4. WRI Aqueduct

| Rubrique | Valeur |
|---|---|
| Module | `services/water_intelligence/connectors/wri_aqueduct.py` |
| Code source | `WRI_AQUEDUCT` |
| Release / version | Aqueduct 4.0, publiée le 2023-08-16 |
| Acquisition réelle | **Interdite** tant que l'enregistrement n'est pas documenté |
| Parser / Normalizer / Resolver | Livrés et testés |
| Licence | CC-BY 4.0 ; gabarit d'attribution officiel imposé par le WRI |
| Blocage | `blocked_registration_required`. Acte contractuel qu'aucun script ne peut effectuer ni attester. |
| Commande X1 | `verify_excluded_sources` — constate le blocage, **sans aucun appel réseau** |

---

## 5. Copernicus EDO

| Rubrique | Valeur |
|---|---|
| Module | `services/water_intelligence/connectors/copernicus_edo.py` |
| Code source | `COPERNICUS_EDO` |
| Produit | Combined Drought Indicator (CDI) v4.1, CEMS/EDO/JRC |
| Formats publiés | `tif`, `nc` |
| Acquisition réelle | Identité seule ; aucun décodage, aucun téléchargement de raster |
| Licence | Copernicus EMS free-full-open, règlement (UE) 2021/696 |
| Budgets | `MAX_PAYLOAD_BYTES = 50 000 000` (non atteint : rien n'est téléchargé) |
| Blocage | `source_verified_decoder_deferred` — statut porté par le connecteur lui-même |
| Fait relevé en X1 | L'hôte `edo.jrc.ec.europa.eu` **redirige vers `drought.emergency.copernicus.eu`**. Le Fetcher a refusé de suivre tant que le nouvel hôte n'était pas allowlisté à la main. |
| Commande X1 | `verify_excluded_sources` |

---

## 6. Ce qui manquait, et ce que X1 livre

| Manque listé par le pack | État après X1 |
|---|---|
| 1. Un Fetcher opérateur réel et borné | ✅ `scripts/water_intelligence/fetcher.py` |
| 2. Des commandes reproductibles | ✅ `validate_eea`, `validate_hubeau`, `discover_hubeau`, `verify_excluded_sources` |
| 3. Des exécutions live documentées | ✅ 7 rapports dans `activation/reports/` |
| 4. Un graveur Evidence Kernel Eau | ❌ X2 |
| 5. Des releases staging | ❌ X2 |
| 6. Des décisions humaines signées | ❌ X4 |
| 7. Un snapshot public des sources approuvées | ❌ X4 |
