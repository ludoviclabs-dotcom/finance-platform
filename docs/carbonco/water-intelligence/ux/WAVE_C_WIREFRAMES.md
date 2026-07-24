# Wave C — Wireframes textuels de `/water-intelligence`

Complément de [`WAVE_C_UX_UI_BLUEPRINT.md`](./WAVE_C_UX_UI_BLUEPRINT.md) §4.

**Convention de lecture :**

| Notation | Signification |
|---|---|
| `{champ}` | Emplacement alimenté par un champ de contrat — **jamais une valeur d'exemple** |
| `n.c.` | Rendu littéral de `WiPendingValue` (valeur non communiquée + motif) |
| `▨` | Zone hachurée `.wi-absent-fill` — donnée absente |
| `[Cxx]` | Composant, voir [`WAVE_C_COMPONENT_SPECS.md`](./WAVE_C_COMPONENT_SPECS.md) |
| `·····` | Limite de section |
| `(SC)` / `(îlot)` | Server Component / composant client |

**Aucun chiffre n'apparaît dans ce document.** C'est volontaire : une maquette contenant un nombre plausible finit recopiée dans le code (décision P04B).

**Points de rupture :** mobile `< 48rem` · tablette `≥ 48rem` · desktop `≥ 64rem`. Shell `max-width: 72rem`, padding latéral `1.25rem`.

---

## 1. Chrome persistant

### 1.1 Desktop `≥ 64rem`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Aller au contenu principal]  ← visible au premier Tab uniquement (.wi-skip)  │
├──────────────────────────────────────────────────────────────────────────────┤
│ WiNav (sticky, top:0, z:10, backdrop-blur, border-bottom)              [SC]   │
│ Vue d'ensemble · Risques · Carte · Sources · Secteurs · Événements ·          │
│ Innovations · Réglementation · Synergies · Limites                            │
└──────────────────────────────────────────────────────────────────────────────┘
        ↑ 10 ancres. Les 8 historiques conservent leur id. Débordement → scroll-x.
```

### 1.2 Tablette et mobile

Identique — `WiNav` est déjà `overflow-x: auto` et n'a besoin d'aucune variante. Aucun menu « hamburger » : un menu replié ajouterait un îlot client pour dix ancres.

---

## 2. Hero + Water Pulse — `#vue-ensemble` (haut de page)

### 2.1 Desktop

