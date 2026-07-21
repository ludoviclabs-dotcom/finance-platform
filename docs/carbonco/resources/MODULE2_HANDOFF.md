# MODULE 2 — HANDOFF (cadrage)

> **Module :** Ressources stratégiques & dépendances industrielles étendues.
> **Phase :** cadrage / inventaire / validation méthodologique — **TERMINÉE**.
> **Date : 2026-07-22** · **Branche :** `docs/strategic-resources-cadrage` · **Base :** `origin/master` `2175f89` (schéma `041`).

## 1. État de la phase

**Cadrage terminé, documentaire uniquement.** Conformément au brief :
- ❌ Aucun fichier sous `apps/` modifié. ❌ Aucune migration. ❌ Aucun développement. ❌ Aucune route ni interface. ❌ Aucune donnée factuelle non sourcée générée.
- ✅ Recherche menée par **4 agents en lecture seule** (architecture, réglementation, données/licences, méthodologie) — aucun n'a écrit dans le dépôt.
- ✅ 6 livrables créés sous `docs/carbonco/resources/`.
- ✅ Toute donnée non confirmée par source primaire est marquée **UNRESOLVED**.

## 2. Fichiers créés

| Fichier | Contenu |
|---|---|
| `docs/carbonco/resources/MODULE2_SOURCE_OF_TRUTH.md` | Stack réelle, tables/services réutilisés, terminologie, ressources nouvelles vs déjà couvertes, hors périmètre, gaps. |
| `docs/carbonco/resources/REGULATORY_SOURCE_MATRIX.md` | CRMA, EUDR, REACH, CLP, dual-use, RED III/CBAM, Euratom, ESRS — statut, annexe, validité, source primaire, date, certitude. |
| `docs/carbonco/resources/DATA_SOURCE_AND_LICENSE_MATRIX.md` | Datasets, éditeurs, millésimes, licences, droits (stockage/affichage/dérivé), fréquence, limites, mapping booléens CarbonCo. |
| `docs/carbonco/resources/METHODOLOGY_AND_ALGORITHMS.md` | Formules (HHI, concentration, substituabilité, risque-pays, confiance, intensités, sensibilité), unités, conditions, biais, warnings, tests, **formules rejetées**. |
| `docs/carbonco/resources/MODULE2_DECISIONS.md` | Décisions confirmées + décisions ouvertes. |
| `docs/carbonco/resources/MODULE2_HANDOFF.md` | Ce document. |

## 3. Décisions confirmées (résumé — détail dans `MODULE2_DECISIONS.md`)

