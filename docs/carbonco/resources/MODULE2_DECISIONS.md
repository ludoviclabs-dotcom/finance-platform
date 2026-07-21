# MODULE 2 — Décisions

> **Phase 1 (cadrage) :** TERMINÉE — 2026-07-22. **Phase 2 (arbitrage Ludo) :** TERMINÉE — 2026-07-22.
> Ce registre distingue trois strates : **§1 décisions de cadrage** (tranchées par la preuve — code lu, sources primaires, phase 1) ; **§2 arbitrages structurants** (décidés explicitement par Ludo, phase 2 — **D-1 à D-6**, la strate qui fait foi pour l'architecture) ; **§3 décisions encore ouvertes** (reste à trancher en phase d'architecture). Aucune décision ici n'autorise à coder, migrer ou modifier `apps/`.

---

## 1. Décisions de cadrage (étayées par la preuve, phase 1)

> Renommées **CD-1 à CD-9** (Cadrage-Décision) pour éviter toute collision avec la numérotation **D-1 à D-6** des arbitrages Ludo au §2, qui fait désormais foi pour tout renvoi futur « D-x ».

| # | Décision | Fondement |
|---|---|---|
| **CD-1** | **MODULE 2 est une EXTENSION du modèle d'exposition matières (migration 034 + `scoring.py`), PAS une architecture parallèle.** | `material_id TEXT` sans FK, modèle agnostique à la matière (inventaire architecture). Règle non négociable du chantier : « réutiliser les modules existants, pas d'architecture parallèle ». |
| **CD-2** | **Un seul moteur de score, RÉUTILISÉ et PARAMÉTRÉ par famille — jamais cloné.** | `NOMINAL_WEIGHTS`/`STAGE_ORDER`/`UPSTREAM_STAGES`/`EU_COUNTRY_CODES` de `scoring.py` sont **spécifiques aux aimants** : les copier tels quels mis-modéliserait gaz/biomasse/combustibles. |
| **CD-3** | **Réutiliser l'Evidence Kernel + `license_policy.evaluate` — aucun 2ᵉ modèle de licence ni table d'observations parallèle.** | Les 8 booléens de `source_registry` couvrent déjà ingest/store/display/derived/commercial/redistribution/attribution. |
| **CD-4** | **Conserver les invariants : risque ≠ confiance ; manquant ≠ zéro ; sourcé-ou-avoué ; jamais de fusion inter-étapes ; jamais présenté comme note officielle UE.** | Prouvé dans le code + le schéma (deux colonnes risk/confidence, `*_sourced_check`, `max` inter-étapes, `DISCLAIMER`). |
| **CD-5** | **Reclassements réglementaires actés** (sources institutionnelles UE, cf. `REGULATORY_SOURCE_MATRIX.md`) : Hélium = CRMA **Critique** (pas Stratégique) ; Silicium métal = **Stratégique + Critique** ; Charbon à coke = **Critique** (pas CBAM) ; **Uranium = Euratom/ESA (pas CRMA)** ; **Hydrogène = RFNBO + CBAM (pas matière première CRMA)** ; **Xénon/Krypton/Argon = non-CRMA** ; **Bois + Caoutchouc = EUDR (dans le périmètre)** ; **Coton/Lin/Chanvre = hors EUDR**. | Reg (UE) 2024/1252, 2023/1115, 2023/2413, 2023/956, Traité Euratom. |
| **CD-6** | **Sources ouvertes retenues** (stockage+affichage+dérivé, avec attribution) : USGS (domaine public), JRC RMIS/CRM Study 2023, Eurostat, FAOSTAT, World Bank WGI, Euratom Supply Agency. **Sources propriétaires bloquées** (`derived_use=false`) : IEA, BGS WMS, PRAs de prix (LME/Platts/Argus/Fastmarkets/ICIS), rapports gaz industriels, ICAC, ANRPC, UxC/TradeTech, ENTSOG. | `DATA_SOURCE_AND_LICENSE_MATRIX.md`. |
| **CD-7** | **Toute donnée bloquée par licence dégrade la CONFIANCE, jamais le RISQUE ; jamais d'affichage brut.** Conséquence directe : xénon/krypton/argon (prix/volumes), prix coton/caoutchouc/uranium/silicium/GNL seront **faible-confiance-par-licence**, pas faible-risque. | Règle de conception CarbonCo + inventaire licences. |
| **CD-8** | **ESRS E5** (utilisation des ressources & économie circulaire) est le **standard d'information d'ancrage** de MODULE 2 ; E2 pour l'angle substances REACH ; ESRS 1/2 pour le screening IRO de double matérialité. **Pas E1.** | `REGULATORY_SOURCE_MATRIX.md` §F. |
| **CD-9** | **Garde-fou de sécurité permanent :** aucune recette, formulation, proportion, procédure de fabrication ni paramètre opérationnel ; défense/spatial = **classification supply-chain / listage uniquement**. | Brief + politique. |

---

## 2. Arbitrages structurants Ludo (phase 2 — D-1 à D-6, **font foi**)

