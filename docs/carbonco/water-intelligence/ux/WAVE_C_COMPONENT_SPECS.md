# Wave C — Spécification des composants et critères d'acceptation

Complément de [`WAVE_C_UX_UI_BLUEPRINT.md`](./WAVE_C_UX_UI_BLUEPRINT.md) §5 et §14.
Wireframes correspondants dans [`WAVE_C_WIREFRAMES.md`](./WAVE_C_WIREFRAMES.md).

Chaque composant est décrit par : **rôle**, **type de rendu**, **données consommées** (champs exacts de `apps/carbon/lib/water-intelligence/contracts.ts`), **états applicables** (§7 du blueprint), **ce qu'il ne fait jamais**, et ses **critères d'acceptation** — formulés pour être vérifiables, pas pour être appréciés.

Rappel de nommage : préfixe `Wi*`, dossier `apps/carbon/components/water-intelligence/`, tokens `--wi-*` exclusivement. Aucune classe Tailwind de couleur brute (`zinc-*`, `emerald-*`, `amber-*`, `rose-*`) dans un composant `Wi*`.

---

## C01 — `WiHero`

**Rôle** — Ouverture de la page : identité du module, promesse, badges d'état global, sortie vers le cockpit.
**Type** — Server Component. Extraction du bloc actuellement inline dans `page.tsx`.
**Données** — `manifest.fixture_label` (badges), rien d'autre.

**Ne fait jamais** — afficher une valeur mesurée, un décompte de couverture, ou un quelconque indicateur hydrique. Le hero annonce le module, il ne le résume pas en chiffres.

**Critères d'acceptation**

1. Un seul `<h1>` sur toute la page.
2. Le lien vers `/water` porte la mention « accès authentifié » **dans le texte du lien ou immédiatement adjacent** — pas seulement en `title`.
3. Le badge « Module en construction » disparaît **si et seulement si** `fixture_label` est nul.
4. Se rend intégralement avec `observations: []`, `geo_layers: []` et `sources` réduit au minimum du schéma.
5. Aucun `"use client"`, aucun hook.

---

## C02 — `WiWaterPulse`

**Rôle** — Bandeau d'état de la donnée publiée. Une puce par couche réellement présente, avec son statut, sa couverture et sa fraîcheur. Sert aussi de raccourci vers la carte.
**Type** — Server Component. Le clic est un lien `<a href="?dim=…#carte">`, pas un `onClick` — aucun îlot nécessaire.
**Données** — `manifest.geo_layers[]` (`layer_id`, `zoom_level`, `geography.label`, `source`), agrégé avec les `observations` correspondantes pour `quality.data_status`, `quality.coverage_pct`, `generated_at`.

**Ne fait jamais**

- produire un indice, une moyenne, un pourcentage global de complétude ou une jauge — ce serait le score composite interdit par l'ADR §5 sous un autre nom ;
- afficher une puce pour une dimension **attendue mais absente** du manifest (les dimensions non couvertes sont listées en texte, ailleurs) ;
- animer quoi que ce soit. Le nom désigne un état, pas un battement (§11.7).

**États** — `absent` (aucune couche : une phrase, pas des puces vides) · `stale` · `fixture` (aucune valeur rendue) · `erreur`.

**Critères d'acceptation**

1. Le nombre de puces est **exactement** `manifest.geo_layers.length`. Zéro couche ⇒ une phrase « Aucune couche publiée à ce jour », pas une grille vide.
2. Aucune valeur numérique agrégée n'est rendue. Un test échoue si le composant produit un ratio, un pourcentage global ou une barre de progression.
3. Chaque puce porte un **libellé texte** de son statut, en plus de sa teinte.
4. Sous-titre « État de la donnée publiée » présent — le composant ne peut pas être lu comme un indicateur hydrique.
5. Si `fixture_label` est non nul, aucune couverture, aucune date et aucun décompte issu de la fixture n'apparaît : `WiPendingValue` à la place.
6. Chaque puce est un lien navigable au clavier, avec un nom accessible incluant la dimension et son statut.

