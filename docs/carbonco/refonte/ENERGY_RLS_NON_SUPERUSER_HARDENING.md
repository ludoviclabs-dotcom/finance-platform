# Durcissement — RLS énergie en conditions non-superuser

**Périmètre :** ajout d'un test PostgreSQL exécuté sous un rôle **non superuser**, pour exercer réellement la RLS `FORCE` des 5 tables énergie (migration `031`) et le trigger `energy_allocation_guard()`.
**Base :** `origin/master` (`df13229`), migrations jusqu'à `031` incluses.
**Ni migration, ni changement de schéma, ni changement frontend.** Test + inscription CI + ce document.

---

## 1. Le trou de couverture

`FORCE ROW LEVEL SECURITY` soumet le **propriétaire** d'une table à ses propres policies. Seuls un **superuser** ou un rôle **`BYPASSRLS`** y échappent.

Le job `migration-tests` de `.github/workflows/api.yml` se connecte au conteneur `postgres:16` avec :

```
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/postgres
```

`postgres` est SUPERUSER. **Toutes les policies `tenant_isolation_*` sont donc intégralement contournées dans ce job.** Conséquences concrètes :

| Objet | Ce que le job prouvait avant | Ce qu'il ne prouvait pas |
|---|---|---|
| Policies RLS des 5 tables énergie | rien (contournées) | qu'un tenant ne voit pas les lignes d'un autre |
| `FORCE ROW LEVEL SECURITY` | rien (contourné) | que le propriétaire des tables y est soumis |
| `energy_allocation_guard()` | le refus de survente **intra-tenant** | que le trigger ne compte que les lignes visibles |

Les tests énergie existants (`test_energy_instruments.py`, `test_energy_meters.py`, `test_energy_import.py`) restent valides : ils prouvent la **défense applicative** (`company_id = %s` explicite dans chaque requête de `services/energy/*`). Ils ne prouvaient simplement **rien sur la barrière base**, alors que c'est elle la garantie primaire en production.

Un second effet, moins visible, portait sur le trigger. `energy_allocation_guard()` est `SECURITY DEFINER` : il s'exécute avec les droits du **propriétaire de la fonction**. En CI ce propriétaire est le superuser qui a appliqué la migration → le trigger voyait **tous les tenants**. En production (Neon, rôle propriétaire non superuser) il est soumis à la RLS et ne voit que le tenant courant. Les deux comportements diffèrent, et seul le premier était testé.

Le bloc de commentaire au-dessus de `CREATE OR REPLACE FUNCTION energy_allocation_guard()` dans `031_energy_scope2.sql` documente déjà ce point ; il annonçait explicitement que « la correction repose sur l'invariant mono-tenant + le `SET LOCAL` systématique du service, **pas sur le test** ». C'est cette phrase que le présent travail rend caduque.

---

## 2. Ce que le test prouve désormais

Fichier : `apps/api/tests/test_energy_rls_non_superuser.py` (21 tests, DB-gated).

### 2.1 Le rôle est réellement soumis à la RLS

| Assertion | Pourquoi elle compte |
|---|---|
| `rolsuper = false` et `rolbypassrls = false` sur le rôle | sans elle, tout le module serait un faux positif silencieux |
| `relrowsecurity` **et** `relforcerowsecurity` vrais sur les 5 tables | `ENABLE` seul ne dit rien du propriétaire |
| `pg_class.relowner` = le rôle de test, pour les 5 tables | **c'est l'assertion clé** : un non-propriétaire serait de toute façon filtré par `ENABLE`, donc le test n'exercerait pas `FORCE`. En possédant les tables, le rôle **ne peut être filtré que par `FORCE`** |
| Propriétaire de `energy_allocation_guard()` = le rôle de test | rend le trigger `SECURITY DEFINER` soumis à la RLS, comme en production |
| `current_user` = le rôle, `row_security = on`, `app.current_company_id` posé | la session teste bien ce qu'elle prétend tester |

