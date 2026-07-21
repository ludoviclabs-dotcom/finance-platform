# MODULE 2 — Ressources stratégiques & dépendances industrielles étendues
## SOURCE OF TRUTH (vérité d'architecture et de périmètre)

> **Phase :** cadrage / inventaire de l'existant / validation méthodologique **UNIQUEMENT**.
> **Date :** 2026-07-22 · **Branche :** `docs/strategic-resources-cadrage` · **Base :** `origin/master` `2175f89` (schéma `041`).
> **Statut :** DRAFT de cadrage. Aucun code, aucune migration, aucune route, aucune interface produits ici.
> Ce document fixe **ce qui existe déjà** et **ce qui serait réellement nouveau** ; il ne conçoit pas l'architecture (voir `MODULE2_HANDOFF.md` → NEXT_ACTION).

Ce fichier est le point d'ancrage des cinq autres livrables de cadrage :
- `REGULATORY_SOURCE_MATRIX.md` — vérité réglementaire (CRMA, EUDR, REACH, CLP, dual-use, ESRS).
- `DATA_SOURCE_AND_LICENSE_MATRIX.md` — datasets, millésimes, licences, droits d'usage.
- `METHODOLOGY_AND_ALGORITHMS.md` — formules, unités, biais, tests, formules rejetées.
- `MODULE2_DECISIONS.md` — décisions confirmées et ouvertes.
- `MODULE2_HANDOFF.md` — état de phase, questions bloquantes, NEXT_ACTION.

---

## 1. Stack réelle (vérifiée par lecture directe du dépôt)

| Couche | Réalité | Preuve |
|---|---|---|
| Backend | **FastAPI (Python)**, projet Vercel `carbonco-api` | `apps/api/` |
| Frontend | **Next.js** (App Router), projet Vercel `carbon` (`carbon-snowy-nine.vercel.app`) | `apps/carbon/` |
| Base | **PostgreSQL / Neon**, **42 migrations 001→041** appliquées en prod (`schema_version=041, up_to_date=true`) | `apps/api/db/migrations/` |
| Ledger de migrations | `schema_migrations` + `db-migrate.yml` (workflow protégé, `DATABASE_ADMIN_URL`/`neondb_owner`). Aucun chemin d'écriture schéma automatique. | migrations 000-bootstrap, PR-02 |
| Isolation | **RLS Génération-2** (ENABLE + **FORCE**), policies par commande, `app.current_company_id`, bypass global `app.rls_bypass` | `034:577-949`, contrats §7 |
| Sourcing / preuve | **Evidence Kernel** (028) : `source_registry` → `source_releases` (immuables) → `evidence_artifacts` / `observations` (gelées) → `claim_evidence_links` | `028_evidence_kernel.sql` |
| Licence | décision **déterministe** `license_policy.evaluate(source)` → `allow_ingest/store/display/derived_use` (+ raisons/avertissements) | `services/intelligence/license_policy.py:17` |
| IA | assistant **cité + revue humaine obligatoire**, `AI_REVIEW_MODE=demo` par défaut (zéro coût), aucune écriture métier par le modèle | PR-11, `AI_GOVERNANCE_CONTRACTS.md` |

