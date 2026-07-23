# ADR — Frontière entre le cockpit `/water` et le module public `/water-intelligence`

**Statut :** Acté (mission P00).
**Date :** 2026-07-23.
**Contexte :** voir [`00_BASELINE_AUDIT.md`](./00_BASELINE_AUDIT.md) pour les citations source de chaque affirmation ci-dessous.

## Contexte

Carbon&Co possède déjà un cockpit eau authentifié (`/water`, groupe Next.js `(app)`, backend `apps/api/routers/water.py` + `sites.py`, moteur de screening pur, Evidence Kernel intégré). Le chantier Water Intelligence ajoute un module **public** d'intelligence hydrique. Il faut décider où il vit, comment il s'articule avec l'existant, et quelles limites structurelles il ne doit jamais franchir. Cette ADR fige ces décisions avant tout code (P01+).

## Décisions

### 1. `/water` reste le cockpit authentifié existant, inchangé

`apps/carbon/app/(app)/water/page.tsx` continue de résoudre `/water` sans modification de comportement. Aucune seconde page ne doit se résoudre sur cette URL (règle absolue reprise dans chaque prompt du pack maître, §00_BASELINE_AUDIT §1). Toute évolution de `/water` (nouveaux champs, nouvelles vues) sort du périmètre de ce chantier et suit son propre cycle PR.

**Preuve à l'appui :** §00_BASELINE_AUDIT §1 — route, garde d'auth, invariants risque≠confiance/donnée manquante≠zéro/zone non appariée≠risque faible/géocodage revue humaine/méthode toujours affichée, tous vérifiés en code actuel.

### 2. `/water-intelligence` est la route publique cible

Nouveau segment `apps/carbon/app/water-intelligence/`, **hors** du groupe `(app)`, suivant exactement le même schéma que les deux précédents publics déjà en place : `apps/carbon/app/materials/` (route publique existante, aucune garde) et `apps/carbon/app/demo/` (layout serveur, `robots: {index:false, follow:false}`). Le layout racine (`apps/carbon/app/layout.tsx`) n'impose aucune garde — un nouveau segment top-level est public par défaut, cohérent avec cette convention.

Recherche exhaustive : zéro occurrence de « water-intelligence » dans `apps/carbon`, `apps/api`, `apps/neural` en dehors de `docs/carbonco/water-intelligence/` — aucune collision de route, de nom de composant ou de nom CSP.

**Preuve à l'appui :** §00_BASELINE_AUDIT §7, §8.

### 3. Aucun appel externe au runtime