Le raisonnement de non-contournement est donc explicite : **propriétaire + non superuser + non `BYPASSRLS` + filtré ⇒ `FORCE` est la seule cause possible du filtrage.** Un superuser ne peut pas passer silencieusement ce module : il échouerait sur les tests d'isolation.

### 2.2 Le témoin de la fuite

`TestSuperuserBypassIsTheCoverageHole::test_superuser_session_sees_both_tenants` constate la fuite : avec `app.current_company_id = A` mais **sans** `SET ROLE`, la connexion CI lit l'instrument du tenant B. Ce test verrouille le diagnostic — si la connexion CI cessait d'être superuser, il échouerait, ce qui est le signal voulu (la couverture ne doit jamais redevenir muette sans qu'on le sache).

### 2.3 Isolation tenant (2 tenants, 5 tables)

Chaque tenant est semé sur les **5** tables (compteur, activité, instrument, allocation, métadonnée de facteur) — toutes les insertions passant elles-mêmes par les policies `INSERT` sous le rôle. Sans ce semis complet, le test paramétré passerait à vide sur les tables restées vides.

- `SELECT DISTINCT company_id` sur **chacune** des 5 tables (paramétré) : jamais l'autre tenant.
- Lecture par identifiant : l'instrument de B est introuvable depuis A ; celui de A reste lisible (contrôle négatif — la policy filtre, elle ne bloque pas tout).
- `INSERT` au nom de B depuis le contexte A → refusé (`WITH CHECK`, message `row-level security`).
- `UPDATE` visant la ligne de B depuis A → `rowcount = 0`, et la ligne de B est vérifiée inchangée.
- Sans `app.current_company_id` → `COUNT(*) = 0` (défaut fermé).

### 2.4 Le trigger `energy_allocation_guard()` sous RLS

| Test | Scénario | Attendu |
|---|---|---|
| `test_legitimate_allocation_is_accepted` | 40 MWh sur instrument de 100 | accepté (le filet ne casse pas l'usage normal) |
| `test_over_allocation_is_refused` | 70 puis 40 sur 100 | refusé, message `energy_scope2` |
| `test_allocation_exactly_at_volume_is_accepted` | 60 puis 40 sur 100 | accepté (borne haute, égalité stricte) |
| `test_guard_only_counts_rows_visible_to_the_tenant` | voir ci-dessous | accepté |
| `test_cross_tenant_allocation_is_refused_by_the_guard` | B alloue l'instrument de A | refusé, message `introuvable` |

**Le test décisif** est `test_guard_only_counts_rows_visible_to_the_tenant`. On plante, via l'échappatoire admin `app.rls_bypass` (documentée dans `031`), une allocation de **60 MWh du tenant B adossée à un instrument du tenant A** — un état qu'aucun tenant ne peut produire lui-même. Puis A alloue 60 MWh sur ce même instrument de 100 MWh :

- trigger **soumis à la RLS** (production, et ce module) → il ne voit que les lignes de A, somme = 0, `0 + 60 ≤ 100` → **accepté** ;
- trigger **contournant la RLS** (`SECURITY DEFINER` possédé par un superuser — le cas CI historique) → somme = 60, `60 + 60 > 100` → **refusé**.

L'acceptation est donc la preuve positive que le trigger ne comptabilise **que** le périmètre visible du tenant courant. Le test échouerait immédiatement si le trigger repassait en exécution privilégiée.

`test_cross_tenant_allocation_is_refused_by_the_guard` complète le tableau : la clé étrangère `instrument_allocations.instrument_id` **ne protège pas** contre une référence inter-tenant (les vérifications d'intégrité référentielle de PostgreSQL s'exécutent hors RLS, en tant que propriétaire de la table référencée). C'est le trigger, soumis à la RLS, qui ne trouve pas l'instrument et lève. **Sous le superuser CI, cette écriture inter-tenant passerait.**

---

## 3. Cycle de vie du rôle

Rôle : `carbonco_rls_probe`. Volontairement **pas** `carbonco_app` — ce nom déclencherait le bloc `DO $$ ... IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carbonco_app')` en fin de `031_energy_scope2.sql`, effet de bord non voulu.

### Création (fixture module `probe_role`)

1. **Garde** : si la connexion n'est pas superuser, le module est **skippé** — il simule le non-superuser *depuis* une session superuser, il lui faut donc les droits de création de rôle et de transfert de propriété.
2. Capture des **propriétaires d'origine** au catalogue (`pg_class.relowner`, `pg_proc.proowner`) **avant** toute modification.
3. `CREATE ROLE ... NOLOGIN` si absent, puis `ALTER ROLE ... NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` — inconditionnel, pour ramener aux attributs attendus un rôle laissé par un run précédent (rejouabilité).
4. Privilèges applicatifs stricts : `USAGE, CREATE ON SCHEMA public` (exigé de tout nouveau propriétaire d'objet), `SELECT` sur `companies`/`sites`, `SELECT, INSERT, UPDATE, DELETE` sur les 5 tables énergie, `USAGE, SELECT` sur les 5 séquences.
5. `ALTER TABLE ... OWNER TO` sur les 5 tables + `ALTER FUNCTION public.energy_allocation_guard() OWNER TO`.

Étapes 3 à 5 dans **une seule transaction** : un échec partiel est annulé par le rollback de `get_db()`, jamais de propriété orpheline.

### Usage

`_role_session(company_id)` : `get_db(company_id=...)` pose `SET LOCAL app.current_company_id` (le geste de production, `apps/api/db/database.py:73`), puis `SET LOCAL ROLE carbonco_rls_probe`. L'ordre est indifférent — un GUC `app.*` est un placeholder `USERSET`, il survit au changement de rôle et reste lisible depuis la fonction trigger.

`SET LOCAL ROLE` borne le rôle à la transaction : même si le `RESET ROLE` explicite échoue (transaction avortée par un `RAISE` du trigger, où seul `ROLLBACK` passe), le rollback de `get_db()` l'annule et la connexion est refermée juste après. Le `RESET ROLE` explicite reste présent pour le chemin nominal.

### Tear-down

La fixture dépend de `energy_companies`, donc son tear-down s'exécute **avant** le nettoyage superuser des lignes (ordre inverse du setup) — le piège historique du `SET session_replication_role = replica` (superuser uniquement) est ainsi évité : il tourne bien après `RESET ROLE` et après restitution des propriétaires.

1. `RESET ROLE` ;
2. restitution des propriétaires d'origine (tables + fonction) depuis la capture initiale ;
3. **vérification** : `COUNT(*)` des relations `public` encore possédées par le rôle ;
4. seulement si ce compte est **0** : `DROP OWNED BY` (révoque les GRANT) puis `DROP ROLE`.

L'ordre 3 → 4 n'est pas cosmétique. `DROP OWNED BY` **supprime les objets possédés** autant qu'il révoque les privilèges : exécuté après une restitution silencieusement ratée, il détruirait les tables énergie. Le test échoue bruyamment et laisse le rôle en place plutôt que de détruire quoi que ce soit.

Le module est rejouable tel quel sur le même conteneur jetable (création idempotente, restitution depuis le catalogue, aucune dépendance d'ordre avec les autres modules de test).

---

## 4. Inscription CI

Ajouté à la liste pytest du job `migration-tests` dans `.github/workflows/api.yml`. **Un test DB-gated non listé là ne tourne nulle part** (le job `tests` s'exécute sans `DATABASE_URL`, tous les tests DB y sont skippés) et passe donc silencieusement — piège documenté du dépôt. Un commentaire signale de plus que ce fichier fait exception au superuser du job.

---

## 5. Aucun défaut produit trouvé

Aucun correctif applicatif ni SQL n'accompagne ce test. Les protections de `031` se comportent comme documenté dès lors qu'un rôle non superuser est en place. Le trou était **de couverture**, pas de conception.

Le commentaire de `031_energy_scope2.sql` reste exact sur le fond (`SECURITY DEFINER` ne contourne pas `FORCE`), avec une précision que ce test rend explicite : `SECURITY DEFINER` **n'exécute pas la fonction sous le rôle appelant mais sous le propriétaire de la fonction** — si ce propriétaire est superuser, la RLS est bien contournée à l'intérieur du trigger. C'est vrai en CI, faux en production. Le fichier `031` n'a pas été modifié (contrainte « aucun changement de schéma ») ; la précision vit ici et dans l'en-tête du module de test.

---

## 6. Ce qui reste NON couvert — honnêtement

1. **Le job CI reste superuser pour tout le reste.** Ce module simule le non-superuser sur son propre périmètre ; les autres tests DB-gated (Evidence Kernel, ledger, source admin, procurement, énergie historique) continuent de tourner en superuser et **n'exercent toujours aucune policy**. Le trou est refermé pour l'énergie, pas pour le dépôt. Le vrai correctif structurel serait un second rôle applicatif non superuser utilisé par tout le job — hors périmètre ici.
2. **La forme de production n'est pas reproduite à l'identique.** En production, le rôle applicatif (`carbonco_app` / `DATABASE_URL`) est **distinct** du rôle de migration (`neondb_owner` / `DATABASE_ADMIN_URL`) et n'est **pas** propriétaire des tables : il dépend des `GRANT` explicites de fin de migration, et c'est `ENABLE` (pas `FORCE`) qui le filtre. Ce module teste le cas **propriétaire non superuser** — plus strict, et celui où `FORCE` est réellement porteur — mais il ne valide pas la complétude des `GRANT` de production ni le cas à deux rôles distincts.
3. **Aucune connexion réellement authentifiée sous le rôle.** Le rôle est `NOLOGIN` et atteint par `SET ROLE` depuis une session superuser. C'est équivalent du point de vue des vérifications RLS (`GetUserId()` suit `SET ROLE`), mais cela ne teste ni l'authentification, ni le pooling, ni un `search_path` différent.
4. **Pas de test de concurrence.** Deux allocations simultanées sur le même instrument (course entre le `SELECT SUM` du trigger et l'`INSERT`) ne sont pas couvertes. Sous `READ COMMITTED`, le trigger peut théoriquement laisser passer une survente concurrente ; ni ce test ni les précédents ne l'exercent. Un `SELECT ... FOR UPDATE` sur l'instrument, ou une contrainte d'exclusion, serait la réponse — **hors périmètre** (ce serait un changement de schéma).
5. **`energy_factor_metadata` n'est couverte que par l'isolation** (lecture + `INSERT` sous le rôle). Aucun invariant métier ni trigger ne la concerne dans `031`, il n'y a donc rien d'autre à exercer — mais la règle « une moyenne pays-average n'est jamais market-based » reste, elle, non testée en base (elle n'y est pas exprimée : `basis` n'est qu'un `CHECK` d'énumération).
6. **Le test n'a jamais tourné localement.** Aucun PostgreSQL ni Docker sur la machine de développement : les 21 tests y sont skippés. La CI `migration-tests` est la seule exécution réelle.

---

## 7. Fichiers

| Fichier | Nature |
|---|---|
| `apps/api/tests/test_energy_rls_non_superuser.py` | **créé** — 21 tests DB-gated |
| `.github/workflows/api.yml` | **modifié** — inscription au job `migration-tests` + commentaire |
| `docs/carbonco/refonte/ENERGY_RLS_NON_SUPERUSER_HARDENING.md` | **créé** — ce document |

Aucun fichier `apps/api/db/migrations/*.sql` ajouté ou modifié (le corpus reste à **32** fichiers). `migration_manifest.py`, `migration_probes.py` et `_migration_fixtures.py` intacts — les compteurs du ledger (`len(versions) == 32`, `written_count == 33`) sont inchangés. Aucun fichier sous `apps/carbon`.
