# MODULE 2 — Plan d'implémentation (PR futures)

> **Phase 2 — architecture définitive, docs-only.** Date : 2026-07-22. Aucun code ni migration créé ici.
> **Règle de cadence** (héritée) : **une PR à la fois**, mergée et sa migration appliquée en prod (via `db-migrate.yml`, `DATABASE_ADMIN_URL`) **avant** de brancher la suivante (évite le conflit divergence-squash + les compteurs ledger auto-mergés). **Aucun commit/push/merge sans validation explicite de Ludo.**
> Migrations réservées : **042** (PR-M2A), **043** (PR-M2B).

---

## PR-M2A — Catalogue & réglementation

**Objet** : fondation lecture. Le référentiel canonique, ses alias legacy, ses statuts réglementaires sourcés, ses usages, son vocabulaire d'étapes par famille — et l'API de lecture.

**Fichiers attendus**
- `apps/api/db/migrations/042_resource_catalog_foundation.sql` (6 tables + semis global étapes/applicabilité + GRANT conditionnel `carbonco_app`).
- `apps/api/db/migration_manifest.py` (entrée `"042"`), `apps/api/db/migration_probes.py` (`_probe_042` + registre) — **+ compteurs ledger** dans les tests.
- `apps/api/models/resources.py` (modèles catalogue/alias/regulation/use/stage).
- `apps/api/services/resources/{catalog_service,alias_service,regulatory_service,sector_use_service,stage_service}.py` (prédicat `_SCOPE` partout).
- `apps/api/routers/resources.py` (GET catalog/aliases/regulations/uses/supply) + enregistrement `main.py`.
- Un **service d'import** des ressources canoniques (données, hors migration) — adaptateur Fake/CLI sous licence évaluée, motif `snapshot_migration` (PR-04).
- Tests : `_intelligence`-style fixtures + `test_resources_catalog.py`, `test_resources_regulatory.py`, `test_migration_probe_042` (DB-gated), tests purs de résolution slug/alias.
- `.github/workflows/api.yml` : inscrire les tests DB-gated dans `migration-tests`.
- `docs/carbonco/resources/PR_M2A_TRACEABILITY.md`.

**Risques** : compteurs ledger auto-mergés (grep `== 4x`) ; test DB-gated non inscrit dans `migration-tests` (inerte) ; semis global via `app.rls_bypass` mal placé (avant `ENABLE RLS` = piège au rejeu `startup_event`).

**Tests obligatoires** : `_probe_042` ; RLS globale/tenant ; `*_sourced_check` ; alias reverse-lookup ; `schema_not_ready` 503 ; garde de contenu Défense/Spatial.

**Critères de merge** : CI verte (`migration-tests` réel Postgres) ; aucun facteur carbone ; aucune donnée factuelle dans la migration (seuls vocabulaires structurels) ; aucun champ/seed de contenu interdit (§7 RLS) ; revue Codex traitée.

**Opérations post-merge (Ludo, hors code)** : `db-migrate.yml` → `plan` (confirmer 042 seule pending) → `apply` → `verify` → `/health/schema` `schema_version=042`. **Puis** lancer l'import des ressources canoniques (service, pas migration).

**Hors périmètre** : expositions, assessments, calculs, frontend, IRO.

---

## PR-M2B — Expositions & assessments

**Objet** : le moteur. Observations de supply, pont d'exposition multi-module, runs d'assessment immuables + dimensions, sensibilité, signal IRO.