**Le chantier Intelligence (11 PR) est CLOS et en production.** MODULE 2 démarre **après** lui, sur une base stable. Les contrats gelés à respecter existent et font foi : `docs/carbonco/refonte/PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md`, `WAVE_2_INTERFACE_CONTRACTS.md`, `WAVE_4_INTERFACE_CONTRACTS.md` (localisés dans le dépôt — l'agent architecture ne les avait pas trouvés lors de sa passe, ils existent bien sous `docs/carbonco/refonte/`).

---

## 2. Le précédent architectural direct : le modèle d'exposition matières (CRMA / PR-07)

**MODULE 2 est une EXTENSION de ce modèle, PAS une nouvelle architecture.** La migration `034_crma_material_exposure.sql` et le service `services/crma/scoring.py` fournissent un socle **agnostique à la matière** :

- La clé de matière est **`material_id TEXT`, sans clé étrangère** (`034:142,194,248,282,421,482` ; convention partagée avec `material_mappings.material_id`, `030:197`). N'importe quelle nouvelle ressource (xénon, hydrogène, bois…) devient un `material_id` sans changement de schéma.
- Le statut critique/stratégique est une **appartenance à un groupe** (`material_groups` + `material_group_members`), **non exclusive et versionnée** (`regulation_version`, ex. `CRMA-2024`) — jamais deux booléens.
- La concentration se calcule **par étape de chaîne de valeur** (`material_stage_observations.stage_code NOT NULL`) : le schéma **interdit** une « part pays globale » mélangeant extraction et raffinage.
- Le score (`crma_article24_assessments`) porte **`risk_score` ET `confidence` en deux colonnes distinctes** — jamais fusionnées.

### 2.1 Tables & services à RÉUTILISER (ne pas réinventer)

| Besoin MODULE 2 | Réutiliser | Ne PAS réinventer |
|---|---|---|
| Sourcing / licence | Evidence Kernel (028) + `license_policy.evaluate` | un 2ᵉ modèle de licence / table d'observations |
| Clé matière | convention `material_id TEXT` (sans FK) | une table `materials` parallèle |
| Concentration + score | `services/crma/scoring.py` (pur, HHI-par-étape, risque≠confiance) | un 2ᵉ moteur de score |
| Taxonomie statut/famille | `material_groups` + `material_group_members` | des colonnes booléennes `criticality` |
| Exposition entreprise | `company_material_exposures` (034, liée BOM/fournisseur) | une nouvelle table d'exposition |
| Prix de marché sous licence | `material_market_observations` (034, `source_release_id NOT NULL`) | une nouvelle table de prix |
| Substituts / recyclage | `substitutes`, `recycling_routes` (034) | de nouvelles tables |
| Événements commerciaux/régl. | `trade_or_regulatory_events` (034) | une nouvelle table d'événements |
| Actions d'atténuation | `mitigation_actions` (034, motif repris par eau/nature/iro) | une nouvelle table d'actions |
| Intake risque/opportunité central | `iros` (040, `origin_domain ∈ {water,nature,crma,energy,manual}`) | un registre de risques parallèle |
| UX qualité de donnée | `DataStatusBadge`, `Reveal`, `AnimatedCounter`, `dataLoader` | un 2ᵉ vocabulaire de badges |
| Surface de module | `data/feature-status.json` → `lib/feature-registry.ts` | un statut codé en dur |

Services patron à cloner/paramétrer : `services/crma/{reference_service,stage_service,scoring,exposure_service,article24_service}.py` ; `services/intelligence/{license_policy,observation_service,release_service}.py`. Routeur patron : `routers/crma.py` (24 endpoints, lecture=`get_current_user`, écriture=`require_analyst`). Modèles patron : `models/crma.py` (Literal miroir des CHECK SQL).

---

## 3. Terminologie (à employer sans dérive)

| Terme | Signification exacte dans CE dépôt |
|---|---|
| **CC-MATERIAL-EXPOSURE 0.1.0** | Méthode **backend auditable** (`scoring.py`), risque+confiance séparés, composantes inspectables, sous Evidence Kernel. **Fait autorité.** |
| **CC-SUPPLY-RISK-0.1** | Score **frontend illustratif** du snapshot statique `crm_full_34_snapshot_2026-06-30.json` (`data_quality: estimated`, `score_confidence: null`, un seul point de prix). **Démo, PAS normatif.** Ne jamais confondre avec le précédent. |
| **Badges statut** | `VERIFIED · ESTIMATED · MANUAL · INFERRED · STALE` (qualité) / `LICENSED · BLOCKED · DRAFT · BETA · LIVE · ROADMAP` (cycle/licence). |
| **risque ≠ confiance** | Deux grandeurs distinctes. Une donnée absente/périmée/bloquée par licence **dégrade la confiance, jamais le risque** (« on ne sait pas » ≠ « pas de risque »). |
| **estimé ≠ vérifié** | `data_status ∈ {verified, estimated, manual, inferred}` ; `verified` exige `source_release_id NOT NULL` (CHECK `*_sourced_check`). |
| **étape (stage)** | Maillon ordonné de la chaîne de valeur (`processing_stages`, `stage_order`, `is_upstream`). Les étapes **ne se moyennent jamais**. |
| **source_release** | Version immuable d'une source (Evidence Kernel). Tout fait « vérifié » ou tout prix de marché la référence. |
| **Deux surfaces « matières »** | `/materials` (public, statique, 34 minerais démo) **≠** `/crma` (tenant, exposition Article 24 auditable). Elles ne partagent aucune donnée aujourd'hui. |

---

## 4. Classement des ressources du périmètre MODULE 2

> La **présence dans le modèle** est un fait d'architecture (vérifié). Le **statut réglementaire** (réellement sur l'Annexe CRMA, EUDR, etc.) est établi séparément et fait foi dans `REGULATORY_SOURCE_MATRIX.md` — **le snapshot n'est pas une source réglementaire** (il s'auto-déclare illustratif « à remplacer par un flux vérifié avant toute utilisation normative »).

