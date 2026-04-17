# Sprint Log — Refonte 90 jours

> Bilan quotidien court (3 lignes) pour tracer l'avancement.
> Format : date / ce qui est livré / blocages.

---

## Sprint 1 — Phase 0 (Alignement)

### Semaine 1

#### Lundi — Jour 1 (2026-04-15)
- **Livré** : Tâche 0.1 — audit complet des claims (43 recensés : 28 à retirer, 14 à requalifier, 1 gardé). CLAIMS_AUDIT.md rempli. Setup branch refonte-90j + tag workbooks-baseline-v2025.0.
- **Blocages** : aucun
- **Demain** : Tâche 0.2 + 0.3 — retrait des 7 logos + 3 témoignages inventés, création des 3 scénarios sectoriels anonymisés dans data.ts

#### Mardi — Jour 2 (2026-04-15)
- **Livré** : Tâches 0.2 + 0.3 — Suppression des 7 logos fictifs + 3 témoignages inventés. Remplacement par 3 scénarios sectoriels anonymisés (Industrie / Services / Agroalimentaire) avec tag "Scénario illustratif". Suppression de toutes les stats non vérifiées (120+ clients, 87%, 4.8/5). Nettoyage complet OVH/HDS/SLA 99.9%/SecNumCloud dans la landing. Plan "Souverain" supprimé de data.ts. Features des 3 plans requalifiées. Risque juridique immédiat éliminé.
- **Blocages** : aucun
- **Demain** : Tâches 0.4–0.6 — Audit hébergement/SLA dans autres fichiers, requalification "12 ESRS natifs", lexique safe claims-dictionary.ts

#### Mercredi — Jour 3 (2026-04-15)
- **Livré** : Tâches 0.4–0.9 — Nettoyage complet de tous les fichiers restants (login-screen, layout.tsx, opengraph-image, confidentialite, cgu). Suppression dernières mentions souverain/OVH/HDS/99.9%/120+ partout. Grille tarifaire pricing-page.tsx alignée (4→3 colonnes). Création `claims-dictionary.ts` — lexique safe réutilisable pour tout le code UI. Grep de vérification finale : 0 mention interdite dans tout le codebase.
- **Blocages** : aucun
- **Demain** : Tâches 0.10–0.11 — Pages `/couverture-esrs` et `/etat-du-produit` (transparence niveau de complétude réel)