Aucune page, route API ou composant client de `/water-intelligence` n'appelle un portail source (Hub'Eau, WRI Aqueduct, EEA, Copernicus, etc.) pendant le rendu ou une requête utilisateur. Toute récupération externe est un geste opérateur (CLI/GitHub Actions), suivant le pattern déjà en vigueur pour `water_risk_areas` (ingestion réservée au CLI, endpoint API en lecture seule) et pour le Evidence Kernel dans son ensemble (`SourceAdapter.fetch_release` n'est jamais appelé depuis un routeur HTTP).

Conséquence directe pour la CSP : aucune ouverture de `connect-src` n'est anticipée pour des domaines de portails eau. La seule catégorie de domaine externe historiquement discutée (cartographie, incident Mapbox PR #82) est explicitement écartée — P11 impose D3/TopoJSON/World Atlas, déjà le pattern de `/materials` et `/water`.

**Preuve à l'appui :** §00_BASELINE_AUDIT §5, §6, §8.

### 4. Le Evidence Kernel (`source_registry` / `source_releases` / `evidence_artifacts` / `observations`) reste le registre unique

`/water-intelligence` réutilise le kernel existant (migration `028_evidence_kernel.sql`), le contrat `SourceAdapter` (`apps/api/services/intelligence/adapters/base.py`), `license_policy.py`, et les composants de provenance (`components/intelligence/*`, `DataStatusBadge`). Aucun registre de sources parallèle n'est créé.

**Point de vigilance explicite** (nouveau, issu de l'audit) : la porte de publication d'une release (`allow_ingest AND allow_store`) ne couvre pas `display_allowed` — la redaction par valeur (`value_withheld`) doit être répliquée explicitement dans l'assembleur de snapshots publics (P10), elle n'est pas automatique. Et contrairement à ce qu'on pourrait supposer, **aucune page publique existante n'interroge aujourd'hui le kernel en direct** (`/materials` en est une consommatrice figée/locale, pas live) — P04/P10 sont donc les premiers à valider ce couple en exposition publique, pas une simple reconduction d'un pattern déjà éprouvé publiquement.

**Preuve à l'appui :** §00_BASELINE_AUDIT §6.

### 5. Aucun score hydrique composite opaque

`/water-intelligence` n'introduit pas de score unique fusionnant stress structurel, sécheresse, inondation, eaux souterraines, qualité, dépendance opérationnelle, sensibilité réglementaire, capacité d'adaptation et confiance documentaire. Chaque dimension reste un signal séparé et sourcé, un sélecteur change de couche plutôt que de fusionner — dans la continuité directe du moteur `water_screening.py` déjà en place, qui sépare structurellement risque et confiance (deux colonnes DB indépendantes, deux chemins de calcul disjoints).

**Preuve à l'appui :** §00_BASELINE_AUDIT §5 (moteur de screening), pack maître §4 « Scoring ».

### 6. Aucune donnée tenant dans la surface publique

`/water-intelligence` ne lit, n'affiche et ne met en cache aucune donnée d'un tenant (activités, permis, screenings, cibles, actions). Le pont vers ces données (prévu en P14) se fait depuis le cockpit authentifié `/water` vers le module public — jamais l'inverse — et reste un lien contextuel, pas une duplication de table. `/resources`, `/iro`, `/materialite` sont eux aussi tous authentifiés : le pont P14 est donc un chantier interne à `(app)`, hors du module public lui-même.

**Preuve à l'appui :** §00_BASELINE_AUDIT §7.

### 7. Aucune migration tant qu'un besoin précis n'est pas démontré

Les 44 migrations existantes (jusqu'à `043_resource_exposures_assessments.sql`) couvrent déjà : ledger eau, permis, zones de risque, screenings immuables, cibles/actions, extension géo de `sites`, et l'intégralité du Evidence Kernel. P01-P03 (catalogue, contrats, pipeline) ne nécessitent aucune modification de schéma — ils consomment l'existant. Une migration ne sera proposée, en PR séparée, que si un prompt ultérieur démontre un manque concret (ex. un type de release ou de couche non représentable dans le schéma actuel).

**Preuve à l'appui :** §00_BASELINE_AUDIT §3, §6.

## Conséquences

- P01 (catalogue de sources) et P02 (contrats) peuvent démarrer sans toucher `apps/`, `packages/`, aux migrations ni à la configuration Vercel.
- P04 (shell public) doit créer `apps/carbon/app/water-intelligence/page.tsx` — jamais un fichier qui intercepterait `apps/carbon/app/(app)/water/`.
- P05-P09 (connecteurs) sont les premières implémentations réelles de `SourceAdapter` — aucun code de connecteur existant à réutiliser au-delà du contrat et de `FakeAdapter`.
- P10 doit explicitement répliquer la logique de redaction par `display_allowed`, ce point n'étant pas gratuit à la publication de release.
- Cette ADR **prime** sur toute description antérieure divergente (y compris une éventuelle version future de `WATER_INTELLIGENCE_PROMPT_PACK_V1.md`), suivant la même règle de préséance que `PR08_WATER_GEOSPATIAL_TRACEABILITY.md` vis-à-vis de son propre plan d'implémentation.

## Alternative écartée

Fusionner `/water` et `/water-intelligence` sous une seule route avec contenu conditionnel selon l'authentification. Écarté : violerait directement la règle absolue « pas de seconde page résolue sur la même URL », mélangerait des données tenant et publiques dans un seul arbre de composants, et compliquerait la CSP/le cache (une page publique cachable ne peut pas dépendre d'un état de session). La séparation en deux routes distinctes, déjà pratiquée pour `/materials` (public) vs `/resources` (authentifié) dans ce même dépôt, est le pattern éprouvé retenu.
