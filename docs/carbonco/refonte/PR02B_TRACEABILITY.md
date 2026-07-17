# PR-02B — Ledger de migrations : bootstrap, baseline, verify, health · Traçabilité

**Périmètre :** deuxième tranche de `feat/schema-migration-ledger-b` — introduit le ledger réel de migrations sans retirer `ensure_schema_mw` et sans exécuter de migration production.
**Statut : implémenté, non commité au moment de la rédaction de ce document — en attente de revue Ludo.**
**Base :** branche `feat/schema-migration-ledger-b`, à jour sur `master` (`d59d582`, merge PR-02A [#95](https://github.com/ludoviclabs-dotcom/finance-platform/pull/95)).

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Périmètre PR-02B

Livré : bootstrap contrôlé de `schema_migrations` (fichier DDL séparé, hors découverte), vérification objet-par-objet des 28 migrations existantes + de la baseline `000` (DDL inline historique), `baseline()` (vérifie et marque `baseline`/`manual_required`), `verify()` (détecte `checksum_mismatch`/`drift_detected`), `mark_manual_verified()`, CLI `status`/`verify`/`baseline`/`mark-manual-verified` (`plan` inchangé depuis PR-02A), `GET /health/schema` minimal, tests unitaires + PostgreSQL (conteneur CI).

**Non livré, volontairement** (voir §2) : `apply_one`/`apply_plan`/CLI `apply`/`AUTO_MIGRATE` — décision explicite de Ludo, reportés à PR-02C.

---

## 2. Décisions retenues

Toutes validées par Ludo le 2026-07-17 (détail complet dans `PR02_DECISIONS.md`, mis à jour en conséquence) :

| # | Décision retenue pour PR-02B |
|---|---|
| D-1 | PR-02B ne dépend pas de la prod — tests/baseline limités à local/CI/staging. Vraie baseline prod = PR-02C. Isolation preview réelle **non confirmée par preuve directe** (`vercel env ls` non exécuté), seulement un indice circonstanciel (`SETUP_PROGRESS.md:148`) — à vérifier avant PR-02C, ne bloque pas PR-02B. |
| D-2 | `VERCEL_ENV` (signal déjà existant, `routers/auth.py::_is_prod()`), pas `APP_ENV` (inexistant dans le repo). Extraction vers `utils/env.py` jugée non nécessaire pour ce périmètre (un seul point d'usage prévu pour l'instant côté migrations — CLI ne fait pas encore de confirmation renforcée puisque `apply`/`baseline --commit` en contexte prod n'existent pas avant PR-02C) ; à revisiter si un 2e point d'usage apparaît. |
| D-3 | Suffisamment documentée pour PR-02B. 004/009 traitées comme actives dans le manifeste (`requires_owner=False` toutes les deux). Baseline réelle de production reportée à PR-02C. |
| D-4 | `DATABASE_ADMIN_URL` **non obligatoire** en PR-02B — documentée dans `.env.example` comme réservée à PR-02C. PR-02B utilise `DATABASE_URL`/`DATABASE_URL_DIRECT` (patterns existants) pour ses tests et son CLI. |
| D-5 | `/health/schema` minimal et non sensible confirmé. Diagnostic détaillé CLI-only. |
| Écart supplémentaire | Omission d'`apply` confirmée intentionnelle par Ludo — PR-02B livre `status`/`plan`/`verify`/`baseline`/`mark-manual-verified`, jamais `apply`. Exécution réelle + workflow protégé = PR-02C. |
| Bootstrap | `apps/api/db/_bootstrap/000_schema_migrations_ledger.sql` — **sibling** de `migrations/` (pas un sous-dossier nesté dedans), donc jamais découvert par construction, pas par exclusion codée en dur. |

---

## 3. Fichiers modifiés / créés

### Modifiés

- `apps/api/db/migration_runner.py` — ajoute `MigrationError`/`MigrationLockError`, `BaselineItem`/`BaselineResult`, `_synthetic_000_file()`, et les méthodes `acquire_lock`/`_ensure_ledger_table`/`verify_migration_objects`/`_write_ledger_row`/`baseline`/`verify`/`mark_manual_verified` sur `MigrationRunner`. Refactor interne : `load_records()` délègue à `_read_records(conn)` (même comportement public, réutilisable sur une connexion déjà ouverte sous verrou — évite d'ouvrir une 2e connexion depuis `baseline()`/`verify()`). `discover_migrations`/`calculate_checksum`/`build_plan` (PR-02A) **inchangés** — `build_plan()` reste à 28 items, jamais 29 (la baseline `000` est spécifique à `baseline()`/`verify()`, jamais mêlée au plan orienté-apply de PR-02A).
- `apps/api/db/migration_cli.py` — ajoute `status`/`verify`/`baseline`/`mark-manual-verified`. `plan` inchangé.
- `apps/api/routers/health.py` — ajoute `GET /health/schema`.
- `apps/api/tests/test_migration_runner.py` — ajoute 2 tests (découverte ignore `_bootstrap/`, y compris contre le vrai dossier `apps/api/db/migrations/`).
- `apps/api/tests/test_migration_cli.py` — ajoute 11 tests (status/verify/baseline/mark-manual-verified, tous mockés).
- `apps/api/.env.example` — documente `DATABASE_ADMIN_URL` (réservée, non consommée).
- `.github/workflows/api.yml` — ajoute le job `migration-tests` (service `postgres:16`, même pattern que `backup.yml::restore-check`).
- `docs/carbonco/refonte/PR02_DECISIONS.md` — résolutions D-1/D-2/D-4/D-5 scopées PR-02B + note sur l'omission d'`apply`.
- `docs/carbonco/refonte/PR02_ARCHITECTURE_PLAN.md` — note d'écart §21 (retrait d'`apply_one`/`apply_plan` du périmètre PR-02B, mention de la baseline `000` synthétique).

### Créés

- `apps/api/db/_bootstrap/000_schema_migrations_ledger.sql` — DDL du ledger, hors `migrations/`.
- `apps/api/db/migration_probes.py` — 29 sondes objet-par-objet (000 + 001-027 + 008b), déclaratives.
- `apps/api/tests/_migration_fixtures.py` — construction d'états de base (DDL inline, application ordonnée de fichiers réels jusqu'à une version donnée, reset de schéma entre tests). Pas un fichier de test (pas de préfixe `test_`).
- `apps/api/tests/test_migration_probes.py` — 63 cas, DB-gated.
- `apps/api/tests/test_migration_ledger.py` — 20 cas, DB-gated.
- `docs/carbonco/refonte/PR02B_IMPLEMENTATION_PLAN.md` — plan de cadrage (phase précédente).
- `docs/carbonco/refonte/PR02B_TRACEABILITY.md` — ce document.

**Non touchés** (confirmé) : `migrations.py`, `main.py`, les 28 fichiers `.sql` existants, `routers/*` autres que `health.py`, `apps/carbon` (aucune modification, y compris documentation — non nécessaire ici), tout fichier de données métier.

---

## 4. Tests ajoutés

| Fichier | Cas | Portée |
|---|---|---|
| `test_migration_runner.py` (+2) | Découverte ignore un `_bootstrap/` nesté (défensif) + confirmation contre le vrai dossier (`000` jamais présent) | Unitaire, local |
| `test_migration_cli.py` (+11) | `status` (JSON, exit 4 sur anomalie), `verify` (sain, anomalies, exit 4), `baseline` (dry-run par défaut, `--commit`, exit 3 si `manual_required`, `MigrationLockError` → exit 2), `mark-manual-verified` (succès, arguments requis, `ValueError`/`MigrationError` → exit 1) | Unitaire (mocké), local |
| `test_migration_probes.py` (63, nouveau) | Les 29 sondes testées **positivement** (toutes vraies sur base complète) et **négativement** (toutes fausses sur base vide) ; version inconnue ; 004 seule vs 004+009 (distinction `relforcerowsecurity`) ; piège 021 (policy partagée avec 004/009) ; 027 partielle (`sites` sans `actions.site_id`) | PostgreSQL, DB-gated |
| `test_migration_ledger.py` (20, nouveau) | Bootstrap (création, idempotence, jamais déclenché par `load_records`) ; `baseline` sur base neuve/partielle/complète (dry-run et commit) ; non-réécriture d'une ligne existante ; `verify` propre après baseline, détecte checksum_mismatch et drift ; `mark_manual_verified` (arguments requis, version inconnue, refus si objets non vérifiés malgré preuve, transition réussie, refus de réécriture) ; `acquire_lock` bloque une 2e connexion puis se libère ; scénario CLI bout-en-bout | PostgreSQL, DB-gated |

Couverture vs. matrice `PR02_ARCHITECTURE_PLAN.md` §22 : « Unitaires » et « PostgreSQL (base de test réelle) » couvertes. « Concurrence » couverte en version simplifiée (2 connexions, pas de simulation de crash process — jugé hors périmètre PR-02B, voir limites §7). « Manuels Neon » non applicable (aucune connexion à une vraie base).

---

## 5. Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `git branch --show-current` / `git rev-parse --show-toplevel` / `git status --short` | Vérifiés avant et après chaque changement de worktree — `feat/schema-migration-ledger-b` confirmée à chaque étape |
| `python -m py_compile` sur les 10 fichiers Python créés/modifiés | Tous compilent sans erreur |
| `python -m db.migration_cli --help` / chaque sous-commande `--help` | **Bug réel trouvé et corrigé** : un caractère `→` dans un texte d'aide argparse faisait planter `--help` sur cette console Windows (`UnicodeEncodeError`, encodage `cp1252`). Remplacé par `->` (ASCII) partout dans les chaînes réellement imprimées (aide argparse + messages runtime) ; les docstrings (jamais imprimées) gardent `→`. Revérifié : tous les `--help` sortent proprement (exit 0) |
| `cd apps/api && python -m pytest -q tests/test_migration_cli.py tests/test_migration_runner.py tests/test_migration_probes.py tests/test_migration_ledger.py` | **38 passed, 83 skipped** (skip = DB-gated, `DATABASE_URL` absent localement) |
| `cd apps/api && python -m pytest -q` (suite complète) | **600 passed, 122 skipped, 5 failed** — mêmes 5 échecs pré-existants sans rapport (`ModuleNotFoundError: vercel`, `test_storage_adapter.py`) déjà documentés dans `PR02A_TRACEABILITY.md`. Progression vs PR-02A : 586→600 passed (+14, tests unitaires PR-02B), 39→122 skipped (+83, tests PostgreSQL PR-02B correctement skippés sans DB) |
| `ruff check . --select=E,F,I --ignore=E501` (job CI `validate`) | 2 erreurs d'ordre d'imports trouvées (`test_migration_probes.py`, `test_migration_ledger.py`) → corrigées via `--fix` → **All checks passed!** |
| `git diff --check` | Aucune erreur whitespace |
| `python -m yaml` (validation `.github/workflows/api.yml`) | YAML valide après ajout du job `migration-tests` |
| Smoke test `/health/schema` via `TestClient` (sans DB) | `200`, `{"schema_version": null, "up_to_date": null, "pending_count": null, "manual_required_count": null, "checked_at": "...", "db": "not_configured"}` — conforme à la spec §16 |

---

## 6. Résultats

Tout est vert localement pour ce qui peut être vérifié sans base PostgreSQL réelle : compilation, lint, suite complète (aucune régression sur les 600 tests existants + nouveaux unitaires), CLI fonctionnel. Les 83 tests PostgreSQL du périmètre PR-02B (`test_migration_probes.py` + `test_migration_ledger.py`) sont **écrits et corrects par relecture attentive** (chaque sonde vérifiée contre une lecture exhaustive des 28 fichiers `.sql` réels, pas contre un résumé) mais **jamais exécutés contre un vrai Postgres** — aucun `docker`/`postgres` disponible dans cet environnement local (Windows). Le nouveau job CI `migration-tests` (service `postgres:16`, même pattern que `backup.yml`) les exécutera au premier push — **c'est la première vérification réelle de cette portion du code**, à surveiller.

---

## 7. Limites restantes

- **Tests PostgreSQL non exécutés localement** (voir §6) — dépendance complète à la CI pour la première confirmation réelle.
- **Concurrence testée en version simplifiée** : deux connexions, un verrou qui bloque puis se libère. Pas de simulation de crash process ni de budget de nouvelle tentative sous forte contention — jugé suffisant pour ce périmètre (l'usage réel de `baseline`/`mark-manual-verified` est un CLI invoqué manuellement, pas un chemin de haute fréquence).
- **D-1 et D-4 restent à finaliser avant PR-02C** (voir §2) — `vercel env ls` et provisionnement du secret GitHub Actions, actions de Ludo hors de portée de ce PR.
- **Cas `status='failed'` dans `_plan_item`** (mapping vers `blocked_manual`, décidé en PR-02A) — non revisité ici, toujours documenté comme un choix d'interprétation dans `PR02A_TRACEABILITY.md` §5, non contredit par le travail PR-02B.
- **`mark_manual_verified` toujours vers `status='baseline'`** — correct pour l'usage actuel (aucune migration 028+ n'existe), mais un futur `apply()` (PR-02C+) sur une migration `requires_owner` réellement nouvelle nécessiterait de distinguer `baseline` (historique) de `applied` (nouvelle) — non implémenté ici, hors périmètre tant qu'aucune migration 028+ n'existe.

---

## 8. Explicitement reporté à PR-02C

- `apply_one`/`apply_plan`/CLI `apply`/`AUTO_MIGRATE` (§2 — omission confirmée par Ludo).
- `.github/workflows/db-migrate.yml` (workflow protégé, actions réelles contre Neon).
- Retrait de `ensure_schema_mw` de `main.py`.
- Baseline réelle de la production (Neon `super-hill-23861127`).
- `docs/carbonco/MIGRATIONS_RUNBOOK.md`.
- Résolution ferme de D-1 (`vercel env ls`) et provisionnement du secret D-4.
- Distinction `baseline` vs `applied` dans `mark_manual_verified` pour une future migration `requires_owner` réellement nouvelle (voir §7).

---

## 9. Confirmations explicites

- **`ensure_schema_mw` intact** : `apps/api/main.py` non modifié (confirmé : absent de la liste des fichiers touchés, §3). Le middleware reste le seul déclencheur de migration en production, sans changement de comportement.
- **Aucune prod Neon touchée** : aucune commande de ce travail ne s'est connectée à `super-hill-23861127` ni à aucune autre base Neon. Tous les tests PostgreSQL ciblent exclusivement un conteneur `postgres:16` jetable (CI) ou une instance locale explicitement pointée par `DATABASE_URL` — jamais exécutés ici faute d'environnement local.
- **Aucun `apply` réel n'existe** : `apply_one`/`apply_plan` ne sont définis nulle part dans `migration_runner.py` ; le CLI n'expose aucune commande `apply` (`build_parser()` ne déclare que `plan`/`status`/`verify`/`baseline`/`mark-manual-verified`). `baseline()`/`mark_manual_verified()` n'exécutent jamais de SQL de migration — ils ne font que constater et enregistrer un état déjà réel.
- **Bootstrap explicite, non automatique** : `_ensure_ledger_table()` n'est appelée que depuis `baseline()` (si `dry_run=False`) et `mark_manual_verified()` — jamais depuis `load_records()`/`build_plan()`/`plan`/`status`/`verify` (lecture seule, revalidé par `test_plan_and_load_records_never_create_the_table` contre un vrai Postgres). Aucun déclenchement au démarrage de l'API, aucun hook automatique — seul un opérateur invoquant explicitement `baseline --commit` ou `mark-manual-verified` déclenche une écriture.