---

## C03 — `WiSnapshotBanner` *(existant, à étendre)*

**Rôle** — Identité et état du manifest rendu : version, étiquette, source, release, fraîcheur, avertissements.
**Type** — Server Component. Existe déjà (`components/water-intelligence/WiSnapshotBanner.tsx`).
**Données** — `manifest_version`, `generated_at`, `fixture_label`, `sources[0]`, `warnings[]`.

**Extension attendue en Wave C** — afficher les valeurs réelles (`retrieved_at`, `checksum_sha256` tronqué) **uniquement** quand `fixture_label` est nul ; intégrer `WiFreshnessBadge` (C10) ; rendre `generated_at`.

**Ne fait jamais** — afficher une date ou une empreinte issue d'une fixture. C'est exactement ce que le correctif P04B a retiré.

**Critères d'acceptation**

1. `fixture_label` non nul ⇒ `retrieved_at` et `checksum_sha256` rendus en `WiPendingValue`. Test dérivé de la fixture (pas de valeur codée en dur) échouant si la valeur réapparaît.
2. `fixture_label` nul ⇒ les deux champs sont rendus, checksum tronqué, en `.wi-mono`.
3. `warnings[]` non vide ⇒ liste visible, jamais repliée derrière un « voir plus ».
4. Le badge « Démonstration » est **piloté par `fixture_label`**, jamais par une constante.
5. Aucun `"use client"`.

---

## C04 — `WiMapExplorer`

**Rôle** — Conteneur d'état de la section carte : lit et écrit l'URL, distribue l'état aux enfants, décide de monter ou non la carte.
**Type** — Îlot client. **Seul composant autorisé à utiliser `useSearchParams`**, sous frontière `<Suspense>`.
**Données** — `manifest.geo_layers[]`, `observations[]`, `scenarios[]`.

**État détenu** — `{ scope, code, dim, period_start, period_end, scenario, view }` (§10.1 du blueprint).

**Ne fait jamais**

- monter une carte quand `geo_layers` est vide — il rend le `WiPlaceholder` P04 ;
- charger plus d'une couche à la fois ;
- conserver un état non représenté dans l'URL.

**Critères d'acceptation**

1. Recharger une URL d'état complète reproduit **exactement** l'écran (échelle, dimension, période, scénario, sélection, vue). Test E2E.
2. Un paramètre invalide est **ignoré** avec repli sur le défaut **et** un avertissement visible « Paramètre {x} ignoré » — jamais un écran vide inexpliqué, jamais un plantage.
3. La page reste prérendue : `next build` ne signale aucun bailout CSR global. Le bailout, s'il existe, est confiné sous le `<Suspense>` de cette section.
4. `geo_layers: []` ⇒ aucune ressource de carte n'est chargée (aucun `import()` de D3, aucune topologie). Vérifié par inspection réseau en E2E.
5. Changer `scope` ou `dim` produit une entrée d'historique (`push`) ; un tri ou un survol n'en produit pas (`replace`).
6. Aucun état de sélection ne survit à un changement de dimension si l'entité n'existe pas dans la nouvelle couche — dans ce cas, la sélection est effacée et l'effacement est annoncé (`aria-live`).

---

## C05 — `WiMapCanvas`

**Rôle** — Rendu D3 de la couche active : géométries, remplissages, sélection, infobulle, zoom.
**Type** — Îlot client. D3 possède le sous-arbre du conteneur ; React ne touche jamais son intérieur (pattern `WorldMap.tsx`).
**Données** — couche active (`WaterGeoLayerDescriptor` + géométrie), `observations` filtrées par dimension/période, jointes par `geography.code`.

**Ne fait jamais**

- joindre par `geography.label` — **la jointure passe exclusivement par `code`**, zéro-paddé des deux côtés si l'identifiant est numérique (précédent `ConcentrationChoropleth`) ;
- colorier une entité non appariée avec la teinte basse de la rampe — elle reçoit `--wi-absent` + hachures ;
- afficher dans une infobulle une valeur sans sa période et son statut ;
- superposer deux dimensions ;
- charger une tuile, une police ou une topologie distante.