```
┌──────────────────────────────────────────────────────────────── 72rem ───────┐
│                                                                              │
│  [Module en construction]  [Sources non branchées]        ← WiBadge (SC)     │
│                                                                              │
│  Water Intelligence                                     .wi-h1, clamp 2→3.25 │
│                                                                              │
│  Le contexte hydrique — mondial, européen et français — reconstitué à        │
│  partir de sources officielles, avec leur provenance, leur licence et        │
│  leurs limites affichées.                                    .wi-lede, 60ch  │
│                                                                              │
│  Vous cherchez le suivi hydrique de votre entreprise ?                       │
│  → Accéder au cockpit Eau & stress hydrique (accès authentifié)              │
│                              ↑ sortie n°1 vers /water, étiquetée             │
│                                                                              │
│  ┌───────────────────────── [C02] WiWaterPulse (SC) ──────────────────────┐  │
│  │ ÉTAT DE LA DONNÉE PUBLIÉE          Assemblé le {generated_at}          │  │
│  │                                                                        │  │
│  │ ┌────────────┐┌────────────┐┌────────────┐┌────────────┐┌───────────┐  │  │
│  │ │Stress      ││Sécheresse  ││Prélèvements││Hydrométrie ││Qualité    │  │  │
│  │ │structurel  ││            ││            ││            ││           │  │  │
│  │ │▨ Absent    ││▨ Absent    ││▨ Absent    ││▨ Absent    ││▨ Absent   │  │  │
│  │ │Non couvert ││Non couvert ││Non couvert ││Non couvert ││Non couvert│  │  │
│  │ └────────────┘└────────────┘└────────────┘└────────────┘└───────────┘  │  │
│  │        ↑ une puce par couche PRÉSENTE dans manifest.geo_layers.        │  │
│  │          Jamais un indice unique. Jamais une moyenne.                  │  │
│  │          Chaque puce : libellé · statut · couverture · fraîcheur       │  │
│  │          Clic → fixe `dim` et défile vers #carte                       │  │
│  │                                                                        │  │
│  │ Sources publiées {n} · Sources écartées {n} → voir Sources et preuves  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────── [C03] WiSnapshotBanner (SC) — existant ───────────────┐  │
│  │ [Démonstration] Aucune donnée réelle n'est affichée sur cette page.    │  │
│  │ Manifest  version {manifest_version}                                   │  │
│  │ Étiquette {fixture_label}                                              │  │
│  │ Source    {source_code}                                                │  │
│  │ Release   {release_key}                                                │  │
│  │ Récupéré  n.c. — aucune récupération réelle à ce jour                  │  │
│  │ Empreinte n.c. — calculée à la première release publiée                │  │
│  │ · {warnings[]}                                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Water Pulse — trois décisions de conception :**

1. Il mesure **l'état de la donnée**, pas l'état de l'eau. Le nom ne doit pas laisser croire à un indice hydrique. Sous-titre obligatoire : « État de la donnée publiée ».
2. Une puce **par couche réellement présente** dans le manifest. Zéro couche ⇒ une seule ligne : « Aucune couche publiée à ce jour ». Jamais des puces fantômes pour des dimensions prévues.
3. **Aucune agrégation.** Pas de « 3/7 dimensions couvertes » présenté comme un score de complétude : le décompte est une phrase, pas une jauge.

### 2.2 Tablette `≥ 48rem`

Puces du Pulse sur 2–3 colonnes (`.wi-grid`, `flex-wrap`). Le reste est identique — le hero est déjà fluide.

### 2.3 Mobile `< 48rem`

```
┌────────────────────────────┐
│ [Module en construction]   │
│ [Sources non branchées]    │
│                            │
│ Water Intelligence         │
│                            │
│ Le contexte hydrique…      │
│                            │
│ → Cockpit Eau (authentifié)│
│                            │
│ ┌────── [C02] ───────────┐ │
│ │ ÉTAT DE LA DONNÉE      │ │
│ │ Assemblé le {…}        │ │
│ │ ┌────────────────────┐ │ │
│ │ │Stress structurel   │ │ │
│ │ │▨ Absent            │ │ │
│ │ └────────────────────┘ │ │
│ │ ┌────────────────────┐ │ │
│ │ │Sécheresse          │ │ │
│ │ │▨ Absent            │ │ │
│ │ └────────────────────┘ │ │
│ │ ⋮  (empilées, 1 col)   │ │
│ └────────────────────────┘ │
│                            │
│ ┌────── [C03] ───────────┐ │
│ │ [Démonstration]        │ │
│ │ Manifest   {…}         │ │
│ │ ⋮ (dl passe en 1 col : │ │
│ │   dt au-dessus de dd)  │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

Le `<dl>` du bandeau passe de `grid-template-columns: auto 1fr` à une seule colonne sous `48rem` : à cette largeur, une colonne d'étiquettes mono ne laisse pas assez de place à la valeur.

---

## 3. `#vue-ensemble` (corps) et `#risques`

Ces deux sections **ne changent pas** en Wave C. Rappel de structure, pour montrer où s'insère le reste.

```
·····························································
 01 — Proposition                                       (kicker)
 Vue d'ensemble                                          .wi-h2
 [paragraphe, 62ch]
 ┌───────────────┐┌───────────────┐┌───────────────┐  .wi-grid-3
 │Chaque valeur  ││Risque et      ││Aucun score    │
 │porte sa preuve││confiance…     ││unique opaque  │
 └───────────────┘└───────────────┘└───────────────┘
 [paragraphe de clôture]
·····························································
 02 — Méthode
 Comprendre les risques hydriques
 [paragraphe, 62ch]
 ┌────────┐┌────────┐┌────────┐   ← 9 WiCard, .wi-grid-3
 │Stress  ││Sécher- ││Inonda- │     mobile 1 col · tablette+ 3 col
 │struct. ││esse    ││tion    │     AUCUNE hiérarchie visuelle entre
 └────────┘└────────┘└────────┘     les 9 : pas de tri, pas d'ordre
 ┌────────┐┌────────┐┌────────┐     d'importance, pas de numérotation
 │Eaux    ││Qualité ││Dépend. │
 │souter. ││pollut. ││opérat. │
 └────────┘└────────┘└────────┘
 ┌────────┐┌────────┐┌────────┐
 │Sensib. ││Capacité││Confian.│
 │réglem. ││adapt.  ││docum.  │
 └────────┘└────────┘└────────┘
·····························································
```

Les 9 dimensions du §02 sont le **vocabulaire conceptuel**. Les couches du sélecteur de carte (§4) sont les dimensions **réellement outillées par un connecteur**. Les deux listes ne coïncident pas et ne doivent pas être présentées comme identiques.

---

## 4. `#carte` — Carte et territoires (pièce maîtresse)