Reçus le 2026-07-22, en réponse aux questions bloquantes Q-1 à Q-6 du cadrage (§4 de `MODULE2_HANDOFF.md`, phase 1). **Ces décisions engagent l'architecture définitive** ; aucun des objets qu'elles nomment (`resource_catalog`, `resource_aliases`, `company_resource_exposure_links`, `resource_stage_families`) n'est créé dans cette phase — ce sont des cibles d'architecture, pas du code.

### D-1 — Combustible, matière et porteur énergétique : modèle multi-rôle

**Décision :** une ressource peut porter **plusieurs rôles simultanément**, jamais un choix exclusif :
`material` · `feedstock` · `energy_carrier` · `process_input` · `industrial_gas` · `nuclear_fuel` · `biomass` · `water`.

**Exemples de lecture :**
- GNL utilisé comme énergie → reste dans **Energy / `energy_activities`**.
- GNL suivi comme dépendance stratégique → **`resource_catalog` + lien d'exposition**.
- Hydrogène utilisé comme combustible → **Energy**.
- Hydrogène utilisé comme matière première/feedstock → **`resource_catalog`**.
- Charbon à coke → **CRMA + énergie industrielle**, selon le cas d'usage.

**Implémentation future (architecture, pas cette phase) :** un pont d'exposition **`company_resource_exposure_links`** reliant une ressource à un objet existant : `bom_item` · `purchase_line` · `energy_activity` · `water_activity` · `supplier_declaration` · `manual_assessment`.

**Principe directeur :** le module Resources ne **remplace** ni Energy, ni CRMA, ni Procurement. **Il orchestre les dépendances** entre eux.

*Résout : Q-1 / O-1 (§3).* *Révise : `MODULE2_SOURCE_OF_TRUTH.md` §4.3, gap #6.*

### D-2 — Référentiel canonique

**Décision :** créer un référentiel canonique **`resource_catalog`**, **sans casser le modèle existant**.

- Les anciens `material_id TEXT` (034, `material_mappings`) **restent valides comme identifiants legacy**.
- Créer un mécanisme d'alias **`resource_aliases`** portant : `legacy_material_id` · `CAS` · `EC` · `HS/CN` · `REACH` · `internal` · `other`.

**Règle non négociable :** **aucune migration ne doit réécrire brutalement les anciennes tables CRMA.** Le rapprochement se fait par alias et par mapping progressif — jamais par ALTER destructif ou renommage en masse.

*Résout : Q-2 / O-2 (§3).* *Révise : `MODULE2_SOURCE_OF_TRUTH.md` §5, gaps #1/#2.*

### D-3 — Risque-pays

**Décision MVP :** **ne pas créer de score risque-pays inventé.** Pour la première version, utiliser une dimension simple et honnête : **`third_country_dependency`** (déjà existante, `scoring.py`) — exposition à des pays hors UE ou à des zones définies, **sans prétendre produire un score politique complet**. **Ne jamais l'appeler « country risk score ».**

**Décision v2 :** préparer l'architecture pour intégrer plus tard un indicateur sourcé (ex. **World Bank WGI**), **uniquement si** :
- source officielle vérifiée ;
- licence confirmée ;
- année disponible ;
- méthodologie documentée ;
- `source_release` enregistrée ;
- confiance gardée **séparée** ;
- absence de transformation opaque.

**Règle absolue :** **aucun score pays ne doit être calculé sans `source_release`.**

*Résout : Q-3 / O-3 (§3).* *Confirme et formalise `METHODOLOGY_AND_ALGORITHMS.md` §B.4 (déjà alignée).*

### D-4 — Intensités et carbone

**Décision :** le Module 2 **ne devient pas un nouveau moteur carbone**. Il peut **afficher ou relier** des intensités carbone **uniquement si elles viennent des moteurs existants** : Scope 2 · Scope 3 · Product Carbon Footprint · Energy · Procurement.

Le Module 2 **peut calculer des intensités ressources** (nouvelles, propres au module) :
- m³ / unité fonctionnelle ;
- kg / unité produite ;
- tonne / produit ;
- kg / M€ ;
- kg / heure de fonctionnement ;

**à condition que le dénominateur soit explicitement documenté** (source, unité, périmètre, année).

**Interdictions strictes :**
- aucun facteur d'émission codé en dur ;
- aucun `kgCO2e/kN` de poussée (thrust) — ni aucun paramètre opérationnel défense/spatial assimilable ;
- aucun calcul carbone propre au spatial/défense ;
- aucune intensité sans source, unité, périmètre et année.

Les facteurs carbone futurs (crosswalk `material_id→ef_code`) devront passer par l'**Evidence Kernel** et `source_release` — jamais fabriqués.

*Résout : Q-4 / O-4 (§3).* *Révise : `METHODOLOGY_AND_ALGORITHMS.md` §B.7.*

### D-5 — Lignée IRO

**Décision :** réutiliser **`crma`** lorsque l'origine du signal est réellement CRMA. Ajouter un domaine distinct **`strategic_resources`** pour les ressources étendues.

