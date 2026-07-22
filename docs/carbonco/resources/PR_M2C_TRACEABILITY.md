# PR-M2C — Cockpit Ressources stratégiques (traçabilité)

> **Module 2, tranche C — frontend.** Date : 2026-07-22 · Branche : `feat/resources-cockpit` ·
> Base : `origin/master` `79c3dbf` (PR-M2A #127 + PR-M2B #128 mergées, migrations 042/043 dans le code).
> **Ne pas merger automatiquement.**

## 1. Objet

Surface produit (Next.js `apps/carbon`) du module Ressources stratégiques, en **lecture seule côté
conformité**. Consomme l'API `/resources/*` (PR-M2A/M2B). Cinq pages sous le shell authentifié
`(app)` :

| Route | Rôle |
|---|---|
| `/resources` | Catalogue (global ∪ tenant) + signaux (alertes) |
| `/resources/[slug]` | Fiche décomposée d'une ressource |
| `/resources/exposures` | Expositions du tenant (ponts multi-modules) |
| `/resources/assessments` | Runs immuables (risque ≠ confiance) |
| `/resources/methodology` | Méthode versionnée + disclaimer non officiel |

## 2. Fichiers

**Client typé**
- `apps/carbon/lib/api/resources.ts` — miroir 1:1 de `models/resources.py` + `routers/resources.py`
  (13 endpoints), `SchemaNotReadyError` (motif `water.ts`), agrégateur PUR `buildStageConcentration`
  (miroir de `scoring.py::compute_stage`), `herfindahl` (barème DOJ 0-10000), `deriveSupplyStaleness`,
  libellés FR, réexport des paliers `riskBand`/`confidenceBand`/`formatPct` de `lib/api/crma.ts`.

**Composants présentationnels (`apps/carbon/components/resources/`, tous purs → testables au rendu serveur)**
- `section.tsx` (ResourceSection/ResourceCard/KeyValue/EmptyNote), `resource-nav.tsx` (onglets),
  `methodology-disclaimer.tsx`, `resource-data-status.tsx` (réutilise `DataStatusBadge`),
  `provenance.tsx`, `dimension-bar.tsx` (motion gardée `motion-safe:`),
  `assessment-dimensions-panel.tsx` (LA décomposition risque‖confiance), `resource-index-card.tsx`
  (indice secondaire décomposable), `stage-concentration-panel.tsx`, `regulatory-status-panel.tsx`,
  `module-links.tsx`, `exposure-links-table.tsx`, `assessment-summary-table.tsx`.

**Pages** — `apps/carbon/app/(app)/resources/{page,[slug]/page,exposures/page,assessments/page,methodology/page}.tsx`.

**Enregistrement**
- `apps/carbon/app/(app)/layout.tsx` — `pageConfig` : 4 entrées `/resources*` (titre/sous-titre en-tête).
- `apps/carbon/data/feature-status.json` — feature `resources-module` (`statut: beta`, `href: /resources`,
  `preuve: apps/api/services/resources/scoring.py`) + `derniere_maj` → 2026-07-22.
- **Sidebar non modifiée** (précédent CRMA/Water/Nature : ces modules BETA ne sont pas dans la barre
  latérale ; les ajouter exigerait d'étendre l'union `Page` de `lib/types.ts` — hors périmètre).

**Tests**
- `apps/carbon/tests/resources-presentation.test.ts` (16 cas purs + registre).
- `apps/carbon/tests/resources-components.test.tsx` (21 cas de rendu serveur : décomposition,
  manquant≠zéro, provenance, disclaimer, reduced-motion, a11y).
- `apps/carbon/e2e/tests/16-resources.spec.ts` (Playwright, parcours principal).

**Docs** — ce fichier + mise à jour `MODULE2_HANDOFF.md`.

## 3. Garanties du brief (mapping)

| Exigence | Où | Preuve |
|---|---|---|
| Statut réglementaire **versionné** | `regulatory-status-panel.tsx` | `regulation_ref` + `list_or_annex` + `certainty`, une ligne par régime |
| **Année** | fiche & panels | `verified_on` (réglementaire), `reference_year` (offre), `assessment_year` (run) |
| **Étape** | `stage-concentration-panel.tsx` | 1 carte par `stage_code`, jamais de moyenne inter-étapes |
| **Géographie** | idem | parts pays observées + barres |
| **Concentration pays** | idem + `resources.ts` | HHI 0-10000 par étape (`buildStageConcentration`/`herfindahl`) |
| **Concentration fournisseur** | `assessment-dimensions-panel.tsx` | dimension `supplier_dependency` |
| **Substituabilité** | idem | dimension `substitutability` (maturité + pénalité séparées) |
| **Exposition environnementale** | `module-links.tsx` | liens vers modules porteurs, **aucun recalcul carbone (D-4)** |
| **Qualité des preuves** | dimensions confiance + `provenance.tsx` | `evidence_coverage`, `data_quality`, `source_release_ids` |
| **Confiance** | `resource-index-card` + dimensions | colonne séparée du risque, palier `confidenceBand` |
| **Données manquantes** | `assessment-dimensions-panel` | `available=false` → « Donnée manquante », `missing_share_pct` |
| **Provenance** | `provenance.tsx` | `source_release_id(s)` → lien Source Admin ; « avoué » si absent |
| **Liens CRMA/Water/Energy/Procurement** | `module-links.tsx` | `/crma`, `/water`, `/scopes`, `/fournisseurs/scope3` |
| **Pas de jauge opaque** | `assessment-dimensions-panel` + `dimension-bar` | chaque composante a sa barre, sa valeur, sa provenance |
| **Indice global secondaire, décomposable, méthode non officielle** | `resource-index-card` + `methodology-disclaimer` | libellé « indice secondaire », renvoi au détail, disclaimer partout |

## 4. Réutilisation

- **`DataStatusBadge` + `dataStatusToBadge`** (via `resource-data-status.tsx`) — vocabulaire unique
  VERIFIED/ESTIMATED/MANUAL/STALE.
- **`SourceDrawer`, `StalenessWarning`, `LicenseWarning`** (`components/intelligence/*`) — sur la fiche,
  suivant le précédent de `app/(app)/intelligence/sources/[id]/page.tsx` qui les utilise déjà sur une
  page thème `(app)`.
- **`AnalyticalEnvelope`** — l'assessment EST une enveloppe risque≠confiance : le type
  `ResourceAssessmentDetail` porte les deux axes séparés + provenance par composante (même intention).
- **Composants CRMA** — `riskBand`/`confidenceBand`/`formatPct` réexportés de `lib/api/crma.ts` ; concept
  `StageConcentration` (HHI par étape) réimplémenté côté client.
- **Water/Energy** — motif `SchemaNotReadyError`/états BETA repris de `water.ts` ; liens vers `/scopes`
  (Énergie Scope 2) et `/water`.
- **Design system** — thème par variables CSS (`--color-*`), `FeatureStatusBadge status="beta"`,
  `ResourceNav`, primitives `Section`, comme water/crma.

## 5. Tests & vérifications locales

| Contrôle | Résultat |
|---|---|
| `vitest run` (suite complète) | **237 passed / 0 failed** (dont 37 nouveaux : 16 présentation + 21 composants) |
| `tsc --noEmit` | **exit 0** (projet entier, y compris toutes les pages/composants Ressources) |
| `eslint` (fichiers Ressources) | **0 erreur, 0 warning** |
| `next build` | **succès** — routes `/resources` (○), `/resources/[slug]` (ƒ), `/resources/{assessments,exposures,methodology}` (○) |
| Accessibilité | rôles/aria-label (badge, disclaimer=note, nav aria-label, `aria-current`), `scope="col"`, `<caption>`, valeurs en toutes lettres (jamais dépendantes du visuel) |
| Reduced motion | toute transition gardée par `motion-safe:` (désactivée sous `prefers-reduced-motion`) — assertion dédiée |
| États empty/loading/error/stale/licence | testés (composants) + rendus explicites (pages) : `*-loading`, `*-schema-not-ready`, `*-error`, `*-empty`, `StalenessWarning`, `LicenseWarning` |
| Playwright | `16-resources.spec.ts` écrit (parcours catalogue→fiche→expositions→assessments→méthodologie) — exécuté par la CI (nécessite serveur dev + backend authentifié + `E2E_USER_PASSWORD`), non lancé en local |

**Environnement** : le worktree n'avait pas de `node_modules` (non tracké par git) ; installé proprement
via `npm ci` (932 paquets, isolé — pas de jonction vers la copie principale au moment des vérifications
finales).

## 6. Décisions & écarts assumés

- **`GET /catalog/{slug}/supply` renvoie des observations pays BRUTES** (`ResourceSupplyObservationListResponse`),
  pas une chaîne de valeur pré-agrégée : la concentration par étape (HHI, premier pays, couverture, part
  hors UE) est calculée **côté client** par `buildStageConcentration`, miroir fidèle de `scoring.py::compute_stage`.
  Testé (monopole=10000, 4 parts=2500, non-mélange d'étapes, volume→couverture indéterminée).
- **Pas de rôle « roles » sur le catalogue** : le modèle réel (`ResourceCatalogItem`) n'expose pas de tableau
  `roles` (reporté côté backend) ; l'UI suit le modèle réel, pas le contrat initial.
- **Création de liens d'exposition** hors périmètre MVP (les cibles proviennent des modules Achats/Énergie/Eau) :
  page Expositions en lecture seule, avec note explicative.
- **`EvidenceList`** non forcé : le domaine Ressources expose des `source_release_id` (entiers), pas des objets
  `Release` complets — la provenance renvoie vers Source Admin (`/intelligence/sources`) où `EvidenceList`
  détaille checksum/date. Pas de fetch cross-module ajouté pour un affichage redondant.
- **Bouton « Lancer un assessment »** (POST `require_analyst`) sur la fiche : un viewer reçoit un 403 rendu comme
  message clair (« requiert le rôle analyste »), jamais une erreur brute.

## 7. NEXT_ACTION

**Extension Asterion (PR-M2D)** — parcours de démonstration ressources stratégiques, 100 % fictif, zéro
migration, zéro appel externe (cf. `MODULE2_IMPLEMENTATION_PLAN.md` §PR-M2D). Sur décision explicite de Ludo.

**Post-merge (Ludo)** : redéploiement Vercel `carbon` automatique. Vérifier que les migrations 042/043 sont
bien appliquées en production (`/health/schema` → `043`) avant de compter sur les données réelles — sinon les
pages afficheront `schema_not_ready` (comportement voulu, non bloquant).
