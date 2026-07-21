# MODULE 2 — Méthodologie & algorithmes

> **Phase :** cadrage (lecture seule). **Date : 2026-07-22.**
> Constat central : **la méthode existante (`services/crma/scoring.py`, `CC-MATERIAL-EXPOSURE 0.1.0`) est saine et MODULE 2 doit la RÉUTILISER, pas la réinventer.** Ses invariants — risque≠confiance, jamais de fusion inter-étapes, manquant≠zéro, sourcé-ou-avoué — sont exactement les garde-fous d'un module « ressources stratégiques ». Les vrais manques : **risque-pays réel** (absent, à sourcer), **analyse de sensibilité** (absente, requise), **désambiguïsation des intensités**, **durcissement du HHI** face à une faible couverture de marché.
> Ce document propose des formules **candidates** ; aucune n'est implémentée dans cette phase.

---

## A. Ce que la méthode existante fait déjà correctement (à conserver)

1. **Pureté / reproductibilité.** `scoring.py` est sans I/O, sans LLM, déterministe ; `exposure_service.py` ne fait que lire le périmètre tenant et déléguer. `input_snapshot` persiste les entrées pour rejeu. Testé (`test_score_is_deterministic_for_identical_inputs`).
2. **HHI par étape de chaîne de valeur**, sur parts renormalisées au total observé ; `observed_total_pct` reporté honnêtement ; lignes d'une autre étape rejetées (`ScoringError`).
3. **Les étapes sont SÉLECTIONNÉES, jamais fusionnées** (`max` du HHI, `stage_code` reporté). Étapes non documentées rendues vides (`country_count=0`) plutôt que supprimées.
4. **Dépendance pays tiers (hors UE) par étape**, renormalisée, via une liste structurelle EU-27 (pas une donnée externe).
5. **HHI de concentration fournisseurs** (`herfindahl_pct`), avec proxy `share_of_supply_pct`-sinon-masse qui ne somme jamais les deux grandeurs.
6. **Substituabilité = échelle de maturité + pénalité de performance** (meilleur substitut) ; recyclage idem avec remise de contenu recyclé ; brut préservé à côté du dérivé.
7. **Couverture de stock** en carte linéaire bornée (0 j→100, ≥180 j→plancher 10) ; monotone, plancher.
8. **Événements réglementaires : sévérité des événements ACTIFS à `as_of`.** Distingue « aucun événement consigné » (→ `available=False`) de « consignés, aucun actif » (→ disponible, plancher 10) — l'expression la plus nette de **manquant≠zéro**.
9. **Composite pondéré avec renormalisation des composantes INDISPONIBLES** — jamais comptées zéro. `risk_score=None` si rien n'est disponible (un nombre refusé vaut mieux qu'un nombre inventé).
10. **La confiance est une sortie strictement séparée** (composantes `stage_coverage 0.30`, `data_quality 0.25`, `component_coverage 0.20`, `freshness 0.15`, `license_access 0.10`), jamais multipliée dans le risque. Disjonction prouvée par tests ET par le schéma (deux colonnes, deux CHECK).
11. **Provenance & licence.** `data_status ∈ {verified,estimated,manual,inferred}` ; `verified` exige `source_release_id` ; marché sous licence évaluée à la lecture ; dérivé bloqué → baisse la confiance seulement ; le score dérivé est toujours `estimated`.
12. **Cadrage « non officiel » porté et sérialisé** : `DISCLAIMER`, `methodology_code/version`, `is_official_eu_score=False`.

---

## B. Validation par thème (formule · unités · conditions · hypothèses · biais · warnings · tests)

