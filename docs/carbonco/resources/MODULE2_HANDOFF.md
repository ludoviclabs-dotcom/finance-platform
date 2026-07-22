# MODULE 2 — HANDOFF

> **Module :** Ressources stratégiques & dépendances industrielles étendues.
> **Date : 2026-07-22** · **Branche :** `docs/strategic-resources-architecture` · **Base :** `origin/master` `c29baf3` (PR #125 mergée, schéma `041`).

```
STATUS=PR_M2C_IMPLEMENTED
NEXT_ACTION=extension Asterion (PR-M2D)
MIGRATION_042=APPLIQUÉE (PR-M2A mergée #127)
MIGRATION_043=MERGÉE (PR-M2B #128, master 79c3dbf)
FRONTEND=PR-M2C ouverte (branche feat/resources-cockpit) — cockpit /resources, NON mergée
```

> **Mise à jour PR-M2C (frontend implémenté) :** cockpit Ressources `apps/carbon` — 5 pages
> (`/resources`, `/resources/[slug]`, `/resources/exposures`, `/resources/assessments`,
> `/resources/methodology`), client typé `lib/api/resources.ts`, composants `components/resources/*`,
> feature `resources-module` (beta) enregistrée, tests vitest (37 nouveaux) + Playwright + a11y +
> reduced-motion. Vérifs locales : vitest 237/237, `tsc --noEmit` exit 0, eslint 0, `next build` OK.
> Détail : `PR_M2C_TRACEABILITY.md`. Décomposition stricte (jamais de jauge opaque), risque≠confiance,
> indice secondaire + disclaimer non officiel. **NEXT_ACTION = extension Asterion (PR-M2D)** — parcours
> de démonstration ressources 100 % fictif, sur décision explicite de Ludo. Post-merge : redéploiement
> Vercel `carbon` ; vérifier `/health/schema=043` en prod (sinon les pages affichent `schema_not_ready`).

> **Mise à jour PR-M2A (mergée #127) :** migration **042** (catalogue) en production ; base master `14e57b1`.
>
> **Mise à jour PR-M2B (implémentation code) :** le moteur multidimensionnel est implémenté sur `feat/resources-assessment-engine` (migration **043** : `resource_supply_observations`, `company_resource_exposure_links`, `resource_assessment_runs`, `resource_assessment_dimensions` + RLS gen-2 + triggers d'immutabilité + moteur PUR `scoring.py` HHI 0-10000 + services supply/exposure/assessment + API supply/exposures/assessments/alerts + tests). Détail : `PR_M2B_TRACEABILITY.md`. Reportés : émission IRO (D-5, `iros_origin_domain_check` non élargie), `resource_roles`/`resource_stage_applicability` (D-1/D-6), union legacy `material_stage_observations`. **NEXT_ACTION = merger PR-M2B (décision Ludo) → appliquer 043 via `db-migrate.yml` → lancer le frontend PR-M2C.**

## 1. État de la phase

**Phase 1 (cadrage) TERMINÉE + arbitrage Ludo D-1 à D-6 appliqué (PR #125 mergée).** **Phase 2 (architecture définitive) TERMINÉE**, **documentaire uniquement** — l'architecture ne lève pas l'interdiction de coder :
- ❌ Aucun fichier sous `apps/` modifié. ❌ Aucune migration SQL réelle. ❌ Aucune migration existante modifiée. ❌ Aucun développement/route/interface. ❌ Aucun frontend. ❌ Aucun seed. ❌ Aucune migration lancée.
- ✅ Numéro de migration **vérifié réellement** contre `apps/api/db/migrations/` + `migration_manifest.py` : dernière = **041**, aucun trou, aucun 042 non mergé → **N=042, N+1=043 réservés** (pas supposés).
- ✅ 5 documents d'architecture créés + HANDOFF/DECISIONS/METHODOLOGY mis à jour.
- ✅ Interdictions de contenu Défense/Spatial matérialisées dans le schéma et la revue (`MODULE2_RLS_AND_SECURITY.md` §7).

## 2. Fichiers créés / mis à jour

**Nouveaux (Phase 2) :**

| Fichier | Contenu |
|---|---|
| `docs/carbonco/resources/MODULE2_DATA_MODEL.md` | Modèle cible : 042 (catalogue, aliases, regulatory, uses, roles, stage-applicability) + 043 (supply obs, exposure links, assessment runs, dimensions, ALTER iros). Par table : finalité/portée/colonnes/types/clés/CHECK/index/FK/immutabilité/idempotence/EK/RLS/exemples/limites. |
| `docs/carbonco/resources/MODULE2_API_CONTRACTS.md` | Router `/resources` : 13 endpoints, rôles, pagination, modèles Pydantic, erreurs, `schema_not_ready`, interdictions, exemples JSON. |
| `docs/carbonco/resources/MODULE2_RLS_AND_SECURITY.md` | RLS gen-2 FORCE, profils mixte/tenant, bypass admin, défense applicative, anti-IDOR, immutabilité, EK/licence, frontière Défense/Spatial stricte. |
| `docs/carbonco/resources/MODULE2_TEST_STRATEGY.md` | Matrice de tests (ledger, probes, RLS, services, API, HHI, licence, IDOR, IRO, frontend, demo, contenu) + tests HHI obligatoires (échelle 0–10000). |
| `docs/carbonco/resources/MODULE2_IMPLEMENTATION_PLAN.md` | Découpage PR-M2A→M2D : fichiers, risques, critères de merge, tests, opérations post-merge, hors périmètre. |

**Mis à jour (Phase 2) :** `MODULE2_HANDOFF.md` (ce doc), `MODULE2_DECISIONS.md` (§ architecture + HHI 0–10000 + O-8), `METHODOLOGY_AND_ALGORITHMS.md` (§B.1/§D-2 échelle HHI).
**Inchangés (Phase 1) :** `MODULE2_SOURCE_OF_TRUTH.md`, `REGULATORY_SOURCE_MATRIX.md`, `DATA_SOURCE_AND_LICENSE_MATRIX.md` (aucun fait nouveau).

## 3. Décisions confirmées (résumé — détail dans `MODULE2_DECISIONS.md`)

1. MODULE 2 = **extension** du modèle 034 + `scoring.py` (pas d'architecture parallèle).
2. **Un seul moteur de score**, réutilisé et **paramétré par famille** (jamais cloné — constantes actuelles spécifiques aux aimants).
3. **Evidence Kernel + `license_policy`** réutilisés (pas de 2ᵉ modèle de licence).
4. Invariants conservés : **risque ≠ confiance ; manquant ≠ zéro ; sourcé-ou-avoué ; jamais de fusion inter-étapes ; jamais présenté comme note officielle UE.**
5. **Reclassements réglementaires** : Hélium = CRMA Critique ; Silicium métal = Stratégique + Critique ; Charbon à coke = Critique (pas CBAM) ; **Uranium = Euratom (pas CRMA)** ; **Hydrogène = RFNBO + CBAM (pas CRMA)** ; **Xénon/Krypton/Argon = non-CRMA** ; **Bois + Caoutchouc = EUDR** ; **Coton/Lin/Chanvre = hors EUDR**.
6. **Sources ouvertes** (USGS, JRC RMIS, Eurostat, FAOSTAT, World Bank WGI, Euratom ESA) vs **propriétaires/bloquées** (IEA, BGS WMS, PRAs, ICAC, ANRPC, UxC/TradeTech, rapports gaz, ENTSOG) → ces dernières **dégradent la confiance, jamais le risque**.
7. **ESRS E5** = standard d'ancrage ; IRO via ESRS 1/2.

## 4. Questions bloquantes — RÉSOLUES par arbitrage Ludo (2026-07-22)

Toutes les 6 questions bloquantes du cadrage sont **tranchées**. Détail intégral dans `MODULE2_DECISIONS.md` §2 (D-1 à D-6) — résumé :

- **Q-1 — Combustible = matière et/ou porteur ?** → **D-1 : modèle multi-rôle** (`material`/`feedstock`/`energy_carrier`/`process_input`/`industrial_gas`/`nuclear_fuel`/`biomass`/`water`, non exclusif). Pont futur `company_resource_exposure_links` vers `bom_item`/`purchase_line`/`energy_activity`/`water_activity`/`supplier_declaration`/`manual_assessment`. Le module Resources orchestre, ne remplace pas Energy/CRMA/Procurement.
- **Q-2 — Table de référence `materials` ?** → **D-2 : créer `resource_catalog`** sans casser l'existant. `material_id TEXT` legacy préservé ; rapprochement par `resource_aliases` (legacy_material_id/CAS/EC/HS-CN/REACH/internal/other), jamais par réécriture brutale des tables CRMA.
- **Q-3 — Risque-pays.** → **D-3 : MVP = garder `third_country_dependency`** (renommé honnêtement, PAS « country risk score », aucun poids inventé) ; **v2 = WGI sourcé, sous conditions strictes** (licence confirmée, `source_release`, confiance séparée, aucune transformation opaque) — jamais avant que ces conditions soient réunies.
- **Q-4 — Périmètre des intensités.** → **D-4 : pas de nouveau moteur carbone.** Intensités carbone = affichage/lien depuis Scope 2/Scope 3/PCF/Energy/Procurement existants seulement. Nouvelles intensités **ressources** autorisées (m³/unité fonctionnelle, kg/unité, tonne/produit, kg/M€, kg/heure) si dénominateur documenté. Interdit : facteur codé en dur, `kgCO2e/kN` de poussée, calcul carbone spatial/défense, intensité sans source+unité+périmètre+année.
- **Q-5 — Lignée IRO.** → **D-5 : les deux, selon règle de routage.** `crma` si origine réellement CRMA ; nouveau domaine **`strategic_resources`** pour les ressources étendues non-CRMA. Extension de contrainte SQL documentée comme migration future, pas implémentée ici. Matérialité toujours humaine, append-only.
- **Q-6 — Vocabulaires d'étapes par famille.** → **D-6 : pilotage DB, jamais codé en dur.** Réutiliser `processing_stages`/`stage_code`/`stage_order`/`is_upstream` ; étendre avec `resource_stage_families`/`resource_stage_applicability` (nom à trancher en architecture). Chaque étape versionnée, documentée, stable, testable.

## 5. UNRESOLVED — manques de source ou de licence réels (le reste est tranché)

> Critère strict : figure ici **uniquement** ce qui manque parce qu'une source ou une licence n'est pas confirmée — pas un choix d'architecture (ceux-là sont dans `MODULE2_DECISIONS.md` §3, non bloquants).

Réglementaire (`REGULATORY_SOURCE_MATRIX.md` §2) :
- Statut d'enregistrement REACH (tonnage/dossier) par gaz (He/Ar/Kr/Xe/H2) — infocards ECHA en HTTP 403 → vérification manuelle.
- Listage dual-use par substance (hélium-3) — texte Annexe I Reg (UE) 2021/821 non ouvert (garde-fou sécurité) ; existence-seule, non affirmé.
- Objectifs de remplissage stockages gaz 2026 (extension Reg (UE) 2022/1032) — référence du règlement modificatif final manquante.
- Texte verbatim des Annexes I/II du CRMA (CELEX 32024R1252) — HTML EUR-Lex vide ; classement solide via JRC RMIS + DG GROW, citation d'annexe à tirer manuellement.
- Forme/nom légal exact du standard volontaire « VS » (successeur VSME) — pas encore publié.
- **ESRS simplifiés** (acte délégué amendant le Reg (UE) 2023/2772) — encore **proposed/draft**, pas adopté : ne pas figer de champ d'information réglementaire dessus avant adoption (O-9, `MODULE2_DECISIONS.md` §3).

Données/licences (`DATA_SOURCE_AND_LICENSE_MATRIX.md` §5) :
- Droit d'usage dérivé exact de la **Transparency Platform ENTSOG** (PDF de termes non récupéré) → défaut = bloqué.
- Millésimes exacts (USGS MCS 2026 vs 2025 ; WGI 2024 vs MAJ 2025 ; édition BGS) — indicatifs, non vérifiés-licence.

Ces UNRESOLVED réglementaires/licence sont portés **en base** par `resource_regulatory_statuses` (CHECK `sourced` : `confirmed` ⇒ release) et par le gate licence O-10 — l'architecture ne les résout pas (dépendances de source externes) mais les **rend explicites et non-bloquants** pour démarrer PR-M2A. Les paramètres d'implémentation restants (garde de couverture HHI, poids de confiance, δ de sensibilité) sont listés dans `MODULE2_DECISIONS.md` §3 et `MODULE2_IMPLEMENTATION_PLAN.md`.

## 6. NEXT_ACTION

**= PR-M2A — Catalogue & réglementation** (première PR d'implémentation, cf. `MODULE2_IMPLEMENTATION_PLAN.md`).

Contenu de PR-M2A (sur décision explicite de Ludo, une PR à la fois) :
- migration **042** (`resource_catalog`, `resource_roles`, `resource_aliases`, `resource_regulatory_statuses`, `resource_sector_uses`, `resource_stage_applicability`) + manifeste + `_probe_042` ;
- modèles `models/resources.py`, services `services/resources/*` (lecture), router `routers/resources.py` (GET catalogue/alias/réglementation/usages/supply) ;
- service d'import des ressources canoniques (données, hors migration) ;
- tests RLS/probes DB-gated + `PR_M2A_TRACEABILITY.md`.

**Interdictions maintenues jusqu'à validation explicite** : pas de code, pas de migration réelle, pas de modification sous `apps/`, pas de frontend, pas de seed, pas de push de code, pas de PR de code, pas de merge automatique. Cette phase (architecture) reste **docs-only**.
