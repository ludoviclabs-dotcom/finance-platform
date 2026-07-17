# PR-02 — `feat/schema-migration-ledger` · Plan d'architecture

**Phase :** architecture uniquement. Aucun fichier applicatif modifié, aucune migration créée ou exécutée, aucune base touchée, rien commité ni poussé.
**Base analysée :** `apps/api` sur `master` — PR-01 terminée, PR #92/#93/#94 toutes fusionnées (dernier commit `a4ab497`, merge de PR #94, sans rapport avec `apps/api`).
**Worktree de rédaction :** `C:\Users\Ludo\finance-platform\.claude\worktrees\schema-migration-ledger`, branche `feat/schema-migration-ledger` (créée depuis `master` à jour, aucun commit dessus à ce stade).
**Documents source :** `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md` §5 et §25, `PROMPT_CLAUDE_CODE_PR02_MIGRATION_LEDGER.md` (prompt déjà rédigé dans le repo pour cet epic — traité comme antécédent direct, pas comme redondance), `PR01_TRACEABILITY.md`, `PR01_POST_MERGE_AUDIT.md`. Aucun `DECISIONS.md` ni `IMPLEMENTATION_LOG.md` trouvé dans `docs/carbonco/refonte/`.

> **Périmètre immédiat autorisé — à ne jamais perdre de vue en lisant ce qui suit.**
> PR-02 est découpée en **PR-02A / PR-02B / PR-02C** (détail §21). **Seule PR-02A peut démarrer ensuite**, et seulement sur validation explicite (« go PR-02 » ou équivalent — jamais présumée par ce document). PR-02A :
> - ne touche **jamais** la production ;
> - ne retire **pas** `ensure_schema_mw` (ça reste actif et seul mécanisme de prod jusqu'à PR-02C) ;
> - ne crée **aucune table** en base, sur aucun environnement ;
> - produit **uniquement** : découverte de fichiers, modèle (`MigrationFile`/`MigrationRecord`/`MigrationPlan`), checksum, planificateur (`build_plan`), et leurs tests **unitaires** — rien d'autre.
>
> Les décisions **D-1 à D-5** (`PR02_DECISIONS.md`) doivent être validées par Ludo avant tout démarrage de PR-02B ou PR-02C. **D-3 est résolue** (2026-07-17, vérifiée en lecture seule sur Neon production) : 004 et 009 sont toutes deux réellement actives en prod (`relforcerowsecurity=true` sur les 5 tables), à baseliner `baseline`/`requires_owner=false`. **D-1, D-2, D-4, D-5 restent ouvertes.**

---

## 1. Résumé exécutif

### Problème actuel

Il n'existe **aucun registre des migrations appliquées**. Le seul signal de « schéma complet » est l'existence d'une unique table (`sites`, créée par la migration 027). Deux mécanismes de gating manuel sont codés en dur et invisibles depuis le dossier `apps/api/db/migrations/` :

- `MANUAL_ONLY_PREFIXES = {"004"}` — toujours exclue de l'exécution automatique.
- Ajout conditionnel de `"009"` à cette même liste si `RLS_FORCE != "1"`.

Le seul déclencheur fiable en production Vercel (`ensure_schema()`, via un middleware HTTP) applique les migrations **pendant la première requête utilisateur** de chaque cold start — exactement le scénario que le futur système doit interdire. Chaque fichier de migration échoué est **avalé silencieusement** (`try/except` + `logger.warning`, la boucle continue). La migration 027 a dû être appliquée **manuellement** dans le Neon SQL Editor en production (incident découvert le 04/07/2026, documenté dans les commentaires de `migrations.py`), sans aucune trace d'audit formelle (qui, quand, preuve).

`AUTO_MIGRATE` — le flag central de la cible décrite dans les documents de planification — **n'existe nulle part dans le code actuel** ; il n'apparaît que dans les documents de planification eux-mêmes. C'est un flag entièrement nouveau à introduire, pas un comportement existant à modifier.

### Risques

1. Un schéma de production a déjà été incomplet pendant une période non déterminée avant la découverte du 04/07/2026 (aucune migration 001-026 ne s'appliquait automatiquement, faute de support des events lifespan ASGI par `@vercel/python`).
2. Un échec silencieux sur une migration intermédiaire (ex. 015) n'empêche pas la boucle de continuer jusqu'à 027 — un schéma peut être « presque complet » sans que rien ne le signale.
3. Aucune protection de concurrence entre process serverless (le flag `_schema_ensured` ne protège qu'à l'intérieur d'un seul process).
4. Aucun moyen de détecter qu'un fichier de migration déjà appliqué a été modifié après coup (pas de checksum).
5. Toute migration future (PR-03 Evidence Kernel et au-delà) hériterait des mêmes angles morts si le runner n'est pas remplacé avant.

### Architecture proposée

Un ledger `schema_migrations`, une découverte de fichiers déterministe avec checksum SHA-256, un plan calculé avant toute exécution, un advisory lock PostgreSQL, une transaction par migration, un statut `requires_owner` explicite et visible dans le plan (jamais caché dans une liste Python), une baseline qui **vérifie objet par objet** plutôt que de faire confiance à l'historique, un CLI complet (`status`/`plan`/`apply`/`verify`/`baseline`/`mark-applied`), un endpoint `GET /health/schema` minimal et public + diagnostic détaillé réservé au CLI, un workflow GitHub Actions manuel et protégé.

### Bénéfices

Visibilité totale et vérifiable de l'état du schéma ; élimination des deux mécanismes de gating cachés actuels ; protection contre la modification silencieuse d'une migration déjà appliquée ; protection contre l'exécution concurrente ; un seul mécanisme pour base neuve, base partielle et production existante ; fondation stable pour PR-03 (Evidence Kernel) et suivantes sans retoucher le runner.

### Périmètre

`apps/api/db/` (nouveau runner, CLI, manifest de métadonnées), un nouveau workflow `.github/workflows/db-migrate.yml`, un endpoint `/health/schema`, une stratégie de bootstrap du ledger lui-même, une documentation opérationnelle (`MIGRATIONS_RUNBOOK.md`).

### Hors périmètre

Aucune modification du contenu SQL des 27 migrations existantes (001-027 + 008b) — uniquement leur enregistrement dans le ledger. Aucune nouvelle table métier (Evidence Kernel = PR-03). Aucune migration de la base de production pendant cette phase d'architecture. Le retrait du déclencheur `ensure_schema_mw` (middleware de requête) n'intervient qu'en fin de rollout (PR-02C, §21), pas immédiatement — le système actuel et le nouveau doivent pouvoir coexister le temps de la validation.

---

## 2. Cartographie de l'existant

| Mécanisme | Fichier | Comportement | Environnement | Risque | Décision proposée |
|---|---|---|---|---|---|
| `DDL` (constante inline) | `apps/api/db/migrations.py:24-157` | Bloc SQL brut créant 6 tables historiques (`companies`, `users`, `refresh_tokens`, `snapshots`, `audit_events`, `products`, `alert_rules`) via `CREATE TABLE IF NOT EXISTS`, ré-exécuté à **chaque** appel de `run_migrations()` | Tous | Aucune trace de version ; indiscernable des fichiers numérotés pour le futur ledger si on ne l'y intègre pas explicitement | Baseline implicite (`version="000"` ou équivalent), jamais ré-exécuté après enregistrement |
| `run_migrations()` | `migrations.py:160-218` | Exécute le DDL inline puis boucle sur `sorted(migrations_dir.glob("*.sql"))`, saute `MANUAL_ONLY_PREFIXES`, exécute chaque fichier dans un `try/except` qui avale l'erreur | Tous | Erreur silencieuse ; tri lexicographique fragile ; deux mécanismes de gating invisibles | Remplacé par `MigrationRunner.apply_plan()` — échec strict, checksum, statut `requires_owner` déclaratif |
| `ensure_schema()` + `_SENTINEL_TABLE = "sites"` | `migrations.py:231-268` | Sonde unique `to_regclass('public.sites')` ; si présent → no-op ; sinon → `run_migrations()` | Prod (seul chemin fiable sur Vercel Python) | Une seule table représente la complétude de 28 fichiers ; ne détecte pas un échec intermédiaire | Remplacé par un plan basé sur `schema_migrations` ; `/health/schema` donne l'état réel |
| `@app.on_event("startup")` | `main.py:104-106` | Appelle `run_migrations()` | Local/uvicorn **uniquement** — ne se déclenche jamais sur `@vercel/python` (constaté en prod, incident du 04/07/2026) | Dépendance à un mécanisme mort en prod | Conservé en local pour la CLI `apply` ; jamais le seul chemin de prod |
| `ensure_schema_mw` (middleware HTTP) | `main.py:111-116` | Appelle `ensure_schema()` hors event-loop (`run_in_threadpool`) à la 1ʳᵉ requête si `_schema_ensured` est `False` | Prod (**seul** déclencheur réel aujourd'hui) | Applique potentiellement des migrations **pendant une requête utilisateur réelle** | Retiré en PR-02C une fois le workflow manuel validé ; remplacé par une vérification lecture-seule (log si en retard, jamais d'apply) |
| `MANUAL_ONLY_PREFIXES = {"004"}` | `migrations.py:195` | Liste Python codée en dur, jamais exécutée automatiquement | Tous | Invisible depuis le dossier `migrations/` ; aucune raison affichée | Remplacé par un manifeste déclaratif (`requires_owner`/`manual`), visible dans le `plan` |
| Gating conditionnel de 009 | `migrations.py:196-200` | Ajoute `"009"` à `MANUAL_ONLY_PREFIXES` si `RLS_FORCE != "1"` | Tous | Deuxième mécanisme caché, cette fois basé sur une variable d'environnement | Unifié dans le même manifeste déclaratif que 004 |
| `try/except` par fichier | `migrations.py:208-215` | `logger.warning` + `continue` vers le fichier suivant | Tous | Un schéma peut finir dans un état partiel non détecté | Arrêt strict sur erreur (contrainte #2) |
| `get_db()` | `database.py:51-72` | Une connexion psycopg2 par appel, `autocommit=False`, commit en sortie normale / rollback sur exception, connexion fermée à chaque fois | Tous | Chaque fichier obtient sa **propre** connexion — pas de transaction globale ; propriété émergente, non documentée | Formalisé : une transaction par migration, sur une connexion **unique** tenue ouverte pendant tout `apply_plan()` (voir §10-11) |
| Table sentinelle `sites` (027) | `migrations.py:240` | `to_regclass('public.sites')` | Prod | Un seul point de défaillance pour 28 fichiers ; 027 elle-même a un `ALTER TABLE` qui échoue sans le rôle propriétaire | Remplacé par ledger multi-lignes vérifié objet par objet |
| Application manuelle de 027 | Commentaires `migrations.py:233-239` + `027_sites.sql:1-16` | Documentée en commentaire, aucune trace formelle (pas d'entrée d'audit, pas de « qui/quand/preuve ») | Prod | Aucune preuve d'application autre que « la table existe » | `mark-manual-verified` avec `applied_by` + preuve (contrainte #6) |
| RLS 004/009 — statut réel **confirmé** (D-3, 17/07/2026) | `migrations.py:195-200`, `test_rls_isolation.py` | Le gating dit « jamais auto-appliquée », mais vérification Neon en lecture seule confirme `relforcerowsecurity=true` sur les 5 tables — 009 a été appliquée manuellement, 004 supersédée fonctionnellement | Prod (confirmé) | Baseliner 004 ET 009 en `baseline`/`requires_owner=false` | Vérifier `pg_class.relforcerowsecurity=true` pendant le calcul de baseline (test déjà exécuté manuellement, à reproduire dans `verify_migration_objects`) |
| Duplication de bootstrap | `seed_factors.py:702-721`, `seed_emission_factors.py:159-171` | Chacun réimplémente indépendamment `to_regclass` + lecture/exécution inline de `001_emission_factors.sql` | Scripts admin | Deux implémentations différentes du même bootstrap, dérive possible | Hors périmètre strict PR-02 ; signalé pour un futur nettoyage (ces scripts devraient appeler le nouveau runner) |
| `seed_admin.py` appelle `run_migrations()` sans sentinelle | `seed_admin.py:34-35` | Ré-exécute toute la boucle à chaque lancement | Scripts admin | Deviendra dangereux avec l'arrêt strict sur erreur si une migration attend une action manuelle non faite | À migrer vers `MigrationRunner.apply_plan()` en dehors du périmètre strict PR-02, mais à documenter comme dépendance |

---

## 3. Inventaire des migrations historiques

**28 fichiers** dans `apps/api/db/migrations/` (27 numéros de séquence 001-027, plus `008b` insérée entre 008 et 009 — jamais renumérotée, traitée telle quelle). Aucun fichier au-delà de 027.

| Version | Fichier | Objets attendus | Transactionnelle | Idempotente | RLS | `requires_owner` | Vérification possible | Statut baseline pressenti |
|---|---|---|---|---|---|---|---|---|
| 001 | `001_emission_factors.sql` | `emission_factors` (+ 3 index) | Dépend du runner | Oui (`IF NOT EXISTS`) | Non | Non | `to_regclass('public.emission_factors')` | `baseline` |
| 002 | `002_facts_events.sql` | `facts_events` (+ 3 index) | Dépend du runner | Oui | Non | Non | `to_regclass('public.facts_events')` | `baseline` |
| 003 | `003_facts_current.sql` | Vue matérialisée `facts_current` (+ index unique) | Dépend du runner | Oui | Non | Non | `to_regclass('public.facts_current')` | `baseline` |
| 004 | `004_rls_policies.sql` | RLS (ENABLE + policies) sur `snapshots`, `facts_events`, `audit_events`, `alert_rules`, `products` | Dépend du runner | Oui (`DO $$ IF NOT EXISTS pg_policies`) | **Oui**, dense | Non (D-3 résolue : aucune des 5 tables n'a de mur de privilège) | `SELECT * FROM pg_policies WHERE tablename IN (...)` | `baseline` — **confirmé en prod le 17/07/2026** (fonctionnellement supersédée par 009, voir D-3) |
| 005 | `005_audit_hash_columns.sql` | `audit_events` += `hash_prev`, `hash_self` (+ index) | Dépend du runner | Oui | Non | Non | `information_schema.columns` sur `audit_events` | `baseline` |
| 006 | `006_datapoint_reviews.sql` | Type `datapoint_status`, table `datapoint_reviews` (+ 4 index) | Dépend du runner | Oui | Non | Non | `to_regclass('public.datapoint_reviews')` | `baseline` |
| 007 | `007_export_packages.sql` | `export_packages` (+ 3 index) | Dépend du runner | Oui | Non | Non | `to_regclass('public.export_packages')` | `baseline` |
| 008 | `008_suppliers.sql` | `suppliers`, `supplier_questionnaire_tokens`, `supplier_answers`, `materialite_positions` (+ 7 index) | Dépend du runner | Oui | Non (arrive en 008b) | Non | `to_regclass` ×4 | `baseline` |
| 008b | `008b_rls_suppliers.sql` | RLS sur les 4 tables de 008 ; fonction `resolve_supplier_token()` (`SECURITY DEFINER`) | Dépend du runner | Oui | **Oui** + bypass documenté | Non (SECURITY DEFINER ≠ privilège propriétaire) | `pg_policies` + `pg_proc` | `baseline` |
| 009 | `009_rls_force.sql` | `FORCE ROW LEVEL SECURITY` + policies bypass-aware sur les 5 tables de 004 | Dépend du runner + gaté par `RLS_FORCE=1` | **Non** (idempotence via `DROP POLICY IF EXISTS` + `CREATE`) | **Oui**, le plus dense | Non | `pg_policies` + `relforcerowsecurity` dans `pg_class` | `baseline` — **confirmé en prod le 17/07/2026** (`relforcerowsecurity=true` sur les 5 tables — appliquée manuellement malgré le gate `RLS_FORCE`, voir D-3) |
| 010 | `010_ingest_jobs.sql` | `ingest_jobs` (+ index, RLS ENABLE seul) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 011 | `011_totp.sql` | `user_totp`, `user_recovery_codes` ; `companies` += `totp_policy` ; contrainte élargie | Dépend du runner | Oui (`DROP CONSTRAINT IF EXISTS` + `ADD`) | Non | Non | `to_regclass` ×2 + `information_schema` | `baseline` |
| 012 | `012_auditor_invites.sql` | `auditor_invites` ; fonctions `resolve_auditor_token`, `touch_auditor_token` (`SECURITY DEFINER`) | Dépend du runner | Oui | Oui + bypass SECURITY DEFINER | Non | `to_regclass` + `pg_proc` | `baseline` |
| 013 | `013_chain_verifications.sql` | `chain_verifications` (+ index, RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 014 | `014_vsme_datapoints.sql` | `vsme_datapoints` (catalogue global) | Dépend du runner | Oui | Non (délibéré — référentiel global) | Non | `to_regclass` | `baseline` |
| 015 | `015_vsme_field_values.sql` | `vsme_field_values` (+ index, RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 016 | `016_vsme_wizard.sql` | `vsme_wizard_sessions` (RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 017 | `017_fec_screening.sql` | `fec_screenings` (+ index, RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 018 | `018_company_consolidation.sql` | `companies` += `parent_id`/`ownership_pct`/`consolidation_approach` ; `perimeter_events` (RLS, pas de RLS récursive sur `companies`) | Dépend du runner | Oui | Oui sur `perimeter_events` | Non | `information_schema` + `to_regclass` | `baseline` |
| 019 | `019_baselines.sql` | `baselines`, `recalc_events` (+ index, RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` ×2 + `pg_policies` | `baseline` |
| 020 | `020_actions.sql` | `actions`, `action_events` (+ index, RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` ×2 + `pg_policies` | `baseline` |
| 021 | `021_alert_rules_notifications.sql` | `alert_rules` += `mode` ; `alert_notifications` (RLS) — **collision documentée avec le DDL inline historique** | Dépend du runner | Oui (`DO $$` guards) | Oui | Non | `information_schema` + `to_regclass` + `pg_policies` | `baseline` (voir note ci-dessous) |
| 022 | `022_import_screenings.sql` | `import_screenings` (+ index, RLS) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 023 | `023_beges_filings.sql` | `beges_filings` (+ index, RLS incl. DELETE) | Dépend du runner | Oui | Oui | Non | `to_regclass` + `pg_policies` | `baseline` |
| 024 | `024_supplier_campaigns.sql` | `supplier_campaigns` ; `supplier_questionnaire_tokens`/`supplier_answers` += colonnes ; fonction `mark_supplier_token_viewed` (`SECURITY DEFINER`, RLS incl. DELETE) | Dépend du runner | Oui | Oui + SECURITY DEFINER | Non | `to_regclass` + `information_schema` + `pg_proc` + `pg_policies` | `baseline` |
| 025 | `025_materialite_assessments.sql` | `materialite_positions` += `justification` ; `materialite_assessments` (RLS select+insert seulement) | Dépend du runner | Oui | Oui | Non | `information_schema` + `to_regclass` + `pg_policies` | `baseline` |
| 026 | `026_partner_applications.sql` | `partner_applications` (donnée plateforme, pas de RLS délibéré) | Dépend du runner | Oui | Non (délibéré) | Non | `to_regclass` | `baseline` |
| 027 | `027_sites.sql` | `sites` (+ index) ; `actions` += `site_id` ; RLS ENABLE+FORCE ; `GRANT` conditionnel à `carbonco_app` | Dépend du runner, **mais application auto réelle impossible** en prod (voir ci-dessous) | Oui (sauf le bloc `GRANT`, gardé par `IF EXISTS` sur `pg_roles`) | **Oui**, pattern le plus strict | **OUI, structurel et non ambigu** | `to_regclass('public.sites')` + `information_schema.columns` sur `actions.site_id` + `relforcerowsecurity` | `baseline` (déjà appliquée manuellement, 04/07/2026 — **preuve à formaliser via `mark-manual-verified`**) |

**Note 021** : le fichier documente lui-même une collision avec le `DDL` inline historique de `migrations.py` (qui crée déjà `alert_rules` avec un schéma différent) — son `CREATE TABLE IF NOT EXISTS alert_rules` est donc un no-op, et les `ALTER TABLE` qui suivent sont ce qui « met réellement à niveau » la table créée par l'autre mécanisme. Ce couplage entre le DDL inline (non versionné) et une migration numérotée est un signal supplémentaire en faveur de traiter le DDL inline comme une baseline formelle version `000` (§6), sans quoi 021 ne peut pas être vérifiée indépendamment.

**Constat transversal** (vérifié par grep exhaustif sur les 28 fichiers) : aucun `CREATE EXTENSION`, aucun `OWNER TO`, aucun `ALTER DEFAULT PRIVILEGES`, aucun `DROP TABLE/COLUMN/TYPE/INDEX` nulle part. Le seul `GRANT` de tout le corpus est dans 027. `SECURITY DEFINER` apparaît dans 3 fichiers (008b, 012, 024) — ce n'est **pas** un cas `requires_owner` (une fonction `SECURITY DEFINER` ne nécessite que le privilège `CREATE FUNCTION` standard du rôle propriétaire du schéma, pas la propriété d'une table tierce). Seule 027 nécessite un privilège que le rôle applicatif (`carbonco_app`) ne possède pas nativement (`ALTER TABLE actions`, table historiquement possédée par `neondb_owner`).

---

## 4. Invariants du futur runner

Garanties techniques que le code devra respecter, avec leur condition d'arrêt associée :

| # | Invariant | Condition d'arrêt si violé |
|---|---|---|
| I1 | Toute migration exécutée avec succès est enregistrée dans `schema_migrations` **après** COMMIT, jamais avant | Si le process meurt entre COMMIT et l'écriture du ledger, `verify` doit détecter l'incohérence (objet présent, ligne absente) au prochain `plan` |
| I2 | Le checksum d'un fichier déjà marqué `applied` ou `baseline` est comparé à chaque `plan`/`status` | `ChecksumMismatchError` — bloque tout `apply` tant que non résolu manuellement |
| I3 | Un `apply` ne démarre qu'après acquisition de l'advisory lock | `MigrationLockError` si le lock est déjà détenu, avec retry borné puis abandon propre |
| I4 | Une migration `requires_owner` n'est **jamais** exécutée par `apply` — seulement listée dans le `plan` avec son statut | `ManualMigrationRequired` levée si `apply` est invoquée sur un plan qui en contient sans `--skip-manual` explicite |
| I5 | Une migration échouée est enregistrée `status='failed'` avec `error_message`, jamais `applied` | Arrêt immédiat de `apply_plan()` — les migrations suivantes du plan ne sont pas tentées |
| I6 | `baseline` ne marque `status='baseline'` que pour les versions dont les objets attendus sont **vérifiés présents** | Toute version non vérifiable reste `pending`/`manual_required` — jamais de baseline aveugle |
| I7 | `mark-applied`/`mark-manual-verified` exige un `applied_by` et une preuve (texte libre : commande exécutée, capture, ticket) | Refus de la commande sans ces deux champs |
| I8 | Le runner ne dépend jamais du RLS tenant pour fonctionner (contrainte #8) | Toutes les requêtes du runner s'exécutent via `get_db()` **sans** `company_id` (pas de `SET LOCAL app.current_company_id`) |
| I9 | Aucune migration n'est déclenchée par une requête HTTP entrante en production (contrainte non-négociable) | `AUTO_MIGRATE` reste à `0` en production ; seul le workflow GitHub manuel ou la CLI locale déclenchent `apply` |
| I10 | Le format d'un `MigrationPlan` est stable — les mêmes fichiers, dans le même état de ledger, produisent toujours le même plan (déterminisme, testable) | Tri par `(int(numéro), suffixe)`, jamais par ordre du système de fichiers brut |

---

## 5. Schéma de `schema_migrations`

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

Justification champ par champ :

- **`version` (PK, `TEXT` pas `INTEGER`)** — doit porter `"008b"` sans transformation. Une clé numérique forcerait un renommage que la contrainte #5 (« une base existante ne doit pas être baselineée aveuglément ») et la convention de fichiers (§7) interdisent.
- **`name`** — le nom de fichier complet (`008b_rls_suppliers.sql`), séparé de `version` pour permettre une recherche humaine sans reparser le nom.
- **`checksum_sha256`** — SHA-256 des octets bruts du fichier tel que commité (§7). Détecte toute modification post-application (I2).
- **`status`** — 4 valeurs persistées seulement (voir §9 pour la justification de ne pas en ajouter d'autres) : `applied` (migration 028+ appliquée par le nouveau runner), `baseline` (migration historique enregistrée après vérification d'objets, jamais réellement « appliquée » par ce runner), `failed` (tentative échouée, jamais retentée automatiquement), `manual_required` (déclarée `requires_owner`, en attente d'application humaine puis de `mark-applied`).
- **`applied_at`** — `NULL` tant que non appliqué/baseliné ; horodatage de la transaction réussie ou de la vérification de baseline.
- **`execution_ms`** — mesuré autour du `cur.execute(sql)` ; `NULL` pour les baselines (jamais réellement exécutées par ce runner).
- **`applied_by`** — acteur humain ou automatisé (ex. `"github-actions:db-migrate#run_id"`, `"ludo@manual-neon-editor"`) — obligatoire pour `manual_required → baseline`/`applied` (I7).
- **`requires_owner`** — déclaratif, lu depuis le manifeste (§7/§12), copié dans le ledger au moment de l'enregistrement pour historiser la décision même si le manifeste change plus tard.
- **`transactional`** — pareil, copié depuis le manifeste ; `TRUE` pour les 28 fichiers actuels (aucun n'a besoin de `CREATE INDEX CONCURRENTLY` ou équivalent), mais le champ doit exister dès le départ pour PR-08 (PostGIS) et au-delà.
- **`error_message`** — texte de l'exception si `status='failed'` ; `NULL` sinon.
- **`metadata` (`JSONB`)** — extensible sans migration du ledger lui-même (ex. durée du lock attendu, SHA du déploiement, notes de vérification de baseline).
- **`created_at`** — horodatage de la ligne elle-même (utile pour distinguer une ligne créée tardivement lors d'une baseline rétroactive de son `applied_at` réel).

**Clés et contraintes** : PK sur `version` uniquement (pas de clé composite — un seul enregistrement par version, pour toujours). Pas de `company_id` : table d'infrastructure globale (contrainte #7). **Index** : un seul sur `status`, pour que `plan`/`status` filtrent rapidement les lignes `manual_required`/`failed` sans scanner toute la table (qui restera de toute façon petite — quelques dizaines à centaines de lignes sur la durée de vie du projet). **Privilèges** : la table est créée par le même rôle qui exécute la baseline initiale (voir §6) ; le rôle applicatif (`carbonco_app`) a besoin de `SELECT`/`INSERT`/`UPDATE` (pas de `DELETE` — une ligne de ledger n'est jamais supprimée, seulement corrigée par une nouvelle commande explicite si vraiment nécessaire, hors périmètre normal).

---

## 6. Problème de bootstrap

**Comment créer `schema_migrations` avant que le ledger lui-même existe ?**

| Stratégie | Avantages | Inconvénients |
|---|---|---|
| Bootstrap DDL dans le code Python | Aucune dépendance de fichier ; toujours disponible | Dupliqué hors du dossier `migrations/` ; pas checksummable comme les autres fichiers ; incohérent avec « toute migration est un fichier discoverable » |
| Migration `000` spéciale (fichier `.sql`) | Cohérent avec le système de fichiers existant ; auto-documenté ; suit la même convention que 001+ | Problème circulaire apparent : comment checksummer/enregistrer 000 dans une table qui n'existe pas encore ? |
| Script administrateur séparé | Explicite, sous contrôle humain direct | Un mécanisme de plus à maintenir et à exécuter au bon moment ; risque d'oubli sur un nouvel environnement |
| Création manuelle (documentation seule) | Zéro code | Non reproductible, non testable, contraire à l'esprit de tout le chantier |

**Stratégie recommandée : migration `000` spéciale, traitée comme un cas particulier explicite dans `MigrationRunner`, pas comme une entrée normale du plan.**

Résolution de la circularité — ordre exact des opérations dans `apply()`/`baseline()` :

1. Acquérir l'advisory lock (§10). **Ceci ne dépend d'aucune table** — un advisory lock PostgreSQL est une primitive de session, indépendante du schéma. C'est ce qui rend l'étape suivante sûre entre process concurrents.
2. Sous ce lock, vérifier `to_regclass('public.schema_migrations')`.
3. Si absente : exécuter `000_schema_migrations_ledger.sql` (le DDL de §5) directement — **avant** tout calcul de checksum ou d'insertion de ligne pour elle-même. Ce fichier n'est **jamais** enregistré comme une ligne dans sa propre table (il n'a pas de « statut » — son existence EST la table). Le CLI le traite comme une étape d'amorçage implicite, documentée mais non listée dans `plan`/`status` au même titre que 001+.
4. Une fois la table présente (fraîchement créée ou déjà là), poursuivre normalement : découverte des fichiers 001+, calcul du plan, etc.
5. Libérer le lock en fin de run.

Le DDL inline historique (`DDL` dans `migrations.py`, tables `companies`/`users`/`refresh_tokens`/`snapshots`/`audit_events`/`products`/`alert_rules`) est traité séparément comme **baseline `version="000"`** dans le ledger lui-même (une ligne réelle, contrairement au bootstrap de la table de ledger) — c'est la baseline « socle historique » que §8 détaille. Ne pas confondre les deux « 000 » : le bootstrap de la table (étape technique, hors ledger) et la baseline du DDL inline historique (une ligne `version='000'` dans le ledger, désignant le socle applicatif).

---

## 7. Convention des fichiers

- **Regex de découverte** : `^(?P<num>\d{3})(?P<suffix>[a-z]?)_(?P<slug>[a-z0-9_]+)\.sql$` — capture `001`...`027` et `008b` sans ambiguïté. Tout fichier ne matchant pas ce motif est ignoré par la découverte et signalé comme avertissement par `status`/`plan` (pas une erreur bloquante, pour ne pas casser sur un fichier `README.md` ou `.gitkeep` dans le même dossier).
- **Ordre de tri** : clé explicite `(int(num), suffix or "")`, **jamais** un tri lexicographique brut de chaînes. Le comportement actuel (`sorted(glob("*.sql"))`) donne le bon ordre pour 008/008b/009 **par coïncidence ASCII** (`_` < `b` < `9` selon la position) — ce n'est pas un contrat garanti et doit devenir un test explicite (§22).
- **Prise en charge de `008b`** : traitée comme n'importe quelle version dans le ledger (`version TEXT`) ; jamais renommée en `0085` ou autre — la contrainte #5 et l'historique du projet l'interdisent.
- **Convention après 027** : strictement séquentielle, 3 chiffres, zéro-paddée (`028`, `029`, …). Le suffixe alphabétique (`008b`) reste un artefact historique unique, **pas un patron à reproduire**. Si un besoin d'insertion tardive se représente, la réponse recommandée est de renuméroter la PR en cours (pas encore mergée) plutôt que d'introduire un nouveau suffixe — un suffixe ne doit exister que pour un fichier déjà appliqué en production qu'on ne peut plus renuméroter.
- **Checksum sur octets bruts ou normalisés ?** — **Octets bruts**, tels que commités (pas de normalisation de fin de ligne, d'espaces ou d'encodage). Simplicité et absence d'ambiguïté sur ce que « normalisé » signifierait ; correspond à la façon dont git adresse déjà le contenu.
- **Politique de modification** : un fichier dont le `checksum_sha256` a une ligne dans `schema_migrations` (`applied`, `baseline` ou `manual_required` avec preuve) est **immuable**. Un besoin de correction crée un **nouveau fichier** (version suivante), jamais une édition du fichier existant (contrainte #1, invariant I2).
- **Politique de renommage** : jamais, pour un fichier déjà présent dans le ledger. Un fichier pas encore appliqué (statut `pending`, donc absent du ledger) peut en théorie être renommé avant sa première application — mais ce n'est pas recommandé une fois qu'une PR l'introduisant a été mergée, pour éviter toute confusion en review.

---

## 8. Stratégie de baseline

Traitement séparé par type de base, avec la même règle transversale : **le vérificateur d'objets fait toujours autorité, jamais l'hypothèse historique.**

| Cas | Comportement |
|---|---|
| **Base neuve** (aucune table applicative) | `baseline()` ne trouve aucun objet attendu pour 000-027 → toutes restent `pending`. `apply()` s'exécute normalement du bootstrap du ledger jusqu'à la dernière version, dans l'ordre. |
| **Base de test vide** (CI, conteneur éphémère) | Identique à « base neuve ». C'est le chemin que `api.yml` devrait emprunter s'il exécute un jour de vraies migrations (aujourd'hui il ne le fait jamais — voir §17). |
| **Base de développement partielle** | `baseline()` vérifie chaque version un par un ; celles dont les objets existent → `baseline` ; les autres → `pending`, puis `apply()` complète dans l'ordre. Un développeur peut ainsi rattraper une base locale désynchronisée sans intervention manuelle. |
| **Base preview** (Vercel preview deployments) | Traité comme « base de développement partielle » ou « base neuve » selon si la preview partage une base Neon dédiée ou une branche Neon éphémère — **Décision ouverte D-1** (dépend de l'infra Neon actuelle, non vérifiable pendant cette phase d'architecture sans toucher à un environnement réel). |
| **Production complète** (schéma actuel, 001-027 réputées présentes) | `baseline()` vérifie objet par objet (voir tableau ci-dessous) ; **ne marque jamais 001-027 en bloc**. Pour 004 et 009, la vérification interroge `pg_policies`/`pg_class.relforcerowsecurity` en plus de l'existence de table (ces migrations ne créent pas de nouvelle table, seulement des policies) — vérification déjà effectuée manuellement, D-3 résolue (§24). |
| **Production incomplète** (hypothèse à ne jamais exclure) | Même procédure que ci-dessus ; toute version dont l'objet est absent reste `pending`/`manual_required`, ce qui est **exactement le comportement souhaité** — le système ne doit jamais supposer une complétude non vérifiée. |
| **Migration 027 partielle** | Vérifier séparément `to_regclass('public.sites')` **et** `information_schema.columns` pour `actions.site_id` **et** `relforcerowsecurity` sur `sites` — un état où `sites` existe mais où `actions.site_id` est absent (ALTER TABLE échoué faute de privilège, CREATE TABLE réussi) doit être détecté comme partiel, pas comme baseline complète. |
| **Objets créés manuellement** (hors runner, ex. 027 via Neon SQL Editor) | Vérifiés identiquement aux objets créés automatiquement — le vérificateur ne fait pas la différence entre « créé par le runner » et « créé à la main » ; seule l'existence de l'objet compte pour la baseline. La provenance (manuel vs automatique) est capturée séparément via `applied_by`/`metadata`, pas via un statut distinct. |
| **Migration SQL appliquée mais non enregistrée** | C'est précisément le cas normal de **toute** la baseline actuelle (rien n'est enregistré aujourd'hui) — traité par la procédure de vérification objet par objet ci-dessus, pas comme une exception. |
| **Entrée enregistrée mais objet absent** | Ne peut survenir qu'après la mise en place du nouveau système (ex. un `mark-applied` erroné, ou un objet supprimé manuellement après coup) — `verify` doit le détecter et le signaler comme `drift_detected` (une **condition** de sortie de `verify`, pas un `status` persisté — voir §9) ; ne corrige jamais automatiquement, alerte seulement. |

**Procédure de vérification objet par objet** (utilisée par `baseline()` pour chaque version 000-027) : pour chaque version, la fonction `verify_migration_objects(version)` (§13) exécute une liste de sondes déclarées dans le manifeste (ex. `to_regclass('public.emission_factors')`, ou pour les migrations RLS-only, une requête sur `pg_policies`) ; toutes les sondes doivent réussir pour que la version passe `baseline` ; sinon elle reste dans un état à trancher manuellement.

---

## 9. États et planification

**États persistés** (colonne `status`, 4 valeurs — volontairement peu nombreuses) :

- `baseline` — enregistrée comme historiquement présente après vérification d'objets, jamais exécutée par ce runner.
- `applied` — exécutée avec succès par ce runner (028+ typiquement).
- `failed` — tentative échouée ; ne bloque pas indéfiniment mais nécessite une action (correction + nouvelle version, ou investigation).
- `manual_required` — déclarée `requires_owner=true`, en attente d'exécution humaine puis de `mark-applied`.

**États calculés, jamais persistés** (exposés par les commandes, pas par une colonne) :

- `pending` — absence de ligne dans le ledger pour un fichier découvert. Calculé par différence entre les fichiers découverts et les versions présentes dans `schema_migrations`, pas stocké (sinon il faudrait une ligne pour chaque fichier avant même sa première tentative, ce qui complique inutilement l'invariant « une ligne = une migration qui a eu une histoire réelle »).
- `checksum_mismatch` — condition détectée en comparant le SHA-256 actuel du fichier au `checksum_sha256` stocké pour une ligne `applied`/`baseline`. **Volontairement pas un statut** : une migration reste `applied` historiquement (on ne réécrit jamais silencieusement son passé, contrainte #1) ; le mismatch est un **avertissement de `plan`/`verify`**, pas une réécriture de `status`.
- `drift_detected` — condition détectée quand une ligne `applied`/`baseline` existe mais que l'objet attendu est absent (voir §8, dernier cas). Même logique : condition de sortie de `verify`, pas un statut stocké.

Cette séparation (4 statuts stockés + 3 conditions calculées) répond directement à la consigne « ne pas multiplier les états sans raison » : un statut stocké change l'histoire d'une ligne, une condition calculée ne fait que la commenter au moment du `verify`.

**Planification** — `MigrationPlan` (voir §13) est la sortie de `build_plan()`, calculée en confrontant : (a) les fichiers découverts et checksummés, (b) le contenu actuel de `schema_migrations`, (c) le manifeste de métadonnées (`requires_owner`/`transactional`). Chaque `MigrationPlanItem` porte : version, statut actuel (calculé ou stocké), action recommandée (`apply` / `skip (already applied)` / `blocked (manual)` / `error (checksum mismatch)`).

---

## 10. Concurrence

- **Verrou** : `pg_advisory_lock` **de session** (pas `pg_advisory_xact_lock`) — nécessaire car une session unique doit englober **plusieurs** transactions successives (une par migration, §11), alors qu'un verrou de transaction se libérerait après la première d'entre elles.
- **Clé** : constante fixe et documentée, ex. `SELECT pg_try_advisory_lock(hashtext('carbonco_schema_migrations'))` — dérivée d'une chaîne stable plutôt qu'un entier arbitraire codé en dur, pour rester lisible sans table de correspondance séparée.
- **Timeout** : `pg_advisory_lock()` bloquant n'a pas de timeout natif — le runner utilise `pg_try_advisory_lock()` dans une boucle de nouvelle tentative bornée (ex. intervalle 2 s, budget total 30 s configurable), pour ne jamais bloquer indéfiniment un cold start ou un run GitHub Actions.
- **Comportement si lock occupé** : après épuisement du budget de nouvelle tentative, `MigrationLockError` est levée proprement — `apply`/`baseline`/`mark-applied` s'arrêtent avec un message explicite (« migration déjà en cours, réessayer plus tard ») et un code de sortie non-zéro (§14). `status`/`plan`/`verify` ne prennent jamais le lock (lecture seule).
- **Durée** : tenue pendant toute la durée d'`apply_plan()` — depuis avant le bootstrap éventuel du ledger jusqu'à la dernière migration du plan.
- **Libération** : implicite à la fermeture de la connexion de session (comportement PostgreSQL natif, y compris si le process crashe — pas de verrou orphelin permanent) ; explicite (`pg_advisory_unlock`) en sortie normale pour la lisibilité des logs.
- **Tests de concurrence** : voir §22 — deux runners lancés en parallèle contre la même base de test, un seul doit progresser, l'autre doit soit attendre puis constater un plan vide, soit échouer proprement selon le budget configuré.

---

## 11. Transactions

- **Une transaction par migration**, sur une **connexion unique tenue ouverte pour tout `apply_plan()`** — différence assumée par rapport au comportement actuel (qui ouvre/ferme une connexion par fichier). Nécessaire pour que le lock de session (§10) protège l'intégralité du run, pas seulement la première migration.
- **Rollback** : automatique sur toute exception pendant l'exécution d'un fichier ; la ligne de ledger correspondante est écrite `status='failed'` dans une transaction **séparée** (après le rollback de la migration elle-même), pour que l'échec soit tracé même si le contenu SQL a été annulé.
- **Commandes non transactionnelles** : aucune parmi les 28 fichiers actuels. Le champ `transactional` (manifeste + ledger) existe pour permettre à une future migration (ex. `CREATE INDEX CONCURRENTLY`, hors transaction par nature) de déclarer explicitement qu'elle doit s'exécuter en `autocommit=True` — le runner adapte alors son enveloppe pour cette migration précise sans changer le comportement des autres.
- **Métadonnée `transactional`** : par défaut `TRUE` ; à positionner `FALSE` explicitement dans le manifeste (§12) pour les cas qui l'exigent, jamais par défaut.
- **Interruption Vercel** (cold start tué en cours de route) : n'affecte que la migration en cours d'exécution au moment de l'interruption — PostgreSQL annule la transaction non commitée à la fermeture de connexion ; le prochain `plan`/`apply` la retrouve `pending` (aucune ligne `applied` n'a été écrite). Aucun état incohérent persistant, à condition que I1 soit respecté (ligne écrite **après** COMMIT).
- **Reprise après échec** : `apply_plan()` s'arrête au premier échec (I5) — relancer `apply` reprend au premier `pending` suivant la dernière ligne `applied`/`baseline`/`failed`, sans retenter automatiquement une migration `failed` (il faut soit une nouvelle version corrigée, soit une investigation manuelle suivie d'un `mark-applied` explicite si l'échec était en fait un faux négatif, par ex. une erreur réseau après un COMMIT réussi côté serveur mais perdu côté client — cas rare, à documenter dans le runbook §19).

---

## 12. Migrations `requires_owner`

**Déclaration** : un manifeste Python séparé du contenu SQL — `apps/api/db/migration_manifest.py`, un dict `MIGRATION_METADATA: dict[str, MigrationMeta]` keyé par version, remplaçant `MANUAL_ONLY_PREFIXES`. Choix déterminant : **ne jamais encoder ces métadonnées dans le fichier `.sql` lui-même**, car éditer rétroactivement un fichier déjà checksummé pour y ajouter un en-tête violerait la contrainte #1. Le manifeste est lui-même versionné dans git (diff normal en review), mais n'entre pas dans le calcul du checksum de la migration.

```python
MIGRATION_METADATA: dict[str, MigrationMeta] = {
    "004": MigrationMeta(requires_owner=False, transactional=True,
                          note="Gating de rollout (audit callers), pas un privilège manquant — voir D-3"),
    "009": MigrationMeta(requires_owner=False, transactional=True,
                          note="Gating RLS_FORCE (validation prod requise), pas un privilège manquant — voir D-3"),
    "027": MigrationMeta(requires_owner=True, transactional=True,
                          note="ALTER TABLE actions exige neondb_owner ; GRANT conditionnel à carbonco_app inclus"),
    # toute version absente du dict → requires_owner=False, transactional=True (défauts sûrs)
}
```

**Traitement des opérations sensibles** (aucune dans le corpus actuel, mais à couvrir pour PR-08+) :

| Opération | `requires_owner` ? | Raison |
|---|---|---|
| `CREATE EXTENSION` (ex. PostGIS, PR-08) | Oui | Nécessite `superuser` ou un rôle avec délégation explicite sur Neon |
| `ALTER TABLE` sur un objet possédé par `neondb_owner` | Oui | Cas réel de 027 |
| `FORCE ROW LEVEL SECURITY` | **Non en soi** | Le propriétaire de la table peut le faire sur ses propres objets — devient `requires_owner` seulement si la table appartient à un rôle différent (cas de 027, pas de 004/009 dont les tables sont possédées par l'app elle-même — voir D-3) |
| `GRANT` à un rôle | Dépend | `requires_owner` seulement si le rôle exécutant la migration n'a pas lui-même le privilège avec `GRANT OPTION` |
| `SECURITY DEFINER` (fonction) | Non | Nécessite seulement `CREATE FUNCTION`, privilège standard du propriétaire de schéma |
| Opérations manuelles Neon SQL Editor | Toujours `requires_owner=true` par construction — c'est le signal qui déclenche ce chemin | — |

**Commande contrôlée** : `mark-manual-verified <version> --applied-by <acteur> --proof <texte>` (alias conceptuel de `mark-applied` pour le cas spécifique `manual_required → baseline`/`applied`). Refuse sans les deux arguments (I7). Enregistre `applied_at=now()`, `applied_by`, et la preuve dans `metadata`.

---

## 13. API Python

```python
@dataclass(frozen=True)
class MigrationFile:
    version: str          # "004", "008b", "027"
    suffix: str            # "", "b"
    name: str               # nom de fichier complet
    path: Path
    checksum_sha256: str

@dataclass(frozen=True)
class MigrationRecord:
    version: str
    name: str
    checksum_sha256: str
    status: Literal["applied", "failed", "manual_required", "baseline"]
    applied_at: datetime | None
    execution_ms: int | None
    applied_by: str | None
    requires_owner: bool
    transactional: bool
    error_message: str | None
    metadata: dict

@dataclass(frozen=True)
class MigrationPlanItem:
    file: MigrationFile
    record: MigrationRecord | None       # None si jamais vue dans le ledger (pending)
    action: Literal["apply", "skip", "blocked_manual", "checksum_mismatch", "drift_detected"]
    reason: str

@dataclass(frozen=True)
class MigrationPlan:
    items: list[MigrationPlanItem]
    has_blocking_issues: bool             # True si un mismatch/drift/manual bloque un apply naïf

class MigrationError(Exception): ...
class ChecksumMismatchError(MigrationError): ...
class MigrationLockError(MigrationError): ...
class ManualMigrationRequired(MigrationError): ...

class MigrationRunner:
    def discover_migrations(self) -> list[MigrationFile]: ...
    def calculate_checksum(self, path: Path) -> str: ...
    def load_records(self) -> dict[str, MigrationRecord]: ...
    def build_plan(self) -> MigrationPlan: ...
    def verify_migration_objects(self, version: str) -> bool: ...
    def acquire_lock(self, timeout_s: float = 30.0) -> ContextManager[None]: ...
    def apply_one(self, item: MigrationPlanItem, conn) -> MigrationRecord: ...
    def apply_plan(self, plan: MigrationPlan | None = None) -> list[MigrationRecord]: ...
    def baseline(self, dry_run: bool = True) -> MigrationPlan: ...
    def verify(self) -> list[str]: ...   # liste des anomalies (mismatch, drift) — vide si tout est sain
    def mark_manual_verified(self, version: str, applied_by: str, proof: str) -> MigrationRecord: ...
```

| Fonction | Responsabilité | Entrée | Sortie | Erreurs | Idempotence |
|---|---|---|---|---|---|
| `discover_migrations()` | Lister et parser les fichiers `.sql` valides selon la regex §7 | — | `list[MigrationFile]` trié par `(int(version), suffix)` | Aucune (fichiers non conformes = avertissement, pas exception) | Oui — même dossier ⇒ même liste |
| `calculate_checksum(path)` | SHA-256 des octets bruts | Chemin de fichier | Chaîne hex 64 caractères | `FileNotFoundError` si absent | Oui |
| `load_records()` | Lire l'état actuel du ledger | — (utilise `get_db()` sans tenant) | `dict[version, MigrationRecord]` | Échec de connexion propagé | Oui (lecture pure) |
| `build_plan()` | Confronter fichiers découverts, ledger, manifeste | — | `MigrationPlan` | Aucune (les anomalies sont dans le plan, pas des exceptions) | Oui — déterministe pour un état de base donné |
| `verify_migration_objects(version)` | Sonder si les objets attendus d'une version existent réellement | Version | `bool` | Échec de connexion propagé | Oui (lecture pure) |
| `acquire_lock(timeout_s)` | Prendre le verrou advisory de session, avec budget de nouvelles tentatives | Timeout | Context manager | `MigrationLockError` si budget épuisé | Non applicable (verrou, pas une donnée) |
| `apply_one(item, conn)` | Exécuter une migration dans une transaction dédiée sur la connexion fournie | Item de plan + connexion ouverte | `MigrationRecord` (nouveau, `applied` ou `failed`) | Propage l'exception SQL après rollback + écriture `failed` | Non — appelée une fois par migration dans un run |
| `apply_plan(plan)` | Orchestrer lock + boucle `apply_one` avec arrêt strict sur erreur | Plan optionnel (sinon `build_plan()` interne) | Liste des `MigrationRecord` produits | `MigrationLockError`, `ManualMigrationRequired`, propage la 1ʳᵉ erreur SQL | Oui au sens where relancer sur un état déjà à jour ne fait rien |
| `baseline(dry_run)` | Vérifier objet par objet et proposer/écrire les lignes `baseline` | `dry_run=True` par défaut (n'écrit rien, affiche le plan) | `MigrationPlan` annoté du résultat de vérification | Aucune levée — anomalies dans le plan | Oui |
| `verify()` | Comparer checksums actuels vs stockés + vérifier l'existence des objets pour les lignes `applied`/`baseline` | — | Liste de chaînes décrivant chaque anomalie (vide = sain) | Échec de connexion propagé | Oui (lecture pure) |
| `mark_manual_verified(version, applied_by, proof)` | Transition `manual_required`/`pending` → `applied`/`baseline` avec preuve | Version, acteur, preuve | `MigrationRecord` mis à jour | `ValueError` si `applied_by`/`proof` vides ; `KeyError` si version inconnue | Non — action ponctuelle documentée |

---

## 14. CLI

```
python -m db.migration_cli status   [--json]
python -m db.migration_cli plan     [--json]
python -m db.migration_cli apply    [--yes] [--json]
python -m db.migration_cli verify   [--json]
python -m db.migration_cli baseline [--dry-run|--commit] [--json]
python -m db.migration_cli mark-applied <version> --applied-by <acteur> --proof <texte>
```

- **`status`** — affiche l'état actuel (comptage par statut, dernière version appliquée, anomalies détectées par `verify()` en arrière-plan). Sortie texte tabulaire par défaut, `--json` pour l'intégration CI.
- **`plan`** — calcule et affiche `MigrationPlan` sans rien exécuter. Toujours sûr, jamais de confirmation requise.
- **`apply`** — exécute le plan. **Exige une confirmation interactive** en l'absence de `--yes` si la cible est `production` (détecté via une variable d'environnement, ex. `APP_ENV=production` ou équivalent déjà utilisé dans le repo — à confirmer, voir D-2). Refuse silencieusement de rien faire si le plan contient des migrations `requires_owner` bloquantes tant que celles-ci ne sont pas résolues (skip explicite avec message, jamais un blocage total des migrations non liées qui suivent dans un futur plan — mais pour l'instant, respecter l'arrêt strict de I5/I9 signifie qu'un `manual_required` en tête de plan bloque effectivement les suivantes si elles en dépendent ; le runner ne réordonne pas le plan).
- **`verify`** — exécute `verify()`, sort avec un code non-zéro si des anomalies existent.
- **`baseline`** — `--dry-run` (défaut) affiche ce qui serait marqué `baseline` sans écrire ; `--commit` écrit réellement les lignes après vérification.
- **`mark-applied`** (alias `mark-manual-verified`) — transition explicite avec preuve obligatoire.

**Codes de sortie** : `0` succès/rien à faire ; `1` erreur d'exécution (échec SQL, erreur de connexion) ; `2` verrou non obtenu ; `3` migration manuelle bloquante non résolue ; `4` anomalie détectée par `verify` (checksum mismatch ou drift). Codes stables et documentés pour l'intégration GitHub Actions (§17).

**Confirmations production** : toute commande mutante (`apply`, `baseline --commit`, `mark-applied`) affiche un résumé du plan et exige une confirmation textuelle explicite (`--yes` ou saisie interactive) quand la cible est identifiée comme production — voir Décision ouverte D-2 sur le mécanisme exact de détection d'environnement.

---

## 15. Vercel et Neon

| Contexte | Comportement |
|---|---|
| **Local** | `AUTO_MIGRATE=1` autorisé (nouveau flag, à documenter dans `.env.example`) — un développeur peut lancer l'API avec migration automatique au démarrage via `uvicorn`, en s'appuyant sur `@app.on_event("startup")` qui fonctionne réellement en local. |
| **Test (CI)** | `AUTO_MIGRATE=1` sur une base de test éphémère uniquement (conteneur PostgreSQL jetable, jamais Neon). |
| **Preview (Vercel)** | `AUTO_MIGRATE=0` par défaut — comportement à trancher précisément en D-1 selon que les previews partagent une base Neon avec la prod ou une branche Neon isolée. |
| **Production** | `AUTO_MIGRATE=0`, **toujours**. Aucune migration ne s'exécute au déploiement ni à la première requête. Seul le workflow GitHub `db-migrate.yml` (§17), déclenché manuellement par un humain avec environnement protégé, peut exécuter `apply`. |
| **`DATABASE_URL_DIRECT`** | Aujourd'hui utilisée uniquement par le worker (`jobs/__init__.py`, `worker.py`) pour LISTEN/NOTIFY, **pas par le runner de migrations actuel** (qui utilise exclusivement `DATABASE_URL`, poolée pgbouncer). Pour le nouveau runner, l'advisory lock de session (§10) et les transactions multi-étapes fonctionnent mal derrière un pooler en mode transaction (PgBouncer `transaction` pooling casse les GUC `SET LOCAL` et peut réattribuer la connexion physique entre deux `pg_try_advisory_lock`/`unlock`) — **recommandation : le runner de migrations doit utiliser une connexion directe, pas poolée**, cohérente avec la remarque déjà documentée dans `009_rls_force.sql` sur le comportement de PgBouncer en pooling transaction. Voir Décision ouverte D-4 sur l'introduction d'une variable dédiée (`DATABASE_ADMIN_URL`, nommée ainsi dans `PLAN_ACTION_ARCHITECTURE_CARBONCO_INTELLIGENCE.md`) plutôt que de réutiliser `DATABASE_URL_DIRECT` (sémantiquement liée au worker aujourd'hui). |
| **Cold starts** | Le runner de migrations n'est **plus jamais** invoqué par un cold start (contrairement à `ensure_schema_mw` aujourd'hui) — retrait prévu en PR-02C. Le cold start ne fait plus qu'un `SELECT` léger optionnel pour du logging (« schéma en retard de N migrations », jamais une exécution). |
| **Schéma incomplet** | Signalé par `/health/schema` (§16) et par les logs structurés (§18), jamais corrigé automatiquement en dehors du workflow manuel. |
| **Indisponibilité DB** | Comportement inchangé du reste de l'API : `db_available()` retourne `False`, les migrations sont un no-op silencieux (log info), le mode `/tmp` JSON continue de fonctionner pour le reste de l'application. |
| **Rôle applicatif (`carbonco_app`)** | Exécute la majorité des migrations 001-026 (+008b), le bootstrap du ledger, `baseline`, `mark-applied`. |
| **Rôle propriétaire (`neondb_owner`)** | Requis uniquement pour les migrations `requires_owner=true` (027 aujourd'hui, futures migrations PostGIS/`CREATE EXTENSION`) — appliquées via le SQL Editor Neon ou une connexion explicitement authentifiée avec ce rôle dans le contexte du workflow GitHub protégé, jamais via le rôle applicatif standard. |
| **Procédure de déploiement** | Le déploiement applicatif (Vercel) et le déploiement de schéma (workflow GitHub) sont **découplés** — un déploiement de code ne déclenche jamais de migration ; une migration est toujours un acte humain distinct, généralement **avant** le déploiement du code qui en dépend (ordre à documenter précisément dans le runbook §19/§23). |

---

## 16. Santé du schéma

**`GET /health/schema` — réponse publique minimale** (aucun secret, aucun SQL, contrainte #9) :

```json
{
  "schema_version": "027",
  "up_to_date": true,
  "pending_count": 0,
  "manual_required_count": 0,
  "checked_at": "2026-07-16T18:00:00Z"
}
```

- **Codes HTTP** : `200` toujours si l'endpoint répond (même si `up_to_date: false` — ce n'est pas une erreur HTTP, c'est un état informationnel) ; `503` uniquement si la base est injoignable (cohérent avec `_db_status()` existant dans `/health`).
- **Timeout** : borné à 2 s (une seule requête `SELECT` légère sur `schema_migrations`, pas de calcul de checksum ni de lecture de fichiers à la volée — ceux-ci sont coûteux et réservés au CLI).
- **Cache** : réponse cacheable côté client 30-60 s (l'état du schéma ne change qu'au rythme des déploiements manuels, jamais en continu) — en-tête `Cache-Control: public, max-age=30` envisageable.
- **Absence de DB** : `"db": "not_configured"` à l'image de l'endpoint `/health` existant, `up_to_date: null`.

**Diagnostic détaillé** — **volontairement pas un second endpoint HTTP** (minimise la surface d'attaque nouvelle, contrainte #9). Le détail (quelles versions sont `pending`/`manual_required`, messages d'erreur, checksums) reste réservé à `python -m db.migration_cli status --json`, exécuté par un opérateur avec accès à l'environnement (local ou CI protégé). **Décision ouverte D-5** si un besoin produit émerge plus tard de l'exposer via un endpoint authentifié (`/admin/schema`) plutôt que CLI-only.

---

## 17. GitHub Actions

Nouveau fichier `.github/workflows/db-migrate.yml` — **aucun workflow existant n'exécute de migration aujourd'hui** (confirmé : `api.yml` ne touche jamais de vraie base, `backup.yml`/`chain-verify.yml`/`worker.yml` sont indépendants du schéma).

```yaml
name: DB Migrate
on:
  workflow_dispatch:
    inputs:
      command:
        description: "status | plan | apply | verify | baseline"
        required: true
        default: "plan"
jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production-db   # environnement GitHub protégé — approbation manuelle requise
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -r apps/api/requirements.txt
      - run: python -m db.migration_cli ${{ github.event.inputs.command }} --json
        working-directory: apps/api
        env:
          DATABASE_ADMIN_URL: ${{ secrets.DATABASE_ADMIN_URL }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: migration-log-${{ github.run_id }}
          path: apps/api/migration-run.log
```

- **Environnement protégé** : `environment: production-db` avec règle d'approbation manuelle configurée côté GitHub (hors périmètre du code, action GitHub à effectuer par Ludo).
- **Plan avant apply** : le workflow accepte `plan` et `apply` comme deux invocations séparées — un opérateur lance `plan` d'abord (sans lock ni écriture), lit la sortie, puis relance manuellement `apply` s'il valide.
- **Approbation** : portée par l'environnement GitHub protégé lui-même (reviewers requis), pas par une logique applicative.
- **Artefact de logs** : upload systématique (`if: always()`), pour audit même en cas d'échec.
- **Secrets minimaux** : un seul secret (`DATABASE_ADMIN_URL`, voir D-4), jamais `DATABASE_URL` applicatif standard dans ce workflow.
- **Aucune exécution automatique à chaque push** : déclencheur exclusivement `workflow_dispatch`, jamais `push`/`pull_request`/`schedule`.

---

## 18. Observabilité

Champs de logs structurés (JSON), émis par le runner à chaque étape significative :

| Champ | Exemple |
|---|---|
| `migration_version` | `"024"` |
| `checksum` | 64 hex chars |
| `environment` | `"production"` / `"preview"` / `"local"` / `"test"` |
| `actor` | `"github-actions"` / `"ludo-local"` / nom d'utilisateur système |
| `duration_ms` | `142` |
| `status` | `"applied"` / `"failed"` / `"skipped"` |
| `error_class` | nom de l'exception Python si `status="failed"` |
| `deployment_sha` | `os.environ.get("VERCEL_GIT_COMMIT_SHA") or os.environ.get("GITHUB_SHA")` — déjà utilisé ailleurs dans le repo (`main.py:76`, `health.py:18-19`), à réutiliser tel quel |
| `correlation_id` | un identifiant unique par run d'`apply_plan()` (ex. UUID généré une fois en tête de run), pour regrouper les logs de plusieurs migrations d'un même run |

Sentry (`main.py:70-81`) est déjà initialisé conditionnellement dans l'app — le runner de migrations, s'il est invoqué en tant que module Python autonome (CLI), n'hérite pas automatiquement de cette init ; à documenter comme point d'intégration optionnel plutôt que dépendance dure (le CLI doit fonctionner même sans `SENTRY_DSN`).

---

## 19. Stratégie d'échec — runbooks

| Scénario | Diagnostic | Action |
|---|---|---|
| **Checksum mismatch** | `verify`/`plan` signale la version, checksum attendu vs actuel | Ne jamais réappliquer automatiquement. Comparer le diff du fichier avec git blame. Si la modification est légitime (ex. correction de commentaire sans impact fonctionnel), créer une nouvelle version qui documente le changement réel ; si le fichier a été altéré par erreur, restaurer depuis git et réexécuter `verify`. |
| **SQL échoué** | `status='failed'`, `error_message` peuplé | Lire le message, corriger dans une **nouvelle** version (jamais éditer le fichier échoué), relancer `plan` puis `apply`. |
| **Lock déjà détenu** | `MigrationLockError`, code de sortie 2 | Vérifier qu'aucun autre run (CI ou local) n'est réellement en cours ; si un run a crashé sans libérer le lock (rare — le lock de session se libère à la fermeture de connexion, y compris sur crash), interroger `pg_locks`/`pg_stat_activity` sur Neon pour confirmer avant toute action manuelle. |
| **Perte de connexion** | Exception réseau pendant `apply_one` | Rollback automatique côté PostgreSQL (transaction non commitée). Relancer `plan` pour confirmer l'état réel avant de relancer `apply`. |
| **Interruption serverless** | Cold start tué en cours de migration (scénario à éviter — ne devrait plus se produire une fois `ensure_schema_mw` retiré en PR-02C, mais possible pendant la coexistence PR-02A/B) | Identique à « perte de connexion » — aucune ligne `applied` n'a pu être écrite avant COMMIT (I1). |
| **Objet absent malgré ligne `applied`/`baseline`** (drift) | `verify` signale `drift_detected` | Investiguer manuellement (l'objet a-t-il été supprimé hors du runner ?). Ne jamais réappliquer automatiquement une migration marquée `applied` — corriger via une nouvelle version qui recrée l'objet si nécessaire. |
| **Baseline ambiguë** (ex. 004/009, voir D-3) | `baseline --dry-run` montre un statut incertain | Vérifier manuellement `pg_policies`/`pg_class.relforcerowsecurity` sur la vraie base avant de trancher `baseline` vs `manual_required` pour ces versions spécifiques. |
| **Migration manuelle oubliée** | `plan` montre `manual_required` alors que l'action a réellement été faite | `mark-applied`/`mark-manual-verified` avec preuve — jamais un contournement silencieux du gate. |
| **Drift de production** (schéma prod diverge du ledger) | `verify` en échec sur une ligne `applied`/`baseline` de longue date | Traiter comme un incident : figer les déploiements de code dépendants, investiguer avant toute nouvelle migration. |
| **Restauration** (après incident majeur) | Base restaurée depuis un backup (`backup.yml`) | Après restauration, lancer `verify` avant tout redéploiement applicatif — le ledger restauré doit correspondre à l'état réel du schéma restauré (les deux viennent du même backup, donc cohérents par construction si le ledger est bien dans la même base). |

---

## 20. Plan des fichiers

| Fichier | Créer/Modifier/Supprimer | Responsabilité | Risque |
|---|---|---|---|
| `apps/api/db/migration_runner.py` | Créer | `MigrationRunner`, dataclasses, exceptions (§13) | Moyen — cœur du système, doit être testé exhaustivement avant tout usage prod |
| `apps/api/db/migration_manifest.py` | Créer | `MIGRATION_METADATA` dict (§12) | Faible |
| `apps/api/db/migration_cli.py` | Créer | Entrée `python -m db.migration_cli` (§14) | Faible |
| `apps/api/db/migrations/000_schema_migrations_ledger.sql` | Créer | DDL du ledger (§5), traité comme cas d'amorçage spécial (§6) | Faible |
| `apps/api/db/migrations.py` | Modifier | Conserver `run_migrations()`/`ensure_schema()` en PR-02A/B pour compatibilité ; dépréciation progressive en PR-02C | Moyen — ne pas casser le seul chemin de prod actuel avant que le nouveau soit validé |
| `apps/api/main.py` | Modifier (PR-02C uniquement) | Retirer `ensure_schema_mw` ; le `startup_event` local peut rester pour le confort dev | Élevé — c'est le changement de comportement de prod le plus sensible, à faire en dernier et séparément |
| `apps/api/routers/health.py` | Modifier | Ajouter `GET /health/schema` (§16) | Faible |
| `apps/api/.env.example` | Modifier | Documenter `AUTO_MIGRATE`, `DATABASE_ADMIN_URL` (D-4) | Faible |
| `.github/workflows/db-migrate.yml` | Créer | Workflow manuel protégé (§17) | Faible (aucune exécution automatique) |
| `docs/carbonco/MIGRATIONS_RUNBOOK.md` | Créer | Runbooks opérationnels (§19), procédure de déploiement (§23) | Faible |
| `apps/api/tests/test_migration_runner.py` | Créer | Tests unitaires + PostgreSQL (§22) | Faible |
| `apps/api/tests/test_ensure_schema.py` | Conserver tel quel en PR-02A/B | Toujours valide tant que l'ancien mécanisme coexiste | Faible |

---

## 21. Découpage recommandé

**PR-02 ne doit pas rester une seule PR.** Le périmètre (28 migrations historiques à baseliner + nouveau runner + CLI + workflow + retrait d'un mécanisme de production actif) est trop large et trop sensible pour un seul commit de revue, en particulier parce que la baseline de production touche un système qui a déjà connu un incident (04/07/2026).

**Seule PR-02A est autorisée à démarrer à l'issue de cette phase d'architecture.** PR-02B et PR-02C ne démarrent qu'après validation explicite de PR-02A **et** des décisions D-1 à D-5.

### PR-02A — Découverte, modèle, checksum, planificateur

- **Périmètre** : `MigrationFile`, `calculate_checksum`, `discover_migrations`, `MigrationRecord`, `MigrationPlan`, `build_plan` — tout ce qui est **lecture seule**, aucune écriture en base, aucune exécution de SQL.
- **Interdictions explicites pour PR-02A** (par opposition à PR-02B/C, pour lever toute ambiguïté) :
  - ne touche **jamais** une base de production, preview ou locale existante — les tests PostgreSQL de cette étape tournent contre un conteneur de test jetable, jamais contre Neon ;
  - ne retire **pas** `ensure_schema_mw` ni aucun autre déclencheur existant de `main.py` — l'ancien mécanisme continue de fonctionner sans modification pendant toute la durée de PR-02A ;
  - ne crée **aucune table** en base (ni `schema_migrations`, ni aucune autre) — la création du ledger lui-même est du ressort de PR-02B (§6) ;
  - ne modifie **aucun** fichier de migration existant (001-027 + 008b) ni `apps/api/db/migrations.py`/`main.py`/`routers/health.py`.
- **Dépendances** : aucune (peut se construire et se tester sans toucher à `migrations.py` existant).
- **Tests** : **unitaires uniquement** (tri, regex, checksum stable, déterminisme du plan) + éventuellement un test PostgreSQL minimal en lecture seule si nécessaire pour `load_records` contre une table de test **jetable**, jamais contre une base persistante.
- **Critères de sortie** : `python -m db.migration_cli plan` fonctionne contre une base de test et affiche un plan correct pour les 28 fichiers existants (tous `pending`, puisque le ledger n'existe pas encore réellement en prod à ce stade).
- **Rollback** : trivial — code entièrement additif, aucune table de prod touchée, se retire en supprimant les fichiers.

### PR-02B — Ledger, baseline, CLI complet, health endpoint

- **Périmètre** : bootstrap du ledger (§6), `apply_one`/`apply_plan`/`acquire_lock` (§10-11), `baseline()`/`verify()`/`mark_manual_verified()`, CLI complet, `GET /health/schema`.
- **Dépendances** : PR-02A mergée.
- **Tests** : concurrence (§22), transactions, baseline sur base neuve/partielle, tous les cas du §22.
- **Critères de sortie** : `baseline --dry-run` exécutable en toute sécurité contre une **copie** de la structure de prod (pas la prod elle-même) donne un résultat cohérent avec l'inventaire du §3 ; `apply` fonctionne de bout en bout sur une base de test vide (000 → 027).
- **Rollback** : le ledger ajouté est une table nouvelle, sans impact sur le reste du schéma — supprimable sans effet de bord si abandonné avant la PR-02C.

### PR-02C — Workflow production, retrait de la sentinelle, rollout

- **Périmètre** : `.github/workflows/db-migrate.yml`, retrait de `ensure_schema_mw` de `main.py`, baseline **réelle** de la production (exécutée manuellement via le workflow, pas dans le code de la PR elle-même), `MIGRATIONS_RUNBOOK.md`.
- **Dépendances** : PR-02A et PR-02B mergées et validées en preview/test pendant un délai d'observation.
- **Tests** : dry-run du workflow sur un environnement non-production d'abord ; smoke test post-bascule (§23).
- **Critères de sortie** : `/health/schema` répond `up_to_date: true` en production après la baseline réelle ; plus aucune requête utilisateur ne déclenche de migration (vérifié en observant les logs pendant 24-48h après retrait du middleware).
- **Rollback** : le plus délicat des trois — si `ensure_schema_mw` est retiré et qu'un problème de schéma survient ensuite, il n'y a plus de filet automatique. Rollback = redéployer la version précédente de `main.py` (avec le middleware) le temps de résoudre, la baseline du ledger n'étant pas affectée par ce revert de code applicatif.

Cette séquence correspond à un découpage **par niveau de risque croissant**, chaque étape validable indépendamment avant d'aborder la suivante — cohérent avec la discipline déjà appliquée sur PR-01 (une PR par unité de risque, validation explicite avant la suivante).

---

## 22. Matrice de tests

| Catégorie | Cas couverts |
|---|---|
| **Unitaires** | Tri `(int(num), suffix)` correct pour 008/008b/009 ; regex de découverte rejette les noms non conformes ; checksum stable pour un même contenu, différent si le contenu change d'un seul octet ; `MigrationPlan` déterministe pour un état de ledger donné |
| **PostgreSQL (base de test réelle)** | Bootstrap du ledger sur base vide ; `apply` 000→027 sur base vide ; `baseline` sur base pré-remplie (fixture reproduisant l'état de prod) ; échec transactionnel d'une migration (rollback confirmé, ligne `failed` écrite) ; `verify` détecte un checksum modifié ; `verify` détecte un objet manquant malgré ligne `applied` |
| **Concurrence** | Deux `apply` lancés en parallèle contre la même base — un seul progresse, l'autre échoue proprement ou attend puis constate un plan vide ; libération du lock confirmée après un crash simulé (fermeture brutale de connexion) |
| **Intégration** | CLI bout-en-bout : `status` → `plan` → `apply` → `verify` sur un scénario complet ; workflow GitHub en mode `plan` uniquement (pas de vraie base secrète en CI) |
| **DB-gated** (skip si pas de DB) | Tout ce qui touche PostgreSQL réel — suit le patron déjà en place (`test_facts_tx.py`, `test_rls_isolation.py`) de skip explicite avec message clair |
| **Preview** | À définir selon D-1 — si les previews Vercel partagent une base avec des migrations pré-appliquées, un test de non-régression `verify` en preview a du sens ; sinon hors périmètre |
| **Manuels Neon** | Vérification de `027` (déjà appliquée) via `pg_policies`/`information_schema` en lecture seule, exécutée **par Ludo**, jamais par un test automatisé qui se connecterait à la prod |

Cas explicitement requis par la consigne, mappés :

- Ordre 008/008b/009 → unitaire (tri).
- Checksum stable → unitaire.
- Checksum mismatch → PostgreSQL.
- Migration appliquée / absente → PostgreSQL (baseline + plan).
- Échec transactionnel → PostgreSQL.
- Advisory lock → concurrence.
- Base vide / partielle → PostgreSQL (baseline).
- Baseline production → **jamais en automatisé contre la vraie prod** ; simulée via fixture reproduisant l'inventaire du §3.
- `requires_owner` → PostgreSQL (le plan doit correctement bloquer 027 même sur une base où l'objet `sites` n'existe pas encore).
- Absence de DB → unitaire/PostgreSQL (mode dégradé, cf. `db_available()`).
- Health endpoint → intégration (FastAPI TestClient, sans vraie DB pour le cas `not_configured`, avec DB de test pour le cas nominal).
- CLI et codes de sortie → intégration.

---

## 23. Déploiement production

1. **Backup** — `backup.yml` (existant, déclenché manuellement) avant toute opération de baseline réelle.
2. **Dry run** — `baseline --dry-run` contre production (lecture seule stricte — aucune écriture) pour confirmer que le plan calculé correspond à l'inventaire attendu (§3) avant tout `--commit`.
3. **Inventaire** — comparaison manuelle du dry-run avec le tableau du §3, en particulier les cas déjà confirmés manuellement (004, 009 — D-3 ; 027).
4. **Baseline** — `baseline --commit` réel, via le workflow GitHub protégé (§17), avec `DATABASE_ADMIN_URL`.
5. **Vérification** — `verify` immédiatement après, doit rapporter zéro anomalie.
6. **Apply** — s'il existe de nouvelles migrations 028+ au moment du rollout (pas nécessairement le cas pour PR-02 elle-même, qui ne fait que baseliner l'existant), les appliquer séparément après la baseline.
7. **Smoke tests** — `GET /health/schema` répond `up_to_date: true` ; `GET /health` inchangé ; un endpoint applicatif représentatif (ex. `/materialite`) répond normalement.
8. **Surveillance** — observer les logs structurés (§18) pendant 24-48h, en particulier l'absence totale d'invocation de `ensure_schema_mw` une fois PR-02C déployée.
9. **Retour opérationnel** — documenter dans `MIGRATIONS_RUNBOOK.md` la date de bascule et l'acteur, à la manière de `PR01_TRACEABILITY.md`/`PR01_POST_MERGE_AUDIT.md` pour ce chantier.

**Responsabilités** : Ludo approuve l'environnement GitHub protégé et exécute (ou approuve l'exécution du) workflow `db-migrate.yml` pour toute opération touchant la production (contrainte #11 — aucune modification de prod pendant la phase d'architecture, et au-delà, aucune automatisation qui contournerait cette approbation humaine). L'application (code) ne déclenche jamais de migration de production de sa propre initiative. GitHub Actions n'exécute que ce que le workflow `workflow_dispatch` autorise explicitement, jamais en réaction à un `push`.

---

## 24. Décisions ouvertes

Voir `docs/carbonco/refonte/PR02_DECISIONS.md` pour le détail structuré (question / options / avantages / risques / recommandation) de chaque point ci-dessous — résumé ici pour la continuité de lecture.

**Aucune de ces cinq décisions ne bloque PR-02A** (qui ne baseline rien et ne touche aucune base réelle). **D-1, D-2, D-4, D-5 doivent être tranchées avant PR-02B**, qui implémente le ledger, la baseline et le CLI complet. **D-3 est résolue** (voir ci-dessous).

- **D-1** — Les environnements preview Vercel partagent-ils une base Neon avec la production, ou une branche Neon isolée ? Détermine si `AUTO_MIGRATE` peut être `1` en preview.
- **D-2** — Quel mécanisme exact détecte « on est en production » pour déclencher la confirmation renforcée du CLI (`APP_ENV` ? présence de `VERCEL_ENV=production` ? autre) ?
- **D-3 — ✅ RÉSOLUE (17/07/2026).** Vérifiée en lecture seule sur Neon production par Ludo : `relforcerowsecurity=true` sur les 5 tables (`snapshots`, `facts_events`, `audit_events`, `alert_rules`, `products`) → 009 a été appliquée manuellement en prod, 004 est fonctionnellement supersédée. `baseline()` (PR-02B) doit marquer les deux versions `baseline`/`requires_owner=false`. Détail complet dans `PR02_DECISIONS.md`.
- **D-4** — Faut-il introduire une nouvelle variable `DATABASE_ADMIN_URL` dédiée au runner de migrations (recommandé, §15/§17), ou réutiliser `DATABASE_URL_DIRECT` (sémantiquement déjà lié au worker) ?
- **D-5** — Un endpoint HTTP authentifié de diagnostic détaillé (`/admin/schema`) est-il souhaité en complément du CLI, ou le CLI seul suffit-il (recommandé par défaut, minimise la surface d'attaque) ?