**États** — `loading` (couche en cours) · `absent` (entité sans valeur) · `licence bloquée` · `couverture partielle` · `erreur` (couche non décodable) · `fixture` (**ne se monte pas du tout**).

**Critères d'acceptation**

1. Zéro requête réseau au runtime. Topologie importée en module, D3 bundlé. Vérifié en E2E par interception.
2. Aucune entité n'est coloriée si elle n'a pas d'observation appariée par `code`. Test unitaire sur la fonction de jointure : un `code` inconnu produit `absent`, jamais une valeur.
3. Les entités non cartographiables sont **comptées et affichées** sous la carte, et restent présentes dans C11.
4. `feature_count > 1000` ⇒ la couche est refusée (état 7.7), jamais tronquée silencieusement.
5. Une seule rampe, monochrome, dérivée de `--wi-ramp-from` → `--wi-ramp-to`. Test : aucune couleur brute dans le rendu.
6. Le contour de sélection est dessiné **en dernier** et reste visible au-dessus des remplissages voisins.
7. `ResizeObserver` recalcule la projection sans passer par un état React (pattern existant).
8. Sous `prefers-reduced-motion`, aucune transition de teinte, aucun mouvement de zoom animé.
9. Zéro erreur console en E2E, sur les trois points de rupture.
10. Temps de rendu mesuré et consigné dans la PR (exigence P11).

---

## C06 — `WiMapFilters`

**Rôle** — Quatre contrôles hiérarchisés : échelle, dimension, période, scénario. Plus la bascule Carte/Tableau et le fil d'Ariane.
**Type** — Îlot client, contrôles natifs.
**Données** — `geo_layers[]` (options de dimension, filtrées par `scope`), périodes distinctes des `observations`, `scenarios[]`.

**Ne fait jamais**

- coder une option en dur ;
- rendre un contrôle **désactivé** faute d'options — il ne le rend pas du tout ;
- proposer une dimension attendue mais non publiée (elle est listée en texte, hors du sélecteur) ;
- proposer un sélecteur de dates libre — seules des périodes nommées et publiées.

**Critères d'acceptation**

1. Toutes les options dérivent du manifest. Test : manifest vide ⇒ aucun sélecteur rendu.
2. `scenarios: []` ⇒ le sélecteur de scénario est **absent du DOM**.
3. Changer un filtre de niveau *n* réinitialise les niveaux inférieurs vers leur première valeur valide, et l'annonce en `aria-live="polite"` avec le nombre d'entités résultant.
4. Contrôles natifs (`<select>`, `<fieldset>`/`<legend>` + radios), étiquetés, atteignables au clavier dans un ordre logique.
5. La bascule Carte/Tableau occupe **la même position** dans les deux vues.
6. Le fil d'Ariane reflète `scope` et chaque niveau est activable au clavier.
7. Une seule case de comparaison temporelle, et une seule période comparée (budget « snapshot courant + un comparatif »).

---

## C07 — `WiBasinPanel`

**Rôle** — Détail d'une entité sélectionnée : dimension courante avec sa valeur, sa méthode, sa qualité, ses avertissements, les autres dimensions, et l'accès à la provenance.
**Type** — Îlot client. Latéral non modal ≥ 64rem ; superposition modale en dessous.
**Données** — `observations` de l'entité (toutes dimensions), `geography`, `method`, `quality`, `source`, `scenario`, `value_withheld`.

**Ne fait jamais**

- fusionner les dimensions en un indicateur ;
- placer `confidence` dans le même élément visuel que `value` ;
- masquer les avertissements derrière un repli ;
- transporter un paramètre tenant dans le lien vers `/water`.

**États** — les huit. C'est le composant où ils sont tous observables ; il est le meilleur support de test de §7.9.

**Critères d'acceptation**