### B.1 HHI (indice de Herfindahl-Hirschman)
- **Formule.** `H = Σ_i s_i²`. Deux échelles : fractionnaire (`s_i` somment à 1 → `H ∈ [1/n, 1]`) ; points de % (DOJ/FTC, `S_i ∈ 0–100 → H ∈ [10000/n, 10000]`). `H_pct = 10000·H_frac`.
- **Choix du code.** `hhi_pct = Σ (s_i/observed_total)² × 100` → échelle **0–100** (code = DOJ ÷ 100 : un pays→100 ; quatre égaux→25). **VALIDÉ.**
- **Unités.** Indice sans dimension. Compagnon utile : **nombre effectif de pays sources `N_eff = 1/Σs_i² = 100/hhi_pct`**.
- **Conditions de validité.** `observed_total_pct` élevé (≳70–80 %), `country_count` réel, étape = vrai marché global (extraction, séparation, raffinage).
- **Hypothèses.** Renormaliser au total observé suppose que le **reste non observé a la même concentration** ; ne mesure que la concentration **géographique**.
- **Biais / warnings.** ⚠ **Biais de couverture incomplète** : pour un total observé `T<1`, `HHI_renorm = (1/T²)Σp_i²` **dépasse** la borne basse `Σp_i²` et peut monter jusqu'à `Σp_i²+(1−T)²`. Cas pathologique : un seul pays observé à 40 % → HHI=100 (lit « monopole ») alors qu'il signifie « on a trouvé un acteur couvrant 40 % ». **Surfacer honnêtement** : toujours afficher `observed_total_pct` (fait) ; **publier la bande de couverture `[Σp_i², Σp_i²+(1−T)²]×100`** autour du point ; **garde de couverture minimale** qui **retire/signale** le HHI d'étape (pas seulement baisse la confiance) si couverture trop faible. ⚠ **Géographique ≠ corporate** (trois pays, un seul opérateur = lu diversifié). ⚠ Non pertinent pour des « étapes » diffuses (assemblage `component`/`product`). Renommer l'étiquette « HHI % » (impropre) en « HHI (0–100) ».
- **Seuils de référence (DOJ/FTC).** Échelle 0–10000 : lignes directrices 2023 (courantes) — présomption structurelle **HHI post >1800 & ΔHHI >100** (ou part combinée >30 %) ; anciennes 2010 : 1500 / 2500. Sur l'échelle 0–100 du code : **18 / 25 / 15**. **Seuils antitrust de fusion (concentration corporate)** — utilisables seulement comme repère de magnitude, **pas** une correspondance réglementaire sur des parts pays.
- **Tests.** un pays→100 ; n égaux→100/n ; couverture partielle renormalisée & reportée (présents) ; **AJOUTER** : bornes de la bande de couverture contiennent le point ; garde de couverture déclenche ; identité `N_eff` ; régression d'échelle (quatre égaux==25).

### B.2 Concentration fournisseurs — HHI vs CR4/CRn
- **Formules.** HHI (ci-dessus) ; `CR_n = Σ_{top n} s_i`.
- **Arbitrages.** HHI = distribution complète, sur-pondère les gros (carré), standard antitrust. CRn intuitif mais ignore l'inégalité intra-top-n et toute la queue ; CR4 dégénéré si ≤4 fournisseurs.
- **Recommandation.** **Garder HHI fournisseurs** (le tenant connaît ses fournisseurs, pas de queue inconnue) ; **ajouter CR1 (part du 1ᵉʳ fournisseur) + nombre** comme compagnons de lisibilité.
- **Warnings.** À 1 fournisseur, HHI=CR1=100 — correct mais trivial ; toujours reporter le **nombre**.
- **Tests.** HHI=CR1 à n=1 ; ajout d'un petit fournisseur baisse HHI ; proxy-masse == proxy-part quand parts absentes.

### B.3 Substituabilité — échelle de maturité + pénalité
- **Formule.** `residual = MATURITY_RISK[maturity]` avec `{mature:10, commercial:30, pilot:60, research:85}` ; si pénalité, `residual = min(100, residual + penalty_pct·0.3)` ; `argmin` sur les substituts. Unités : indice de risque résiduel 0–100.
- **VALIDÉ** comme **échelle ordinale rendue numérique**, à condition de lire les ancres comme **ordinales** (pas cardinales) et de garder les bruts (maturité, pénalité) exposés (fait).
- **Hypothèses / biais.** Coefficient `0.3` et espacement `{10,30,60,85}` = **paramètres libres non validés** ; le meilleur-substitut ignore la **largeur de portefeuille** (trois substituts commerciaux > un) ; la maturité confond « existe en principe » et « déployable aujourd'hui ».
- **Warnings.** Ne pas afficher le résiduel à 2 décimales comme s'il était mesuré ; soumettre `0.3` et les ancres à l'analyse de sensibilité (B.8).
- **Tests.** monotonie `mature<commercial<pilot<research` (présent) ; pénalité augmente strictement et plafonne à 100 ; `argmin` choisit le meilleur ; manquant→indisponible (pas zéro).

