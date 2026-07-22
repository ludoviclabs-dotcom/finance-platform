# MODULE 2 — PACKS FUTURS (préparation, NON codés)

> **Objet :** préparer — **sans les implémenter** — les prochains packs de ressources.
> **Date :** 2026-07-22 · **Base :** `origin/master` = `6479e11` (schéma prod `043`).
> **Statut :** cadrage préparatoire. **Aucun code, aucune migration, aucune donnée** produits ici.
> **Interdiction en vigueur :** ne démarrer aucun pack sans **décision explicite de Ludo**, une PR à la fois.

Ce document transforme les intentions en **spécifications prêtes à arbitrer** : ancrage réglementaire
confirmé, données & licences, insertion dans le modèle existant (famille / rôles / régime / étapes),
notes de méthode, garde-fous, préconditions de démarrage. Sources : `MODULE2_SOURCE_OF_TRUTH.md` §4-6,
`REGULATORY_SOURCE_MATRIX.md`, `DATA_SOURCE_AND_LICENSE_MATRIX.md`, `METHODOLOGY_AND_ALGORITHMS.md`,
`MODULE2_DECISIONS.md` (D-1..D-6).

---

## 0. Principe directeur : le schéma actuel ABSORBE déjà ces packs

Les migrations `042`/`043` ont été conçues **génériques**. La plupart des packs ci-dessous sont
**des données + une paramétrisation par famille**, **pas** une nouvelle architecture.

- **Familles** (`resource_catalog.primary_family`, CHECK 042) : `industrial_gas`, `biomass_fibre`,
  `energy_fuel`, `critical_raw_material`, `other`. → bois/caoutchouc/fibres = `biomass_fibre` ;
  uranium/GNL = `energy_fuel`.
- **Régimes** (`resource_regulatory_statuses.regime`, CHECK 042) : `crma`, `eudr`, `reach`, `clp`,
  `red_iii`, `cbam`, `euratom`, `dual_use`, `gas_sos`, `esrs`, `other`. → **EUDR, Euratom, dual_use,
  gas_sos existent déjà** : aucun ALTER pour les statuts.
- **Étapes DB-driven** : `resource_supply_observations.stage_code` est un TEXT libre → chaque famille
  pose son vocabulaire d'étapes **par convention documentée**, jamais en clonant les 8 étapes aimant
  (`extraction→…→magnet→product`) de `crma/scoring.py` (piège de réutilisation n°1).
- **Moteur** `services/resources/scoring.py` : réutilisé et **paramétré par famille** — jamais cloné.
- **Expositions** `company_resource_exposure_links` : couvre déjà BOM/achat/énergie/eau/déclaration/manuel.
- **Preuve & licence** : Evidence Kernel + `license_policy.evaluate` → source bloquée **dégrade la
  confiance, jamais le risque**.

**Ce qui exigerait réellement une migration nouvelle (à trancher pack par pack) :**
1. la table d'étapes dédiée `resource_stage_applicability` (D-6) **si** l'on veut piloter les étapes par
   table plutôt que par convention `stage_code` ;
2. l'élargissement `iros_origin_domain_check` (+`strategic_resources`, D-5) **si** un pack doit émettre
   des signaux IRO ;
3. rien d'autre par défaut.

> **Règle d'or (CD-2) :** paramétrer par famille, **jamais** cloner `NOMINAL_WEIGHTS`/`STAGE_ORDER`/
> `UPSTREAM_STAGES`/`EU_COUNTRY_CODES`. Une fibre, un gaz liquéfié ou un combustible nucléaire n'ont pas
> la chaîne de valeur d'un aimant.

---

## 1. Pack **BOIS & CAOUTCHOUC (EUDR)** — candidat n°1

Cadre réglementaire **daté et contraignant**, régime `eudr` **déjà** au schéma, données socle **ouvertes**.

- **Ressources :** bois (grumes, sciages, panneaux, pâte/papier) ; caoutchouc naturel.
- **Ancrage :** **EUDR — Reg (UE) 2023/1115**, Annexe I (bois + caoutchouc **dans le périmètre**),
  diligence raisonnée + géolocalisation parcelles + « zéro déforestation » (césure 31/12/2020). Régime
  `regime='eudr'`, `listing_status='in_scope'`, `certainty='confirmed'` **si** `source_release_id`.
  - **UNRESOLVED :** citation verbatim Annexe I (codes SH) ; date d'application définitive post-report (confirmer au démarrage).