**Fichiers attendus**
- `apps/api/db/migrations/043_resource_exposures_assessments.sql` (4 tables + ALTER `iros_origin_domain_check` + triggers d'immuabilité + GRANT).
- `migration_manifest.py` (`"043"`), `migration_probes.py` (`_probe_043` avec `_constraint_definition_contains` sur `iros`).
- `apps/api/services/resources/{supply_service,exposure_link_service,assessment_service}.py`.
- **Réutilisation** `services/crma/scoring.py` : paramétrer `herfindahl_pct(scale=…)` (défaut 100 CRMA inchangé, Module 2 = 10000) et lire le vocabulaire d'étapes depuis `resource_stage_applicability` (au lieu de `STAGE_ORDER` codé aimant) — **sans régression CRMA** (tests 034 inchangés).
- Analyse de **sensibilité OAT** (O-5) : nouveau module pur `services/resources/sensitivity.py`.
- `apps/api/models/resources.py` (+ exposure/assessment/dimension/alert), `routers/resources.py` (+ exposures, assessments, dimensions, alerts).
- Tests : HHI (10000/2500/couverture/invalides/étapes/années), confidence séparée, no-score-if-gate, sensibilité, RLS A/B non-superuser, IDOR link, immutabilité run, licence/O-10, signal IRO non-décisionnel.
- `docs/carbonco/resources/PR_M2B_TRACEABILITY.md`.

**Risques** : régression du moteur CRMA si `scoring.py` mal paramétré (le défaut `scale=100` doit être préservé) ; `iros_origin_domain_check` widening non détecté par une sonde naïve (exiger `_constraint_definition_contains`) ; run muté après approbation (trigger d'immuabilité) ; double-comptage HHI (clé unique observations).

**Tests obligatoires** : toute la §6 de `MODULE2_TEST_STRATEGY.md` + RLS §3 + IRO §9. Tests DB-gated → `migration-tests`.

**Critères de merge** : CI verte ; **tests CRMA 034 toujours verts** (non-régression) ; risque≠confiance prouvé ; aucune décision de matérialité automatique ; aucun appel externe/LLM dans le calcul.

**Opérations post-merge (Ludo)** : `db-migrate.yml` → `apply` 043 → `verify` → `/health/schema` `schema_version=043`.

**Hors périmètre** : frontend, demo.

---

## PR-M2C — Cockpit frontend

**Objet** : la surface produit (Next.js), lecture seule côté conformité.

**Fichiers attendus**
- `apps/carbon/app/(app)/resources/page.tsx` (catalogue), `resources/[slug]/page.tsx` (fiche : statut, chaîne de valeur par étape, composantes, alias, réglementation, usages), `resources/exposures/page.tsx`, `resources/assessments/page.tsx`, `resources/methodology/page.tsx` (méthode versionnée + disclaimer).
- `apps/carbon/lib/api/resources.ts` (client typé) ; composants sous `components/resources/*`.
- **Réutilise** `components/ui/{data-status-badge,reveal,animated-counter}`, `feature-status.json` (+ entrée `resources-module`, statut `beta`), `lib/product-modules.ts` (+ module « ressources »).
- Tests : vitest composants, Playwright parcours (catalogue → fiche → exposition → assessment), a11y.
- `docs/carbonco/resources/PR_M2C_TRACEABILITY.md`.

**Risques** : CSP `proxy.ts` (tout domaine externe front doit être en `connect-src` — mais MVP n'appelle que l'API interne) ; preview Vercel front `-ludovics-projects-` SSO-gated (vérifier via build + Playwright) ; preview sans `NEXT_PUBLIC_API_BASE_URL` (tâche connue) ; piège whitespace JSX ; node_modules jonction Windows par worktree.

**Tests obligatoires** : affichage `data-status`/`confidence` **à côté** du risque (jamais l'agrégat seul) ; aucune sparkline sans vraie série (≥2 points) ; statut piloté par registre, jamais codé en dur.

**Critères de merge** : CI verte ; a11y ; aucun statut codé en dur ; textes publics = fonctionnement réel (pas de claim non sourcé).

**Opérations post-merge** : redéploiement Vercel `carbon` automatique.

**Hors périmètre** : demo scénarisée, activation IA live.

---

## PR-M2D — Extension Asterion (Demo Studio)

**Objet** : un parcours de démonstration ressources stratégiques, 100 % fictif.

**Fichiers attendus**
- `apps/api/demo/scenarios/asterion-motion-v1/` (+ JSON ressources synthétiques cohérents avec le scénario existant), loader Pydantic.
- `apps/api/scripts/demo_*.py` (seed/reset/verify idempotent, transactionnel, slug-gardé) — **RAW SQL** via Evidence Kernel (rend la revue/score RÉELS), **zéro migration**.
- Cockpit `apps/carbon/app/(app)/demo/asterion-motion/*` (+ étape « dépendance ressource » sœur, ne clobber pas `/demo`).
- `.github/workflows/demo-scenario.yml` étendu (workflow_dispatch, env production-db).
- Tests : parité arithmétique du seed (DB-gated `migration-tests`), Playwright e2e, gitleaks allowlist fixtures.
- `docs/carbonco/resources/PR_M2D_TRACEABILITY.md` + `docs/carbonco/demo/*`.

**Risques** : `audit_eventtype_check` (purge `audit_events` avant `apply_upto`) ; gitleaks faux positif `"key"` (allowlist) ; test DB-gated sans `skipif` ; preview SSO-gated.

**Tests obligatoires** : seed idempotent (dry-run/commit/reset) ; **zéro appel IA payant, zéro appel externe** ; badges « IA SIMULÉE · ZÉRO APPEL EXTERNE · DÉMONSTRATION FICTIVE ».

**Critères de merge** : CI verte ; 100 % fictif ; zéro migration ; zéro coût.

**Opérations post-merge (Ludo)** : `demo-scenario` `action=seed mode=commit` (gate production-db) pour une démo « vivante ».

**Hors périmètre** : données réelles tenant, activation IA live.

---

## Séquencement & dépendances

```
PR-M2A (042, lecture)  ──►  PR-M2B (043, moteur)  ──►  PR-M2C (frontend)  ──►  PR-M2D (demo)
   merge + apply 042        merge + apply 043           redeploy carbon        seed demo
```

- PR-M2B dépend de 042 appliquée. PR-M2C dépend de l'API M2A/M2B. PR-M2D dépend du cockpit M2C.
- **Aucune** PR ne démarre avant validation explicite de Ludo, et chacune part de `master` à jour (rebase avant merge).

## Ce qui reste ouvert (non bloquant, tranché en implémentation)
- O-5 sensibilité (δ, persistance de la bande) — PR-M2B.
- O-8 nom de méthode (`CC-RESOURCE-EXPOSURE` proposé) — PR-M2B.
- O-10 gate licence commercial/dérivé — PR-M2A (au plus tard avant onboarding FAOSTAT/Eurostat restreint).
- ESRS simplifiés (O-9) — dépendance externe, champs configurables, ne pas figer.
