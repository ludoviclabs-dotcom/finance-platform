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

> Critères d'acceptation nécessitant des ressources externes (Neon, CSV ADEME, secrets, Sentry DSN, UI 2FA) : voir [`docs/ops/ACTIONS_LUDO.md`](docs/ops/ACTIONS_LUDO.md).