1. `value` et `quality.confidence` sont dans **deux blocs distincts**, avec deux libellés distincts. Test de structure DOM.
2. `coverage_pct` et `confidence` sont deux lignes distinctes, jamais fusionnées en « fiabilité ».
3. `value === null` sans blocage ⇒ `WiAbsentValue` + motif. Jamais `0`, jamais `—` seul.
4. `value_withheld === true` ⇒ libellé « Valeur non publiable — licence » + `license.reasons`, teinte `--wi-compliance`, **et la source reste nommée**.
5. Si une valeur avec `allow_display === false` et `value !== null` atteint le composant, il **refuse de la rendre** et signale une erreur — l'UI n'est pas le dernier rempart mais ne relaie pas un défaut serveur.
6. La liste « autres dimensions » est une liste ; aucun total, aucune moyenne, aucun tri par sévérité.
7. `quality.warnings` et `source.warnings` sont visibles sans interaction.
8. `scenario` non nul ⇒ étiquette « Projection » + `horizon_year`, visuellement distincte d'une observation.
9. Ouverture : focus sur le titre. Fermeture : focus restitué au déclencheur. `Échap` ferme. En mode modal, piège de focus effectif.
10. Ouverture ≤ 220 ms, fermeture ≤ 120 ms, neutralisées sous `prefers-reduced-motion`.
11. Le lien « Évaluer mes sites sur ce bassin » ne contient aucun paramètre autre que le territoire public, et ne teste pas l'état de session.

---

## C08 — `WiLegend`

**Rôle** — Clé de lecture de la couche affichée : paliers nommés, états spéciaux, source et release de la couche.
**Type** — Server Component quand la dimension est fixée par l'URL au rendu ; îlot minimal si elle change sans rechargement.
**Données** — métadonnées de la couche active (paliers issus des **métadonnées de méthode**, jamais du JSX), `source`.

**Ne fait jamais**

- afficher un dégradé continu sans paliers nommés — l'œil ne convertit pas une teinte en valeur ;
- omettre les états « absent », « non couvert » et « valeur retenue » ;
- inventer des seuils.

**Critères d'acceptation**

1. Les paliers proviennent des métadonnées de méthode de la source. Test : aucun seuil numérique littéral dans le code du composant.
2. Chaque palier porte une **borne textuelle**, pas seulement une pastille.
3. Les trois états spéciaux sont présents dès qu'ils sont possibles dans la couche : ▨ absent, ▧ non couvert, ⌷ valeur retenue.
4. `source_code` et `release_key` sont affichés, avec accès direct à C09.
5. Lisible en niveaux de gris : chaque palier reste distinguable par sa borne textuelle.
6. Contraste ≥ 3:1 entre paliers adjacents, **ou** motif différenciant — mesuré dans la PR, dans les deux thèmes.

---

## C09 — `WiSourceDrawer`

**Rôle** — Provenance complète d'une source. Le composant qui justifie le module.
**Type** — Îlot client, modal, monté à la première ouverture.
**Données** — `WaterSourceReference` complet + `WaterLicenseDecision`.

**Origine** — reprend l'**interface** `SourceProvenance` et le comportement de `components/intelligence/source-drawer.tsx`, **sans** sa palette zinc/emerald (§16.2 du blueprint).

**Ne fait jamais**

- récupérer une donnée lui-même — il reçoit une provenance déjà résolue en props. C'est la contrainte structurelle qui garantit l'absence d'appel réseau ;
- réduire la licence à un booléen ;
- masquer les avertissements.

**Critères d'acceptation**