**Règle de routage `origin_domain` :**
- ressource CRMA → `crma` ;
- eau → `water` ;
- énergie → `energy` ;
- biodiversité → `nature` ;
- ressource étendue non-CRMA → **`strategic_resources`**.

**Garde-fou :** le module Resources peut **proposer** un signal IRO, **jamais décider la matérialité**. Toute décision reste **humaine, append-only**, comme PR-10 (`materiality_decisions`).

**Portée de cette phase :** si le domaine `strategic_resources` exige une extension de contrainte SQL (`DROP/ADD CONSTRAINT` sur `iros.origin_domain`, motif déjà utilisé en `040:616`), **la documenter comme migration future** — ne pas l'implémenter ici.

*Résout : Q-5 / O-6 (§3).* *Révise : `MODULE2_SOURCE_OF_TRUTH.md` §5, gap #8.*

### D-6 — Vocabulaires d'étapes

**Décision :** les étapes de chaîne de valeur doivent être **pilotées depuis la DB**. **Ne jamais coder en dur** de liste d'étapes dans le frontend ou dans les services.

- **Réutiliser au maximum le modèle CRMA existant** : `processing_stages`, `stage_code`, `stage_order`, `is_upstream`.
- **Étendre si nécessaire** avec une table de familles/applicabilité : **`resource_stage_families`** ou **`resource_stage_applicability`** (nom exact à trancher en architecture).

**Objectif :** une famille `industrial_gas` n'a pas forcément les mêmes étapes qu'une famille `biomass`, `nuclear_fuel` ou `energy_carrier`.

**Exigence par étape :** versionnée · documentée · stable · testable · non ambiguë.

*Résout : Q-6 / O-7 (§3).* *Révise : `MODULE2_SOURCE_OF_TRUTH.md` §4.2/§5 gap #4 ; `METHODOLOGY_AND_ALGORITHMS.md` §D item 7.*

---

## 3. Décisions encore ouvertes (reste à trancher en phase d'architecture)

> Les six questions bloquantes du cadrage (Q-1 à Q-6 / O-1 à O-4, O-6, O-7) sont **résolues par D-1 à D-6 ci-dessus**. Ne restent ouvertes que des paramètres d'implémentation, non bloquants pour démarrer l'architecture.

| # | Question | Statut |
|---|---|---|
| ~~O-1~~ | Combustible = matière et/ou porteur ? | **RÉSOLU → D-1** (modèle multi-rôle + `company_resource_exposure_links`) |
| ~~O-2~~ | Table de référence `materials` ou texte libre ? | **RÉSOLU → D-2** (`resource_catalog` + `resource_aliases`, legacy préservé) |
| ~~O-3~~ | Risque-pays : WGI ou binaire renommé ? | **RÉSOLU → D-3** (MVP = binaire renommé ; v2 = WGI sous conditions strictes) |
| ~~O-4~~ | Périmètre des intensités, carbone inclus ? | **RÉSOLU → D-4** (carbone = lien vers moteurs existants seulement ; nouvelles intensités ressources autorisées) |
| **O-5** | Analyse de sensibilité : fixer δ, surface de sortie (tornado + bande + inversion de rang), persistance de la bande ? | **Ouvert** — à spécifier en architecture (`METHODOLOGY_AND_ALGORITHMS.md` §B.8). |
| ~~O-6~~ | Lignée IRO : `crma` ou `strategic_resources` ? | **RÉSOLU → D-5** (les deux, selon règle de routage) |
| ~~O-7~~ | Vocabulaires d'étapes par famille, DB-driven ? | **RÉSOLU → D-6** (`processing_stages` étendu + `resource_stage_families`) |
| **O-8** | Nom du module/score : étendre `CC-MATERIAL-EXPOSURE` ou verser un nouveau code ? | **Ouvert, mineur** — à trancher en architecture ; garder la séparation frontend illustratif (`CC-SUPPLY-RISK-0.1`) / backend auditable. |
| **O-9** | ESRS simplifiés en attente (acte délégué non adopté) — ne pas figer les champs d'information réglementaire avant adoption. | **Ouvert — dépendance externe réelle** (source non encore publiée) ; seul item de ce tableau relevant d'un manque de source, pas d'un choix. |

Détail des poids/formules encore ouverts (non bloquants, propres à l'implémentation) : voir `METHODOLOGY_AND_ALGORITHMS.md` §D items 2 (échelle/garde HHI), 5 (poids de confiance), 6 (provenance de composante), 8 (raffinements substitution), 9 (compagnons fournisseurs).

---

## 4. Renvois
- Vérité d'architecture et de périmètre : `MODULE2_SOURCE_OF_TRUTH.md`.
- Vérité réglementaire : `REGULATORY_SOURCE_MATRIX.md`.
- Vérité données/licences : `DATA_SOURCE_AND_LICENSE_MATRIX.md`.
- Formules/tests/rejets : `METHODOLOGY_AND_ALGORITHMS.md`.
- État & prochaine action : `MODULE2_HANDOFF.md`.
