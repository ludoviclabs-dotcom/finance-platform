# P04 — Shell public Water Intelligence

**Mission :** P04 — Shell public Water Intelligence.
**Branche :** `feat/water-intelligence-p04-public-shell`
**Route livrée :** `/water-intelligence` (publique).

> **Correctif P04B** — P04B retire les valeurs numériques fictives visibles de la surface publique ; les fixtures restent réservées aux contrats/tests jusqu'au branchement de données réelles.
>
> Concrètement, trois valeurs fabriquées ont été retirées de la page (et non seulement la mesure `42`) : la **valeur d'observation** et son **unité**, la **date de récupération** et l'**empreinte SHA-256** du bandeau de provenance. Chacune est remplacée par `n.c.` et le motif de son absence. Les libellés de champ restent affichés — ils montrent ce que la provenance contiendra sans rien fabriquer. Un test dérivé de la fixture (et non codé en dur) échoue si l'une de ces valeurs réapparaît.

---

## 1. Ce qui est livré

| Fichier | Rôle |
|---|---|
| `apps/carbon/app/water-intelligence/page.tsx` | La route publique : metadata, hero, bandeau snapshot, 8 sections ancrées, pied de page. Server Component intégral. |
| `apps/carbon/app/water-intelligence/water-intelligence.css` | Thème `Water Intelligence` scopé à `[data-wi]`, clair/sombre via `prefers-color-scheme`. |
| `apps/carbon/components/water-intelligence/WiNav.tsx` | Navigation ancrée (simples `<a href="#…">`, aucun état). |
| `apps/carbon/components/water-intelligence/WiPrimitives.tsx` | `WiSection`, `WiBadge`, `WiPlaceholder`, `WiAbsentValue`, `WiCard`. |
| `apps/carbon/components/water-intelligence/WiSnapshotBanner.tsx` | Bandeau de provenance du manifest affiché. |
| `apps/carbon/lib/water-intelligence/fixture-manifest.{ts,json}` | Chargement + validation Zod (contrat P02) du mini manifest de démonstration. |
| `apps/carbon/tests/water-intelligence-public-shell.test.tsx` | 24 tests (route, metadata, marquage démonstration, ancres, a11y, absence de réseau, non-divergence de la fixture, intégrité du cockpit). |

**Les huit sections demandées** sont présentes et ancrées : Vue d'ensemble, Comprendre les risques hydriques, Carte et territoires, Sources et preuves, Secteurs et dépendances, Réglementation et reporting, Synergies Carbon&Co, Limites et prochaines étapes.

### Décisions de conception

- **Zéro composant client.** Aucun `"use client"`, aucun hook, aucun `useSearchParams` : la route est prérendue statiquement (`○` au build Next.js), sans bailout CSR. Le thème clair/sombre passe par `prefers-color-scheme` en CSS pure plutôt que par un provider React + `localStorage` (le choix retenu pour `/materials`) — moins de JavaScript, aucun risque d'écart d'hydratation.
- **Thème `--wi-*`, jamais `--mx-*`.** Le préfixe des matières premières n'est pas réutilisé, et la feuille de style vit dans le dossier de la route plutôt que dans `globals.css` : aucune autre surface du site n'est affectée.
- **Fixture copiée dans l'app, avec test anti-divergence.** L'import direct du manifest canonique (`docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json`) casse le build : Turbopack refuse de résoudre un module hors de la racine de l'application (vérifié — `Module not found` lors d'un `next build` réel). Une copie octet pour octet vit donc dans `apps/carbon/lib/water-intelligence/fixture-manifest.json`, et un test dédié lit le fichier canonique pour vérifier qu'elle n'a pas dérivé. La copie est une contrainte d'outillage, pas un choix de conception.
- **Validation Zod au chargement.** Le manifest est passé par `WaterIntelligenceManifestSchema.parse()` (et non `.safeParse()`) : une fixture hors contrat casse le build au lieu d'afficher une donnée non conforme.

## 2. Ce qui n'est pas livré

- **Aucune carte.** La section « Carte et territoires » est un placeholder explicite. Publier un fond de carte sans données sourcées derrière donnerait une impression de couverture inexistante.
- **Aucun contenu éditorial, sectoriel ou juridique.** Les sections correspondantes annoncent ce qui manque et la mission qui le livrera (P12, P13).
- **Aucune API, aucune route backend, aucune migration, aucune table.**
- **Aucune donnée d'entreprise.** La page ne lit aucune donnée tenant et n'en lira jamais : le pont vers les modules authentifiés (P14) est un lien, pas une remontée de données.
- **Aucun score hydrique composite.** Les neuf dimensions sont affichées séparément, sans agrégat.