- **Données :** ouvertes = FAOSTAT (production/commerce bois & caoutchouc), Eurostat, World Bank WGI
  (risque-pays gated) ; bloquées → confiance = **ANRPC** (caoutchouc), indices prix privés.
- **Modèle :** famille `biomass_fibre` ; rôles `biomass`/`feedstock` ; expositions `purchase_line`/`bom_item`/
  `supplier_declaration` ; **étapes** `culture_plantation → récolte → transformation_primaire → produit_dérivé`.
- **Méthode :** HHI par étape ; `third_country_dependency` ; intensité ressource (kg/produit, m³/produit) si
  dénominateur documenté ; **aucun** facteur carbone codé en dur (D-4). Eau = module Eau ; déforestation/
  biodiversité = angle Nature + EUDR (ne pas dupliquer).
- **Migration nouvelle ?** En principe **non** (régime + famille déjà là).

---

## 2. Pack **FIBRES NATURELLES**

**Distinction cruciale :** coton, lin, chanvre sont **HORS EUDR** (ne pas ranger sous `eudr`). Ancrage
**ESRS E5** + REACH/CLP sur les intrants de transformation.

- **Ressources :** coton, lin, chanvre (extensible jute/laine, à arbitrer).
- **Ancrage :** **ESRS E5** (ressource entrante) ; REACH/CLP pour auxiliaires. Régime `esrs` (et `reach`/
  `clp` selon la chaîne) ; **jamais** `eudr`.
  - **UNRESOLVED :** standard volontaire « VS » non publié ; ESRS simplifiés non adoptés (O-9).
- **Données :** ouvertes = FAOSTAT (surfaces/production), Eurostat, WGI ; bloquées → confiance = **ICAC**
  (coton), indices textiles privés.
- **Modèle :** famille `biomass_fibre` ; rôles `biomass`/`feedstock` ; **étapes** `culture → récolte →
  égrenage/rouissage → filature/fibre → produit`.
- **Méthode :** HHI par étape ; intensité (kg fibre/produit) si dénominateur documenté ; substituabilité
  (synthétiques/recyclées) **séparée** (maturité + pénalité, jamais fusionnée au risque).
- **Migration nouvelle ?** **Non** a priori.

---

## 3. Pack **URANIUM**

**Distinction cruciale :** relève d'**Euratom / ESA**, **PAS du CRMA**. Régime `euratom` **déjà** au
schéma. Angle strictement **dépendance d'approvisionnement** — aucun paramètre technique nucléaire.

- **Ressources :** uranium naturel ; concentrés (U₃O₈) ; conversion/enrichissement au titre de la
  concentration d'appro. seulement.
- **Ancrage :** **Traité Euratom** + **Agence d'approvisionnement (ESA)** (diversification, rapports
  annuels). Régime `regime='euratom'` ; volet `dual_use` **existence-seule** (Annexe I Reg (UE) 2021/821).
  `certainty='confirmed'` avec `source_release_id` (rapport ESA).
  - **UNRESOLVED :** millésime rapport ESA ; statut dual-use par sous-forme (vérification manuelle, garde-fou).
- **Données :** ouvertes/officielles = **Euratom ESA**, WGI, éventuellement OCDE-AEN/AIEA Red Book (licence
  à vérifier) ; bloquées → confiance = **UxC/TradeTech** (prix) → prix uranium = faible-confiance-par-licence.
- **Modèle :** famille `energy_fuel` ; rôle **`nuclear_fuel`** (D-1, déjà dans `crel_role_check`) ;
  expositions `purchase_line`/`energy_activity`/`manual` ; **étapes cycle combustible** `extraction →
  conversion → enrichissement → fabrication_assemblage`.
- **Méthode :** HHI par étape (extraction ET enrichissement, **jamais moyennées**) ; `third_country_dependency`.
- **GARDE-FOUS stricts :** **aucun** paramètre technique/fissile au-delà de la concentration d'appro. publique ;
  dual-use = classification d'existence seulement.
- **Migration nouvelle ?** **Non** (régime `euratom` + rôle `nuclear_fuel` déjà là).

---

## 4. Pack **GNL (gaz naturel liquéfié)**