### B.4 Risque-pays — actuellement BINAIRE UE/hors-UE (**GAP — à sourcer, jamais inventer**)
- **État actuel, dit clairement.** La seule dimension pays = `third_country_dependency` = part hors du set EU-27 codé en dur. C'est une distinction **réglementaire/structurelle** (quels États sont légalement dans l'UE — un fait, correctement codé en dur), **pas un jugement de risque.** Elle traite Norvège/Suisse/USA comme Chine/RDC. À **renommer « part hors UE »**, pas « risque-pays ».
- **Formulation réelle proposée (base WGI).** Pour chaque pays producteur `c` de part `s_c`, poids de risque de gouvernance `r_c ∈ [0,1]` dérivé des **World Bank Worldwide Governance Indicators** : depuis le rang percentile `pr_c` → `r_c = 1 − pr_c/100` ; ou depuis l'estimé `g_c ∈ [−2.5, 2.5]` → `r_c = (2.5 − g_c)/5`. Risque-pays d'étape = **moyenne pondérée par les parts** `R_stage = Σ_c (s_c/observed_total)·r_c` (0–1, ×100 pour affichage). Dimensions candidates : Political Stability, Government Effectiveness, Rule of Law (point de décision).
- **Données REQUISES (le nœud).** WGI par pays et par an, **ingérés via l'Evidence Kernel** comme source sous licence (`source_release_id`, `data_status`) ; **les erreurs-types WGI portées dans la CONFIANCE, pas le risque** (WGI = modèle à composantes inobservées sur ~35 sources, chaque score a un écart-type). Nature perceptuelle, biais occidental, non spécifique à l'appro. → à **disclaimer**. Alternatives (chacune à ingérer + licencier) : OECD FDI Regulatory Restrictiveness Index, indices de restriction commerciale (OTRI), Global Trade Alert.
- ⚠ **À SIGNALER FORT.** Un poids de risque par pays est une **affirmation factuelle sur le monde** ; l'inventer viole le `*_sourced_check` du schéma et la règle « no uncited normative answer ». **Tant que WGI (ou équivalent) n'est pas ingéré, MODULE 2 ne DOIT PAS ajouter de poids risque-pays** — garder `third_country_dependency` tel quel et le renommer honnêtement.
- ⚠ **Hygiène de code-pays.** `EU_COUNTRY_CODES` utilise **`GR`** (Grèce, ISO alpha-2 correct). Si une source ingérée utilise **`EL`** (variante UE) ou `UK` vs `GB`, ce pays est **silencieusement compté hors-UE** → étape de normalisation des codes pays + test requis.
- **Tests.** tout-UE→0 et mixte→% correct (présents) ; `r_c` monotone en WGI ; pondération par parts somme correctement ; erreurs-types → confiance seulement ; normalisation `EL`/`GB` ; **test d'absence qui échoue si un poids risque-pays est codé en dur sans `source_release_id`.**

### B.5 Preuve — échelle `data_status` + Evidence Kernel
- **Réutiliser tel quel.** Toute table factuelle porte `data_status`, `source_release_id`, `evidence_artifact_id` ; `verified` exige une release ; `data_quality` map `{verified 1.0, manual 0.7, estimated 0.5, inferred 0.3}` (confiance seulement) ; refs = artefact/release, jamais d'URL ; le score dérivé est toujours `estimated`.
- **Formule.** `data_quality = Σ_status qualité[status]·count[status] / Σ count`.
- **Gap / reco.** `ScoreComponent` porte `stage_code` mais **pas la liste des `source_release_id`** ayant nourri la composante → un driver n'est pas traçable à ses releases depuis la composante seule. **Attacher une liste `source_release_ids` par composante.**
- **Tests.** `verified` sans release rejeté (CHECK, DB-gated) ; mapping status→qualité ; refs de preuve par matière ; (nouveau) aller-retour composante→release.

