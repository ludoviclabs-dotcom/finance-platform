# PR-02B — Ledger de migrations : bootstrap, baseline, verify, health · Traçabilité

**Périmètre :** deuxième tranche de `feat/schema-migration-ledger-b` — introduit le ledger réel de migrations sans retirer `ensure_schema_mw` et sans exécuter de migration production.
**Statut : implémenté, corrigé après échec CI réel (job `migration-tests`) et revue Codex sur PR [#96](https://github.com/ludoviclabs-dotcom/finance-platform/pull/96) — voir §10.**
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

- `apps/api/db/migration_runner.py` — ajoute `MigrationError`/`MigrationLockError`, `BaselineItem`/`BaselineResult`, `_synthetic_000_file()`, et les méthodes `acquire_lock`/`_ensure_ledger_table`/`verify_migration_objects`/`_upsert_ledger_row`/`baseline`/`verify`/`mark_manual_verified` sur `MigrationRunner`. Refactor interne : `load_records()` délègue à `_read_records(conn)` (même comportement public, réutilisable sur une connexion déjà ouverte sous verrou — évite d'ouvrir une 2e connexion depuis `baseline()`/`verify()`). `discover_migrations`/`calculate_checksum`/`build_plan` (PR-02A) **inchangés** — `build_plan()` reste à 28 items, jamais 29 (la baseline `000` est spécifique à `baseline()`/`verify()`, jamais mêlée au plan orienté-apply de PR-02A). **Correction post-CI/Codex (§10)** : `mark_manual_verified` autorise désormais `manual_required` → `baseline` ; `_write_ledger_row` renommée `_upsert_ledger_row` (upsert explicite, plus de `ON CONFLICT DO NOTHING` silencieux).
- `apps/api/db/migration_probes.py` — **correction post-CI/Codex (§10)** : `_probe_004` ne dépend plus de l'absence de FORCE ; `_probe_024` vérifie désormais les policies RLS de `supplier_campaigns`.
- `apps/api/db/migration_cli.py` — ajoute `status`/`verify`/`baseline`/`mark-manual-verified`. `plan` inchangé.
- `apps/api/routers/health.py` — ajoute `GET /health/schema`. **Correction post-CI/Codex (§10)** : `up_to_date` exige que toutes les versions découvertes soient `applied`/`baseline` (une ligne `failed` le rend désormais `false`).
- `apps/api/tests/_migration_fixtures.py` — **correction (bug propre, pas un retour Codex)** : `_apply_file`/`apply_ddl_inline` committent désormais après exécution — sans quoi l'état appliqué restait invisible aux connexions séparées ouvertes par `baseline()`/`verify()`/`mark_manual_verified()`, cause principale de l'échec CI initial (§10).
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
- `apps/api/tests/test_migration_probes.py` — 64 cas, DB-gated (63 + 1 ajouté §10).
- `apps/api/tests/test_migration_ledger.py` — 22 cas, DB-gated (20 + 2 ajoutés §10).
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
| `gh pr checks 96` + `gh api .../pulls/96/comments` (lecture des logs et de la revue Codex réels, §10) | `migration-tests` fail ×2 (8 échecs réels) ; `security-audit`/`tests`/`validate`/`gitleaks` pass ×2 ; `Vercel – neural` fail (bruit, sans rapport) ; 4 commentaires Codex récupérés mot pour mot |
| Suite de correction (§10) : `py_compile` sur les fichiers touchés, `pytest -q tests/test_migration_runner.py tests/test_migration_cli.py`, `ruff check`, `pytest -q` (suite complète), `git diff --check` | Tous verts après correction — détail §10 |

---

## 6. Résultats

**Historique en deux temps.** Le premier push (commit `75aadfc`) a été vert localement (compilation, lint, 600 tests unitaires, CLI) mais **jamais exécuté contre un vrai Postgres** faute de `docker` local — c'était la limite explicitement signalée à l'époque. Le job CI `migration-tests` a effectivement tourné et **a trouvé 8 échecs réels**, exactement comme prévu par cette limite. Détail complet du diagnostic et des corrections en §10.

Après correction : tout reste vert localement (compilation, lint, 600 tests unitaires + CLI mockés, aucune régression). Les 86 tests PostgreSQL (64 probes + 22 ledger) sont de nouveau **non exécutés localement** (même contrainte d'environnement) — leur vérification réelle attend le prochain push CI. Le raisonnement de chaque correction a été retracé pas à pas contre la logique exacte du code (voir §10) pour minimiser le risque d'un 3e tour, mais seul un run CI réel constitue une preuve.

---

## 7. Limites restantes

- **Tests PostgreSQL non revérifiés localement après correction** (voir §6) — dépendance complète au prochain run CI pour la confirmation réelle des correctifs.
- **Concurrence testée en version simplifiée** : deux connexions, un verrou qui bloque puis se libère. Pas de simulation de crash process ni de budget de nouvelle tentative sous forte contention — jugé suffisant pour ce périmètre (l'usage réel de `baseline`/`mark-manual-verified` est un CLI invoqué manuellement, pas un chemin de haute fréquence).
- **D-1 et D-4 restent à finaliser avant PR-02C** (voir §2) — `vercel env ls` et provisionnement du secret GitHub Actions, actions de Ludo hors de portée de ce PR.
- **Cas `status='failed'` dans `_plan_item`** (mapping vers `blocked_manual`, décidé en PR-02A) — non revisité ici, toujours documenté comme un choix d'interprétation dans `PR02A_TRACEABILITY.md` §5, non contredit par le travail PR-02B.
- **`mark_manual_verified` transitionne toujours vers `status='baseline'`**, y compris depuis `manual_required` (§10) — correct pour l'usage actuel (aucune migration 028+ n'existe), mais un futur `apply()` (PR-02C+) sur une migration `requires_owner` réellement nouvelle nécessiterait de distinguer `baseline` (historique) de `applied` (nouvelle) — non implémenté ici, hors périmètre tant qu'aucune migration 028+ n'existe.

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

---

## 10. Revue Codex traitée

**Cause réelle de l'échec CI initial** (job `migration-tests`, PR #96) : diagnostiquée en lisant les logs réels (`gh run view --log`), pas supposée. Deux causes distinctes :

1. **Bug propre (fixtures de test, pas un retour Codex)** : `_migration_fixtures.py::_apply_file`/`apply_ddl_inline` n'appelaient jamais `conn.commit()`. `baseline()`/`verify()`/`mark_manual_verified()` ouvrent chacune leur propre connexion (`get_db()`) — sous isolation PostgreSQL READ COMMITTED par défaut, une transaction non commitée d'une session est invisible depuis une autre session, même contre le même conteneur. Résultat : tout l'état construit par les fixtures de test était invisible aux méthodes testées, causant 6 des 8 échecs (`test_baseline_on_partial_db`, `test_baseline_on_full_db_marks_004_and_009_both_baseline`, `test_baseline_never_rewrites_existing_row`, `test_verify_detects_checksum_mismatch`, `test_verify_detects_drift_when_object_dropped`, `test_mark_manual_verified_transitions_to_baseline_with_proof`, `test_cli_end_to_end_status_verify_baseline_verify`). **Corrigé** : commit explicite après chaque application.
2. **Point B ci-dessous** (sonde 004) — cause du 8e échec (`test_probe_true_when_fully_applied[004]`), un vrai bug de logique, pas un problème d'infrastructure de test.

**Les 4 commentaires Codex** (récupérés mot pour mot via l'API GitHub, pas résumés de mémoire) ont tous été traités :

- **A — `mark_manual_verified` autorise `manual_required` → `baseline`** (`migration_runner.py`, P1). La version précédente refusait *toute* version déjà présente dans le ledger, rendant impossible le scénario même que la commande sert : `baseline --commit` écrit `manual_required` pour 027 → l'opérateur applique le SQL → `mark-manual-verified` devait vérifier et transitionner, mais échouait toujours. **Corrigé** : le refus (`ValueError`) ne s'applique plus qu'aux statuts `applied`/`baseline` (déjà résolus, protégés — contrainte #1) ; `manual_required` (et l'absence de ligne) autorisent désormais la transition, après re-vérification des objets. `_write_ledger_row` renommée `_upsert_ledger_row` (`ON CONFLICT DO UPDATE` au lieu de `DO NOTHING` — un no-op silencieux masquait le bug plutôt que de le révéler). Test ajouté : `test_mark_manual_verified_transitions_manual_required_to_baseline` (le scénario complet en 4 étapes décrit par Ludo).
- **B — Sonde 004 après FORCE de 009** (`migration_probes.py`, P1). `_probe_004` exigeait `relforcerowsecurity=false`, pour « distinguer » 004 de 009 — mais sur une base complète (004 puis 009, l'ordre réel de prod, D-3), 009 pose FORCE, donc 004 échouait après coup alors que ses policies sont bien présentes et actives. **Corrigé** : condition FORCE retirée, la sonde ne vérifie plus que les policies. Test corrigé : `test_probe_004_and_009_distinguish_via_force_rls` renommé `test_probe_004_and_009_both_true_after_009_supersedes_004`, assertions inversées (004 et 009 toutes deux vraies).
- **C — `/health/schema` et `status='failed'`** (`routers/health.py`, P2). `up_to_date` ne regardait que `pending_count==0 and manual_required_count==0` — une ligne `failed` n'est ni l'un ni l'autre (elle existe, avec un statut tiers), donc passait inaperçue. **Corrigé** : `up_to_date` exige désormais que CHAQUE version découverte ait une ligne `applied`/`baseline`. Test ajouté : `test_schema_probe_not_up_to_date_when_a_version_has_failed`.
- **D — Sonde 024 et policies RLS** (`migration_probes.py`, P2). `_probe_024` ne vérifiait que des artefacts créés AVANT le bloc RLS du fichier (table, colonnes, fonction SECURITY DEFINER) — une migration partielle ou dont les policies auraient été retirées après coup restait détectée comme complète. **Corrigé** : ajout de la vérification des 4 policies `tenant_isolation_supplier_campaigns*`. Test ajouté : `test_probe_024_false_when_rls_policies_removed_after_the_fact`.

**Résultat des tests** : 600 passed / 125 skipped / 5 failed (pré-existants, `vercel` PyPI, sans rapport) en local ; lint et compilation propres. Les 86 tests PostgreSQL (64 probes + 22 ledger, dont les 3 nouveaux ci-dessus) restent non exécutés localement (pas de `docker`) — chaque correction a été retracée pas à pas contre la logique exacte du code pour maximiser la confiance avant le prochain push, mais seul le run CI fait foi.

**Résultat CI** : inconnu au moment de la rédaction — ce commit n'a pas encore été poussé/revérifié. À surveiller sur le prochain run du job `migration-tests`.
