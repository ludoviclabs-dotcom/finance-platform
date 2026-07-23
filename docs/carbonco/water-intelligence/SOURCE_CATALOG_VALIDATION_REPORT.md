# P01 — Rapport de validation du catalogue de sources

**Mission :** P01 — Normalisation du catalogue de sources fourni.
**Branche :** `feat/water-intelligence-p01-source-catalog`
**Entrée :** [`WATER_SOURCE_REGISTRY_SEED_V1.csv`](./WATER_SOURCE_REGISTRY_SEED_V1.csv) (17 lignes : 1 en-tête + 16 lignes de données).
**Sortie :** [`SOURCE_CATALOG_NORMALIZED_V1.csv`](./SOURCE_CATALOG_NORMALIZED_V1.csv) (16 entrées).

Ce rapport documente la transformation, ses règles exactes, et ce qui reste en dehors de son périmètre (voir §7).

---

## 1. Schéma retenu

Le schéma imposé par la mission P01 (`source_code`, `portal_name`, `theme`, `geographic_scope`, `source_role`, `connector_candidate`, `access_mode`, `official_domain`, `priority`, `planned_prompt`, `notes`) est repris intégralement, complété de deux colonnes justifiées ci-dessous :

| Colonne du catalogue normalisé | Origine | Justification |
|---|---|---|
| `origin` | colonne `origin` du CSV brut, conservée telle quelle | **Ajout obligatoire** : seul moyen de préserver explicitement la distinction 12 lignes opérateur (`user_csv`) / 4 sources recommandées (`recommended_addition`), exigée par `DECISION_LOG.md` et le critère d'acceptation corrigé de P01 |
| `source_code` | `source_code` | inchangé |
| `portal_name` | `portal_name` | inchangé |
| `theme` | `theme` | inchangé |
| `geographic_scope` | `geographic_scope` | inchangé |
| `source_role` | `primary_role` | renommage direct (même sémantique) |
| `connector_candidate` | `initial_status` | renommage direct — les 3 valeurs du CSV brut (`catalog_only` / `connector_candidate` / `reference_priority`) sont préservées sans réduction à un booléen, pour ne perdre aucune information |
| `access_mode` | `connector_mode` | renommage direct — décrit le mode d'accès technique (API bornée, téléchargement, service OGC, métadonnées seules…), distinct de `connector_candidate` qui décrit le statut d'intention |
| `official_domain` | **absent du CSV brut** | rempli à `unknown` pour les 16 entrées — aucune URL n'est devinée (interdiction explicite de la mission) |
| `license_status` | **absent du CSV brut, ajouté à la demande explicite de cette mission** | rempli à `unknown` pour les 16 entrées — aucun statut de licence n'est supposé (interdiction explicite de la mission et du CSV lui-même, qui ne documente aucune licence) |
| `priority` | `priority` | inchangé |
| `planned_prompt` | `planned_prompt` | inchangé |
| `notes` | `notes` | inchangé, aucune reformulation |

---

## 2. Distinction 12 / 16 (critère d'acceptation)

- 12 entrées portent `origin=user_csv` : `EAUFRANCE_PORTAL`, `HUBEAU_HYDROMETRIE`, `HUBEAU_ADES`, `SIGES_NETWORK`, `BRGM_INFOTERRE`, `HUBEAU_QUALITE_SURFACE`, `SANDRE_REFERENTIALS`, `HUBEAU_BNPE_PRELEVEMENTS`, `SISPEA_SERVICES`, `IFREMER_SEXTANT`, `DATAGOUV_SIE`, `GEORISQUES_GEO`.
- 4 entrées portent `origin=recommended_addition` : `WRI_AQUEDUCT`, `EEA_WEI_PLUS`, `COPERNICUS_EDO`, `USGS_WATER_DATA`.
- Total : **16 entrées**, aucune fusion ni suppression. Le CSV opérateur initial reste, lui, à 12 lignes — ce rapport ne prétend jamais le contraire.

## 3. Doublons de `source_code`

Vérification exhaustive des 16 valeurs de `source_code` : **zéro doublon**. Chaque code apparaît exactement une fois dans le CSV brut comme dans le catalogue normalisé.

## 4. Typologie (portail de découverte / référentiel / API / service OGC / téléchargement de release / donnée contextuelle non ingérée)

Classement dérivé de `access_mode`, croisé avec `connector_candidate` et `source_role` :

