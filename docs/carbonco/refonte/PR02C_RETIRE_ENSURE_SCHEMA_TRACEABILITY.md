# PR-02C-retrait — Retrait de `ensure_schema_mw` · Traçabilité

**Périmètre :** 2ᵉ et dernière tranche de PR-02C (voir `PR02C_IMPLEMENTATION_PLAN.md` §1/§5 et `PR02C_TRACEABILITY.md` §3/§8). Retire le middleware `ensure_schema_mw` de `apps/api/main.py` maintenant que le ledger `schema_migrations` est baseliné en production. **Clôture le chantier PR-02 (A/B/C).**
**Base :** branche `fix/retire-ensure-schema-mw`, à jour sur `master` (`e2f5c76`, merge PR #100 `fix/baseline-bootstrap-rollback`).
**Historique du chantier :** PR-02A = [#95](https://github.com/ludoviclabs-dotcom/finance-platform/pull/95) · PR-02B = [#96](https://github.com/ludoviclabs-dotcom/finance-platform/pull/96) · PR-02C-code = [#97](https://github.com/ludoviclabs-dotcom/finance-platform/pull/97) · hotfixes wiring/baseline = [#98](https://github.com/ludoviclabs-dotcom/finance-platform/pull/98)/[#99](https://github.com/ludoviclabs-dotcom/finance-platform/pull/99)/[#100](https://github.com/ludoviclabs-dotcom/finance-platform/pull/100).
**Statut : implémenté, en attente de revue Ludo. PR non mergée automatiquement.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Preuve — état de production avant retrait

Condition strictement nécessaire posée par `PR02C_IMPLEMENTATION_PLAN.md` §5 (« Séquencement obligatoire », étapes 1-6) avant que l'étape 7 (« Seulement alors, une PR séparée retire le middleware ») ne soit exécutée — ce que fait cette PR.

Séquence exécutée par Ludo via le workflow `.github/workflows/db-migrate.yml`, rapportée en amont de ce travail (contexte de la demande) :

| Étape (`db-migrate.yml`) | Résultat rapporté |
|---|---|
| `command=status` | OK |
| `command=baseline`, `baseline_mode=dry-run` | OK |
| `command=baseline`, `baseline_mode=commit` | OK |
| `command=verify` | OK |
| `GET /health/schema` | `up_to_date: true`, `pending_count: 0`, `manual_required_count: 0` |

Cette confirmation a été communiquée par Ludo comme contexte de la demande. Aucun accès à Neon ou à l'URL `/health/schema` de production n'a été effectué par cet agent pour la vérifier (hors périmètre — « Ne touche pas à Neon », voir Interdictions de la mission) ; la preuve documentée ici est donc **déclarative (rapportée), pas ré-vérifiée en direct par Claude**. Elle fait suite à la série de hotfix nécessaires pour fiabiliser `baseline --commit` (transaction abandonnée — voir `MIGRATIONS_RUNBOOK.md` §11-12 et `PR02C_TRACEABILITY.md` §10-12, PR [#98](https://github.com/ludoviclabs-dotcom/finance-platform/pull/98)/[#99](https://github.com/ludoviclabs-dotcom/finance-platform/pull/99)/[#100](https://github.com/ludoviclabs-dotcom/finance-platform/pull/100)).

---

## 2. Raison du retrait

- Avant PR-02, deux déclencheurs auto-appliquaient le DDL au démarrage/à la 1ʳᵉ requête : `startup_event` (jamais invoqué en prod Vercel — `@vercel/python` n'exécute pas les events lifespan ASGI) et **`ensure_schema_mw`**, un middleware HTTP qui appliquait les migrations à la 1ʳᵉ requête de chaque cold start. Ce dernier était **le seul chemin qui touchait réellement le schéma de production** — confirmé de façon indépendante à trois endroits du dépôt : le commentaire historique de `main.py`, `PR02_ARCHITECTURE_PLAN.md` (tableau §"Déclencheurs actuels" : *« Prod (seul déclencheur réel aujourd'hui) »*), et `PR02C_TRACEABILITY.md` §9 (*« le middleware reste le seul déclencheur de migration en prod »*).
- PR-02A/B/C ont introduit un ledger explicite (`schema_migrations`) et un workflow GitHub manuel protégé (`db-migrate.yml`, approbation humaine via `environment: production-db`) comme chemin d'écriture schéma officiel — livré dès PR-02C-code (#97), mais **délibérément non branché** en lieu et place du middleware tant que la prod réelle n'était pas baselinée (`PR02C_TRACEABILITY.md` §1 item 3 : *« NON FAIT (délibéré) »*).
- Principe non négociable du runbook (`MIGRATIONS_RUNBOOK.md`, préambule) : *« aucune écriture sur le schéma de production ne se fait automatiquement [...] Le seul chemin autorisé est le workflow manuel »*. Tant qu'`ensure_schema_mw` restait actif, ce principe n'était pas encore *vrai en pratique* — un cold start pouvait toujours, en théorie, déclencher une écriture hors workflow.
- La prod est maintenant baselinée (`up_to_date: true`, §1). `ensure_schema_mw` n'a donc plus de rôle utile : toute version qu'il aurait appliquée est déjà `applied`/`baseline` dans le ledger, son court-circuit sentinelle (table `sites` présente) le rendait déjà quasi no-op — mais sa seule présence gardait ouvert un chemin d'écriture schéma non gouverné par le workflow protégé. Le retirer ferme ce chemin, conformément au séquencement acté depuis `PR02_ARCHITECTURE_PLAN.md` (§21) et confirmé dans `PR02C_IMPLEMENTATION_PLAN.md` §5.

---

## 3. Fichiers modifiés

### Modifié

- **`apps/api/main.py`**
  - Suppression du middleware `ensure_schema_mw` (`@app.middleware("http")`) et de son corps (appelait `ensure_schema()` via `run_in_threadpool` si `_migrations._schema_ensured` était `False`).
  - Suppression des imports devenus inutiles : `from starlette.concurrency import run_in_threadpool`, `from db import migrations as _migrations` ; `ensure_schema` retiré de l'import `db.migrations` (seul `run_migrations` reste importé, toujours utilisé par `startup_event`).
  - Réécriture du commentaire au-dessus de `startup_event` : l'ancien commentaire décrivait « deux déclencheurs complémentaires », devenu inexact. Le nouveau documente que `startup_event` reste seul, à titre de confort dev local uniquement (jamais invoqué en prod Vercel), et pointe vers le runbook et ce document.
  - **`startup_event`** (`@app.on_event("startup")` → `run_migrations()`) **conservé tel quel** — décision explicite actée dans `PR02C_IMPLEMENTATION_PLAN.md` §5 : *« reste (confort dev local — fonctionne réellement en local/uvicorn, jamais invoqué en prod Vercel de toute façon) »*.

### Créé

- **`docs/carbonco/refonte/PR02C_RETIRE_ENSURE_SCHEMA_TRACEABILITY.md`** — ce document.

### Non touchés (confirmé)

- **`apps/api/db/migrations.py`** — `run_migrations()`, `ensure_schema()`, `_schema_ensured`, `_SENTINEL_TABLE`, `DDL` intacts. `run_migrations()` reste utilisée par `startup_event` et par `apps/api/scripts/seed_admin.py`. `ensure_schema()` n'a plus aucun appelant en production (son seul appelant, `ensure_schema_mw`, est retiré) mais reste définie et testée (`tests/test_ensure_schema.py`, 5 cas, tous verts) — sa suppression n'était pas demandée par le périmètre de cette PR et casserait un test qui documente un contrat toujours valide (mockable, sans DB réelle). Voir §7 pour le statut exact de cet arbitrage.
- **`apps/api/db/migration_runner.py`**, **`apps/api/db/migration_cli.py`** — aucun changement ; le CLI et le workflow protégé restent l'unique chemin d'écriture schéma.
- Les 28 fichiers `.sql` de `apps/api/db/migrations/`.
- **`apps/api/routers/health.py`** — `/health` et `/health/schema` inchangés (déjà confirmés compatibles sans modification structurelle, `PR02C_TRACEABILITY.md` §1 item 6).
- **`.github/workflows/db-migrate.yml`** — inchangé, reste le seul workflow d'écriture schéma.
- `docs/carbonco/MIGRATIONS_RUNBOOK.md`, `docs/carbonco/refonte/PR02C_TRACEABILITY.md`, `PR02C_IMPLEMENTATION_PLAN.md`, `PR02_ARCHITECTURE_PLAN.md`, `PR02_TRACEABILITY_TEMPLATE.md` — documents historiques/gabarits, non réécrits (convention du dépôt : chaque tranche a sa propre traçabilité datée, pas de réécriture rétroactive d'un document déjà clos).
- `apps/carbon`, données métier, secrets, configuration Neon — aucune modification, aucun accès.

---

## 4. Confirmation — DB Migrate devient le seul chemin officiel d'écriture schéma

| Déclencheur | Avant cette PR | Après cette PR |
|---|---|---|
| `ensure_schema_mw` (1ʳᵉ requête utilisateur / cold start prod Vercel) | Actif — seul chemin qui touchait réellement la prod | **Retiré** |
| `startup_event` (démarrage ASGI) | Jamais invoqué en prod (`@vercel/python` n'exécute pas les events lifespan) | Inchangé — toujours jamais invoqué en prod ; reste actif en local/uvicorn uniquement, n'écrit jamais sur la base de production |
| `.github/workflows/db-migrate.yml` (`workflow_dispatch`, `environment: production-db`, approbation humaine, secret `DATABASE_ADMIN_URL`) | Chemin officiel mais coexistait avec le middleware | **Seul chemin qui écrit sur le schéma de production** |

En production, ni une requête utilisateur ni un cold start ne peuvent donc plus déclencher d'écriture schéma. Le seul code restant qui appelle `run_migrations()` (`startup_event`) ne s'exécute jamais sur le runtime serverless de production — fait déjà établi avant cette PR, revalidé ici par relecture du code et de la documentation (§5).

---

## 5. Vérification — aucune migration automatique possible

- **1ʳᵉ requête utilisateur** : plus aucun middleware n'appelle `ensure_schema`/`run_migrations`. Vérifié par lecture du diff (§3) et par recherche de `ensure_schema_mw` dans tout le dépôt après retrait : seules des mentions documentaires subsistent (`MIGRATIONS_RUNBOOK.md`, `PR02*_*.md` — historique et rollback, jamais du code).
- **Cold start production (Vercel)** : `startup_event` reste enregistré via `@app.on_event("startup")`, un event lifespan ASGI. Fait documenté à trois endroits indépendants du dépôt (commentaire original de `main.py`, préambule de `MIGRATIONS_RUNBOOK.md`, `PR02C_TRACEABILITY.md` §9) et non contredit par cette inspection : `@vercel/python` n'exécute pas ces events. `run_migrations()` n'est donc jamais appelée par un cold start en production, avec ou sans cette PR — cette PR ne change pas ce fait, elle retire l'**autre** déclencheur (celui qui, lui, touchait réellement la prod).
- **Cold start local/uvicorn** : `startup_event` s'exécute toujours (confort dev, décision actée en §5 de `PR02C_IMPLEMENTATION_PLAN.md`) mais cible exclusivement la base configurée localement par `DATABASE_URL` (poste développeur ou CI, jamais Neon prod — l'app ne détient d'ailleurs jamais `DATABASE_ADMIN_URL`, réservée au CLI/workflow, §6 de `PR02C_IMPLEMENTATION_PLAN.md`). Hors périmètre de « migrations automatiques en production ».
- **`/health`** : conservé sans modification (`routers/health.py` non touché).
- **`/health/schema`** : conservé sans modification ; reste la sonde publique de l'état du ledger (`schema_version`, `up_to_date`, `pending_count`, `manual_required_count`).

---

## 6. Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `cd apps/api && python -m py_compile main.py db/migrations.py db/migration_runner.py routers/health.py` | OK |
| `python -m pytest -q tests/test_migration_runner.py tests/test_migration_cli.py tests/test_migration_ledger.py tests/test_migration_probes.py` | **46 passed, 95 skipped** (skips = tests DB-gated, pas de Postgres local — comportement pré-existant documenté en `PR02C_TRACEABILITY.md` §7) |
| `python -c "from main import app; print('routes', len(app.routes))"` | OK — **188 routes** (identique à `PR02C_TRACEABILITY.md` §6 : aucune route perdue) |
| `git diff --check` (racine du dépôt) | Aucune erreur whitespace |
| `python -m pytest -q tests/test_ensure_schema.py` (vérification supplémentaire, non demandée par la mission) | **5 passed** — `db/migrations.py` non modifié, contrat inchangé |
| `python -m pytest -q --ignore=tests/test_health_storage_probe.py` (suite complète, vérification supplémentaire) | **616 passed, 134 skipped, 5 failed** — mêmes 5 échecs pré-existants (`ModuleNotFoundError: vercel`, `tests/test_storage_adapter.py`), même nombre de `passed` qu'avant cette PR (`PR02C_TRACEABILITY.md` §6 : 616 passed) → **aucune régression introduite** |

Aucune commande de migration (`baseline`, `apply`, `mark-manual-verified`) exécutée. Aucune connexion Neon établie. Aucune modification de `apps/carbon` ou de données métier.

---

## 7. Éléments reportés / hors périmètre

- **Rien n'est reporté à PR-03** par ce travail : le retrait d'`ensure_schema_mw` ne dépend d'aucune fonctionnalité PR-03 (Evidence Kernel, `PR02_ARCHITECTURE_PLAN.md`) et n'en bloque aucune. PR-03 n'a pas été commencée.
- **`startup_event` (confort dev local)** — conservé en l'état ; ce n'est pas un report mais une décision **permanente**, actée dans `PR02C_IMPLEMENTATION_PLAN.md` §5 (« reste »). Mentionné ici pour mémoire, pas un TODO.
- **`ensure_schema()`/`_schema_ensured`/`_SENTINEL_TABLE`** (`db/migrations.py`) — non supprimés, statut **PARTIEL** vis-à-vis de l'item 8.3 du gabarit `PR02_TRACEABILITY_TEMPLATE.md` (« dépréciés ou supprimés proprement ») : le déclencheur (`ensure_schema_mw`) est retiré, mais la fonction elle-même reste définie et testée, orpheline de tout appelant en production. Laissée intentionnellement — hors périmètre strict de cette PR (qui porte sur le retrait du *middleware*, pas sur `migrations.py`) et toujours couverte par `tests/test_ensure_schema.py`. Un nettoyage complet (suppression de la fonction + son test) serait une décision distincte, à proposer séparément si souhaité.
- **Migrations `004`/`009` (RLS)** — restent dans `MANUAL_ONLY_PREFIXES` de `db/migrations.py`, activation manuelle après audit des callers / validation `RLS_FORCE=1` contre une vraie base Neon. Différé avant cette PR, indépendant de PR-03, non touché ici.
- **Observation post-déploiement 24-48h** (`PR02C_IMPLEMENTATION_PLAN.md` §8, item 8.2 du gabarit) — à faire par **Ludo** après merge : surveiller les logs structurés en production, confirmer l'absence d'anomalie schéma applicative. Ce n'est pas une action de code et n'a donc pas pu être exécutée dans le cadre de cette PR.
- **`@app.on_event("startup")` déprécié** — `startup_event` émet un `DeprecationWarning` FastAPI (*« on_event is deprecated, use lifespan event handlers instead »*), déjà présent avant cette PR (le décorateur n'a pas été touché). Non corrigé ici : migrer vers le mécanisme `lifespan` de FastAPI dépasse le périmètre strict d'une « petite PR de retrait » et n'est pas nécessaire pour fermer le chantier PR-02.

---

## 8. Confirmations explicites

- **Aucune migration lancée** par ce travail ; aucune commande `apply`/`baseline`/`mark-manual-verified` exécutée par Claude.
- **Neon jamais touché** — aucune connexion sortante établie par cet agent, à aucun moment.
- **Les 28 fichiers `.sql` non modifiés.**
- **Aucune donnée métier modifiée.**
- **PR-03 non commencée**, aucun nouveau module produit créé.
- **CLI de migration conservé** (`apps/api/db/migration_cli.py` intact, non modifié).
- **Workflow DB Migrate conservé** (`.github/workflows/db-migrate.yml` intact, non modifié) — devient le seul chemin d'écriture schéma en production (§4).
- **PR non mergée automatiquement** — laissée ouverte pour revue de Ludo.