### 4.0 État par défaut en Wave C : aucune couche publiable

Tant que le gate licence n'a laissé passer aucune source, la section **ne monte pas de carte** et conserve le placeholder P04.

```
·····························································
 03 — Territoires
 Carte et territoires
 [paragraphe]
 ┌────────────────────────────────────────────────────────┐
 │▨▨▨ [Non branché]  Prévu : P11 — explorateur ▨▨▨▨▨▨▨▨▨▨│
 │▨                                                      ▨│
 │▨ Aucune carte n'est affichée à ce stade. Publier un   ▨│
 │▨ fond de carte sans données sourcées derrière donne-  ▨│
 │▨ rait une impression de couverture qui n'existe pas.  ▨│
 │▨                                                      ▨│
 │▨ Couches attendues et leur mission :                  ▨│
 │▨  · Stress structurel mondial ....... P05 (licence à  ▨│
 │▨    trancher — enregistrement WRI non effectué)       ▨│
 │▨  · Rareté européenne ............... P06 / Wave A    ▨│
 │▨  · Sécheresse courante ............. P09 / Wave A    ▨│
 │▨  · Hydrométrie, piézométrie ........ Wave B          ▨│
 │▨  · Prélèvements, qualité ........... Wave B          ▨│
 │▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨│
 └────────────────────────────────────────────────────────┘
·····························································
```

C'est l'état **nominal** de Wave C à sa livraison, pas un état d'erreur. Il doit être aussi soigné que l'état alimenté.

### 4.1 Desktop `≥ 64rem` — vue carte

```
·······················································································
 03 — Territoires
 Carte et territoires
 [paragraphe court : ce que la carte montre et ce qu'elle ne montre pas]

 ┌─────────────────────── [C06] WiMapFilters (îlot) ──────────────────────────────┐
 │ Monde › Europe › France          ← fil d'Ariane, chaque niveau cliquable       │
 │                                                                                │
 │ Échelle    ( ) Monde  (•) Europe  ( ) France      → param `scope`             │
 │ Dimension  [ {layer_id} ▾ ]                       → param `dim`               │
 │              ↑ construit depuis manifest.geo_layers filtré par scope           │
 │ Période    [ {period_start} – {period_end} ▾ ]    → params `period_*`          │
 │            [ ] Comparer à [ {période} ▾ ]         → un seul comparatif         │
 │ Scénario   [ {scenario_code} ▾ ]                  → NON RENDU si scenarios=[]  │
 │                                                                                │
 │                                    [ Carte ] [ Tableau ]   → param `view`      │
 │ Dimensions non encore couvertes : {liste}                                      │
 │   ↑ en TEXTE, hors du sélecteur — jamais des options grisées                   │
 └────────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────── [C05] WiMapCanvas (îlot) ────────────┐ ┌─ [C07] WiBasinPanel ─┐
 │                                                 [+]  │ │        (îlot, 22rem)  │
 │                                                 [−]  │ │                       │
 │        ┌──────────────────────────────┐              │ │ {geography.label}     │
 │        │                              │              │ │ {geography.code} mono │
 │        │   SVG D3 — geoNaturalEarth1  │              │ │                  [×]  │
 │        │   fitExtent au conteneur     │              │ ├───────────────────────┤
 │        │   ResizeObserver → render()  │              │ │ DIMENSION AFFICHÉE    │
 │        │                              │              │ │ {metric_code}         │
 │        │   ▨ = entité sans donnée     │              │ │ {value} {unit}        │
 │        │       (gris + hachures)      │              │ │ {period_start}–{end}  │
 │        │   ▪ = entité sélectionnée    │              │ │                       │
 │        │       (contour --wi-map-     │              │ │ Méthode               │
 │        │        select, épaisseur 2)  │              │ │ {method.code}         │
 │        │                              │              │ │  v{method.version}    │
 │        └──────────────────────────────┘              │ │                       │
 │                                                      │ │ Statut  {data_status} │
 │  ┌──── [C08] WiLegend (SC) ────────────────────────┐ │ │ Couvert.{coverage_pct}│
 │  │ {label de la dimension}                         │ │ │ Confian.{confidence}  │
 │  │ ▢▢▢▢▢  paliers NOMMÉS, pas un dégradé continu   │ │ │  ↑ deux lignes        │
 │  │ {p1} {p2} {p3} {p4} {p5}                        │ │ │    DISTINCTES, jamais │
 │  │ ▨ Donnée absente   ▧ Non couvert                │ │ │    fusionnées         │
 │  │ ⌷ Valeur retenue (licence)                      │ │ │                       │
 │  │ Source {source_code} · {release_key} · Provenance→│ │ ├───────────────────────┤
 │  └─────────────────────────────────────────────────┘ │ │ AVERTISSEMENTS        │
 │                                                      │ │ · {quality.warnings}  │
 │  Fraîcheur [C10] · {n} entités affichées             │ │ · {source.warnings}   │
 └──────────────────────────────────────────────────────┘ │  ↑ jamais repliés     │
                                                          ├───────────────────────┤
                                                          │ AUTRES DIMENSIONS     │
                                                          │ {dim} … {valeur|▨}    │
                                                          │ {dim} … {valeur|▨}    │
                                                          │  ↑ LISTE, jamais un   │
                                                          │    agrégat            │
                                                          ├───────────────────────┤
                                                          │ Provenance →   [C09]  │
                                                          │ Évaluer mes sites sur │
                                                          │ ce bassin (authentifié)│
                                                          │  ↑ sortie n°2, sans   │
                                                          │    paramètre tenant   │
                                                          └───────────────────────┘

 ┌──── Repli de couverture, toujours sous la carte ─────────────────────────────┐
 │ {n} entité(s) non cartographiable(s) : {codes} — conservée(s) dans le tableau │
 └──────────────────────────────────────────────────────────────────────────────┘
·······················································································
```

