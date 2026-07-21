# MODULE 2 — HANDOFF (cadrage)

> **Module :** Ressources stratégiques & dépendances industrielles étendues.
> **Date : 2026-07-22** · **Branche :** `docs/strategic-resources-cadrage` · **Base :** `origin/master` `2175f89` (schéma `041`).

```
STATUS=PHASE_1_ARBITRAGE_APPLIED
NEXT_ACTION=architecture définitive (docs-only)
```

## 1. État de la phase

**Phase 1 (cadrage) TERMINÉE** puis **arbitrage Ludo des 6 questions bloquantes REÇU ET APPLIQUÉ** (décisions D-1 à D-6, cf. §3). **Toujours documentaire uniquement** — l'arbitrage ne lève pas l'interdiction de coder :
- ❌ Aucun fichier sous `apps/` modifié. ❌ Aucune migration. ❌ Aucun développement. ❌ Aucune route ni interface. ❌ Aucune donnée factuelle non sourcée générée.
- ✅ Cadrage mené par **4 agents en lecture seule** (architecture, réglementation, données/licences, méthodologie) — aucun n'a écrit dans le dépôt.
- ✅ 6 livrables sous `docs/carbonco/resources/`, désormais mis à jour avec les arbitrages D-1 à D-6.
- ✅ Toute donnée non confirmée par source primaire reste marquée **UNRESOLVED** (§5 — resserré aux seuls manques réels de source/licence, cf. critère au §5).

## 2. Fichiers créés

| Fichier | Contenu |
|---|---|
| `docs/carbonco/resources/MODULE2_SOURCE_OF_TRUTH.md` | Stack réelle, tables/services réutilisés, terminologie, ressources nouvelles vs déjà couvertes, hors périmètre, gaps. |
| `docs/carbonco/resources/REGULATORY_SOURCE_MATRIX.md` | CRMA, EUDR, REACH, CLP, dual-use, RED III/CBAM, Euratom, ESRS — statut, annexe, validité, source primaire, date, certitude. |
| `docs/carbonco/resources/DATA_SOURCE_AND_LICENSE_MATRIX.md` | Datasets, éditeurs, millésimes, licences, droits (stockage/affichage/dérivé), fréquence, limites, mapping booléens CarbonCo. |
| `docs/carbonco/resources/METHODOLOGY_AND_ALGORITHMS.md` | Formules (HHI, concentration, substituabilité, risque-pays, confiance, intensités, sensibilité), unités, conditions, biais, warnings, tests, **formules rejetées**. |
| `docs/carbonco/resources/MODULE2_DECISIONS.md` | Décisions de cadrage (CD-1..CD-9) + **arbitrages structurants Ludo D-1 à D-6** + décisions encore ouvertes. |
| `docs/carbonco/resources/MODULE2_HANDOFF.md` | Ce document. |

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

Aucun UNRESOLVED méthodologique ou architectural ne subsiste : les points précédemment listés ici (risque-pays, vocabulaire d'étapes, périmètre des intensités, combustible/porteur, table de référence, lignée IRO) sont **résolus par D-1 à D-6** (§4). Les paramètres d'implémentation restants (échelle/garde HHI, poids de confiance, provenance de composante, δ de sensibilité, nom du score) sont des choix d'architecture non bloquants, listés dans `MODULE2_DECISIONS.md` §3.

## 6. NEXT_ACTION

**= ARCHITECTURE DÉFINITIVE (docs-only pour l'instant).**

Toutes les questions bloquantes étant tranchées (§4), produire le plan d'architecture détaillé de MODULE 2 :
- spécifier `resource_catalog` + `resource_aliases` (D-2) — schéma, contraintes, non-destruction de l'existant ;
- spécifier `company_resource_exposure_links` (D-1) et le modèle multi-rôle ;
- spécifier l'extension de `processing_stages` / `resource_stage_families` par famille (D-6) et le paramétrage par famille de `scoring.py` (CD-2) ;
- spécifier le routage `iros.origin_domain` incluant `strategic_resources` (D-5) — migration **documentée**, pas exécutée ;
- spécifier le calcul honnête de `third_country_dependency` MVP et les conditions de gate pour un futur risque-pays WGI (D-3) ;
- spécifier les intensités ressources (D-4) et leurs gardes de dénominateur ;
- plan de sourcing (sources ouvertes retenues) + politique de licence appliquée (dégrade la confiance) ;
- spécification de l'analyse de sensibilité (O-5) et de la provenance de composante (`METHODOLOGY_AND_ALGORITHMS.md` §B.5/§B.8) ;
- réservation de migration(s) (numérotées mais non écrites), contrats d'interface, matrice de tests.

**Toujours pas de code, pas de migration réelle, pas de modification sous `apps/`, pas de push, pas de PR** tant que l'architecture définitive n'est pas elle-même validée par Ludo.
