# Wave C — Blueprint UX / UI de `/water-intelligence`

**Statut :** document de conception, non normatif sur le calendrier. Aucune ligne de code, aucune donnée, aucun composant n'est livré par ce document.
**Périmètre couvert :** Wave C = P10 (read model public) + P11 (carte multi-échelle) + P12 (contenus sourcés), plus les deux *previews* non-fonctionnelles de Wave D (conformité P13, passerelle financière P15).
**Route concernée :** `/water-intelligence` (publique). Le cockpit authentifié `/water` n'est pas concerné et n'est modifié par aucune recommandation de ce document.

---

## 0. Cadre, sources de vérité et règles héritées

### 0.1 D'où vient chaque affirmation de ce blueprint

Ce document ne crée aucun fait, aucun chiffre, aucun seuil et aucune donnée géographique. Tout ce qu'il fixe est dérivé des documents et du code déjà présents dans le dépôt :

| Source de vérité | Ce qu'elle fixe pour ce blueprint |
|---|---|
| [`01_ADR_SURFACES_AND_ROUTES.md`](../01_ADR_SURFACES_AND_ROUTES.md) | Frontière `/water` ↔ `/water-intelligence`, interdiction de score composite, interdiction de donnée tenant, absence d'appel externe au runtime |
| [`contracts/P02_DATA_CONTRACTS.md`](../contracts/P02_DATA_CONTRACTS.md) | Forme du read model, budgets de payload, niveaux de zoom, vocabulaire `WaterDataStatus` |
| `apps/carbon/lib/water-intelligence/contracts.ts` | Noms de champs exacts utilisés dans la matrice données → composant (§6) |
| `apps/carbon/app/water-intelligence/water-intelligence.css` | Valeurs exactes des design tokens `--wi-*` (§8) et échelle typographique (§9) |
| `apps/carbon/app/water-intelligence/page.tsx` + `components/water-intelligence/*` | Sections et ancres déjà publiques, primitives existantes (§3, §5) |
| [`02_CURRENT_CAPABILITIES_MATRIX.md`](../02_CURRENT_CAPABILITIES_MATRIX.md) | Inventaire des composants réutilisables et des composants explicitement non réutilisables (§16) |
| [`handoffs/P04_PUBLIC_SHELL.md`](../handoffs/P04_PUBLIC_SHELL.md) | Décisions de conception du shell (zéro composant client, thème `--wi-*`, fixture non affichée) |
| `WATER_INTELLIGENCE_PROMPT_PACK_V1.md` §3, §4 | Budgets internes, stratégie géographique, les 9 dimensions, interdiction du score unique |
| `prompts/P10`, `P11`, `P12`, `P13`, `P15`, `P16` | Tâches, interdictions et critères d'acceptation de chaque mission de Wave C et Wave D |
| `apps/api/services/intelligence/freshness_service.py` | `STALE_AFTER_DAYS = 120` — seuil de péremption existant, à ne pas redéfinir dans le JSX |
| `apps/carbon/package.json` | Dépendances disponibles sans ajout : `d3-geo`, `d3-selection`, `d3-transition`, `d3-zoom`, `topojson-client`, `world-atlas`, `recharts`, `framer-motion`, `zod` |

Toute valeur qui apparaît dans les wireframes sous la forme `{champ}`, `n.c.` ou `—` est un **emplacement**, jamais une mesure. Aucun exemple chiffré n'est fourni dans ce document, volontairement : un chiffre plausible dans une maquette finit par être recopié dans le code.

### 0.2 Les huit règles UI héritées, non négociables

Elles ne sont pas des recommandations de ce blueprint : elles sont déjà appliquées par le shell P04 ou imposées par l'ADR, et Wave C doit les préserver.

1. **Aucun score hydrique composite.** Un sélecteur change de couche ; il ne fusionne jamais des dimensions. (ADR §5)
2. **Risque ≠ confiance.** `value` et `quality.confidence` ne partagent jamais un même élément visuel, une même rampe de couleur ou une même légende.
3. **Donnée manquante ≠ zéro.** Une absence se rend « Donnée absente » + motif, jamais `0`, jamais un tiret muet, jamais une couleur « basse » de la rampe.
4. **Zone non appariée ≠ risque faible.** Un territoire sans correspondance officielle reçoit le remplissage `absent` (gris + hachures), jamais la teinte la plus claire de la rampe.
5. **La couleur ne porte jamais seule une information.** Chaque teinte est doublée d'un libellé texte, et pour l'absence d'une texture.
6. **Aucun appel externe au runtime.** Pas de tuile, pas de police distante, pas de CDN : aucune ouverture de `connect-src` n'est demandée par ce blueprint.
7. **Aucune donnée tenant.** Aucun composant de cette surface ne reçoit, ne met en cache ni n'affiche une donnée d'entreprise. Le niveau « site » n'existe pas dans les contrats publics.
8. **Une fixture n'est jamais affichée comme une donnée.** Le correctif P04B a retiré jusqu'aux dates et empreintes fabriquées ; Wave C ne les réintroduit pas (§7.8).

---

## 1. Architecture de l'information

### 1.1 Forme retenue : page unique ancrée, pas d'arborescence de routes

`/water-intelligence` reste **une seule route**, avec une navigation par ancres. Trois raisons, toutes tirées du dépôt :

- Les huit ancres actuelles (`#vue-ensemble` … `#limites`) sont déjà publiques et référencées dans le `sitemap`/metadata de la page. Les casser en Wave C serait une régression d'URL sans bénéfice.
- P18 (« rationalisation d'URL ») est explicitement **optionnel** et postérieur. Découper en sous-routes avant P18 anticiperait une décision non prise.
- Une page unique prérendue statiquement conserve le principal acquis de P04 : `○` au build, aucun bailout CSR global, un seul document à mettre en cache derrière l'ETag P10.

L'état de l'explorateur cartographique vit dans la **query string**, pas dans le chemin (§10.6). Une carte partagée est donc `/water-intelligence?scope=…&dim=…#carte`, ce qui ne crée aucune route nouvelle.

### 1.2 Les quatre niveaux de lecture

La page s'organise en quatre profondeurs croissantes. Un visiteur doit pouvoir s'arrêter à n'importe laquelle et repartir avec une information complète et honnête.

```
Niveau 0 — ÉTAT           Hero + Water Pulse
                          « Qu'est-ce que ce module, et que vaut sa donnée aujourd'hui ? »
                          Lecture : 15 s. Aucun chiffre métier, uniquement l'état du snapshot.

Niveau 1 — CADRE          Vue d'ensemble + Comprendre les risques
                          « Que signifient ces mots, et pourquoi ne sont-ils pas fusionnés ? »
                          Lecture : 2 min. Aucune donnée requise — cette strate fonctionne
                          même quand le manifest est vide.

Niveau 2 — DONNÉE         Carte et territoires (+ table alternative)
                          « Où, quand, combien, avec quelle couverture et quelle confiance ? »
                          Lecture : ouverte. C'est la seule strate qui dépend des connecteurs.

Niveau 3 — PREUVE         Sources et preuves + Source Drawer (accessible depuis TOUT niveau ≥ 2)
                          « D'où vient exactement ce que je viens de lire ? »
                          Lecture : à la demande. Jamais plus d'un geste depuis une valeur.
```

**Règle structurante :** le niveau 3 est atteignable depuis n'importe quel élément du niveau 2 en **un seul geste** (clic, `Entrée` au clavier). Aucune valeur publiée sur cette page n'est à plus d'une interaction de sa provenance complète.

### 1.3 Carte de la surface

```
/water-intelligence
│
├── [persistant] WiNav — navigation ancrée, sticky, scrollable horizontalement
│
├── §01  #vue-ensemble      Vue d'ensemble                      [existant, enrichi]
│         └── Hero, Water Pulse, WiSnapshotBanner
│
├── §02  #risques           Comprendre les risques hydriques    [existant, inchangé]
│         └── 9 dimensions, séparées, non hiérarchisées
│
├── §03  #carte             Carte et territoires                [placeholder → LIVRÉ Wave C]
│         ├── Filtres (échelle / dimension / période / scénario)
│         ├── Carte D3 multi-échelle  ┐
│         ├── Table alternative        ┘ même donnée, deux rendus, bascule explicite
│         ├── Légende
│         └── Panneau bassin (latéral desktop / plein écran mobile)
│
├── §04  #sources           Sources et preuves                  [existant → alimenté]
│         └── Table des sources publiées + exclusions du gate licence
│
├── §05  #secteurs          Secteurs et dépendances             [existant → alimenté P12]
│         └── record_type ∈ {industry, actor}
│
├── §06  #evenements        Climat et événements                [NOUVEAU Wave C]
│         └── record_type = event
│
├── §07  #innovations       Innovations et adaptation           [NOUVEAU Wave C]
│         └── record_type = innovation
│
├── §08  #reglementation    Réglementation et reporting         [existant → PREVIEW seule]
│         └── Compliance preview (registre réel = P13, Wave D)
│
├── §09  #synergies         Synergies Carbon&Co                 [existant → + preview]
│         ├── Ponts vers /water, /materials, /resources
│         └── Financial bridge preview (calculateur réel = P15, Wave D)
│
├── §10  #limites           Limites, données absentes et suite  [existant, enrichi]
│
└── [persistant] Footer + WiSourceDrawer (portail, monté à la demande)
```

### 1.4 Stabilité des ancres

| Ancre | Statut Wave C | Règle |
|---|---|---|
| `#vue-ensemble`, `#risques`, `#carte`, `#sources`, `#secteurs`, `#reglementation`, `#synergies`, `#limites` | **Gelées** | Existent déjà en production publique. Wave C ne les renomme pas, ne les réordonne pas et n'en supprime aucune. |
| `#evenements`, `#innovations` | Nouvelles | Ajoutées entre `#secteurs` et `#reglementation`. Ajouter une ancre ne casse aucun lien existant. |

Un test doit échouer si l'une des huit ancres gelées disparaît du DOM — le shell P04 possède déjà un test d'ancres à étendre (`apps/carbon/tests/water-intelligence-public-shell.test.tsx`).

---

## 2. Parcours utilisateur

Six parcours. Chacun donne : le déclencheur, le chemin, l'état terminal acceptable, et **le comportement quand la donnée manque** — ce dernier point n'est pas une variante, c'est le cas nominal tant que Wave B n'est pas livrée.

### 2.1 Comprendre

> « On me parle de risque hydrique. Qu'est-ce que ça recouvre réellement ? »

```
Entrée (SERP, lien interne, partage)
  → Hero : titre + lede + badges d'état
  → Water Pulse : état de la donnée, PAS un chiffre de risque
  → §01 Vue d'ensemble : les trois principes (preuve / risque≠confiance / pas de score unique)
  → §02 Comprendre les risques : 9 dimensions, chacune définie en une phrase
  → sortie possible ici, sans jamais avoir vu une donnée
```

**Conception :** cette strate est **entièrement indépendante du manifest**. Elle se rend identiquement avec un manifest vide, absent ou en erreur. C'est ce qui rend la page utile avant Wave B et honnête après.

**Absence de donnée :** aucun impact. Rien dans ce parcours ne dépend d'une observation.

### 2.2 Explorer

> « Montre-moi le territoire qui m'intéresse. »

```
§03 Carte
  → échelle par défaut : world (agrégats, géométries très simplifiées)
  → choix d'une dimension parmi les couches RÉELLEMENT présentes dans le manifest
  → zoom / clic sur une entité → scope=europe → scope=france
  → ouverture du Panneau bassin
```

**Conception :** l'utilisateur ne choisit jamais une couche qui n'existe pas. Le sélecteur de dimension est **construit à partir de `manifest.geo_layers`**, il n'est pas codé en dur. Une dimension prévue mais non livrée n'apparaît pas comme une option grisée avec une valeur fantôme : elle apparaît dans une liste explicite « dimensions non encore couvertes » sous la carte, avec la mission qui la livrera.

**Absence de donnée :** si `manifest.geo_layers` est vide, **la carte n'est pas rendue du tout**. Le `WiPlaceholder` existant reste en place. Ce comportement copie une décision déjà prise dans le dépôt (`ConcentrationChoropleth` : « si AUCUNE observation n'est cartographiable la carte n'est pas rendue du tout, plutôt qu'une carte trompeuse »).