Le bloc « non cartographiable » reprend littéralement le comportement de `ConcentrationChoropleth` : un code sans correspondance officielle est **signalé**, jamais colorié comme une valeur nulle, jamais retiré du tableau.

### 4.2 Desktop — vue tableau (`view=table`)

Même section, même filtres, la carte est remplacée par `[C11] WiDataTable`. **Aucune donnée n'est perdue à la bascule.**

```
 ┌──────────────────── [C11] WiDataTable (SC + tri îlot) ───────────────────────┐
 │ {n} territoires · dimension {label} · période {period_start}–{period_end}     │
 │                                                                              │
 │ Territoire ⇅ │ Valeur ⇅ │ Unité │ Période │ Statut │ Couv. ⇅ │ Conf. ⇅ │ Méth.│ Src │
 │──────────────┼──────────┼───────┼─────────┼────────┼─────────┼─────────┼──────┼─────│
 │ {label}      │ {value}  │{unit} │ {…}     │ {…}    │ {…}     │ {…}     │{code}│  →  │
 │ {code} mono  │ tabular  │       │         │        │         │         │      │     │
 │──────────────┼──────────┼───────┼─────────┼────────┼─────────┼─────────┼──────┼─────│
 │ {label}      │ ▨ Donnée │  —    │ {…}     │   —    │   —     │   —     │  —   │  →  │
 │ {code}       │  absente │       │         │        │         │         │      │     │
 │              │ {motif}  │       │         │        │         │         │      │     │
 │──────────────┼──────────┼───────┼─────────┼────────┼─────────┼─────────┼──────┼─────│
 │ {label}      │ ⌷ Valeur │  —    │ {…}     │ {…}    │   —     │   —     │  —   │  →  │
 │ {code}       │  retenue │       │         │        │         │         │      │     │
 │              │ (licence)│       │         │        │         │         │      │     │
 │              │ {reason} │       │         │        │         │         │      │     │
 └──────────────────────────────────────────────────────────────────────────────┘
   ↑ Les lignes absentes et retenues sont DES LIGNES. Aucun filtrage par défaut.
   ↑ Clic sur une ligne = sélection = ouvre [C07], comme sur la carte.
   ↑ Tri par en-tête <button> dans <th>, aria-sort. Non persisté dans l'URL.
```

### 4.3 Tablette `≥ 48rem` et `< 64rem`

```
 ┌───────────── [C06] WiMapFilters ─────────────┐   filtres empilés sur 2 colonnes
 │ Échelle / Dimension                          │
 │ Période / Scénario                           │
 │                          [ Carte ][ Tableau ]│
 └──────────────────────────────────────────────┘
 ┌──────────── [C05] WiMapCanvas ───────────────┐   carte pleine largeur
 │                                        [+][−]│
 │                                              │
 │                                              │
 │  ┌─── [C08] WiLegend ───────────────────────┐│
 │  └──────────────────────────────────────────┘│
 └──────────────────────────────────────────────┘

 Sélection d'une entité →

 ┌──────────────────────────────────────────────┐
 │▒▒▒▒▒▒▒▒▒▒ voile, clic = fermeture ▒▒▒▒▒▒▒▒▒▒▒│
 │   ┌────── [C07] WiBasinPanel ─────────────┐  │
 │   │  glisse depuis la droite, 220 ms      │  │
 │   │  largeur ≈ 60 % — la carte reste      │  │
 │   │  partiellement visible derrière       │  │
 │   │  MODAL : piège de focus + Échap       │  │
 │   └───────────────────────────────────────┘  │
 └──────────────────────────────────────────────┘
```

