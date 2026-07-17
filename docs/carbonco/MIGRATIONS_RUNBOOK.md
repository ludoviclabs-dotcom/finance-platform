# Runbook — Ledger de migrations CarbonCo (`schema_migrations`)

Runbook opérationnel du système de migrations introduit par PR-02 (A/B/C). Il
décrit **comment** exploiter le ledger en production, pas comment il est
implémenté (voir `docs/carbonco/refonte/PR02_ARCHITECTURE_PLAN.md` pour le
design). Public : opérateur avec accès au workflow GitHub protégé (Ludo).

> **Principe non négociable** : aucune écriture sur le schéma de production ne
> se fait automatiquement. Ni au démarrage de l'API, ni à un cold start, ni à
> un déploiement Vercel. Le **seul** chemin autorisé est le workflow manuel
> `.github/workflows/db-migrate.yml`, protégé par approbation humaine.

---

## 1. Architecture en bref

- **`schema_migrations`** : une ligne par version de migration, avec `status`
  (`applied` / `baseline` / `manual_required` / `failed`), checksum SHA-256,
  `applied_at`, `applied_by`, `execution_ms`, `error_message`, `metadata`.
- **`version='000'`** : le socle DDL historique inline (`migrations.py`) —
  baseliné comme une ligne réelle, distinct du bootstrap technique de la table
  elle-même (`apps/api/db/_bootstrap/000_schema_migrations_ledger.sql`).
- **Découverte** : `apps/api/db/migrations/*.sql`, regex `NNN[suffixe]_slug.sql`,
  triés `(int, suffixe)`. Le dossier `_bootstrap/` n'est jamais découvert.
- **Sondes objet-par-objet** (`migration_probes.py`) : la baseline et la
  vérification interrogent le catalogue PostgreSQL (`pg_class`, `pg_policies`,
  `pg_proc`, `information_schema`) — l'existence réelle d'un objet fait
  autorité, jamais l'hypothèse historique.
- **Verrou** : advisory lock de session (`pg_try_advisory_lock`), empêche deux
  runs concurrents d'écrire en même temps.

## 2. Bootstrap

La table `schema_migrations` est créée **explicitement** par la première
commande mutante (`baseline --commit` ou `mark-manual-verified`), jamais par
une lecture (`status`/`plan`/`verify`) ni par le démarrage de l'API. Une base
neuve (dev/test) obtient la table au premier `baseline --commit`.

## 3. Commandes CLI

Toujours exécutées via le workflow en production (§4), ou localement contre une
base de test. Format : `python -m db.migration_cli <commande>` depuis `apps/api`.

| Commande | Effet | Écrit ? | Connexion |
|---|---|---|---|
| `status [--json]` | Comptages par statut, dernière version, anomalies | Non | poolée (`DATABASE_URL`) |
| `plan [--json]` | Plan calculé (action par version) | Non | poolée |
| `verify [--json]` | Détecte checksum_mismatch / drift_detected | Non | poolée |
| `baseline --dry-run [--json]` | Aperçu de ce qui serait marqué (défaut) | Non | admin (`DATABASE_ADMIN_URL`) |
| `baseline --commit [--json]` | Écrit les lignes `baseline`/`manual_required` | **Oui** | admin |
| `apply [--yes] [--json]` | Exécute les migrations `pending` (028+) | **Oui** | admin |
| `mark-manual-verified <v> --applied-by <a> --proof <p>` | `manual_required` → `baseline` après application manuelle | **Oui** | admin |

**Codes de sortie** : `0` succès / rien à faire ; `1` erreur (connexion,
arguments, confirmation prod manquante) ; `2` verrou non obtenu ; `3`
migration `requires_owner` bloquante ; `4` anomalie `verify`.

## 4. Workflow production

1. GitHub → Actions → **DB Migrate** → *Run workflow*.
2. Choisir `command` (et `baseline_mode`, ou les champs `mark-manual-verified`).
3. L'environnement `production-db` **exige une approbation** (reviewer) avant
   que le job ne s'exécute.
