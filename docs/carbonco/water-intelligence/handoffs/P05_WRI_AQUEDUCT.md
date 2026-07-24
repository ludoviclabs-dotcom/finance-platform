# P05 — Connecteur WRI Aqueduct

**Mission :** P05 — Connecteur WRI Aqueduct.
**Branche :** `feat/water-intelligence-p05-wri-aqueduct`
**Statut du gate source :** franchi — la source et le schéma **ont pu être inspectés**. Aucune fixture n'a été fabriquée à l'aveugle.

---

## 1. Rapport de source (Étape 1)

### 1.1 Source officielle inspectée

| Élément | Valeur | Vérifié le |
|---|---|---|
| Producteur | World Resources Institute (WRI) | 2026-07-24 |
| Jeu de données | Aqueduct 4.0 — Water Risk Atlas, *Current and Future Global Maps* | 2026-07-24 |
| Dépôt officiel de méthodologie | `github.com/wri/Aqueduct40` | 2026-07-24 |
| Dictionnaire de données | `data_dictionary_water-risk-atlas.md` (même dépôt) | 2026-07-24 |
| FAQ données | `data_FAQ.md` (même dépôt) + `wri.org/aqueduct/faq` | 2026-07-24 |
| Page de téléchargement | `wri.org/data/aqueduct-global-maps-40-data` | 2026-07-24 |
| Note technique | DOI `10.46830/writn.23.00061` | référencée, **non lue** |

### 1.2 Version / release

- **Version : 4.0.** Date de publication annoncée par WRI : **16 août 2023**.
- L'archive de téléchargement est nommée `aqueduct-4-0-water-risk-data.zip` sur la page WRI.
- **Aucun « latest » implicite n'est accepté** par le connecteur : une release doit être nommée explicitement (voir §3).

### 1.3 Licence, attribution et droits

- **Licence : CC BY 4.0.** Vérifiée à deux endroits indépendants :
  - FAQ WRI : « Creative Commons Attribution International 4.0 License » ;
  - `README.md` du dépôt officiel : « This dataset is licensed in accordance with the terms of a creative commons license (CC BY 4.0) ».
  - *Nuance :* la page de téléchargement elle-même n'indique que « Creative Commons », sans préciser la variante.
- **Attribution demandée (verbatim) :** « Source: WRI Aqueduct, accessed on [insert date] », avec un lien vers `aqueduct.wri.org` si possible. Le connecteur la génère automatiquement avec la date de récupération réelle.
- **Licence non transférable :** WRI ne transfère le copyright à aucune organisation.
- ⚠️ **Condition supplémentaire à trancher par un humain.** La FAQ WRI demande en plus un **enregistrement** : « If you would like to adapt and/or share our data, please do — so long as you register with us and provide attribution ». CC BY 4.0 n'impose pas d'enregistrement ; WRI le **demande** en sus. Cet enregistrement **n'a pas été effectué**. Tant qu'il ne l'est pas, ce chantier ne considère pas la publication publique comme autorisée (voir §5).

| Droit | Statut retenu | Justification |
|---|---|---|
| `storage_allowed` | **à confirmer** | CC BY 4.0 le permet ; enregistrement WRI non effectué |
| `display_allowed` | **à confirmer** | idem — la publication publique reste bloquée par défaut |
| `derived_use_allowed` | **à confirmer** | idem — « adapt » est explicitement visé par la demande d'enregistrement |
| `automated_access_allowed` | **`unknown`** | les conditions d'accès automatisé/bulk n'ont pas été inspectées ; le connecteur ne télécharge rien de toute façon |

### 1.4 Format réellement disponible

- WRI indique que les données de base et futures sont fournies **en formats tabulaire et spatial**.
- ❌ **Les extensions exactes contenues dans l'archive n'ont pas pu être vérifiées** (ni la page WRI, ni le README, ni le dictionnaire ne les énumèrent).
- **Conséquence assumée :** le connecteur parse un **CSV dont les colonnes respectent le dictionnaire officiel vérifié**. La conversion depuis le conteneur d'origine reste un **geste opérateur documenté** (§4), pas une supposition du code.

### 1.5 Champs nécessaires au MVP