### 4.1 Ressources DÉJÀ représentées dans le modèle (extension = données, pas architecture)

Présentes dans le snapshot `crm_full_34_snapshot_2026-06-30.json` et scorables par le moteur existant dès que des observations sourcées sont ajoutées :

| Ressource | `id` snapshot | Catégorie snapshot | Statut réglementaire **confirmé** (→ `REGULATORY_SOURCE_MATRIX.md`) |
|---|---|---|---|
| Hélium | `helium` | Gaz industriels | CRMA **Critique (Annexe II)** ; **PAS Stratégique** — `confirmed` |
| Charbon à coke | `coking-coal` | Combustibles fossiles / Sidérurgie | CRMA **Critique (Annexe II)** ; **PAS un bien CBAM** — `confirmed` |
| Silicium métal | `silicon-metal` | Métaux technologiques / Semi-conducteurs | CRMA **Stratégique (Annexe I) ET Critique (Annexe II)** — `confirmed` |
| Terres rares (lourdes/légères) | `heavy-ree`, `light-ree` | Terres rares | CRMA (listées ; citation d'annexe verbatim = UNRESOLVED) |

**Conséquence :** silicium métal, charbon à coke et hélium sont **reclassés « déjà couverts par le modèle CRMA »** (statut réglementaire désormais confirmé par sources institutionnelles UE). Ils n'appellent aucune table neuve — seulement des `material_stage_observations` / `material_market_observations` sourcées et, si besoin, des `material_group_members` supplémentaires. **Nuance de classement :** l'hélium est le **seul** gaz industriel du périmètre qui soit CRMA-critique (néon mis à part) ; xénon/krypton/argon **ne sont pas** listés CRMA.

### 4.2 Ressources RÉELLEMENT NOUVELLES (absentes du modèle et du snapshot)

À introduire comme **nouveaux `material_id` + nouveaux `material_groups` + nouveaux vocabulaires d'étapes** — toujours dans le modèle 034, **sans architecture parallèle** :

- **Gaz industriels** : xénon, krypton, argon _(hélium déjà présent — cf. 4.1)_. **Non CRMA** — régis via REACH/CLP.
- **Énergie & combustibles** : hydrogène, uranium, GNL _(charbon à coke déjà présent — cf. 4.1)_.
- **Biomasse & fibres** : bois, caoutchouc naturel, coton, lin, chanvre.

**Cadres réglementaires distincts (confirmés — ne pas les fondre dans « CRMA ») :**
- **Uranium → Euratom / ESA** (pas CRMA) — cadre légal distinct.
- **Hydrogène → RFNBO (RED III) + bien CBAM** (pas matière première CRMA).
- **Bois + caoutchouc naturel → EUDR (Annexe I, dans le périmètre, application 30/12/2026)** ; **coton, lin, chanvre → hors EUDR.**
- **GNL/gaz → sécurité d'appro. gaz (Reg (UE) 2017/1938).**

Chaînes de valeur **spécifiques** requises (les 8 étapes actuelles sont **propres aux aimants** — `extraction→…→magnet→product` : les réutiliser telles quelles pour un gaz ou une fibre serait une erreur de modélisation) :
- gaz rares → séparation de l'air / captage sur gaz naturel (vocabulaire à définir) ;
- biomasse/fibres → culture/récolte → transformation → fibre/produit ;
- GNL/uranium/charbon à coke → chaînes combustible propres.

### 4.3 Ressources à l'interface d'autres modules (délimitation)

| Ressource | Angle MODULE 2 (dépendance d'appro.) | Angle d'un AUTRE module (hors MODULE 2) |
|---|---|---|
| Hydrogène, GNL, uranium, charbon à coke | dépendance / concentration / substituabilité (modèle 034) | **combustion / Scope 2** = module Énergie (`031/033`, porteurs `electricity\|gas\|heat\|steam\|cooling\|other` — **pas** de commodité combustible) |
| Bois, caoutchouc, coton, lin, chanvre | dépendance d'approvisionnement (modèle 034) | **empreinte eau** = module Eau (`036/037`) ; **biodiversité / TNFD** = module Nature (`038/039`) |

**Décision ouverte** (→ `MODULE2_DECISIONS.md`) : un combustible (hydrogène/GNL/uranium) est-il modélisé comme **matière** (034) pour l'angle dépendance, tout en restant un **porteur** (031) pour l'angle Scope 2 ? Aucun pont table « porteur énergie ↔ commodité stratégique » n'existe aujourd'hui.

---

## 5. Ce qui manque réellement (gaps — à construire, pas à réutiliser)

Confirmés par l'inventaire architecture (file:line) :

1. **Aucune table de référence `materials`** : `material_id` est du texte libre non validé ; `033_material_reference_crma.sql` jamais mergée (`034:48-56`). Pas de garantie qu'un `material_id` soit connu, pas de métadonnée canonique.
2. **Aucune liste canonique côté API** : seul le snapshot **frontend** énumère 34 minerais ; gaz/biomasse/combustibles en sont absents.
3. **Aucun groupe de famille** `industrial_gases` / `biomass_fibers` / `energy_fuels` : `material_groups` existe comme mécanisme mais 034 ne sème **aucun** groupe global (seulement les 8 étapes).
4. **Aucun jeu d'étapes alternatif** : `processing_stages` ne contient que la chaîne aimant à 8 étapes.
5. **Aucune table de risque-pays / gouvernance** : le scoring n'utilise qu'un **binaire UE/hors-UE codé en dur** (`scoring.py:100`). Tout pondérateur géopolitique par pays devra être **construit et sourcé** (miroir de `water_risk_areas`) — **jamais inventé**.
6. **Aucun pont combustible ↔ commodité** : l'énergie (031) ne modélise que des porteurs Scope 2.
7. **Aucune surface produit « ressources »** : `lib/product-modules.ts` a 8 modules, aucun pour les ressources stratégiques.
8. **`iros.origin_domain`** exigerait un nouveau littéral `strategic_resources` (petite migration `DROP/ADD CONSTRAINT`, non-propriétaire, motif `040:616`) — sauf à réutiliser le domaine `crma`.

**Piège de réutilisation n°1 (à répéter partout) :** `NOMINAL_WEIGHTS`, `STAGE_ORDER`, `UPSTREAM_STAGES`, `EU_COUNTRY_CODES` de `scoring.py` sont **spécifiques aux aimants** — le moteur doit être **paramétré par famille**, pas cloné à l'identique.

---

## 6. Hors périmètre (strict)

- **Aucune** recette, formulation, proportion, procédure de fabrication ou paramètre opérationnel — pour toute ressource, y compris défense/spatial. L'angle défense/spatial se limite à la **classification supply-chain** (une substance est-elle listée/contrôlée, sous quel instrument) — jamais de contenu technique/armes.
- **Nucléaire** : angle dépendance d'approvisionnement (uranium) uniquement ; aucun paramètre technique.
- **Géopolitique prédictive / scénarios génératifs** : hors périmètre (violerait « no uncited normative answer »).
- **Eau / biodiversité** des biomasses : modules Eau/Nature existants, pas MODULE 2.
- **Flux de prix « live » sans licence** ; **sparklines/séries temporelles à partir d'un seul point** : interdits (cf. contrainte /materials).
- **Pivot « plateforme d'intelligence »** : la mission conformité reste le cœur (décision de périmètre déjà actée).

---

## 7. UNRESOLVED (à confirmer avant l'architecture définitive)

- Statut réglementaire **primaire** exact de chaque ressource → `REGULATORY_SOURCE_MATRIX.md` (agents en cours).
- Licences réelles des datasets candidats → `DATA_SOURCE_AND_LICENSE_MATRIX.md` (agents en cours).
- Formules retenues/rejetées et tests → `METHODOLOGY_AND_ALGORITHMS.md` (agents en cours).
- Décision « combustible = matière et/ou porteur » (§4.3).
- Introduire ou non une vraie table de référence `materials` (gap n°1) — arbitrage architecture.