4. Le job utilise le secret `DATABASE_ADMIN_URL` (rôle `neondb_owner`) et pose
   `ENV=production` (→ `apply` reçoit `--yes` automatiquement, c'est
   l'approbation de l'environnement qui fait office de confirmation).
5. Sortie JSON dans les logs du run + artefact `migration-log-<run_id>`.

> **Wiring des variables (hotfix 2026-07-17)** : `DATABASE_ADMIN_URL` est la
> **source unique** de ce workflow. Il est aussi mappé vers `DATABASE_URL`
> **uniquement dans ce workflow**, pour compatibilité CLI : les commandes en
> lecture seule (`status`/`plan`/`verify`) passent par `get_db()` et le garde
> `db_available()` teste `DATABASE_URL` — sans ce mapping, elles échouent sur
> « PostgreSQL non configuré » alors que seul `DATABASE_ADMIN_URL` est fourni.
> L'URL applicative runtime (celle de Vercel) n'est **jamais** utilisée pour
> migrer ; ici les deux variables pointent volontairement vers la même
> connexion admin `neondb_owner`.

**Toujours lancer une commande de lecture (`plan` / `baseline --dry-run`)
avant toute écriture**, lire la sortie, puis relancer en écriture.

## 5. Procédure : baseliner une production `pending_count: 28`

État de départ observé : `/health/schema` → `schema_version: null,
up_to_date: false, pending_count: 28, manual_required_count: 0`. Le schéma est
structurellement présent (le service tourne), mais le ledger n'a jamais été
peuplé. **`apply` n'intervient pas** — `baseline` suffit.

1. **Backup** — déclencher `backup.yml` avant toute écriture.
2. `command=plan` → confirme les 28 fichiers découverts.
3. `command=baseline`, `baseline_mode=dry-run` → comparer au tableau §3 de
   `PR02_ARCHITECTURE_PLAN.md`. Attendu : `000` + 001-026 + 008b + 004 + 009 →
   `baseline` ; `027` → `baseline` (déjà appliquée manuellement le 04/07/2026,
   objets vérifiés présents). **Si un écart apparaît, s'arrêter** — `dry-run`
   n'écrit rien, investiguer avant de continuer.
4. Inventaire confirmé → `command=baseline`, `baseline_mode=commit` → écrit les
   29 lignes.
5. `command=verify` → doit répondre `{"anomalies": []}`.
6. Vérifier `GET /health/schema` en production → attendu : `schema_version:
   "027", up_to_date: true, pending_count: 0, manual_required_count: 0`.
7. Consigner ci-dessous (§9) la date et l'acteur.

## 6. Appliquer une nouvelle migration (028+)

Quand une migration `028_*.sql` est ajoutée (PR future) :

1. `command=plan` → la nouvelle version apparaît en `apply`.
2. `command=apply` → exécutée dans une transaction dédiée, ligne `applied`
   écrite après COMMIT. Arrêt strict au premier échec (les suivantes ne sont
   pas tentées ; la ligne `failed` est écrite avec `error_message`).
3. `command=verify` → zéro anomalie.

Une migration `requires_owner` (privilège `neondb_owner`, ex. `CREATE
EXTENSION`) n'est **jamais** exécutée par `apply` (elle sort en erreur code 3) :
l'appliquer manuellement dans le Neon SQL Editor, puis `mark-manual-verified`.

## 7. Opérations nécessitant le propriétaire Neon

- `apply` refuse toute migration `requires_owner` (I4). Les appliquer via le
  Neon SQL Editor sous `neondb_owner`, puis `command=mark-manual-verified` avec
  `mark_version`, `applied_by`, `proof` (preuve = requête de vérification
  exécutée, capture, ou ticket). `mark-manual-verified` re-vérifie les objets
  avant d'écrire — une preuve textuelle ne suffit pas si les objets sont absents.
- Cas connu : `027` (`ALTER TABLE actions` exige `neondb_owner`), appliquée
  manuellement le 04/07/2026.

## 8. Rollback

