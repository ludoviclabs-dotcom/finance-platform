# PR-02A — Découverte, modèle, checksum, planificateur · Traçabilité

**Périmètre :** partie lecture-seule de `feat/schema-migration-ledger` (`PR02_ARCHITECTURE_PLAN.md` §21). Duplicata rempli de `PR02_TRACEABILITY_TEMPLATE.md`, sur le modèle de `PR01_TRACEABILITY.md`.
**Statut : implémenté sur le worktree `schema-migration-ledger`, branche `feat/schema-migration-ledger`. Rien commité ni poussé — en attente de revue Ludo.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Exigences PR-02 et statut

### Registre et découverte (périmètre PR-02A)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 1.1 | Table `schema_migrations` créée avec le schéma exact de `PR02_ARCHITECTURE_PLAN.md` §5 | **NON APPLICABLE** | Bootstrap du ledger réel = PR-02B (§6). PR-02A ne crée aucune table, sur aucun environnement. |
| 1.2 | Découverte déterministe des fichiers (regex + tri `(int, suffix)`, pas un tri lexicographique brut) | **FAIT** | `migration_runner.py::MigrationRunner.discover_migrations` (regex §7) + `test_discover_sorts_by_numeric_version_then_suffix` |
| 1.3 | Ordre stable vérifié explicitement pour 008/008b/009 | **FAIT** | `test_discover_sorts_by_numeric_version_then_suffix` (assertion explicite `["008", "008b", "009", "010"]`) |
| 1.4 | Checksum SHA-256 sur octets bruts, calculé et stocké | **PARTIEL** | Calcul **FAIT** (`calculate_checksum`, `test_checksum_stable_for_same_content`, `test_checksum_changes_with_single_byte`) ; « stocké » = écriture en ledger, hors périmètre PR-02A (aucune écriture en base) |
| 1.5 | Détection des migrations déjà appliquées (`load_records`) | **FAIT** | `MigrationRunner.load_records` — lit `schema_migrations` si la table existe, retourne `{}` sinon (jamais de création) ; `test_load_records_raises_when_db_unconfigured` |
| 1.6 | Détection des fichiers appliqués puis modifiés (`ChecksumMismatchError`) | **PARTIEL** | Détection **FAIT** au niveau du plan (action `checksum_mismatch`, prioritaire sur tout autre statut — `test_plan_item_checksum_mismatch_wins_over_applied`, `test_plan_item_checksum_mismatch_detected_even_on_manual_required`) ; l'exception `ChecksumMismatchError` elle-même n'existe pas encore (levée par `apply`/`verify`, PR-02B) — `build_plan()` ne lève jamais d'exception par conception (§13) |
| 1.7 | Plan calculé avant toute exécution (`build_plan`, aucune écriture) | **FAIT** | `MigrationRunner.build_plan` ; `test_build_plan_is_deterministic_for_same_state`, `test_build_plan_against_real_migrations_directory` |

### Concurrence et transactions

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 2.1-2.5 | (toutes) | **NON APPLICABLE** | Périmètre PR-02B |

### Migrations manuelles / `requires_owner`

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 3.1 | Gestion déclarative des migrations `requires_owner` (manifeste, pas de liste cachée dans le runner) | **FAIT** | `migration_manifest.py::MIGRATION_METADATA` (004/009/027) + `get_meta()` (défauts sûrs si version absente) |
| 3.2 | `MANUAL_ONLY_PREFIXES` / gate `RLS_FORCE` de l'ancien système retirés ou reliés au nouveau manifeste | **NON FAIT** | Délibéré — PR-02A ne modifie pas `migrations.py` (interdiction explicite §21). L'ancien mécanisme reste actif et inchangé en coexistence jusqu'à PR-02C. |
| 3.3 | `mark-applied`/`mark-manual-verified` exige `applied_by` + preuve | **NON APPLICABLE** | Périmètre PR-02B |
| 3.4 | 027 déclarée `requires_owner=true` et vérifiée comme telle dans le plan | **FAIT** | `MIGRATION_METADATA["027"].requires_owner = True` ; `test_plan_item_pending_requires_owner_is_blocked_manual` ; confirmé sur le corpus réel (`test_build_plan_against_real_migrations_directory` : `actions["027"] == "blocked_manual"`) |
| 3.5 | Décision D-3 tranchée (état réel de 004/009) avant leur baseline | **FAIT** (hors code) | D-3 résolue 2026-07-17 (`PR02_DECISIONS.md`) — 004 et 009 déclarées `requires_owner=False` dans le manifeste, conformément à la décision retenue |

### Baseline

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 4.1-4.7 | (toutes) | **NON APPLICABLE** | Périmètre PR-02B |

