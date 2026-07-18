# PR-03 — Evidence Kernel · Traçabilité

**Périmètre :** noyau backend partagé de sources, licences, releases, artefacts, ingestions et observations auditables — Couche 1 de `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §3/§6. Fondation réutilisable par les futurs modules (achats/fournisseurs, Scope 2, matières critiques, eau, biodiversité, double matérialité) — aucun de ces modules n'est construit ici.
**Base :** branche `feat/evidence-kernel`, à jour sur `master` (`1b01b98`, merge PR [#101](https://github.com/ludoviclabs-dotcom/finance-platform/pull/101) — clôture PR-02).
**Statut : implémenté, en attente de revue et de tests CI PostgreSQL (`migration-tests`). PR non mergée automatiquement.**

> Convention de statut : **FAIT** · **PARTIEL** · **NON FAIT** · **NON APPLICABLE**.

---

## 1. Périmètre livré

| # | Élément | Statut | Preuve |
|---|---|---|---|
| 1 | Migration 028 (6 tables + RLS + triggers) | **FAIT** | `apps/api/db/migrations/028_evidence_kernel.sql` |
| 2 | Modèles Pydantic | **FAIT** | `apps/api/models/intelligence.py` |
| 3 | Services backend | **FAIT** | `apps/api/services/intelligence/*.py` (6 modules) |
| 4 | API protégée minimale | **FAIT** | `apps/api/routers/intelligence.py`, 12 endpoints |
| 5 | RLS et isolation tenant | **FAIT** | migration 028 §RLS + tests dédiés |
| 6 | Politique de licence | **FAIT** | `license_policy.py`, déterministe, sans LLM |
| 7 | Tests unitaires/PostgreSQL/API | **FAIT** | 5 fichiers de tests, voir §7 |
| 8 | Documentation et traçabilité | **FAIT** | ce document |
| 9 | Interface frontend | **NON APPLICABLE** | explicitement hors périmètre (mission) |
| 10 | Adaptateurs réels / ingestion externe | **NON APPLICABLE** | explicitement hors périmètre (mission) |

---

## 2. Architecture

```
Source (source_registry)
    │  licence (license_policy.evaluate)
    ▼
Release détectée → validée → publiée / bloquée par licence (source_releases)
    │                                    │
    │ supersession (nouvelle release)    │
    ▼                                    ▼
Artefact brut (evidence_artifacts)   Observation normalisée (observations)
    │                                    │
    └──────────► claim_evidence_links ◄──┘  (lien preuve ↔ claim applicatif, schéma
                                              seul dans PR-03, pas de service dédié)
```

Principes appliqués (héritage direct de `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §1) :
- une release **publiée** n'est jamais réécrite ; une correction crée une nouvelle version (`supersedes_id`) ;
- une observation n'est **jamais** modifiée après création — toute correction est une nouvelle ligne ;
- `company_id IS NULL` = donnée globale, lisible par tous les tenants authentifiés, jamais écrite par un tenant ;
- la licence d'une source est évaluée de façon déterministe, jamais par un modèle de langage ;
- risque/licence bloquante ≠ exception Python — `blocked_license` est un état normal du cycle de vie, avec ses raisons tracées.

`company_id BIGINT` (au lieu de l'`INTEGER` historique des tables 001-027) : les 6 nouvelles tables utilisent `BIGSERIAL`/`BIGINT` de bout en bout, décision volontaire pour ce nouveau sous-système (une FK `BIGINT → companies.id INTEGER` est valide en PostgreSQL — comparaison croisée int4/int8 nativement supportée).

---

## 3. Migration 028

**Fichier :** `apps/api/db/migrations/028_evidence_kernel.sql`. `requires_owner=False` (déclaré dans `migration_manifest.py`) — ne crée que des tables neuves, aucun `ALTER` d'une table existante appartenant à un autre rôle (contrairement à 027).

**Idempotence — piège trouvé et corrigé pendant l'implémentation** : la première version des policies RLS utilisait un `CREATE POLICY` nu, sans le garde `DROP POLICY IF EXISTS` que 009/027 utilisent. Or `startup_event` (confort dev local, `main.py`) rejoue `run_migrations()` — qui parcourt tous les fichiers `.sql` non exclus, 028 y compris — à chaque démarrage local, et ma propre fixture de test (`_intelligence_fixtures.build_evidence_kernel_db`) réapplique aussi le fichier explicitement. Sans le garde, une deuxième application aurait échoué sur « policy already exists ». **Corrigé** : les 21 `CREATE POLICY` de la migration sont désormais tous précédés d'un `DROP POLICY IF EXISTS` (pattern 009), rendant le fichier entièrement rejouable — même contrat d'idempotence que les 27 migrations précédentes. Toutes les autres instructions (`CREATE TABLE`/`INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, `GRANT`) étaient déjà idempotentes par construction.

**Manifest :** `apps/api/db/migration_manifest.py` — entrée `"028"` ajoutée (`requires_owner=False`, note explicite).

**Sonde du ledger :** `apps/api/db/migration_probes.py` — `_probe_028` ajoutée (+ helper `_trigger_exists`), enregistrée dans `MIGRATION_OBJECT_PROBES["028"]`. **Nécessaire, pas optionnelle** : `MigrationRunner.verify()` appelle `migration_probes.verify_object(cur, version)` pour toute version `applied`/`baseline`, et une version absente du registre de sondes renvoie `False` (`verify_object`, docstring : « une version inconnue ne peut pas être baselinée aveuglément »). Sans cette sonde, `command=verify` après l'`apply` de 028 aurait rapporté un `drift_detected` **faux positif** — trouvé en retraçant le fonctionnement du ledger, pas dans la liste d'inspection obligatoire de la mission.

**Accès applicatif (`GRANT`)** : même geste que 027 — `GRANT SELECT/INSERT/UPDATE/DELETE` sur les 6 tables + `GRANT USAGE/SELECT` sur leurs séquences à `carbonco_app`, conditionnel à l'existence du rôle. Sans ce bloc, un déploiement où `db-migrate.yml` applique la migration via `DATABASE_ADMIN_URL` (rôle admin) laisserait l'application (`DATABASE_URL`, rôle `carbonco_app`) sans accès aux nouvelles tables — reproduirait exactement le « permission denied for schema public » de la clôture de PR-02 (`docs/carbonco/refonte/PR02C_RETIRE_ENSURE_SCHEMA_TRACEABILITY.md`).

**Ledger réel :** cette PR ne fait passer le ledger d'aucune base réelle à `applied` — `apply` n'est jamais exécuté par Claude. La procédure post-merge (§10) reste à exécuter par Ludo via `db-migrate.yml`.

---

## 4. Tables (migration 028)

| Table | Rôle | Champs distinctifs |
|---|---|---|
| `source_registry` | Registre des sources externes + droits de licence | `code` unique globalement (`company_id IS NULL`) ou par tenant (2 index partiels) ; 6 booléens de licence ; `source_type` contraint |
| `source_releases` | Release immuable d'une source | `status` (6 valeurs) ; `UNIQUE(source_id, release_key, checksum_sha256)` — idempotence de détection ; `supersedes_id` auto-référent |
| `evidence_artifacts` | Pièce brute (PDF/CSV/capture…) | `sha256` + `blob_key` (stockage `services.storage` existant) ; `sensitivity` (4 valeurs) |
| `ingestion_runs` | Exécution d'une détection/import | `idempotency_key` unique ; compteurs `detected/accepted/rejected/warning` ; `status` (7 valeurs) |
| `observations` | Fait normalisé, jamais modifié | au moins une valeur parmi `numeric_value`/`text_value`/`boolean_value` (CHECK) ; `confidence` ∈ [0,1] (CHECK) ; `data_status` (4 valeurs) ; `supersedes_id` auto-référent |
| `claim_evidence_links` | Lien preuve ↔ claim applicatif | `relation_type` (4 valeurs) — **schéma seul dans PR-03** : aucun service ni endpoint dédié (pas demandé par la mission ; futur consommateur probable : liens IRO, PR-10) |

Index : `company_id` sur les 6 tables, `source_id`/`source_release_id`/`status`/`checksum_sha256`/`idempotency_key` où pertinent, plus `(subject_type, subject_key, metric_code, observed_at DESC)` sur `observations` (motif de lecture principal, drill-down sujet→métrique).

---

## 5. RLS

Étend le pattern 009/027 (`ENABLE` + `FORCE` + `NULLIF(current_setting(...), '')::bigint` + `app.rls_bypass`) d'une clause de lecture globale — **nouveauté de ce noyau**, aucune table 001-027 n'a de notion de donnée globale :

| Commande | Règle |
|---|---|
| SELECT | `app.rls_bypass = 'on'` OU `company_id IS NULL` OU `company_id = current_company_id` |
| INSERT | `app.rls_bypass = 'on'` OU `company_id = current_company_id` (**jamais** `IS NULL` — un tenant ne crée jamais de ligne globale) |
| UPDATE/DELETE | même règle que INSERT, où applicable (voir §6 — certaines tables ajoutent un trigger d'immutabilité par-dessus) |

Chaque commande est une policy `FOR SELECT`/`FOR INSERT`/`FOR UPDATE`/`FOR DELETE` **explicite** (pas une policy `ALL` unique) : contrairement aux tables historiques, lecture et écriture n'ont pas la même expression ici (`WITH CHECK` ne doit jamais hériter de la clause `company_id IS NULL` de `USING`, sans quoi un tenant pourrait insérer une ligne globale).

Testé (`test_intelligence_sources.py::TestSourceRegistryRls`, répliqué dans les autres fichiers) : RLS+FORCE+policy présentes sur les 6 tables ; tenant A ne voit jamais les lignes de tenant B ; tenant voit les lignes globales ; tenant ne peut pas écrire une ligne globale (`company_id=NULL` rejeté) ; `app.rls_bypass` peut écrire une ligne globale.

---

## 6. Immutabilité

Une **fonction trigger générique unique**, documentée, paramétrée par mode (`TG_ARGV[0]`) plutôt que 3 fonctions dupliquées — `evidence_kernel_guard()` :

| Mode | Table | Règle |
|---|---|---|
| `frozen` | `observations` | Toute `UPDATE`/`DELETE` refusée sans exception — correction = nouvelle ligne + `supersedes_id` |
| `source_release` | `source_releases` | Transitions libres tant que `status ≠ 'published'` ; une fois `'published'`, seule la transition `status: published→superseded` (colonne `status` seule modifiée) reste permise ; `'superseded'` est ensuite gelé à son tour ; `DELETE` toujours refusé (registre append-only) |
| `evidence_artifact` | `evidence_artifacts` | `DELETE` et modification de `sha256`/`blob_key` refusés si l'artefact est référencé par ≥1 `observations`/`claim_evidence_links` ; les colonnes descriptives (`page_reference`…) restent librement modifiables même référencé |

RLS reste **permissive** en écriture sur ces 3 tables (le tenant propriétaire peut *tenter* l'`UPDATE`/`DELETE`) — c'est le trigger qui refuse ensuite avec un message explicite (`evidence_kernel: ...`). Sans ces policies RLS, la tentative serait filtrée silencieusement à 0 ligne au lieu de lever une erreur lisible.

---

## 7. Services (`apps/api/services/intelligence/`)

| Module | Responsabilité |
|---|---|
| `license_policy.py` | `evaluate(source) -> LicenseDecision` — pur, déterministe, aucun I/O, aucun LLM. Raisons/avertissements structurés, jamais un booléen nu |
| `source_service.py` | CRUD tenant (`create/get/list/update/deactivate`), lecture globale, unicité de code (`ON CONFLICT` ciblant l'index partiel tenant) |
| `release_service.py` | `detect_release` (idempotent), `validate_release`, `publish_release` (gate licence → `published`/`blocked_license`), `supersede_release` |
| `artifact_service.py` | `register_artifact` (SHA-256 + `services.storage.get_storage()` existant, pas de nouvel uploader), `get_artifact` |
| `ingestion_service.py` | `start_run` (idempotent), `update_run` (compteurs, garde d'état terminal), `fail_run` |
| `observation_service.py` | `create_observation` (validation valeur + FK), `correct_observation` (supersession), `list_observations` |

Chaque module expose une exception dédiée (`SourceError`, `ReleaseError`, `ArtifactError`, `IngestionError`, `ObservationError`) — le routeur traduit en HTTP par un seul helper partagé (`_http_error`, dispatch sur le contenu du message : « introuvable » → 404, « requis/requise » → 400, sinon 409), même principe que `evidence_service.EvidenceError` existant (une exception, le routeur décide par contexte).

---

## 8. API (`apps/api/routers/intelligence.py`, préfixe `/intelligence`)

| Endpoint | Permission |
|---|---|
| `GET /sources`, `GET /sources/{id}` | authentifié (`get_current_user`) |
| `POST /sources`, `PATCH /sources/{id}` | `require_analyst` |
| `GET /sources/{id}/releases`, `GET /releases/{id}` | authentifié |
| `POST /sources/{id}/releases` | `require_analyst` |
| `GET /ingestions`, `GET /ingestions/{id}` | authentifié (lecture seule — création réservée aux futurs adaptateurs, non exposée) |
| `GET /observations`, `GET /observations/{id}` | authentifié |
| `POST /observations` | `require_analyst` |

12 routes, exactement la liste de la mission. **Non construit (délibéré, mission)** : endpoint d'upload d'artefact public, endpoints de transition release (`validate`/`publish`/`supersede` — orchestrés uniquement en Python via `release_service`, testés directement, jamais exposés en HTTP dans PR-03), connecteur externe, opération globale (source/release `company_id IS NULL` — geste admin hors API dans cette PR).

Pagination : `limit`/`offset` (`Query(ge=1, le=200)`/`Query(ge=0)`, même contrat que `routers/facts.py`). Filtres observations : `subject_type`, `subject_key`, `metric_code`. Aucune URL signée permanente exposée ; 404 (jamais 403) sur une ressource hors périmètre tenant — pas de fuite d'existence cross-tenant.

---

## 9. Tests

| Fichier | Contenu | DB-gated |
|---|---|---|
| `tests/_intelligence_fixtures.py` | Pas un fichier de test — construit le schéma (`apply_ddl_inline` + `apply_upto("028")`, fichiers `.sql` réels) et 2 companies de test (`ek-test-a/b`) avec cleanup. Fixtures `evidence_kernel_schema`/`two_companies` exposées via `conftest.py` (voir note ci-dessous) | — |
| `test_intelligence_sources.py` | `license_policy` (6 cas, **purs, jamais skippés**) ; CRUD source + RLS globale/tenant (12 cas DB-gated) | Partiel |
| `test_intelligence_releases.py` | Cycle de vie release (detect/validate/publish/supersede, licence bloquante, immutabilité UPDATE/DELETE, idempotence brute) ; `ingestion_runs` (idempotence, compteurs, garde terminale) — 15 cas | Oui |
| `test_intelligence_observations.py` | Création/validation valeur/confidence, correction par supersession, immutabilité, RLS ; `evidence_artifacts` (SHA-256, immutabilité conditionnelle) — 17 cas | Oui |
| `test_intelligence_api.py` | Auth requise, permissions analyst/viewer, pagination, isolation tenant de bout en bout (JWT mintés directement via `create_access_token`, deux `company_id` distincts), 404 sans fuite, filtres observations — 10 cas | Oui |
| `test_migration_runner.py` | Étendu : corpus réel passe à 29 fichiers (`test_build_plan_against_real_migrations_directory` mis à jour) ; nouveau test `test_build_plan_detects_028_pending_on_baselined_027_ledger` (028 = `apply` sur un ledger baseliné à 027, jamais `skip`/bloquée) | Non (mocké) |

**Note technique — piège pyflakes trouvé pendant l'implémentation** : importer directement une fixture pytest (`two_companies`) dans chaque fichier `test_intelligence_*.py` déclenche un faux positif `ruff`/pyflakes F811 (« redefined while unused ») sur **chaque** méthode de test qui la reçoit en paramètre — 56 erreurs à la première passe de `ruff check`. `test_rls_isolation.py` n'a jamais ce problème car il définit ses fixtures localement (pas d'import). **Corrigé** : `two_companies`/`evidence_kernel_schema` sont désormais importées une seule fois dans `tests/conftest.py` (déjà `# noqa` pour l'import "inutilisé" au sens statique) — disponibles à tous les fichiers de test sans import explicite, donc sans nom à « redéfinir ». `insert_source`/`make_source` (fonctions normales, jamais des paramètres de fixture) restent importées directement où utilisées.

**RLS et immutabilité testées à la fois via les services ET en SQL direct** (`get_db(company_id=...)` + `cur.execute(...)`, `pytest.raises(Exception, match="evidence_kernel")`) — le service n'orchestre que des transitions déjà légales pour le trigger ; les tests SQL directs prouvent que le trigger protège même en contournant le service.

**Tests PostgreSQL jamais exécutés localement** (pas de `docker` disponible dans ce shell Windows — contrainte confirmée à l'identique depuis PR-02A/B/C, voir mémoire projet). La CI (`migration-tests`, conteneur `postgres:16`) est la seule preuve réelle de correction de la migration 028, des triggers et des policies RLS — à surveiller au premier run, comme pour chaque tranche précédente de ce chantier.

---

## 10. Commandes exécutées et résultats

| Commande | Résultat |
|---|---|
| `cd apps/api && python -m py_compile db/migration_manifest.py services/intelligence/*.py routers/intelligence.py` | OK |
| `python -m pytest -q tests/test_intelligence_sources.py tests/test_intelligence_releases.py tests/test_intelligence_observations.py tests/test_intelligence_api.py tests/test_migration_runner.py` | **31 passed, 59 skipped** (skips = DB-gated, pas de Postgres local) |
| `ruff check . --select=E,F,I --ignore=E501` | **All checks passed** (après correction du faux positif F811, §9) |
| `python -c "from main import app; print('routes', len(app.routes))"` | OK — **200 routes** (188 avant PR-03 + 12 nouvelles `/intelligence/*`) |
| `git diff --check` (racine) | Aucune erreur whitespace |
| `python -m pytest -q --ignore=tests/test_health_storage_probe.py` (suite complète, vérification supplémentaire) | **623 passed** (616 avant PR-03 + 7 nouveaux tests non-DB-gated), **195 skipped** (134 + 61 nouveaux DB-gated), **5 failed** — mêmes échecs pré-existants (`ModuleNotFoundError: vercel`), **zéro régression** |

Aucune migration exécutée contre une base réelle. Aucune connexion Neon établie. Aucune donnée métier touchée.

---

## 11. Limites

- **Aucun test PostgreSQL/RLS/trigger exécuté en conditions réelles** (contrainte docker, cf. §9) — la relecture attentive du SQL (idempotence, policies, fonction trigger) n'a, par expérience directe de ce chantier (PR-02B §11-12), pas toujours suffi à éviter un bug réel au premier passage CI. Prévoir un aller-retour CI, comme systématiquement depuis PR-02A.
- **`claim_evidence_links`** : schéma + RLS livrés, mais aucun service ni endpoint — en attente d'un consommateur réel (probablement les liens IRO, PR-10 selon `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §15).
- **Pas d'endpoint de transition release** (`validate`/`publish`/`supersede`) — orchestré uniquement côté service Python, testé directement ; l'exposition HTTP (si souhaitée) est un choix pour une PR ultérieure, pas un oubli (mission : « ne crée pas encore … endpoint de publication automatique »).
- **Pas d'endpoint d'upload d'artefact** — `artifact_service.register_artifact` existe et est testé, mais n'est appelable aujourd'hui que depuis du code Python (futurs adaptateurs), pas via HTTP.
- **`ingestion_runs`** n'a pas de garde d'immutabilité au niveau trigger (contrairement à `source_releases`/`observations`/`evidence_artifacts`) — décision délibérée : la mission ne liste que ces 3 tables dans sa section « Immutabilité » ; les transitions de run restent contrôlées uniquement côté Python (`_TERMINAL_STATUSES`).
- **`source_type`/`sensitivity`/etc. sont des `TEXT` + `CHECK`**, pas des types ENUM PostgreSQL natifs — choix cohérent avec toutes les migrations 001-027 de ce dépôt (`status TEXT ... CHECK (status IN (...))` partout), pas une simplification propre à PR-03.

---

## 12. Éléments reportés à PR-04

D'après `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §20 (Phase 3 — « Registre de sources et premier import maîtrisé ») :

- CLI d'import de release, fixtures, source démo `CARBONCO_DEMO_SNAPSHOT`.
- Migration du snapshot actuel `/materials` vers une release `estimated` réelle (source+release enregistrées).
- Page interne de gestion des sources (feature flag BETA).
- Interface `SourceAdapter` + `FakeAdapter` (aucun adaptateur réel dans PR-03, conforme à la mission).
- Événements Inngest (`intelligence.source.check.requested`, etc.) — aucun événement câblé dans PR-03.
- Composants UI transverses (`DataStatusBadge`, `SourceDrawer`, `EvidenceList`…) — hors périmètre PR-03 (« aucune interface frontend »).
- Endpoints de transition release et d'upload d'artefact (§11 ci-dessus) si un besoin réel se confirme.

---

## 13. Confirmations explicites

- **Aucune source externe réelle n'a été ingérée.** Aucun appel réseau sortant dans le code de PR-03 (`services/intelligence/`, `routers/intelligence.py`) — vérifié par recherche de `requests.`/`httpx.`/`urllib.request`/`urlopen(` : zéro occurrence. Les seules données créées dans les tests sont synthétiques (`ek-test-a`/`ek-test-b`, sources/releases/observations fictives).
- **Aucun LLM n'est utilisé.** `license_policy.evaluate()` est une fonction pure (booléens en entrée, booléens + raisons structurées en sortie) — aucun appel à un modèle de langage, nulle part dans PR-03. Conforme à `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §16.2 (« aucun calcul métier par l'IA »).
- **Aucune migration exécutée contre Neon ou toute base réelle** — seuls `py_compile`, `pytest` (DB-gated tests tous skippés localement) et `ruff` ont tourné.
- **Les 27 fichiers `.sql` historiques (001-027) non modifiés** — seul un nouveau fichier `028_evidence_kernel.sql` a été ajouté.
- **`apps/carbon` non touché** — périmètre strictement `apps/api` + `docs/`.
- **CLI de migration et workflow `db-migrate.yml` non modifiés** — `028` suit exactement le même chemin que 001-027 (découverte automatique par `MigrationRunner.discover_migrations()`, aucun code spécifique à écrire dans le runner).
- **PR non mergée automatiquement.**

---

## 14. Procédure opérationnelle après merge (Ludo, hors code)

La migration 028 doit être appliquée **exclusivement** via le chemin déjà en place depuis la clôture de PR-02 (`docs/carbonco/MIGRATIONS_RUNBOOK.md`) :

1. **Backup** — déclencher `backup.yml` avant toute écriture (même discipline que le runbook §5).
2. GitHub → Actions → **DB Migrate** → `command=plan` → confirmer que `028` apparaît en action `apply`, seule version pending (le reste doit rester `skip`, déjà baseliné).
3. `command=apply` → exécute `028_evidence_kernel.sql` dans une transaction dédiée ; ligne `applied` écrite après `COMMIT` (I1, `apply_one`).
4. `command=verify` → doit répondre `{"anomalies": []}` — exerce la nouvelle sonde `_probe_028` (table+RLS+triggers).
5. `GET /health/schema` → attendu `schema_version: "028", up_to_date: true, pending_count: 0, manual_required_count: 0`.
6. Vérification applicative : un endpoint représentatif répond normalement (ex. `GET /intelligence/sources` avec un JWT valide → 200, liste vide).
7. Observation 24-48h des logs structurés — confirmer l'absence d'anomalie (permissions `carbonco_app` sur les nouvelles tables notamment, cf. §3).
8. Consigner date + acteur dans `MIGRATIONS_RUNBOOK.md` §9 (même discipline que les migrations précédentes).

**Ne pas lancer `apply` avant que `plan` confirme exactement 028 en pending** (aucun écart avec l'inventaire de cette traçabilité).