### 2.3 Comparer

> « Ce bassin, par rapport aux autres — et par rapport à avant ? »

Deux comparaisons distinctes, jamais confondues dans un même contrôle :

| Comparaison | Contrôle | Contrainte issue du dépôt |
|---|---|---|
| **Spatiale** (entités entre elles, à période constante) | Tri de la table alternative + rampe de la carte | Une seule teinte par rampe, comparaison uniquement à l'intérieur d'une même dimension et d'une même période |
| **Temporelle** (même entité, deux périodes) | Sélecteur de période | Budget « Historique initial : snapshot courant + **un** comparatif explicite » — donc deux points, pas une série libre |

**Conception :** la comparaison temporelle est un **choix de deux périodes nommées**, pas un curseur continu. Les périodes proposées sont les paires `(period_start, period_end)` réellement présentes dans le manifest. Comparer un stress structurel à une sécheresse conjoncturelle est impossible par construction : le sélecteur de période est enfant du sélecteur de dimension, jamais l'inverse.

**Absence de donnée :** si une seule période existe, le sélecteur de comparaison n'est pas rendu (pas rendu désactivé — pas rendu du tout). Si une entité n'a pas de valeur à la période comparée, la cellule affiche « Donnée absente » et le delta n'est **pas** calculé.

### 2.4 Vérifier la source

> « D'où sort ce chiffre ? »

```
N'importe quelle valeur affichée (carte, table, panneau, contenu éditorial)
  → bouton/lien de provenance attaché à la valeur (jamais un lien de bas de page)
  → WiSourceDrawer s'ouvre par la droite
      source_code · release_key · checksum_sha256 · published_at · retrieved_at
      observed_period · methodology_version · licence (structurée) · attribution · warnings
  → Échap ou clic hors panneau pour fermer, focus rendu à l'élément d'origine
```

**Conception :** c'est le parcours qui justifie le module entier. Il est donc le seul dont l'accès est **redondant** : depuis la valeur, depuis la légende, depuis la ligne de table, et depuis §04. Le drawer ne récupère rien lui-même — il reçoit une provenance déjà résolue en props, exactement comme le `SourceDrawer` existant, ce qui garantit qu'il ne peut pas déclencher d'appel réseau.

**Absence de donnée :** sans valeur, pas de drawer. §04 reste néanmoins remplie : elle liste les sources **publiées** et, séparément, les sources **exclues par le gate licence** avec le motif — une information réelle et vérifiable même quand zéro observation existe.

### 2.5 Identifier un risque

> « Y a-t-il quelque chose qui devrait m'inquiéter ici ? »

C'est le parcours le plus exposé au contresens. Trois garde-fous de conception :

1. **La page ne conclut jamais.** Elle n'écrit pas « risque élevé ». Elle affiche une valeur, son unité, sa méthode, sa période, sa couverture et sa confiance — l'interprétation revient au lecteur.
2. **La confiance est toujours colocalisée avec la valeur**, dans le même bloc visuel, jamais reléguée dans un tooltip. Une valeur haute sur une couverture faible doit être *visiblement* fragile.
3. **L'absence est un résultat affiché**, pas un vide. `WiAbsentValue` est un composant de premier plan, pas un état dégradé.

```
Panneau bassin
  ├── Dimension sélectionnée : valeur + unité + période      ← ce qui est mesuré
  ├── Méthode + version                                       ← comment
  ├── Couverture (coverage_pct) + Confiance (confidence)      ← ce que ça vaut
  ├── Avertissements (quality.warnings + source.warnings)     ← ce qui limite
  ├── Autres dimensions de la même entité (liste, non fusionnée)
  └── Provenance →
```

**Absence de donnée :** l'entité s'affiche avec « Donnée absente » par dimension non couverte, et le panneau reste ouvrable. Une entité sans aucune donnée n'est pas cliquable sur la carte mais **reste présente dans la table alternative**, marquée absente — jamais silencieusement omise.

### 2.6 Rejoindre le cockpit privé

> « Et sur mes sites à moi ? »

```
Points de sortie (3, tous explicitement étiquetés « accès authentifié ») :
  1. Hero — sous le lede, pour le visiteur qui s'est trompé de surface
  2. Panneau bassin — « Évaluer mes sites sur ce bassin »
  3. §09 Synergies — carte de pont vers /water, /materials, /resources
```

**Conception, contrainte ADR §6 :** le pont est **unidirectionnel** — la page publique renvoie vers le cockpit, jamais l'inverse. Le lien ne transporte **aucun paramètre dérivé du contexte utilisateur** ; au plus le territoire consulté, qui est une donnée publique. Aucun de ces liens ne teste l'état de session : la page publique est cachée statiquement, elle ne peut pas dépendre d'une session sans casser son propre cache.

---

## 3. Structure exacte des sections

Ordre de rendu, ancre, dépendance de données, et comportement quand cette dépendance est vide.

| # | Ancre | Titre | Kicker | Dépend de | Si la dépendance est vide |
|---|---|---|---|---|---|
| 00 | — | Hero + Water Pulse | — | `manifest` (enveloppe seule) | Se rend avec l'état « aucune donnée publiée » — jamais masqué |
| 01 | `#vue-ensemble` | Vue d'ensemble | `01 — Proposition` | rien | Identique |
| 02 | `#risques` | Comprendre les risques hydriques | `02 — Méthode` | rien | Identique |
| 03 | `#carte` | Carte et territoires | `03 — Territoires` | `geo_layers` + `observations` | `WiPlaceholder` P04 conservé, carte non montée |
| 04 | `#sources` | Sources et preuves | `04 — Provenance` | `sources` + exclusions | Liste des exclusions du gate licence + explication de ce qui accompagnera une valeur |
| 05 | `#secteurs` | Secteurs et dépendances | `05 — Exposition` | `editorial_records` (`industry`, `actor`) | `WiPlaceholder`, mission P12 nommée |
| 06 | `#evenements` | Climat et événements | `06 — Observations` | `editorial_records` (`event`) | `WiPlaceholder`, mission P12 nommée |
| 07 | `#innovations` | Innovations et adaptation | `07 — Adaptation` | `editorial_records` (`innovation`) | `WiPlaceholder`, mission P12 nommée |
| 08 | `#reglementation` | Réglementation et reporting | `08 — Conformité` | `legal_records` | **Preview permanente en Wave C** — le registre réel est P13 (Wave D) |
| 09 | `#synergies` | Synergies Carbon&Co | `09 — Articulation` | rien (liens) | Identique ; le bloc financier reste une preview (P15, Wave D) |
| 10 | `#limites` | Limites, données absentes et prochaines étapes | `10 — Honnêteté` | `warnings` + exclusions | Se remplit d'autant plus que le reste est vide |

**Renumérotation des kickers :** les kickers actuels vont de `01 — Proposition` à `08 — Honnêteté`. L'insertion de deux sections force une renumérotation jusqu'à `10 — Honnêteté`. Les kickers sont du texte décoratif, non des ancres : aucun lien n'en dépend. **Les ancres, elles, ne bougent pas.**

**Ordre des sections — justification :** cadre (01-02) → donnée (03-04) → contenu (05-07) → cadre réglementaire et financier (08-09) → limites (10). La section « Limites » reste en dernier volontairement : elle est le contrepoids honnête de tout ce qui précède, et elle est la seule dont le volume *augmente* quand la couverture *diminue*.

---

## 4. Wireframes textuels

Détail complet — desktop, tablette, mobile, pour les dix sections et les deux états principaux de la carte — dans **[`WAVE_C_WIREFRAMES.md`](./WAVE_C_WIREFRAMES.md)**.