### 4.4 Mobile `< 48rem` — **le tableau est la vue par défaut**

```
┌────────────────────────────┐
│ 03 — Territoires           │
│ Carte et territoires       │
│                            │
│ ┌── [C06] filtres ───────┐ │
│ │ Échelle   [ Europe ▾ ] │ │
│ │ Dimension [ {…}    ▾ ] │ │
│ │ Période   [ {…}    ▾ ] │ │
│ │                        │ │
│ │ [ Tableau ] [ Carte ]  │ │  ← Tableau ACTIF par défaut
│ └────────────────────────┘ │
│                            │
│ ┌── [C11] tableau ───────┐ │
│ │ {label}                │ │  ← rendu en CARTES empilées,
│ │ {code}          mono   │ │    pas en table à scroll-x
│ │ ─────────────────────  │ │
│ │ Valeur   {value}{unit} │ │
│ │ Période  {…}           │ │
│ │ Statut   {…}           │ │
│ │ Couvert. {…}           │ │
│ │ Confian. {…}           │ │
│ │ Méthode  {…}           │ │
│ │ Provenance →           │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │ {label}                │ │
│ │ ▨ Donnée absente       │ │
│ │ {motif}                │ │
│ └────────────────────────┘ │
│            ⋮               │
└────────────────────────────┘

Activation de « Carte » →

┌────────────────────────────┐
│ ┌── [C05] carte ─────────┐ │   ← import() du runtime D3 SEULEMENT ICI
│ │                  [+][−]│ │
│ │   hauteur ≈ 55 vh      │ │
│ │                        │ │
│ └────────────────────────┘ │
│ ┌── [C08] légende ───────┐ │
│ │ paliers empilés        │ │
│ └────────────────────────┘ │
│ [ Revenir au tableau ]     │
└────────────────────────────┘

Sélection d'une entité →

┌────────────────────────────┐
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│                            │
│ ┌─── [C07] feuille ──────┐ │   ← monte depuis le bas, 220 ms
│ │ ══                     │ │      poignée + [×], MODAL
│ │ {label}           [×]  │ │      hauteur max 85 vh, scroll interne
│ │ ─────────────────────  │ │
│ │ {metric_code}          │ │
│ │ {value} {unit}         │ │
│ │ ⋮                      │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

**Justification du défaut mobile :** le budget « 6 requêtes initiales » et « 250 Ko premier écran » est le plus contraint sur mobile, et une entité de bassin est souvent plus petite que la cible tactile de 44 px. Le tableau est complet, accessible et léger ; la carte est un enrichissement explicitement demandé.

---

## 5. `#sources` — Sources et preuves

### 5.1 Desktop

```
·······················································································
 04 — Provenance
 Sources et preuves
 [paragraphe]

 ┌───────────────┐┌───────────────┐              .wi-grid-2, existant, conservé
 │Ce qui accom-  ││Ce qu'une      │
 │pagne une      ││licence res-   │
 │valeur publiée ││trictive impli-│
 └───────────────┘└───────────────┘

 SOURCES PUBLIÉES                                          [C11] en mode liste
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Source ⇅   │ Release   │ Publiée le │ Récupérée │ Licence │ Fraîcheur │   │
 │────────────┼───────────┼────────────┼───────────┼─────────┼───────────┼───│
 │{source_    │{release_  │{published_ │{retrieved │[Licence │  [C10]    │ → │
 │ code}      │ key}      │ at}        │ _at}      │  OK]    │           │   │
 │            │           │            │           │Affichage│           │   │
 │            │           │            │           │: autor. │           │   │
 └──────────────────────────────────────────────────────────────────────────┘
   ↑ Attribution rendue VISIBLE dès que source.attribution est non nul
     (CC BY impose l'attribution — ce n'est pas une option d'affichage)

 SOURCES ÉCARTÉES                                          ← état 7.5, jamais tu
 ┌──────────────────────────────────────────────────────────────────────────┐
 │▨ {source_code} — motif : {raison}                                        │
 │  Ce que son absence retire : {dimension(s) non couverte(s)}              │
 │──────────────────────────────────────────────────────────────────────────│
 │▨ {source_code} — licence `unknown` : n'autorise ni stockage, ni          │
 │  affichage, ni usage dérivé. `unknown` ne devient jamais autorisé.       │
 └──────────────────────────────────────────────────────────────────────────┘

 [bloc « Exemple de rendu d'une observation » — existant P04B, conservé
  tant que fixture_label est non nul, retiré quand une donnée réelle existe]
·······················································································
```