### CLI

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 5.1 | `status` | **NON FAIT** | Reporté à PR-02B — nécessiterait d'afficher les anomalies de `verify()`, qui n'existe pas encore |
| 5.2 | `plan` | **FAIT** | `migration_cli.py::cmd_plan` ; `test_cmd_plan_json_output`, `test_cmd_plan_text_output` |
| 5.3 | `apply` | **NON APPLICABLE** | Périmètre PR-02B |
| 5.4 | `verify` | **NON APPLICABLE** | Périmètre PR-02B |
| 5.5 | `baseline` (`--dry-run`/`--commit`) | **NON APPLICABLE** | Périmètre PR-02B |
| 5.6 | `mark-applied` | **NON APPLICABLE** | Périmètre PR-02B |
| 5.7 | Sorties `--json` disponibles sur toutes les commandes | **PARTIEL** | Disponible sur `plan` (seule commande existante) — `test_cmd_plan_json_output` |
| 5.8 | Codes de sortie stables et documentés (0/1/2/3/4) | **PARTIEL** | `0`/`1` implémentés et testés (`test_cmd_plan_reports_error_with_exit_code_1`) ; `2`/`3`/`4` nécessitent lock/manual/verify (PR-02B) |
| 5.9 | Confirmation renforcée en production (D-2 tranchée) | **NON APPLICABLE** | `plan` est purement lecture seule, aucune confirmation nécessaire ; D-2 reste ouverte pour `apply`/`baseline --commit` (PR-02B) |

### Santé et observabilité / GitHub Actions / Retrait ancien mécanisme

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 6.1-6.3, 7.1-7.5, 8.1-8.3 | (toutes) | **NON APPLICABLE** | Périmètre PR-02B (santé) / PR-02C (déploiement, retrait) |

### Contraintes non négociables (rappel de la mission)

| # | Contrainte | Statut | Preuve |
|---|---|---|---|
| C1 | Une migration appliquée n'est jamais modifiée silencieusement | **NON APPLICABLE** | Aucune migration appliquée par PR-02A |
| C2 | Une migration échouée n'est jamais marquée appliquée | **NON APPLICABLE** | Aucune exécution en PR-02A |
| C3 | Deux process ne peuvent pas appliquer la même migration simultanément | **NON APPLICABLE** | Périmètre PR-02B (lock) |
| C4 | La présence d'une seule table ne représente plus l'état complet du schéma | **FAIT** (conception) | `build_plan()` évalue les 28 fichiers individuellement, jamais via une sentinelle unique |
| C5 | Aucune base existante n'est baselinée aveuglément 001→027 | **NON APPLICABLE** | Aucun baseline en PR-02A |
| C6 | Une migration `requires_owner` est visible dans le plan mais bloquée en exécution automatique | **FAIT** | `action="blocked_manual"` pour 027 dès le premier plan, sans ligne de ledger (§13, `_plan_item`) |
| C7 | `schema_migrations` est globale, sans `company_id` | **FAIT** (conception) | `load_records()`/`get_db()` appelés sans `company_id` (I8) |
| C8 | Le runner ne dépend pas du RLS tenant | **FAIT** | Idem — aucun `SET LOCAL app.current_company_id` |
| C9 | Aucun secret/SQL sensible exposé par un endpoint public | **NON APPLICABLE** | Aucun endpoint HTTP en PR-02A |
| C10 | Aucun rollback automatique destructif inventé | **FAIT** | Aucune écriture, donc aucun rollback à inventer |
| C11 | La production Neon n'a pas été modifiée pendant la phase d'architecture | **FAIT** | Hérité de la phase d'architecture ; PR-02A elle-même ne s'est connectée à aucune base réelle (tests unitaires + mocks uniquement) |
| C12 | Compatible base neuve / partielle / production existante | **PARTIEL** | `build_plan()` traite les trois cas de façon identique (différence par le contenu de `records`, jamais par une branche de code séparée) ; non exercé contre une vraie base partielle/prod (nécessiterait PR-02B) |

---

## 2. Fichiers modifiés / créés

### Modifiés