Rappel des trois points de rupture, alignés sur ce qui existe déjà dans `water-intelligence.css` (`@media (min-width: 48rem)` est le seul breakpoint du fichier) :

| Nom | Largeur | Grille | Carte |
|---|---|---|---|
| Mobile | `< 48rem` (768 px) | 1 colonne | Carte **non montée par défaut** ; table alternative en vue primaire, carte sur activation explicite |
| Tablette | `≥ 48rem` (768 px) | 2 colonnes | Carte pleine largeur ; panneau bassin en superposition (sheet) |
| Desktop | `≥ 64rem` (1024 px) | 3 colonnes, `max-width: 72rem` | Carte + panneau bassin latéral persistant |

Le breakpoint `64rem` est **nouveau** pour cette surface : le shell P04 n'a besoin que de `48rem`. Il est introduit uniquement pour la disposition carte + panneau latéral, et doit rester le seul ajout à l'échelle de points de rupture.

---

## 5. Inventaire des composants

Spécification détaillée de chacun — rôle, données consommées, états, accessibilité, budget, **critères d'acceptation (§14)** — dans **[`WAVE_C_COMPONENT_SPECS.md`](./WAVE_C_COMPONENT_SPECS.md)**.

Vue de synthèse. « Îlot » = `"use client"` requis. « SC » = Server Component.

| # | Composant | Type | Nouveau / existant | Section | Livrable |
|---|---|---|---|---|---|
| C01 | `WiHero` | SC | Existant (inline dans `page.tsx`) — à extraire | 00 | Wave C |
| C02 | `WiWaterPulse` | SC | **Nouveau** | 00 | Wave C |
| C03 | `WiSnapshotBanner` | SC | **Existant, à étendre** | 00 | Wave C |
| C04 | `WiMapExplorer` | Îlot | **Nouveau** — conteneur d'état | 03 | Wave C |
| C05 | `WiMapCanvas` | Îlot | **Nouveau** — rendu D3 | 03 | Wave C |
| C06 | `WiMapFilters` | Îlot | **Nouveau** | 03 | Wave C |
| C07 | `WiBasinPanel` | Îlot | **Nouveau** | 03 | Wave C |
| C08 | `WiLegend` | SC ou îlot | **Nouveau** | 03 | Wave C |
| C09 | `WiSourceDrawer` | Îlot | **Nouveau** — dérivé de `SourceDrawer` | transverse | Wave C |
| C10 | `WiFreshnessBadge` | SC | **Nouveau** | transverse | Wave C |
| C11 | `WiDataTable` | SC + îlot de tri | **Nouveau** — table alternative | 03, 04 | Wave C |
| C12 | `WiSectorCard` | SC | **Nouveau** | 05 | Wave C (données P12) |
| C13 | `WiEventItem` | SC | **Nouveau** | 06 | Wave C (données P12) |
| C14 | `WiInnovationCard` | SC | **Nouveau** | 07 | Wave C (données P12) |
| C15 | `WiCompliancePreview` | SC | **Nouveau** — preview non fonctionnelle | 08 | Wave C (réel : P13/Wave D) |
| C16 | `WiFinancialBridgePreview` | SC | **Nouveau** — preview non fonctionnelle | 09 | Wave C (réel : P15/Wave D) |
| — | `WiNav`, `WiSection`, `WiBadge`, `WiCard`, `WiPlaceholder`, `WiAbsentValue`, `WiPendingValue` | SC | Existants | toutes | Inchangés |

**Cinq îlots clients au maximum** (C04, C05, C06, C07, C09, plus le tri de C11). Tout le reste reste rendu au serveur. C'est le budget d'interactivité de la page ; le dépasser doit être justifié dans la PR.

**Deux composants sont des *previews* et le restent :** C15 et C16 n'affichent **aucune valeur, aucune date, aucun statut juridique et aucun montant**. Ils décrivent la forme de ce que P13 et P15 livreront. Un test doit échouer si l'un d'eux rend un nombre ou une date.

---

## 6. Matrice données → composant

Champs exacts de `apps/carbon/lib/water-intelligence/contracts.ts`. Cette matrice est le contrat d'intégration entre C1 (P10, read model) et C2/C3 (P11/P12, UI) : **aucun composant ne lit un champ absent de cette table.**

### 6.1 Enveloppe — `WaterIntelligenceManifest`

| Champ | Composant | Rendu |
|---|---|---|
| `manifest_version` | C03 `WiSnapshotBanner` | Ligne « Manifest » (mono) |
| `generated_at` | C03, C10 `WiFreshnessBadge` | Date d'assemblage + base du calcul de fraîcheur |
| `fixture_label` | C03 + **badge global** | Si non nul → bandeau « Démonstration » sur toute la page et badge dans le hero. **Aucune donnée n'est rendue en surface publique tant que ce champ est non nul** (§7.8) |
| `sources[]` | §04 via C11, C09 | Table des sources publiées |
| `observations[]` | C05, C07, C11 | Valeurs cartographiées, panneau, table |
| `geo_layers[]` | C04, C05, C06, C08 | **Construit le sélecteur de dimension** — jamais codé en dur |
| `scenarios[]` | C06 | Sélecteur de scénario ; **si vide, le sélecteur n'est pas rendu** |
| `editorial_records[]` | C12, C13, C14 | Filtrés par `record_type` |
| `legal_records[]` | C15 | **Wave C : jamais rendus.** Preview seule ; le rendu réel est P13 |
| `warnings[]` | C03, §10 | Liste d'avertissements de niveau snapshot |

### 6.2 Valeur — `WaterMetricObservation`

| Champ | Composant | Rendu | Règle |
|---|---|---|---|
| `metric_code` | C05, C07, C11 | Identifiant de la métrique | Jamais traduit en libellé inventé ; le libellé lisible doit venir de la métadonnée de couche |
| `value` | C05, C07, C11 | Teinte + valeur textuelle | `null` → `WiAbsentValue`, **jamais** `0`, jamais teinte basse |
| `unit` | C07, C11 | Accolée à la valeur | `null` → valeur rendue sans unité inventée |
| `geography.scope` | C04, C05 | Niveau de zoom actif | Exactement `world` \| `europe` \| `france` |
| `geography.code` | C05, C07 | Clé de jointure | **Seule** clé de jointure autorisée. Aucune jointure par `label` |
| `geography.label` | C05, C07, C11 | Nom affiché | Affichage uniquement |
| `period_start` / `period_end` | C06, C07, C11 | Sélecteur + libellé de période | Toujours affichés à côté de la valeur, jamais dans un tooltip seul |
| `method.code` / `method.version` | C07, C11 | Puce méthode | Rendue telle quelle, jamais reformulée |
| `quality.data_status` | C07, C10, C11 | Statut de donnée | `observed` \| `modelled` \| `estimated` \| `manual` \| `fixture` — **vocabulaire public, distinct de `DataStatus` du noyau** (§16.4) |
| `quality.confidence` | C07, C11 | Bloc séparé de la valeur | **Jamais** dans la rampe de couleur de la valeur |
| `quality.coverage_pct` | C07, C08, C11 | Couverture | Distincte de la confiance |
| `quality.warnings[]` | C07 | Liste | Toujours visibles, jamais repliées par défaut |
| `source` | C09 | Ouvre le drawer | Un geste depuis la valeur |
| `scenario` | C06, C07 | Étiquette de projection | Une valeur de scénario n'est **jamais** rendue comme une mesure |
| `value_withheld` | C07, C11 | État « licence bloquée » | `true` → §7.5, motif affiché, aucune valeur |

### 6.3 Couche — `WaterGeoLayerDescriptor`

| Champ | Composant | Rendu |
|---|---|---|
| `layer_id` | C06 | Valeur du paramètre d'URL `dim` |
| `zoom_level` | C04, C06 | Détermine à quelle échelle la couche est proposée |
| `geography` | C05 | Périmètre couvert par la couche |
| `feature_count` | C04, C13 (perf) | **Borné à 1 000** par le contrat ; au-delà, la couche n'est pas montée (§13.5) |
| `boundary_format` | C05 | `topojson` par défaut |
| `payload_bytes_gzip` | C04 | Contrôle de budget avant chargement (§13.4) |
| `source` | C08, C09 | Provenance de la géométrie elle-même |

### 6.4 Provenance — `WaterSourceReference`

Tous les champs alimentent **C09 `WiSourceDrawer`** ; les trois marqués ⇢ sont également rendus en surface.

`source_code` ⇢ · `release_key` ⇢ · `checksum_sha256` (tronqué) · `published_at` · `retrieved_at` ⇢ · `observed_period_start`/`_end` · `methodology_version` · `license` (structurée, via C09) · `attribution` (obligatoire dès qu'elle est non nulle — CC BY impose l'attribution visible) · `warnings[]`.

### 6.5 Contenu éditorial — `WaterEditorialRecord`