Cette section est la seule qui **gagne** en substance quand la couverture est faible : plus il y a d'exclusions, plus elle est informative. C'est ce qui la rend robuste à l'état de départ de Wave C.

### 5.2 Tablette / mobile

`.wi-grid-2` → 1 colonne. Les deux tables passent en cartes empilées (même règle que §4.4) ; la liste des exclusions est déjà une liste, elle ne change pas.

---

## 6. `#secteurs`, `#evenements`, `#innovations` — contenus P12

### 6.1 Desktop — `#secteurs`

```
·······················································································
 05 — Exposition
 Secteurs et dépendances
 [paragraphe]

 [ Tous ] [ Industrie ] [ Acteur ]        ← filtre par record_type, îlot minimal
                                            ou <details>/liens sans JS

 ┌──────────────┐┌──────────────┐┌──────────────┐   .wi-grid-3, [C12] WiSectorCard
 │{title}       ││{title}       ││{title}       │
 │              ││              ││              │
 │{summary}     ││{summary}     ││{summary}     │
 │              ││              ││              │
 │{jurisdiction}││{jurisdiction}││{jurisdiction}│
 │Revu le       ││Revu le       ││Revu le       │
 │{reviewed_on} ││{reviewed_on} ││{reviewed_on} │
 │par {reviewed ││par {…}       ││par {…}       │
 │      _by}    ││              ││              │
 │Source →      ││Source →      ││Source →      │
 └──────────────┘└──────────────┘└──────────────┘
   ↑ reviewed_on + reviewed_by TOUJOURS rendus. Un contenu sans revue humaine
     n'est pas publiable — la surface rend ce fait visible.
   ↑ Acteurs : ORDRE NON SIGNIFIANT par défaut. Un classement n'apparaît que si
     une méthode objective et sourcée l'accompagne, et la méthode est affichée
     à côté du classement, pas dans une note de bas de page.

 [si editorial_records vide] → WiPlaceholder, mission P12 nommée
·······················································································
```

### 6.2 Desktop — `#evenements`

```
·······················································································
 06 — Observations
 Climat et événements
 [paragraphe]

 ┌──────────────────────── [C13] WiEventItem ─────────────────────────────────┐
 │ {valid_from}          ← DATE DE L'ÉVÉNEMENT                                │
 │ {title}                                                                    │
 │ {jurisdiction}        ← lieu obligatoire                                   │
 │ {summary}                                                                  │
 │ Publié le {source.published_at}  ← DATE DE PUBLICATION, distincte          │
 │ Revu le {reviewed_on} par {reviewed_by}     ·     Source →                 │
 └────────────────────────────────────────────────────────────────────────────┘
   ↑ Les deux dates sont côte à côte et NOMMÉES. Les confondre est le principal
     contresens possible sur un événement (interdiction explicite de P12).
   ↑ Liste chronologique. AUCUNE causalité n'est affichée : pas de « à cause
     de », pas de mise en relation d'un événement avec une valeur de la carte.
·······················································································
```

### 6.3 Desktop — `#innovations`

```
·······················································································
 07 — Adaptation
 Innovations et adaptation
 [paragraphe]

 ┌────────────────────┐┌────────────────────┐   .wi-grid-2, [C14]
 │{title}             ││{title}             │
 │{summary}           ││{summary}           │
 │────────────────────││────────────────────│
 │ARBITRAGES          ││ARBITRAGES          │   ← bloc OBLIGATOIRE
 │Maturité  {…|▨}     ││Maturité  {…|▨}     │      Une innovation sans
 │Eau écon. {…|▨}     ││Eau écon. {…|▨}     │      caveat n'est pas
 │Coût      {…|▨}     ││Coût      {…|▨}     │      publiable (P12)
 │Énergie   {…|▨}     ││Énergie   {…|▨}     │
 │Carbone   {…|▨}     ││Carbone   {…|▨}     │
 │Limites   {…}       ││Limites   {…}       │
 │Source →            ││Source →            │
 └────────────────────┘└────────────────────┘
   ↑ Chaque arbitrage non sourcé est rendu ▨ « Donnée absente », JAMAIS omis.
     Omettre la ligne « énergie » ferait passer un coût énergétique inconnu
     pour un coût énergétique nul.
·······················································································
```

### 6.4 Tablette / mobile