### B.6 Confiance — réaffirmer risque≠confiance ; critique des sous-poids
- **Réaffirmé.** La confiance n'entre jamais dans le risque. `confidence = Σ_k v_k·w_k / Σ_k w_k × 100`.
- **Critique des poids (`0.30/0.25/0.20/0.15/0.10`).** Structurellement corrects (convexes, somme 1), valeurs = jugement non calibré.
  - ⚠ **`stage_coverage 0.30` et `component_coverage 0.20` ne sont pas indépendants** : `stage_concentration` et `third_country` dérivent tous deux des observations d'étape → un trou d'étape déprime **les deux** sous-composantes (compté ~deux fois). À résoudre (fusion, ou exclure de `component_coverage` les composantes dérivées des étapes).
  - ⚠ **`freshness 0.15`** décroît `−0.2/an` sur l'écart d'année **des observations d'étape seulement** → un jeu vieux de 5 ans score 0, et la fraîcheur des événements/substituts/marché est ignorée. Pente arbitraire, partielle.
  - ⚠ **`license_access 0.10`** mesure la santé des données **de marché** qui **n'alimentent pas** le risque ; le défaut `market_observations_count==0 → 0.5` est une valeur magique.
- **Recommandations.** Documenter chaque poids ; OAT sensibilité sur les poids de confiance (B.8) ; pente de fraîcheur en constante nommée couvrant tous les types de faits ; résoudre le double-comptage de couverture.
- **Tests.** monotonie par sous-composante (ceteris paribus) ; bornes (tout-0→0, tout-1→100) ; risque invariant à toute entrée de confiance (présent) ; fraîcheur aux bornes d'année ; chemin du défaut licence.

### B.7 Intensités — DÉSAMBIGUÏSER (point de décision explicite)
Trois sens distincts — ne pas laisser un mot les confondre :
- **(a) Intensité matière** = kg matière / unité produit. **Unités** kg/unité. **Supportable maintenant** : `material_mappings.mass_value/mass_unit` × `bom_items.quantity` (tenant, sans licence externe).
- **(b) Intensité carbone** = kgCO2e / kg matière. **Unités** kgCO2e/kg. **Partiellement supportable** : `emission_factors` (001) a `factor_kgco2e` par `kg`, `category='materials'`, ADEME, versionné — **mais** (i) **pas de crosswalk `material_id → ef_code`**, (ii) le catalogue ADEME générique **manque probablement de facteurs terres-rares / aimants**. Pour les ressources stratégiques : généralement **de NOUVEAUX facteurs sourcés via l'Evidence Kernel** requis — **ne pas fabriquer de kgCO2e/kg pour les terres rares.**
- **(c) Intensité d'appro./exposition** = degré d'exposition tenant. **Unités** kg/an, €/an, % d'appro. **Supportable maintenant** : `company_material_exposures` (`annual_mass_kg`, `annual_spend_eur`, `share_of_supply_pct`).
- **Décision MODULE 2.** Nommer les trois séparément ; décider si l'intensité **carbone** est même dans le périmètre MODULE 2 (peut relever du MODULE 1). (a) et (c) partent des données existantes ; (b) exige un crosswalk + probablement de nouveaux facteurs sourcés — sinon l'omettre plutôt que l'inventer.
- **Tests.** gardes de cohérence d'unités (kg vs t vs €) ; rapport de couverture du crosswalk ; test que (b) n'est émis **que** là où un facteur sourcé existe.