| Catégorie | Sources |
|---|---|
| Portail de découverte | `EAUFRANCE_PORTAL`, `DATAGOUV_SIE` (`access_mode=metadata_only`) |
| Référentiel | `SANDRE_REFERENTIALS` (`connector_candidate=reference_priority`, identifiants/vocabulaires) |
| API | `HUBEAU_HYDROMETRIE`, `HUBEAU_ADES`, `HUBEAU_QUALITE_SURFACE`, `HUBEAU_BNPE_PRELEVEMENTS`, `GEORISQUES_GEO`, `USGS_WATER_DATA` |
| Service OGC | `BRGM_INFOTERRE` (OGC ou téléchargement selon la couche), `COPERNICUS_EDO` (WMS/WCS snapshot) |
| Téléchargement de release | `WRI_AQUEDUCT`, `EEA_WEI_PLUS` |
| Donnée contextuelle non ingérée | `SIGES_NETWORK`, `SISPEA_SERVICES`, `IFREMER_SEXTANT` |

`USGS_WATER_DATA` est classé API par son `access_mode`, mais reste `catalog_only` (extension future hors MVP) — les deux dimensions (nature d'accès vs statut d'intention) sont volontairement gardées indépendantes, cf. §1.

## 5. Quels portails deviennent des connecteurs, lesquels restent des index

- **Candidats connecteur (`connector_candidate=connector_candidate`, 9)** : `HUBEAU_HYDROMETRIE` (P07), `HUBEAU_ADES` (P07/P08), `BRGM_INFOTERRE` (future), `HUBEAU_QUALITE_SURFACE` (P08), `HUBEAU_BNPE_PRELEVEMENTS` (P08), `GEORISQUES_GEO` (future), `WRI_AQUEDUCT` (P05), `EEA_WEI_PLUS` (P06), `COPERNICUS_EDO` (P09).
- **Référentiel prioritaire (`reference_priority`, 1)** : `SANDRE_REFERENTIALS` — pas un connecteur de données au sens observation, mais une dépendance transverse (identifiants, vocabulaires) pour P01/P02 et tous les connecteurs futurs.
- **Restent index/catalogue seul (`catalog_only`, 6)** : `EAUFRANCE_PORTAL`, `SIGES_NETWORK`, `SISPEA_SERVICES`, `IFREMER_SEXTANT`, `DATAGOUV_SIE`, `USGS_WATER_DATA` — aucun connecteur prévu à ce stade (9 + 1 + 6 = 16, total vérifié).

## 6. Ambiguïtés explicites (non corrigées silencieusement)

- `SIGES_NETWORK` est un réseau de services régionaux, pas un portail unique — sa note d'origine (« inventorier les services régionaux avant tout connecteur ») indique qu'il pourrait éclater en plusieurs sources distinctes plus tard ; représenté ici comme une seule entrée provisoire.
- `HUBEAU_ADES` porte `planned_prompt=P07/P08` (deux prompts) plutôt qu'un seul — l'ambiguïté n'est pas résolue ici, à trancher avant l'exécution de P07 ou P08.
- `geographic_scope` mélange des granularités différentes (`France`, `France/régions`, `France/littoral`, `Monde`, `Union européenne`, `Europe`, `États-Unis`) sans référentiel géographique commun — conservé tel quel, non normalisé (interdiction explicite de corriger silencieusement).
- `official_domain` et `license_status` sont `unknown` pour les 16 entrées : le CSV brut ne documente ni domaine officiel ni licence — ce ne sont pas des oublis de cette passe, ces informations n'existent simplement pas encore dans l'entrée.
- Caractères accentués et tirets cadratins dans les noms de portails (« InfoTerre — BRGM », « Ifremer — Sextant ») conservés sans altération.

## 7. Ce qui n'est pas fait dans cette passe (périmètre documentaire strict)

Cette exécution de P01 est volontairement limitée à `docs/carbonco/water-intelligence/` (contrainte explicite de la mission ayant déclenché ce travail). Deux tâches du prompt maître impliquent du code applicatif et sont donc **reportées**, pas exécutées :

- **Tâche 2 — parseur pur et déterministe du CSV** : non implémenté (aucun fichier créé hors de ce dossier). Le mapping exact §1 tient lieu de spécification pour son écriture future dans `apps/api`.
- **Tâche 7 — tests avec le CSV complet et des cas invalides** : non implémentés, pour la même raison.

Conséquence sur les critères d'acceptation du prompt maître : « résultat stable byte pour byte » et « tests purs verts » ne peuvent pas être vérifiés mécaniquement tant que le parseur n'existe pas — ce rapport fournit la règle de transformation déterministe qu'un futur parseur devra reproduire à l'identique. Les critères réellement vérifiés dans cette passe sont listés en §2-§5 ci-dessus.

Conformément à la tâche 6 du prompt, **aucune ligne n'a été créée dans `source_registry`** — ce catalogue est un artefact documentaire, pas une écriture en base.