- (aucun — PR-02A est strictement additive, conformément à l'interdiction explicite de toucher `migrations.py`/`main.py`/`routers/health.py`/tout fichier `.sql` existant)

### Créés

- `apps/api/db/migration_manifest.py` — `MigrationMeta`, `MIGRATION_METADATA` (004/009/027), `get_meta()`.
- `apps/api/db/migration_runner.py` — `MigrationFile`, `MigrationRecord`, `MigrationPlanItem`, `MigrationPlan`, `MigrationRunner` (`discover_migrations`, `calculate_checksum`, `load_records`, `build_plan`), fonction pure `_plan_item`.
- `apps/api/db/migration_cli.py` — `python -m db.migration_cli plan [--json]` uniquement.
- `apps/api/tests/test_migration_runner.py` — 18 cas.
- `apps/api/tests/test_migration_cli.py` — 6 cas.
- `docs/carbonco/refonte/PR02A_TRACEABILITY.md` — ce document.

---

## 3. Tests associés

- `test_migration_runner.py` (18 cas) : tri `(int, suffix)` pour 008/008b/009 ; rejet des noms non conformes (extension, casse, sous-dossier, préfixe à 4 chiffres) ; stabilité et sensibilité du checksum ; `load_records` lève si DB non configurée ; les 8 branches de décision de `_plan_item` (apply / blocked_manual pending+requires_owner / skip applied / skip baseline / checksum_mismatch / blocked_manual manual_required / blocked_manual failed / checksum_mismatch prioritaire sur manual_required) ; déterminisme de `build_plan` ; `has_blocking_issues` (vrai et faux) ; plan complet contre le corpus réel des 28 fichiers (critère de sortie PR-02A).
- `test_migration_cli.py` (6 cas) : sortie JSON, sortie texte, avertissement texte si `has_blocking_issues`, code de sortie 1 + message stderr sur erreur, exigence d'une sous-commande.
- Couverture vs. matrice `PR02_ARCHITECTURE_PLAN.md` §22 : ligne « Unitaires » couverte intégralement. Ligne « PostgreSQL (base de test réelle) » non exercée par un vrai conteneur Postgre — `load_records` testé par mock (monkeypatch), à l'image de `test_ensure_schema.py` ; jugé suffisant pour ce périmètre lecture-seule (§21 : test PostgreSQL réel « éventuel », pas obligatoire pour PR-02A).

---

## 4. Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `git diff --check` | Aucune erreur (tous les fichiers PR-02A sont nouveaux/non trackés) |
| `cd apps/api && python -m pytest -q tests/test_migration_runner.py tests/test_migration_cli.py` | **24 passed** |
| `cd apps/api && python -m pytest -q` (suite complète) | **586 passed, 39 skipped, 5 failed** — les 5 échecs sont pré-existants et sans rapport (`ModuleNotFoundError: vercel` dans `test_storage_adapter.py`, package PyPI `vercel` absent de cet environnement local ; aucun test PR-02A concerné) |
| Plan correct des 28 fichiers (corpus réel, ledger vide) | Vérifié par le test `test_build_plan_against_real_migrations_directory` (ledger mocké `{}`) : 28 items, `027` → `blocked_manual`, les 27 autres → `apply`, `has_blocking_issues=True` — critère de sortie PR-02A |
| `python -m db.migration_cli plan` (sans `DATABASE_URL`, env local) | `Erreur : PostgreSQL non configuré …`, **exit 1** — comportement **voulu** : `load_records()` est strict et le §21 cadre `plan` comme s'exécutant contre une base. Le CLI n'échoue que s'il n'y a **aucune** DB ; dès que `DATABASE_URL` pointe vers un Postgres joignable — même vide, même sans table `schema_migrations` (auquel cas `load_records()` renvoie `{}`) — `plan` affiche les 28 lignes. Démonstration CLI contre un vrai Postgres reportée (aucun conteneur PG dans cet env Windows ; la correction de `build_plan` est déjà prouvée par le test ci-dessus) |

---

## 5. Limites restantes

- `status`/`apply`/`verify`/`baseline`/`mark-applied` n'existent pas encore — `python -m db.migration_cli` n'expose que `plan`. Attendu, périmètre PR-02B.
- `load_records()` n'a jamais été exercé contre un vrai PostgreSQL (mocké uniquement) — un test contre un conteneur jetable reste possible mais non fait, jugé non nécessaire pour un périmètre strictement lecture-seule sans jamais écrire.
- **`plan` exige `DATABASE_URL`** : sans DB, `python -m db.migration_cli plan` renvoie exit 1 (comportement voulu, cf. §4). **Question de conception ouverte pour PR-02B** : faut-il un mode dégradé « découverte seule » (afficher fichiers + checksums + classification manifeste avec l'état ledger marqué INCONNU) quand aucune DB n'est configurée ? Non tranché par `PR02_ARCHITECTURE_PLAN.md`, qui cadre `plan` comme DB-backed (§21). Laissé DB-backed pour l'instant, conforme aux outils de migration classiques (alembic/flyway exigent aussi une connexion) — à confirmer par Ludo.
- Le cas `status ledger == "failed" → action="blocked_manual"` est un choix d'interprétation de ma part (le plan d'architecture ne tranche pas explicitement ce mapping, voir §9 qui ne liste pas `failed` parmi les conditions bloquantes explicites) — à confirmer ou ajuster lors de la conception réelle d'`apply_plan()`/`verify()` en PR-02B, quand le comportement de reprise après échec sera implémenté pour de vrai.
- D-1, D-2, D-4, D-5 restent ouvertes (`PR02_DECISIONS.md`) — aucune ne bloque PR-02A, toutes doivent être tranchées avant PR-02B.

---

## 6. Explicitement reporté aux PR suivantes

- Tout le périmètre PR-02B (§21) : bootstrap réel du ledger, `acquire_lock`, `apply_one`/`apply_plan`, `baseline`/`verify`/`mark_manual_verified`, CLI complet (`status`/`apply`/`verify`/`baseline`/`mark-applied`), `GET /health/schema`.
- PR-02C (§21) : workflow GitHub `db-migrate.yml`, retrait de `ensure_schema_mw`, baseline réelle de production, `MIGRATIONS_RUNBOOK.md`.
- Nettoyage de la duplication de bootstrap dans `seed_factors.py`/`seed_emission_factors.py` (signalé §2 du plan d'architecture, hors périmètre strict PR-02).

---

## 7. Opérations Neon manuelles effectuées

| Opération | Version | Acteur | Date | Preuve |
|---|---|---|---|---|
| (aucune — PR-02A ne s'est connectée à aucune base réelle) | | | | |