## 3. Pourquoi aucune donnée réelle n'est affichée

Aucun connecteur réel n'existe avant P05 : le pipeline P03 ne dispose que d'un faux transport et refuse explicitement toute publication hors dry-run. Afficher un chiffre réel supposerait donc de l'inventer, ce que l'en-tête invariant du pack maître interdit (règle 5). Par ailleurs, les 16 entrées du catalogue P01 portent toutes `license_status: unknown` — et une licence inconnue n'autorise ni l'affichage, ni le stockage, ni l'usage dérivé.

La seule valeur chiffrée de la page provient du manifest de fixture. Elle est marquée trois fois : badge « Démonstration », phrase explicite (« ne mesure rien de réel »), et statut de donnée `fixture` affiché à côté de la valeur.

## 4. Comment P05 à P09 brancheront les données

Ces missions ne devraient **pas** modifier la structure de cette page. Le chemin prévu :

1. **P05 à P09** produisent des releases publiées via le pipeline P03 (`run_pipeline`), chacune avec sa `WaterLicenseDecision` réelle obtenue par `license_policy.evaluate()`.
2. **P10** assemble ces releases en un read model public compact et le met en cache. C'est la première mission autorisée à écrire des observations réelles.
3. Cette page remplace alors `FIXTURE_MANIFEST` par le manifest publié par P10 — les composants (`WiSnapshotBanner`, `WiCard`, `WiAbsentValue`) consomment déjà le type `WaterIntelligenceManifest`, donc aucun changement de forme n'est nécessaire.
4. Le bandeau de démonstration et le badge « Module en construction » ne disparaissent que lorsque le manifest cesse de porter `fixture_label` — c'est-à-dire quand la donnée est réellement sourcée, pas avant.
5. **P11** remplace le placeholder de la section « Carte et territoires » par l'explorateur cartographique (D3/TopoJSON, aucune tuile externe), avec sa table alternative accessible.

Point de vigilance repris de l'audit P00 : `display_allowed` n'est **pas** vérifié à la publication d'une release (la porte ne teste que `allow_ingest` et `allow_store`). P10 devra donc appliquer explicitement la redaction `value_withheld` à la construction du snapshot, sans quoi une valeur sous licence restrictive pourrait atteindre cette page.

## 5. Comment `/water-intelligence` se distingue de `/water`

| | `/water` | `/water-intelligence` |
|---|---|---|
| **Nature** | Cockpit entreprise | Module public d'intelligence |
| **Accès** | Authentifié (groupe `(app)`, garde de layout + JWT côté API) | Public, aucun compte requis |
| **Fichier** | `app/(app)/water/page.tsx` | `app/water-intelligence/page.tsx` |
| **Données** | Données du tenant : sites géocodés, prélèvements, permis, screenings, cibles, actions | Contexte public uniquement — jamais de donnée d'entreprise |
| **Sources** | Ledger interne + zones de risque sourcées | Releases publiées et snapshots compacts (à venir) |

Les deux URL sont distinctes et aucune ne masque l'autre : `/water` continue de résoudre vers le cockpit (vérifié au build — les deux routes apparaissent séparément) et la page publique ne contient ni redirection, ni réécriture vers elle (vérifié par test). Le cockpit n'a été modifié par aucun fichier de cette livraison.

## 6. Accessibilité et performance

- **Structure sémantique** : un seul `<h1>`, hiérarchie de titres sans saut (vérifié par test), `<main>`/`<nav>`/`<section>`/`<footer>`, sections nommées par `aria-labelledby`, navigation nommée par `aria-label`, lien d'évitement vers le contenu.
- **Couleur jamais seule** : chaque badge porte un libellé texte (« Non branché », « Donnée absente », « Démonstration ») et les zones sans donnée combinent hachures + libellé.
- **Focus visible** : contour de 3 px sur tous les éléments interactifs, jamais supprimé.
- **Mouvement** : aucune animation nécessaire à la compréhension ; les rares transitions sont neutralisées sous `prefers-reduced-motion`.
- **Performance** : aucun dataset, aucun JSON volumineux (le manifest de fixture pèse quelques kilo-octets), aucun appel réseau au rendu, aucune dépendance ajoutée, page prérendue statiquement.
