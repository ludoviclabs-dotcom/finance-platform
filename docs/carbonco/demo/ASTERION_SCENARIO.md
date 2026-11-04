# ASTERION_SCENARIO — scénario de démonstration « Asterion Motion SAS »

> **100 % FICTIF.** Entreprise, produit, sites, fournisseurs, chiffres : entièrement
> inventés pour la démonstration produit de CarbonCo Intelligence. Toute donnée seedée
> porte `synthetic=true` et un statut explicite. Aucune donnée réelle, aucun client réel,
> aucun appel modèle payant, aucun réseau externe. Version du scénario : `asterion-motion-v1`.

## 0. Intention

Dérouler, sur un cas industriel crédible et cohérent, la chaîne de valeur complète de
CarbonCo Intelligence : de l'import d'achats jusqu'à l'Evidence Pack, en passant par
Scope 3, CRMA, Scope 2, eau/nature, la double matérialité (IRO) et **l'assistant IA cité
sous revue humaine** (PR-11, mode `demo` déterministe).

La démonstration prouve la thèse produit : *l'IA assiste et cite, l'humain décide ; tout
chiffre a une source, un statut et une méthode ; estimé ≠ vérifié ; risque ≠ confiance.*

## 1. L'entreprise (fictive)

| Champ | Valeur |
|---|---|
| Raison sociale | **Asterion Motion SAS** |
| Secteur | Équipementier — moteurs électriques de traction |
| Produit phare | **E-Drive X4** (moteur synchrone à aimants permanents) |
| Production | **12 000 moteurs / an** |
| Sites | Siège + usine d'assemblage (France), atelier bobinage (fictif) |
| Fournisseurs | Aimants NdFeB, cuivre, aluminium (tous fictifs) |
| Tenant démo | slug `asterion-motion-demo` |

Tous les identifiants d'entreprise, de site et de fournisseur sont **générés au seed**
(aucun ID PostgreSQL fixe dans les fixtures) et rattachés au tenant démo.

## 2. Nomenclature matière (BOM) du E-Drive X4

| Matière | kg / moteur | Volume annuel (12 000 u.) | Statut |
|---|---|---|---|
| Aimants NdFeB (terres rares) | 12,5 kg | 150 t | `estimated` |
| Cuivre | 18 kg | 216 t | `manual` |
| Aluminium | 29 kg | 348 t | `manual` |

## 3. Données de référence (chiffres canoniques du scénario)

Ces valeurs sont la **source de vérité**. Le seed doit les reproduire ; `demo_verify.py`
recalcule et compare (rapport de parité).

| Domaine | Métrique | Valeur | Statut / méthode |
|---|---|---|---|
| Achats | Total achats | **5,8 M€** | `manual` |
| Scope 3 | Émissions achats | **3 552 tCO2e** | `estimated` (facteurs physiques + 1 facteur monétaire) |
| Scope 3 | Part des aimants | **60,6 %** | dérivé déterministe (hotspot n°1) |
| Énergie | Consommation électrique | **8,6 GWh** | `manual` (relevés) |
| Scope 2 | Location-based (LB) | **489 tCO2e** | déterministe (mix réseau) |
| Scope 2 | Market-based (MB) | **237 tCO2e** | déterministe (instruments contractuels) |
| Scope 2 | Couverture contractuelle | **54 %** | dérivé |
| Eau | Prélèvement annuel | **72 000 m³** | `manual` |
| Eau | Stress hydrique | **élevé**, confidence **0,81** | screening (risque ≠ confiance) |
| CRMA | Dépendance terres rares lourdes | **92 %** | `estimated` |
| IRO | Exposition financière indicative | **1,4 M€** | `estimated`, fourchette |

Cohérence interne vérifiable :
- Scope 3 achats = aimants 150 000 kg × 14,34 + cuivre 216 000 kg × 3,7 + aluminium 348 000 kg × 1,52 + autres achats 290 k€ × 250 kgCO2e/k€ = 2 151 + 799,2 + 528,96 + 72,5 = **3 551,66 tCO2e** (affiché 3 552). Part aimants : 2 151 / 3 551,66 = 60,6 %.
- Les 4 lignes d'achat totalisent 5,8 M€. Facteur « autres achats » : FEM10 (Équipements électroniques, ADEME/Exiobase) du classeur `CarbonCo_Calcul_Carbone_v2.xlsx`.
- Scope 2 LB = 8 600 MWh × 0,0569 tCO2e/MWh (FE020, mix moyen France, ADEME 2024) = 489,34 t.
- Scope 2 MB = 3 956 MWh non couverts × 0,06 tCO2e/MWh (mix résiduel France, AIB 2023) = 237,36 t ; la part couverte (4 644 MWh, PPA + GO) est à 0.
- Ces chiffres sont recalculés par les vrais moteurs dans `apps/api/tests/test_calc_reference_asterion.py`.