1. Rend les onze champs de `WaterSourceReference`. Un champ nul est rendu « non communiqué », jamais omis silencieusement.
2. `checksum_sha256` tronqué à l'affichage, en `.wi-mono`, avec le champ complet accessible (copie ou `title`).
3. La licence est rendue **structurée** : quatre autorisations (`allow_ingest`, `allow_store`, `allow_display`, `allow_derived_use`) + `reasons` + `warnings`. Jamais « OK / KO » seul.
4. `attribution` non nulle ⇒ rendue **visiblement**, pas seulement dans le drawer (CC BY impose une attribution visible sur la surface).
5. `role="dialog"`, `aria-modal="true"`, `aria-label` incluant le nom de la source.
6. Piège de focus, `Échap`, restitution du focus au déclencheur.
7. Zéro appel réseau à l'ouverture. Test E2E.
8. Aucune classe Tailwind de couleur brute — tokens `--wi-*` uniquement, lisible en thème clair.
9. Atteignable en un seul geste depuis une valeur de carte, une ligne de table, la légende et une carte de contenu.

---

## C10 — `WiFreshnessBadge`

**Rôle** — Fraîcheur d'une release : frais, ou périmé avec sa date et son âge.
**Type** — Server Component.
**Données** — `source.published_at` / `retrieved_at`, `manifest.generated_at`, et le booléen `isStale` **dérivé côté serveur**.

**Origine** — logique de `components/intelligence/staleness-warning.tsx` (dérivation, format `fr-FR`, discret si frais / visible si ancien), re-thématisée.

**Ne fait jamais**

- redéfinir le seuil. `STALE_AFTER_DAYS = 120` vit dans `apps/api/services/intelligence/freshness_service.py` ; le composant reçoit le résultat, il ne le calcule pas ;
- utiliser `--wi-alert` — la péremption est un état d'attention (`--wi-stress`), pas une indisponibilité.

**Critères d'acceptation**

1. Aucun seuil numérique dans le composant. Test : aucune constante de jours.
2. Frais ⇒ rendu discret avec la date de dernière release. Périmé ⇒ libellé explicite « Snapshot potentiellement périmé » + date + âge.
3. Date formatée en `fr-FR`, date invalide ou absente rendue `—` **avec** la mention « date inconnue ».
4. Le statut est lisible en texte, jamais uniquement par la couleur.
5. `role="status"` en variante périmée.

---

## C11 — `WiDataTable`

**Rôle** — Rendu tabulaire à parité stricte avec la couche cartographique. Vue par défaut sur mobile. Sert aussi à §04 pour les sources.
**Type** — Server Component pour la table ; îlot minimal pour le tri.
**Données** — mêmes `observations` que C05, sans aucun filtrage supplémentaire.

**Ne fait jamais**

- omettre une entité présente dans la couche, y compris sans valeur ;
- tronquer à un « top N » sans le dire ;
- paginer sans annoncer le total ;
- masquer les lignes absentes ou retenues par défaut.

**Critères d'acceptation**

1. **Parité stricte** : l'ensemble des entités de la table est **égal** à l'ensemble des entités de la couche. Test comparant les deux ensembles, pas seulement leurs cardinalités.
2. Présente dans le HTML **rendu au serveur**, avant hydratation. C'est ce qui rend §12.6 vrai.
3. Colonnes : territoire (`label` + `code`), valeur + unité, période, statut, couverture, confiance, méthode, source. Les quatre dernières ne sont jamais fusionnées en une colonne « qualité ».
4. Ligne absente : « Donnée absente » + motif, dans la colonne valeur. Jamais une cellule vide.
5. Ligne retenue pour licence : « Valeur non publiable — licence » + raison.
6. Valeurs numériques en `tabular-nums` (`.wi-num`).
7. Tri : `<button>` dans `<th>`, `aria-sort` correct, tri local sans requête, non persisté dans l'URL.
8. Cliquer une ligne sélectionne l'entité et ouvre C07 — même effet que sur la carte.
9. Sous 48rem, rendu en cartes empilées, jamais en table à défilement horizontal.
10. Fonctionne intégralement avec le JS de carte neutralisé.

---

## C12 — `WiSectorCard`

**Rôle** — Un enregistrement éditorial de type `industry` ou `actor`.
**Type** — Server Component.
**Données** — `WaterEditorialRecord` : `title`, `summary`, `jurisdiction`, `valid_from`/`valid_to`, `source`, `reviewed_on`, `reviewed_by`.

**Ne fait jamais**

