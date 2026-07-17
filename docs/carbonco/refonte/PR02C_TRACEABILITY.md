# PR-02C-code — Apply, workflow protégé, DATABASE_ADMIN_URL, runbook · Traçabilité

**Périmètre :** première des deux tranches de PR-02C (voir `PR02C_IMPLEMENTATION_PLAN.md` §1). Livre `apply`, le workflow manuel protégé, la connexion admin et le runbook — **sans toucher `main.py`** (le retrait de `ensure_schema_mw` est la 2ᵉ tranche, après baseline réel de la prod par Ludo).
**Base :** branche `feat/schema-migration-ledger-c`, à jour sur `master` (`882f4cd`, merge PR-02B [#96](https://github.com/ludoviclabs-dotcom/finance-platform/pull/96)).
**Statut : implémenté, non commité au moment de la rédaction — en attente de revue Ludo + run CI.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Périmètre livré (PR-02C-code)

| # | Élément | Statut | Preuve |
|---|---|---|---|
| 1 | Commande `apply` réelle, protégée | **FAIT** | `migration_runner.apply_one`/`apply_plan` (I1/I4/I5/§11) ; CLI `apply [--yes]` ; confirmation renforcée si `is_production()` sans `--yes` |
| 2 | Workflow GitHub manuel protégé | **FAIT** | `.github/workflows/db-migrate.yml` — `workflow_dispatch` uniquement, `environment: production-db`, secret `DATABASE_ADMIN_URL`, jamais push/PR/schedule |
| 3 | Retrait/désactivation `ensure_schema_mw` | **NON FAIT (délibéré)** | Reporté à PR-02C-retrait (2ᵉ tranche), seulement après baseline réel de la prod + confirmation `up_to_date: true` (§5 du plan) — `main.py` **non modifié** |
| 4 | Usage clair de `DATABASE_ADMIN_URL` | **FAIT** | `db.database.get_admin_db()` (rôle neondb_owner, non poolée, fallback loggé) ; consommée par les commandes mutantes du CLI + le workflow, jamais par l'app |
| 5 | Runbook production | **FAIT** | `docs/carbonco/MIGRATIONS_RUNBOOK.md` (10 sections) |
| 6 | `/health/schema` compatible | **FAIT (vérifié, non modifié)** | Aucun changement structurel nécessaire — l'endpoint (PR-02B) est déjà compatible avec le runner ; `routers/health.py` non touché |
| 7 | Doc déploiement + rollback | **FAIT** | Runbook §5 (procédure baseline prod), §8 (rollback), + `PR02C_IMPLEMENTATION_PLAN.md` §7/§9 |
| 8 | Tests ciblés | **FAIT** | voir §4 |

---

## 2. Décisions retenues (Ludo, 2026-07-17)

- **Découpage en 2 PR : validé.** Cette PR (PR-02C-code) est mergeable sans toucher la prod. Le retrait de `ensure_schema_mw` viendra dans une PR séparée après que Ludo aura baseliné la prod via le workflow et confirmé `up_to_date: true`.
- **`DATABASE_ADMIN_URL` = rôle `neondb_owner`** (rôle migrations/DDL, `SETUP_PROGRESS.md`). Provisionnement du secret GitHub par Ludo — hors code.
- **Runbook rédigé au moment du code** (fait).

---

## 3. Fichiers modifiés / créés

### Modifiés

- `apps/api/db/migration_runner.py` — `ManualMigrationRequired` (I4) ; `__init__(connection_factory=None)` (défaut `get_db`, poolée) — tous les appels internes `get_db()` passent par `self._connection_factory()` ; `_upsert_ledger_row` étendu (`execution_ms`/`error_message` optionnels, NULL pour baseline/mark) ; `apply_one` (transaction dédiée, `applied` après COMMIT — I1 ; `failed`+`error_message` sur échec — I5, exception propagée) ; `apply_plan` (lève `ManualMigrationRequired` avant exécution si `requires_owner` — I4 ; `MigrationError` si checksum_mismatch — I2 ; arrêt strict ; commit du bootstrap ledger avant apply, voir §5).
- `apps/api/db/database.py` — `DATABASE_ADMIN_URL`, `_admin_url()` (repli loggé), `get_admin_db()` (contrat identique à `get_db`, sans `company_id`).
- `apps/api/db/migration_cli.py` — commande `apply [--yes] [--json]` (confirmation prod, codes 0/1/2/3) ; `baseline`/`mark-manual-verified` instancient `MigrationRunner(connection_factory=get_admin_db)`.
- `apps/api/utils/env.py` — `is_production()` (extrait de `auth.py`, D-2).
- `apps/api/routers/auth.py` — `_is_prod()` délègue à `utils.env.is_production()` (comportement inchangé).
- `apps/api/.env.example` — `DATABASE_ADMIN_URL` documentée comme consommée (rôle, usage, fallback).
- 3 fichiers de tests étendus (`test_migration_runner.py`, `test_migration_cli.py`, `test_migration_ledger.py`).

### Créés

- `.github/workflows/db-migrate.yml` — workflow manuel protégé.
- `docs/carbonco/MIGRATIONS_RUNBOOK.md` — runbook opérationnel.
- `apps/api/tests/test_database_admin.py` — 3 cas (sélection d'URL `get_admin_db`, unitaire).
- `apps/api/tests/test_env_is_production.py` — 5 cas (`is_production`, unitaire).
- `docs/carbonco/refonte/PR02C_IMPLEMENTATION_PLAN.md` — plan de cadrage (phase précédente).
- `docs/carbonco/refonte/PR02C_TRACEABILITY.md` — ce document.

**Non touchés (confirmé)** : `apps/api/main.py` (ensure_schema_mw intact), `migrations.py`, les 28 fichiers `.sql`, `routers/health.py` (compatible sans changement), `apps/carbon`, données métier.

---

## 4. Tests ajoutés

| Fichier | Cas (total) | Ajouts PR-02C |
|---|---|---|
| `test_migration_runner.py` | 24 | +3 : `apply_plan` lève `ManualMigrationRequired` (requires_owner), lève sur checksum_mismatch, no-op sans rien à appliquer (aucune connexion ouverte — connection_factory qui lève) |
| `test_migration_cli.py` | 22 | +5 : `apply` refus prod sans `--yes` (exit 1, apply_plan jamais appelé), succès prod avec `--yes`, succès hors prod, `ManualMigrationRequired`→exit 3, `MigrationLockError`→exit 2 |
| `test_migration_ledger.py` | 26 | +4 (DB-gated) : `apply_plan` exécute une migration 028 synthétique (objet réellement créé, ligne `applied`+execution_ms), no-op au 2ᵉ passage (skip), échec SQL → `failed`+error_message+exception, requires_owner bloque sans exécuter |
| `test_database_admin.py` | 3 (nouveau) | `_admin_url` : préfère admin, repli loggé sur DATABASE_URL, None si rien |
| `test_env_is_production.py` | 5 (nouveau) | `is_production` : VERCEL_ENV prod/preview/dev, repli ENV, style GitHub Actions |

Les tests `apply` DB-gated utilisent une migration **028 synthétique** (dossier temporaire), jamais les 28 fichiers réels (déjà baselinés, tous `skip`) — `apply` n'a rien à exécuter sur le corpus existant.

---

## 5. Bug trouvé et corrigé pendant l'implémentation

En écrivant le test du chemin d'échec d'`apply_one`, j'ai identifié un bug réel : `_ensure_ledger_table()` crée `schema_migrations` **sans committer**. Sur le chemin d'échec, `apply_one` fait `conn.rollback()` — ce qui aurait annulé aussi ce `CREATE TABLE` non commité, faisant échouer l'écriture de la ligne `failed` juste après (table inexistante). **Corrigé** : `apply_plan` committe explicitement après `_ensure_ledger_table` (avant d'appliquer). Le commit ne libère pas le verrou advisory (verrou de session, indépendant des transactions). Vérifié par relecture ; la preuve réelle attend le run CI (pas de Postgres local).

---

## 6. Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `python -m py_compile` (13 fichiers touchés) | OK |
| `python -m db.migration_cli --help` + `apply --help` | OK, exit 0 (aucun caractère non-ASCII imprimé — leçon PR-02B appliquée) |
| `python -c "from main import app"` (app charge) | OK, 188 routes |
| `pytest -q tests/test_migration_runner.py tests/test_migration_cli.py tests/test_database_admin.py tests/test_env_is_production.py` | **54 passed** |
| `pytest -q` (suite complète) | **616 passed, 129 skipped, 5 failed** — mêmes 5 échecs pré-existants (`ModuleNotFoundError: vercel`). Progression : 600→616 (+16 unitaires/mockés), 125→129 skipped (+4 apply DB-gated) |
| `ruff check . --select=E,F,I --ignore=E501` | All checks passed |
| `git diff --check` | Aucune erreur whitespace |
| `yaml.safe_load(db-migrate.yml)` | Valide ; trigger = `workflow_dispatch` uniquement ; `environment: production-db` |

---

## 7. Limites restantes

- **Tests `apply` DB-gated non exécutés localement** (pas de `docker`, contrainte confirmée depuis PR-02B) — le job CI `migration-tests` est la seule preuve réelle. Le correctif §5 en particulier n'a jamais tourné contre un vrai Postgres.
- **`apply` n'a rien à exécuter aujourd'hui** — aucune migration 028+ n'existe. Le code est en place pour la première vraie migration future ; les tests l'exercent via une 028 synthétique.
- **PR-02C-retrait (main.py) reste à faire** — après le baseline réel de la prod par Ludo (§8).
- **D-1** (isolation preview réelle) toujours non confirmée par preuve directe — non bloquante (aucun `AUTO_MIGRATE`, aucun chemin automatique).

---

## 8. Reste à faire côté Ludo (hors code)

1. Provisionner le secret GitHub `DATABASE_ADMIN_URL` (chaîne `neondb_owner`).
2. Configurer l'environnement GitHub protégé `production-db` (reviewers).
3. Après merge : baseliner la prod via le workflow (runbook §5) : `plan` → `baseline --dry-run` → `baseline --commit` → `verify` → confirmer `/health/schema` `up_to_date: true`.
4. Alors seulement : demander la PR-02C-retrait (retrait de `ensure_schema_mw`).

---

## 9. Confirmations explicites

- **`ensure_schema_mw` intact** : `apps/api/main.py` non modifié (absent des fichiers touchés, §3). Le middleware reste le seul déclencheur de migration en prod, sans changement.
- **Aucune prod Neon touchée** : aucune commande de ce travail ne s'est connectée à Neon. Les tests `apply` ciblent exclusivement un conteneur/instance de test via `DATABASE_URL` — jamais exécutés ici faute d'environnement local.
- **Aucune baseline production, aucun apply production exécuté par Claude** : seul le code + la doc sont livrés ; toute écriture réelle passe par le workflow protégé, déclenché par Ludo.
- **Aucun apply automatique** : `apply` n'est appelé que par la commande CLI explicite (elle-même via le workflow approuvé). Jamais au démarrage de l'API, jamais par un cold start, jamais par un déploiement.
- **Erreurs jamais masquées** : `apply_one` propage toute exception après avoir écrit la ligne `failed` (jamais avalée) ; le fallback `DATABASE_ADMIN_URL`→`DATABASE_URL` est loggé, jamais silencieux.

---

## 10. Hotfix wiring DB Migrate (2026-07-17, post-merge #97)

**Symptôme** : `db-migrate.yml` échouait sur `status` avec « PostgreSQL non configuré (DATABASE_URL manquant ou psycopg2 absent) », alors que le secret `DATABASE_ADMIN_URL` était bien provisionné.

**Cause** : les commandes en lecture seule (`status`/`plan`/`verify`) utilisent le `MigrationRunner()` par défaut → `get_db()` (qui lit `DATABASE_URL`), et `load_records()` est gardé par `db_available()` qui teste `DATABASE_URL` uniquement. Le workflow n'exposait que `DATABASE_ADMIN_URL` → garde en échec. (Les commandes mutantes `baseline`/`apply` passaient déjà, via `get_admin_db`.)

**Correctif (workflow-only, aucun code touché)** : dans `db-migrate.yml`, mapper `DATABASE_URL: ${{ secrets.DATABASE_ADMIN_URL }}` en plus de `DATABASE_ADMIN_URL`. `DATABASE_ADMIN_URL` reste la source unique ; les deux pointent volontairement vers la connexion admin `neondb_owner` **uniquement dans ce workflow**. L'URL applicative runtime (Vercel) n'est jamais utilisée pour migrer. Le workflow reste `workflow_dispatch` uniquement, `environment: production-db`, jamais déclenché automatiquement. Documenté dans `MIGRATIONS_RUNBOOK.md` §4. Branche `fix/db-migrate-admin-url`.

---

## 11. Hotfix baseline commit — transaction aborted (2026-07-17)

**Run concerné** : DB Migrate run #5 (`29597664548`), job `migrate`, `command=baseline`/`baseline_mode=commit`.

**Symptôme** :
```
Erreur : current transaction is aborted, commands ignored until end of transaction block
```

**Diagnostic** : logs complets du run inspectés (`gh run view --job --log`) — **aucune erreur PostgreSQL antérieure n'apparaît nulle part dans le log**, seul ce message secondaire. Timing du job vérifié : les 15m51s de durée totale sont le délai d'**approbation de l'environnement protégé `production-db`** (job « Set up » à 17:04:54, alors que le `workflow_dispatch` datait de 16:49:24) — pas un blocage du code ; l'exécution réelle (`Run migration command`) n'a duré que ~2 s avant l'échec.

**Cause racine (mécanisme confirmé par lecture du code, pas supposé)** : `baseline()` traitait les 29 versions dans **une seule transaction** sur toute la durée de la boucle. Une vraie erreur PostgreSQL sur UNE version (sonde ou écriture) n'était jamais suivie d'un `ROLLBACK` avant de continuer — la commande suivante (probe ou upsert de la version suivante) tombait alors sur « current transaction is aborted », qui est ce que le CLI affichait, masquant l'erreur SQL réelle d'origine.

**Important — honnêteté sur la limite du diagnostic** : la log ne permet pas de savoir QUELLE erreur PostgreSQL précise a déclenché l'abandon en premier (c'est exactement ce que ce correctif rend visible pour la prochaine tentative). Je n'invente pas de cause SQL spécifique — `baseline --dry-run` relancé après ce correctif révélera le vrai message si le problème persiste.

**Correctif** (`migration_runner.py::baseline()`) :
- Le bootstrap de `schema_migrations` est committé immédiatement après création (comme déjà fait dans `apply_plan`).
- Chaque version est traitée dans sa **propre unité de commit** (comme `apply_one`) : sonde et écriture entourées d'un `try/except` qui fait `conn.rollback()` **avant** de relever une `MigrationError` explicite intégrant la version concernée et le message PostgreSQL d'origine (`raise ... from exc`).
- Arrêt strict au premier échec réel (pas de baseline partielle silencieuse) — mais les versions traitées avant l'erreur dans le même run restent committées individuellement, donc un nouveau `baseline --commit` reprend proprement (`already_recorded` pour ce qui est déjà fait).

**Commande qui avait échoué** : `baseline --commit` (via `db-migrate.yml`, `command=baseline`, `baseline_mode=commit`).

**Commande à relancer après merge** : `command=plan` puis `command=baseline`/`baseline_mode=dry-run` d'abord (la cause racine, si elle réapparaît, sera visible cette fois) ; si propre, relancer `baseline_mode=commit`.

**Ne pas lancer `apply`** avant que `verify` confirme `{"anomalies": []}` et que `/health/schema` confirme `up_to_date: true`.

**Tests ajoutés** (`test_migration_ledger.py`, DB-gated) : rollback + cause racine visible sur erreur de sonde simulée ; reprise propre après correction de la « panne » ; table du ledger déjà créée mais vide correctement supportée.