| `record_type` | Composant | Champs rendus |
|---|---|---|
| `industry` | C12 `WiSectorCard` | `title`, `summary`, `jurisdiction`, `source`, `reviewed_on`, `reviewed_by` |
| `actor` | C12 | Idem. **Aucun classement** sans méthode sourcée : rendu en liste non ordonnée par défaut |
| `event` | C13 `WiEventItem` | `valid_from` (date de l'événement) **distincte** de `source.published_at` (date de publication), `jurisdiction` obligatoire |
| `innovation` | C14 `WiInnovationCard` | `summary` + arbitrages ; jamais un bénéfice net sans caveat |

`reviewed_on` et `reviewed_by` sont **toujours rendus**, pour tous les types. Un record sans revue humaine n'est pas publiable — c'est déjà une contrainte du schéma (champs non optionnels), la surface la rend visible.

### 6.6 Ce qui n'a aucun composant, volontairement

| Donnée | Pourquoi aucune UI |
|---|---|
| `WaterLegalRecord` | Wave C n'affiche que la preview C15. Le rendu réel exige le moteur déterministe et la revue humaine de P13 |
| Coordonnées de site | N'existent pas dans les contrats publics — niveau « site » réservé au cockpit (P02 §8) |
| Toute donnée tenant | ADR §6 |
| Un score composite | ADR §5 — aucun champ ne l'exprime, aucun composant ne le calcule |

---

## 7. États

Huit états, valables pour tout composant consommant de la donnée. Chacun a un **rendu obligatoire**, un **rendu interdit**, et une **règle d'accessibilité**.

### 7.1 Loading

- **Rendu :** squelette de la taille finale du bloc (pas de saut de mise en page), `aria-busy="true"` sur le conteneur, `role="status"` avec un texte « Chargement de la couche {label} ».
- **Interdit :** spinner infini sans libellé ; squelette qui ressemble à une valeur ; animation de pulsation sous `prefers-reduced-motion`.
- **Portée :** ne concerne **que** les couches chargées à la demande (§13.3). Le premier écran est prérendu — il n'a pas d'état de chargement.

### 7.2 Stale

- **Déclencheur :** dérivé côté serveur du `retrieved_at`/`published_at` de la release et du seuil existant `STALE_AFTER_DAYS = 120` (`apps/api/services/intelligence/freshness_service.py`). **Le seuil n'est pas réécrit dans le JSX.**
- **Rendu :** C10 `WiFreshnessBadge` en variante « périmé » + bandeau au niveau de la section, teinte `--wi-stress`, libellé texte « Snapshot potentiellement périmé » + date de dernière release.
- **Interdit :** masquer la valeur (elle reste vraie, elle est vieille) ; utiliser `--wi-alert` (le rouge est réservé à l'indisponibilité et à l'alerte critique, cf. commentaire du CSS existant).

### 7.3 Absent

- **Déclencheur :** `value === null` sans blocage de licence, ou entité géographique sans observation pour la dimension/période courante.
- **Rendu :** `WiAbsentValue` (existant) — badge « Donnée absente » + motif. Sur la carte : remplissage `--wi-absent` + hachures (`.wi-absent-fill`), et entrée conservée dans la table alternative.
- **Interdit :** `0`, `—` seul, teinte basse de la rampe, omission de la ligne de table, exclusion silencieuse du décompte.
- **A11y :** le motif est dans le flux du texte, pas seulement dans un `title`.

### 7.4 Licence bloquée

- **Déclencheur :** `source.license.allow_display === false` ⇒ le contrat **impose** `value_withheld === true` et `value === null`.
- **Rendu :** libellé « Valeur non publiable — licence » + raisons structurées (`license.reasons`) + accès au drawer. La source reste **nommée** : ce qui est bloqué est la valeur, pas l'existence de la source.
- **Interdit :** confondre visuellement avec 7.3. Une valeur retenue est un fait juridique, pas une lacune de couverture — teinte `--wi-compliance`, pas `--wi-absent`.
- **Garde-fou serveur :** rappel du risque identifié en P00 — la porte de publication d'une release ne teste que `allow_ingest AND allow_store`. C1 (P10) doit répliquer explicitement la redaction. **L'UI ne doit jamais être le dernier rempart** : si une valeur bloquée atteint le composant, c'est un défaut serveur, et le composant doit refuser de la rendre.

### 7.5 Source exclue

- **Déclencheur :** source écartée par le gate licence de Wave C (licence `unknown`, ou décision humaine non tranchée — cas WRI Aqueduct à date).
- **Rendu :** §04 comporte une sous-liste « Sources écartées » : `source_code`, motif, et ce que son absence retire de la couverture. C'est de l'information réelle et vérifiable.
- **Interdit :** silence. Une source écartée sans mention donne une fausse impression d'exhaustivité.
- **Note de conception :** cet état est **le plus probable en début de Wave C**. Le gate licence du macro-prompt C impose d'exclure toute source sans décision explicite et de consigner les exclusions dans le manifest ; `unknown` ne devient jamais autorisé.

### 7.6 Couverture partielle

- **Déclencheur :** `quality.coverage_pct` renseigné et inférieur à 100, ou couche dont la géographie ne couvre qu'une partie du scope affiché.
- **Rendu :** valeur **normalement lisible** + mention de couverture accolée + zones non couvertes en remplissage `absent` sur la carte. La légende porte une entrée « Non couvert ».
- **Interdit :** extrapoler, remplir spatialement, moyenner entre bassins sans pondération documentée (interdiction explicite de P06). Interdit aussi : traiter « couverture partielle » comme « confiance faible » — ce sont deux champs différents.

### 7.7 Erreur

- **Déclencheur :** manifest illisible, couche non décodable, échec de chargement d'une géométrie.
- **Rendu :** message explicite indiquant *ce qui* a échoué et *ce qui reste utilisable*, teinte `--wi-alert`, `role="alert"`. La page **ne tombe pas entièrement** : une erreur de couche laisse le cadre (niveaux 0-1) intact.
- **Interdit :** repli silencieux sur une fixture, sur une donnée mise en cache non datée, ou sur un état « vide » indistinguable de 7.3. Le dépôt a déjà tranché ce point pour le backend (`AdapterError`, `PipelineDataUnavailableError`, pas de `except Exception` masquant) ; la surface applique la même règle.
- **Frontière d'erreur :** une erreur de rendu de la carte ne doit pas démonter la page. Le pattern de frontière d'erreur des connecteurs (P03C) est la référence de comportement à transposer côté UI.

### 7.8 Fixture interdite à l'affichage

C'est l'état le plus spécifique à ce module, et le plus facile à casser par inadvertance.

- **Règle :** si `manifest.fixture_label` est non nul, **aucune valeur du manifest n'est rendue en surface publique** — ni mesure, ni unité, ni date de récupération, ni empreinte, ni date de release, ni pourcentage de couverture. Seule la **structure** est rendue, avec `WiPendingValue` (`n.c.` + motif).
- **Pourquoi :** décision P04B, motivée explicitement — « un badge est lu après le chiffre, quand il est lu ». La démonstration ne protège pas contre la mémorisation d'un chiffre inventé.
- **Portée en Wave C :** la règle s'étend à toutes les surfaces nouvelles. En particulier : **une carte ne se rend jamais à partir d'une fixture.** Pas de fond de carte colorié par des valeurs de démonstration, même badgé.
- **Test attendu :** dérivé de la fixture (pas codé en dur), échouant si l'une de ses valeurs réapparaît dans le HTML rendu — le test P04B existant est le modèle à étendre aux composants de Wave C.

### 7.9 Résolution des états simultanés

Un composant peut satisfaire plusieurs déclencheurs. Ordre de priorité, du plus fort au plus faible :

```
1. Fixture interdite   (7.8)  ← écrase tout : rien n'est rendu comme donnée
2. Erreur              (7.7)
3. Licence bloquée     (7.4)  ← avant l'absence : le motif juridique prime
4. Absent              (7.3)
5. Stale               (7.2)  ← modificateur : s'ajoute à une valeur rendue
6. Couverture partielle(7.6)  ← modificateur : s'ajoute à une valeur rendue
7. Loading             (7.1)
8. Nominal
```

Les états 5 et 6 sont des **modificateurs cumulables** : une valeur peut être à la fois périmée et partiellement couverte, et les deux mentions s'affichent.

---

## 8. Design tokens

### 8.1 Palette sémantique — valeurs existantes, non redéfinies

Les sept teintes demandées existent déjà dans `apps/carbon/app/water-intelligence/water-intelligence.css`, scopées à `[data-wi]`, avec un thème sombre via `prefers-color-scheme`. **Wave C n'invente aucune couleur et n'en modifie aucune.**

| Rôle | Token | Clair | Sombre | Usage autorisé |
|---|---|---|---|---|
| Bleu eau | `--wi-water` | `#0b4f82` | `#6fb6f2` | Ressource, eau, liens, focus |
| Cyan donnée | `--wi-data` | `#0e6e7d` | `#47d6e8` | Donnée, qualité, kickers, badge « en attente » |
| Ambre stress | `--wi-stress` | `#8a5200` | `#f5b942` | Stress, attention, **péremption**, badge « démonstration » |
| Rouge alerte | `--wi-alert` | `#a32015` | `#ff8a7a` | **Alerte critique ou indisponibilité uniquement** |
| Violet conformité | `--wi-compliance` | `#5b3a9e` | `#b79cf5` | Conformité, reporting, **valeur retenue pour licence** |
| Vert adaptation | `--wi-adapt` | `#1e6b45` | `#57d89a` | Adaptation, capacité, « ce qui est en place » |
| Gris absence | `--wi-absent` | `#5c6b7a` | `#8595a6` | Donnée absente — **toujours accompagné de `--wi-hatch`** |

Tokens de structure existants, également réutilisés tels quels : `--wi-bg`, `--wi-surface`, `--wi-card`, `--wi-card-2`, `--wi-border`, `--wi-border-2`, `--wi-fg`, `--wi-muted`, `--wi-subtle`, `--wi-focus`, `--wi-hatch`.

### 8.2 Les quatre règles d'emploi de la couleur

1. **Le rouge est rare.** `--wi-alert` ne code jamais « valeur haute ». Il code une indisponibilité ou une erreur. Une valeur élevée de stress se code en `--wi-stress`. Cette règle est écrite dans le commentaire du CSS existant ; Wave C ne l'assouplit pas.
2. **Une rampe = une dimension = une seule teinte.** Les rampes cartographiques sont **séquentielles monochromes** (du `--wi-card-2` de fond vers la teinte de la dimension), jamais divergentes, jamais arc-en-ciel. Le précédent du dépôt est `shareToAmber` (`lib/resources-viz`) : une teinte, une rampe.
3. **Jamais deux dimensions sur une même carte.** Changer de dimension change la rampe *et* le libellé de la légende. Aucune superposition bi-variée : elle produirait visuellement le score composite que l'ADR interdit.
4. **La couleur est toujours doublée.** Libellé texte systématique ; pour l'absence, texture (`.wi-absent-fill`) en plus du gris.

### 8.3 Tokens à ajouter (et uniquement ceux-là)

Wave C a besoin de trois familles de tokens qui n'existent pas encore. Elles doivent être ajoutées **dans `water-intelligence.css`**, scopées `[data-wi]`, dérivées des tokens existants — jamais de nouvelles couleurs brutes.

```css
/* Rampe cartographique — dérivée, une par dimension, générée à partir de --wi-* */
--wi-ramp-from: var(--wi-card-2);   /* extrémité basse : le fond, pas une teinte */
--wi-ramp-to:   var(--wi-stress);   /* extrémité haute : teinte de la dimension active */

/* Surfaces de carte */
--wi-map-land:    var(--wi-card-2); /* territoire hors couche */
--wi-map-stroke:  var(--wi-border); /* frontières */
--wi-map-select:  var(--wi-fg);     /* contour de l'entité sélectionnée */

/* Élévation — le CSS actuel n'a aucune ombre ; la carte et le drawer en ont besoin */
--wi-shadow-panel: 0 10px 30px rgb(0 0 0 / 0.22);
--wi-shadow-tip:   0 4px 14px  rgb(0 0 0 / 0.18);
```

`--wi-ramp-to` est réaffecté par la dimension active (attribut de données sur le conteneur de carte), ce qui évite d'écrire sept rampes en dur.

**Interdit :** ajouter des couleurs Tailwind brutes (`zinc-*`, `emerald-*`, `amber-*`) dans un composant `Wi*`. C'est précisément le couplage qui rend les composants `intelligence/*` non réutilisables en l'état (§16.2).

---

## 9. Typographie, espacements, rayons, grilles, densité

### 9.1 Typographie — échelle existante, deux ajouts

Familles déjà définies : `--wi-font-display` (Space Grotesk) pour les titres, `--wi-font-mono` (JetBrains Mono) pour les identifiants, la police système pour le corps de texte. Aucune police n'est ajoutée — donc aucun chargement distant, donc aucune ouverture CSP.

| Rôle | Classe | Taille | Poids | Note |
|---|---|---|---|---|
| H1 | `.wi-h1` | `clamp(2rem, 5vw, 3.25rem)` | 700 | Un seul par page |
| H2 (section) | `.wi-h2` | `clamp(1.5rem, 3vw, 2rem)` | 650 | — |
| H3 (carte/bloc) | `.wi-h3` | `1.0625rem` | 650 | — |
| **H4 (sous-bloc du panneau)** | `.wi-h4` **(à ajouter)** | `0.9375rem` | 650 | Nécessaire au panneau bassin, qui a une profondeur de plus que le shell |
| Lede | `.wi-lede` | `1.0625rem` / 1.65 | — | `max-width: 60ch` |
| Corps | — | `1rem` / 1.6 | — | `max-width: 62ch` sur les blocs de texte |
| Secondaire | `.wi-muted` | `0.9375rem` | — | — |
| Mono / identifiants | `.wi-mono` | `0.8125rem` | — | `metric_code`, `release_key`, `checksum`, `method.code` |
| **Numérique tabulaire** | `.wi-num` **(à ajouter)** | hérite | — | `font-variant-numeric: tabular-nums` — obligatoire dans C11 pour que les colonnes s'alignent |

Deux ajouts seulement : `.wi-h4` et `.wi-num`. Toute autre taille doit réutiliser l'échelle existante.

### 9.2 Espacements

Échelle en `rem` déjà pratiquée dans le shell, conservée telle quelle :

`0.25` · `0.375` · `0.5` · `0.625` · `0.75` · `0.875` · `1` · `1.25` · `1.5` · `2` · `2.5` · `3.5`

| Usage | Valeur |
|---|---|
| Padding de carte (`.wi-card`) | `1.25rem` |
| Gap de grille (`.wi-grid`) | `1rem` |
| Padding haut de section (`.wi-section`) | `3.5rem` |
| `scroll-margin-top` (compensation nav sticky) | `5rem` |
| Padding latéral du shell (`.wi-shell`) | `1.25rem` |
| Padding bas du shell | `5rem` |
| Gouttière carte ↔ panneau (desktop) | `1.25rem` |

### 9.3 Rayons

| Élément | Rayon | Origine |
|---|---|---|
| Carte / bloc | `0.75rem` | `.wi-card` existant |
| Zone d'absence | `0.5rem` | `.wi-absent-fill` existant |
| Bouton de nav, puce | `0.375rem` | `.wi-nav-link` existant |
| Focus | `0.25rem` | règle `:focus-visible` existante |
| Badge | `999px` | `.wi-badge` existant |
| **Conteneur de carte** | `0.75rem` | aligné sur `.wi-card` — pas de `1rem`/`2xl` importé de `/materials` |
| **Panneau latéral** | `0.75rem` côtés intérieurs, `0` côté bord d'écran | — |

### 9.4 Grilles

```
Shell           max-width: 72rem ; padding latéral 1.25rem      [existant, inchangé]

Grille contenu  1 col              < 48rem
                2 col (.wi-grid-2) ≥ 48rem
                3 col (.wi-grid-3) ≥ 48rem                       [existant, inchangé]

Grille carte    ≥ 64rem :  [ carte 1fr ] [ panneau 22rem ]      [NOUVEAU]
                48–64rem : [ carte 1fr ] + panneau en superposition
                < 48rem :  [ table 1fr ] + carte sur activation
```

`22rem` pour le panneau : largeur suffisante pour une paire libellé/valeur mono sans césure, sans réduire la carte sous la moitié du shell.

### 9.5 Densité

Trois densités, une par contexte. La densité ne se règle pas par préférence utilisateur (ce serait un état de plus à tester) — elle est déterminée par le composant.

| Contexte | Densité | Hauteur de ligne | Justification |
|---|---|---|---|
| Contenu explicatif (§01, 02, 05-10) | **Aérée** | 1.6–1.65 | Lecture continue |
| Panneau bassin, légende | **Moyenne** | 1.5 | Balayage de paires libellé/valeur |
| Table alternative, drawer de provenance | **Compacte** | 1.4 | Comparaison ligne à ligne ; `tabular-nums` obligatoire |

**Plancher non négociable :** aucune cible interactive sous **44 × 44 px** sur mobile, y compris les entités cliquables de la carte. Une entité géographique trop petite pour être atteinte au doigt n'est **pas** rendue cliquable sur mobile — la table alternative est le chemin d'accès (§12.6).

---

## 10. Interactions de la carte

### 10.1 Modèle d'état

Un état unique, dérivable intégralement de l'URL, détenu par C04 `WiMapExplorer` :

```
{ scope, code, dim, period_start, period_end, scenario, view }
```

Aucun de ces champs n'est un état local caché : toute interaction met à jour l'URL, et l'URL seule suffit à reconstruire l'écran. C'est ce qui rend le partage (§10.6) exact plutôt qu'approximatif.

### 10.2 Monde → Europe → France

Trois échelles, exactement celles de `WaterGeographyScopeEnum` — pas d'échelle intermédiaire, pas de zoom continu qui changerait implicitement de couche.

| Échelle | Contenu | Chargement |
|---|---|---|
| `world` | Agrégats, géométries très simplifiées | Chargée au premier rendu (dans le budget premier écran) |
| `europe` | Districts / sous-unités EEA, identifiants officiels | **À la demande**, au passage d'échelle |
| `france` | Bassins / sous-bassins, points selon la zone visible | **À la demande** |

**Transition :** le passage d'échelle est **explicite** — clic sur une entité, ou sélecteur d'échelle. Jamais déclenché par un seuil de zoom molette : un changement de couche provoqué par un geste continu est indétectable au clavier et illisible au lecteur d'écran.

**Retour :** un fil d'Ariane `Monde › Europe › France` toujours visible, chaque niveau cliquable. Le bouton « retour » du navigateur remonte d'un cran (conséquence directe de §10.1).

**Interdit :** charger `europe` et `france` au premier rendu ; conserver une couche déchargée en mémoire au-delà d'une entrée de cache ; changer d'échelle sans changer l'URL.

### 10.3 Sélection

- Une entité sélectionnée à la fois. Sélection ⇒ `code` dans l'URL ⇒ ouverture de C07 `WiBasinPanel`.
- Rendu de la sélection : contour `--wi-map-select`, épaisseur augmentée, **plus** un libellé persistant dans le panneau. Jamais le contour seul (règle « pas de couleur seule », valable aussi pour la forme).
- Re-sélection de la même entité = désélection (pattern déjà en place dans `WorldMap.tsx`).
- Une entité **sans donnée** pour la dimension courante n'est pas sélectionnable sur la carte, mais l'est dans la table — et le panneau s'ouvre alors sur l'état « Absent » avec motif.

### 10.4 Filtres

Quatre filtres, hiérarchisés. La hiérarchie n'est pas cosmétique : elle empêche des combinaisons qui n'ont pas de sens.

```
1. Échelle    (scope)   → détermine quelles couches sont proposables
2. Dimension  (dim)     → construit à partir de manifest.geo_layers filtré par scope
3. Période    (period)  → paires (period_start, period_end) présentes pour cette dimension
4. Scénario   (scenario)→ manifest.scenarios ; NON RENDU si la liste est vide
```

**Règles :**
- Un filtre sans option n'est **pas rendu**, il n'est pas rendu désactivé. Un contrôle grisé suggère qu'une donnée existe ailleurs.
- Changer un filtre de niveau *n* réinitialise les niveaux > *n* vers leur première valeur valide, et l'annonce (`aria-live="polite"`).
- Aucune option de filtre n'est écrite en dur dans le JSX. Toutes dérivent du manifest.
- Les dimensions **prévues mais non couvertes** sont listées **hors du sélecteur**, en texte, avec la mission qui les livrera. Elles ne sont jamais des options.

### 10.5 Période et scénario

- **Période :** liste fermée de périodes nommées, jamais un sélecteur de dates libre. Il n'existe pas de donnée entre deux périodes publiées.
- **Comparatif :** un seul comparatif, conformément au budget « snapshot courant + un comparatif explicite ». La comparaison est **côte à côte** ou en **delta explicite**, avec les deux périodes nommées ; jamais une animation de transition entre deux dates (elle donnerait à voir une continuité qui n'est pas mesurée).
- **Scénario :** une projection (`WaterScenario`, ex. un horizon) est visuellement distincte d'une observation — étiquette « Projection » + `horizon_year` + `data_status = modelled`. **Interdit :** afficher une projection et une observation dans la même rampe sans distinction.

### 10.6 URL partageable

```
/water-intelligence?scope=france&code={code}&dim={layer_id}
                   &period_start={ISO}&period_end={ISO}&scenario={code}&view=map#carte
```

Décisions :

| Point | Décision | Raison |
|---|---|---|
| Nom des paramètres | Reprend le nom du champ de contrat piloté (`scope`, `code`, `period_start`…) | Aucune table de correspondance à maintenir entre URL et contrat |
| Valeurs | Reprennent les valeurs de contrat (`world`/`europe`/`france`, `layer_id`, `scenario_code`) | Pas de vocabulaire d'URL parallèle à faire vivre |
| Valeur invalide | **Ignorée**, repli sur le défaut, avertissement visible « Paramètre {x} ignoré » | Un lien partagé après retrait d'une couche ne doit pas produire un écran vide inexpliqué |
| Historique | `replace` pour les micro-ajustements (survol, tri) ; `push` pour scope/dim/code | Le bouton retour reste utilisable |
| Ancre | `#carte` conservée, pour que le lien ouvre au bon endroit | — |
| CSR | `useSearchParams` est confiné à C04 | Un `useSearchParams` non borné provoquerait un bailout CSR sur toute la page — l'acquis P04 « aucun bailout CSR global » est un critère d'acceptation, pas un détail |

**Conséquence d'architecture :** C04 doit être enveloppé dans une frontière `<Suspense>` afin que le bailout reste local à la section carte.

### 10.7 Table alternative

Ce n'est **pas** une dégradation : c'est le second rendu de la même donnée, à parité stricte.

| Règle | Détail |
|---|---|
| Parité | Toute entité présente dans la couche est une ligne de la table — y compris celles sans valeur, marquées « Donnée absente » |
| Colonnes | Territoire (`geography.label` + `code`) · Valeur + unité · Période · Statut · Couverture · Confiance · Méthode · Source |
| Bascule | Contrôle explicite « Carte / Table », `view` dans l'URL, position identique dans les deux vues |
| Mobile | **Vue par défaut** (§4) |
| Tri | Par colonne, en JS local, sans requête. Le tri n'est pas persisté dans l'URL (`replace` seulement) |
| Sélection | Cliquer une ligne = sélectionner l'entité : même effet que sur la carte, même panneau |
| Interdit | Tronquer à un « top N » sans le dire ; paginer sans annoncer le total ; masquer les lignes absentes |

Le précédent du dépôt est explicite : `ConcentrationChoropleth` maintient déjà une liste texte complète sous la carte, incluant les codes non cartographiables. Wave C généralise ce comportement en une vraie table.

---

## 11. Micro-interactions et animations (Framer Motion)

`framer-motion` (^12.6.3) est déjà une dépendance ; `useReducedMotion` est déjà utilisé dans `components/ui/reveal.tsx`. Aucun ajout de dépendance.

### 11.1 Échelle de durées — dérivée de l'existant

| Rôle | Durée | Courbe | Origine dans le dépôt |
|---|---|---|---|
| Micro-retour (survol, focus, changement d'état d'un contrôle) | **120 ms** | `ease` | Valeur déjà utilisée : `.wi-nav-link`, `.wi-link` |
| Transition de couche / de teinte de carte | **250 ms** | `ease-out` | Valeur déjà utilisée pour le zoom de `WorldMap.tsx` |
| Ouverture / fermeture de panneau latéral | **220 ms** | `cubic-bezier(0.16, 1, 0.3, 1)` | Courbe déjà utilisée par `Reveal` |
| Apparition progressive au défilement | **jusqu'à 700 ms** | `cubic-bezier(0.16, 1, 0.3, 1)` | Valeur et courbe de `Reveal` |

Aucune durée hors de cette échelle. Aucune animation supérieure à 700 ms.

### 11.2 Transitions courtes

Survol d'une entité, focus d'un contrôle, changement d'état d'un filtre : **120 ms**, sur `color`, `background-color`, `opacity`, `stroke-width` uniquement. Jamais sur `width`/`height`/`top`/`left` (déclenchent une remise en page).

### 11.3 Apparition progressive

Réutiliser `Reveal` / `useReveal` (`components/ui/reveal.tsx`) tel quel, sans le dupliquer.

- **Portée :** blocs de contenu éditorial (§05, 06, 07) uniquement.
- **Exclusions strictes :** hero, Water Pulse, bandeau snapshot, carte, panneau, table, badges d'état. Une information d'état ne doit jamais attendre un défilement pour apparaître.
- `once: true` — jamais rejouée.
- Décalage entre éléments : **60 ms maximum**, plafonné à 4 éléments (au-delà, tout apparaît ensemble). Un décalage cumulé sur une longue liste transforme un défilement en attente.

### 11.4 Panneau latéral

- Desktop : glissement depuis la droite, 220 ms, avec `opacity` simultanée. Pas de rebond, pas de `spring`.
- Mobile : feuille montant depuis le bas, même durée.
- **Focus :** déplacé sur le titre du panneau à l'ouverture, restitué à l'élément déclencheur à la fermeture. `Échap` ferme (comportement déjà implémenté dans `SourceDrawer`).
- La fermeture est **immédiate** (≤ 120 ms) : une sortie ne se fait jamais attendre.

### 11.5 Changement de couche

- **Ce qui est animé :** la teinte de remplissage des entités (`fill`), 250 ms.
- **Ce qui n'est pas animé :** la géométrie. Un changement d'échelle **remonte** la nouvelle couche ; il ne morphe pas les frontières. Une interpolation entre deux découpages territoriaux différents laisserait croire à une continuité géographique inexistante.
- Pendant le chargement d'une couche : état 7.1, la couche précédente reste visible et **explicitement marquée comme la précédente** — jamais un fondu qui masquerait quelle donnée on regarde.

### 11.6 `prefers-reduced-motion`

La règle CSS globale existe déjà et neutralise animations et transitions sous `[data-wi]`. Wave C ajoute, côté JS :

- `useReducedMotion()` consulté dans **tous** les îlots animés (C04, C05, C07, C09).
- Sous réduction : opacité instantanée à la place des glissements, aucun décalage d'apparition, `Reveal` rend visible immédiatement (comportement déjà implémenté).
- **La transition de teinte de carte est également neutralisée** — un changement de couleur progressif sur une grande surface est un mouvement perçu.
- Une préférence de réduction ne retire jamais une fonctionnalité : seulement le mouvement.

### 11.7 Aucune animation perpétuelle décorative

Interdits, explicitement :

- pulsations d'anneaux, ondes, halos — le pattern `mx-ping-ring` de `/materials` **n'est pas transposé** ;
- flux animés, tirets défilants sur une carte ;
- compteurs qui s'incrémentent (`AnimatedCounter`) sur une valeur mesurée — l'animation d'un chiffre sourcé le fait passer pour un flux temps réel ;
- squelettes de chargement pulsés sous `prefers-reduced-motion` ;
- carrousels automatiques.

Une animation ne survit dans cette surface que si elle communique un **changement d'état déclenché par l'utilisateur**. « Water Pulse » nomme un état, pas une animation : le composant ne bat pas.

---

## 12. Accessibilité

Cible : **WCAG 2.1 niveau AA**. Le shell P04 fournit déjà lien d'évitement, hiérarchie de titres sans saut, `aria-labelledby` par section, focus visible 3 px jamais supprimé. Wave C hérite de ces acquis et les étend aux composants interactifs.

### 12.1 Clavier

| Élément | Comportement attendu |
|---|---|
| Filtres | Contrôles natifs (`<select>`, `<fieldset>`/`<legend>` pour les groupes de boutons radio). Aucun menu personnalisé sans gestion complète du clavier |
| Carte | **Ordre de tabulation à une seule entrée** : la carte est un groupe unique (`tabindex=0`, `role="application"` ou `role="img"` selon le mode). Les entités se parcourent aux **flèches**, pas au `Tab` — mille entités tabulables rendraient la page inutilisable |
| Sélection d'entité | `Entrée` / `Espace` |
| Échelle | `+` / `-` pour zoomer, `Retour arrière` pour remonter d'un niveau, boutons visibles équivalents |
| Panneau | Piège de focus tant qu'il est modal (mobile) ; pas de piège en mode latéral non modal (desktop) ; `Échap` ferme dans les deux cas |
| Drawer de provenance | Modal : piège de focus, `Échap`, restitution du focus |
| Table | Navigation native ; en-têtes de tri = `<button>` dans `<th>` avec `aria-sort` |

**Aucun raccourci à touche unique** sans modificateur en dehors du groupe carte focalisé (WCAG 2.1.4).

### 12.2 Contraste

- Texte normal ≥ **4.5:1**, texte large et éléments non textuels (frontières, contour de sélection, indicateur de focus) ≥ **3:1**, dans les **deux** thèmes.
- Les rampes cartographiques doivent conserver ≥ 3:1 entre deux paliers adjacents perceptibles, **ou** être doublées d'un motif — c'est la raison pour laquelle la légende est en paliers nommés et non en dégradé continu.
- **À mesurer, pas à supposer.** Les tokens existent, leurs combinaisons dans les composants de Wave C sont nouvelles : la PR doit produire les mesures. Aucune valeur de contraste n'est affirmée dans ce document.

### 12.3 Focus

- Contour 3 px `--wi-focus`, décalage 2 px, jamais supprimé (règle CSS existante).
- Sur la carte, le focus d'une entité doit rester visible **au-dessus** des remplissages voisins : contour dessiné en dernier dans l'ordre de peinture.
- Aucun `outline: none` sans remplacement au moins équivalent.
- L'ouverture d'un panneau déplace le focus ; sa fermeture le restitue. Aucun focus perdu sur `document.body`.

### 12.4 Lecteur d'écran

| Élément | Restitution |
|---|---|
| Carte | `aria-label` décrivant dimension, échelle et période courantes ; renvoi explicite vers la table (« Les mêmes données sont disponibles en tableau ») |
| Entité | Nom accessible = `geography.label` + valeur + unité + statut. Jamais la couleur |
| Changement de filtre | Région `aria-live="polite"` annonçant la nouvelle sélection et le nombre d'entités affichées |
| Valeur absente | Lue « Donnée absente » + motif, jamais un blanc |
| Valeur retenue | Lue « Valeur non publiable, licence » + raison |
| Badges | Le libellé texte est dans le DOM (déjà le cas pour `WiBadge`) — jamais uniquement dans `aria-label` |
| Erreur | `role="alert"` |
| Chargement | `role="status"` + `aria-busy` |

### 12.5 Non-dépendance à la couleur

Vérification à faire en niveaux de gris. Doivent rester distinguables : valeur présente vs absente (texture), valeur retenue pour licence vs absente (libellé), périmé vs frais (libellé), sélectionné vs non sélectionné (épaisseur de contour + panneau), projection vs observation (étiquette).

### 12.6 Alternative à la carte

**La table alternative n'est pas une aide : c'est un équivalent.** (§10.7)

- Atteignable sans souris, sans JS de carte, et présente dans le DOM initial rendu au serveur.
- Contient **toutes** les entités de la couche, y compris celles sans valeur et celles non cartographiables.
- Sur mobile, elle est la vue par défaut.
- Elle porte les mêmes accès à la provenance que la carte.

Test d'acceptation : couche montée, JS de carte neutralisé — l'information reste intégralement accessible.

---

## 13. Performance

### 13.1 Server Components par défaut

Le shell P04 est intégralement serveur, prérendu (`○` au build). Wave C conserve ce défaut : **tout est Server Component sauf les cinq îlots listés en §5.**

Une exigence explicite : `useSearchParams` reste confiné dans C04, sous `<Suspense>` (§10.6). Un bailout CSR global annulerait l'acquis principal de P04 et ferait échouer le critère d'acceptation « aucun bailout CSR global ».

### 13.2 Îlots clients

| Îlot | Justification de son existence |
|---|---|
| C04 `WiMapExplorer` | Détient l'état d'URL et l'orchestration |
| C05 `WiMapCanvas` | D3 a besoin du DOM ; le sous-arbre lui appartient (pattern de `WorldMap.tsx`) |
| C06 `WiMapFilters` | Contrôles interactifs |
| C07 `WiBasinPanel` | Ouverture/fermeture, focus |
| C09 `WiSourceDrawer` | Modal, `Échap`, focus |
| Tri de C11 | Peut être un sous-composant client minimal ; **la table elle-même est rendue au serveur** |

La table doit exister dans le HTML initial **avant** toute hydratation : c'est ce qui rend §12.6 vrai plutôt que théorique.

### 13.3 Chargement paresseux

| Ressource | Stratégie |
|---|---|
| Couche `world` | Incluse au premier écran (budget 250 Ko) |
| Couches `europe`, `france` | `import()` dynamique au passage d'échelle, jamais avant |
| Runtime D3 + topologie | Chargé avec C05, hors du bundle initial de la page |
| C09 `WiSourceDrawer` | Monté à la première ouverture |
| Contenus éditoriaux (§05-07) | Rendus au serveur, aucun chargement paresseux (ce sont du texte) |

**Interdit :** précharger les trois échelles ; embarquer une topologie France dans le bundle initial ; charger la carte sur mobile avant activation explicite.

### 13.4 Budgets de payload — repris de P02 §7, non renégociés

| Objet | Budget | Contrôle |
|---|---|---|
| Manifest public non compressé | **100 Ko** | Test CI (P10 prévoit un test de budget gzip) |
| Données critiques du premier écran non compressées | **250 Ko** | Mesure au build |
| Une couche géographique compressée | **400 Ko** | `WaterGeoLayerDescriptor.payload_bytes_gzip` — champ prévu pour ça |
| Requêtes réseau initiales | **6 maximum** | Vérifié en E2E |
| Points par série temporelle | **120 maximum** | — |
| Entités simultanées sur la carte | **1 000 maximum** | Borné dans le contrat (`feature_count` ≤ 1000, des deux côtés) |

Tout dépassement doit être **mesuré, expliqué et validé dans la PR** qui l'introduit — la règle est déjà écrite dans le pack maître.

### 13.5 Nombre maximal d'entités

`feature_count` est plafonné à 1 000 **par le schéma lui-même**, en Python et en Zod. Conséquences pour l'UI :

- Une couche hors budget est **rejetée à la validation**, pas tronquée silencieusement. L'UI affiche l'état 7.7 pour cette couche.
- Si une couche approche la borne, la stratégie est la **simplification géométrique en amont** (P10) ou le **découpage par territoire**, jamais le filtrage à l'affichage.
- La table alternative affiche le **même** ensemble : elle ne peut pas être plus complète que la couche, ni moins.
- Toute réduction volontaire doit être **annoncée à l'écran**. Une troncature muette lit comme une couverture complète.

### 13.6 Rendu de la carte

- Temps de rendu mesuré et consigné (tâche P11 : « limiter les features actives et mesurer le temps de rendu »).
- D3 possède le sous-arbre ; React ne touche pas son intérieur — seuls infobulle et contrôles autour sont React (pattern `WorldMap.tsx`).
- `ResizeObserver` pour recalculer la projection, sans état React intermédiaire (même pattern).
- Aucune animation en boucle : rien ne tourne quand l'utilisateur n'agit pas (§11.7).

---

## 14. Critères d'acceptation

Critères par composant (C01 → C16) dans **[`WAVE_C_COMPONENT_SPECS.md`](./WAVE_C_COMPONENT_SPECS.md)**.

Critères transverses — la surface entière doit les satisfaire pour que Wave C soit acceptable :

| # | Critère | Vérification |
|---|---|---|
| T01 | `/water` continue de résoudre vers le cockpit authentifié, inchangé | Build + test de route existant |
| T02 | Aucun bailout CSR global ; la page reste prérendue | Sortie de `next build` (`○`) |
| T03 | Zéro requête vers un domaine externe au runtime | E2E avec interception réseau ; CSP inchangée |
| T04 | Zéro donnée tenant dans le HTML, le RSC payload et le cache public | Test dédié |
| T05 | Les huit ancres historiques existent toujours | Extension du test d'ancres P04 |
| T06 | Aucune valeur de fixture visible quand `fixture_label` est non nul | Test dérivé de la fixture (modèle P04B) |
| T07 | Aucun score composite : aucune UI n'agrège deux dimensions | Revue + test sur le sélecteur de dimension |
| T08 | Table alternative à parité stricte avec la couche | Test comparant les deux ensembles |
| T09 | URL partageable : rechargement d'une URL d'état reproduit l'écran | E2E |
| T10 | Parcours clavier complet, focus jamais perdu | E2E clavier |
| T11 | `prefers-reduced-motion` : aucun mouvement résiduel | E2E |
| T12 | Budgets §13.4 respectés ou dépassement documenté | Test CI de budget |
| T13 | Zéro erreur console | E2E |
| T14 | Aucune couleur Tailwind brute dans un composant `Wi*` | Lint / revue |
| T15 | Aucune nouvelle dépendance | `package.json` inchangé |
| T16 | C15 et C16 ne rendent aucun chiffre, aucune date, aucun statut juridique | Test dédié |

---

## 15. Ce qui ne peut pas être codé avant Wave B

Wave B livre les connecteurs Hub'Eau : hydrométrie, piézométrie, prélèvements/BNPE, qualité de surface, et qualité souterraine sous condition de gate. **Toute l'échelle `france` en dépend.**

### 15.1 Bloqué par Wave B — code impossible avant

| Élément | Dépend de | Pourquoi c'est bloquant |
|---|---|---|
| Couche `france` (bassins/sous-bassins) | Wave B, toutes | Aucune observation à l'échelle française n'existe avant. Une carte de France sans donnée serait un fond de carte décoratif — exactement ce que le placeholder P04 refuse |
| Dimensions `hydrométrie`, `piézométrie` | B2 | Aucune source publiée |
| Dimension `prélèvements` | B3 (BNPE) | Idem. Rappel : absence de déclaration ≠ zéro — l'UI doit rendre l'absence, ce qui exige de savoir la distinguer, donc de connaître la forme réelle des données |
| Dimension `qualité` | B3 (Naïades / ADES) | Allowlist de paramètres, unités, limites de quantification : la forme de l'UI dépend de ce que le connecteur produit réellement |
| Sélecteur de période à l'échelle France | B2/B3 | Les périodes proposées sont celles réellement publiées |
| Table alternative France | B2/B3 | Même dépendance que la couche |
| Panneau bassin — sections hydro/piézo/qualité/prélèvements | B2/B3 | — |

### 15.2 Bloqué par une décision humaine, pas par du code

| Élément | Blocage | État |
|---|---|---|
| Toute valeur WRI Aqueduct (stress structurel mondial) | Licence CC BY 4.0 vérifiée, **mais** WRI demande en outre un enregistrement pour partager/adapter — non effectué | Décision ouverte consignée dans `PROJECT_STATE.yaml`. Tant qu'elle n'est pas tranchée, l'échelle `world` peut n'avoir **aucune** dimension publiable et relève de l'état 7.5 |
| Sources en licence `unknown` | `unknown` n'autorise rien et **ne devient jamais autorisé** | Gate licence de Wave C : exclusion + inscription dans le manifest |

### 15.3 Codable dès maintenant, indépendamment de Wave B

| Élément | Pourquoi |
|---|---|
| §01, §02 (cadre, dimensions) | Aucune donnée requise |
| Les huit états (§7) | Testables sur manifest vide/erroné/fixture — et c'est même la meilleure façon de les tester |
| C08 `WiLegend`, C10 `WiFreshnessBadge`, C09 `WiSourceDrawer` | Purement présentationnels, pilotés par props |
| C11 `WiDataTable` | Se rend à partir d'un tableau vide |
| C15, C16 (previews) | Ne rendent aucune donnée par construction |
| Structure de C04-C07, routage d'URL, a11y clavier, budgets | La mécanique ne dépend pas du contenu |
| Squelette de la carte à l'échelle `world` | La topologie `world-atlas` est déjà bundlée ; seule la **couche de valeurs** manque |

**Conséquence de séquençage :** Wave C peut être construite « à vide » et être **vraie** dans cet état — c'est-à-dire montrer honnêtement qu'aucune couche n'est publiable. C'est le seul mode de développement compatible avec la règle 5 de l'en-tête invariant. Le branchement des données est un remplacement de source, pas une reconstruction d'UI — c'est déjà la trajectoire décrite dans le handoff P04 §4.

---

## 16. Réutilisation depuis `/materials`, `/resources` et Intelligence

Principe : **réutiliser la forme et la logique, jamais le couplage métier.** Trois couplages à ne pas importer — la palette codée en dur, la source de données codée en dur, le vocabulaire du domaine d'origine.

### 16.1 Réutilisable tel quel

| Élément | Fichier | Ce qu'on prend |
|---|---|---|
| `Reveal` / `useReveal` | `components/ui/reveal.tsx` | Tel quel. Déjà partagé, déjà `prefers-reduced-motion`, déjà `once`. **Restreint aux sections éditoriales** (§11.3) |
| Topologie monde | `world-atlas/countries-110m.json` | Import module, aucun réseau |
| Runtime D3 | `d3-geo`, `d3-selection`, `d3-transition`, `d3-zoom`, `topojson-client` | Déjà installés |
| `zod` | — | Validation du manifest côté front, comme `fixture-manifest.ts` |
| Primitives `Wi*` | `components/water-intelligence/*` | Base de tout le nouveau code |

### 16.2 Réutilisable après découplage de la palette

Ces composants ont la **bonne forme** mais une palette Tailwind codée en dur (`zinc-950`, `emerald-300`, `amber-500/10`, `rose-500/30`) héritée des surfaces sombres de `/materials`. Les poser tels quels dans `[data-wi]` casserait la cohérence du thème et le contraste en mode clair.

| Élément | Fichier | Ce qu'on prend | Ce qu'on laisse |
|---|---|---|---|
| `SourceDrawer` | `components/intelligence/source-drawer.tsx` | **L'interface `SourceProvenance`** (champs de provenance), le comportement `Échap`, `role="dialog"`/`aria-modal`, et le principe « ne fetch rien lui-même » | Les classes `bg-zinc-950`, `text-emerald-400`, etc. → C09 rend la même information avec les tokens `--wi-*` |
| `LicenseWarning` | `components/intelligence/license-warning.tsx` | La **structure** de la décision de licence : jamais un booléen nu, toujours raisons + avertissements ; libellés « Affichage : autorisé/interdit », « Usage dérivé » | Palette emerald/rose → `--wi-adapt` / `--wi-alert`, et `--wi-compliance` pour une valeur retenue |
| `StalenessWarning` | `components/intelligence/staleness-warning.tsx` | La **logique de dérivation** (`isStale` dérivé, jamais un statut backend), le format de date `fr-FR`, le rendu discret quand frais / visible quand ancien | Palette amber/zinc → `--wi-stress` |
| `EvidenceList` | `components/intelligence/evidence-list.tsx` | Le **vocabulaire de statut de release** (`detected`/`quarantined`/`validated`/`published`/`superseded`/`blocked_license`) et le checksum tronqué | Palette + le type `Release` de `lib/api/intelligence` (couplé à l'API authentifiée) |
| `ResourceEmptyState` | `components/resources/resource-empty-state.tsx` | Le **pattern du décideur pur** (`resourcesEmptyStateKind`) : décider l'état vide hors du composant, testable sans monter la page. Excellent modèle pour §7.9 | Le composant lui-même (couplé au catalogue ressources et à la session démo) |
| `ConcentrationChoropleth` | `components/resources/viz/concentration-choropleth.tsx` | Trois décisions à reprendre : **jointure par code ISO zéro-paddé des deux côtés, jamais par nom** ; **code non apparié ≠ part nulle**, signalé explicitement ; **si rien n'est cartographiable, la carte n'est pas rendue** | La rampe ambre spécifique aux parts d'approvisionnement, le référentiel ISO pays (les géographies eau sont des bassins, pas des pays) |
| `WorldMap` | `components/materials/map/WorldMap.tsx` | Le **squelette technique** : D3 possède le sous-arbre, `ResizeObserver` → `render()`, projection `geoNaturalEarth1().fitExtent`, infobulle React hors du sous-arbre D3, boutons de zoom accessibles avec `aria-label` | `useMxTheme` (provider `/materials`), `CountryWeight` (domaine matières), les flèches de flux et `mx-ping-ring` (§11.7), la palette `--mx-*` |
| `StatTile`, `DimensionBar` | `components/resources/viz/*` | La forme d'un couple valeur/libellé compact pour le panneau bassin | Le domaine ressources |

### 16.3 À ne pas réutiliser

| Élément | Raison |
|---|---|
| `MaterialsProvenance` | Source codée en dur, aucun appel API — la matrice des capacités le signale explicitement comme « à ne pas copier comme modèle d'intégration live » |
| `MxThemeProvider` / tokens `--mx-*` | Thème `/materials`. P04 a délibérément choisi `prefers-color-scheme` en CSS pure plutôt qu'un provider React + `localStorage` : réintroduire un provider recréerait un risque d'écart d'hydratation et un composant client de plus |
| `AnimatedCounter` | Anime un chiffre mesuré (§11.7) |
| `MxTicker`, `Sparkline` | Un ticker suggère un flux temps réel ; une sparkline sans série réelle est une décoration. Le dépôt a déjà tranché ce point sur `/materials` |
| `ProvenanceIntegrityCard`, `KpiWithProvenance`, `KpiProvenanceDrawer` | Système de chaîne de hash `facts_events`, **sans rapport avec le Evidence Kernel** malgré le nom — piège de nommage signalé dans la matrice des capacités |
| Tout composant de `app/(app)/water/` | Cockpit authentifié. Un composant partagé devrait être audité pour garantir qu'il ne reçoit ses données que par props — plus coûteux que de repartir des primitives `Wi*` |
| `DataStatusBadge` **en tant que badge** | Voir §16.4 |

### 16.4 Le piège de vocabulaire à ne pas répéter

`DataStatusBadge` porte le mapping canonique du noyau : `verified` / `estimated` / `manual` / `inferred` → `VERIFIED` / `ESTIMATED` / `MANUAL` / `STALE`. Ce vocabulaire décrit le statut d'**ingestion** dans le Evidence Kernel.

Le read model public utilise un vocabulaire **délibérément différent** : `observed` / `modelled` / `estimated` / `manual` / `fixture`. La raison est écrite dans P02 §3 — une mesure directe et une projection de scénario ne sont pas de même nature, distinction que le noyau ne fait pas.

**Conséquence :** Wave C ne réutilise pas `DataStatusBadge` pour rendre `quality.data_status`. Un badge dédié est nécessaire, avec ses cinq valeurs. **Les deux vocabulaires ne sont jamais mélangés**, et aucune conversion implicite n'est introduite : si une conversion devient nécessaire, elle doit être un choix explicite documenté dans la PR qui l'introduit.

`DataStatusBadge` reste néanmoins la **référence de forme** (mapping centralisé en un seul endroit, `aria-label` complet, pastille + libellé texte).

---

## Annexe A — Ce que ce blueprint ne décide pas

Pour éviter qu'un silence soit lu comme une autorisation :

| Question | Statut |
|---|---|
| Découpage de `/water-intelligence` en sous-routes | Relève de P18, **optionnel et postérieur**. Non tranché ici |
| Indexation SEO de la route | P04 n'a pas posé `robots: {index:false}` ; l'arbitrage SEO n'appartient pas à Wave C |
| Contenu éditorial réel (textes de secteurs, événements, innovations) | Relève de P12 et d'une revue humaine. Ce blueprint fixe le **contenant**, jamais le contenu |
| Seuils et paliers des rampes cartographiques | Doivent venir des **métadonnées de méthode** de la source, jamais du JSX (interdiction explicite de P06 et P13). Non fixés ici |
| Libellés lisibles des `metric_code` | Doivent venir de la métadonnée de couche produite par P10 |
| Choix d'un fournisseur de géométries de bassins | Relève des connecteurs (Wave A/B) et du gate licence |
| Activation live du module | Décision humaine, hors périmètre UX |

---

## Annexe B — Correspondance avec la demande

| Point demandé | Où il est traité |
|---|---|
| 1. Architecture de l'information | §1 |
| 2. Parcours utilisateur (6) | §2.1 → §2.6 |
| 3. Structure exacte des sections | §3 |
| 4. Wireframes desktop / tablette / mobile | §4 + [`WAVE_C_WIREFRAMES.md`](./WAVE_C_WIREFRAMES.md) |
| 5. Inventaire des composants (14 demandés) | §5 + [`WAVE_C_COMPONENT_SPECS.md`](./WAVE_C_COMPONENT_SPECS.md) |
| 6. Matrice données → composant | §6 |
| 7. États (8 demandés) | §7.1 → §7.8, ordre de priorité §7.9 |
| 8. Design tokens (7 teintes) | §8.1 |
| 9. Typographie, espacements, rayons, grilles, densité | §9 |
| 10. Interactions de la carte | §10 |
| 11. Micro-interactions et animations Framer Motion | §11 |
| 12. Accessibilité | §12 |
| 13. Performance | §13 |
| 14. Critères d'acceptation de chaque composant | §14 + [`WAVE_C_COMPONENT_SPECS.md`](./WAVE_C_COMPONENT_SPECS.md) |
| 15. Éléments codables seulement après Wave B | §15 |
| 16. Réutilisation sans couplage métier | §16 |
