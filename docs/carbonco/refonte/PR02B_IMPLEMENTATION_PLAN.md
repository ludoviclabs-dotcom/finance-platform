# PR-02B — Ledger réel, baseline, CLI complet, health · Plan d'implémentation

**Phase : cadrage uniquement.** Aucun fichier applicatif créé ou modifié, aucune migration exécutée, aucune base touchée. Rien commité ni poussé.
**Base analysée :** `feat/schema-migration-ledger-b`, à jour sur `master` (`d59d582`, merge PR [#95](https://github.com/ludoviclabs-dotcom/finance-platform/pull/95) — PR-02A incluse).
**Documents source :** `PR02_ARCHITECTURE_PLAN.md` (§5-14, §16, §21-22), `PR02_DECISIONS.md`, `PR02A_TRACEABILITY.md`.

> **Ne pas commencer l'implémentation avant le feu vert explicite de Ludo (« go PR-02B implementation »).** Ce document est le livrable de la phase de cadrage elle-même.

---

## 0. Écart notable par rapport au brief de cadrage — à confirmer

Le brief de Ludo liste le CLI attendu comme **« status, plan, verify, baseline, mark-applied ou mark-manual-verified »** — `apply` n'y figure pas, alors que `PR02_ARCHITECTURE_PLAN.md` §21 plaçait `apply_one`/`apply_plan` dans le périmètre PR-02B.

Je lis cette omission comme **intentionnelle et cohérente** avec le reste du chantier, pour trois raisons :
1. `apply()` sert à exécuter des migrations **futures** (028+) — aujourd'hui aucune n'existe : `baseline()` seule couvre l'intégralité des 28 fichiers existants (001-027+008b). `apply()` n'aurait littéralement rien à faire.
2. C'est la pièce la **plus risquée** du runner (exécution SQL réelle) — cohérent avec la discipline déjà appliquée sur PR-01/PR-02A (une étape à la fois, risque croissant).
3. Le découpage A/B/C existant est déjà par niveau de risque croissant ; retarder `apply` d'un cran de plus s'inscrit dans la même logique.

**Ce plan scope donc PR-02B SANS `apply_one`/`apply_plan`/CLI `apply`/`AUTO_MIGRATE`** (rien à appliquer, rien à gater). Si ce n'est pas ta lecture, dis-le avant le « go » — c'est un changement de périmètre facile à réintégrer avant de coder, pas après.

---

## 1. Périmètre exact PR-02B

**Dans le périmètre :**
- Bootstrap contrôlé de `schema_migrations` (verrou advisory, idempotent, jamais aveugle).
- `verify_migration_objects(version)` — sondes objet-par-objet pour les 28 versions existantes.
- `baseline(dry_run=True|False)` — vérifie et marque `baseline` (objets présents) ou `manual_required` (requires_owner=true, objets absents).
- `verify()` — détecte `checksum_mismatch` et `drift_detected` sur les lignes `applied`/`baseline`.
- `mark_manual_verified(version, applied_by, proof)`.
- `acquire_lock()` — verrou advisory de session, budget de nouvelle tentative borné (nécessaire pour que le bootstrap soit réellement « contrôlé »).
- CLI : `status`, `verify`, `baseline --dry-run|--commit`, `mark-applied` (alias `mark-manual-verified`). `plan` existe déjà (PR-02A), inchangé.
- `GET /health/schema` (public, minimal).
- Tests PostgreSQL (conteneur CI jetable `postgres:16`, jamais Neon) + tests CLI.
- `docs/carbonco/refonte/PR02B_TRACEABILITY.md` (créé **à la fin** de l'implémentation, rempli au fur et à mesure — pas maintenant).

**Hors périmètre (confirmé par ton message, repris tel quel) :**
- Ne retire pas `ensure_schema_mw` (`main.py` non modifié).
- Ne modifie pas le workflow de déploiement production.
- Ne crée pas `db-migrate.yml` si celui-ci déclenche des actions réelles contre Neon.
- Aucune migration sur Neon production. Aucune baseline réelle de production.
- Ne commence pas PR-02C.
- (Ajout par ce plan, voir §0) `apply_one`/`apply_plan`/CLI `apply`/`AUTO_MIGRATE`.

---

## 2. Fichiers à créer / modifier

| Fichier | Action | Contenu |
|---|---|---|
| `apps/api/db/migrations/000_schema_migrations_ledger.sql` | **Créer** | DDL du ledger (§3). Cas d'amorçage spécial — jamais une ligne dans sa propre table (§4). |
| `apps/api/db/migration_object_probes.py` | **Créer** | Sondes déclaratives de vérification objet-par-objet pour les 28 versions (§6) — module séparé pour ne pas transformer `migration_runner.py` en cascade `if/elif` de 28 branches. |
| `apps/api/db/migration_runner.py` | **Modifier** | Ajoute `acquire_lock`, `_ensure_ledger_table` (bootstrap interne), `verify_migration_objects`, `baseline`, `verify`, `mark_manual_verified` à la classe `MigrationRunner` existante. `discover_migrations`/`calculate_checksum`/`load_records`/`build_plan` (PR-02A) inchangés. |
| `apps/api/db/migration_manifest.py` | Inchangé | `MIGRATION_METADATA` (004/009/027) déjà correct pour la baseline. |
| `apps/api/db/migration_cli.py` | **Modifier** | Ajoute `status`, `verify`, `baseline`, `mark-applied`. `plan` inchangé. |
| `apps/api/routers/health.py` | **Modifier** | Ajoute `GET /health/schema` (§7). |
| `apps/api/tests/test_migration_runner.py` | **Modifier** | Ajoute les cas bootstrap/baseline/verify/lock (§8), DB-gated. |
| `apps/api/tests/test_migration_cli.py` | **Modifier** | Ajoute les cas `status`/`verify`/`baseline`/`mark-applied`. |
| `apps/api/tests/fixtures/migration_db.py` | **Créer** | Fixtures pytest dédiées (base neuve / partielle / « prod complète simulée ») — **pas** dans `conftest.py` partagé, pour ne pas risquer les fixtures de toute la suite existante pour un ajout de niche. |
| `.github/workflows/api.yml` | **Modifier** | Ajoute un job `migration-tests` avec service `postgres:16` (même pattern que `backup.yml::restore-check`, déjà en place). |
| `apps/api/.env.example` | **Modifier** | Documente `DATABASE_ADMIN_URL` (réservée, non consommée avant PR-02C) — pas `AUTO_MIGRATE` (voir §0, rien à gater encore). |
| `docs/carbonco/refonte/PR02B_TRACEABILITY.md` | Créer **en fin d'implémentation** | Pas maintenant. |

**Non touchés** (confirmé) : `migrations.py`, `main.py`, tout fichier `.sql` 001-027+008b, `db-migrate.yml` (n'existe pas encore), `MIGRATIONS_RUNBOOK.md` (PR-02C).

---

## 3. DDL proposé pour `schema_migrations`

Repris tel quel de `PR02_ARCHITECTURE_PLAN.md` §5 (déjà validé lors de la phase d'architecture, aucun changement) :

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version           TEXT        PRIMARY KEY,
    name              TEXT        NOT NULL,
    checksum_sha256   TEXT        NOT NULL,
    status            TEXT        NOT NULL
        CHECK (status IN ('applied', 'failed', 'manual_required', 'baseline')),
    applied_at        TIMESTAMPTZ,
    execution_ms      INTEGER,
    applied_by        TEXT,
    requires_owner    BOOLEAN     NOT NULL DEFAULT FALSE,
    transactional     BOOLEAN     NOT NULL DEFAULT TRUE,
    error_message     TEXT,
    metadata          JSONB       NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);
```

Placé dans `apps/api/db/migrations/000_schema_migrations_ledger.sql` mais **jamais découvert par `discover_migrations()`** (la regex §7 exige 3 chiffres suivis d'un `_slug` — `000_schema_migrations_ledger.sql` matcherait en fait la regex telle quelle, donc **exclusion explicite par le code**, pas par accident de regex : `MigrationRunner` doit ignorer `"000"` dans `discover_migrations()`, ou le fichier doit vivre hors de `migrations_dir` — **à trancher à l'implémentation**, je recommande un sous-dossier `migrations/_bootstrap/000_schema_migrations_ledger.sql` pour lever toute ambiguïté sans dépendre d'une exclusion codée en dur par nom).

---

## 4. Stratégie de bootstrap

Ordre exact (repris de §6, inchangé) :

1. `acquire_lock()` — advisory lock de **session** (`pg_try_advisory_lock(hashtext('carbonco_schema_migrations'))`), budget de nouvelle tentative borné (2 s d'intervalle, 30 s de budget total, configurable).
2. Sous le lock : `SELECT to_regclass('public.schema_migrations')`.
3. Si absente : exécuter le DDL de `000_schema_migrations_ledger.sql` directement (pas via le mécanisme normal de plan/apply — cas particulier documenté, jamais une ligne dans sa propre table).
4. Continuer normalement (`baseline()` ou `verify()` selon la commande appelante).
5. Libérer le lock en fin de run (explicite + implicite à la fermeture de connexion).

Implémenté comme méthode privée `MigrationRunner._ensure_ledger_table(conn)`, appelée en tête de `baseline()` et `verify()` (les deux seules opérations mutantes/consultantes de PR-02B qui ont besoin que la table existe). `plan`/`status`/`load_records` (PR-02A, inchangés) continuent de traiter « table absente » comme un simple ledger vide (`{}`), **sans** la créer — cohérence avec l'invariant PR-02A déjà en place.

---

## 5. Stratégie de baseline hors production

**Aucun accès à Neon.** Trois scénarios simulés contre `postgres:16` jetable (CI + local si disponible) :

| Fixture | Construction | Ce qu'elle valide |
|---|---|---|
| **Base neuve** | Conteneur vide, aucune migration jouée | `baseline()` : toutes les versions restent `pending` (aucune ligne écrite hors bootstrap ledger) |
| **Base partielle** | DDL inline + fichiers 001-015 seulement exécutés directement (pas via l'ancien `run_migrations()`, pour un contrôle exact du sous-ensemble) | `baseline()` : 001-015 → `baseline` ; 016-027 → `pending` (ou `manual_required` pour 027) |
| **« Production complète simulée »** | DDL inline + les 28 fichiers exécutés **tous**, y compris 004/009/027 (reproduit l'état réel de prod confirmé par D-3 + l'incident 027 du 04/07) | `baseline()` : les 28 → `baseline`, dont 004 **et** 009 (pas juste l'un ou l'autre — cf. §6), et 027 → `baseline` (objets vérifiés présents, malgré `requires_owner=true` — la baseline constate l'existant, elle ne l'exécute pas) |

**Nuance importante sur `requires_owner` dans `baseline()`** (absente du texte §8, précisée ici) : `requires_owner` bloque uniquement `apply()` (hors périmètre PR-02B, §0). Il ne bloque **jamais** `baseline()` — une version `requires_owner=true` dont les objets sont **vérifiés présents** doit être marquée `baseline` (c'est exactement le cas réel de 027, déjà appliquée manuellement le 04/07/2026). Si ses objets sont **absents**, `baseline()` écrit une ligne `manual_required` persistée (pas juste un état calculé comme en PR-02A) — c'est ce que `mark-applied`/`mark-manual-verified` doit ensuite pouvoir transitionner vers `baseline`/`applied`. Aucune fixture de test ne couvre aujourd'hui « 027 pas encore appliquée » puisque la prod réelle l'a déjà — fixture à construire artificiellement pour ce cas (sites/actions.site_id absents) afin de tester le chemin `manual_required` avant qu'il ne se représente pour une vraie future migration `requires_owner`.

**Base preview Vercel** : non simulée (D-1, voir §10) — hors périmètre de test PR-02B, le comportement réel dépendra de D-1 et ne sera pertinent qu'au rollout (PR-02C+).

---

## 6. Stratégie D-3 et preuve attendue (sondes objet-par-objet)

D-3 déjà **résolue** (`PR02_DECISIONS.md`, 2026-07-17) — ce qui reste à faire en PR-02B est de **coder** la sonde qui a servi à la résoudre manuellement, pas de la retrancher.

`apps/api/db/migration_object_probes.py` — un dict déclaratif `version → callable(cursor) -> bool`, un type de sonde par famille (confirmé en lisant les 28 fichiers `.sql`, pas seulement le résumé §3) :

| Famille | Exemple | Sonde |
|---|---|---|
| Table simple | 001, 002, 006, 007, 010, 014, 019, 020, 022, 023, 026 | `to_regclass('public.<table>') IS NOT NULL` |
| Colonne ajoutée | 005, 011, 018, 021, 025 | `information_schema.columns` sur `(table, colonne)` |
| RLS seule (ENABLE) | 010, 013, 015-017, 019-023, 025 | `pg_policies` : au moins une ligne pour la table |
| **004 spécifiquement** | `snapshots`/`facts_events`/`audit_events`/`alert_rules`/`products` | `pg_policies` (policies `tenant_isolation_<table>`/`_insert` existent) **ET** `pg_class.relforcerowsecurity = false` — sinon on ne peut pas distinguer 004 de 009 (même noms de policies, vérifié en lisant les deux fichiers .sql côte à côte) |
| **009 spécifiquement** | mêmes 5 tables | mêmes policies **ET** `pg_class.relforcerowsecurity = true` — c'est exactement la requête que Ludo a exécutée manuellement pour résoudre D-3 |
| Fonction `SECURITY DEFINER` | 008b (`resolve_supplier_token`), 012 (`resolve_auditor_token`/`touch_auditor_token`), 024 (`mark_supplier_token_viewed`) | `pg_proc` : fonction existe **et** `prosecdef = true` |
| **027 spécifiquement** | `sites` + `actions.site_id` | `to_regclass('public.sites')` **ET** `information_schema.columns` sur `actions.site_id` **ET** `pg_class.relforcerowsecurity = true` sur `sites` — un état où `sites` existe mais `actions.site_id` est absent doit rester `manual_required`, pas `baseline` (ALTER TABLE partiellement échoué) |
| Baseline `000` (DDL inline) | `companies`/`users`/`refresh_tokens`/`snapshots`/`audit_events`/`products`/`alert_rules` | `to_regclass` sur les 7 tables — traité comme une ligne `version='000'` réelle du ledger (pas le bootstrap technique de la table elle-même, cf. §4/§6 de l'architecture — les deux « 000 » ne sont pas la même chose) |

**Preuve attendue par test** (pas par moi contre Neon — jamais) : chaque sonde testée à la fois **positivement** (objet présent → `True`) et **négativement** (objet absent → `False`) contre le conteneur `postgres:16`, en construisant délibérément un état partiel pour le cas négatif.

---

## 7. Contrats CLI

```
python -m db.migration_cli status        [--json]
python -m db.migration_cli plan          [--json]   # inchangé, PR-02A
python -m db.migration_cli verify        [--json]
python -m db.migration_cli baseline      [--dry-run|--commit] [--json]
python -m db.migration_cli mark-applied  <version> --applied-by <acteur> --proof <texte>
```

| Commande | Comportement | Code de sortie |
|---|---|---|
| `status` | Compte par statut + dernière version + anomalies `verify()` en arrière-plan. Toujours lecture seule. | `0` |
| `verify` | Checksum + existence d'objet pour chaque ligne `applied`/`baseline`. | `0` sain, `4` anomalie détectée |
| `baseline --dry-run` (défaut) | Calcule et affiche ce qui serait marqué, **n'écrit rien**. | `0` |
| `baseline --commit` | Écrit réellement les lignes `baseline`/`manual_required` après vérification. **Confirmation renforcée si environnement production-like** (§10, D-2). | `0` succès, `2` lock non obtenu, `3` bloqué par `requires_owner` non résolu (n'empêche pas les autres versions d'être baselinées, seul le apply futur serait bloqué — la baseline elle-même n'exécute rien) |
| `mark-applied <version>` (alias `mark-manual-verified`) | Exige `--applied-by` **et** `--proof` (I7) ; transition `manual_required`/`pending` → `baseline`/`applied` | `0` succès, `1` si arguments manquants ou version inconnue |

Codes `0/1/2/3/4` cohérents avec §14 (pas de renumérotation). `--json` sur toutes les commandes mutantes, pas seulement `plan` (PR-02A).

---

## 8. Contrat `/health/schema` (minimal, non sensible)

```json
{
  "schema_version": "027",
  "up_to_date": true,
  "pending_count": 0,
  "manual_required_count": 0,
  "checked_at": "2026-07-17T18:00:00Z"
}
```

- `200` toujours si l'endpoint répond (même `up_to_date: false`) ; `503` si la base est injoignable — cohérent avec `_db_status()` déjà dans `routers/health.py`.
- **Écart assumé par rapport à §16** : le texte d'architecture demandait « une seule requête SELECT légère... pas de lecture de fichiers à la volée ». En pratique, `pending_count` exige de connaître le nombre de fichiers **découverts** pour le comparer aux lignes du ledger. Je propose de réutiliser `discover_migrations()` (liste + regex, **sans** `calculate_checksum` — la partie réellement coûteuse, hashage de chaque fichier) plutôt que `build_plan()` complet. Compromis explicite : listing de 28 petits fichiers (quelques ms), zéro hashage, une seule requête `COUNT(*) ... GROUP BY status` sur le ledger. Borné par `asyncio.wait_for(..., timeout=2.0)`, même pattern que `_storage_status()` existant.
- `schema_version` = version maximale avec statut `applied`/`baseline` (pas la version max sur disque).
- Absence de DB : `"db": "not_configured"`, `up_to_date: null` (même convention que `/health`).
- Aucun secret, aucun SQL, aucun détail par version — le détail reste réservé à `status --json` (D-5).

---

## 9. Stratégie de tests PostgreSQL

**Contrainte d'environnement découverte pendant ce cadrage : `docker` n'est pas disponible dans ce shell local (Windows, pas de daemon Docker accessible).** Je ne pourrai donc **pas** exécuter localement les tests PostgreSQL réels pendant l'implémentation — seule la CI (conteneur `postgres:16`, déjà utilisé par `backup.yml::restore-check`, même pattern proposé pour `api.yml`) pourra les valider en conditions réelles. Je peux écrire et faire tourner tous les tests **unitaires purs** localement (comme en PR-02A), mais les tests DB-gated seront à surveiller sur le premier push CI, pas garantis verts avant.

- **Marqueur de skip** : identique à `test_rls_isolation.py` — `pytest.mark.skipif(not os.environ.get("DATABASE_URL"), ...)`, jamais de connexion Neon.
- **Fixtures** (`tests/fixtures/migration_db.py`, pas `conftest.py` partagé) : `empty_db`, `partial_db` (001-015), `full_db` (28 fichiers, y compris 004/009/027 — simulateur de prod).
- **Catégories** (mappées à §22, scope resserré à ce qui est réellement dans ce plan) :
  - Bootstrap idempotent (table déjà présente → no-op).
  - Baseline sur les 3 fixtures (§5).
  - `verify()` détecte un checksum modifié (fichier altéré après coup) et un objet manquant malgré une ligne `applied`/`baseline` (drift).
  - `mark_manual_verified` : refuse sans `applied_by`/`proof` ; transitionne correctement sinon.
  - Concurrence **simplifiée** (pas la matrice complète §22) : deux connexions, la 2ᵉ tentative de lock pendant que la 1ʳᵉ le détient doit échouer proprement (`pg_try_advisory_lock` renvoie faux) — pas de simulation de crash process, jugée hors de portée raisonnable pour PR-02B.
  - CLI bout-en-bout : `status → verify → baseline --dry-run → baseline --commit → verify` sur `empty_db`.
- **CI** : nouveau job `migration-tests` dans `api.yml`, service `postgres:16` (mêmes options que `backup.yml`), exécute uniquement `tests/test_migration_runner.py`/`test_migration_cli.py` avec `DATABASE_URL` pointant vers le service — le job `tests` existant (mode `/tmp`, sans DB) reste inchangé et continue de couvrir le reste de la suite.

---

## 10. Risques

| Risque | Détail | Mitigation |
|---|---|---|
| Pas de Postgres local | Voir §9 — tests DB-gated non vérifiables avant le premier push CI | Rédaction soigneuse + revue attentive du 1er run CI ; ne pas déclarer « vert » avant confirmation CI réelle |
| **D-1 non confirmé par preuve directe** | Ton message affirme « preview/prod isolées », mais `PR02_DECISIONS.md` liste D-1 comme ouverte, et je n'ai trouvé qu'un indice **circonstanciel** (`SETUP_PROGRESS.md:148` : `AUTH_JWT_SECRET` posé **Production uniquement**, implicitement suggérant que les *autres* variables — dont probablement `DATABASE_URL` — sont partagées Production+Preview) — pas une confirmation directe type `vercel env ls` | PR-02B ne dépend pas du résultat (aucun code preview-spécifique). Le design D-2 (fail-secure) traite déjà le preview comme la prod par défaut pour toute confirmation CLI, donc le risque réel (une preview qui migrerait une base partagée sans le savoir) est neutralisé indépendamment de la réponse à D-1. **Recommandation : lancer `vercel env ls` sur `carbonco-api` avant PR-02C**, pas bloquant ici. |
| 28 sondes objet-par-objet | La pièce la plus laborieuse et la plus facile à se tromper (nom de colonne, policy) | Les 28 fichiers `.sql` ont été relus un par un pour ce cadrage (pas seulement le résumé §3) ; chaque sonde testée positivement **et** négativement contre le conteneur CI |
| Cohérence `manual_required` calculé (PR-02A) vs persisté (PR-02B) | `_plan_item` (PR-02A) calcule `blocked_manual` sans lire de ligne réelle ; `baseline()` (PR-02B) peut désormais écrire une vraie ligne `manual_required` | Pas de conflit : une fois la ligne écrite, `_plan_item` la lit comme n'importe quel `record` existant (branche déjà testée en PR-02A, `test_plan_item_manual_required_stays_blocked`) — aucune modification de `_plan_item` nécessaire |
| Fichier `000_...` matche la regex de découverte | `discover_migrations()` pourrait l'ingérer par erreur comme une migration normale | Proposé en sous-dossier `_bootstrap/` (§3) pour lever l'ambiguïté sans dépendre d'une exclusion par nom codée en dur — **à confirmer/trancher explicitement à l'implémentation, pas déjà décidé** |
| Bruit CRLF/LF dans les diffs git | Déjà observé sur les commits PR-02A (cosmétique, `core.autocrlf`) | Aucune action requise, mentionné pour ne pas être mal interprété en revue |

---

## 11. Explicitement reporté à PR-02C (ou au-delà)

- `.github/workflows/db-migrate.yml`, retrait de `ensure_schema_mw`, baseline réelle de production, `MIGRATIONS_RUNBOOK.md` (déjà prévu ainsi, §21 architecture).
- `apply_one`/`apply_plan`/CLI `apply`/`AUTO_MIGRATE` (§0 — **sous réserve de ta confirmation**, absent de ton brief mais présent dans le plan d'architecture original).
- Résolution ferme de D-1 par `vercel env ls` (ne bloque pas PR-02B, voir §10).
- Fixture « 027 pas encore appliquée » construite artificiellement (§5) — utile mais pas strictement bloquante ; peut glisser en PR-02C si le temps manque, car la prod réelle a déjà 027.

---

## 12. Commandes de validation

```bash
git branch --show-current   # feat/schema-migration-ledger-b
git status --short          # propre avant de commencer

cd apps/api
python -m pytest -q                                  # suite complète, mode /tmp (inchangé)
python -m pytest -q tests/test_migration_runner.py tests/test_migration_cli.py   # ciblé, unitaires

# Tests PostgreSQL — nécessitent un postgres:16 local ou CI (voir §9, indisponible localement ici) :
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres python -m pytest -q -m "" tests/test_migration_runner.py

python -m db.migration_cli status
python -m db.migration_cli baseline --dry-run
python -m db.migration_cli verify

git diff --check
```

---

## Résumé pour Ludo

**Résumé du plan.** PR-02B ajoute au ledger (déjà découvert/modélisé/planifié en PR-02A) : le bootstrap réel de `schema_migrations`, la vérification objet-par-objet des 28 migrations existantes (avec la sonde exacte `relforcerowsecurity` qui a résolu D-3), `baseline`/`verify`/`mark-applied`, `/health/schema`, et les tests PostgreSQL associés — le tout sans toucher `ensure_schema_mw`, sans workflow de prod, sans jamais approcher Neon.

**Décisions encore ouvertes :**
- **D-1** : ton message la donne comme tranchée (« isolées »), mais je n'ai qu'un indice circonstanciel (`AUTH_JWT_SECRET` Production-only, sous-entendant le reste est partagé) — pas de `vercel env ls` confirmé. Ne bloque pas ce plan (le design D-2 est fail-secure indépendamment de la réponse), mais mérite une vérification avant PR-02C.
- **D-2** : résolu avec preuve directe — `VERCEL_ENV` (pas `APP_ENV`, qui n'existe nulle part dans le code ; la variable locale de repli est `ENV`) est déjà le pattern établi (`routers/auth.py::_is_prod()`), fail-secure. Je propose de l'extraire vers `utils/env.py` et de le réutiliser tel quel plutôt que de dupliquer une 3ᵉ fois cette logique.
- **D-4** : nom retenu (`DATABASE_ADMIN_URL`), mais sans effet réel en PR-02B (le conteneur de test CI n'a qu'un seul rôle) — juste documentée en réserve dans `.env.example`.
- **Omission `apply`** (§0) : ma lecture est que c'est intentionnel — à confirmer avant le go.

**Fichiers prévus** : 1 nouveau fichier SQL (bootstrap), 1 nouveau module (sondes), 4 fichiers modifiés (runner, CLI, health, workflow CI), 1 nouveau fichier de fixtures de test, 2 fichiers de test étendus, `.env.example` documenté. Détail complet §2.

**Tests prévus** : unitaires pour les sondes (positif/négatif) + bootstrap/baseline (3 fixtures)/verify/lock simplifié/CLI bout-en-bout — tous DB-gated, exécutables localement seulement si tu as un Postgres accessible (je n'en ai pas dans ce shell), sinon validés au premier push CI via le nouveau job `migration-tests`.

**Risques principaux** : absence de Postgres local pour valider moi-même avant push (§10) ; les 28 sondes objet-par-objet sont la pièce la plus dense et la plus facile à mal calibrer ; D-1 reste sur une base circonstancielle.

**Recommandation** : go sur ce plan tel quel, à trois conditions à trancher avant que je code : (1) confirmer l'omission d'`apply` (§0), (2) trancher le sous-dossier `_bootstrap/` pour le fichier `000_...` (§3/risques), (3) accepter l'écart §8 sur `/health/schema` (discover sans checksum, pas un unique SELECT pur). Aucune des trois ne change l'architecture globale — ce sont des détails d'implémentation, mais je préfère les nommer maintenant plutôt que de trancher seul.
