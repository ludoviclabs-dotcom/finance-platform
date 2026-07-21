# MODULE 2 — Ressources stratégiques & dépendances industrielles étendues
## SOURCE OF TRUTH (vérité d'architecture et de périmètre)

> **Phase :** cadrage / inventaire de l'existant / validation méthodologique, **arbitrage Ludo appliqué** (D-1 à D-6, `MODULE2_DECISIONS.md` §2).
> **Date :** 2026-07-22 · **Branche :** `docs/strategic-resources-cadrage` · **Base :** `origin/master` `2175f89` (schéma `041`).
> **Statut :** DRAFT de cadrage + arbitrages structurants. Aucun code, aucune migration, aucune route, aucune interface produits ici.
> Ce document fixe **ce qui existe déjà**, **ce qui serait réellement nouveau**, et **ce qui a été décidé mais pas encore créé** (`resource_catalog`, `resource_aliases`, `company_resource_exposure_links`, `resource_stage_families`) ; il ne conçoit pas l'architecture détaillée (voir `MODULE2_HANDOFF.md` → NEXT_ACTION).

Ce fichier est le point d'ancrage des cinq autres livrables de cadrage :
- `REGULATORY_SOURCE_MATRIX.md` — vérité réglementaire (CRMA, EUDR, REACH, CLP, dual-use, ESRS).
- `DATA_SOURCE_AND_LICENSE_MATRIX.md` — datasets, millésimes, licences, droits d'usage.
- `METHODOLOGY_AND_ALGORITHMS.md` — formules, unités, biais, tests, formules rejetées.
- `MODULE2_DECISIONS.md` — décisions de cadrage, **arbitrages structurants Ludo D-1 à D-6**, décisions encore ouvertes.
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

### 2.2 Nouveaux objets d'architecture DÉCIDÉS (arbitrage Ludo — pas encore créés)

Ces objets sont **actés par `MODULE2_DECISIONS.md` §2 (D-1 à D-6)**. Ils n'existent pas dans le dépôt à ce stade — cible de la phase d'architecture définitive, pas du cadrage.

| Objet | Rôle | Décision | Contrainte |
|---|---|---|---|
| `resource_catalog` | Référentiel canonique de ressources | D-2 | Coexiste avec `material_id TEXT` legacy — ne le remplace pas. |
| `resource_aliases` | Table d'alias (`legacy_material_id`/CAS/EC/HS-CN/REACH/internal/other) | D-2 | Rapprochement progressif ; aucune réécriture brutale des tables CRMA existantes. |
| `company_resource_exposure_links` | Pont d'exposition ressource → objet existant (`bom_item`/`purchase_line`/`energy_activity`/`water_activity`/`supplier_declaration`/`manual_assessment`) | D-1 | Le module Resources orchestre, ne remplace ni Energy ni CRMA ni Procurement. |
| Modèle multi-rôle (`material`/`feedstock`/`energy_carrier`/`process_input`/`industrial_gas`/`nuclear_fuel`/`biomass`/`water`) | Une ressource porte plusieurs rôles, jamais un choix exclusif | D-1 | Non exclusif par construction (même principe que critique/stratégique en 034). |
| `resource_stage_families` / `resource_stage_applicability` (nom à trancher) | Vocabulaire d'étapes par famille de ressource | D-6 | Étend `processing_stages`/`stage_code`/`stage_order`/`is_upstream` — DB-driven, jamais codé en dur. |
| Littéral `iros.origin_domain='strategic_resources'` | Lignée IRO pour ressources étendues non-CRMA | D-5 | Extension de contrainte SQL **documentée comme migration future**, pas exécutée ici. |

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
| **rôle (multi-rôle)** | Une ressource peut porter plusieurs rôles simultanément (`material`/`feedstock`/`energy_carrier`/`process_input`/`industrial_gas`/`nuclear_fuel`/`biomass`/`water`), jamais un choix exclusif — décision D-1. |
| **`resource_catalog` / `resource_aliases`** | Référentiel canonique **décidé** (D-2), pas encore créé. Coexiste avec `material_id TEXT` legacy via alias — ne le remplace jamais brutalement. |
| **`third_country_dependency`** | Nom honnête de la seule dimension pays du MVP (part hors UE) — **ne jamais dire « country risk score »** (D-3). Un futur risque-pays sourcé (WGI) est gated, pas construit. |

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

**Décision D-1 (Ludo, `MODULE2_DECISIONS.md` §2) :** un combustible n'est **pas** un choix exclusif matière-ou-porteur — modèle **multi-rôle**. Hydrogène/GNL/uranium peuvent porter le rôle `energy_carrier` (Energy, 031, Scope 2) **et** `feedstock`/`nuclear_fuel` (dépendance, `resource_catalog`) simultanément. Le pont **`company_resource_exposure_links`** (§2.2) reliera les deux angles — décidé, pas encore créé.

---

## 5. Ce qui manque réellement (gaps — à construire, pas à réutiliser)