Retenus pour le MVP (stress hydrique structurel, conformément à l'ADR P00) :

- identifiants : `string_id`, `pfaf_id`, `gid_0` (clés stables) ; `aq30_id`, `gid_1`, `aqid` conservés en métadonnées ; `name_0`/`name_1` **jamais** utilisés comme clé ;
- indicateur `bws` (*baseline water stress*) avec ses quatre facettes `bws_raw`, `bws_score`, `bws_cat`, `bws_label` ;
- projections publiées : colonnes `{scénario}{année}_{indicateur}_{unité}_{type}`, ex. `bau30_ws_x_r`.

### 1.6 Identifiants géographiques disponibles

Vérifiés dans le dictionnaire officiel (baseline annual) : `string_id` (clé unique de géométrie), `aq30_id` (identifiant numérique), `pfaf_id` (code Pfafstetter à six chiffres), `gid_1` (sous-unité GADM), `aqid` (aquifère WHYMAP), `gid_0` (code pays ISO A3), `name_0` / `name_1` (libellés). Les jeux *baseline monthly* et *future annual* sont clés sur `pfaf_id`.

### 1.7 Limites méthodologiques déclarées par la source

Extraites de la FAQ officielle du dépôt :

- « **Aqueduct is a global hydrological model and is limited in its local precision.** » — deux adresses proches peuvent tomber dans des bassins différents et afficher des résultats différents. WRI recommande de compléter par des données locales pour toute évaluation à l'échelle d'un site.
- La catégorie « **Arid and Low Water Use** » doit être traitée comme un risque élevé au même titre que « Extremely High » et « High » — **elle ne signifie pas « faible risque »**.
- Une valeur brute de **`-9999` signifie « données insuffisantes »** pour ce sous-bassin, pas une mesure.
- Les eaux souterraines **rechargeables** sont incluses dans l'offre en eau ; les eaux souterraines **non renouvelables** ne le sont pas dans la définition du stress.
- L'indicateur de déclin de nappe **n'a pas été mis à jour** dans la version 4.0.
- L'incertitude des projections futures est traitée par comparaison entre modèles climatiques globaux (GCM).

### 1.8 Ce qui reste `unknown` — jamais comblé par une hypothèse

1. **La correspondance `_cat` → `_label`.** Le dictionnaire définit `_cat` comme « integer for each category [-1,4] » et `_label` comme « A label explaining the category of the indicator including threshold », mais **n'énumère pas** les valeurs. Le connecteur ne traduit donc jamais une catégorie : `cat` et `label` sont recopiés verbatim (`category_vocabulary: "unknown"` dans les métadonnées).
2. **Les extensions de fichier** livrées dans l'archive (§1.4).
3. **Les conditions d'accès automatisé** (§1.3).
4. **Une confiance documentaire par valeur** : Aqueduct n'en publie pas que j'aie pu vérifier. `confidence` reste `None` — jamais un chiffre inventé, et toujours séparée de la valeur.

---

## 2. Ce qui est livré

| Fichier | Rôle |
|---|---|
| `apps/api/services/water_intelligence/connectors/wri_aqueduct.py` | Connecteur pur : identité de source vérifiée, `AqueductReleaseConfig` (release toujours nommée), parseur CSV strict, normalizer et résolveur de géographie pour le pipeline P03 |
| `apps/api/tests/fixtures/wri_aqueduct_*.csv` | 3 fixtures minimales (valide, colonne inconnue, sans identifiant stable) — quelques centaines d'octets |
| `apps/api/tests/test_water_intelligence_wri_aqueduct.py` | 57 tests, hors réseau et hors base |

**Un défaut réel a été trouvé grâce à la vérification de source** : la première version du parseur lisait `-9999` comme une mesure. La FAQ officielle documente cette valeur comme « insufficient data ». Elle est désormais convertie en absence, avec deux tests de non-régression — et `-1`, qui est une *catégorie* valide, reste distingué de la sentinelle.

**Mise à jour P03C :** `AqueductError` (et ses sous-classes `AqueductSchemaError`/`AqueductReleaseError`) hérite désormais d'`AdapterError`, pour être proprement capturée par `run_pipeline()` au stage `normalize` plutôt que de remonter nue. Aucune règle métier, aucun message ni comportement du connecteur n'a changé — voir `handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md`.

## 3. Ce qui n'est pas livré

- **Aucun téléchargement.** Le module n'importe aucun client HTTP (vérifié par analyse AST dans les tests) ; l'opérateur fournit les octets.
- **Aucune écriture en base, aucune ligne `source_registry`, aucune migration, aucune table, aucune API, aucune UI.**
- **Aucune donnée réelle affichée** sur `/water-intelligence` (voir §6).
- **Aucun jeu de données réel versionné** : seules des fixtures minimales, toutes marquées `fixture`.
- **Aucun autre connecteur** (EEA, Hub'Eau, Copernicus, USGS restent hors périmètre).
- **Aucune interprétation de catégorie**, aucune conclusion réglementaire, aucun score composite.

## 4. Utilisation en mode opérateur

1. Télécharger l'archive officielle depuis la page WRI (**geste opérateur manuel**, jamais automatisé par le code).
2. En extraire la table *baseline annual* et la convertir en CSV si nécessaire (le conteneur exact n'étant pas vérifié, §1.4).
3. Construire une configuration de release **explicitement nommée** :

```python
config = AqueductReleaseConfig(
    release_key="aqueduct-4-0-baseline-annual-2023-08-16",  # jamais "latest"
    retrieved_at=date(2026, 7, 24),                          # date réelle de récupération
    indicators=("bws",),
    is_fixture=False,
)
```

4. Exécuter le pipeline P03 en **dry-run**, en fournissant une décision de licence explicite :

```python
report = run_pipeline(
    source_code=wri_aqueduct.SOURCE_CODE,
    release_key=config.release_key,
    transport=<transport opérateur>,
    normalizer=wri_aqueduct.build_normalizer(config),
    geography_resolver=wri_aqueduct.build_geography_resolver(parsed.rows),
    decoder=wri_aqueduct.PAGE_DECODER,                          # texte UTF-8, pas d'emballage JSON
    license_decision=<décision obtenue après revue humaine>,   # jamais None en production
    dry_run=True,
)
```

**Note d'intégration (mise à jour P03B) :** la CSV voyage en texte UTF-8 direct, via le décodeur de page injectable `wri_aqueduct.PAGE_DECODER` (`TextPageDecoder`). La friction initiale — le pipeline P03 ne décodait chaque page qu'en JSON, obligeant à transporter la CSV comme chaîne JSON échappée — a été corrigée par `refactor/water-intelligence-p03b-pluggable-page-decoder` avant le lancement de P06 ; voir `handoffs/P03B_PLUGGABLE_PAGE_DECODER.md` pour le détail de l'abstraction (`PageDecoder`/`JsonPageDecoder`/`TextPageDecoder`/`RawBytesPageDecoder`).

## 5. Pourquoi rien n'est encore publié

Deux verrous indépendants, tous deux volontaires :

1. **La licence n'est pas confirmée pour la publication.** La licence formelle est CC BY 4.0, mais WRI demande en plus un enregistrement pour partager/adapter (§1.3), et il n'a pas été fait. `license_decision=None` ⇒ le pipeline retient toutes les valeurs (`value_withheld`) : `unknown` ne devient jamais `allowed`.
2. **P10 n'existe pas encore.** Aucun snapshot public n'est construit, donc la page publique n'a rien à lire. `/water-intelligence` continue d'afficher `n.c.` partout (état P04B), et ce PR ne touche à aucun fichier frontend.

## 6. Comment P10 transformera les releases en snapshot public

1. P10 lira les releases **publiées** de l'Evidence Kernel (pas la sortie brute de ce connecteur).
2. Il devra appliquer **explicitement** la redaction `display_allowed` à la construction du snapshot : rappel de l'audit P00 — la porte de publication d'une release ne teste que `allow_ingest` et `allow_store`, **pas** `display_allowed`. Sans ce contrôle, une valeur sous licence restrictive atteindrait la page publique.
3. L'attribution produite par ce connecteur (« Source: WRI Aqueduct, accessed on … ») doit être **transportée jusqu'à l'affichage** : CC BY 4.0 la rend obligatoire.
4. La mention « Aqueduct est un modèle global, peu précis localement » doit accompagner toute restitution cartographique — c'est une limite déclarée par la source, pas une précaution optionnelle.

## 7. Risques résiduels

| Risque | Portée | Atténuation en place |
|---|---|---|
| Enregistrement WRI non effectué | Bloque la publication | `license_decision` explicite requise ; défaut = tout retenu |
| Correspondance `cat`→`label` inconnue | Interprétation impossible | Recopie verbatim, `category_vocabulary: "unknown"` |
| Conteneur de fichier non vérifié | Conversion opérateur | Parseur strict : toute colonne hors dictionnaire est refusée |
| « Arid and Low Water Use » lu comme faible risque | Contresens métier | Aucune traduction de catégorie ; caveat documenté ici et à porter en P11 |
| Précision locale faible | Mauvais usage | Limite déclarée, à afficher avec toute carte (P11) |
| Note technique non lue | Limites méthodologiques possiblement incomplètes | Signalé ici comme point ouvert |

## 8. Critères d'arrêt — rencontrés ou non

| Critère d'arrêt du pack maître | Rencontré ? |
|---|---|
| Licence ne permettant pas stockage/affichage/usage dérivé | **Partiellement** — licence CC BY 4.0 permissive, mais condition d'enregistrement non levée ⇒ publication bloquée, connecteur livré |
| Schéma source non inspectable | **Non** — dictionnaire officiel inspecté |
| Jointure géographique sans identifiant stable | **Non** — `string_id`/`pfaf_id`/`gid_0` disponibles et utilisés |
| Donnée manquante que seule l'invention comblerait | **Non** — absences conservées, sentinelle `-9999` traitée |
| Migration nécessaire hors périmètre | **Non** |
| Dépassement de budget de payload | **Non** — aucun jeu réel versionné |

**Conclusion :** la mission n'a pas rencontré de critère d'arrêt bloquant. Le connecteur est livré ; la **publication** reste volontairement fermée jusqu'à confirmation humaine de la licence (§1.3) et jusqu'à P10.
