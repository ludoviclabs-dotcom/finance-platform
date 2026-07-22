# PR-M2D — Démonstration Asterion des dépendances ressources (traçabilité)

> **Module 2, tranche D — extension du Demo Studio « Asterion Motion ».** Date : 2026-07-22 ·
> Branche : `feat/demo-asterion-strategic-resources` · Base : `origin/master` `d7d7505`
> (PR-M2A #127 + PR-M2B #128 + PR-M2C #129 mergées ; Demo Studio #122 mergé).
> **Ne pas merger automatiquement. Zéro migration. Zéro appel externe. 100 % fictif.**

## 1. Objet

Étendre **uniquement** le tenant synthétique `asterion-motion-demo` avec une nouvelle séquence
**« Dépendances industrielles étendues »** (Module 2). Deux couches, comme le Demo Studio existant :

1. **Backend seed** (`demo_*.py` + scénario JSON) : peuple les tables Module 2 du tenant démo avec
   des ressources synthétiques, puis calcule l'assessment via le **moteur réel** — pour une démo
   « vivante » via l'API.
2. **Cinématique frontend** (`/demo/asterion-resources`) : 10 beats rendant les **vrais composants**
   du cockpit `/resources` (PR-M2C) avec des données canoniques identiques au moteur — fonctionne
   hors-ligne, sans seed.

La séquence Asterion Motion existante (`/demo/asterion-motion`) **n'est pas touchée**.

## 2. Ressources synthétiques (les 5 autorisées)

| Slug | Famille | Risque | Confiance | HHI | Manquant | Exposition |
|---|---|---|---|---|---|---|
| silicon-metal (pilote) | critical_raw_material | **70.58** | 79.4 | 6239.67 | substitutability | achat réel + BOM |
| helium | industrial_gas | 64.4 | 80.6 | 4111.53 | substitutability | manuel |
| xenon | industrial_gas | 66.67 | 75.8 | 3520.82 | substitutability, stock_coverage | manuel |
| hydrogen | energy_fuel | 25.06 | 77.0 | 2654.32 | supplier_dependency, substitutability | activité énergie réelle |
| coking-coal | energy_fuel | 55.1 | 78.2 | 3208.62 | substitutability | manuel |

Toute valeur : `synthetic=true`, `data_status ∈ {estimated, manual}`, **arithmétiquement cohérente**
(produite par `services/resources/scoring.py`), preuve synthétique (release Evidence Kernel dédiée),
**tenant-scoped** (`company_id` = tenant Asterion, jamais global). Les parts pays sont la
cartographie d'approvisionnement ESTIMÉE du tenant — **jamais une statistique mondiale**.

## 3. Fichiers

**Backend** (`apps/api/`)
- `demo/scenarios/asterion-motion-v1/resources.json` — 5 ressources + alias + réglementaire + usages
  + observations de supply + expositions + `expected_assessments` (valeurs canoniques du moteur).
- `demo/scenarios/asterion-motion-v1/manifest.json` — `resources.json` ajouté aux `files`.
- `demo/loader.py` — champ `resources` (dict souple, `_read_json_optional`).
- `scripts/demo_seed.py` — `_seed_resources()` (catalogue/alias/réglementaire/usages/supply/liens
  + parents achat & énergie réels) puis assessment via `assessment_service._gather_inputs` +
  `scoring.assess` (moteur RÉEL, même transaction) ; idempotent par `input_hash`. Dry-run mis à jour.
- `scripts/demo_reset.py` — 11 tables Module 2 (+ parents) préfixées au `_DELETE_ORDER` (tenant-only).
- `scripts/demo_verify.py` — `_resource_arithmetic` (recalcul pur vs `expected_assessments`) + parité
  de peuplement (runs seedés).
- `tests/test_demo_seed.py` — `CEILING` 041→**043**, tables Module 2 au teardown, test idempotence/
  scope/stabilité (input_hash figé), reset tenant-only étendu (voisin intact).
- `tests/test_demo_resources.py` — **PUR** (job `tests`, sans base) : parité moteur, risque≠confiance,
  substituabilité manquante, reproductibilité.

**Frontend** (`apps/carbon/`)
- `lib/demo/asterion-resources-data.ts` — données canoniques typées `@/lib/api/resources` (valeurs =
  sortie moteur exacte).
- `lib/demo/asterion-resources-tour.ts` — les 10 beats (`ASTERION_RESOURCES_TOUR`).
- `lib/demo/asterion-motion-tour.ts` — `TourStep.beat?` ajouté (optionnel, rétrocompatible).
- `components/demo/asterion/demo-shell.tsx` — **paramétré** (`tour`/`badges`/`renderStepBody`/`testId`/
  `title`/`eyebrow`, défauts = comportement existant → `/demo/asterion-motion` inchangé).
- `components/demo/asterion/demo-progress.tsx` — prop `steps` (défaut = tour Asterion).
- `components/demo/asterion/resources/resource-beat.tsx` — `renderResourceBeat(step)` (10 beats,
  composants réels, surface CSS sombre).
- `components/demo/asterion/resources/resources-demo-client.tsx` + `app/demo/asterion-resources/page.tsx`.
- `tests/demo-resources.test.tsx` — rendu serveur des beats + garanties canoniques.
- `e2e/tests/17-demo-asterion-resources.spec.ts` — parcours (badges, nav, clavier, réalisateur,
  reduced-motion, beats risque/manquant/décision).

## 4. Les 10 démonstrations exigées (mapping)

| # | Exigence | Où (beat) |
|---|---|---|
| 1 | Ressource détectée | `detected` — catalogue 5 ressources |
| 2 | Usage industriel | `use` — `ResourceSectorUse` (usage-secteur seulement) |
| 3 | Exposition (BOM/achat/activité) | `exposure` — `ExposureLinksTable` (purchase_line, bom_item, energy_activity) + `ModuleLinks` |
| 4 | Étape de chaîne | `stage` — `StageConcentrationPanel` (HHI par étape) |
| 5 | Source & qualité | `source-quality` — `ResourceDataStatus` + `StalenessWarning` + `ProvenanceRefs` |
| 6 | Dimensions de risque | `risk` — `ResourceIndexCard` + `AssessmentDimensionsPanel` (décomposé) |
| 7 | Confiance | `confidence` — axe séparé, 6 composantes de confiance |
| 8 | Données manquantes | `missing` — substituabilité « Donnée manquante » (jamais risque nul) |
| 9 | Suggestion d'action | `action` — alerte dépendance + pistes (proposées, jamais appliquées) |
| 10 | Décision humaine | `decision` — retenir/écarter/différer, motivé, append-only |

## 5. Contraintes honorées

- **Pas d'appel IA live** : la séquence ressources ne déclenche aucune revue IA ; la cinématique est
  hors-ligne (données canoniques). Aucun appel externe.
- **Pas de statistique mondiale inventée** : parts pays = cartographie d'appro. ESTIMÉE du tenant.
- **Pas de contenu Défense/Spatial opérationnel** : xénon décrit par gravure semi-conducteurs /
  imagerie médicale (jamais propulsion) ; usages = classification supply-chain seulement.
- **Jamais de jauge opaque** : indice secondaire + décomposition (beats 6-8) + disclaimer non officiel.
- **Tenant-only / aucune fuite** : seed et reset filtrés `company_id = démo` ; test de voisinage.

## 6. Vérifications locales

| Contrôle | Résultat |
|---|---|
| `demo_verify.py` (arithmétique, sans base) | **parité vérifiée** — les 5 ressources reproduisent EXACTEMENT `expected_assessments` |
| `demo_seed.py --dry-run` | plan correct (5 ressources, 21 obs. supply, 8 liens, 5 assessments) |
| `py_compile` + `ruff` (backend) | **propre** |
| `pytest tests/test_demo_resources.py tests/test_demo_scenario_provider.py` (pur) | **8 passed** |
| `vitest run` (frontend, suite complète) | **246 passed** (9 nouveaux, 0 régression) |
| `tsc --noEmit` | **exit 0** |
| `eslint` (fichiers modifiés) | **0 erreur** |
| `next build` | **succès** — `/demo/asterion-resources` prérendue, `/demo/asterion-motion` intacte |
| DB-gated (`test_demo_seed.py`) | exécuté en CI `migration-tests` (pas de Postgres local — contrainte du chantier) |
| Playwright `17-demo-asterion-resources.spec.ts` | exécuté par la CI (serveur dev requis) |

## 7. Décisions & écarts assumés

- **Seed via moteur RÉEL** : `_seed_resources` réutilise `assessment_service._gather_inputs` + `scoring.assess`
  dans la transaction du seed → le run seedé est identique à celui de l'API (`/resources/assessments`).
  `input_hash` déterministe ⇒ re-seed idempotent (run non recréé).
- **Expositions backend** : `purchase_line` (silicium, parent réel purchase_imports+purchase_lines) +
  `energy_activity` (hydrogène, parent réel) démontrent l'orchestration D-1 ; le reste en `manual`
  (évite la chaîne `products→bom_versions→bom_items`, non testable sans Postgres local). La cinématique
  frontend montre les trois origines (achat, BOM, activité) en données fictives.
- **Séquence sœur, pas d'écrasement** : `DemoShell` paramétré en rétrocompatibilité ; nouvelle route
  dédiée. `14-demo-asterion.spec.ts` inchangé (le tour existant reste à 10 étapes).
- **Émission IRO** (`origin_domain='strategic_resources'`) non implémentée (contrainte `iros_origin_domain_check`
  non élargie en M2B) : le beat « décision humaine » est une interaction de démonstration, pas une écriture IRO.

## 8. NEXT_ACTION

**Intégration finale** (Module 2). Post-merge (Ludo, hors code) : pour une démo « vivante », lancer le
workflow `demo-scenario` `action=seed mode=commit` (gate `production-db`) — le schéma prod doit être à
**043** (`/health/schema`). La cinématique `/demo/asterion-resources` fonctionne déjà hors-ligne sans seed.
