# MODULE 2 — Matrice des sources de données & licences

> **Phase :** cadrage (lecture seule). **Date de vérification de toutes les lignes : 2026-07-22.**
> Périmètre : **métadonnées de dataset + termes de licence uniquement**. Aucune donnée factuelle ingérée ici.
> Le millésime (« release ») est indicatif ; l'élément **portant** est la **licence** et le **droit d'usage dérivé**.
> Règle de conception CarbonCo rappelée : une donnée dont la licence **n'autorise pas l'usage dérivé** ne doit **jamais entrer dans un calcul**, et son absence **dégrade la CONFIANCE, jamais le RISQUE**. Voir `METHODOLOGY_AND_ALGORITHMS.md` et `services/intelligence/license_policy.py`.

## 1. Matrice

| # | Dataset | Éditeur | Millésime | Licence | Stockage | Affichage | Usage dérivé | Fréquence | Limites clés | Termes (URL) | Certitude |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mineral Commodity Summaries + Helium statistics (silicium métal, charbon à coke, uranium, hélium, métaux) | **USGS** (US Dept. of Interior) | MCS 2025/2026 (annuel) | **Domaine public US** (17 U.S.C. §105) | Oui | Oui | **Oui** | Annuel | Crédit demandé ; images tierces incrustées parfois © | usgs.gov/information-policies-and-instructions/copyrights-and-credits | confirmé |
| 2 | World Mineral Statistics / World Mineral Production | **BGS** (NERC) | 2019–2023 (2025) | **IPR custom restrictif** (© NERC, PAS OGL) | Non-comm. seul | Restreint | **Non (comm.)** | Annuel | Usage commercial / fourniture à tiers = permission écrite NERC | bgs.ac.uk/mineralsuk/statistics/world-mineral-statistics/…/ipr | confirmé |
| 3 | RMIS + Study on the Critical Raw Materials for the EU 2023 | **EU JRC / Commission** | CRM Study 2023 ; RMIS continu | **CC BY 4.0** / réutilisation UE (Déc. 2011/833/UE) | Oui | Oui | **Oui** | Continu / one-off | Données **JRC-authored** seulement ; séries tierces incrustées gardent leur licence | rmis.jrc.ec.europa.eu · data.jrc.ec.europa.eu/collection/id-00192 | confirmé |
| 4 | Prodcom, Comext, Energy statistics | **Eurostat** | Continu (Prodcom annuel ; Comext mensuel) | **CC BY 4.0** (politique de réutilisation Eurostat) | Oui | Oui | **Oui** | Mensuel/annuel | Réutilisation **commerciale restreinte** pour certaines données pays hors UE/AELE + commerce CH/AT ; contenu tiers exclu | ec.europa.eu/eurostat/web/main/help/copyright-notice | confirmé |
| 5 | UN Comtrade (flux/volumes commerciaux) | **UN Statistics Division** | Continu (annuel + mensuel) | **© ONU — « usage interne », re-dissémination restreinte** (pas une licence CC) | Oui (interne) | Conditionnel | **Oui (transformé)** | Continu | Re-dissémination du **brut** = consentement/redevance UNSD (levée pour apps gratuites/à but non lucratif) ; quotas API (sans jeton 100 req/h & 50k enr. ; jeton 10 000 req/h & 250k enr. ; plafond 100k enr./requête) | unstats.un.org/wiki/display/comtrade/Policy… | confirmé |
| 6 | FAOSTAT (bois, coton, caoutchouc naturel, lin, chanvre) | **FAO** | Continu (production annuelle) | **CC BY 4.0** + surcouche « DB terms » FAO | Oui | Oui | **Oui** | Continu | Surcouche FAO interdit l'usage « pour/en lien avec la promotion d'une entreprise commerciale » et toute implication d'aval/endossement | fao.org/contact-us/terms/db-terms-of-use/en | confirmé |
| 7 | Worldwide Governance Indicators (candidat risque-pays) | **World Bank** | Annuel ; MAJ 2024 (jusqu'à 2023) | **CC BY 4.0** (+ addendum contraignant WB) | Oui | Oui | **Oui** | Annuel | Pas d'endossement/logo ; clause de médiation ; certaines sources **sous-jacentes** propriétaires (pas l'indice publié) | datacatalog.worldbank.org/public-licenses | confirmé |
| 8 | Energy data (World Energy Balances/Statistics, WEO) | **IEA** | Éditions annuelles (2025) | **Propriétaire / « Non-CC Material »** ; WEO Free Dataset = CC BY-**NC**-SA 4.0 | Sous licence | Restreint | **Non** (accord signé + redevance) | Annuel | Même le WEO gratuit est **non-commercial** → inutilisable pour un calcul dérivé commercial | iea.org/terms | confirmé |
| 9 | Euratom Supply Agency Annual Report (parts d'appro. uranium, prix moyens) | **Euratom Supply Agency** (UE) | Annual Report 2024 | **CC BY 4.0** (réutilisation UE) | Oui | Oui | **Oui** | Annuel | Agrégats **ESA-authored** réutilisables ; références de prix marché incrustées = indicatives | euratom-supply.ec.europa.eu | confirmé |
| 10 | World Nuclear Association (référence uranium/nucléaire) | **WNA** | Web continu | **Propriétaire** (citation limitée ≤150 mots) | **Non** | Citation seule | **Non** | Continu | Affirmer © WNA ; pas de réutilisation de tables entières | world-nuclear.org/general/permission-for-use-of-content | confirmé |
| 11 | Transparency Platform (flux/capacité gaz) | **ENTSOG** | Temps quasi-réel | **Termes restrictifs, pas de licence ouverte** | Interne seul | **Non (consentement req.)** | **UNRESOLVED** (→ Non par défaut) | Temps réel | « shall not…display, republish, redistribute…without express prior written consent » ; plafond d'extraction ~7,5× util. moyen ; attribution « ENTSOG and/or its members » | entsog.eu/privacy-policy-and-terms-use | restrictif confirmé / usage dérivé **UNRESOLVED** |
| 12 | UxC (Ux U3O8 Price®) + TradeTech (prix uranium) | **UxC LLC ; TradeTech** | Hebdomadaire | **Propriétaire** | **Non** | **Non** | **Non** | Hebdo. | « may not be reproduced… without express permission » ; abonnés seulement | uxc.com/p/data/about-uranium-prices · uranium.info | confirmé |
| 13 | Statistiques/prix coton (World Cotton Database, Data Book, A-Index) | **ICAC** | Continu | **Propriétaire / abonnement** | **Non** | **Non** | **Non** | Continu | Licence utilisateur final ; « no right to make or authorize copies » | icac.org/publications/databook | confirmé |
| 14 | Statistiques/prix caoutchouc naturel | **ANRPC** | Rapports mensuels | **Propriétaire / abonnement** | **Non** | **Non** | **Non** | Mensuel | Diffusion sur abonnement seul | anrpc.org | confirmé |
| 15 | Benchmarks de prix matières (LME ; S&P Global Platts ; Argus ; Fastmarkets ; ICIS) — incl. silicium métal, charbon à coke, GNL, métaux | **PRAs privés** | Quotidien | **Propriétaire / abonnement** | **Non** | **Non** | **Non** | Quotidien | Redistribution interdite sans licence data payante | argusmedia.com · spglobal.com/commodityinsights · fastmarkets.com · lme.com | confirmé |
| 16 | Données marché gaz industriels (prix & volumes hélium/xénon/krypton/argon) | **Cabinets d'études + presse gaz** | Variable | **Rapports propriétaires** | **Non** | **Non** | **Non** | Variable | Réservé abonnés ; **USGS hélium (ligne 1) = principale exception OUVERTE** | (multiples sites éditeurs) | confirmé |

## 2. Correspondance vers les booléens CarbonCo (`source_registry`)

Ordre : `active / automated_access / storage / display / derived_use / commercial_use / redistribution / attribution_text`

- **1 USGS** — V / V / V / V / V / V / V / « Credit: U.S. Geological Survey » (demandé)
- **2 BGS WMS** — V / partiel / non-comm. seul / restreint / **F (comm.)** / **F** / **F** / « World Mineral Statistics contributed by permission of the British Geological Survey »
- **3 JRC RMIS / CRM Study** — V / V / V / V / V / V / V / « © European Union [année], source: JRC RMIS / European Commission »
- **4 Eurostat** — V / V / V / V / V / V (⚠ certaines données pays hors UE exclues) / V / « Source: Eurostat »
- **5 UN Comtrade** — V / V (quotas) / V / conditionnel / V (transformé) / restreint / **F (brut)** / « Source: UN Comtrade (© United Nations) »
- **6 FAOSTAT** — V / V / V / V / V / **conditionnel** (pas de promotion d'entreprise commerciale / endossement) / V / « FAO. [année]. [db: dataset]. Licence: CC BY 4.0 »
- **7 World Bank WGI** — V / V / V / V / V / V / V / « Worldwide Governance Indicators, World Bank — CC BY 4.0 (no endorsement) »
- **8 IEA** — V / **F** / sous licence / restreint / **F** / **F** / **F** / n/a (sous licence)
- **9 Euratom ESA** — V / n/a (PDF) / V / V / V / V / V / « © Euratom Supply Agency [année] — CC BY 4.0 »
- **10 WNA** — V / **F** / **F** / citation seule / **F** / **F** / **F** / « World Nuclear Association » (affirmer leur ©)
- **11 ENTSOG** — V / V (API gratuite) / interne seul / **F** / **UNRESOLVED→F** / **F** / **F** / « ENTSOG and/or its members »
- **12–16 UxC/TradeTech, ICAC, ANRPC, PRAs, rapports gaz industriels** — `active`=V / tout le reste **F** / attribution = donnée sous licence, non affichable brute

## 3. Sources OUVERTES / RÉUTILISABLES (stockage + affichage + dérivé avec attribution)

- **USGS Mineral Commodity Summaries + données Hélium** (domaine public) — **source ouverte d'ancrage** pour parts de production/réserves (silicium métal, charbon à coke, uranium, hélium, métaux). **Seule exception ouverte pour les volumes/prix d'hélium.**
- **EU JRC RMIS + EU CRM Study 2023** (CC BY 4.0 / réutilisation UE) — classifications de criticité, parts par étape de chaîne de valeur, concentration pays (figures **JRC-authored** seulement).
- **Eurostat — Prodcom, Comext, Energy** (CC BY 4.0) — volumes production/commerce/énergie UE. ⚠ restriction commerciale sur certaines séries pays hors UE et commerce CH/AT.
- **FAOSTAT** (CC BY 4.0) — production/surfaces **bois, coton, caoutchouc naturel, lin, chanvre**. ⚠ pas de promotion d'entreprise ni d'endossement implicite.
- **World Bank Worldwide Governance Indicators** (CC BY 4.0) — **couche risque-pays / gouvernance ouverte recommandée**. Pas d'endossement/logo.
- **Euratom Supply Agency Annual Report** (CC BY 4.0) — parts d'appro. uranium UE + points de **prix moyen ESA** (rare prix uranium semi-ouvert).

## 4. Sources PROPRIÉTAIRES / BLOQUÉES → `derived_use_allowed=false` (dégradent la CONFIANCE, jamais le RISQUE ; jamais d'affichage brut)

- **IEA energy data** — restreint ; produits dérivés = accord signé + redevance. Même le WEO gratuit est **CC BY-NC-SA** (non-commercial) → inutilisable pour un calcul dérivé commercial.
- **BGS World Mineral Statistics** — IPR NERC custom ; non-commercial seul ; usage commercial/dérivé/tiers = permission écrite. (Distinct des jeux OGL de BGS — WMS **n'est pas** OGL.)
- **ENTSOG Transparency Platform** — API en accès libre mais termes interdisant affichage/republication/redistribution sans consentement écrit ; droit d'usage dérivé flou (cf. UNRESOLVED).
- **World Nuclear Association** — citation seule (≤150 mots) ; pas de réutilisation de tables. Lecture de référence, pas source de données.
- **UxC (Ux U3O8 Price®) et TradeTech** — indicateurs de prix uranium propriétaires ; reproduction interdite sans permission ; abonnés seuls.
- **ICAC** (coton) et **ANRPC** (caoutchouc naturel) — abonnement / licence utilisateur ; pas de copie.
- **PRAs de prix — LME, S&P Global Platts, Argus, Fastmarkets, ICIS** — abonnement propriétaire ; redistribution interdite. Couvre les benchmarks **silicium métal, charbon à coke, GNL** et métaux.
- **Données marché gaz industriels (prix & volumes hélium/xénon/krypton/argon)** — très majoritairement rapports propriétaires. Seul **USGS hélium** est ouvert.
- **UN Comtrade — pour la redistribution/affichage du brut seulement** : usage interne et faits **transformés/dérivés** autorisés (peut donc sourcer des faits de part-pays dérivés), mais re-dissémination du brut bloquée sans consentement UNSD. Traiter les **tables brutes** comme bloquées, les **faits dérivés** comme utilisables-avec-attribution.

## 5. UNRESOLVED

- **ENTSOG Transparency Platform — droit d'usage dérivé exact.** Les termes du site principal sont clairement restrictifs (pas de redistribution/affichage sans consentement écrit), mais les termes dédiés de la Transparency Platform vivent dans un PDF séparé non entièrement récupéré. Droit d'usage dérivé précis = **UNRESOLVED** ; défaut = bloqué (dégrade la confiance) tant que le PDF n'est pas lu.
- **Millésimes exacts** de plusieurs séries (USGS MCS 2026 vs 2025 ; WGI 2024 vs une MAJ 2025 ; année d'édition BGS) : indicatifs, non vérifiés-licence — pas un bloqueur de licence, mais à confirmer avant de citer une release précise.

## 6. Conséquences de conception pour l'ingestion MODULE 2

- Toute observation de prix issue des lignes **8, 10–16** (et des tables brutes Comtrade) a `derived_use_allowed=false` → **ne doit PAS entrer dans un calcul**, et son absence **dégrade la CONFIANCE, jamais le RISQUE**. Critique pour les ressources dont la **seule** source de prix/volume est propriétaire : **xénon, krypton, argon** (aucune série ouverte — USGS ne couvre que l'hélium), **prix coton** (ICAC), **prix caoutchouc naturel** (ANRPC), **prix spot uranium** (UxC/TradeTech), **prix silicium métal / charbon à coke / GNL** (PRAs). Ces champs seront **faible-confiance-par-licence, pas faible-risque**.
- **FAOSTAT** et **Eurostat** portent des réserves commerciales **conditionnelles** (FAO : pas de promotion/endossement ; Eurostat : restriction commerciale pays hors UE) — régler `commercial_use_allowed` en conséquence plutôt qu'un `true` global ; `derived_use_allowed=true` tient pour les deux.
- Les sources ouvertes UE (3, 4, 9) se résolvent toutes en CC BY 4.0 / réutilisation UE → motif d'attribution commun possible.