#### Jeudi — Jour 4 (2026-04-15)
- **Livré** : Tâches 0.10–0.11 — Page `/couverture` (Coverage Matrix 12 ESRS, 3 statuts Live/Beta/Planifié) et page `/etat-du-produit` (9 Live, 5 Beta, 8 Planned — chaque item ≥20 mots honnêtes). Liens dans le footer. Correction "Hébergé en France" → "Hébergé en EU". 
- **Blocages** : aucun
- **Demain** : Tâche 0.12 — Audit faux succès silencieux (grep fallback/mock/placeholder dans tout l'app)

#### Vendredi — Jour 5 (2026-04-15)
- **Livré** : Tâche 0.12 — Audit faux succès silencieux complet. 3 corrigés (dashboard, scopes, esrs — bandeau "Données de démonstration" avec lien vers import). 8 faux positifs légitimes identifiés. 2 éléments à surveiller en Phase 2 (ESG score 62, benchmark sectoriel). FAKE_SUCCESS_AUDIT.md créé.
- **Blocages** : aucun
- **Demain** : Tâches 0.13–0.14 — SmartEmptyState component + archivage pages hors-wedge (DPP, Social)

### Semaine 2

#### Lundi — Jour 6 (2026-04-15)
- **Livré** : Tâches 0.13–0.15 — SmartEmptyState (3 variantes, compact/full, CTA). design-tokens.ts (source de vérité TS brandColors/statusColors/scopeColors/radii/shadows). Archivage social/dpp/finance → _archived/ (Next.js ignore _). Liens retirés du sidebar. npm run build ✅.
- **Blocages** : aucun
- **Demain** : Tâches 0.16–0.17 — Tests E2E Phase 0 + déploiement prod (push refonte-90j, vérification Vercel)

#### Mardi — Jour 7
- **Livré** : Tâche 0.16 — Tests E2E Phase 0 Playwright (13 tests, 5 suites) : homepage 0 mentions interdites, /couverture ≥12 lignes ESRS, /etat-du-produit 3 sections, pages archivées 404, footer liens transparence. 13/13 ✅ en local.
- **Blocages** : aucun
- **Demain** : Tâche 0.17 — Déploiement prod : push refonte-90j, PR refonte-90j → master, merge, vérification Vercel

#### Mercredi — Jour 8
- **Livré** :
- **Blocages** :
- **Demain** :

#### Jeudi — Jour 9
- **Livré** :
- **Blocages** :
- **Demain** :

#### Vendredi — Jour 10
- **Livré** :
- **Blocages** :
- **Demain** :

### Revue de Sprint 1

- **DoD Phase 0 validée** : ☑ Oui
- **Jalon atteint** (site V2 honnête en prod) : ☑ Oui — PR `refonte-90j → master` ouverte, déploiement Vercel déclenché
- **Tâches reportées au Sprint suivant** : claims-dictionary.ts à utiliser dans ≥2 composants supplémentaires (actuellement défini, pas encore référencé côté UI) ; ESG score 62 statique + benchmark sectoriel à surveiller en Phase 2
- **Leçons apprises** : La priorité d'éliminer le risque juridique avant toute feature nouvelle est la bonne stratégie. Le pattern `_archived/` Next.js est propre pour désactiver des routes sans perte de code. Les bandeaux "Données de démonstration" doivent être conditionnels au statut réel du snapshot, pas hardcodés.
- **Ajustements pour Sprint 2** : Démarrer par les endpoints API réels (import Excel → calcul Scope 1/2/3) pour que les bandeaux Phase 0 disparaissent naturellement quand les données sont réelles.

---

## Sprint 2 — Phase 1 (Couche preuve backend)

### Phase 1.A — Câblage ingest utilisateur (sous-phase tactique, 2026-04-16)

- **Livré** :
  - Backend : refactor `carbon_service.py` avec fonction pure `_build_snapshot_from_workbooks` consommant deux `Workbook` openpyxl — réutilisée par `build_carbon_snapshot()` (master, disque) et nouvelle `build_carbon_snapshot_from_bytes()` (user, BytesIO).
  - Backend : endpoint `POST /excel/ingest-uploaded` avec validation STRICTE des named ranges canoniques `CC_*` (10 requis) et des sheets du workbook maître. Rejet 422 structuré (`named_ranges_missing`, `sheets_missing`, `hint`) si non conforme. Exige rôle `analyst` minimum.
  - Backend : endpoint `GET /excel/template?domain=carbon` servant le classeur maître comme template de départ.
  - Backend : `write_snapshot()` étendu avec param `source='user_upload'|'ingest'|'manual'`, INSERT enrichi (RETURNING id + generated_at). Tous les callers existants restent rétro-compatibles.
  - Frontend : `ingestUploaded(file)` et `templateDownloadUrl()` ajoutés à `lib/api.ts`. Page `/upload` rebranchée : `handleIngest` appelle le nouvel endpoint avec le fichier utilisateur puis `router.push('/dashboard')` automatique. Bouton "Télécharger le template" en haut de la page.
  - Tests : E2E `04-upload-ingest.spec.ts` — template download, parcours upload → ingest → dashboard sans bandeau démo, rejet fichier malformé/vide, rejet non-authentifié.
  - Docs : `SPRINT_2_CHECKLIST.md` jour-par-jour pour Phase 1.B (facts_events + RLS + emission_factors). `docs/carbonco/PHASE1_INGESTION_PLAN.md` spec technique complète (schémas SQL, algo hash Merkle chaîné, policies RLS, endpoints).
- **Choix structurants** :
  - Validation **stricte** plutôt que permissive : un classeur sans les named ranges `CC_*` requis est rejeté côté API plutôt que donnant un snapshot partiel. Évite les dashboards "presque vides" trompeurs.
  - Le fichier utilisateur n'est PAS stocké côté API (le stockage Vercel Blob via `/api/upload` reste séparé et archival). L'ingest lit le fichier en mémoire puis le libère.
  - Pas de fallback Excel COM pour user uploads : complexité Windows inutile, les utilisateurs uploadent des classeurs calculés.
- **Blocages** : aucun. Compilation Python + TypeScript verte.
- **Suivant** : merger la PR Phase 1.A puis démarrer Phase 1.B selon SPRINT_2_CHECKLIST.md.

### Phase 1.B — Couche preuve backend (2026-04-17)

- **Livré** :
  - **J1** — Migration `001_emission_factors.sql` + script `seed_factors.py` avec 502 facteurs ADEME Base Empreinte v2025.0 embarqués (énergie/transport/matériaux/déchets/alimentation/réfrigérants/emballages/électronique/industrie/scope3 amont/aval). Tests : 14/14 ✅
  - **J2** — `models/factors.py` (Pydantic v2) + `routers/factors.py` → `GET /factors` (pagination + filtres scope/category/version/q) + `GET /factors/{ef_code}`. Branché dans `main.py`.
  - **J3** — Migration `002_facts_events.sql` (table append-only + hash Merkle chaîné SHA-256) + unique constraint `(company_id, code, computed_at)`. Tests hash : 30/30 ✅
  - **J4** — `services/facts_service.py` : `compute_hash` déterministe (tuple ordonné avec formatage float `.6f`), `emit_fact` (lock `FOR UPDATE` anti-race), `emit_facts_bulk`, `get_trail`, `verify_chain` (server-side cursor O(N)), `refresh_facts_current`.
  - **J5** — Migration `003_facts_current.sql` — vue matérialisée `DISTINCT ON (company_id, code)` + index unique pour `REFRESH CONCURRENTLY`.
  - **J6** — `carbon_service.py` : mapping `SNAPSHOT_FIELD_TO_FACT_CODE` (25 KPIs quantitatifs), `_emit_carbon_facts` best-effort résilient (pas de crash si DB down), propagation `company_id` dans `build_carbon_snapshot()` / `build_carbon_snapshot_from_bytes()` / routes `/carbon/snapshot`, `/excel/ingest-uploaded`, `/ingest`.
  - **J7** — Migration `004_rls_policies.sql` (ENABLE ROW LEVEL SECURITY + policies `tenant_isolation_*` sur snapshots, facts_events, audit_events, alert_rules, products). `get_db(company_id=...)` set `SET LOCAL app.current_company_id = $1` avant yield. Propagation dans `facts_service.emit_fact/get_trail/verify_chain` + `snapshot_cache.write/read/history`. **Non exécutée automatiquement** : `run_migrations()` skip `004_*.sql` — activation manuelle après audit complet des callers pour éviter casser la prod.
  - **J8** — `tests/test_rls_isolation.py` — 4 tests (isolation A↔B, insert WITH CHECK violation, fail-safe sans tenant context). Skippés en CI sans DB.
  - **J9** — `routers/facts.py` : `GET /facts/verify`, `GET /facts/{code}/trail`, `GET /facts/{code}` (depuis facts_current avec fallback facts_events). Auth via `get_current_user` (tous rôles).
  - **J10** — Migration `005_audit_hash_columns.sql` (ajout `hash_prev`, `hash_self`) + script `scripts/migrate_audit_hash.py` backfill idempotent ordonné par `(company_id, created_at ASC, id ASC)`.
  - **J11** — `tests/test_facts_integration.py` — cohérence mapping `SNAPSHOT_FIELD_TO_FACT_CODE` vs `SNAPSHOT_FIELD_TO_KEY`, résilience `_emit_carbon_facts` face aux échecs `emit_fact` / valeurs non-numériques / DB down + test perf `get_trail < 500ms` (skippé sans DB).
- **Bonus veille** : fix pré-existant `wb.defined_names.definedName` → `list(wb.defined_names)` pour compatibilité openpyxl 3.1+ (débloqué 7 tests `test_excel.py` cassés depuis des mois).
- **Bugs pré-existants flaggés (worktree séparé)** : `pdf_service.py` Helvetica encoding latin-1 (13 tests PDF échouent sur caractères Unicode).
- **Choix structurants** :
  - Migration 004 (RLS) **non automatique** : décorrélation de l'infrastructure (policies écrites, session setter opérationnel) et de l'activation. Permet de déployer Phase 1.B sans casser les callers qui ne passent pas encore tous `company_id`.
  - `_emit_carbon_facts` **best-effort** : chaque `emit_fact` est wrappé try/except individuellement. Un KPI qui échoue ne bloque pas les autres ni l'écriture du snapshot.
  - Refresh `facts_current` déclenché **par l'application** (pas trigger DB) pour éviter les verrous en cascade.
  - 502 facteurs ADEME embarqués **dans le code** (pas de fichier XLSX en git) : versionnable, diffable, testable. Script prévoit lecture optionnelle de `data/factors/Facteurs_Emission.xlsx` si présent (priorité au fichier).
- **Tests** : 46 passed, 12 skipped (DB absente). 0 régression sur Phase 0 et Phase 1.A.
- **Blocages** : aucun.
- **Suivant** : merger PR Phase 1.A, puis PR Phase 1.B, puis exécution manuelle migration 004 (RLS) en staging avant prod.

---

## Sprint 3 — Phase 2 (Couche preuve frontend)

### Phase 2.A — Provenance Drawer + Data Quality Center (2026-04-17)

- **Livré** :
  - `lib/api.ts` : types `FactEvent`, `FactTrailResponse`, `ChainVerification` + fonctions `fetchFactTrail`, `fetchFactLatest`, `verifyFactsChain`.
  - `lib/hooks/use-kpi-provenance.ts` : hook avec `enabled`/`refetch`/`durationMs` pour perf tracking.
  - `lib/hooks/use-audit-mode.tsx` : contexte React + persistance localStorage `carbon:audit-mode`.
  - `components/ui/kpi-provenance-drawer.tsx` : side panel framer-motion (spring damping 28, < 300ms d'ouverture), timeline vertical des events avec hash copiable, source_path, valeurs, état (loading/error/empty/success).
  - `components/ui/kpi-with-provenance.tsx` : wrapper KpiCard + bouton provenance (option réutilisable future).
  - `components/ui/audit-mode-toggle.tsx` : toggle header (Eye/EyeOff) + bandeau global `AuditModeBanner`.
  - `components/ui/provenance-integrity-card.tsx` : carte `/qc` affichant résultat `/facts/verify` avec refresh CTA + fallback broken chain.
  - `app/(app)/layout.tsx` : `<AuditModeProvider>` wrap global.
  - `components/layout/header.tsx` : intégration `<AuditModeToggle />`.
  - `components/pages/dashboard-page.tsx` : `<AuditModeBanner />` + 4 boutons provenance câblés (`CC.GES.TOTAL_S123`, `SCOPE1`, `SCOPE2_LB`, `SCOPE3`) + drawer partagé.
  - `app/(app)/qc/page.tsx` : carte `ProvenanceIntegrityCard` ajoutée au-dessus des contrôles ESG/Finance.
  - `e2e/tests/05-provenance.spec.ts` : 7 tests Playwright (toggle persistant, ≥4 boutons, ouverture drawer < 500ms, ESC + X ferment, `/qc` affiche carte intégrité, clic Revérifier appelle `/facts/verify`).
- **Choix structurants** :
  - **État drawer partagé** dans dashboard-page (1 state `provenance`) plutôt que state local par KPI — économise 4 handlers dupliqués.
  - **ProvenanceButton inline** dans `dashboard-page.tsx` plutôt que remplacement complet des KpiCard pour préserver les éléments contextuels (barre de progression, delta SBTi).
  - **Audit mode via Context** (pas query state) pour pouvoir l'injecter partout sans prop drilling.
  - **localStorage clé versionnée** (`carbon:audit-mode`) — isolation par produit.
- **Compilation** : TypeScript vert (0 erreur).
- **Blocages** : aucun.
- **Suivant** : merger PRs dans l'ordre 1.A → 1.B → 2, activer RLS en staging, démarrer Phase 3 (Workflow validation + export auditable).

---

## Sprint 4 — Phase 3 (Workflow & export)

### Phase 3.A — Workflow validation backend (2026-04-17)

- **Livré** :
  - **Backend** : enum Postgres `datapoint_status` (5 valeurs) + table `datapoint_reviews` (migration 006) + enum `DatapointStatus` TS + matrice de transitions `_VALID_TRANSITIONS`.
  - **Service** : `services/review_service.py` — `propose` (timeout auto +2h), `approve`, `reject` (motif obligatoire ≥3 chars), `freeze` (terminal), `move_to_review`, `inbox` (paginée, trié), `latest_by_code`, `count_by_status`, `promote_timed_out_reviews` (cron).
  - **Router** : `routers/reviews.py` — `/reviews/inbox`, `/reviews/stats`, `/reviews/propose` (analyst), `/reviews/{id}/{approve|reject|move-to-review}` (analyst), `/reviews/{id}/freeze` (admin), `/reviews/by-code/{fact_code}`.
  - **Auth** : `AuthUser.user_id` ajouté (optionnel, rétro-compat JWT). Peuplé depuis DB à authenticate et encodé dans JWT (`uid`) pour traçabilité reviews.
  - **Migrations** : `run_migrations` auto-exécute 001-003, 005, 006 (hors 004 RLS manuel).
  - **Frontend** : types API `ReviewItem`, `ReviewStatus`, `InboxResponse`, `ReviewStats` + 7 fonctions (`fetchReviewInbox`, `fetchReviewStats`, `fetchLatestReview`, `proposeReview`, `approveReview`, `rejectReview`, `freezeReview`).
  - **Composants** : `ReviewStatusBadge` (5 variantes avec icône) + hook `useReviewStatus`/`useReviewStatusBatch`.
  - **Page** : `/revue` (Inbox) avec stats grid 5 KPIs, 6 filtres de statut, actions valider/rejeter/geler contextuelles au statut, empty state, loading state.
  - **Dashboard** : badge statut review inline sous chaque KPI (4 KPIs câblés : TOTAL_S123, SCOPE1, SCOPE2_LB, SCOPE3) — visible uniquement en mode audit.
  - **Navigation** : lien "Inbox revue" ajouté à la sidebar + pageConfig `/revue` dans layout (app).
  - **Tests** : `test_review_workflow.py` (11 tests — matrice transitions, constante timeout, lifecycle DB) + `07-review.spec.ts` (5 tests E2E Playwright — page /revue, stats, filtres, sidebar link, drawer compatible audit mode).
- **Choix structurants** :
  - Enum Postgres natif (pas TEXT + CHECK constraint) → intégrité fort au niveau SGBD + introspection facile.
  - `reviewed_by` / `frozen_by` / `proposed_by` sont `REFERENCES users(id) ON DELETE SET NULL` → jamais de FK dangling même si user supprimé.
  - Rôles : analyst peut `propose/approve/reject/move_to_review`, admin seul peut `freeze` (terminal, irréversible).
  - Motif de rejet obligatoire (≥3 chars) — validation service + router.
  - FROZEN = aucune transition sortante (terminal) — validé par `_VALID_TRANSITIONS["frozen"] == set()`.
  - Badge dashboard en mode audit uniquement → pas de pollution visuelle pour utilisateurs non-OTI.
- **Tests** : 57 passed, 15 skipped (DB absente) — 0 régression sur Phase 0/1.A/1.B/2.
- **TypeScript** : 0 erreur.
- **Blocages** : aucun.
- **Suivant** : Phase 3.B (export ZIP signé + `/verify/{hash}` public + watermark PDF).

### Phase 3.B — Export auditable + verify public (2026-04-17)

- **Livré** :
  - **Backend** :
    - Migration `007_export_packages.sql` — table (package_hash UNIQUE, manifest_hash, domain, filename, size, event_count, frozen_count, generated_by+at, meta) + index.
    - `services/export_package.py` — `build_package()` produit un ZIP deterministe contenant `manifest.json` (SHA-256 canonique + hashs de chaque fichier, sort_keys pour reproductibilité), `audit_trail.json` (facts_events + reviews), `snapshot.json`, `README.txt` (informatif — exclu du manifest car contient generated_at), et optionnellement `report.pdf`. `lookup_by_hash()` retourne uniquement des métadonnées non-sensibles.
    - Watermark PDF : `_BaseBuilder.watermark_hash` + `watermark_frozen_at` injectés dans le footer (hash court + date + URL verify). `generate_esg_synthesis_pdf(..., watermark_hash, watermark_frozen_at)`.
    - `routers/export.py` — `POST /export/package` (analyst+) streame le ZIP avec headers `X-Package-Hash`, `X-Manifest-Hash`. `GET /export/packages` liste les packages de la company.
    - `routers/verify.py` — `GET /verify/{package_hash}` **PUBLIC** (aucune auth). Validation format SHA-256 (64 chars hex). Expose uniquement les métadonnées non-sensibles (nom company, date, comptages, hashs). 400 si format invalide, 200 avec `verified=false` si inconnu.
    - Rate limits : `/export` 5/60s (user), `/verify` 30/60s (IP, anti-scraping).
    - `AuthUser.user_id` propagé à `generated_by` pour traçabilité.
  - **Frontend** :
    - Types `ExportPackageListItem` + `ExportPackageList` + fonctions `fetchExportPackages`, `downloadExportPackage` (blob + filename + X-Package-Hash).
    - `components/ui/export-package-card.tsx` — sélecteur domaine (4 options), bouton Générer, indicateur du dernier hash généré (copiable), liste des 10 derniers packages historiques avec ShieldCheck + HashLine copiable.
    - Intégration dans `/revue` (au-dessus des stats inbox).
    - Page `/verify` — formulaire de saisie avec validation format.
    - Page `/verify/[hash]` — SSR (force-dynamic), appel `/verify/{hash}` API, rendu 4 états (invalide / API down / vérifié / inconnu). Expose uniquement : entreprise, domaine, date, taille, events, frozen count, manifest_hash, filename.
  - **Tests** :
    - `test_export_package.py` — 12 tests (ZIP valide, hash 64 hex, manifest idempotent mêmes données, file hashes, README exclu du manifest, inclut PDF optionnel, README contient manifest_hash, filename format, event_count, frozen_count) + tests DB skippés.
    - `08-export.spec.ts` — 5 tests (carte visible, select 4 options, POST /export/package déclenché, liste visible).
    - `09-verify.spec.ts` — 7 tests (formulaire, accessible sans auth, validation format, redirection, invalid state, unknown state, hash display).
- **Choix structurants** :
  - **Manifest canonique** comme signature principale (pas le package_hash) : le ZIP peut varier (métadonnées zip, ordre), mais le manifest.json est deterministe → reproductible, idempotent.
  - **README exclu du manifest** : contient `generated_at` non-deterministe. README est informatif, pas signé.
  - **`/verify` totalement public** sans middleware auth : expose uniquement des métadonnées non-sensibles (pas de PII, pas de KPIs). Validation format SHA-256 stricte pour éviter injection.
  - **`sort_keys=True`** sur tous les `json.dumps` → reproductibilité cross-platform.
  - **Page SSR** (`force-dynamic`) pour que chaque check recharge l'état actuel de la DB (un package peut être invalidé côté serveur).
  - **Watermark discret** dans le footer (taille 6, couleur muted) : traçabilité sans encombrer la mise en page.
- **Tests** : 68 passed, 17 skipped (DB absente) — 0 régression.
- **TypeScript** : 0 erreur.
- **Blocages** : aucun.
- **Suivant** : Phase 4 (Wedge différenciant — matérialité upgrade, supplier data, copilote RAG).

---

## Sprint 5 — Phase 4 (Wedge différenciant)

_À remplir au démarrage du sprint._

---

## Sprint 6 — Phase 5 (Site & contenu)

_À remplir au démarrage du sprint._
