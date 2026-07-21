# MODULE 2 — Décisions

> **Phase :** cadrage (lecture seule). **Date : 2026-07-22.**
> Ce registre distingue **décisions confirmées** (tranchées par la preuve — code lu, sources primaires) et **décisions ouvertes** (à arbitrer par Ludo avant l'architecture définitive). Aucune décision ici n'autorise à coder.

---

## 1. Décisions CONFIRMÉES (étayées par la preuve)

| # | Décision | Fondement |
|---|---|---|
| **D-1** | **MODULE 2 est une EXTENSION du modèle d'exposition matières (migration 034 + `scoring.py`), PAS une architecture parallèle.** | `material_id TEXT` sans FK, modèle agnostique à la matière (inventaire architecture). Règle non négociable du chantier : « réutiliser les modules existants, pas d'architecture parallèle ». |
| **D-2** | **Un seul moteur de score, RÉUTILISÉ et PARAMÉTRÉ par famille — jamais cloné.** | `NOMINAL_WEIGHTS`/`STAGE_ORDER`/`UPSTREAM_STAGES`/`EU_COUNTRY_CODES` de `scoring.py` sont **spécifiques aux aimants** : les copier tels quels mis-modéliserait gaz/biomasse/combustibles. |
| **D-3** | **Réutiliser l'Evidence Kernel + `license_policy.evaluate` — aucun 2ᵉ modèle de licence ni table d'observations parallèle.** | Les 8 booléens de `source_registry` couvrent déjà ingest/store/display/derived/commercial/redistribution/attribution. |
| **D-4** | **Conserver les invariants : risque ≠ confiance ; manquant ≠ zéro ; sourcé-ou-avoué ; jamais de fusion inter-étapes ; jamais présenté comme note officielle UE.** | Prouvé dans le code + le schéma (deux colonnes risk/confidence, `*_sourced_check`, `max` inter-étapes, `DISCLAIMER`). |
| **D-5** | **Reclassements réglementaires actés** (sources institutionnelles UE, cf. `REGULATORY_SOURCE_MATRIX.md`) : Hélium = CRMA **Critique** (pas Stratégique) ; Silicium métal = **Stratégique + Critique** ; Charbon à coke = **Critique** (pas CBAM) ; **Uranium = Euratom/ESA (pas CRMA)** ; **Hydrogène = RFNBO + CBAM (pas matière première CRMA)** ; **Xénon/Krypton/Argon = non-CRMA** ; **Bois + Caoutchouc = EUDR (dans le périmètre)** ; **Coton/Lin/Chanvre = hors EUDR**. | Reg (UE) 2024/1252, 2023/1115, 2023/2413, 2023/956, Traité Euratom. |
| **D-6** | **Sources ouvertes retenues** (stockage+affichage+dérivé, avec attribution) : USGS (domaine public), JRC RMIS/CRM Study 2023, Eurostat, FAOSTAT, World Bank WGI, Euratom Supply Agency. **Sources propriétaires bloquées** (`derived_use=false`) : IEA, BGS WMS, PRAs de prix (LME/Platts/Argus/Fastmarkets/ICIS), rapports gaz industriels, ICAC, ANRPC, UxC/TradeTech, ENTSOG. | `DATA_SOURCE_AND_LICENSE_MATRIX.md`. |
| **D-7** | **Toute donnée bloquée par licence dégrade la CONFIANCE, jamais le RISQUE ; jamais d'affichage brut.** Conséquence directe : xénon/krypton/argon (prix/volumes), prix coton/caoutchouc/uranium/silicium/GNL seront **faible-confiance-par-licence**, pas faible-risque. | Règle de conception CarbonCo + inventaire licences. |
| **D-8** | **ESRS E5** (utilisation des ressources & économie circulaire) est le **standard d'information d'ancrage** de MODULE 2 ; E2 pour l'angle substances REACH ; ESRS 1/2 pour le screening IRO de double matérialité. **Pas E1.** | `REGULATORY_SOURCE_MATRIX.md` §F. |
| **D-9** | **Garde-fou de sécurité permanent :** aucune recette, formulation, proportion, procédure de fabrication ni paramètre opérationnel ; défense/spatial = **classification supply-chain / listage uniquement**. | Brief + politique. |

## 2. Décisions OUVERTES (à arbitrer avant l'architecture)

| # | Question | Options | Recommandation de cadrage |
|---|---|---|---|
| **O-1** | Un combustible (hydrogène/GNL/uranium) est-il modélisé comme **matière** (034, angle dépendance) ET/OU comme **porteur** (031, angle Scope 2) ? Faut-il un pont ? | (a) matière seule ; (b) porteur seul ; (c) les deux + table-pont | (c) matière pour la dépendance, porteur pour le Scope 2 ; **aucun pont n'existe** — à concevoir si le double usage est retenu. |
| **O-2** | Introduire une vraie **table de référence `materials`** (façon 033 jamais mergée) ou garder `material_id TEXT` libre ? | (a) table de référence tenant+global ; (b) statu quo texte libre | (a) probable — l'ajout de gaz/biomasse/combustibles amplifie le besoin d'une surface d'enregistrement/validation ; à trancher en architecture. |
| **O-3** | **Risque-pays** : ingérer WGI (World Bank, sourcé, erreurs-types → confiance) ou garder le binaire UE/hors-UE **renommé « part hors UE »** ? | (a) WGI sourcé ; (b) binaire renommé | **Jamais de poids inventé.** (b) tant que WGI n'est pas ingéré ; (a) dès qu'une release WGI est disponible. |
| **O-4** | **Intensités** : lesquelles dans le périmètre — matière (kg/unité), carbone (kgCO2e/kg), appro. (kg/an, €/an) ? L'intensité **carbone** relève-t-elle de MODULE 2 ou du MODULE 1 ? | matière & appro. (données existantes) ; carbone = crosswalk + facteurs neufs | Nommer les trois séparément ; n'émettre le carbone **que** là où un facteur est sourcé — **ne pas fabriquer de kgCO2e/kg terres rares**. |
| **O-5** | **Analyse de sensibilité** (absente, requise) : fixer δ, la surface de sortie (tornado + bande de stabilité + inversion de rang), et si la bande est persistée. | — | Implémenter en OAT ; décision de δ et de persistance à l'architecture. |
| **O-6** | **IRO** : réutiliser `origin_domain='crma'` ou ajouter le littéral `strategic_resources` ? | (a) réutiliser `crma` ; (b) petite migration `DROP/ADD CONSTRAINT` | (b) si l'on veut distinguer la lignée ; motif `040:616`. |
| **O-7** | **Vocabulaires d'étapes par famille** (gaz : séparation de l'air ; biomasse : culture→transformation ; combustibles) : semer des étapes globales par famille et **piloter `scoring.py` depuis la DB** plutôt que coder en dur ? | (a) DB-driven ; (b) constantes en dur | (a) — sinon `STAGE_ORDER` (code) et le semis 034 §3bis divergeront. |
| **O-8** | **Nom du module / du score** : étendre `CC-MATERIAL-EXPOSURE` ou versionner un nouveau code ? Ne pas confondre avec le score frontend illustratif `CC-SUPPLY-RISK-0.1`. | — | Étendre la méthode versionnée existante ; garder la séparation frontend illustratif / backend auditable. |
| **O-9** | **ESRS simplifiés en attente** (acte délégué non adopté) : ne pas figer les champs d'information réglementaire avant adoption. | — | Attendre l'adoption ; concevoir les champs comme configurables. |

## 3. Renvois
- Vérité d'architecture et de périmètre : `MODULE2_SOURCE_OF_TRUTH.md`.
- Vérité réglementaire : `REGULATORY_SOURCE_MATRIX.md`.
- Vérité données/licences : `DATA_SOURCE_AND_LICENSE_MATRIX.md`.
- Formules/tests/rejets : `METHODOLOGY_AND_ALGORITHMS.md`.
- État & prochaine action : `MODULE2_HANDOFF.md`.