Toutes ces grilles passent à 1 colonne sous `48rem` (`.wi-grid` par défaut). Le bloc « Arbitrages » de C14 conserve son alignement libellé/valeur en 2 colonnes internes jusqu'en bas de l'échelle — c'est une paire courte.

---

## 7. `#reglementation` — Compliance preview

```
·······················································································
 08 — Conformité
 Réglementation et reporting
 [paragraphe : les 8 statuts juridiques distingués]

 ┌──────────────── [C15] WiCompliancePreview (SC) ────────────────────────────┐
 │▨▨▨ [Non branché]  Prévu : P13 — registre juridique versionné ▨▨▨▨▨▨▨▨▨▨▨▨▨│
 │▨                                                                          ▨│
 │▨ Aucun texte, aucune date d'entrée en vigueur et aucun statut juridique   ▨│
 │▨ ne sont affichés. Une règle sans source officielle et sans date de       ▨│
 │▨ revue humaine ne peut pas être publiée.                                  ▨│
 │▨                                                                          ▨│
 │▨ CE QUE LE REGISTRE CONTIENDRA — structure, sans aucune valeur :          ▨│
 │▨  Juridiction ......... n.c.                                              ▨│
 │▨  Texte / référentiel . n.c.                                              ▨│
 │▨  Version ............. n.c.                                              ▨│
 │▨  Statut juridique .... n.c.  ∈ in_force · adopted_not_applicable ·       ▨│
 │▨                              proposed · transposition_pending ·          ▨│
 │▨                              materiality_dependent · voluntary ·         ▨│
 │▨                              out_of_scope · unknown                      ▨│
 │▨  Preuves attendues ... n.c.                                              ▨│
 │▨  Revue humaine ....... n.c.                                              ▨│
 │▨                                                                          ▨│
 │▨ Tout champ manquant conduit à `unknown`, jamais à une conclusion         ▨│
 │▨ favorable par défaut.                                                    ▨│
 │▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨│
 └───────────────────────────────────────────────────────────────────────────┘

 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Ce module publie de l'information, jamais du conseil juridique.           │
 └───────────────────────────────────────────────────────────────────────────┘
   ↑ mention permanente, hors du bloc hachuré — elle vaut aussi après P13
·······················································································
```

**La liste des 8 statuts est du vocabulaire de contrat** (`WaterLegalStatusEnum`), pas une donnée. L'afficher ne viole pas la règle anti-invention : elle montre la granularité du futur registre sans attribuer aucun statut à aucun texte.

Mobile : liste des statuts en `<ul>` plutôt qu'en colonne alignée.

---

## 8. `#synergies` — ponts + Financial bridge preview

```
·······················································································
 09 — Articulation
 Synergies Carbon&Co
 [paragraphe]

 ┌───────────────┐┌───────────────┐              .wi-grid-2, existant
 │Cockpit Eau &  ││Matières       │
 │stress hydrique││premières      │
 │→ /water       ││critiques      │
 │ (authentifié) ││→ /materials   │
 └───────────────┘└───────────────┘
 ┌───────────────┐
 │Ressources     │   ← ajout Wave C : le pont /resources est déjà prévu par P14
 │stratégiques   │      (ResourceRole="water", LinkKind="water_activity")
 │→ /resources   │
 │ (authentifié) │
 └───────────────┘
   ↑ sortie n°3. Aucun lien ne teste l'état de session ni ne transporte de
     paramètre dérivé d'un contexte utilisateur.

 ┌──────────── [C16] WiFinancialBridgePreview (SC) ───────────────────────────┐
 │▨▨▨ [Non branché]  Prévu : P15 — passerelle financière ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨│
 │▨                                                                          ▨│
 │▨ Aucun montant n'est affiché et aucun calcul n'est exécuté ici.           ▨│
 │▨                                                                          ▨│
 │▨ CE QUE LA PASSERELLE SÉPARERA, sans jamais les mélanger :                ▨│
 │▨   1. Données observées    — issues de sources, avec provenance           ▨│
 │▨   2. Hypothèses utilisateur — saisies, jamais préremplies d'un défaut    ▨│
 │▨                               trompeur                                   ▨│
 │▨   3. Résultats dérivés    — formule versionnée, unités explicites        ▨│
 │▨                                                                          ▨│
 │▨ Le résultat sera une ANALYSE DE SENSIBILITÉ multi-scénarios, jamais un   ▨│
 │▨ montant unique présenté comme certain.                                   ▨│
 │▨                                                                          ▨│
 │▨ Signaux « à examiner » prévus, qui ne sont PAS des conclusions           ▨│
 │▨ comptables ou fiscales : dépréciation · provision / remise en état ·     ▨│
 │▨ continuité d'exploitation · redevances et taxes · assurance.            ▨│
 │▨                                                                          ▨│
 │▨ Le calculateur vivra dans le cockpit authentifié — il opère sur des      ▨│
 │▨ hypothèses d'entreprise, qui n'ont pas leur place sur une page publique. ▨│
 │▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨│
 └───────────────────────────────────────────────────────────────────────────┘

 [paragraphe de clôture : aucune donnée d'entreprise ne remontera jamais ici]
·······················································································
```

