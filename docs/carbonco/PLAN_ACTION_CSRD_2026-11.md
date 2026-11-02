# PLAN D'ACTION CARBONCO — Mise à jour réglementaire CSRD · novembre 2026 → juillet 2027

> Fichier destiné à Claude Code et à Ludo. Travailler tâche par tâche, dans l'ordre des phases.
> **Sources** : « Dossier de maîtrise CSRD Carbon&Co » (état du droit au 2 novembre 2026, fichier Dropbox + artefact claude.ai du même nom) ; relecture du site en production `carbon-snowy-nine.vercel.app` le 2 novembre 2026 (accueil, /produit, /ai-act) ; cartographie du code au commit `e65d174` (master).
> **Suite de** `PLAN_ACTION_CARBONCO.md` (P0→P5 et P7 livrés, P6 différé). La numérotation continue : **P8 → P13**.
> **Budget** : inchangé, aucun service payant dans P8→P13. Ce qui coûte (horodatage qualifié eIDAS, attestation SOC 2 / ISO 27001, licence ecoinvent, facteurs AIE) rejoint P6 et ne démarre pas sans décision explicite.

---

## Avancement au 2 novembre 2026 (branche `claude/csrd-carbon-action-plan-2d9e85`, non mergée)

| Tâche | État | Ce qui a été fait |
|---|---|---|
| T8.1 | ✅ | `tests/regulatory-claims-guard.test.ts` : 23 règles, tout `app/`, `components/`, `lib/` scanné (67 fichiers en échec au départ, 0 à l'arrivée) |
| T8.2 | ✅ | Accueil réécrit ; frise réglementaire animée (`components/landing/regulatory-timeline.tsx`) ; bloc « ce que l'empreinte prouve » ; compteur de datapoints lu au build ; tarifs, sécurité, fonctionnalités alignés sur le registre |
| T8.3 | ✅ | 8 fiches /produit réécrites : « disponible » vs « feuille de route », scénarios illustratifs sans résultat client inventé |
| T8.4 | ✅ | /ai-act réécrite (2026/1744, art. 4, 50(1), 50(2), calendrier, FAQ) ; journal IA présenté comme en cours de déploiement |
| T8.5-T8.8 | ✅ | Badges, Trust, sous-traitants, méthodologie, brochure, glossaire, FAQ, blog, guides, démo, UI applicative, métadonnées |
| T8.9 | ✅ | FAQ post-Omnibus, dictionnaire de claims, Ed25519 retiré, AR6 retiré, journal IA au futur |
| T9.1 | ✅ code | `"regions": ["fra1"]` front + API, runtime edge retiré de `/api/openapi` — **à vérifier après déploiement** (`x-vercel-id`) |
| T9.2 | ◐ | Prompt copilote pseudonymisé (`lib/ai/pseudonymize.ts` + test) ; Voyage AI et Stripe ajoutés ; extraction toujours en appel direct Anthropic (non migrée vers AI Gateway) |
| T9.7 | ◐ | Rôle `auditor` retiré de la validation et du chargement démo ; historique de revue append-only (`reviewHistory`) ; droit de commentaire non fait |
| T10.4 | ◐ | Règle bloquante MB > LB remplacée par une information ; total GES accepté en LB ou MB ; garde de matérialité non faite |
| D8 | tranché | Export iXBRL en **bêta** au registre (`ixbrl-eseef`), avec mention « non validé par un validateur XBRL indépendant » — validation Arelle (T10.6) toujours à faire |

Restent entièrement à faire : T9.3-T9.6, T10.1-T10.3, T10.5-T10.9, P11, P12, P13.

---

## 0. MODE D'EMPLOI

1. Ordre : **P8 → P9 → P10 → P11 → P12**, P13 en continu. P8 et P9 ont des **échéances dures** (10 novembre et 2 décembre 2026). P11 peut démarrer en parallèle de P10 dès que T10.1 est mergée.
2. **Une tâche = une branche = une PR.** Nommage : `fix/T8.2-vitrine-accueil-2026`, `feat/T10.1-version-referentiel`.
3. Une tâche n'est terminée que si tous ses **critères d'acceptation (CA)** sont vérifiables (test automatisé ou capture reproductible).
4. À chaque merge : cocher la case `[ ]` de la tâche dans CE fichier, ajouter une ligne au `CHANGELOG.md`, mettre à jour `apps/carbon/data/feature-status.json` si un statut change (`derniere_maj`).
5. **Toute affirmation réglementaire** ajoutée au site cite son texte (numéro, date) et passe par le registre réglementaire de T13.1 dès qu'il existe. Jamais de date ou de numéro de texte codé en dur dans un composant après T13.1.
6. Ambiguïté : choisir la formulation la plus sobre et la plus datée, noter la décision dans la PR. **Ne jamais résoudre une ambiguïté par une promesse.**

### Garde-fous absolus (en plus de ceux du plan P0→P7)

- ❌ Aucun des mots du lexique interdit (annexe A) dans l'UI publique, l'UI applicative, les exports, les métadonnées SEO et les prompts système du copilote.
- ❌ Jamais « conforme », « certifié », « validé », « prêt pour l'audit », « infalsifiable », « inviolable », « immuable » appliqués au produit ou à ses sorties. Le produit décrit sa méthode ; seul un vérificateur inscrit à la H2A certifie un rapport.
- ❌ Jamais « ESRS Set 2 », « dépôt ESEF », « conforme ESEF », « compatible ISSA 5000 / ISAE 3000 ».
- ❌ L'IA ne produit **jamais** un chiffre publié : elle rédige à partir de chiffres calculés et tracés.
- ✅ Chaque statut produit affiché provient de `feature-status.json` (règle T0.2). Aujourd'hui la vitrine contredit le registre sur au moins cinq points (voir 0.2) : P8 les aligne.
- ✅ Chaque texte cité porte : numéro, date, statut au jour J (« en vigueur », « applicable à compter de », « projet », « en cours de transposition »).

### Décisions humaines requises (NE PAS trancher dans le code — demander à Ludo)

| ID | Décision | Défaut appliqué si silence |
|---|---|---|
| D8 | Statut public de l'export iXBRL : « bêta » (le dossier) ou « planifié » (le registre actuel, `ixbrl-eseef`) | **Bêta** si le builder produit un fichier valide sur la taxonomie EFRAG 2024 (vérifié en T10.6), sinon « planifié ». Dans les deux cas, plus jamais « ESEF ». |
| D9 | Module Taxonomie verte : MVP (seuil 10 %, exemption OpEx, check-list DNSH) ou « en feuille de route » | **Feuille de route** : retrait des mots-clés, mention honnête (T8.8). MVP reporté en P12 optionnel (T12.6). |
| D10 | Ancrage externe de la chaîne de hachage : OpenTimestamps (gratuit, Bitcoin) ou horodatage RFC 3161 (TSA gratuite non qualifiée) ; l'horodatage qualifié eIDAS est payant → P6 | **RFC 3161 via une TSA publique gratuite**, avec adaptateur pour basculer vers un prestataire qualifié plus tard. |
| D11 | Libellés SOC 2 / ISO 27001 : « en évaluation » (le site) ou « planifiée » (le registre `certifs-soc2-iso`) | **« Planifiée »** tant qu'aucun auditeur n'est mandaté. Le dossier tolère « en évaluation » ; le registre fait foi. |
| D12 | Calculateur de ROI de l'accueil (« économie annuelle estimée… 60 % ») | **Conserver**, sous le titre « Simulation sur hypothèses non mesurées », avec les hypothèses visibles et la mention « à mesurer avec nos pilotes 2026 ». |
| D13 | Renommer l'offre tarifaire « VSME · 490 €/mois » | **« Norme volontaire (VS) · 490 €/mois »**, sous-titre « ex-VSME, règlement délégué (UE) 2026/1560 ». |
| D14 | Région d'exécution Vercel : `fra1` (Francfort, à côté de Neon `eu-central-1`) ou `cdg1` (Paris) | **`fra1`**, pour la latence avec Neon. |
| D15 | Jeu de PRG à figer : GIEC AR6 (ce qu'annonce /produit) ou AR5 | **AR6**, stocké par calcul ; recalcul des fluides frigorigènes documenté comme changement de méthode (T11.2). |
| D16 | Signature du manifeste de l'Evidence Pack : l'implémenter (Ed25519, clé en variable d'environnement, coût nul) ou retirer le mot « signé » | **Retirer en P8** (T8.9), **implémenter en P11** (T11.7) ; le mot « signé » ne revient qu'avec le code. |

---

## 0.1 Le calendrier qui pilote ce plan

| Date | Événement (source : dossier, chap. 1, 3, 6) | Conséquence produit | Tâche |
|---|---|---|---|
| **10 nov. 2026** | ESRS 2026 (règl. délégué (UE) 2026/1563) en vigueur | Le site ne peut plus parler de « Set 2 » ni de révision « attendue » | P8 |
| 11 nov. 2026 | Fin de la consultation EFRAG sur le projet de taxonomie XBRL ESRS 2026 | Afficher la taxonomie visée et la migration prévue | T10.6 |
| **2 déc. 2026** | AI Act art. 50(2) exigible pour les systèmes déjà sur le marché avant le 2 août 2026 | Marquage lisible par machine des textes générés par NEURAL | T9.4 |
| 15 déc. 2026 | ISSA 5000 applicable (périodes ouvertes à compter de cette date) | Formulation « conçu pour faciliter les travaux du vérificateur (lignes directrices H2A, ISSA 5000) » | T8.2 |
| Exercice 2026 | Vague 1 : trois options (ESRS 2023 + quick fix 2025/1416, ESRS 2026 anticipés, mixte) | Trois référentiels actifs, version tracée par rapport | T10.1, T10.5 |
| **1er janv. 2027** | ESRS 2026 obligatoires ; plafond chaîne de valeur applicable (exercices ouverts à compter de cette date) | Questionnaires fournisseurs tagués et plafonnés | T12.2 |
| T1 2027 | Amendements Taxonomie attendus (avis ESMA du 29 oct. 2026, EBA) | Si D9 = MVP, prévoir la version de l'acte par exercice | T12.6 |
| **19 mars 2027** | Date limite de transposition de l'Omnibus en France (PJL DDADUE 2026, non promulgué fin oct. 2026) | Diagnostic d'éligibilité à deux couches UE / France | T12.1 |
| 24 mai 2027 | Révision des listes CRMA | Version de liste affichée sur /materials et /crma | T12.5 |
| 1er juil. 2027 | Norme européenne d'assurance limitée attendue | Revoir le discours « vérificateur » | T13.2 |
| 30 sept. 2027 | Première déclaration annuelle CBAM (importations 2026) | Le module CBAM reste une estimation d'exposition | T12.7 |
| Fin 2028 | Norme GHG Protocol consolidée (scope 2 market-based possiblement horaire) | Veille : impact sur tous les scope 2 | T13.2 |

---

## 0.2 Synthèse des écarts relevés

Constats faits le 2 novembre 2026 sur la production et dans le code. « Dossier » renvoie au chapitre du dossier de maîtrise qui fonde la correction.

| # | Constat (site ou code) | Où | Dossier | Tâche |
|---|---|---|---|---|
| E1 | « ESRS Set 2 » partout (accueil, tarifs, in-app, référentiel `esrs-set2.json` daté « EFRAG nov. 2025 ») | `landing-page.tsx` (650, 678, 751, 837-839, 1091, 1112, 1130), `lib/esrs-set2.json`, `lib/datapoints/*`, `lib/ixbrl/*`, `app/api/datapoints/*` | ch. 2, 3 §1.4, 7 | T8.2, T10.2 |
| E2 | « 127 datapoints » sans référentiel ni date ; le builder iXBRL n'en balise que 107 | `landing-page.tsx:678`, `lib/ixbrl/builder.ts:15` | ch. 2 | T8.2, T10.2 |
| E3 | « iXBRL ESEF », « prêt pour soumission ISAE 3000 ou dépôt ESEF », « iXBRL ESEF conforme » | `landing-page.tsx:262-274, 830`, `reports-page.tsx:234-252`, `export-ixbrl-button.tsx:5-205`, `nav-config.tsx:100`, `trust/exit-strategy/page.tsx:46` | ch. 3 §2.4, 7 | T8.2, T8.6, T10.6 |
| E4 | « Votre conformité CSRD, automatisée » (titre de l'accueil), « Rapports conformes CSRD, CDP, bilan GES en 1 clic », « Votre conformité ESRS globale est de 63 % » | `landing-page.tsx:124, 624, 1228`, `premium-dashboard-mockup.tsx:78`, `login-screen.tsx:176`, `lib/data.ts:350` | ch. 7 | T8.2, T8.6 |
| E5 | VSME « dont l'adoption par acte délégué est attendue à l'été 2026 » ; « environ 10 000 entreprises » non sourcé | `landing-page.tsx:704`, `guide-csrd-vsme-2026/page.tsx:158-164`, `blog/vsme-standard-chaine-valeur/page.tsx:25-34`, `blog/vsme-devient-vs-2026/page.tsx:23-53` | ch. 3 §1.3, §1.5, 7 | T8.2, T8.7 |
| E6 | « La chaîne devient infalsifiable », « journal inviolable », « audit trail immuable », « signé SHA-256 » (un hash n'est pas une signature) | `product-modules.ts:113, 314`, `why-proof-first.tsx:18`, `methodologie/page.tsx:108`, `landing-page.tsx:750, 1190`, `infographies.tsx`, `trust-badges.tsx:86`, `security-architecture.tsx`, démo phase 5 | ch. 4 §2.5, 7 | T8.2-T8.6 |
| E7 | « Rapport prêt OTI », « OTI ready », « signé OTI », « Compatible OTI », « Statut OTI · prêt », « mission OTI raccourcie de 30 à 50 % » | `product-modules.ts:147-149, 291-293`, `how-it-works.tsx:262, 348`, `sector-mockups.tsx:371, 447`, `illustrations.tsx:197-218`, `infographies.tsx:239, 332`, `onboarding-tour.tsx:48`, `brochure-client.tsx:191` | ch. 7 | T8.3, T8.6 |
| E8 | « Calculs Scope 1/2/3 conformes ADEME, IPCC, DEFRA, GHG Protocol », « Synchronisation automatique avec les bases ADEME et IPCC » | `product-modules.ts:77, 89` | ch. 4 §2.1, 7 | T8.3 |
| E9 | /ai-act cite l'article 26 (déployeur de système à haut risque) et l'annexe IV ; ignore l'article 4, l'art. 50(2), le règlement 2026/1744 ; dit que NEURAL restitue des « chiffres » ; « applicable par paliers jusqu'en 2027 » | `app/ai-act/page.tsx:104-137` | ch. 3 §1.7, 6 §5, 7 | T8.4 |
| E10 | « Infrastructure EU (Vercel/Neon) » et « hébergement entièrement européen » alors que les fonctions Vercel tournent aux États-Unis (aucun `regions` dans `vercel.json`, ni côté front ni côté API) | badge de l'accueil, `lib/claims-dictionary.ts` (`HOSTING.current`), `brochure-client.tsx:210`, `trust/page.tsx:24`, `trust/sub-processors/page.tsx:26-30`, `apps/carbon/vercel.json`, `apps/api/vercel.json` | ch. 7 | T9.1 |
| E11 | « Le règlement DORA et les exigences CSRD imposent une traçabilité totale » : DORA vise la résilience numérique des entités financières, pas le reporting de durabilité | `landing-page.tsx:1187`, `trust-badges.tsx:6` | (hors dossier) | T8.2 |
| E12 | « Scope 3 cat. 8 : serveurs, cloud, SaaS » : un service cloud acheté relève de la catégorie 1 | `landing-page.tsx:722` | ch. 4 §2.1 | T8.2, T11.5 |
| E13 | « RGPD · Conforme » et « CSRD-Ready » affichés comme badges « vérifiés » | `trust-badges.tsx:82, 87` | ch. 7 (lexique) | T8.5 |
| E14 | Vitrine en contradiction avec le registre : SSO & RBAC (planifié) vendu en Enterprise ; signature électronique (eIDAS planifiée) annoncée ; « Benchmark sectoriel » et « Mobile-first » absents du registre ; ESRS E2–E5 planifiés mais « 10 standards » vendus | `landing-page.tsx:867-870, 1130`, `how-it-works.tsx` | règle T0.2 | T8.2 |
| E15 | Mots-clés SEO « Taxonomie verte » sans module ; widget in-app « Taxonomie verte — Alignement activités » | `app/layout.tsx:77`, `deadlines-widget.tsx:32`, `blog/page.tsx:8` | ch. 3 §1.6, 7 | T8.8 |
| E16 | Facteurs « Ecoinvent 3.9 » et « Facteurs IEA » montrés dans la démo et la modale méthodologie (bases payantes, redistribution encadrée) | `how-it-works.tsx:167, 333`, `methodology-modal.tsx:14` | ch. 4 §2.1 | T8.6 |
| E17 | « Conforme ESRS 1 §3 » (méthodologie double matérialité du blog) | `blog/double-materialite/page.tsx:27`, `lib/blog-articles.ts:70` | lexique | T8.7 |
| E18 | Page BEGES : présente le BEGES comme « indépendant de la CSRD et de l'Omnibus », sans la dispense de la loi n° 2025-391 ni sa perte pour les entreprises qui sortent du champ | `app/bilan-carbone-beges/page.tsx:4-6` | ch. 3 §1.7 | T12.3 |
| E19 | Aucune mention, dans tout le front, de 2026/1563, 2026/1560, 2025/1416, 2026/73, 2026/1744, de la H2A ni de la loi 2025-391 | `grep` sur `apps/carbon/{app,components,lib,data}` | ch. 2, 3 | P8, T13.1 |
| E20 | Le garde-fou `tests/claims-guard.test.ts` ne scanne que l'accueil, le login, `components/landing`, la modale méthodologie et /materials : /produit, /ai-act, /trust, le blog, la démo et l'UI applicative lui échappent | `tests/claims-guard.test.ts:82-130` | — | T8.1 |

**Écarts de fond relevés dans le code** (cartographie fonctionnelle ; les points marqués ✔ ont été revérifiés à la main) :

| # | Constat | Où | Dossier | Tâche |
|---|---|---|---|---|
| E21 ✔ | Le validateur bloque en **erreur** tout scope 2 market-based supérieur au location-based. Or le market-based sans instrument applique le mix résiduel, souvent plus carboné : c'est le cas normal, et la question piège n° 1 de l'axe 2 | `lib/datapoints/rules-set2.ts:32-42` | ch. 4 §2.1 | T10.4 |
| E22 | Total GES : le validateur additionne le market-based, le total « réglementaire » du classeur prend le location-based ; ESRS E1-6 demande les deux totaux | `rules-set2.ts:43-52`, `api/services/carbon/workbook_totals.py:11-13` | ch. 4 §2.1 | T10.4 |
| E23 ✔ | PRG des fluides frigorigènes en valeurs **AR4** (R-134a 1430, R-404A 3922) alors que /produit annonce « PRG IPCC AR6 » ; aucune version GIEC stockée | `api/scripts/seed_factors.py:315-321`, `lib/product-modules.ts:206` | ch. 4 §2.1 | T8.9, T11.2 |
| E24 ✔ | « Manifeste signé par une clé Ed25519 » et « Evidence Pack ZIP signé » : aucun code de signature dans le backend | `app/trust/exit-strategy/page.tsx:107`, `lib/claims-dictionary.ts:92`, `api/services/export_package.py:2` | ch. 4 §2.5 | T8.9, T11.7 |
| E25 ✔ | /ai-act affirme que « toute invocation du copilote est tracée dans un journal d'audit » : les réponses du copilote ne sont ni stockées ni journalisées | `app/ai-act/page.tsx`, `app/api/copilot/route.ts` | ch. 6 §5 | T8.4, T9.4 |
| E26 ✔ | « Accès auditeur en lecture seule » promis, mais le rôle `auditor` peut valider ou rejeter un datapoint, et la validation écrase l'état sans historique | `app/api/datapoints/review/route.ts:57, 127-163` | ch. 4 §2.5 | T9.7 |
| E27 ✔ | La FAQ publie encore les seuils d'avant l'Omnibus (250 salariés / 50 M€ / 25 M€, vagues 2 et 3) ; le dictionnaire de claims date l'Omnibus du « 26 février 2025 » et présente le VSME comme une recommandation | `lib/faq-entries.ts:49`, `app/blog/csrd-2027-checklist/page.tsx:25`, `lib/claims-dictionary.ts:104-107` | ch. 3 §1.3 | T8.9 |
| E28 ✔ | Sous-traitants : la page affirme que les prompts ne contiennent pas de noms d'entreprises, or le prompt du copilote injecte la raison sociale ; Voyage AI (embeddings) et Stripe sont absents de la liste ; Upstash Vector indexe des documents clients ; l'extraction appelle Anthropic en direct, hors AI Gateway | `trust/sub-processors/page.tsx:67`, `app/api/copilot/route.ts:133, 142`, `lib/rag/embeddings.ts`, `app/api/stripe/**`, `app/api/datapoints/extract/route.ts:13` | ch. 7 | T9.2 |
| E29 | Rien n'empêche de publier un datapoint d'un sujet jugé non matériel ; le mode brouillon de l'export iXBRL embarque des valeurs non validées | `validator.ts:267-301`, `api/services/iro/disclosure_mapping_service.py:41-56`, `export-ixbrl/route.ts:104-109` | ch. 3 §1.4 | T10.4, T10.6 |
| E30 | Aucun diagnostic de champ CSRD ; la dispense BEGES de la loi 2025-391 est une note statique jamais évaluée | `api/services/beges_export.py:50-111`, `lib/beges-eligibility.ts` | ch. 3 §1.3, §1.7 | T12.1, T12.4 |
| E31 | Le référentiel ne contient aucun datapoint ESRS 1 / ESRS 2 (informations générales, obligatoires pour tous) ; aucune version, aucun identifiant de la liste EFRAG ; 107 obligatoires + 20 facultatifs = « 127 » | `lib/esrs-set2.json`, `lib/esrs/schema.ts` | ch. 2, 3 §1.4 | T10.2 |
| E32 | Consolidation : contrôle opérationnel et contrôle financier pondèrent toutes les filiales à 100 % ; pas de quote-part | `api/services/consolidation_service.py:40-44` | ch. 3 §1.4 | T11.11 |
| E33 | BEGES : tout le scope 1 en poste 1.1, tout le scope 2 en 2.1, catégories scope 3 8/10/13/14 en 6.1 ; risque de double compte du scope 3 | `api/services/beges_export.py:114-171` | ch. 3 §1.7 | T11.15 |
| E34 | Incertitude : pas de colonne sur les facteurs ; scope 2 = « 1 − confiance » (« pas une propagation ») ; part monétaire du scope 3 comptée en lignes, jamais en tCO₂e | `api/services/calculations/scope2.py:245-248`, `procurement.py:119-135, 780-852` | ch. 4 §2.1 | T11.4, T11.6 |
| E35 | Norme volontaire : 47 datapoints « v2024.12 » (EFRAG, déc. 2024), questions fournisseurs à champs fixes, ni catégories (nécessaire / si applicable / volontaire / sectorielle) ni plafond ; /scope3-fournisseurs présente encore la VS comme un projet | `api/data/vsme_datapoints.json`, `app/q/[token]/page.tsx:261-331`, `app/scope3-fournisseurs/page.tsx:10-231` | ch. 3 §1.5 | T8.7, T10.7, T12.2 |
| E36 | Corpus RAG du copilote : 31 extraits non versionnés, numérotés 2023, cite le « VSME ED » (exposure draft) | `api/services/esrs_corpus.py:490` | ch. 2 | T10.9 |

---

## P8 — VÉRACITÉ RÉGLEMENTAIRE DE LA VITRINE (≈ 3 jours · avant le 10 novembre 2026 · coût : 0 €)

> Objectif : qu'un DAF, un directeur RSE ou un commissaire aux comptes qui lit le site le 10 novembre 2026, jour d'entrée en vigueur des ESRS 2026, ne puisse relever ni un texte périmé, ni une promesse qu'un logiciel ne peut pas tenir. Le fond du site est honnête (statut « non commercialisé », valeurs « estimées ») ; ce sont des mots qui exposent Carbon&Co.

### [ ] T8.1 — Étendre le garde-fou de claims AVANT toute réécriture
**Pourquoi d'abord :** sans lui, les tâches suivantes se défont à la prochaine PR.
**Étapes :**
1. Dans `apps/carbon/tests/claims-guard.test.ts`, ajouter à `FORBIDDEN_CLAIMS` (scope `all` sauf mention) :
   - `/ESRS\s+Set\s*2|Set\s*2\s+complet|datapoints?\s+Set\s*2/i` → « Set 2 » est ambigu et périmé : écrire « ESRS 2026 (2026/1563) ».
   - `/ESEF/` hors `app/etat-du-produit` et `app/couverture` (scope `public` + in-app) → aucun dépôt ESEF de durabilité n'est exigible (directive 2026/470).
   - `/infalsifiable|inviolable|tamper-?proof/i` → « modification détectable ».
   - `/\bimmuable\b/i` sur la vitrine et l'audit trail seulement (les « runs immuables » du module Ressources désignent une contrainte de base de données et restent permis : exempter `app/(app)/resources/**`, `components/resources/**`, `lib/api/resources.ts`, `app/water/**`).
   - `/sign[ée]e?\s+SHA-?256|Signature\s+SHA-?256/i` → un hash n'est pas une signature.
   - `/pr[êe]t\s+(pour\s+(l'|l’)?audit|OTI)|OTI\s+ready|sign[ée]\s+OTI|Compatible\s+OTI|Statut\s+OTI/i`.
   - `/ISAE\s*3000|ISSA\s*5000/` sauf dans la phrase autorisée « lignes directrices H2A, ISSA 5000 » (whitelist exacte).
   - `/conformes?\s+(ADEME|IPCC|DEFRA|GHG|CSRD|ESRS|VSME)|Rapports?\s+conformes|conformit[ée]\s+(CSRD|ESRS)/i`.
   - `/30\s*(à|-)\s*50\s*%/` → gain de mission non mesuré.
   - `/attendue?\s+(à|a)\s+l'?été\s+2026|adoption\s+par\s+acte\s+délégué\s+est\s+attendue/i` → la norme volontaire est adoptée.
   - `/\bDORA\b/` sur la vitrine → hors sujet.
   - `/Scope\s*3\s*cat\.?\s*8[^.]{0,30}cloud/i` → le cloud acheté est en catégorie 1.
   - `/ESRS\s+native/i` → formule creuse.
   - `/Ecoinvent|Facteurs\s+IEA/i` sur la vitrine → bases payantes non intégrées.
2. Étendre `FILES_TO_SCAN` : `app/produit/**`, `lib/product-modules.ts`, `app/ai-act/page.tsx`, `app/trust/**`, `app/methodologie/page.tsx`, `app/blog/**`, `lib/blog-articles.ts`, `app/guide-csrd-vsme-2026/page.tsx`, `app/bilan-carbone-beges/page.tsx`, `app/cbam/page.tsx`, `app/brochure/**`, `components/demo/**`, `components/ixbrl/**`, `components/pages/reports-page.tsx`, `components/pages/datapoints-page.tsx`, `components/ui/onboarding-tour.tsx`, `components/dashboard/**`, `lib/nav-config.tsx`, `lib/data.ts`, `lib/claims-dictionary.ts`, `app/layout.tsx` (métadonnées).
3. Ajouter un second test, `tests/regulatory-references.test.ts` : si un fichier scanné contient « VSME » sans « norme volontaire » ou « VS » dans le même fichier, échec ; si un fichier contient « ESRS » et une date 2026 sans « 2026/1563 » dans la même page publique, avertissement (`it.todo` tant que T13.1 n'est pas livrée).
4. Lancer le test sur `master` : il DOIT échouer (preuve que le filet attrape les 20 écarts de 0.2). Committer le test en `describe.skip` dans la première PR, puis le réactiver dans la PR qui clôt T8.7.
**CA :**
- Sur `master` non corrigé, le test liste au moins E1, E3, E4, E5, E6, E7, E8, E9, E11, E12, E16.
- Après P8, `npm test` est vert avec le test réactivé, sans exemption ad hoc hors de la liste documentée en tête de fichier.

### [ ] T8.2 — Page d'accueil (`components/pages/landing-page.tsx` et `components/landing/**`)
**Étapes (lignes au commit e65d174) :**
1. **Titre (624)** : « Votre conformité CSRD, automatisée. » → « Votre reporting CSRD, prouvé jusqu'à la cellule source. » Sous-titre conservé.
2. **Badge (650)** : « ESRS Set 2 + iXBRL ESEF beta » → « ESRS 2026 (2026/1563) · export iXBRL bêta ». Badge « Infrastructure EU (Vercel/Neon) » : le conserver **uniquement après T9.1** ; d'ici là « Données stockées en UE (Neon Francfort) ».
3. **Chiffres clés (678-679)** : « 127 · Datapoints ESRS Set 2 » → « 127 · datapoints ESRS couverts · liste EFRAG [version, date] » (valeur et date lues depuis le référentiel, cf. T10.2 ; en attendant : « référentiel interne du 05/05/2026 »). « iXBRL · Export ESEF beta » → « iXBRL · export bêta · taxonomie EFRAG 2024 ».
4. **Contexte réglementaire (704)** : remplacer le paragraphe par le texte B.1 de l'annexe B (Omnibus I 2026/470, critères cumulatifs, ≈ −90 %, transposition française au 19 mars 2027, norme volontaire 2026/1560 en vigueur le 24 septembre 2026, plafond chaîne de valeur à partir de l'exercice 2027, BEGES et perte de dispense).
5. **« Sans CarbonCo » (722)** : « Scope 3 cat. 8 : serveurs, cloud, SaaS » → « Scope 3 catégorie 1 : cloud et SaaS achetés, souvent oubliés ». Supprimer « Conformité ESRS incertaine » → « Version ESRS appliquée non tracée ».
6. **« Avec CarbonCo » (750-751)** : « Audit trail append-only signé SHA-256 » → « Journal append-only chaîné par empreinte SHA-256 : toute modification après validation devient détectable ». « ESRS Set 2 … + export iXBRL ESEF beta / 127 datapoints référencés, validator audit-grade 30+ règles » → « ESRS 2026 : 127 datapoints couverts, 30+ règles de contrôle, export iXBRL en bêta ». « Facteurs d'émission ADEME Base Empreinte® 2025 · 502 facteurs versionnés » : garder, ajouter la version exacte de la base (cf. T11.1).
7. **Carte « Rapports automatisés » (830-831)** : texte → « Export PDF et iXBRL (bêta, taxonomie EFRAG). Dossier de preuves conçu pour faciliter la mission d'assurance limitée d'un CAC ou d'un OTI (lignes directrices H2A, ISSA 5000). » Titre → « Rapports et dossier de preuves ». Puces : « PDF + iXBRL bêta », « GHG Protocol », « Taxonomie XBRL EFRAG 2024 ».
8. **Carte « Couverture ESRS Set 2 » (837-839)** → « Couverture ESRS 2026 » ; texte : « 10 normes thématiques référencées, 127 datapoints couverts sur la liste EFRAG [version], couverture affichée en proportion. E1 approfondie, E2–E5 en développement » (aligné sur `esrs-e2-e5 = planifie`).
9. **Bloc « fonctionnalités secondaires » (867-870)** : « Benchmark sectoriel » et « Mobile-first » → retirer, ou les ajouter au registre en `planifie` et les afficher comme tels. « Multi-sites & filiales · Consolidation automatique » → « Multi-sites & filiales (bêta) · consolidation par périmètre ».
10. **Grille « Rapports conformes » (124)** → « Projets de rapports · ESRS, CDP, BEGES, à relire et valider ».
11. **Bloc démo (262-274)** : « PDF + iXBRL ESEF + Evidence Pack » → « PDF + iXBRL (bêta) + dossier de preuves » ; « Document ESEF » → « Document iXBRL » ; « iXBRL ESEF conforme » → « iXBRL bêta, taxonomie EFRAG 2024 ».
12. **Tarifs (1091, 1112, 1130)** : appliquer D13 ; « ESRS Set 2 … » → « ESRS 2026 » ; Enterprise « Scope 1, 2, 3 + CBAM » → « Scope 1, 2, 3 + estimation d'exposition CBAM » ; « SSO & RBAC » → « SSO & RBAC (planifié) » (registre `sso-rbac`).
13. **Sécurité (1187-1190)** : supprimer la phrase DORA → « La CSRD impose que chaque information publiée puisse être vérifiée par un commissaire aux comptes ou un OTI inscrit à la H2A. » ; « fonctions par défaut US » → après T9.1 « traitement et stockage en UE (Vercel `fra1`, Neon Francfort) » ; « audit trail immuable » → « journal append-only, modifications détectables ».
14. **CTA final (1228)** : « structurent leur conformité CSRD » → « structurent leur reporting CSRD ».
15. **Calculateur ROI** : appliquer D12.
16. `components/landing/why-proof-first.tsx:18` : « un journal inviolable » → « un journal où toute modification devient détectable ».
17. `components/landing/how-it-works.tsx` : étape 3 « Rapports prêts pour l'audit » → « Dossier de preuves pour le vérificateur » ; « signé OTI » (262) → « dossier vérificateur généré » ; « Compatible OTI » (348) → « Dossier CAC / OTI » ; « Signature électronique · Versioning intégré » → « Empreinte SHA-256 · versioning » (signature eIDAS = `planifie`) ; « De l'onboarding à votre premier rapport CSRD prêt pour l'audit » → « … à votre premier projet de rapport CSRD documenté ».
18. `components/landing/sector-mockups.tsx:371, 447` : « Statut OTI · prêt », « Vérifié OTI ready » → « Dossier vérificateur complet », « Journal chaîné SHA-256 ».
19. `components/landing/illustrations.tsx:197-218`, `infographies.tsx:133-136, 239, 332`, `security-architecture.tsx:78, 122` : même réécriture (« PDF signé · OTI ready » → « PDF + manifeste SHA-256 », « audit trail signé » → « audit trail chaîné »).
20. `components/landing/hero/hero-avatar-neo.tsx:55`, `hero-stage.tsx:47` : « ESRS NATIVE » → « ESRS 2026 ».
**CA :**
- T8.1 vert sur ces fichiers.
- Revue visuelle de l'accueil en 1280 px et 390 px : aucune ligne cassée par les nouveaux libellés (capture jointe à la PR).
- Chaque statut affiché (bêta, planifié) correspond au registre : un test vitest compare les libellés « (bêta) / (planifié) » de l'accueil aux statuts de `feature-status.json`.

### [ ] T8.3 — Page /produit et fiches modules (`lib/product-modules.ts`, `app/produit/**`)
**Étapes :**
1. Accroche (« couverture complète du reporting CSRD/ESRS ») → « Structurez, calculez et documentez votre reporting ESRS, du fichier source au datapoint publié. »
2. Module **Calcul** (77, 89) : « Calculs Scope 1/2/3 conformes ADEME, IPCC, DEFRA, GHG Protocol » → « Calculs selon les principes du GHG Protocol, facteurs ADEME Base Empreinte® versionnés, scope 2 en location-based et market-based. » « Synchronisation automatique avec les bases ADEME et IPCC » → décrire le mécanisme réel (import versionné, date de la dernière version chargée) ; PRG : « PRG du GIEC AR6 (2021), version figée par calcul » (206).
3. Module **Audit trail** (113) : texte B.3 de l'annexe B.
4. Module **Rapport prêt OTI** (147-149) → titre « Projet de rapport ESRS » ; texte : « Génération d'un projet de rapport structuré selon les ESRS 2026, avec note méthodologique et tableaux de datapoints, à relire et valider par vos équipes. L'export porte une empreinte SHA-256 vérifiable sur /verify. » (pas de « signature cryptographique » tant qu'aucune clé ne signe).
5. Module **Préparation OTI** (291-293) → titre « Espace vérificateur (CAC ou OTI) » ; supprimer « La mission OTI raccourcie de 30 à 50 % » → « Objectif : réduire le temps de vérification. Nous le mesurerons avec nos pilotes 2026. » ; badge « OTI · Vérifié » → « Lecture seule ».
6. (314) « Journal d'activité auditeur immuable consultable en clair » → « Journal d'activité du vérificateur, en ajout seul, consultable en clair ».
**CA :** T8.1 vert ; `/produit` et chaque `/produit/[slug]` relus en production (capture).

### [ ] T8.4 — Réécriture de /ai-act (`app/ai-act/page.tsx`)
**Étapes :**
1. Titre « Conformité AI Act » → « NEURAL et l'AI Act ». Date de mise à jour : celle du merge.
2. Périmètre : « règlement (UE) 2024/1689, modifié par le règlement (UE) 2026/1744 (Omnibus numérique) » ; calendrier exact : 2 févr. 2025 (interdictions, art. 4), 2 août 2025 (modèles à usage général, obligations portées par Anthropic), **2 août 2026** (application générale dont art. 50, systèmes déjà sur le marché : **2 déc. 2026**), 2 déc. 2027 (haut risque annexe III, reporté), 2 août 2028 (annexe I). Supprimer « jusqu'en 2027 ».
3. Classification : garder « risque limité » et l'argument annexe III ; ajouter « Si nous automatisions la cotation de matérialité, nous referions l'analyse » (déjà présent, garder).
4. **Supprimer la section « Devoirs du déployeur (article 26) »** et la remplacer par « Ce que nous appliquons » : art. 4 (maîtrise de l'IA : « prendre des mesures pour favoriser » depuis le 27 juill. 2026 → formation des utilisateurs, cf. T9.5), art. 50(1) (l'utilisateur sait qu'il échange avec une IA), art. 50(2) (marquage lisible par machine des textes générés, cf. T9.3). Côté client : art. 50(4) joue a priori peu, le rapport étant relu et signé par la direction.
5. Annexe IV : « Notre documentation technique s'inspire volontairement de la structure de l'annexe IV, qui ne s'impose qu'aux systèmes à haut risque. »
6. « Les sorties (chiffres, citations, recommandations) » → « Les sorties (textes, citations, recommandations). NEURAL ne calcule aucun chiffre : il rédige à partir de chiffres calculés et tracés par le moteur, qu'il cite. » (cohérent avec T9.4).
7. Hébergement des modèles : garder « modèles hébergés aux États-Unis via Vercel AI Gateway » et renvoyer vers /trust/sub-processors.
8. Section FAQ courte avec les réponses idéales du dossier (« Votre copilote est-il à haut risque ? », « Un texte rédigé par votre IA pose-t-il problème à notre auditeur ? »).
**CA :** T8.1 vert (`article 26` ajouté aux patterns interdits sur cette page) ; la page cite 2024/1689, 2026/1744, art. 4, 50(1), 50(2) ; relecture juridique par Ludo (case à cocher dans la PR).

### [ ] T8.5 — Badges de confiance, Trust Center, brochure, lexique central
**Étapes :**
1. `components/landing/trust-badges.tsx` : « RGPD · Conforme » → « RGPD · DPA et sous-traitants publiés » (statut `verified` acceptable : c'est un fait) ; « CSRD-Ready · ESRS E1 prio. » → supprimer, ou « ESRS 2026 · E1 approfondie » ; « Signature SHA-256 · Hash de chaîne » → « Empreinte SHA-256 · chaîne vérifiable » ; SOC 2 / ISO 27001 selon D11. Retirer « DORA » du commentaire d'en-tête.
2. `lib/claims-dictionary.ts` : `HOSTING.current` → « Données en UE (Neon Francfort) ; exécution Vercel [US → `fra1` après T9.1] » ; ajouter un objet `REGULATORY` (libellés des textes 2026, cf. annexe A) et un objet `PROOF` (« modification détectable », « dossier de preuves pour le vérificateur », « facilite les travaux d'un CAC ou d'un OTI »).
3. `app/methodologie/page.tsx:108` : « Chaîne de preuve SHA-256 (inviolable) » → « Chaîne de preuve SHA-256 (modification détectable) » ; ajouter un paragraphe « Ce que l'empreinte prouve et ne prouve pas » (intégrité et ordre depuis la capture ; pas l'exactitude ni l'exhaustivité, qui relèvent des rapprochements de T11.7).
4. `app/trust/exit-strategy/page.tsx:46` : « prêt pour soumission auditeur (ISAE 3000) » → « dossier de preuves remis au vérificateur ».
5. `app/brochure/brochure-client.tsx:191, 210` : « Rapport prêt OTI » → « Dossier vérificateur » ; « audit trail immuable et hébergement entièrement européen » → « journal append-only et données stockées en UE ».
6. `lib/glossary.ts:60` : définition « Audit trail » → « registre en ajout seul où toute modification devient détectable (tamper-evident) » ; ajouter les entrées du glossaire du dossier : H2A, OTI, CAC, norme volontaire (VS), plafond chaîne de valeur, mix résiduel, GO, tamper-evident, IRO, DNSH, RCP.
7. FAQ (/aide) : ajouter « Qui valide que CarbonCo est conforme ? » → « Personne, et aucun éditeur ne peut le prétendre : il n'existe pas de label. C'est le rapport de votre entreprise qui est certifié, par un CAC ou un OTI inscrit à la H2A. » (phrase jugée « excellente » par le dossier, chap. 2).
**CA :** T8.1 vert ; /trust, /methodologie, /aide, /brochure relus en production.

### [ ] T8.6 — Démo et UI applicative
**Étapes :**
1. `components/demo/demo-types.ts:390` « Document ESEF » → « Document iXBRL (bêta) » ; `demo-phase-5-audit-trail.tsx:7, 53` « Chaîne d'événements signés · inviolable » → « Chaîne d'événements chaînés · modification détectable » ; `demo-static-snapshot.tsx:192`, `features/carbon-neural-validation.tsx:141` « ESRS native » → « ESRS 2026 ».
2. `components/landing/how-it-works.tsx:167, 333` et `components/dashboard/methodology-modal.tsx:14` : retirer « Ecoinvent 3.9 » et « Facteurs IEA » tant qu'aucune licence n'est souscrite (P6) ; utiliser des facteurs réellement intégrés (Base Empreinte®, avec identifiant).
3. `components/pages/reports-page.tsx:234-252` et `components/ixbrl/export-ixbrl-button.tsx` : bouton « Exporter iXBRL ESEF » → « Exporter en iXBRL (bêta) » ; texte d'aide « prêt pour soumission auditeur ou ESEF » → « Taxonomie XBRL EFRAG ESRS 2024. Aucun dépôt balisé de l'état de durabilité n'est exigé à ce jour (directive (UE) 2026/470) ; ce fichier sert au contrôle de cohérence. » Commentaires de code « conforme EFRAG » → « suit la taxonomie EFRAG ».
4. `lib/nav-config.tsx:100` : badge « ESEF » → « bêta ».
5. `components/pages/datapoints-page.tsx:291`, `components/layout/dashboard-shell.tsx:55`, `components/datapoints/validator-panel.tsx:4` : « Set 2 » → « ESRS 2026 ».
6. `lib/data.ts:350` (réponse démo du copilote) : « Votre conformité ESRS globale est de 63 % » → « Votre taux de couverture ESRS est de 63 % des datapoints applicables ».
7. `components/ui/onboarding-tour.tsx:48` : « PDF prêt OTI signé » → « PDF avec manifeste SHA-256 ».
8. `components/pages/login-screen.tsx:176` : « Structurez votre conformité CSRD » → « Structurez votre reporting CSRD ».
9. `app/api/datapoints/extract/route.ts:85` (prompt système) et `review/route.ts:93` : « référentiel ESRS Set 2 » → « référentiel ESRS 2026 (2026/1563) ». Vérifier que le prompt n'invite pas le modèle à produire des valeurs chiffrées (cf. T9.4).
**CA :** T8.1 vert sur `components/demo/**`, `components/ixbrl/**`, `components/pages/**`, `lib/**` ; tests vitest existants verts (snapshots mis à jour volontairement, diff relu).

### [ ] T8.7 — Blog, guide et pages SEO datées
**Étapes :**
1. `app/blog/vsme-devient-vs-2026/page.tsx` : réécrire au passé et au présent. Projet du 6 mai 2026 → **adopté le 3 juillet 2026, règlement délégué (UE) 2026/1560 (C(2026) 5011), JOUE du 21 septembre 2026, en vigueur le 24 septembre 2026**. Ajouter les quatre catégories (nécessaire, nécessaire si applicable, volontaire, information sectorielle), le plafond (≤ 1 000 salariés, collecte faite au titre du reporting CSRD, exercices ouverts à compter du 1er janv. 2027) et la mention « les intitulés B1–B11 / C1–C9 sont ceux de la version EFRAG ; l'acte délégué a procédé à des ajustements ciblés ». Encadré « Mis à jour le … » en tête.
2. `app/guide-csrd-vsme-2026/page.tsx:158-182`, `app/blog/vsme-standard-chaine-valeur/page.tsx:25-34`, `app/scope3-fournisseurs/page.tsx:10-11, 54, 168, 231` : même correction que T8.2 §4 (annexe B.1) ; la norme volontaire est adoptée, plus un projet.
3. `app/blog/taxonomie-verte-2026/page.tsx` : vérifier qu'il cite l'acte de simplification **2026/73** (applicable depuis le 1er janv. 2026, seuil de 10 %, exemption OpEx, −64 % de datapoints) et la révision attendue au T1 2027 ; ajouter « CarbonCo : module Taxonomie en feuille de route » (D9).
4. `app/blog/double-materialite/page.tsx:27`, `lib/blog-articles.ts:70` : « conforme ESRS 1 §3 » → « selon ESRS 1, chapitre 3 » ; ajouter les apports des ESRS 2026 (approche top-down admise, « évaluation éclairée », interdiction de publier l'immatériel).
5. `app/blog/csrd-2027-checklist/page.tsx:107` : « Audit trail immuable » → « journal en ajout seul, modifications détectables, ancré hors de la base » ; vérifier le calendrier (vague 2 : exercice 2027 publié en 2028 ; trois options pour l'exercice 2026 de la vague 1).
6. `app/blog/audit-trail-oti/page.tsx:70` : « identifiant immuable » → « identifiant qui change si le contenu change » ; ajouter le paragraphe « intégrité ≠ exactitude ≠ exhaustivité » (dossier, axe 2 §2.5).
7. Chaque article et guide : bandeau « État du droit au [date] » + liste « Textes cités » avec liens EUR-Lex (dossier, Sources).
8. Réactiver T8.1 (retirer `describe.skip`).
**CA :** T8.1 vert sur `app/blog/**`, `app/guide-csrd-vsme-2026/**` ; chaque page porte une date d'état du droit ≥ 2026-11-02.

### [ ] T8.8 — Métadonnées SEO et promesses implicites
**Étapes :**
1. `app/layout.tsx:77` : retirer « Taxonomie verte » des `keywords` (D9) ; vérifier « CBAM » : garder seulement avec « estimation d'exposition ».
2. `app/blog/page.tsx:8` : description sans « taxonomie verte » tant que le module n'existe pas, ou reformuler « décryptage de la Taxonomie verte ».
3. `components/dashboard/deadlines-widget.tsx:32` : « Taxonomie verte — Alignement activités » → retirer de la démo, ou libeller « Taxonomie (hors périmètre CarbonCo) ».
4. Titres `<title>` et `description` OpenGraph de l'accueil, /produit, /ai-act, /tarifs : appliquer le lexique.
5. `/etat-du-produit` et `/couverture` : ajouter les lignes « Taxonomie verte : feuille de route », « CBAM : estimation d'exposition », « Export iXBRL : bêta (taxonomie EFRAG 2024), aucune obligation de balisage » (registre).
**CA :** `curl` des pages principales : aucune balise `<meta>` ne contient un terme interdit (test e2e Playwright public).

### [ ] T8.9 — Affirmations fausses relevées dans le code (E23-E28)
**Étapes :**
1. `lib/faq-entries.ts:49` (« Mon ETI est-elle concernée ? ») : réponse réécrite sur la directive 2026/470 (critères cumulatifs 1 000 salariés **et** 450 M€, exercice 2027, vague 3 sortie du champ, groupes non UE 450 M€ + filiale 200 M€ dès l'exercice 2028, transposition française en cours) + renvoi vers le diagnostic T12.1. Même correction dans `app/blog/csrd-2027-checklist/page.tsx:25`.
2. `lib/claims-dictionary.ts:104-107` : « Omnibus du 26 février 2025 » → « directive (UE) 2026/470 du 24 février 2026, en vigueur le 18 mars 2026 » ; VSME « recommandation du 30 juillet 2025 » → « norme volontaire, règlement délégué (UE) 2026/1560, en vigueur le 24 septembre 2026 ». `claims-dictionary.ts:92` « ZIP signé » → « ZIP avec manifeste et empreintes SHA-256 ».
3. `app/trust/exit-strategy/page.tsx:107` : supprimer la phrase sur la signature Ed25519 tant que T11.7 n'est pas livrée (D16). Même chose pour le commentaire `api/services/export_package.py:2`.
4. `lib/product-modules.ts:206` : « PRG IPCC AR6 (2021) intégrés pour 50+ fluides » → retirer tant que T11.2 n'est pas livrée (les valeurs seedées sont AR4).
5. `app/ai-act/page.tsx` (section « Journal d'usage IA ») : remplacer l'affirmation au présent par « En cours de déploiement (décembre 2026) : chaque invocation… » jusqu'à la livraison de T9.4. Ne jamais décrire au présent un journal qui n'existe pas.
6. `app/trust/sub-processors/page.tsx:67` : retirer « pas de noms d'entreprises clients » tant que T9.2 n'a pas pseudonymisé le prompt.
7. Ajouter ces six formulations aux patterns de T8.1.
**CA :** T8.1 vert ; chaque phrase corrigée est relue contre le code qu'elle décrit (lien vers le fichier dans la PR).

---

## P9 — RENDRE VRAIES LES PROMESSES DE CONFIANCE : AI ACT, RÉSIDENCE UE, ACCÈS VÉRIFICATEUR (≈ 5 jours · avant le 2 décembre 2026 · coût : 0 €)

> Objectif : qu'à la date où l'article 50(2) de l'AI Act devient exigible pour les systèmes déjà sur le marché, chaque promesse de /ai-act, /trust et /trust/sub-processors soit vraie dans le code. P8 a retiré ce qui était faux ; P9 construit ce qui doit exister.

### [ ] T9.1 — Région d'exécution UE pour le front et l'API
**Étapes :**
1. `apps/carbon/vercel.json` et `apps/api/vercel.json` : ajouter `"regions": ["fra1"]` (D14). Vérifier dans le tableau de bord Vercel que le réglage de projet « Function Region » ne contredit pas le fichier (le fichier l'emporte au déploiement) et que le plan du compte autorise ce choix.
2. Routes qui appellent un service externe : vérifier qu'aucune n'exporte `runtime = 'edge'` (runtime déprécié) ; rester sur Node.js (Fluid Compute).
3. Cron `/api/cron/evaluate-alerts` et fonctions Inngest : confirmer qu'elles s'exécutent dans la même région.
4. Une fois en production : mettre à jour `app/trust/page.tsx:24`, `app/trust/sub-processors/page.tsx:26-30`, le badge et le paragraphe sécurité de l'accueil (T8.2 §2 et §13), `lib/claims-dictionary.ts` (`HOSTING.current`), la brochure. Texte : « Traitement et stockage en UE : fonctions Vercel à Francfort (`fra1`), base Neon à Francfort. Services hors UE : modèles Claude (Anthropic, États-Unis) via Vercel AI Gateway, embeddings Voyage AI, paiements Stripe, listés avec leur finalité. »
**CA :**
- `curl -sI https://carbon-snowy-nine.vercel.app/api/health` (et la route santé de l'API) : l'en-tête `x-vercel-id` mentionne `fra1` pour l'exécution de la fonction. Capture jointe.
- Plus aucune occurrence de « par défaut US » sur le site.

### [ ] T9.2 — Liste des sous-traitants exacte et prompt pseudonymisé
**Étapes :**
1. Ajouter Voyage AI (embeddings du corpus RAG : rôle, région, transfert hors UE, fondement) et Stripe (paiement : périmètre réel, même inactif) à `app/trust/sub-processors/page.tsx` ; corriger Upstash Vector (« corpus public + documents importés par le client pour le RAG »).
2. `app/api/copilot/route.ts:133, 142` : remplacer la raison sociale par un alias de tenant (« Entreprise A ») avant l'envoi au modèle, ou documenter honnêtement l'envoi. Défaut : **pseudonymiser** (le contexte chiffré suffit au copilote).
3. `app/api/datapoints/extract/route.ts:13` et `inngest/functions/extract-datapoint-one.ts:30` : passer l'extraction par Vercel AI Gateway (chaîne de modèle `"anthropic/…"`) comme le copilote, pour une seule voie d'accès au modèle et une seule ligne de sous-traitant. Aligner les deux sur un même modèle de la famille actuelle.
4. Dater la page (« liste à jour au … ») et lier chaque ligne à sa preuve de configuration (variable d'environnement, région).
**CA :** un test vitest vérifie que le message système envoyé par `/api/copilot` ne contient ni `company` ni `raisonSociale` en clair ; la liste couvre chaque dépendance de service externe de `package.json` et `requirements.txt` (test qui compare les deux).

### [ ] T9.3 — Art. 50(1) : l'utilisateur sait qu'il échange avec une IA
**Étapes :**
1. Copilote (`components/pages/copilot-page.tsx`) : mention persistante sous chaque réponse, « Réponse générée par une IA (Claude, Anthropic). À vérifier avant tout usage dans un rapport. » ; mention identique dans le panneau d'extraction de datapoints et sur les widgets « Généré par IA » existants (harmoniser le libellé).
2. Toute zone de texte préremplie par l'IA (narratifs, propositions de datapoints) porte un badge « Brouillon IA » tant qu'un humain ne l'a pas validée.
**CA :** test de rendu : chaque composant qui affiche une sortie de modèle rend le badge ; capture du copilote et de l'extraction.

### [ ] T9.4 — Art. 50(2) : marquage lisible par machine et journal des sorties IA
**Pourquoi :** exigible au **2 décembre 2026** pour un système déjà sur le marché ; c'est aussi ce que demandera un vérificateur (« une sortie d'IA non tracée n'est pas une preuve », dossier, axe 4 §5).
**Étapes :**
1. Backend : étendre le registre de revue IA de la migration 041 (prestataire, modèle, version de prompt, empreinte d'entrée) aux sorties du copilote et de l'extraction. Nouvelle migration (prochain numéro libre, ≥ 045) : table `ai_outputs` — `id`, `tenant_id`, `surface` (copilot | extraction | narrative | review), `provider`, `model`, `prompt_version`, `input_hash`, `output_hash`, `generated_at`, `status` (draft | accepted | modified | rejected), `decided_by`, `decided_at`, `final_text_hash` ; append-only, chaînée comme `audit_events`.
2. Front : `/api/copilot` et `/api/datapoints/extract` enregistrent chaque sortie (sans le texte du prompt si celui-ci contient des données client : empreintes seulement, texte de sortie conservé).
3. Marquage machine dans les objets et les exports : tout texte d'origine IA porte `provenance: { kind: "ai_draft", ai_output_id, model }` ; il est conservé après retouche (`kind: "ai_assisted"`, avec le `final_text_hash`). Exports : PDF (métadonnées XMP `carbonco:aiGeneratedSegments`), XHTML / iXBRL (`data-ai-generated="true"` + `data-ai-output-id` sur les blocs narratifs), Evidence Pack (`manifest.json` → `ai_segments[]`).
4. Validation humaine = événement d'audit chaîné (`ai_output_validated`), pas un simple écrasement de `validatedBy`.
5. /ai-act : rétablir au présent la section « Journal d'usage IA » une fois l'ensemble en production ; ajouter « Comment nous marquons les contenus générés ».
**CA :**
- Un rapport démo exporté contient : bloc narratif avec `data-ai-generated`, entrée correspondante dans `manifest.json`, ligne dans `ai_outputs` avec décision humaine.
- pytest : impossible de modifier ou supprimer une ligne `ai_outputs` (trigger).

### [ ] T9.5 — « L'IA ne produit jamais un chiffre publié » (doctrine du dossier, rendue exécutable)
**Étapes :**
1. Extraction de datapoints : les valeurs proposées par le modèle prennent le statut `ai_proposed`, avec le passage source cité (document, page). Elles n'entrent dans aucun total, validateur ou export (y compris le mode brouillon iXBRL, `export-ixbrl/route.ts:104`) avant validation humaine.
2. Narratifs du copilote : contrôle de cohérence numérique. Tout nombre présent dans un texte généré doit correspondre à un fait calculé cité dans le contexte (tolérance d'arrondi) ; sinon, le nombre est surligné « non tracé » et le texte ne peut pas être accepté en l'état.
3. Prompt système : garder l'interdiction (route.ts:100) mais ne plus s'y fier seul.
**CA :** test vitest : une sortie simulée contenant « 4 512 tCO₂e » absent des faits est rejetée ; une valeur `ai_proposed` n'apparaît pas dans l'export iXBRL brouillon.

### [ ] T9.6 — Art. 4 : maîtrise de l'IA
**Étapes :** note interne d'une page (`docs/carbonco/security/AI_LITERACY.md` : limites du modèle, hallucinations, doctrine T9.5, procédure de signalement) ; écran d'accueil du copilote reprenant ces limites ; registre des personnes formées (Ludo, pilotes).
**CA :** le document existe, il est lié depuis /ai-act ; l'écran est rendu au premier usage du copilote.

### [ ] T9.7 — Accès vérificateur réellement en lecture seule
**Étapes :**
1. `app/api/datapoints/review/route.ts:57` : retirer `auditor` des rôles autorisés à valider ou rejeter (et `daf` si ce rôle ne doit pas valider : décision dans la PR). Le vérificateur commente, il ne valide pas.
2. Remplacer l'écrasement de l'état (127-163) par un historique append-only des décisions de revue (qui, quand, ancienne valeur → nouvelle valeur), exportable.
3. Ajouter au rôle `auditor` un droit de **commentaire** par datapoint, journalisé (`auditor_comment`).
**CA :** test : un jeton `auditor` reçoit 403 sur la validation ; l'historique d'un datapoint validé deux fois montre les deux décisions.

---

## P10 — RÉFÉRENTIELS VERSIONNÉS : ESRS 2023 / 2026, NORME VOLONTAIRE, XBRL (≈ 8 jours · avant le 31 décembre 2026 · coût : 0 €)

> Objectif : pendant l'exercice 2026, trois référentiels ESRS coexistent ; à partir de 2027, les ESRS 2026 et la norme volontaire s'imposent. L'outil doit savoir, pour chaque rapport, quelle version il applique, et le dire sur chaque export (dossier, chap. 3 §1.4 : « trois référentiels actifs en même temps »).

### [ ] T10.1 — Version de référentiel portée par chaque rapport
**Étapes :**
1. Énumération partagée front / API : `ESRS_2023_2772`, `ESRS_2023_2772_QF_2025_1416`, `ESRS_2026_1563`, `ESRS_2023_QF_AVEC_ALLEGEMENTS_2026` ; `VS_2026_1560`, `VSME_EFRAG_2024_12`.
2. Stockage : champ `referential_version` + `reporting_period` sur l'état des datapoints (`lib/datapoints/store.ts`) et sur les rapports / exports backend (nouvelle migration). Valeur par défaut pour les données existantes : `ESRS_2023_2772_QF_2025_1416` (et `VSME_EFRAG_2024_12`), migration documentée.
3. Affichage : en-tête de chaque rapport PDF, `manifest.json` de l'Evidence Pack, page de garde iXBRL, cockpit.
**CA :** un export sans `referential_version` est refusé (test) ; la version apparaît sur les trois formats d'export.

### [ ] T10.2 — Référentiel ESRS 2026 aligné sur la liste EFRAG datée
**Étapes :**
1. Récupérer manuellement la liste de datapoints EFRAG des ESRS 2026 (projet du 28 août 2026, consultation close le 23 octobre 2026) et la déposer dans `docs/carbonco/sources/` avec sa date (fichier public, aucun connecteur).
2. Renommer `lib/esrs-set2.json` → `lib/esrs/referentials/esrs-2023-2772.json` (contenu actuel, figé) et créer `esrs-2026-1563.json`. Par datapoint : `efrag_dp_id`, `paragraph_ref`, `obligation` (obligatoire | conditionnel | « may disclose »), `evolution_2026` (inchangé | modifié | supprimé | nouveau), `phase_in`.
3. **Ajouter ESRS 2** (informations générales : BP, GOV, SBM, IRO), obligatoire pour toute entreprise dans le champ, et les exigences de ESRS 1 utiles au validateur (E31).
4. Compteur public : `couverts / applicables` calculé depuis le référentiel actif, avec la version et la date de la liste. L'accueil (T8.2 §3) lit ce calcul au build, plus de « 127 » en dur.
5. `lib/esrs/schema.ts` : schéma étendu ; `lib/datapoints/validator.spec.ts:36` : tester le compte exact par version, pas « > 100 ».
**CA :** `/couverture` affiche « X datapoints couverts sur Y (liste EFRAG du 28/08/2026, projet) » ; les tests passent pour les deux versions.

### [ ] T10.3 — Table de correspondance 2023 ↔ 2026
**Étapes :** fichier `lib/esrs/mappings/esrs-2023-to-2026.json` (identifiant 2023 → identifiant(s) 2026, nature du changement) ; migration assistée d'un état datapoints 2023 vers 2026 (reprise des valeurs inchangées, alerte sur les modifiés, archivage des supprimés) ; publication de la table sur /couverture avec sa version.
**CA :** sur le jeu démo, la migration produit un rapport « repris / à revoir / supprimés » sans perte silencieuse (test).

### [ ] T10.4 — Corriger le validateur (E21, E22, E29)
**Étapes :**
1. **Supprimer la règle bloquante `E1-scope2-LB-gte-MB`** (`rules-set2.ts:32-42`). La remplacer par une règle d'information : « market-based > location-based : attendu sans garanties d'origine ni contrat d'achat (mix résiduel). Vérifier que les instruments détenus sont saisis. »
2. Total GES : deux règles, total location-based et total market-based, alignées sur `workbook_totals.py` ; le classeur et le validateur produisent les deux totaux, publiés côte à côte.
3. **Garde de matérialité** (ESRS 2026 : interdiction de publier l'immatériel, sauf exceptions étroites) : un datapoint d'une norme thématique dont le sujet n'est pas matériel (`materiality_decisions.is_material = false`) ne peut pas être publié ni exporté ; ESRS 2 reste toujours requis. Côté API : `disclosure_mapping_service.py:41-56` refuse `status='disclosed'` sans décision matérielle.
4. Complétude (`validator.ts:267-301`) : compter les obligatoires **des seuls sujets matériels**, plus ESRS 2.
5. Version du validateur par référentiel (`rules-esrs-2023.ts`, `rules-esrs-2026.ts`).
**CA :** test « MB 4 500 > LB 3 000 sans GO » → aucune erreur, une information ; test « E4 non matériel » → export refusé avec message explicite ; exemple chiffré du dossier (10 GWh, 3 000 / 4 500 / 1 800 tCO₂e) en test de non-régression du moteur scope 2.

### [ ] T10.5 — Exercice 2026 : les trois options de la vague 1
**Étapes :** dans les paramètres du rapport, choix obligatoire pour un exercice 2026 entre (1) ESRS 2023 + quick fix 2025/1416, (2) ESRS 2026 par anticipation, (3) ESRS 2023 avec une sélection d'allègements 2026 (liste cochable et tracée) ; à partir de l'exercice 2027, ESRS 2026 imposé ; la phrase « Version appliquée : … » est générée dans le rapport.
**CA :** test : un rapport 2027 ne peut pas choisir la version 2023 ; un rapport 2026 sans choix ne peut pas être exporté.

### [ ] T10.6 — Export iXBRL honnête et contrôlé
**Étapes :**
1. Trancher D8 après vérification : valider un export démo avec Arelle (validateur XBRL open source, gratuit) contre la taxonomie EFRAG visée. `lib/ixbrl/builder.ts:45-57` pointe la taxonomie du 2024-12-04 : vérifier cette date contre la publication EFRAG (le dossier mentionne des taxonomies publiées en août 2024) et l'afficher exactement.
2. Ajouter la validation Arelle au workflow `carbon.yml` (job dédié, sur le fichier démo).
3. Mode brouillon : exclure les valeurs non validées et les `ai_proposed` (T9.5).
4. Expliquer l'écart 107 / 127 (datapoints balisables vs référencés) sur /couverture.
5. Préparer la migration vers le projet de taxonomie ESRS 2026 (17 septembre 2026) derrière un drapeau, à activer à la publication de la version définitive (veille T13.2).
6. Textes : B.5 (annexe B) partout.
**CA :** Arelle sans erreur bloquante sur le fichier démo ; `feature-status.json` (`ixbrl-eseef` renommé `ixbrl-export`) cohérent avec l'accueil.

### [ ] T10.7 — Module « Norme volontaire (VS, ex-VSME) »
**Étapes :**
1. Renommer dans l'UI (`app/(app)/vsme/*`, navigation, tarifs D13, registre `module-vsme`) : « Norme volontaire (VS) », sous-titre « ex-VSME · règlement délégué (UE) 2026/1560 ». Les routes peuvent garder `/vsme` (redirection inutile), seuls les libellés changent.
2. Référentiel `api/data/vs_2026_1560.json` aligné sur l'acte délégué (ajustements ciblés par rapport à la version EFRAG de décembre 2024), à côté de `vsme_datapoints.json` (v2024.12, conservé pour les rapports existants).
3. Par datapoint : catégorie de l'acte délégué (nécessaire | nécessaire si applicable | volontaire | information sectorielle à considérer) et règle « ≤ 10 salariés : certains points nécessaires deviennent volontaires ».
4. Export VS : version appliquée en en-tête (T10.1).
**CA :** le rapport VS démo affiche « Norme volontaire, règlement délégué (UE) 2026/1560 » ; chaque datapoint a une catégorie (test de schéma).

### [ ] T10.8 — Fichier numérique de la norme volontaire (opportunité ETI fournisseurs)
**Étapes :** générer le modèle numérique EFRAG (Excel convertible en XBRL, v1.2.0 de février 2026) à partir des données VS ; afficher « modèle EFRAG fondé sur la recommandation de 2025, pas encore aligné sur le règlement 2026/1560 » ; permettre au fournisseur d'envoyer ce fichier à tous ses donneurs d'ordre.
**CA :** le fichier démo s'ouvre dans le modèle EFRAG sans erreur de structure.

### [ ] T10.9 — Corpus du copilote versionné
**Étapes :** `api/services/esrs_corpus.py` : chaque extrait porte `texte`, `version` (2023/2772, 2026/1563, 2026/1560, 2026/470…), `paragraphe`, `date` ; remplacer les extraits « VSME ED » ; ajouter Omnibus I, ESRS 2026, VS, lignes directrices H2A ; le copilote cite la version dans chaque réponse et répond « version 2023 » ou « version 2026 » selon le référentiel du rapport (T10.1).
**CA :** test : une question sur E1-6 posée dans un rapport ESRS 2026 ne cite que des extraits 2026/1563.

---

## P11 — CALCUL ET PREUVE AU NIVEAU DU VÉRIFICATEUR (≈ 10-12 jours · T1 2027 · coût : 0 €)

> Objectif : réussir l'épreuve du dossier, « recalculez-moi ce chiffre, là, maintenant ». Le vérificateur doit comprendre la chaîne de traitement et remonter quelques chiffres jusqu'à la source (assurance limitée) ; l'empreinte sert l'intégrité, les rapprochements servent l'exactitude et l'exhaustivité.

### [ ] T11.1 — Provenance complète de chaque facteur d'émission
**Étapes :**
1. Table `emission_factors` (migration 001) : ajouter `base` (Base Empreinte® | Base Carbone® | AIB | DESNZ…), `base_version` (ex. V23.6), `uncertainty_pct`, `ademe_status` (valide générique | valide spécifique | archivé), `gwp_set`, `valid_from` / `valid_to` déjà présents.
2. Production : charger **uniquement** via `scripts/seed_emission_factors.py` (CSV officiel, ligne complète dans `raw`) ; cantonner `seed_factors.py` (copie manuelle) aux tests, avec un marqueur qui empêche son usage en production.
3. Facteurs électricité par pays : `base = 'AIB'`, `basis = 'residual_mix'`, année (aujourd'hui commentés « AIB 2024 » mais enregistrés comme ADEME, `seed_factors.py:59-72`).
4. Chaque ligne de calcul (scope 2 et 3 déjà, faits du classeur à compléter) fige `ef_id`, `base_version`, `uncertainty_pct`, `gwp_set`.
**CA :** pour un datapoint démo, l'écran de détail affiche identifiant, base, version, incertitude et statut du facteur ; un recalcul après chargement d'une nouvelle version de base garde l'ancien résultat et crée un nouveau calcul (test).

### [ ] T11.2 — PRG figés (D15)
**Étapes :** table `gwp_sets` (AR5, AR6 ; source GIEC) ; fluides frigorigènes recalculés en AR6 (valeurs à confirmer contre le tableau 7.SM.7 du GIEC AR6 GT1 : R-134a 1 530, R-32 771, R-410A ≈ 2 256, R-407C ≈ 1 908, R-404A ≈ 4 728, au lieu de 1 430 / 675 / 2 088 / 1 774 / 3 922 en AR4) ; le changement est tracé comme changement de méthode (T11.12) ; /produit rétablit la mention AR6 (retirée en T8.9).
**CA :** test : la fuite d'1 kg de R-134a donne 1,53 tCO₂e avec `gwp_set = AR6` ; l'ancien calcul AR4 reste consultable.

### [ ] T11.3 — Scope 2 : les deux chiffres, toujours, et leur explication
**Étapes :** publier location-based et market-based côte à côte sur chaque écran et export ; afficher la source et l'année du mix résiduel ; rattacher chaque GO / PPA à sa pièce justificative ; info-bulle « pourquoi le market-based peut être plus élevé » (réponse idéale du dossier).
**CA :** l'exemple du dossier (10 GWh ; 3 000 / 4 500 / 1 800 tCO₂e) se rejoue dans la démo.

### [ ] T11.4 — Scope 3 : qualité de donnée et part monétaire en tCO₂e
**Étapes :**
1. Drapeau de méthode (fournisseur | physique | monétaire | hybride) sur chaque ligne, y compris les faits `CC.GES.SCOPE3.n` du classeur.
2. **Part monétaire exprimée en tCO₂e** (pas en nombre de lignes, `procurement.py:780-852`) par catégorie et au total, avec trajectoire de réduction.
3. Plan de substitution : classement des fournisseurs par contribution aux tCO₂e monétaires × incertitude → « les trois fournisseurs à qui demander une donnée physique en priorité ».
4. Ratios monétaires : correction de l'inflation entre l'année du facteur et celle de la dépense (déflateur documenté).
5. Encadré pédagogique « biais du monétaire » (exemple de l'acier A / B du dossier).
**CA :** le détail « scope 3 achats » du jeu démo affiche la part monétaire en tCO₂e et la liste priorisée ; test unitaire de la correction d'inflation.

### [ ] T11.5 — Numérique et cloud en catégorie 1
**Étapes :** classement des services cloud et SaaS achetés en catégorie 1 (lecture documentée comme telle) ; deux sources jamais mélangées : relevé du fournisseur (avec méthode déclarée) ou, à défaut, RCP ADEME « hébergement informatique et services cloud » (2023, mise à jour avril 2025) sur données d'usage ; niveau de qualité affiché.
**CA :** une ligne « AWS » démo montre la catégorie 1, la source et l'hypothèse.

### [ ] T11.6 — Propagation de l'incertitude
**Étapes :** produit DA × FE : `u = √(u_DA² + u_FE²)` ; somme de postes : `U = √(Σ (u_i × E_i)²) / Σ E_i` ; affichage par poste et au total ; remplacer le proxy « 1 − confiance » de `scope2.py:245-248` et les bandes fixes de `procurement.py:119-135` par l'incertitude du facteur (T11.1) et de la donnée d'activité ; Monte Carlo reste au backlog.
**CA :** test reprenant les exemples du dossier : √(5² + 10²) ≈ 11 % ; 1 000 t à ±11 % + 3 000 t à ±50 % → ±38 %.

### [ ] T11.7 — Ancrage externe et signature du manifeste (D10, D16)
**Étapes :**
1. Ancrage quotidien de la tête de chaîne (`facts_events`, `audit_events`, `ai_outputs`) par horodatage RFC 3161 auprès d'une TSA publique gratuite ; table `chain_anchors` (empreinte, jeton, TSA, date) ; adaptateur pour un prestataire qualifié eIDAS plus tard (P6).
2. Signature Ed25519 du `manifest.json` de l'Evidence Pack (clé privée en variable d'environnement, clé publique publiée sur `/.well-known/carbonco-signing-key.json`, procédure de rotation documentée).
3. `/verify/{hash}` : affiche l'intégrité, l'ancrage (jeton vérifiable hors CarbonCo) et la signature.
4. Rétablir alors « manifeste signé » (et seulement lui) ; texte : « signature éditeur, non qualifiée au sens d'eIDAS ».
**CA :** pytest : la modification d'un événement ancré est détectée par la comparaison avec le jeton ; un manifeste altéré échoue à la vérification de signature ; procédure de vérification manuelle (openssl) dans `docs/carbonco/security/`.

### [ ] T11.8 — Rapprochements : exactitude et exhaustivité
**Étapes :**
1. Énergie : total kWh importé par site et par mois ↔ total des factures du fournisseur (montant saisi ou extrait de la pièce jointe) ; écart affiché.
2. FEC : total des comptes d'achats (classe 6) du FEC ↔ total des dépenses passées au screening scope 3 → taux de couverture.
3. Exhaustivité : matrice sites × mois × postes, cases vides signalées.
4. Onglet « Rapprochements » dans l'Evidence Pack et dans l'espace vérificateur.
**CA :** jeu démo : un mois de facture manquant apparaît en rouge dans la matrice et dans le pack.

### [ ] T11.9 — Journal des changements de paramétrage (contrôles informatiques allégés)
**Étapes :** nouveaux types d'événements chaînés : `factor_version_change`, `gwp_set_change`, `referential_version_change`, `materiality_scale_change`, `consolidation_approach_change`, `baseline_threshold_change`, `role_change` (s'appuyer sur `admin_user_change` existant), `ai_output_validated` ; export « journal des accès et des changements » pour le vérificateur.
**CA :** chaque changement de paramètre listé produit un événement (test paramétré).

### [ ] T11.10 — Recalcul reproductible à la demande
**Étapes :** route `POST /recalculate/{datapoint_id}` qui rejoue le calcul depuis l'instantané d'entrée et les versions de facteurs figées (déjà en place pour les runs scope 2 / 3 : migrations 032-033 ; à étendre aux faits du classeur) et compare l'empreinte du résultat ; badge « recalcul identique » ; parcours de démo : datapoint → lignes sources → facteur → cellule d'origine.
**CA :** recalcul identique sur tous les datapoints E1 démo (test) ; parcours rejoué en moins de 45 secondes (annexe C).

### [ ] T11.11 — Périmètre de consolidation ESRS 2026 (E32)
**Étapes :** par entité : `control_type` (contrôle financier | opérationnel | aucun) et `equity_share_pct` ; trois méthodes de consolidation (contrôle financier par défaut, contrôle opérationnel, quote-part), au lieu des 100 % actuels (`consolidation_service.py:40-44`) ; méthode imprimée sur le rapport.
**CA :** test : une filiale à 40 % sans contrôle entre pour 40 % en quote-part et 0 % en contrôle financier.

### [ ] T11.12 — Année de référence : seuil de recalcul
**Étapes :** seuil de significativité paramétrable par l'entreprise (défaut 5 %) ; quand un changement de méthode, de facteur ou de périmètre dépasse le seuil, proposition de recalcul de l'année de référence, journalisée (migration 019, `recalc_events`).
**CA :** test : un changement de 6 % déclenche la proposition, un changement de 3 % non.

### [ ] T11.13 — Matérialité : processus traçable, décision humaine
**Étapes :**
1. Échelles et seuils paramétrables par entreprise (aujourd'hui constantes : 66 dans `services/iro/*_assessment_service.py:46-47`, 2,5 dans `materialite_service.py:126`), stockés avec la version de méthode.
2. Décision (`models/iro.py:227-230`) : ajouter `sources[]` (identifiants de pièces), `stakeholders_consulted[]`, `assessed_by`, `approach` (top-down | bottom-up, admis par les ESRS 2026).
3. Faire converger la matrice historique et le module IRO (une seule source pour l'export).
4. Export « journal du processus de matérialité » : c'est ce que certifie le vérificateur.
5. NEURAL peut proposer une liste d'IRO, jamais coter ni décider : refus côté API pour toute écriture d'évaluation par un compte de service IA.
**CA :** l'export du journal liste, pour chaque sujet, la cotation, le seuil, l'auteur, la date, les sources et les parties prenantes.

### [ ] T11.14 — Échantillonnage par le vérificateur
**Étapes :** dans l'espace vérificateur, tirage aléatoire de N datapoints ou lignes (graine enregistrée, reproductible) avec export de l'échantillon et de ses pièces.
**CA :** même graine → même échantillon (test).

### [ ] T11.15 — BEGES : ventilation fine (E33)
**Étapes :** scope 1 réparti en postes 1.1 à 1.5 (combustion fixe, mobile, procédés, fugitives, biomasse) ; scope 2 en 2.1 / 2.2 ; catégories scope 3 8, 10, 13, 14 sur leurs postes v5 ; garde contre le double compte total + catégories (`beges_export.py:166-171`) ; table de correspondance GHG Protocol ↔ BEGES v5 publiée.
**CA :** export BEGES démo : aucun poste agrégé par défaut, total identique au bilan GHG (test).

---

## P12 — CHAÎNE DE VALEUR, ÉLIGIBILITÉ, BEGES : LES ARGUMENTS COMMERCIAUX DU DOSSIER (≈ 8 jours · avant le 19 mars 2027 · coût : 0 €)

> Objectif : transformer les sorties de champ de l'Omnibus en besoins concrets (dossier : « tu transformes une sortie de champ en deux besoins concrets »). Ce sont les fonctions qu'aucun concurrent daté n'aura.

### [ ] T12.1 — Diagnostic « Suis-je dans le champ ? »
**Étapes :**
1. Fonction pure `lib/eligibility/csrd.ts` (+ miroir Python si l'API en a besoin), entrées : siège (UE / hors UE), effectif moyen, CA net (ou CA UE), CA de la plus grosse filiale ou succursale UE, déjà en vague 1, entité française.
2. Sorties, chacune avec son texte et sa date (registre T13.1) :
   - CSRD, **couche UE** (directive 2026/470 : > 1 000 salariés **et** > 450 M€ ; hors UE : CA UE > 450 M€ **et** filiale ou succursale UE > 200 M€, exercice 2028) ;
   - CSRD, **couche France** (« selon la directive, vous sortez du champ ; en droit français, cela dépend de la loi de transposition en cours d'examen » tant que le PJL DDADUE 2026 n'est pas promulgué ; dispense éventuelle de l'exercice 2026 pour la vague 1) ;
   - BEGES (> 500 salariés, 250 outre-mer ; dispense de la loi 2025-391 art. 10 seulement si soumis au rapport de durabilité avec bilan GES et plan de transition) ;
   - statut d'**entreprise protégée** par le plafond chaîne de valeur (≤ 1 000 salariés, exercices ouverts à compter du 1er janv. 2027) ;
   - Taxonomie article 8 (suit le champ CSRD ; groupes non UE entrants en 2028 non soumis) ;
   - CSDDD (> 5 000 salariés et 1,5 Md€ ; transposition 26 juill. 2028, application juill. 2029).
3. Page publique (outil du dossier, chap. 3 §1.3, exemple prérempli 820 salariés / 380 M€) + écran in-app ; mention « outil d'orientation, pas un avis juridique ».
**CA :** tests sur les cas du dossier : 800 salariés / 600 M€ → hors CSRD, BEGES dû, protégée ; 1 200 / 300 M€ → hors CSRD, **non protégée** ; 820 / 380 M€ → hors CSRD ; vague 1 française sous les seuils en 2026 → « dépend de la transposition ».

### [ ] T12.2 — Questionnaires fournisseurs qui appliquent le plafond par construction
**Étapes :**
1. Remplacer les champs fixes du formulaire public (`app/q/[token]/page.tsx:261-331`) par des questions issues du référentiel VS (T10.7), chacune taguée par sa catégorie et sa référence.
2. Création de campagne : finalité obligatoire (reporting CSRD | contractuel | bancaire | devoir de vigilance). Si finalité CSRD, fournisseur ≤ 1 000 salariés et exercice ≥ 2027 : avertissement automatique pour toute question au-delà des points « nécessaires » de l'annexe II.
3. Côté fournisseur : chaque question indique sa catégorie (« volontaire : vous pouvez ne pas y répondre au titre du plafond, pour cette demande liée au reporting CSRD ») ; possibilité de joindre son rapport VS ou son fichier numérique (T10.8) au lieu de remplir.
4. Ne jamais écrire que le plafond « protège totalement » : il ne couvre qu'un canal (réponse idéale du dossier, axe 4).
**CA :** test : une campagne CSRD 2027 vers un fournisseur de 300 salariés avec une question « volontaire » affiche l'avertissement ; la même campagne en finalité « bancaire » non.

### [ ] T12.3 — Page BEGES : l'argument que le site n'exploite pas
**Étapes :** `app/bilan-carbone-beges/page.tsx` : corriger « indépendant de la CSRD et de l'Omnibus » (4-6) ; ajouter la dispense de la loi n° 2025-391 (art. 10) et sa perte pour les entreprises de 500 à 1 000 salariés qui sortent de la CSRD (« votre BEGES reste dû, et il sert aussi de réponse au volet climat de la norme volontaire ») ; nuance sur le scope 3 (périmètre limité aux entités soumises à la DPEF dans le décret 2022-982, « à vérifier sur la version en vigueur de l'article R.229-47 ») ; renvoi vers T12.1.
**CA :** T8.1 vert ; la page cite la loi 2025-391 et la directive 2026/470.

### [ ] T12.4 — Évaluer la dispense BEGES dans le moteur
**Étapes :** `api/services/beges_export.py:62-111` (`eligibility()`) et `lib/beges-eligibility.ts` : évaluer la dispense (soumis au rapport de durabilité + bilan GES décrivant les activités en France + plan de transition) au lieu de la note statique (L50-52) ; réutiliser T12.1.
**CA :** `tests/beges-eligibility.test.ts` étendu aux cas « sortant de la CSRD » et « dans le champ avec bilan GES ».

### [ ] T12.5 — Métaux critiques : versionner la liste et cadrer l'usage
**Étapes :** « CRMA-2024 » → « listes du règlement (UE) 2024/1252 (34 critiques, 17 stratégiques), révision attendue au plus tard le 24 mai 2027 » ; positionner le module comme « aide à la cartographie de l'article 24 et au volet ressources (ESRS E5) », pas comme un outil de conformité ; ajouter la check-list article 24 (entreprises > 500 salariés et 150 M€ fabriquant des technologies stratégiques : évaluation des risques d'approvisionnement au moins tous les 3 ans) ; garder « valeurs estimées » tant que les données ne viennent pas des fournisseurs.
**CA :** `tests/materials-data-trust.test.ts` étendu : la version de liste et la date de révision sont affichées.

### [ ] T12.6 — Taxonomie (si D9 = MVP ; sinon reste « en feuille de route »)
**Étapes :** partir des trois KPIs existants (`workbook_totals.py:193-213`) ; version de l'acte par exercice (2021/2178 + 2026/73) ; seuil de 10 % par KPI avec choix documenté ; exemption OpEx avec justification ; entonnoir éligible → contribution substantielle → DNSH → garanties minimales → aligné ; check-list de preuves DNSH par critère, rattachée au KPI ; conclusion d'alignement laissée à l'humain.
**CA :** jeu démo : KPI CapEx > KPI CA expliqué (plan CapEx, catégorie b) ; choix du seuil de 10 % journalisé.

### [ ] T12.7 — CBAM : estimation d'exposition, rien de plus
**Étapes :** règlement (UE) 2023/956 simplifié par 2025/2083, seuil de 50 tonnes, certificats dès le 1er février 2027, première déclaration au 30 septembre 2027 (déjà juste sur /cbam) ; statut registre `planifie` ou `beta` selon le code réel ; tarifs Enterprise alignés (T8.2 §12).
**CA :** cohérence /cbam ↔ tarifs ↔ registre (test du registre).

### [ ] T12.8 — « Une donnée, plusieurs sorties » : tables de correspondance publiées (optionnel)
**Étapes :** tables versionnées ESRS 2026 ↔ IFRS S2 (guide d'interopérabilité du 2 mai 2024, amendements S2 de déc. 2025), ↔ GRI (index de nov. 2023, pas encore d'index ESRS 2026), ↔ CDP, ↔ VS ; publication sur /couverture ; « nous fournissons la table, sans prétendre à une conformité ISSB ».
**CA :** chaque table porte version et date ; aucune n'affirme une conformité.

---

## P13 — VEILLE ET GOUVERNANCE DU CONTENU (continu · coût : 0 €)

### [ ] T13.1 — Registre réglementaire unique
**Étapes :** `apps/carbon/data/regulatory-registry.json` : `{ id, titre, reference, nature (règlement | directive | règlement délégué | droit souple | norme privée), adopte_le, joue_le, en_vigueur_le, applicable_le, statut, source_url, verifie_le }` initialisé avec les textes du dossier (Sources) ; helper `cite("esrs-2026")` qui rend « ESRS 2026 (règlement délégué (UE) 2026/1563) » ; mention « État du droit au [min(verifie_le)] » générée sur les pages réglementaires ; test : tout numéro de texte de la forme `20\d\d/\d+` cité dans `app/**` existe dans le registre.
**CA :** les pages de P8 consomment le registre ; le test passe.

### [ ] T13.2 — Calendrier de veille et déclencheurs
| Quand | Quoi vérifier | Si ça bouge |
|---|---|---|
| Chaque mois jusqu'à promulgation | Légifrance : PJL DDADUE 2026 (transposition Omnibus) | T12.1 couche France, page BEGES, B.1 |
| Nov.-déc. 2026 | EFRAG : liste de datapoints ESRS 2026 et taxonomie XBRL définitives | T10.2, T10.6 |
| 2 déc. 2026 | AI Act art. 50(2) ; code de bonnes pratiques sur le marquage | T9.4 |
| T1 2027 | Amendements Taxonomie (OpEx, modèles) | T12.6, blog Taxonomie |
| T1 2027 | SBTi : dépôts selon la Net-Zero V2 | mentions SBTi du tableau de bord |
| 2027 | H2A : lignes directrices mises à jour après transposition et ESRS 2026 | B.4, /methodologie |
| 24 mai 2027 | Listes CRMA révisées | T12.5 |
| 1er juil. 2027 | Norme européenne d'assurance limitée | lexique, B.2, B.4 |
| T2 2027 → fin 2028 | GHG Protocol : décision scope 2 market-based, norme consolidée | T11.3, moteur scope 2 |

**Étapes :** reporter ce tableau dans `docs/carbonco/VEILLE_REGLEMENTAIRE.md` ; option : une tâche planifiée mensuelle qui vérifie les sources et ouvre une issue (à créer seulement sur accord de Ludo).

### [ ] T13.3 — Audits de claims v2
**Étapes :** compléter `CLAIMS_AUDIT.md` d'une section « v2 — 2026-11 » listant E1 à E36 avec décision et statut ; solder les deux points restants de `FAKE_SUCCESS_AUDIT.md` (benchmark sectoriel, score ESG « 62 ») ; mettre à jour `feature-status.json` (`derniere_maj`, `derniere_verification`).
**CA :** chaque écart de 0.2 a un statut « corrigé (PR) » ou « décision D… ».

### [ ] T13.4 — Recette de démo avant chaque rendez-vous
**Étapes :** rejouer l'annexe C sur la production ; chronométrer ; consigner l'écart dans la PR suivante.

---

## Récapitulatif des phases

| Phase | Contenu | Échéance | Effort estimé | Dépend de |
|---|---|---|---|---|
| P8 | Vitrine, blog, in-app, garde-fou de claims | **10 nov. 2026** | ≈ 3 j | — |
| P9 | Région UE, sous-traitants, AI Act art. 50, accès vérificateur | **2 déc. 2026** | ≈ 5 j | P8 (T8.4, T8.9) |
| P10 | Versions ESRS / VS, validateur corrigé, iXBRL contrôlé, corpus | 31 déc. 2026 | ≈ 8 j | T10.1 d'abord |
| P11 | Facteurs, PRG, incertitude, ancrage, rapprochements, recalcul, matérialité | T1 2027 | ≈ 10-12 j | T10.1 |
| P12 | Diagnostic d'éligibilité, questionnaires plafonnés, BEGES, CRMA, Taxonomie | 19 mars 2027 | ≈ 8 j | T10.7, T13.1 |
| P13 | Registre réglementaire, veille, audits v2, recette | continu | ≈ 2 j + veille | — |

---

## ANNEXE A — Lexique opposable (source : dossier, chap. 7)

| Éviter | Préférer | Pourquoi |
|---|---|---|
| conforme, certifié, validé, CSRD-ready | selon, aligné sur, conçu pour | Seul un tiers habilité (CAC ou OTI inscrit à la H2A) certifie ; un éditeur décrit sa méthode. |
| infalsifiable, inviolable, immuable, tamper-proof | modification détectable (tamper-evident) | Une chaîne de hachage rend une modification détectable, elle ne l'empêche pas. |
| signé SHA-256, signature SHA-256 | empreinte SHA-256, chaîné par empreinte | Un hash n'est pas une signature (pas de clé, pas d'identité). |
| prêt pour l'audit, prêt OTI, OTI ready, compatible OTI | facilite les travaux du vérificateur ; dossier de preuves pour le vérificateur (CAC ou OTI) | L'auditeur reste juge ; beaucoup de missions sont conduites par des CAC. |
| ESRS Set 2, Set 2 complet | ESRS 2026 (règlement délégué (UE) 2026/1563) | « Set 2 » est ambigu (normes sectorielles abandonnées, ou ESRS simplifiés) et « ESRS 2 » désigne déjà une norme. |
| VSME (seul) | norme volontaire (VS, ex-VSME), règlement délégué (UE) 2026/1560 | Texte en vigueur depuis le 24 septembre 2026. |
| ESRS révisés attendus, Set 1 révisé (simplification Omnibus) | ESRS 2026 : adoptés le 3 juil. 2026, JOUE du 21 sept., en vigueur le 10 nov. 2026, obligatoires pour les exercices ouverts à compter du 1er janv. 2027 | La révision n'est plus un projet. |
| 127 datapoints prioritaires, corpus consolidé | 127 datapoints ESRS couverts à ce jour sur la liste EFRAG [version datée], soit X % | « Prioritaire » n'existe pas dans les ESRS ; 127 est un compteur produit. |
| dépôt ESEF, iXBRL ESEF, conforme ESEF | export iXBRL (bêta, taxonomie EFRAG datée) | Aucun balisage de l'état de durabilité n'est exigible avant l'acte délégué (directive 2026/470). |
| ISAE 3000 / ISSA 5000 (comme qualité du logiciel) | conçu pour faciliter les travaux d'un CAC ou d'un OTI conduisant une mission d'assurance limitée (lignes directrices H2A, ISSA 5000) | Une norme d'assurance s'impose au vérificateur, pas à un logiciel. |
| l'IA rédige votre rapport | l'IA rédige un brouillon à partir de chiffres tracés, validé par vous | AI Act art. 50 et attentes des auditeurs. |
| calculs conformes ADEME, IPCC, DEFRA, GHG Protocol | calculs selon les principes du GHG Protocol, facteurs ADEME Base Empreinte® versionnés, scope 2 en location-based et market-based | « Conforme » suppose un contrôle externe. |
| couverture complète du reporting CSRD/ESRS | structurez, calculez et documentez votre reporting ESRS, du fichier source au datapoint publié | La couverture n'est pas complète (E2–E5 planifiés). |
| la mission OTI raccourcie de 30 à 50 % | objectif : réduire le temps de vérification, mesuré avec nos pilotes 2026 | Hypothèse non mesurée. |
| Taxonomie verte (mot-clé seul) | Taxonomie : en feuille de route | Promesse implicite sans fonctionnalité. |
| infrastructure EU, hébergement entièrement européen (avant T9.1) | données stockées en UE ; exécution [US → UE après T9.1] ; sous-traitants hors UE listés | Un RSSI vérifiera la région des fonctions. |

---

## ANNEXE B — Textes de remplacement prêts à coller

### B.1 Contexte réglementaire (accueil, guide, blog VSME)

> Depuis le 18 mars 2026, la directive (UE) 2026/470 (« Omnibus I ») réserve la CSRD aux entreprises de plus de **1 000 salariés et** de plus de **450 M€** de chiffre d'affaires net, deux critères cumulatifs : environ 90 % d'entreprises en moins dans le champ. Les nouvelles entreprises concernées publieront en 2028 sur l'exercice 2027. En France, la loi de transposition est en cours d'examen (échéance : 19 mars 2027). Pour toutes les autres, la pression change de canal : banques, assureurs et donneurs d'ordre demandent des données ESG structurées. La **norme volontaire** (ex-VSME), adoptée par le règlement délégué (UE) 2026/1560 et en vigueur depuis le 24 septembre 2026, devient leur langage commun ; à partir de l'exercice 2027, un donneur d'ordre soumis à la CSRD ne pourra plus exiger d'une entreprise de 1 000 salariés ou moins davantage que ses points « nécessaires », pour son propre rapport. Enfin, le **BEGES** reste obligatoire en France au-delà de 500 salariés, et les entreprises qui sortent de la CSRD perdent la dispense prévue par la loi n° 2025-391 : leur bilan redevient dû tous les quatre ans.

### B.2 Pitch de 60 secondes, version auditeur (dossier, chap. 7)

> Carbon&Co relie chaque chiffre d'un rapport ESRS à sa cellule source. Le calcul suit le GHG Protocol avec des facteurs ADEME versionnés ; le scope 2 sort en location et en market. Chaque étape, de l'import à la validation, est horodatée et chaînée par empreinte, ce qui rend toute modification détectable. Le vérificateur dispose d'un accès en lecture pour échantillonner et remonter à la source. Nous suivons les ESRS 2026 et la norme volontaire pour les fournisseurs, et nous signalons ce que nous ne faisons pas encore : l'export iXBRL est en bêta, la Taxonomie est en feuille de route.

### B.3 Module Audit trail (/produit)

> Chaque écriture porte une empreinte SHA-256 liée à la précédente : toute modification après validation devient détectable, et chaque chiffre reste relié à sa source. Le vérificateur contrôle l'intégrité de la chaîne en quelques secondes et remonte chaque chiffre jusqu'à sa cellule d'origine. L'empreinte prouve l'intégrité et l'ordre depuis la capture ; l'exactitude et l'exhaustivité se vérifient par les rapprochements que l'outil prépare.

### B.4 FAQ « Qui valide votre logiciel ? »

> Personne, et aucun éditeur ne peut le prétendre : il n'existe pas de label CSRD pour un logiciel. C'est le rapport de votre entreprise qui est certifié, par un commissaire aux comptes ou un organisme tiers indépendant inscrit à la H2A. Notre rôle est de lui fournir une piste d'audit complète. Pour l'outil lui-même, les preuves pertinentes sont une attestation sur nos contrôles (type ISAE 3402 / SOC 2) et une certification de sécurité (ISO 27001), que nous visons : [statut du registre].

### B.5 Export iXBRL (bouton, /couverture, FAQ)

> Export iXBRL en bêta, selon la taxonomie XBRL ESRS publiée par l'EFRAG en 2024 ; migration vers le projet de taxonomie des ESRS 2026 (consultation close le 11 novembre 2026) dès sa version définitive. Aucun dépôt balisé de l'état de durabilité n'est exigé à ce jour : la directive (UE) 2026/470 l'a suspendu jusqu'à l'adoption de l'acte délégué. Ce fichier sert déjà à contrôler la cohérence de vos données.

---

## ANNEXE C — Recette « démo face à un auditeur »

Chaque question piège du dossier devient un scénario de recette. Une phase est terminée quand Ludo peut répondre en moins de 45 secondes **en montrant l'écran correspondant**. À rejouer avant chaque rendez-vous (script dans `docs/carbonco/demo/`).

| Question (dossier) | Ce que l'écran doit montrer | Tâche |
|---|---|---|
| « Vous écrivez ESRS Set 2 sur votre site ? » | Plus aucune occurrence ; la version ESRS appliquée sur chaque rapport | T8.2, T10.1 |
| « Les ESRS 2026 s'appliquent-ils à notre rapport 2026 ? » | Sélecteur des trois options pour l'exercice 2026, version imprimée sur l'export | T10.5 |
| « Mon client a 800 salariés et 600 M€ : il est dans le champ ? » | Diagnostic : hors CSRD, BEGES dû, entreprise protégée par le plafond à partir de 2027 | T12.1 |
| « Et 1 200 salariés mais 300 M€ ? » | Hors CSRD, mais **pas** entreprise protégée : ses clients peuvent lui demander plus | T12.1 |
| « Votre scope 2 market-based est plus élevé que le location-based : erreur ? » | Les deux chiffres côte à côte, mix résiduel sourcé et daté, GO saisies ; **et le validateur ne le bloque plus** | T10.4, T11.3 |
| « Recalculez ce scope 3 achats, là, maintenant » | Clic sur le datapoint → lignes sources (FEC), facteur avec identifiant, version et incertitude, part monétaire, fournisseurs à relancer en priorité | T11.1, T11.4, T11.10 |
| « Votre SHA-256 garantit que les données sont justes ? » | Page /verify : intégrité + ancrage externe ; onglet « rapprochements » pour l'exactitude | T11.7, T11.8 |
| « Comment cotez-vous la matérialité ? C'est votre IA qui décide ? » | Grille et seuils fixés par l'entreprise ; journal : auteur, date, sources, parties prenantes ; aucune cotation par NEURAL | T11.13, T9.5 |
| « Votre copilote est-il à haut risque ? » | /ai-act ; mention IA dans l'interface ; marquage des brouillons ; validation humaine journalisée | T8.4, T9.3, T9.4 |
| « Nos données passent-elles par les États-Unis ? » | /trust : fonctions en `fra1`, Neon Francfort ; sous-traitants hors UE listés avec leur finalité (modèles Claude) | T9.1 |
| « Votre export iXBRL est prêt pour le dépôt ? » | Bouton « iXBRL (bêta) », taxonomie affichée, texte B.5 | T10.6 |
| « Nos clients PME pourront refuser toutes nos demandes ? » | Questionnaire fournisseur avec tags et avertissement « au-delà de l'annexe II », limité au canal CSRD | T12.2 |
| « Votre scope 3 cloud, il vient d'où ? » | Catégorie 1, méthode RCP ADEME ou relevé du fournisseur, niveau de qualité de la donnée | T11.5 |
| « Qui valide que votre logiciel est conforme ? » | FAQ B.4 | T8.5 |