### B.8 Analyse de sensibilité — ABSENTE ; **livrable requis**
- **Méthode : perturbation un-à-la-fois (OAT).**
  1. Baseline `S0` (poids nominaux `w`, entrées `x`).
  2. **Perturbation de poids.** Pour chaque composante disponible `k` : `w_k → w_k(1±δ)` (ex. δ=0,20), **renormaliser exactement comme `compute_score`**, recalculer `S`. Enregistrer `ΔS` et l'élasticité `E_k = (ΔS/S0)/(±δ)`. Classer par `|E_k|` (tornado).
  3. **Perturbation d'entrées.** Par étape, bouger la part du 1ᵉʳ pays `±δ` (renormaliser le reste) → recalcul HHI + composite ; parts fournisseurs idem ; `stock_coverage_days ±δ` ; maturité substitut / sévérité événement au cran adjacent. Enregistrer `ΔS`, **et si l'étape pire sélectionnée ou le classement des drivers change.**
  4. **Robustesse du classement (inter-matières).** Compter la **fréquence d'inversion de rang** sous le jeu de perturbations ; un classement qui bascule sous un coup de 20 % n'est pas robuste.
  5. **Restitution.** Tornado (composante vs `|ΔS|`), **bande de stabilité** `S0 ± max|ΔS|` (ex. « 62 ± 8 »), avertissements d'inversion de rang explicites.
- **Warnings sur la fausse précision.** `risk_score` est imprimé à 2 décimales mais typiquement stable à ±plusieurs points ; **ne jamais** traiter un écart de 1–2 points entre matières comme un signal. La plage δ est arbitraire et doit être reportée. **La sensibilité montre la fragilité ; elle ne valide pas le modèle.** Ne tourne pas si `risk_score is None`. La renormalisation sur composantes disponibles rend déjà **incomparables** deux matières à ensembles disponibles différents — figer l'ensemble disponible dans une comparaison, ou reporter la couverture à côté de la bande.
- **Tests.** déterminisme préservé ; perturber le poids d'une composante **indisponible** = **zéro** effet ; signe d'élasticité correct ; matière mono-driver → forte sensibilité à ce driver ; bande contient `S0` ; détecteur d'inversion se déclenche sur une quasi-égalité construite ; OAT sauté proprement si `risk_score is None`.

### B.9 Limites des scores composites — la liste honnête
1. **Arbitraire des poids** — `0.30/0.15/0.15/0.10/0.10/0.10/0.10` = jugement, pas dérivé.
2. **Compensabilité** — la pondération additive laisse une composante basse masquer une haute (raffinage mono-pays compensé par bon recyclage → « moyen »). Envisager un **compagnon non-compensatoire** (drapeau si une composante est extrême ; afficher le `max` à côté de la moyenne).
3. **Non-comparabilité inter-matières** — la renormalisation sur composantes **disponibles** score des matières sur des bases de poids effectives différentes ; `coverage_pct`/`confidence` diffèrent ; l'agrégat n'est pas une clé de classement like-for-like.
4. **Biais de renormalisation / couverture** — cf. B.1 ; une étape à faible `observed_total` entre à plein poids.
5. **Agrégation inter-étapes** — le code **refuse correctement** de moyenner (sélectionne via `max`). À préserver. Le composite mêle une concentration **niveau-monde**, un HHI fournisseurs **niveau-tenant** et substituts/recyclage **niveau-matière** — trois niveaux d'analyse sommés en un nombre (choix de modélisation à énoncer).
6. **Ordinal-comme-cardinal** — ancres `{10,30,60,85}`/`{20,45,75,95}` traitent des catégories ordonnées comme cardinales.
7. **Dérivation, jamais officiel** — toujours `estimated` ; jamais une note UE/CRMA (déjà appliqué/disclaimé).
- **Reco.** **Toujours exposer composantes et drivers** (fait), jamais l'agrégat seul ; afficher `confidence`, `coverage_pct`, l'étape pire sélectionnée et la bande de stabilité (B.8) à côté de `risk_score` ; préférer un **profil/radar** de composantes à un chiffre unique.

---

## C. Formules REJETÉES + justification