1. MODULE 2 = **extension** du modèle 034 + `scoring.py` (pas d'architecture parallèle).
2. **Un seul moteur de score**, réutilisé et **paramétré par famille** (jamais cloné — constantes actuelles spécifiques aux aimants).
3. **Evidence Kernel + `license_policy`** réutilisés (pas de 2ᵉ modèle de licence).
4. Invariants conservés : **risque ≠ confiance ; manquant ≠ zéro ; sourcé-ou-avoué ; jamais de fusion inter-étapes ; jamais présenté comme note officielle UE.**
5. **Reclassements réglementaires** : Hélium = CRMA Critique ; Silicium métal = Stratégique + Critique ; Charbon à coke = Critique (pas CBAM) ; **Uranium = Euratom (pas CRMA)** ; **Hydrogène = RFNBO + CBAM (pas CRMA)** ; **Xénon/Krypton/Argon = non-CRMA** ; **Bois + Caoutchouc = EUDR** ; **Coton/Lin/Chanvre = hors EUDR**.
6. **Sources ouvertes** (USGS, JRC RMIS, Eurostat, FAOSTAT, World Bank WGI, Euratom ESA) vs **propriétaires/bloquées** (IEA, BGS WMS, PRAs, ICAC, ANRPC, UxC/TradeTech, rapports gaz, ENTSOG) → ces dernières **dégradent la confiance, jamais le risque**.
7. **ESRS E5** = standard d'ancrage ; IRO via ESRS 1/2.

## 4. Questions bloquantes (à trancher par Ludo avant l'architecture)

- **Q-1 — Combustible = matière et/ou porteur ?** Hydrogène/GNL/uranium : modèle 034 (dépendance) et/ou module Énergie 031 (Scope 2) ? Aucun pont n'existe. (→ O-1)
- **Q-2 — Table de référence `materials` ?** Créer une vraie table de référence (façon 033 jamais mergée) ou garder `material_id TEXT` libre ? (→ O-2)
- **Q-3 — Risque-pays.** Ingérer WGI (sourcé) ou garder le binaire UE/hors-UE renommé ? **Jamais de poids inventé.** (→ O-3)
- **Q-4 — Périmètre des intensités.** Matière / carbone / appro. — le carbone est-il dans MODULE 2 ? (→ O-4)
- **Q-5 — Lignée IRO.** Réutiliser `origin_domain='crma'` ou ajouter `strategic_resources` ? (→ O-6)
- **Q-6 — Vocabulaires d'étapes par famille** (gaz/biomasse/combustibles) pilotés depuis la DB ? (→ O-7)

## 5. Sources manquantes / UNRESOLVED (à confirmer)

Réglementaire (`REGULATORY_SOURCE_MATRIX.md` §2) :
- Statut d'enregistrement REACH (tonnage/dossier) par gaz (He/Ar/Kr/Xe/H2) — infocards ECHA en HTTP 403 → vérification manuelle.
- Listage dual-use par substance (hélium-3) — texte Annexe I Reg (UE) 2021/821 non ouvert (garde-fou sécurité) ; existence-seule, non affirmé.
- Objectifs de remplissage stockages gaz 2026 (extension Reg (UE) 2022/1032) — référence du règlement modificatif final manquante.
- Texte verbatim des Annexes I/II du CRMA (CELEX 32024R1252) — HTML EUR-Lex vide ; classement solide via JRC RMIS + DG GROW, citation d'annexe à tirer manuellement.
- Forme/nom légal exact du standard volontaire « VS » (successeur VSME) — pas encore publié.

Données/licences (`DATA_SOURCE_AND_LICENSE_MATRIX.md` §5) :
- Droit d'usage dérivé exact de la **Transparency Platform ENTSOG** (PDF de termes non récupéré) → défaut = bloqué.
- Millésimes exacts (USGS MCS 2026 vs 2025 ; WGI 2024 vs MAJ 2025 ; édition BGS) — indicatifs, non vérifiés-licence.

Méthodologie (`METHODOLOGY_AND_ALGORITHMS.md` §D) : décisions ouvertes O-3 à O-9 (risque-pays, échelle/garde HHI, intensités, sensibilité, poids de confiance, provenance de composante, vocabulaire d'étapes, substitution, compagnons fournisseurs).

## 6. NEXT_ACTION

**= ARCHITECTURE DÉFINITIVE.**

Une fois les questions bloquantes Q-1 à Q-6 arbitrées par Ludo, produire le plan d'architecture détaillé de MODULE 2 :
- extension du modèle 034 (nouveaux `material_groups` par famille, nouveaux vocabulaires d'`processing_stages`, `scoring.py` paramétré par famille) ;
- arbitrage de la table de référence `materials` (O-2) et du pont combustible/porteur (O-1) ;
- plan de sourcing (sources ouvertes retenues) + politique de licence appliquée (dégrade la confiance) ;
- spécification de l'analyse de sensibilité (O-5) et de la provenance de composante (B.5) ;
- réservation de migration(s), contrats d'interface, matrice de tests.

**Ne pas démarrer l'architecture détaillée ni aucun code tant que Q-1 à Q-6 ne sont pas tranchées.** Ne pas pousser de code. Ne pas créer de migration.