- classer les acteurs sans méthode objective et sourcée ;
- rendre un record sans `reviewed_on` / `reviewed_by` ;
- produire du texte au runtime.

**Critères d'acceptation**

1. `reviewed_on` et `reviewed_by` **toujours rendus**, pour tout record.
2. Aucun ordre significatif par défaut pour `record_type = actor`. Si un classement est affiché, sa **méthode est affichée à côté**, pas en note de bas de page.
3. Accès à la provenance (C09) depuis chaque carte.
4. `editorial_records: []` ⇒ `WiPlaceholder` nommant P12, jamais une grille vide.
5. Aucun texte factuel généré au runtime : tout le contenu vient du record.
6. Le filtre par `record_type` fonctionne sans JavaScript (liens ou `<details>`), ou est un îlot minimal isolé.

---

## C13 — `WiEventItem`

**Rôle** — Un événement (`record_type = event`), avec ses deux dates distinctes.
**Type** — Server Component.
**Données** — `valid_from` (date de l'événement), `source.published_at` (date de publication), `jurisdiction`, `title`, `summary`, revue.

**Ne fait jamais**

- confondre date d'événement et date de publication — c'est l'erreur explicitement interdite par P12 ;
- afficher un événement sans lieu ;
- établir une causalité (« à cause de la sécheresse… ») ni relier un événement à une valeur de la carte.

**Critères d'acceptation**

1. Les deux dates sont rendues, **nommées séparément** (« Événement du… » / « Publié le… »), visuellement distinctes. Test de structure.
2. `jurisdiction` nulle ⇒ le record n'est pas rendu (un événement sans lieu n'est pas publiable).
3. Aucune formulation causale dans le gabarit — seul le `summary` du record parle, et il est passé par une revue humaine.
4. Ordre chronologique sur `valid_from`, jamais sur la date de publication.
5. Provenance accessible depuis chaque item.

---

## C14 — `WiInnovationCard`

**Rôle** — Une innovation (`record_type = innovation`) avec ses arbitrages.
**Type** — Server Component.
**Données** — `WaterEditorialRecord` + champs d'arbitrage portés par le record.

**Ne fait jamais** — présenter un bénéfice net sans caveat ; omettre une ligne d'arbitrage non renseignée.

**Critères d'acceptation**

1. Le bloc « Arbitrages » est **obligatoire** : maturité, eau économisée, coût, énergie, carbone, limites.
2. Un arbitrage non sourcé est rendu ▨ « Donnée absente », **jamais omis**. Omettre la ligne « énergie » ferait passer un coût énergétique inconnu pour nul.
3. Aucun chiffre sans source. Test : toute valeur numérique rendue est accompagnée d'un accès à sa provenance.
4. `reviewed_on` / `reviewed_by` rendus.
5. `editorial_records` sans `innovation` ⇒ `WiPlaceholder` nommant P12.

---

## C15 — `WiCompliancePreview`

**Rôle** — Annoncer la forme du futur registre juridique (P13, Wave D) **sans rien affirmer**.
**Type** — Server Component. **Ne consomme aucune donnée.**
**Données** — aucune. `legal_records` n'est pas lu en Wave C.

**Ne fait jamais** — afficher un texte de loi, une date, un statut attribué à un texte, ou une conclusion de périmètre.

**Critères d'acceptation**

1. **Aucune date, aucun nombre, aucun nom de texte juridique dans le rendu.** Test échouant sur toute occurrence d'un chiffre ou d'un motif de date.
2. `legal_records` n'est pas lu par ce composant. Test : un manifest contenant des `legal_records` ne change pas le rendu.
3. La liste des huit valeurs de `WaterLegalStatusEnum` est affichée comme **vocabulaire**, sans être attribuée à quoi que ce soit.
4. La mention « information, pas conseil juridique » est **hors** du bloc hachuré — elle reste valable après P13.
5. La règle « tout champ manquant conduit à `unknown` » est énoncée.
6. Rendu dans le gabarit `WiPlaceholder` (hachures + badge « Non branché » + mission nommée).