Confirmés par l'inventaire architecture (file:line). **Statut mis à jour après arbitrage Ludo** (`MODULE2_DECISIONS.md` §2) — la direction est tranchée pour la plupart ; rien n'est encore construit.

1. **~~Aucune table de référence `materials`~~ → DÉCIDÉ (D-2) :** créer `resource_catalog` + `resource_aliases`, `material_id` legacy préservé. `033_material_reference_crma.sql` reste non mergée (`034:48-56`) — le nouveau référentiel ne la ressuscite pas, il la remplace conceptuellement.
2. **Aucune liste canonique côté API** : seul le snapshot **frontend** énumère 34 minerais ; gaz/biomasse/combustibles en sont absents. `resource_catalog` (D-2, gap #1) est la réponse architecturale — reste à peupler.
3. **Aucun groupe de famille** `industrial_gases` / `biomass_fibers` / `energy_fuels` : `material_groups` existe comme mécanisme mais 034 ne sème **aucun** groupe global (seulement les 8 étapes). **Pas directement résolu par D-1..D-6** — reste un item d'implémentation en architecture (semer les groupes de famille).
4. **~~Aucun jeu d'étapes alternatif~~ → DÉCIDÉ (D-6) :** étendre `processing_stages`/`stage_code`/`stage_order`/`is_upstream` + nouvelle table `resource_stage_families`/`resource_stage_applicability` (nom à trancher), DB-driven, jamais codé en dur.
5. **~~Aucune table de risque-pays / gouvernance~~ → DÉCIDÉ (D-3) :** MVP = garder le binaire UE/hors-UE (`scoring.py:100`), **renommé** `third_country_dependency` (jamais « country risk score »). v2 = WGI sourcé, strictement gated (licence confirmée, `source_release`, confiance séparée) — non construit tant que ces conditions ne sont pas réunies.
6. **~~Aucun pont combustible ↔ commodité~~ → DÉCIDÉ (D-1) :** modèle multi-rôle + `company_resource_exposure_links` reliant ressource ↔ `bom_item`/`purchase_line`/`energy_activity`/`water_activity`/`supplier_declaration`/`manual_assessment`.
7. **Aucune surface produit « ressources »** : `lib/product-modules.ts` a 8 modules, aucun pour les ressources stratégiques. **Non adressé par l'arbitrage** — reste un gap pour la phase produit/architecture.
8. **~~`iros.origin_domain` exigerait un nouveau littéral~~ → DÉCIDÉ (D-5) :** ajouter `strategic_resources` en plus de `crma` (routage selon l'origine réelle du signal). Migration `DROP/ADD CONSTRAINT` (motif `040:616`) **documentée en architecture, pas exécutée** dans cette phase.

**Piège de réutilisation n°1 (à répéter partout, toujours vrai après arbitrage) :** `NOMINAL_WEIGHTS`, `STAGE_ORDER`, `UPSTREAM_STAGES`, `EU_COUNTRY_CODES` de `scoring.py` sont **spécifiques aux aimants** — le moteur doit être **paramétré par famille**, pas cloné à l'identique (CD-2).

---

## 6. Hors périmètre (strict)

- **Aucune** recette, formulation, proportion, procédure de fabrication ou paramètre opérationnel — pour toute ressource, y compris défense/spatial. L'angle défense/spatial se limite à la **classification supply-chain** (une substance est-elle listée/contrôlée, sous quel instrument) — jamais de contenu technique/armes.
- **Nucléaire** : angle dépendance d'approvisionnement (uranium) uniquement ; aucun paramètre technique.
- **Géopolitique prédictive / scénarios génératifs** : hors périmètre (violerait « no uncited normative answer »).
- **Eau / biodiversité** des biomasses : modules Eau/Nature existants, pas MODULE 2.
- **Flux de prix « live » sans licence** ; **sparklines/séries temporelles à partir d'un seul point** : interdits (cf. contrainte /materials).
- **Pivot « plateforme d'intelligence »** : la mission conformité reste le cœur (décision de périmètre déjà actée).

---

## 7. UNRESOLVED

**Toutes les décisions d'architecture de cette liste d'origine sont tranchées** (D-1 à D-6, `MODULE2_DECISIONS.md` §2) : combustible = matière et/ou porteur (§4.3, D-1) ; table de référence `resource_catalog` (§5 gap #1, D-2). Les statuts réglementaires et licences sont établis dans `REGULATORY_SOURCE_MATRIX.md` / `DATA_SOURCE_AND_LICENSE_MATRIX.md` avec leurs propres UNRESOLVED résiduels (manques de source primaire réels, pas des choix) — voir `MODULE2_HANDOFF.md` §5 pour la liste consolidée. Les formules sont validées dans `METHODOLOGY_AND_ALGORITHMS.md`.

Ne reste UNRESOLVED **dans ce document** que ce qui dépend d'une décision non couverte par D-1 à D-6 : gap #3 (semis des groupes de famille) et gap #7 (surface produit « ressources ») — ce sont des items d'implémentation d'architecture, pas des inconnues de source.