---

## 9. `#limites`

```
·······················································································
 10 — Honnêteté
 Limites, données absentes et prochaines étapes
 [paragraphe]

 ┌───────────────┐┌───────────────┐
 │Ce qui est     ││Ce qui ne l'est│
 │en place       ││pas            │
 │(accent adapt) ││(accent absent)│
 └───────────────┘└───────────────┘

 ┌───────────────────────────────────────────────────────────────────────────┐
 │ COUVERTURE RÉELLE                                                         │
 │ Échelle monde ....... {n} couche(s) publiée(s) / {n} attendue(s)          │
 │ Échelle Europe ...... {n} / {n}                                           │
 │ Échelle France ...... {n} / {n}                                           │
 │  ↑ des DÉCOMPTES en toutes lettres, pas des jauges : une barre de         │
 │    progression suggère une trajectoire garantie                           │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ AVERTISSEMENTS DU SNAPSHOT                                                │
 │ · {manifest.warnings[]}                                                   │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ SOURCES ÉCARTÉES  → renvoi vers #sources                                  │
 ├───────────────────────────────────────────────────────────────────────────┤
 │ PROCHAINES ÉTAPES  (liste ordonnée, missions nommées)                     │
 └───────────────────────────────────────────────────────────────────────────┘
·······················································································
```

---

## 10. `[C09] WiSourceDrawer` — transverse

Ouvrable depuis toute valeur, toute ligne de table, toute légende, toute carte de contenu.

### 10.1 Desktop et tablette

```
                                        ┌─── max-width 28rem, hauteur pleine ───┐
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ PROVENANCE                       [×] │
▒▒▒▒ voile — clic = fermeture ▒▒▒▒▒▒▒▒▒▒▒│ {source titre}                       │
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│──────────────────────────────────────│
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│ [statut de donnée]  [C10] fraîcheur  │
▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│                                      │
                                         │ Code source      {source_code}       │
   role="dialog" · aria-modal="true"     │ Release          {release_key}       │
   piège de focus · Échap ferme          │ Empreinte SHA-256 {checksum…} tronq. │
   focus restitué au déclencheur         │ Publiée le       {published_at}      │
   glisse depuis la droite, 220 ms       │ Récupérée le     {retrieved_at}      │
                                         │ Période observée {obs_start}–{end}   │
                                         │ Version méthode  {methodology_version}│
                                         │ Attribution      {attribution}       │
                                         │──────────────────────────────────────│
                                         │ LICENCE                              │
                                         │ [Licence OK | Licence bloquée]       │
                                         │ Affichage    : autorisé / interdit   │
                                         │ Stockage     : autorisé / interdit   │
                                         │ Usage dérivé : autorisé / réservé    │
                                         │ ✕ {license.reasons[]}                │
                                         │ ⚠ {license.warnings[]}               │
                                         │──────────────────────────────────────│
                                         │ ⚠ {source.warnings[]}                │
                                         └──────────────────────────────────────┘
```

### 10.2 Mobile

Feuille pleine largeur montant depuis le bas, `max-height: 90vh`, scroll interne, poignée + `[×]`.

**Invariant de C09 :** il ne récupère rien lui-même. Il reçoit une provenance déjà résolue en props — c'est cette contrainte, héritée du `SourceDrawer` existant, qui garantit structurellement qu'il ne peut pas déclencher d'appel réseau au runtime.

---

## 11. Pied de page

Inchangé par rapport à P04. Le paragraphe « les valeurs affichées proviennent d'un manifest de démonstration » est **conditionné à `fixture_label`** et doit être remplacé par l'attribution des sources réelles quand le manifest cesse d'être une fixture.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Water Intelligence — Carbon&Co                                               │
│ [si fixture_label ≠ null] Module public en construction. Les valeurs…        │
│ [sinon]                   Sources : {attribution[]} — voir Sources et preuves│
│ Cockpit Eau (authentifié) · Métaux critiques · Accueil Carbon&Co             │
└──────────────────────────────────────────────────────────────────────────────┘
```
