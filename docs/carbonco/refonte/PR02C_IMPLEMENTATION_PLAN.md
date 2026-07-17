# PR-02C — Apply, workflow protégé, retrait `ensure_schema_mw` · Plan d'implémentation

**Phase : cadrage uniquement.** Aucun fichier applicatif créé ou modifié, aucune migration exécutée, aucune base touchée. Rien commité ni poussé.
**Base :** branche `feat/schema-migration-ledger-c`, à jour sur `master` (`882f4cd`, merge PR-02B [#96](https://github.com/ludoviclabs-dotcom/finance-platform/pull/96)).
**État production vérifié par Ludo** : `/health` OK ; `/health/schema` → `schema_version: null, up_to_date: false, pending_count: 28, manual_required_count: 0`. Le ledger `schema_migrations` n'a jamais été bootstrappé/baseliné en prod — les 28 fichiers montrent tous `pending` (aucune ligne), pas `manual_required` (qui exigerait une ligne réelle, écrite seulement par `baseline()`).

> **Ne pas commencer l'implémentation avant le feu vert explicite de Ludo (« go PR-02C implementation »).**

---

## Constat clé qui recadre le §7 (à lire avant le reste)

**`apply` n'a aucun rôle dans la résolution de l'état actuel de production.** Les 28 fichiers existants sont déjà **structurellement présents** en prod (tables, policies, colonnes — le service tourne depuis P0→P7, cf. mémoire projet) ; seul le **ledger** ne le sait pas encore, faute d'avoir jamais tourné `baseline()` contre la vraie base. `baseline --commit` (déjà entièrement livré en PR-02B, aucun code à écrire) suffit à transformer `pending_count: 28` en `up_to_date: true` — via le nouveau workflow protégé de PR-02C, sans jamais exécuter de SQL de migration. `apply`/`apply_plan` sont une infrastructure tournée vers l'avenir (la prochaine migration 028+, qui n'existe pas encore), pas un prérequis pour corriger l'état observé aujourd'hui. Les deux chantiers (livrer `apply`, et baseliner la prod réelle) sont donc **découplés** — détaillé en §7.

---

## 1. Périmètre PR-02C

> **Décisions Ludo (2026-07-17), verrouillées :**
> 1. **Découpage en 2 PR : VALIDÉ** (PR-02C-code puis PR-02C-retrait, voir ci-dessous).
> 2. **`DATABASE_ADMIN_URL` = rôle `neondb_owner`** — le rôle désigné pour les migrations/DDL (`SETUP_PROGRESS.md`, « garder `neondb_owner` uniquement pour les migrations/DDL, jamais pour le trafic applicatif »). Isolé du trafic applicatif, privilèges élevés (couvre même un futur `requires_owner`). D-4 refermée sur ce point.
> 3. **`MIGRATIONS_RUNBOOK.md` rédigé au moment du code**, pas maintenant — pour qu'il reflète les commandes et inputs réellement implémentés.

**Dans le périmètre :**
- `apply_one`/`apply_plan` sur `MigrationRunner`, CLI `apply` (protégée, confirmation renforcée en contexte production).
- `.github/workflows/db-migrate.yml` — `workflow_dispatch` uniquement, environnement GitHub protégé, jamais déclenché par push/PR.
- `DATABASE_ADMIN_URL` réellement consommée (connexion non poolée pour les opérations qui tiennent le verrou advisory : `baseline`/`apply`/`mark-manual-verified`) — `status`/`plan`/`verify` restent sur `DATABASE_URL` (poolée, lecture seule, jamais de verrou).
- `docs/carbonco/MIGRATIONS_RUNBOOK.md` (architecture, bootstrap, commandes, workflow prod, rollback, opérations `requires_owner`, diagnostic).
- Confirmation (pas de modification structurelle attendue) que `/health/schema` reste compatible.
- Tests ciblés : `apply_one`/`apply_plan` (DB-gated), CLI `apply` (mocké), fallback `DATABASE_ADMIN_URL`.
- **Procédure opérationnelle** (exécutée par Ludo via le workflow, pas par Claude) pour baseliner la prod réelle — documentée ici, pas automatisée.

**Découpage en deux temps, proposé (à valider §11)** :
- **PR-02C-code** : `apply`, workflow, `DATABASE_ADMIN_URL`, runbook, tests. `ensure_schema_mw` **reste actif, inchangé**. Mergeable sans toucher la prod.
- **Action opérationnelle post-merge** (Ludo, via le workflow, pas une PR) : `baseline --dry-run` puis `--commit` contre la vraie prod. Observation 24-48h.
- **PR-02C-retrait** (petite PR séparée, seulement après confirmation que `/health/schema` répond `up_to_date: true` en prod) : retire `ensure_schema_mw` de `main.py`.

Raison du découpage : §21 de `PR02_ARCHITECTURE_PLAN.md` qualifiait déjà le retrait du middleware de « changement de comportement de prod le plus sensible, à faire en dernier et séparément ». Merger le retrait AVANT que la prod soit réellement baselinée créerait une fenêtre sans aucun filet (ni l'ancien mécanisme, ni un ledger encore vide) — contraire à « toute action production doit passer par workflow manuel protégé » et à « aucun apply automatique au démarrage ».

**Hors périmètre** (confirmé par Ludo, repris tel quel) : aucune migration/baseline production exécutée par Claude ; aucune modification des 28 fichiers `.sql` ; aucune donnée métier touchée ; PR-02D ou au-delà.

---

## 2. Fichiers à modifier / créer

| Fichier | Action | Contenu |
|---|---|---|
| `apps/api/db/migration_runner.py` | Modifier | Ajoute `ManualMigrationRequired` (exception, I4) ; `apply_one(item, conn)` ; `apply_plan(plan=None)` ; `MigrationRunner.__init__` accepte un `connection_factory` optionnel (défaut `get_db`, poolée — comportement inchangé pour tout appelant existant, `/health/schema` y compris) |
| `apps/api/db/database.py` | Modifier | Ajoute `get_admin_db()` — même contrat que `get_db()`, mais connexion via `DATABASE_ADMIN_URL` (non poolée). Fallback explicite et loggé sur `DATABASE_URL` si `DATABASE_ADMIN_URL` absente (dev/CI) |
| `apps/api/db/migration_cli.py` | Modifier | Ajoute `apply [--yes] [--json]`. `apply`/`baseline`/`mark-manual-verified` instancient désormais `MigrationRunner` avec le connection_factory admin |
| `apps/api/utils/env.py` | Modifier | Extraction de `_is_prod()` (`routers/auth.py`) vers `is_production()` — 2ᵉ point d'usage désormais réel (D-2, PR02B_TRACEABILITY.md §2), justifie l'extraction différée en PR-02B |
| `apps/api/routers/auth.py` | Modifier | `_is_prod()` délègue à `utils.env.is_production()` (comportement inchangé, dé-duplication) |
| `.github/workflows/db-migrate.yml` | **Créer** | Workflow manuel protégé (§4) |
| `apps/api/.env.example` | Modifier | `DATABASE_ADMIN_URL` : retire la mention « réservée PR-02C » (désormais consommée), documente son usage réel |
| `docs/carbonco/MIGRATIONS_RUNBOOK.md` | **Créer** | Runbook opérationnel complet |
| `apps/api/tests/test_migration_ledger.py` | Modifier | Ajoute les tests `apply_one`/`apply_plan` (DB-gated) |
| `apps/api/tests/test_migration_cli.py` | Modifier | Ajoute les tests CLI `apply` (mockés) |
| `apps/api/tests/test_database.py` ou nouveau `test_database_admin.py` | Modifier/Créer | Fallback `get_admin_db()` → `get_db()` si `DATABASE_ADMIN_URL` absente |
| `docs/carbonco/refonte/PR02C_TRACEABILITY.md` | Créer **en fin d'implémentation** | Pas maintenant |

**Non touchés dans PR-02C-code** : `apps/api/main.py` (voir §5), `migrations.py`, les 28 fichiers `.sql`, `routers/health.py` (aucun changement structurel attendu, seulement vérifié — §8).

---

## 3. Design de `apply`

Reprend fidèlement §13/§11 de `PR02_ARCHITECTURE_PLAN.md`, jamais réécrit depuis :

```python
class ManualMigrationRequired(MigrationError): ...

def apply_one(self, item: MigrationPlanItem, conn) -> MigrationRecord:
    """Une transaction dédiée. Succès -> 'applied' + execution_ms, écrit APRÈS
    COMMIT (I1). Échec -> ROLLBACK de la migration, puis 'failed' + error_message
    dans une transaction SÉPARÉE (I5) — jamais retentée automatiquement."""

def apply_plan(self, plan: MigrationPlan | None = None) -> list[MigrationRecord]:
    """build_plan() si non fourni. Lève ManualMigrationRequired si le plan
    contient un item requires_owner non résolu (I4) — apply() ne l'exécute
    jamais. Sous acquire_lock(), une connexion unique tenue pour tout le run
    (§11). Arrêt strict au premier échec (I5) : les items suivants ne sont
    pas tentés."""
```

- **Connexion** : `DATABASE_ADMIN_URL` (non poolée) — §15 documente déjà pourquoi (PgBouncer transaction pooling casse `SET LOCAL`/advisory locks entre deux appels).
- **CLI** : `python -m db.migration_cli apply [--yes] [--json]`. Confirmation renforcée si `utils.env.is_production()` est vraie et `--yes` absent (refuse, exit 1, message explicite — pas de prompt interactif, ce CLI tourne en CI non interactive). Le workflow (§4) passe `--yes` explicitement après l'approbation humaine de l'environnement GitHub protégé — c'est CE geste qui constitue la confirmation, pas une saisie CLI.
- **Codes de sortie** : `0` succès (y compris plan vide) ; `1` erreur d'exécution ou confirmation manquante ; `2` verrou non obtenu ; `3` bloqué par `requires_owner` non résolu — cohérents avec `baseline`/`verify` déjà en place (PR-02B).
- **Aucune migration n'existe au-delà de 027** au moment de PR-02C — `apply` n'a donc concrètement rien à exécuter tant qu'aucun 028+ n'est créé. Testé contre une fixture 028 synthétique (§8), jamais contre les 28 fichiers réels.

---

## 4. Design du workflow GitHub manuel

Repris de §17, avec les inputs supplémentaires nécessaires à `mark-manual-verified` :

```yaml
name: DB Migrate
on:
  workflow_dispatch:
    inputs:
      command:
        description: "status | plan | apply | verify | baseline | mark-manual-verified"
        required: true
        default: "plan"
      baseline_mode:
        description: "dry-run | commit (utilisé seulement si command=baseline)"
        default: "dry-run"
      mark_version:
        description: "Version à marquer (utilisé seulement si command=mark-manual-verified)"
        required: false
      applied_by:
        required: false
      proof:
        required: false
jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production-db   # reviewers requis, configuré côté GitHub par Ludo — hors code
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r apps/api/requirements.txt
      - run: |
          cd apps/api
          case "${{ github.event.inputs.command }}" in
            baseline) python -m db.migration_cli baseline --${{ github.event.inputs.baseline_mode }} --json ;;
            mark-manual-verified) python -m db.migration_cli mark-manual-verified "${{ github.event.inputs.mark_version }}" --applied-by "${{ github.event.inputs.applied_by }}" --proof "${{ github.event.inputs.proof }}" --json ;;
            apply) python -m db.migration_cli apply --yes --json ;;
            *) python -m db.migration_cli ${{ github.event.inputs.command }} --json ;;
          esac
        env:
          DATABASE_ADMIN_URL: ${{ secrets.DATABASE_ADMIN_URL }}
          ENV: production
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: migration-log-${{ github.run_id }}, path: apps/api/migration-run.log }
```

- **Jamais** `on: push`/`pull_request`/`schedule` — uniquement `workflow_dispatch`.
- **`environment: production-db`** — approbation manuelle par reviewer(s), configurée côté GitHub Settings par Ludo (hors code, hors périmètre Claude).
- **`ENV=production`** explicite — nécessaire car `VERCEL_ENV` n'existe pas dans GitHub Actions (c'est une variable injectée par Vercel) ; `utils.env.is_production()` doit détecter la prod ici via son repli `ENV` (§2 D-2 déjà résolu).
- **Un seul secret** : `DATABASE_ADMIN_URL`. Jamais `DATABASE_URL` applicatif standard dans ce workflow.
- **Plan avant apply/baseline --commit** : documenté dans le runbook comme procédure opérateur (lancer `plan`/`baseline --dry-run` d'abord, lire la sortie, relancer manuellement en écriture) — pas une garde automatique dans le code, cohérent avec §17.

---

## 5. Stratégie de retrait/désactivation de `ensure_schema_mw`

**Retrait complet (pas un flag)** — cohérent avec le reste du code (pas de mécanisme de bascule pour quelque chose qui ne doit jamais revenir en arrière une fois la transition faite) :

```python
# Supprimés de main.py :
@app.middleware("http")
async def ensure_schema_mw(request, call_next): ...
```

`@app.on_event("startup") async def startup_event(): run_migrations()` **reste** (confort dev local — fonctionne réellement en local/uvicorn, jamais invoqué en prod Vercel de toute façon).

**Séquencement obligatoire** (voir constat clé + §1) :
1. PR-02C-code mergée. `ensure_schema_mw` toujours actif — aucun changement de comportement de prod à ce stade.
2. Ludo déclenche `db-migrate.yml` → `plan` (lecture seule) → lit la sortie.
3. Ludo déclenche `baseline --dry-run` → compare au tableau §3 de `PR02_ARCHITECTURE_PLAN.md`.
4. Ludo déclenche `baseline --commit` → les 29 lignes (000+28) s'écrivent.
5. Ludo déclenche `verify` → doit rapporter zéro anomalie.
6. Vérification manuelle : `GET /health/schema` en prod répond `up_to_date: true`.
7. **Seulement alors**, une PR séparée (« PR-02C-retrait ») retire le middleware.
8. Observation 24-48h post-déploiement (logs structurés §18 — absence totale d'invocation d'`ensure_schema_mw`, déjà impossible puisqu'il n'existe plus, mais confirmer l'absence de toute anomalie schéma).

**Fallback** : redéployer la révision précédente de `main.py` (avec le middleware) le temps de résoudre un problème — un simple revert de code applicatif, sans aucun effet sur le ledger déjà baseliné (la baseline reste valide, indépendante de la présence du middleware). Documenté dans le runbook.

---

## 6. Usage de `DATABASE_ADMIN_URL`

- Nouveau secret GitHub Actions (à provisionner par Ludo — hors code, D-4).
- Consommée uniquement par `get_admin_db()` (nouveau, `database.py`) et le workflow `db-migrate.yml`.
- **Jamais exposée à l'application FastAPI elle-même** (D-4) — `main.py`/les routers ne l'importent jamais.
- Utilisée par `MigrationRunner` uniquement pour les opérations qui tiennent `acquire_lock()` : `baseline`, `apply_plan`, `mark_manual_verified`. `status`/`plan`/`verify` restent sur la connexion poolée standard (`DATABASE_URL`, via `get_db()` par défaut) — lecture seule, jamais de verrou, pas besoin d'une connexion dédiée.
- **Fallback local/CI** : si `DATABASE_ADMIN_URL` est absente (poste de développeur, CI sans secret), `get_admin_db()` retombe sur `DATABASE_URL` avec un `logger.warning` explicite — jamais une erreur bloquante, cohérent avec la tolérance déjà en place pour `DATABASE_URL` absente (`db_available()`).
- **Rôle Neon : `neondb_owner`** (décision Ludo, §1) — le rôle des migrations/DDL, isolé du trafic applicatif. Ce choix couvre même un futur `requires_owner` (027 a été appliquée manuellement sous ce rôle le 04/07/2026). Note : PR-02C n'exécute de toute façon jamais de `requires_owner` via `apply` (I4), mais utiliser `neondb_owner` pour l'URL admin garde la porte ouverte sans re-provisionner un secret plus tard. Le secret GitHub `DATABASE_ADMIN_URL` (chaîne de connexion avec ce rôle) est provisionné par Ludo — hors code.

---

## 7. Procédure production — de `pending_count: 28` à baseliné/up_to_date

**`apply` n'intervient pas ici** (voir constat clé en tête de document). Séquence, exécutée par Ludo via le workflow, jamais par Claude :

1. `db-migrate.yml` → `command=plan` → confirme les 28 fichiers + leur action recommandée (attendu : 027 en `blocked_manual`, le reste en `apply` — mais rien n'est exécuté par `plan`).
2. `db-migrate.yml` → `command=baseline`, `baseline_mode=dry-run` → aperçu de ce qui serait écrit. Comparer à l'inventaire §3 de `PR02_ARCHITECTURE_PLAN.md` (004+009 → baseline, 027 → baseline puisque déjà appliquée manuellement le 04/07/2026 et ses objets sont vérifiés présents, le reste → baseline).
3. Inventaire confirmé → `db-migrate.yml` → `command=baseline`, `baseline_mode=commit` → écrit les 29 lignes réelles.
4. `db-migrate.yml` → `command=verify` → doit rapporter zéro anomalie (`[]`).
5. `GET /health/schema` (production réelle, hors Claude) → attendu : `schema_version: "027", up_to_date: true, pending_count: 0, manual_required_count: 0`.
6. Documenter date + acteur dans `MIGRATIONS_RUNBOOK.md` (même discipline que `PR01_TRACEABILITY.md`/`PR02A_TRACEABILITY.md`).

Si l'étape 2 révèle un écart avec l'inventaire attendu (ex. une table manquante) → **s'arrêter, ne pas commiter** (`baseline_mode=dry-run` reste sûr indéfiniment), investiguer avant de continuer.

---

## 8. Smoke tests

- **Avant tout déploiement** : `apply_one`/`apply_plan` testés contre une fixture PostgreSQL synthétique « migration 028 » (jamais les 28 fichiers réels, qui n'ont rien à appliquer) — succès, échec transactionnel (rollback + `status='failed'`), `requires_owner` bloquant (`ManualMigrationRequired`).
- **CLI `apply`** : confirmation renforcée si `is_production()` vrai sans `--yes` (mocké, comme les tests CLI existants).
- **`get_admin_db()`** : fallback vers `DATABASE_URL` si `DATABASE_ADMIN_URL` absente, avec le warning attendu.
- **Post-baseline production** (exécutés par Ludo, pas par Claude) : `GET /health/schema` → `up_to_date: true` ; `GET /health` inchangé ; un endpoint applicatif représentatif (ex. `/materialite`) répond normalement — repris de §23 déjà écrit.
- **Post-retrait `ensure_schema_mw`** : observer les logs structurés pendant 24-48h, confirmer l'absence d'anomalie schéma (le middleware n'existant plus, il ne peut plus être « invoqué » — le vrai signal à surveiller est l'absence de régression applicative, pas l'absence du middleware lui-même).

---

## 9. Rollback opérationnel

| Scénario | Rollback |
|---|---|
| `apply`/workflow buggué, pas encore mergé en prod | Aucun effet — code non déployé |
| `baseline --commit` a écrit des lignes incorrectes | Aucune ligne n'est jamais supprimée automatiquement (contrainte #1) ; correction via une investigation manuelle + éventuellement une nouvelle commande explicite, jamais un revert de schéma |
| Retrait de `ensure_schema_mw` cause un problème en prod | Redéployer la révision précédente de `main.py` (avec le middleware) — le ledger baseliné n'est pas affecté, aucune donnée perdue |
| Le workflow `db-migrate.yml` lui-même est buggué | `workflow_dispatch` uniquement — un run raté n'affecte rien d'automatique ; corriger le workflow et relancer manuellement |
| Restauration post-incident majeur (`backup.yml`) | `verify` avant tout redéploiement applicatif — le ledger restauré doit correspondre à l'état réel du schéma restauré (même backup, cohérents par construction) — repris de §19 |

---

## 10. Risques

| Risque | Détail | Mitigation |
|---|---|---|
| Baseliner la prod révèle un écart avec l'inventaire attendu | Un objet manquant ou différent de ce que D-3/l'inventaire §3 prévoient | `baseline --dry-run` est strictement lecture seule et peut être relancé indéfiniment avant tout `--commit` ; procédure §7 s'arrête au premier écart |
| Retrait prématuré de `ensure_schema_mw` | Si mergé avant que la prod soit réellement baselinée, aucun filet ne reste | Séquencement strict en 2 PR (§1/§5), le retrait n'est proposé qu'après confirmation `up_to_date: true` |
| `DATABASE_ADMIN_URL` mal provisionnée (mauvais rôle Neon) | `apply`/`baseline --commit` échoueraient en prod avec une erreur de privilège | Testé d'abord via `plan`/`baseline --dry-run` (lecture seule, ne nécessite pas forcément le rôle admin) avant tout `--commit` réel |
| D-1 toujours non confirmée par preuve directe | Comportement `AUTO_MIGRATE`/preview non tranché avec certitude | Non bloquant pour PR-02C : `AUTO_MIGRATE` reste hors périmètre (jamais introduit, ni en PR-02B ni ici) — seul le workflow manuel touche la prod, jamais un déploiement Vercel |
| Pas de Postgres local (confirmé PR-02B) | Tests `apply_one`/`apply_plan` non vérifiables localement avant push | Même mitigation qu'en PR-02B : rédaction soigneuse, CI (`migration-tests`) comme seule preuve réelle, ne pas déclarer vert avant confirmation |
| Le workflow GitHub lui-même n'a jamais tourné avant le premier usage réel en prod | Risque d'erreur de configuration YAML découverte seulement en conditions réelles | Premier usage recommandé en `command=plan` (zéro risque, lecture seule) avant tout `baseline`/`apply` |

---

## 11. Critères de merge

- Tous les tests ciblés (§8) verts en CI (`migration-tests` + suite existante).
- `ruff`/`git diff --check` propres.
- Le découpage en 2 PR (§1) **validé par Ludo** (2026-07-17).
- `main.py` **non modifié** dans PR-02C-code (le retrait est la PR séparée).
- Aucune commande d'écriture (`baseline --commit`, `apply --yes`, `mark-manual-verified`) exécutée par Claude à aucun moment — uniquement `--dry-run`/`plan`/`status`/`verify` si une démonstration locale est nécessaire, et seulement contre une base de test, jamais Neon.
- Runbook relu par Ludo avant tout déclenchement réel du workflow en prod.

---

## 12. Explicitement hors périmètre

- Toute exécution réelle de `baseline --commit`/`apply --yes`/`mark-manual-verified` par Claude — actions strictement réservées à Ludo via le workflow.
- Provisionnement du secret GitHub `DATABASE_ADMIN_URL` et configuration de l'environnement protégé `production-db` (reviewers) — actions GitHub/Neon de Ludo, hors code.
- Résolution ferme de D-1 (`vercel env ls`) — toujours non bloquante, mentionnée pour mémoire.
- PR-02D ou toute évolution du schéma au-delà de 027 (ex. PostGIS/PR-08) — aucune migration 028+ n'est créée ici.
- Tableau de bord admin HTTP (D-5, toujours CLI-only).
- Nettoyage de la duplication de bootstrap (`seed_factors.py`/`seed_emission_factors.py`) — signalé depuis PR-02, jamais repris.

---

## Résumé pour Ludo

**Plan résumé.** PR-02C ajoute `apply`/`apply_plan` (jamais exécuté sur les 28 fichiers existants — rien à y appliquer), le workflow GitHub manuel protégé, `DATABASE_ADMIN_URL` réellement câblée (connexion admin pour les opérations sous verrou), et le runbook. **Constat important** : corriger l'état observé en prod (`pending_count: 28`) ne dépend PAS d'`apply` — `baseline --commit` (déjà entièrement livré en PR-02B) suffit, via le nouveau workflow. Je propose de découper en 2 PR : PR-02C-code (mergeable sans toucher la prod, `ensure_schema_mw` intact) puis, après que Ludo ait baseliné la prod réelle via le workflow et confirmé `up_to_date: true`, une petite PR-02C-retrait séparée pour le middleware.

**Risques principaux** : même contrainte qu'en PR-02B (pas de Postgres local, CI comme seule preuve réelle) ; le vrai risque de fond est un retrait prématuré du middleware avant confirmation — mitigé par le découpage proposé.

**Fichiers prévus** : 2 fichiers modifiés (runner, CLI) + 1 nouveau (`get_admin_db`) + petite extraction `utils/env.py`/`auth.py` (D-2, 2ᵉ point d'usage) + 1 nouveau workflow + 1 nouveau runbook + tests étendus. `main.py` non touché dans cette PR.

**Décisions — toutes tranchées par Ludo (2026-07-17)** :
- Découpage 2 PR (§1/§11) — **validé**.
- Rôle Neon pour `DATABASE_ADMIN_URL` — **`neondb_owner`** (rôle migrations/DDL, §1/§6).
- `MIGRATIONS_RUNBOOK.md` — **rédigé au moment du code** (§1).

Aucune décision ouverte restante côté cadrage. Reste uniquement, côté Ludo et hors code : provisionner le secret GitHub `DATABASE_ADMIN_URL` (chaîne `neondb_owner`) et configurer l'environnement protégé `production-db`.

**Recommandation** : plan prêt à implémenter (PR-02C-code) sur « go PR-02C implementation ». Aucune action production ne sera jamais exécutée par moi — uniquement le code et la documentation qui permettent à Ludo de le faire lui-même, via le workflow protégé.