## 4. Les 4 cas obligatoires de revue IA (mode `demo`, déterministe)

L'assistant IA (pipeline PR-11 réel, provider `demo` étendu et *scenario-aware*) produit
pour Asterion un jeu de claims dont le **statut de support est calculé déterministiquement
par le backend** (`entailment_service`), jamais déclaré par le modèle. Le seed prépare
l'évidence de sorte que chaque statut émerge **naturellement** :

| # | Claim (brouillon IA) | Statut attendu | Pourquoi (déterministe) |
|---|---|---|---|
| 1 | « Les aimants représentent **60,6 %** des émissions Scope 3 achats. » | **`supported`** | Cite le **résultat de calcul déterministe** Scope 3 (corroboration exacte, frais). |
| 2 | « La dépendance aux terres rares lourdes dépasse **90 %**. » | **`partially_supported`** | Cite une observation **`estimated`** (92 %) — résolue mais non corroborée déterministiquement → au mieux partiel. |
| 3 | « Le contenu recyclé déclaré des aimants est de **80 %**. » | **`contradicted`** | La preuve citée établit **35 % prouvé** — contradiction chiffrée détectée. |
| 4 | « Un fournisseur alternatif est qualifiable **sous 90 jours**. » | **`unsupported`** | **Aucune** référence interne ne soutient l'affirmation → non étayé. |

Chaque claim porte un **label** de gouvernance (`DRAFT` / `SUGGESTION` / `REVIEW_REQUIRED`),
des **citations résolues** (contre le reference pack réel, jamais d'ID inventé), et transite
par la **gate de revue humaine** avant tout effet métier. L'IA ne décide jamais.

En complément, l'assistant émet des **questions de revue** et des **suggestions d'action**
(ex. « diversifier la source d'aimants », « documenter la méthode du taux recyclé »), toutes
`SUGGESTION`, jamais promues sans geste humain.

## 5. Trace fonctionnelle affichée (jamais de chain-of-thought)

L'UI n'affiche que ces étapes **fonctionnelles** du pipeline réel :

1. Sélection des preuves (reference pack minimisé, sous RLS du tenant démo).
2. Contrôle licence / sensibilité (exclusion des artefacts non affichables/sensibles).
3. Résolution des citations (chaque citation → id interne réel).
4. Confrontation claims ↔ preuves (entailment déterministe → statut de support).
5. Génération du brouillon (labels de gouvernance).
6. Attente de revue humaine (accept / reject / modify + justification).

**Interdits d'affichage** : raisonnement interne du modèle, « pensée », tokens de
raisonnement. Badges permanents à l'écran : **IA SIMULÉE · ZÉRO APPEL EXTERNE ·
DÉMONSTRATION FICTIVE**.

## 6. Parcours (10 étapes)

1. **Situation** — profil Asterion, enjeux CSRD/ESRS.
2. **Import** — achats 5,8 M€, BOM E-Drive X4.
3. **Scope 3** — hotspots, part aimants 60,6 %.
4. **CRMA** — criticité terres rares, dépendance 92 % (estimated).
5. **Scope 2** — LB 489 / MB 237, couverture 54 %.
6. **Eau & nature** — 72 000 m³, stress élevé (confidence 0,81), TNFD.
7. **IRO** — double matérialité, exposition 1,4 M€.
8. **IA** — revue citée : les 4 cas, trace fonctionnelle.
9. **Décision** — revue humaine, création d'un IRO candidate.
10. **Evidence Pack** — dossier auditable, sources + statuts + méthodes.

Chaque étape propose **« Explorer dans l'application »** (lien vers la vraie page du tenant
démo). Trois modes : `guided` (pas-à-pas), `director` (auto, ~2 min), `explore` (libre).

## 7. Invariants de sécurité et de gouvernance (rappel)

- Toute donnée seedée : `synthetic=true`, source + date + statut + méthode.
- Aucune migration SQL (cible **zéro migration**) — seules les tables existantes sont
  utilisées via les services existants, scoping tenant strict (RLS gen-2 + prédicat applicatif).
- `AI_REVIEW_MODE=demo` : déterministe, zéro coût, zéro réseau. `live` jamais activé.
- Reset **uniquement** du tenant démo (garde sur le slug), jamais de donnée réelle touchée.
- Estimé ≠ vérifié ; risque ≠ confiance ; l'IA cite et propose, l'humain décide.

*Fin de ASTERION_SCENARIO.md — source de vérité du scénario `asterion-motion-v1`.*