- **Ressources :** GNL / gaz naturel (vecteur d'approvisionnement et intrant).
- **Ancrage :** **sécurité d'appro. gaz — Reg (UE) 2017/1938** ; **objectifs de remplissage stockages —
  Reg (UE) 2022/1032**. Régime `regime='gas_sos'` **déjà** prévu. Le gaz naturel **n'est pas** un bien CBAM.
  - **UNRESOLVED :** référence du règlement modificatif stockage 2026 ; droit d'usage dérivé exact de la
    Transparency Platform **ENTSOG** (défaut = bloqué).
- **Données :** ouvertes = Eurostat (flux gaz UE), WGI ; bloquées → confiance = **ENTSOG** (défaut bloqué),
  **IEA** (rapports gaz), indices prix (TTF privés).
- **Modèle :** famille `energy_fuel` ; rôles `energy_carrier` **et** `feedstock` (D-1) ; pont **`energy_activity`**
  (Scope 2, module Énergie) **sans recalcul carbone** (D-4) ; **étapes** `production → liquéfaction →
  transport_maritime → regazéification → distribution`.
- **Méthode :** HHI par étape (concentration terminaux/origines) ; `stock_coverage_days` pertinent ;
  `third_country_dependency`. Combustion/Scope 2 = module Énergie, pas Module 2.
- **Migration nouvelle ?** **Non** a priori.

---

## 5. Pack **DÉFENSE / SPATIAL — SUPPLY-CHAIN UNIQUEMENT**

**Pas une famille : une LENTILLE de classification supply-chain** sur des ressources déjà cataloguées.
**Périmètre le plus strict du module.**

- **Objet :** pour une ressource **déjà présente** (hélium, xénon, silicium, terres rares, titane,
  tungstène…), son **exposition sectorielle** défense/spatial **au seul titre de la dépendance d'appro.**
  et de la **classification réglementaire** (listée/contrôlée, sous quel instrument).
- **Ancrage :** **dual-use — Reg (UE) 2021/821** (régime `dual_use` **déjà** prévu, **existence-seule**) ;
  le cas échéant EDIRPA/ASAP (résilience industrielle) au titre supply-chain. `resource_sector_uses.use_label`
  = classification (« aérospatial », « défense ») ; `sector_code` normalisé.
- **Données :** sources **ouvertes/officielles** de classification uniquement ; **aucune** base propriétaire
  d'inventaire militaire.
- **Modèle :** **aucune famille nouvelle** — réutilise `resource_sector_uses` (déjà en 042) + éventuel statut
  `regime='dual_use'`. **Aucune colonne technique n'existe par conception** (042 §D).
- **GARDE-FOUS ABSOLUS (`SOURCE_OF_TRUTH.md` §6, `RLS_AND_SECURITY.md` §7) :**
  - **INTERDIT** : recette, formulation, proportion, procédé, instruction de propergol, paramètre de
    propulsion, `kgCO2e/kN`, tout paramètre opérationnel d'arme/lanceur, tout calcul carbone spatial/défense (D-4).
  - **AUTORISÉ** : « telle substance est-elle listée/contrôlée, sous quel instrument » + concentration
    d'appro. + substituabilité, au niveau supply-chain.
  - Dual-use = classification d'existence ; ne jamais reproduire le texte de l'Annexe I.
- **Migration nouvelle ?** **Non** — pack de données + classification sur l'existant. Le plus léger en schéma,
  le plus exigeant en revue de contenu.

---

## 6. « Prêt à démarrer » (checklist commune, AVANT toute PR de pack)

1. **Décision explicite de Ludo** nommant le pack, une PR à la fois.
2. **Sources primaires confirmées** pour chaque fait `confirmed` (sinon `probable`/`unresolved`) ; licences
   tranchées (ouverte → calcul ; bloquée → confiance dégradée, jamais le risque).
3. **Vocabulaire d'étapes de la famille** arbitré (convention `stage_code` **ou** table
   `resource_stage_applicability`) — jamais cloner les étapes aimant.
4. **Décision IRO** : le pack émet-il des signaux ? Si oui, prévoir l'élargissement `iros_origin_domain_check`
   (+`strategic_resources`, D-5, `DROP/ADD CONSTRAINT` documentée) ; sinon s'abstenir.
5. **Paramétrisation moteur par famille** (poids, étapes, pays UE) — jamais de clone des constantes CRMA.
6. **Revue de contenu Défense/Spatial** systématique si le pack touche des ressources dual-use.

---

## 7. Ce que ce document NE fait PAS

- ❌ Aucun `resource_catalog`/`resource_regulatory_statuses`/observation semé.
- ❌ Aucune migration `044+` créée.
- ❌ Aucun code `services/resources/*`, `routers/resources.py`, frontend, ni test.
- ❌ Aucun démarrage de pack — ils restent **ROADMAP** tant que Ludo n'en autorise pas un explicitement.

Priorité recommandée : **EUDR (bois/caoutchouc)** → fibres naturelles / uranium / GNL selon la valeur
métier → Défense/Spatial en lentille transverse.