| Formule rejetée | Raison |
|---|---|
| **risque × confiance** | Écrase deux axes orthogonaux ; « on ne sait pas » se déguiserait en « faible risque » ; une matière haut-risque/basse-confiance lirait « sûr ». Interdit par conception (colonnes séparées, ensembles de composantes disjoints). |
| **Moyenne du HHI inter-étapes** | Produit un nombre ne décrivant aucun marché réel et masque le point d'étranglement concentré. Le code prend `max`/sélectionne une étape. |
| **Compter le manquant comme risque zéro** | Inverse le sens de l'absence (« aucun substitut consigné » → « substitution facile ») ; biais vers la fausse réassurance. Le code marque `available=False` et renormalise. |
| **Score de criticité opaque unique (poids cachés)** | Non inspectable, non auditable, non reproductible ; drivers non traçables ; invite à le prendre pour officiel. Le code publie chaque composante (valeur/poids/contribution/rationale) et `risk = Σ contributions`. |
| **Pondérations risque-pays non sourcées** | Un nombre de risque par pays est une affirmation factuelle sur le monde ; l'inventer viole `*_sourced_check` et « no uncited normative answer ». Doit arriver via Evidence Kernel (WGI/OECD/GTA). |
| **Sparklines / séries temporelles à partir d'un seul point de prix** | Une courbe implique une série inexistante (information visuelle fabriquée). Règle permanente : un point de prix par matière, pas de sparkline sans vraie série. |
| **Présenter le score CarbonCo comme note officielle UE/CRMA** | C'est la méthode versionnée `CC-MATERIAL-EXPOSURE 0.1.0` ; `DISCLAIMER` + `is_official_eu_score=False` sérialisés ; `methodology_code` ≠ `regulation_version`. |

---

## D. Décisions méthodologiques ouvertes pour MODULE 2 (→ `MODULE2_DECISIONS.md`)

1. **Risque-pays (UNRESOLVED).** Ingérer WGI (ou restriction commerciale) via Evidence Kernel, choisir dimension(s) et carte `r_c`, porter les erreurs-types dans la confiance — **ou** garder binaire UE/hors-UE et le renommer « part hors UE ». Aucun poids codé en dur dans les deux cas.
2. **Échelle/seuils/garde de couverture HHI (UNRESOLVED).** Confirmer l'échelle 0–100 et relabelliser « HHI % » ; décider d'exposer les bandes DOJ via ÷100 (15/18/25) et `N_eff` ; poser une **garde de couverture minimale** ; envisager la bande de couverture.
3. **Périmètre des intensités (UNRESOLVED).** Décider lesquelles (matière / carbone / appro.) sont dans le périmètre ; crosswalk `material_id→ef_code` si carbone voulu ; n'émettre le carbone que là où un facteur est sourcé.
4. **Analyse de sensibilité (REQUISE — implémenter).** Fixer δ, décider la surface de sortie (tornado + bande + inversion de rang), et si la bande est persistée dans le JSON d'évaluation.
5. **Poids de confiance (UNRESOLVED).** Justifier/calibrer ou documenter comme jugement ; corriger la non-indépendance `stage_coverage`/`component_coverage` ; élargir la fraîcheur ; résoudre le défaut `license_access`.
6. **Provenance de composante (décision).** Attacher les `source_release_id` à chaque `ScoreComponent`.
7. **Vocabulaire de chaîne de valeur au-delà des aimants (décision).** `STAGE_ORDER` dans `scoring.py` (8 étapes aimants) **duplique** le semis DB de 034 §3bis. « Dépendances industrielles étendues » implique d'autres chaînes → semer des vocabulaires d'étapes **globaux par famille de matière** et piloter `scoring.py` depuis eux, plutôt que coder en dur — sinon les deux listes divergeront.
8. **Raffinements substitution (mineur/UNRESOLVED).** Garder meilleur-substitut ou ajouter la largeur de portefeuille ; exposer le coefficient `0.3` et les ancres comme constantes nommées et testées en sensibilité.
9. **Compagnons concentration fournisseurs (mineur).** Garder HHI ; option CR1 + nombre pour la lisibilité.

**Rien ci-dessus n'exige de réinventer le cœur.** Les invariants sont l'atout ; le travail de MODULE 2 est le **sourcing** (risque-pays, facteurs d'intensité), le **durcissement** (garde de couverture HHI, normalisation des codes), et l'**outillage d'honnêteté** (bande de sensibilité, provenance de composante).

---

## Références externes citées
- Lignes directrices fusions DOJ/FTC 2023 (seuils HHI) : Paul Weiss client memo ; Congressional Research Service LSB11138.
- Méthodologie WGI (6 dimensions, estimé −2,5..2,5 / percentile 0–100, modèle à composantes inobservées, erreurs-types) : World Bank WGI methodology paper ; WGI documentation.
