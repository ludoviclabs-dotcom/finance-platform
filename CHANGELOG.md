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

- **T1.1** — Phase 1.B finalisée : RLS FORCE opt-in (migration 009, bypass maintenance), émission de facts ESG/Finance, endpoint `/facts/replay`, tests transaction/p95/backfill.
- **T1.2** — Seed `emission_factors` depuis le CSV officiel ADEME Base Empreinte (ratios monétaires inclus) + procédure/licence ; `seed_factors.py` reste la fixture dev.
- **T1.3** — Ingestion asynchrone : table `ingest_jobs`, `POST /ingest` -> `ingestId`, `GET /ingests/{id}`, worker procrastinate (mode inline par défaut sur Vercel) + workflow drain.
- **T1.4** — 2FA TOTP (secret chiffré Fernet, 8 codes de récupération, login en deux temps, rate-limit 5/15 min) — API disponible, UI carbon en cours.
- **T1.5** — Durcissement uploads (15 Mo, magic bytes, anti zip-bomb) + rate-limit étendu (global/auth/uploads) + neutralisation injection de formule (exports API & front).
- **T1.6** — `StorageAdapter` abstrait : backends local (URL signées HMAC) et vercel-blob (REST sans SDK) ; pièces 5 Mo max.
- **T1.7** — Observabilité : Sentry API (opt-in `SENTRY_DSN`), `/health` enrichi (db/storage/worker/version), page publique `/status`.
- **T1.8** — Sauvegardes Neon chiffrées (cron + restore-check en CI), CI `carbon.yml` (lint/tsc/vitest/build) + job pytest API + validateur Block A `--root`, `.env.example` API, `docs/ops/ACTIONS_LUDO.md`.

### P2 — Boucle de preuve complète

- **T2.1** — Pièce justificative par datapoint : upload PDF/PNG/JPG (5 Mo, magic bytes) rattaché via un event chaîné append-only ; SHA-256 protégé par `verify_chain` (`source_path = evidence:<sha>`), révocation chaînée, fichier content-addressed. `POST/GET/DELETE /facts/{code}/evidence`.
- **T2.2** — Rôle « Auditeur invité » : lien lecture seule scopé company (30 j, révocable), résolution/journalisation via fonctions SECURITY DEFINER (migration 012). Vue `/audit/[token]` : KPI → trail+source → pièces. Aucune écriture exposée ; consultations journalisées.
- **T2.3** — `/verify` public bout-en-bout : résolution par `package_hash` OU `manifest_hash` ; `POST /verify/recompute` recalcule un ZIP déposé → authentique / inconnu / **altéré** (cohérence interne fichier par fichier).
- **T2.4** — Evidence Pack auto-suffisant : pièces embarquées sous `evidence/{sha}.{ext}` (signées au manifest) + `CHECKSUMS.sha256` (format `sha256sum -c`) ; téléchargement depuis la vue auditeur (`GET /auditor/public/{token}/pack`).
- **T2.5** — `verify_chain` planifié : table `chain_verifications` (migration 013) horodatée, job quotidien (`chain-verify.yml`), badge dashboard « chaîne vérifiée le … — N events » (rouge si rompue, audit_event d'erreur).
- **T2.6** — Indicateurs preuve & qualité : `quality` 1-5 déduit du `source_path`, widgets (couverture pièces, distribution, fraîcheur facteurs) et **score audit 0-100** à formule publiée ([`docs/carbonco/AUDIT_SCORE.md`](docs/carbonco/AUDIT_SCORE.md)).

### P3 — Module VSME (livrable vendable 2026)

- **T3.1** — Référentiel VSME : catalogue global EFRAG (B1-B11 + C1-C9) dans `data/vsme_datapoints.json` (+ `docs/carbonco/VSME_DATAPOINT_MAPPING.md`), table `vsme_datapoints` (migration 014, sans RLS), seed CLI, `GET /vsme/datapoints`. Réutilise les fact codes `CC.GES.*`.
- **T3.2** — Mapping → VSME + complétude : `vsme_field_values` (migration 015, RLS), mapping auto E1/matérialité/S1/G1 → modules (statut/source), complétude honnête (dénominateur = obligatoires), saisie guidée (fact chaîné `manual:user@`, justification ≥10 car. si non applicable). Page `/vsme/completude`.
- **T3.3** — Export Rapport VSME : PDF (structure EFRAG, page de garde + sections par module) + annexe Excel (onglet/module, hash par ligne, cellules sanitizées), ZIP auditable (manifest + `CHECKSUMS.sha256`, enregistré `export_packages` domaine `vsme` pour `/verify`), `manifest_hash` déterministe. `POST /vsme/report`.
- **T3.4** — Wizard « VSME en 10 étapes » : `vsme_wizard_sessions` (migration 016, RLS), progression persistée + reprise, facts émis en bulk au `complete`. Page `/vsme/wizard` + e2e Playwright.
- **T3.5** — Repositionnement VSME-first : hero « Votre rapport VSME, auditable », pricing « Starter » → « VSME », encart VSME sur `/couverture` (registre), article `/blog`. Statut registre `module-vsme` = beta.

### P4 — Ancrage français : BEGES, Scope 3, FEC, périmètre

- **T4.1** — Quinze catégories Scope 3 GHG Protocol explicites : catalogue `data/scope3_categories.json`, codes suffixés `CC.GES.SCOPE3.{1..15}` (chaîne `compute_hash` inchangée), agrégation pure + couverture partielle honnête (catégories non évaluées visibles). `GET /scope3/categories` (public) + `/scope3/breakdown`, panneau dashboard.
- **T4.2** — Export BEGES réglementaire (France) : table de passage GHG Protocol → BEGES v5 (`data/beges_v5.json`, 6 catégories / 22 postes), ventilation pure (réconciliation total BEGES = total GHG), PDF + annexe Excel déterministes (réutilise le pipeline VSME), encart d'éligibilité (>500 métropole / >250 outre-mer), enregistré `export_packages` domaine `beges` pour `/verify`. Page `/beges`.
- **T4.3** — Import FEC → screening Scope 3 monétaire : parseur FEC pur (18 champs art. A.47, détection séparateur/encodage sans dépendance, équilibre débit/crédit), mapping PCG classe 6 → Scope 3 (`data/pcg_scope3.json`, plus-long-préfixe), ratios monétaires kgCO2e/€ (qualité = 4), écran de revue obligatoire — aucun fact émis sans validation (`source_path = fec:…`). Table `fec_screenings` (migration 017, RLS), `% spend mappé` affiché. Page `/fec`.
- **T4.4** — Périmètre organisationnel et multi-entités : approche de consolidation (contrôle opérationnel/financier / parts de capital), hiérarchie `companies.parent_id` + `ownership_pct` (migration 018), consolidation pondérée pure → vue groupe lecture seule (jamais ré-émise comme facts), changement d'approche journalisé (`perimeter_events`, RLS). Page `/consolidation`.
- **T4.5** — Année de référence & politique de recalcul : baseline gelée par organisation (KPIs + hash de chaîne au gel, migration 019), affichage « vs référence », recalcul motivé (`recalc_events`, motif CHECK) — le motif vit dans `meta` des facts ré-émis, **pas** dans `compute_hash` ; l'ancienne valeur reste consultable dans le trail. Page `/baselines`.

> Critères d'acceptation nécessitant des ressources externes (Neon, CSV ADEME, secrets, Sentry DSN, UI 2FA) : voir [`docs/ops/ACTIONS_LUDO.md`](docs/ops/ACTIONS_LUDO.md).
