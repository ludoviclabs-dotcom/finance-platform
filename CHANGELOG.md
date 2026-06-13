# Changelog — CarbonCo

Toutes les évolutions notables de CarbonCo (`apps/carbon` + `apps/api`) sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Feuille de route et critères d'acceptation : [`docs/carbonco/PLAN_ACTION_CARBONCO.md`](docs/carbonco/PLAN_ACTION_CARBONCO.md).

## [Non publié]

### P0 — Mise en véracité de la vitrine

- **T0.1** — Purge des claims invérifiables : suppression des témoignages et logos clients fictifs, du comparatif Workiva/Enablon/Greenly, des stats fausses (« 2 % du CA », « deadline 2025 », « 53 Mds € »), de « Conçu avec des experts ». « Bilan Carbone® » → « bilan GES ». Footer « CarbonCo SAS » → « projet non commercialisé » (D2). Blocs « Programme pilote » (A.4) et « Pourquoi la preuve d'abord » (A.5).
- **T0.2** — Registre unique `apps/carbon/data/feature-status.json` (source de vérité des statuts) + helpers + badge. `/etat-du-produit` et `/couverture` pilotés par le registre.
- **T0.3** — Terminologie post-Omnibus : « ESRS Set 2 » → « ESRS » (copy user-facing), reformulation « 127 datapoints », contexte réglementaire (A.1), hero (A.2), encart CBAM (A.3). Guide renommé « CSRD & VSME après l'Omnibus (2026) » + redirection.
- **T0.4** — Page `/integrations` véridique : 3 sections issues du registre (Disponible / Imports fichiers planifiés / Roadmap) ; suppression du catalogue de connecteurs fictifs.
- **T0.5** — Jeu démo unique `apps/carbon/data/demo-dataset.json` (Exemplia Industrie) : convergence des chiffres contradictoires, typographie FR complète, disclaimer « données fictives ».
- **T0.6** — Canonical/SEO basés sur `NEXT_PUBLIC_SITE_URL` (`lib/site-url.ts`) ; pages légales honnêtes (D2) ; sous-traitants alignés sur les dépendances réelles (Stripe retiré).

### P1 — Socle technique fiable

_(à venir)_