---

## C16 — `WiFinancialBridgePreview`

**Rôle** — Annoncer la forme de la passerelle financière (P15, Wave D) **sans calculer**.
**Type** — Server Component. **Ne consomme aucune donnée, n'exécute aucun calcul.**

**Ne fait jamais** — afficher un montant, un taux, une probabilité, un horizon chiffré ; proposer un champ de saisie ; laisser croire qu'un calcul est disponible sur la surface publique.

**Critères d'acceptation**

1. **Aucun montant, aucun taux, aucune probabilité, aucun champ de saisie.** Test échouant sur tout nombre rendu.
2. La séparation en trois catégories est explicite : données observées / hypothèses utilisateur / résultats dérivés.
3. Il est écrit que le résultat sera une **analyse de sensibilité multi-scénarios**, jamais un montant unique présenté comme certain.
4. Les cinq signaux « à examiner » sont listés **avec** la mention qu'aucun n'est une conclusion comptable ou fiscale.
5. Il est écrit que le calculateur vivra côté authentifié — la page publique n'accueille pas d'hypothèses d'entreprise.
6. Rendu dans le gabarit `WiPlaceholder`.

---

## Composants existants — contrat de non-régression

| Composant | Fichier | Règle en Wave C |
|---|---|---|
| `WiNav` | `components/water-intelligence/WiNav.tsx` | Reçoit 10 items au lieu de 8. Reste un Server Component d'ancres simples, sans état, sans JS |
| `WiSection` | `WiPrimitives.tsx` | Inchangé. Chaque nouvelle section l'utilise, avec `aria-labelledby` |
| `WiBadge` | `WiPrimitives.tsx` | Inchangé. Le libellé texte reste obligatoire |
| `WiCard` | `WiPrimitives.tsx` | Inchangé. Les accents `wi-accent-*` restent la seule façon de teinter une carte |
| `WiPlaceholder` | `WiPrimitives.tsx` | Inchangé. Support de C15, C16, et de la section carte non alimentée |
| `WiAbsentValue` | `WiPrimitives.tsx` | Inchangé. **Composant de premier plan**, pas un état dégradé |
| `WiPendingValue` | `WiPrimitives.tsx` | Inchangé. Support de l'état 7.8 |

Aucune de ces primitives ne doit acquérir un `"use client"` en Wave C.

---

## Récapitulatif des tests attendus

Regroupement par nature, pour dimensionner l'effort de test de la PR C2/C3.

| Nature | Portée |
|---|---|
| **Unitaires purs** | Jointure par `code` (C05), résolution d'état (§7.9), dérivation des options de filtre depuis le manifest (C06), parité couche ↔ table (C11), calcul de fraîcheur côté serveur (C10) |
| **Rendu (sans réseau)** | Chaque composant sur : manifest vide · manifest fixture · manifest avec valeur retenue · manifest avec absence · manifest en erreur |
| **Anti-fixture** | Test dérivé de `fixture-manifest.json` (jamais codé en dur) échouant si une de ses valeurs apparaît dans le HTML rendu — extension du test P04B à tous les composants de Wave C |
| **Anti-invention** | C15 et C16 : aucun chiffre, aucune date. C08 : aucun seuil littéral. C10 : aucune constante de jours |
| **A11y E2E** | Parcours clavier complet, focus jamais perdu, pièges de focus corrects, `aria-live` sur changement de filtre, table utilisable avec JS de carte neutralisé |
| **Mouvement** | `prefers-reduced-motion` : aucun mouvement résiduel, y compris la transition de teinte de carte |
| **Réseau** | Zéro requête externe au runtime, sur les trois points de rupture, dans les deux vues |
| **Budget** | Manifest ≤ 100 Ko · premier écran ≤ 250 Ko · couche gzip ≤ 400 Ko · ≤ 6 requêtes initiales · `feature_count` ≤ 1000 |
| **Non-régression** | `/water` intact · 8 ancres historiques présentes · aucun bailout CSR global · zéro erreur console |