| Situation | Action |
|---|---|
| `apply`/workflow buggué, pas déployé | Aucun effet ; corriger et relancer |
| `baseline --commit` a écrit des lignes douteuses | Aucune suppression automatique ; investiguer, corriger via commande explicite |
| Migration 028+ échouée | Ligne `failed` + `error_message` ; corriger dans une **nouvelle** version (jamais éditer le fichier échoué), relancer `plan` puis `apply` |
| Retrait de `ensure_schema_mw` (PR-02C-retrait) cause un problème | Redéployer la révision précédente de `main.py` (avec le middleware) — le ledger baseliné n'est pas affecté |
| Restauration depuis backup | `verify` avant tout redéploiement — ledger et schéma restaurés viennent du même backup, cohérents par construction |

Jamais de rollback destructif automatique : une ligne de ledger n'est jamais
supprimée par le runner ; une migration n'est jamais « dé-appliquée »
automatiquement.

## 9. Journal des opérations production

À remplir à chaque écriture réelle (même discipline que
`PR0*_TRACEABILITY.md`).

| Date | Opération | Versions | Acteur | Preuve / run |
|---|---|---|---|---|
| (à remplir) | | | | |

## 10. Diagnostic — schéma incomplet

- `GET /health/schema` : `up_to_date: false` avec `pending_count > 0` → des
  versions découvertes n'ont pas de ligne `applied`/`baseline`.
- `manual_required_count > 0` → une migration `requires_owner` attend une
  action manuelle + `mark-manual-verified`.
- `up_to_date: false` alors que `pending_count: 0` et `manual_required_count: 0`
  → au moins une ligne `failed` (une migration a échoué) — lancer
  `status --json` (détaillé, CLI-only) pour identifier laquelle et lire son
  `error_message`.
- `verify` non vide → `checksum_mismatch` (un fichier a changé après
  application — ne jamais réappliquer, comparer au git blame) ou
  `drift_detected` (objet attendu absent malgré une ligne — investiguer, ne
  jamais réappliquer automatiquement).

## 11. Hotfix baseline commit transaction aborted (2026-07-17)

**Symptôme** : `db-migrate.yml` → `command=baseline`, `baseline_mode=commit`
échouait avec :

```
Erreur : current transaction is aborted, commands ignored until end of transaction block
```

**Cause racine** : ce message est un **symptôme secondaire** PostgreSQL, pas
l'erreur d'origine. `baseline()` traitait les 29 versions (000 + 28 fichiers)
dans **une seule transaction géante** ; dès qu'une vraie erreur SQL survenait
sur UNE version (sonde ou écriture), aucun `ROLLBACK` n'était émis avant de
continuer — PostgreSQL refuse alors toute commande suivante sur cette
connexion avec « transaction aborted », masquant complètement la cause réelle
dans les logs. **La cause SQL exacte qui a déclenché l'abandon n'est pas
visible dans les logs du run #5** (c'est précisément ce que ce correctif rend
visible pour la prochaine tentative) — ne pas supposer laquelle avant de
relancer `baseline --dry-run` après ce correctif.

**Correctif** : chaque version est désormais traitée dans sa **propre unité de
commit** (comme `apply_one`). Toute vraie erreur PostgreSQL déclenche un
`ROLLBACK` immédiat puis une exception explicite qui **inclut le message
PostgreSQL d'origine et la version concernée** — plus jamais masquée. Arrêt
strict (pas de baseline partielle silencieuse), mais les versions déjà
traitées AVANT l'erreur restent committées individuellement : un nouveau
`baseline --commit` reprend proprement (`already_recorded` pour ce qui est
déjà fait). Le bootstrap de `schema_migrations` est lui aussi committé
immédiatement, indépendamment du reste.

**Commande qui avait échoué** : `command=baseline`, `baseline_mode=commit`
(run #5).

**Commande à relancer après merge de ce hotfix** :
1. `command=plan` puis `command=baseline`, `baseline_mode=dry-run` d'abord —
   la vraie cause racine, si elle réapparaît, sera maintenant visible dans la
   sortie (nom de version + message PostgreSQL réel).
2. Si `dry-run` est propre, relancer `command=baseline`, `baseline_mode=commit`.

**Ne pas lancer `apply`** tant que le baseline n'est pas confirmé sain
(`command=verify` → `{"anomalies": []}` et `/health/schema` →
`up_to_date: true`).
