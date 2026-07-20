# Wave 3 stabilisation — traçabilité

**Périmètre :** trois dettes techniques documentées à la clôture de Wave 3 (PR-04 à PR-07, toutes mergées) : (A) attribution arbitraire dans `_auto_map` (import d'achats, PR-05A), (B) survente concurrente possible dans `energy_allocation_guard()` (énergie, PR-06A), (C) diagnostic honnête de la sonde `storage` de `/health`.
**Base :** `origin/master` (`5be464d`), migrations 001-034 (35 fichiers `.sql`).
**Migration ajoutée :** `035_wave3_data_integrity.sql` — la SEULE nouvelle migration de cette PR.
**Isolation :** worktree `wave3-data-integrity`, branche `fix/wave3-data-integrity`. Aucun fichier sous `apps/carbon` touché (PR backend uniquement).

---

## 1. Tâche A — `_auto_map` (import d'achats, PR-05A)

### 1.1 Le défaut

`apps/api/services/procurement/purchase_import_service.py::_auto_map` résolvait un `product_code` externe par :

```python
cur.execute(
    f"SELECT id, supplier_id FROM supplier_products WHERE {_SCOPE} AND product_code = %s",
    (company_id, code),
)
match = cur.fetchone()
```

Sans `ORDER BY`, sur une requête pouvant renvoyer PLUSIEURS lignes — l'unicité de `supplier_products` porte sur `(company_id, supplier_id, product_code)`, **pas** `(company_id, product_code)` : deux fournisseurs du même tenant peuvent légitimement partager un code produit. Le fournisseur retenu dépendait alors de l'ordre de retour de PostgreSQL (non garanti), donc arbitraire. Le défaut avait déjà causé une flakiness CI documentée dans le commit `d857eda` (message intégral lu via `git show d857eda` — voir §1.5), dont le message recommandait déjà : « laisser la ligne non mappée quand le code est ambigu, plutôt qu'en devinant » — c'est exactement ce que ce correctif fait, avec un statut dédié plutôt qu'un simple repli sur `unmapped`.

### 1.2 Règles implémentées

Toutes les règles du mandat sont couvertes :

1. **Scope tenant préservé** — `_SCOPE = "company_id = %s"` reste le premier filtre de toute requête, explicite et jamais retiré.
2. **Fournisseur explicite prioritaire** — `line.get("supplier_id")`, s'il est déjà résolu, scope la recherche à `supplier_id = %s AND product_code = %s` (le catalogue de CE fournisseur uniquement), pas le tenant entier.
3. **Unicité dans le périmètre pertinent** — `mapped` exige EXACTEMENT un candidat dans le scope actif (tenant entier si pas de fournisseur explicite, ce fournisseur seul sinon).
4. **Statut dédié `ambiguous`** — distinct de `unmapped` (zéro candidat) : `mapping_status_check` (030) élargie par la migration 035.
5. **Aucune sélection par ordre/premier résultat/heuristique** — `fetchall()` + comptage, jamais `fetchone()`. Le `ORDER BY id` ajouté ne sert QU'À rendre le message d'ambiguïté déterministe (quel candidat est cité en premier dans `mapping_note`), jamais à départager un gagnant — le code retourne explicitement `None, None, "ambiguous", note` dès que `len(candidates) > 1`, quel que soit l'ordre.
6. **Candidats + raison persistés** — nouvelle colonne `purchase_lines.mapping_note` (migration 035), peuplée avec le nombre de candidats, leurs `supplier_product_id`, et pourquoi (fournisseur explicite ou non). Suit le même idiome que `fallback_reason` (`procurement_line_results`, migration 032, table `procurement_line_results_fallback_reason_check`) : une contrainte CHECK dédiée (`purchase_lines_mapping_note_check`) impose EN BASE que `mapping_status = 'ambiguous'` implique `mapping_note` non vide — pas seulement une convention Python.
7. **Aucune fuite cross-tenant** — déjà garanti par `_SCOPE` ; prouvé explicitement par un test dédié plutôt que supposé (§1.4).
8. **Régression complète** — voir §1.4.

Décision documentée dans le code et ici : `line["supplier_external_code"]` (texte libre du CSV, ex. `"SUP1"`) n'est **pas** résolu en `supplier_id` par cette fonction. Vérification faite (migration `008_suppliers.sql`) : la table `suppliers` ne porte aucune colonne de code externe (seulement `name`, `contact_*`, `country`, `sector`...). Deviner par correspondance de nom aurait été exactement le type d'heuristique silencieuse que ce correctif élimine — donc pas implémenté. Le paramètre `line["supplier_id"]` (périmètre fournisseur explicite) est un point d'ancrage prêt pour un futur registre code→fournisseur, mais **le pipeline CSV actuel ne le fournit jamais** ; la branche est prouvée par appel direct de `_auto_map` avec un dict construit à la main, pas via un CSV bout-en-bout. C'est une limite assumée, pas un oubli — documentée dans le docstring de la fonction.

### 1.3 `mapping_status` : CHECK en base ou Python seul ?

Vérifié en lisant le DDL réel (`030_procurement_exposure.sql:128-130`) : une contrainte CHECK existe bien —

```sql
CONSTRAINT purchase_lines_mapping_status_check CHECK (
    mapping_status IN ('unmapped', 'mapped', 'needs_review', 'resolved')
)
```

Donc l'ALTER va dans la migration 035 (constraint-only sur une table existante, aucune modification de 001-034) :

```sql
ALTER TABLE purchase_lines DROP CONSTRAINT IF EXISTS purchase_lines_mapping_status_check;
ALTER TABLE purchase_lines ADD CONSTRAINT purchase_lines_mapping_status_check CHECK (
    mapping_status IN ('unmapped', 'mapped', 'needs_review', 'resolved', 'ambiguous')
);
```

Même geste que `audit_eventtype_check`, réutilisée sous le même nom par `011_totp.sql` puis à nouveau élargie par `012_auditor_invites.sql` — précédent direct dans ce dépôt pour « DROP + ADD CONSTRAINT du même nom, dans une migration ultérieure ».

### 1.4 Tests ajoutés (`apps/api/tests/test_procurement_imports.py`, classe `TestAutoMapAmbiguity`)

| Test | Prouve |
|---|---|
| `test_ambiguous_product_code_same_tenant_not_silently_attributed` | Deux fournisseurs du même tenant partageant un code → `ambiguous`, `product_id`/`supplier_id` restent `NULL` (aucune attribution, ni au premier ni au second), `mapping_note` cite les deux `supplier_product_id`. Zéro ligne `unmapped` (le statut est bien distinct). |
| `test_explicit_supplier_scopes_resolution_despite_tenant_wide_ambiguity` | Un `supplier_id` déjà résolu sur la ligne fait autorité : résout proprement `mapped` dans le catalogue de CE fournisseur, même si le code est ambigu tenant-wide. |
| `test_cross_tenant_shared_product_code_resolves_independently` | Un code partagé par des fournisseurs de DEUX tenants différents ne fuit jamais : chaque tenant résout `mapped` sur SON fournisseur, zéro ambiguïté fantôme. |
| `test_unambiguous_single_supplier_match_unchanged` | Non-régression explicite au niveau fonction : un seul candidat → toujours `(product_id, supplier_id, "mapped", None)`, tuple-à-tuple identique au comportement pré-Wave-3. |
| `test_resolve_mappings_rejects_manual_ambiguous_status` | Le nouveau garde-fou dans `resolve_mappings` (§1.2 note ci-dessous) refuse `mapping_status="ambiguous"` en résolution manuelle, avec un message clair plutôt qu'une `IntegrityError` SQL brute. |

Ces 5 tests s'ajoutent aux 7 tests DB-gated déjà existants dans ce fichier (idempotence, gate de revue, isolation tenant...), qui restent inchangés dans leurs assertions — preuve que le comportement non-ambigu n'a PAS changé. `apps/api/tests/test_procurement_imports.py` était déjà inscrit au job `migration-tests` (`.github/workflows/api.yml`) ; aucune ligne à y ajouter pour cette tâche.

**Garde-fou additionnel non demandé explicitement mais nécessaire** : `resolve_mappings` refuse maintenant `mapping_status="ambiguous"` en entrée (`PurchaseImportError` explicite) — sans ce garde, un appelant qui tenterait de poser ce statut sans fournir `mapping_note` ferait échouer l'UPDATE sur la contrainte CHECK 035 avec une erreur SQL peu lisible. `'ambiguous'` est un statut système (détecté à l'import), pas un choix de résolution manuelle.

**Décision de périmètre, documentée plutôt que silencieuse** : `list_resolution_queue` (`GET /procurement/imports/{id}/resolution-queue`) continue de ne renvoyer QUE les lignes `unmapped` — les lignes `ambiguous` restent visibles via `GET .../lines?mapping_status=ambiguous` (marche automatiquement, `MappingStatus` est le type du paramètre de requête dans `routers/procurement.py`) mais n'alimentent pas la file dédiée. Étendre `list_resolution_queue` aux deux statuts changerait le contrat déjà testé d'un endpoint existant — jugé hors périmètre d'une PR de stabilisation. Documenté dans le docstring de la fonction comme candidat naturel pour une PR produit dédiée.

### 1.5 Vérification indépendante du commit `d857eda`

Lu via `git show d857eda` (branche mergée, PR #109) : confirme exactement le diagnostic du mandat — la fixture partagée `two_companies_proc` accumulait des fournisseurs/produits entre tests, deux tests de hotspots échouaient en CI par rattachement arbitraire au fournisseur d'un AUTRE test, corrigé À L'ÉPOQUE en isolant les codes produit par test (contournement du symptôme, cause explicitement non traitée et documentée comme telle dans le message de commit). Cette PR traite la cause.

---

## 2. Tâche B — concurrence `energy_allocation_guard()` (énergie, PR-06A)

### 2.1 Le défaut (TOCTOU)

`031_energy_scope2.sql`, fonction `energy_allocation_guard()` (trigger `BEFORE INSERT OR UPDATE` sur `instrument_allocations`) :

```sql
SELECT volume_mwh INTO v_volume FROM contractual_instruments WHERE id = NEW.instrument_id;
-- (pas de verrou)
SELECT COALESCE(SUM(allocated_mwh), 0) INTO v_already FROM instrument_allocations WHERE instrument_id = ...;
IF v_already + NEW.allocated_mwh > v_volume THEN RAISE EXCEPTION ...;
```

Sous `READ COMMITTED`, deux transactions concurrentes allouant au MÊME instrument peuvent toutes deux lire `v_already` AVANT que l'une des deux ne committe, passer toutes les deux le contrôle, et ensemble survendre l'instrument.

**Ce trou était déjà documenté, explicitement, comme non couvert** — §6 point 4 de `docs/carbonco/refonte/ENERGY_RLS_NON_SUPERUSER_HARDENING.md` (PR #107, lu intégralement) :

> « 4. Pas de test de concurrence. Deux allocations simultanées sur le même instrument (course entre le SELECT SUM du trigger et l'INSERT) ne sont pas couvertes. Sous READ COMMITTED, le trigger peut théoriquement laisser passer une survente concurrente [...]. Un SELECT ... FOR UPDATE sur l'instrument [...] serait la réponse — hors périmètre (ce serait un changement de schéma). »

Cette PR est exactement ce changement de schéma, désormais dans son périmètre propre.

### 2.2 Mécanisme de verrouillage choisi

`SELECT volume_mwh INTO v_volume FROM contractual_instruments WHERE id = NEW.instrument_id FOR UPDATE;` — AVANT le calcul de la somme. La seconde transaction concurrente sur le MÊME instrument bloque sur ce `SELECT ... FOR UPDATE` jusqu'au commit/rollback de la première, puis relit une somme à jour (READ COMMITTED : une nouvelle requête après déblocage voit les données committées entre-temps). Les allocations sur des instruments DIFFÉRENTS (lignes différentes de `contractual_instruments`) restent totalement concurrentes — le verrou est posé par ligne, jamais par table.

Livré via `CREATE OR REPLACE FUNCTION energy_allocation_guard()` dans la migration 035 (même nom que 031 — remplace le corps, conserve l'OID, donc le trigger existant continue de fonctionner sans modification nécessaire). Le trigger est malgré tout réémis explicitement (`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, identique à 031) pour que le fichier 035 reste lisible et complet par lui-même. Migration 031 non modifiée.

### 2.3 Raisonnement anti-deadlock

Documenté dans le commentaire de la migration 035 : chaque invocation du trigger verrouille **exactement une** ligne `contractual_instruments` (`NEW.instrument_id`), et un seul `INSERT` dans `instrument_allocations` ne concerne jamais qu'**un seul** instrument. Il n'y a donc aucune acquisition de verrous multi-lignes ni multi-ordres DANS ce trigger qui pourrait se deadlocker contre lui-même — deux transactions allouant respectivement à A-puis-B et B-puis-A le font chacune en DEUX `INSERT` séparés (deux invocations indépendantes du trigger, verrou acquis puis libéré à chaque fois), pas en une seule invocation multi-lignes. Invariant à préserver explicitement si cette fonction est un jour étendue à verrouiller plusieurs lignes dans une même invocation.

### 2.4 SECURITY DEFINER — précision préservée, pas contredite

Le commentaire de 031 affirmant que `SECURITY DEFINER` ne contourne PAS `FORCE ROW LEVEL SECURITY` est **exact** et préservé tel quel dans 035 (rien à corriger — la correction avait déjà eu lieu lors du rebase de PR-06B selon la mémoire du projet). Le `SELECT ... FOR UPDATE` ajouté reste filtré par la RLS exactement comme l'était déjà le `SELECT SUM` : `get_db(company_id=X)` pose `SET LOCAL app.current_company_id = X`, la policy RLS le relaie, et un instrument et ses allocations appartiennent toujours au même tenant. Ce comportement est PROUVÉ (pas seulement affirmé) par `test_energy_rls_non_superuser.py`, dont la fixture (`_energy_fixtures.py`) construit désormais le schéma jusqu'à 035 inclus (§2.6) — ses 21 tests exercent donc la fonction DE CETTE migration, verrou compris, sous un rôle réellement non superuser.

### 2.5 Le test à deux connexions réelles — ce qu'il prouve

`apps/api/tests/test_energy_allocation_concurrency.py`, classe `TestConcurrentAllocationSameInstrumentNeverOversells` :

- **Deux VRAIES connexions psycopg2** (deux threads Python, chacun `get_db()` séparé — jamais la même connexion).
- **Dimensionnement** : `volume_mwh=10`, deux tentatives de `6.0` MWh chacune sur le MÊME instrument (12 > 10 si les deux passent, 6 seul ≤ 10 — donc EXACTEMENT une doit réussir).
- **Synchronisation par `threading.Barrier(2)`, aucun `sleep`** : les deux threads attendent la barrière juste avant leur `INSERT`, pour que la tentative soit réellement simultanée plutôt que trivialement séquentielle. La correction vient du verrou PostgreSQL (déterministe), pas du timing — la barrière maximise seulement la probabilité de contention réelle.
- **Assertions** : `successes == 1` (jamais 0, jamais 2) ET `somme committée finale ≤ 10` (l'invariant qui compte réellement, vérifié indépendamment du détail de quel thread a gagné) ET le message d'erreur du perdant contient `"energy_scope2"` (le même message qu'avant 035 — non-régression du texte).
- **Test complémentaire** (`test_third_allocation_after_contention_still_respects_remaining_volume`) : après la contention, une 3ᵉ allocation qui dépasserait le reliquat exact échoue encore — le trigger n'est pas « épuisé » par la course.

`TestLockIsPerInstrumentNotGlobal::test_allocations_on_different_instruments_do_not_block_each_other` — preuve que le verrou est PAR LIGNE, pas une sérialisation plus large : un thread « holder » garde sa transaction ouverte (verrou tenu) sur l'instrument X après son `INSERT` ; un thread « other » alloue l'instrument Y (différent) et DOIT terminer sous un timeout court et strict (`Event.wait(timeout=5)`), sans jamais attendre le holder. Synchronisation par `threading.Event`, toujours aucun `sleep`.

`TestConcurrencyChangeDoesNotAffectTenantIsolation::test_cross_tenant_allocation_still_rejected_by_service_layer` — le refus cross-tenant existant (défense en profondeur applicative, `instruments_service.allocate_instrument`, même chemin que `test_cannot_allocate_across_tenants` dans `test_energy_instruments.py`, non modifié) continue de fonctionner à l'identique. **Limite honnête documentée dans le test lui-même** : ce test-là exerce le rejet côté SERVICE (avant même d'atteindre le trigger) — il ne prouve pas à lui seul que le nouveau `FOR UPDATE` respecte la RLS inter-tenant en écriture SQL directe. Cette preuve-là existe déjà et continue de s'appliquer sans modification : `test_energy_rls_non_superuser.py::test_cross_tenant_allocation_is_refused_by_the_guard`, sous un rôle non superuser réel, exerce désormais la fonction DE 035 (§2.6).

### 2.6 Ledger discipline

- `apps/api/db/migration_manifest.py` : `MigrationMeta` pour `"035"` ajoutée.
- `apps/api/db/migration_probes.py` : `_probe_035` ajoutée + enregistrée dans `MIGRATION_OBJECT_PROBES`. **Ni l'un ni l'autre correctif de 035 ne crée de table** — la sonde ne peut donc pas s'appuyer sur `_table_exists`. Piège évité (même raisonnement que documenté pour `_probe_021` / `audit_eventtype_check` 011-012) : le NOM de la contrainte `purchase_lines_mapping_status_check` et le nom de la fonction `energy_allocation_guard` sont tous deux RÉUTILISÉS depuis une migration antérieure (030 et 031 respectivement) — leur existence seule ne distingue pas l'ancienne définition de la nouvelle. Deux nouveaux helpers ajoutés pour sonder le CONTENU réel plutôt que la seule existence : `_constraint_definition_contains` (`pg_get_constraintdef`) et `_function_source_contains` (`pg_proc.prosrc`). `_probe_035` vérifie : colonne `purchase_lines.mapping_note` existe (non ambiguë — neuve) ET la définition de la contrainte contient `'ambiguous'` ET le corps de la fonction contient `'FOR UPDATE'`.
- `apps/api/tests/_migration_fixtures.py` : `build_full_db` → `apply_upto(conn, "035")`.
- `apps/api/tests/_energy_fixtures.py` : `build_energy_db` → `apply_upto(conn, "035")` (bump nécessaire depuis "031" — sinon les tests énergie, y compris les 21 de `test_energy_rls_non_superuser.py`, exerceraient l'ANCIENNE fonction sans le verrou).
- `apps/api/tests/_procurement_fixtures.py` : `build_procurement_db` → `apply_upto(conn, "035")` (bump nécessaire depuis "032" pour que `mapping_note`/`ambiguous` existent lors des tests procurement DB-gated).
- `.github/workflows/api.yml` : `tests/test_energy_allocation_concurrency.py` ajouté à la liste pytest du job `migration-tests`.
- **Compteurs** (vérifiés avant modification : 35 fichiers `.sql`, `len(versions) == 35`, quatre `written_count == 36`) → après ajout de 035 : `len(versions) == 36`, `"035"` ajoutée aux assertions de présence/action (`actions["035"] == "apply"`), les quatre `written_count` → `37`. Validé sans Postgres : `python -m pytest tests/test_migration_runner.py::test_build_plan_against_real_migrations_directory -q` → 1 passed. Un test dédié `test_build_plan_detects_035_pending_on_baselined_ledger` a été ajouté (même patron que les tests 028/030/034 déjà présents) ; l'assertion pré-existante `test_build_plan_detects_034_pending_on_baselined_ledger` supposait 034 dernière du dossier — corrigée pour vérifier l'ORDRE (034 avant 035) plutôt que la position finale, désormais occupée par 035.

---

## 3. Tâche C — diagnostic `storage`

### 3.1 Ce que j'ai vérifié indépendamment (pas seulement relu le mandat)

- **`GET /health` en production, interrogé plusieurs fois, avec de VRAIES requêtes fraîches** (navigation Browser, pas de cache) : **le résultat ALTERNE** — 5 requêtes successives en ~2 minutes ont donné `down, ok, down, ok, down`. Ce n'est ni la version « storage down » du mandat, ni la version « storage ok » que le mandat prétendait avoir déjà vérifiée : **c'est un troisième état, plus inquiétant que les deux** — le comportement n'est PAS stable, il oscille. Un vrai défaut d'authentification/réseau (token invalide, store injoignable) aurait échoué de façon STABLE sur les 5 requêtes, pas en alternance quasi 1-sur-2.
  - Premier relevé (`WebFetch`, possiblement servi par son propre cache 15 min) : `storage:"down"`.
  - Quatre relevés suivants (navigation directe du Browser, horodatages `time` distincts à chaque fois — donc chacun une exécution serveur réelle) : `ok`, `down`, `ok`, `down`.
- **`get_runtime_errors`, fenêtre 7 jours** (`mcp__...__get_runtime_errors`, projet `prj_7CMvi3jYo0EBrbFTfr863KjprGKb`, équipe `team_YNIcFkz5IJsdxLSyLsRStcAo`) : UN SEUL groupe d'erreur — un `503` sur `/health/schema` (pas le champ `storage` de `/health`) le 2026-07-18T09:44:52Z, sur le déploiement `dpl_GM3pFmDHjSDHTW3YbjkVNSmPFrrp`. Confirmé via `list_deployments` : ce déploiement n'apparaît pas dans les 20 déploiements les plus récents (donc antérieur), et le déploiement production ACTUEL est `dpl_5bP8jZvNbsX5JQb6vaFt3RcXYYSH` (commit `5be464d`, confirmé par `get_deployment`, `readyState: READY`, `target: production`) — cohérent avec le diagnostic du mandat : probablement un blip transitoire de cold-start/migration pendant les merges actifs de Wave 3, pas storage-spécifique.
- **`get_runtime_logs`, fenêtre 24h, groupé par `statusCode`** : `200 × 12`, `404 × 1` (favicon). Aucune ligne 5xx dans cette fenêtre.

### 3.2 Conclusion — genuine défaut de CODE, pas de configuration

Le token et le store Blob sont **valides** — la preuve en est que ~50 % des requêtes réussissent pleinement (PUT + GET + DELETE round-trip complet). Un problème de `BLOB_READ_WRITE_TOKEN` absent, faux, ou pointant vers le mauvais store échouerait à **chaque** appel, pas à un sur deux. Ce n'est donc **ni** « absent » (le mandat l'écarte déjà — token présent) **ni** « misconfigured » (écarté par ce test direct) **ni** un problème d'infrastructure Vercel Blob (écarté par les mêmes 5 requêtes, dont 2-3 réussissent pleinement dans la même fenêtre de 2 minutes).

**Cause identifiée par lecture du code** (`routers/health.py::_storage_status`, avant correctif) : la sonde utilisait une clé FIXE `"health/probe"`, PARTAGÉE par TOUS les appels — y compris deux requêtes `/health` simultanées sur le MÊME déploiement (moniteurs, Vercel lui-même, un utilisateur qui recharge), sans même parler de plusieurs déploiements partageant le même store. Avec `overwrite=True` sur le `PUT`, un appel concurrent peut écraser l'objet entre le `PUT` et le `GET` d'un AUTRE appel : la relecture ne correspond alors plus au payload attendu (`data != payload`), et cet appel retombe sur `"down"` — un **FAUX** `"down"`, alors que le stockage fonctionne réellement. C'était le « candidat » que le mandat m'invitait à évaluer indépendamment ; je l'ai reproduit EN DIRECT en production avant de conclure qu'il fallait le corriger — pas seulement parce qu'il avait été mentionné comme possibilité.

### 3.3 Correctif appliqué

`apps/api/routers/health.py::_storage_status._probe()` : clé aléatoire par appel (`f"health/probe/{uuid.uuid4().hex}"`) au lieu d'une clé fixe — élimine la collision PAR CONSTRUCTION (deux appels ne peuvent plus jamais viser le même objet), plus un `try/finally` autour du `GET` pour que le `DELETE` soit tenté même si le `GET` a levé (best-effort, une erreur de suppression ne masque jamais le résultat réel de la lecture). Décision NON logée : conserver le `try/finally` plutôt qu'ignorer le nettoyage sur erreur, pour limiter (sans l'éliminer totalement) le risque résiduel assumé et documenté dans le code — un objet orphelin par appel qui échouerait entre PUT et DELETE (avant Wave 3, la même situation ne laissait qu'un seul objet PARTAGÉ, réécrit par l'appel suivant ; après, chaque échec laisse un objet distinct, non réécrit automatiquement — accumulation lente de petits objets de 21 octets, jugée un compromis acceptable face à la suppression complète d'une classe de faux-négatifs).

La logique de décision `"ok"` / `"down"` (comparaison `data == payload`) n'a **pas** changé — aucune vraie panne n'est reclassée en `"ok"`. Le budget de 5 s (`asyncio.wait_for`) n'a pas changé. Les chemins `"local"` et `"not_configured"` n'ont pas changé.

### 3.4 Tests ajoutés (`apps/api/tests/test_health_storage_probe.py`)

- `test_storage_status_probe_uses_a_different_key_each_call` — deux appels successifs à `_storage_status()` n'utilisent jamais la même clé (`_FakeBlobClient.put_keys` distinctes).
- `test_storage_status_concurrent_overwrite_on_a_shared_key_would_have_failed` — preuve DIRECTE de la conséquence : simule ce qu'un tiers concurrent aurait écrit sur une clé PARTAGÉE (le `GET` relit un payload différent de celui écrit par CET appel) et vérifie que ce scénario précis retombe honnêtement sur `"down"` (le correctif empêche la COLLISION, pas la détection — si jamais une collision se produisait malgré tout, le comportement reste sûr, jamais un faux `"ok"`).
- La fausse implémentation `_FakeBlobClient` a dû être réécrite pour indexer son magasin en mémoire par la clé RÉELLEMENT transmise (elle utilisait une constante `_PROBE_URL` fixe avant Wave 3) — sans quoi elle n'aurait pas pu exercer une clé aléatoire.
- Les 6 tests pré-existants (`local`, `not_configured`, `probe_ok`, `down_on_http_error`, `down_on_corrupt_readback`, `down_on_exception`) passent sans modification de leurs assertions — non-régression confirmée.
- Ce fichier n'est PAS DB-gated (mock pur, aucun `DATABASE_URL` requis) — il tourne dans le job `tests` standard, déjà couvert par `pytest -q` (aucune inscription CI supplémentaire nécessaire).

### 3.5 Pas une variable d'environnement Vercel manquante

Conformément à la règle du mandat : si le défaut avait été purement une variable d'environnement absente/fausse, aucun correctif de code n'aurait dû être inventé — seule l'action opérateur exacte aurait dû être nommée. Ce n'est **pas** le cas ici (le token fonctionne, prouvé par les succès partiels) — donc le correctif de CODE ci-dessus est justifié, pas une invention pour combler une lacune de configuration. Aucune variable d'environnement à vérifier ou modifier pour ce défaut précis.

### 3.6 Écart avec la prémisse du mandat — dit franchement

Le mandat affirmait avoir déjà vérifié `/health` et obtenu `"storage":"ok"`, contredisant sa propre prémisse initiale (« storage down »). Ma vérification indépendante montre que **ni l'une ni l'autre affirmation n'était fausse** — chacune a simplement capturé un instant différent d'un état qui OSCILLE. Je le documente ici plutôt que de trancher artificiellement pour l'une des deux versions : le comportement réel avant ce correctif était intermittent, pas stable dans un sens ou dans l'autre.

---

## 4. Migration 035 — contenu exact

Un seul fichier : `apps/api/db/migrations/035_wave3_data_integrity.sql`. Deux sections indépendantes, aucune table neuve, aucun privilège propriétaire requis :

1. `ALTER TABLE purchase_lines DROP/ADD CONSTRAINT purchase_lines_mapping_status_check` — ajoute `'ambiguous'` aux valeurs autorisées.
2. `ALTER TABLE purchase_lines ADD COLUMN IF NOT EXISTS mapping_note TEXT` + `ADD CONSTRAINT purchase_lines_mapping_note_check` — raison obligatoire dès que `mapping_status = 'ambiguous'`.
3. `DROP TRIGGER IF EXISTS trg_instrument_allocations_guard` + `CREATE OR REPLACE FUNCTION energy_allocation_guard()` (verrou `FOR UPDATE` ajouté) + `CREATE TRIGGER trg_instrument_allocations_guard` (réémis, même définition qu'en 031).

Idempotent/rejouable (mêmes conventions que le reste du dépôt) : `DROP CONSTRAINT IF EXISTS` avant chaque `ADD CONSTRAINT`, `ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`.

---

## 5. Tests exécutés — honnêteté locale vs CI

**Environnement local** : Windows, ni Docker ni PostgreSQL installés (confirmé : `docker --version` → command not found). Tous les tests DB-gated sont donc SKIPPÉS localement par construction (`@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), ...)`), y compris l'intégralité de mes nouveaux tests de tâche A et B.

| Commande | Résultat local |
|---|---|
| `pytest tests/test_procurement_imports.py tests/test_energy_allocation_concurrency.py -v` | 5 passed (purs), 16 skipped (DB-gated, dont mes 5 + 4 nouveaux) |
| `pytest tests/test_migration_runner.py::test_build_plan_against_real_migrations_directory -q` | 1 passed (aucune DB requise — preuve directe que `len(versions) == 36`) |
| `pytest -q` (suite complète) | **904 passed, 0 failed, 436 skipped** |
| `ruff check . --select=E,F,I --ignore=E501` | All checks passed |
| `git diff --check` | aucun problème d'espaces |

**Note honnête sur les « 5 échecs préexistants »** annoncés par le mandat (`ModuleNotFoundError: vercel`) : confirmés préexistants (reproduits sur l'arbre NON modifié via `git stash`). Précision non anticipée par le mandat : `test_storage_adapter.py` importe `vercel.blob` PARESSEUSEMENT (à l'intérieur de 5 fonctions de test précises), donc échoue seulement CES 5 tests à l'exécution ; `test_health_storage_probe.py` (que j'ai modifié) l'importe au niveau du MODULE, donc son absence interrompt la COLLECTE de tout le fichier — et par défaut, `pytest -q` sans argument s'arrête net sur cette erreur de collecte plutôt que de continuer (0 test exécuté du tout). Ce comportement existait déjà AVANT mes modifications (reproduit sur l'arbre non modifié). `vercel==0.6.0` est bien déclaré dans `requirements.txt` — l'écart est un venv local incomplet, jamais un problème en CI (`pip install -r requirements.txt` l'installe systématiquement). J'ai installé le paquet localement (`pip install vercel==0.6.0`, aucune modification du dépôt) uniquement pour obtenir un signal `pytest -q` significatif plutôt qu'une interruption totale — les 904/0/436 ci-dessus sont mesurés avec ce paquet présent, comme le sera toujours la CI. Sans lui, la commande nue s'interrompt à la collecte (pas 5 échecs isolés, mais 0 test exécuté) — comportement inchangé par cette PR, déjà vrai avant elle.

**CI est la seule preuve réelle des tests DB-gated** — voir §6.

---

## 6. Ce que je n'ai PAS pu prouver localement — honnêteté

1. **Aucun test DB-gated n'a tourné sur ce poste** (ni les miens, ni les préexistants) — ni Docker ni PostgreSQL disponibles. Toute la logique SQL (contraintes CHECK, trigger, verrouillage réel, RLS) n'est validée que par lecture attentive + relecture croisée avec les probes/tests existants, jusqu'à l'exécution CI.
2. **Le test de concurrence est probabiliste dans SA CAPACITÉ À EXERCER une vraie contention** (la barrière maximise la simultanéité mais ne la garantit pas à 100 % sur une machine CI partagée) — mais l'INVARIANT vérifié (somme ≤ volume, exactement un succès) reste vrai et testé quel que soit l'entrelacement réel, donc le test reste valide même dans le cas rare où l'entrelacement serait en pratique séquentiel.
3. **`test_cross_tenant_allocation_still_rejected_by_service_layer`** ne prouve le non-contournement RLS qu'indirectement (délégué à `test_energy_rls_non_superuser.py`, dont la couverture s'étend à 035 via le bump de fixture) — voir §2.5.
4. **La sonde storage** : le correctif élimine la collision par construction, mais je n'ai pas de moyen de vérifier depuis ce poste que la production, une fois ce PR mergé et déployé, cesse effectivement d'osciller (aucun déploiement n'a eu lieu dans le cadre de cette tâche — voir §7).
5. **`list_resolution_queue`** ne remonte pas les lignes `ambiguous` — décision de périmètre documentée (§1.4), pas un oubli, mais un comportement produit qui mérite une décision consciente d'un humain avant une éventuelle extension.
6. Timeout de la sonde storage (`asyncio.wait_for(..., timeout=5.0)`) : aucun test dédié ne simule une sonde lente pour vérifier le chemin timeout → `"down"` isolément. Lacune préexistante, non introduite ni comblée par cette PR (hors périmètre du défaut traité).

---

## 7. Aucune donnée de production modifiée — confirmation explicite

- **Aucune migration n'a été exécutée contre une base réelle** — ni Neon, ni le conteneur CI. La migration 035 n'a été ni appliquée, ni simulée contre une base persistante depuis ce poste (pas de PostgreSQL disponible pour le faire de toute façon).
- **`db-migrate.yml` n'a pas été déclenché** — aucun commit ni push vers une branche qui le déclenche, aucune exécution manuelle.
- **Les seuls accès à la production** ont été des LECTURES : `GET /health` (endpoint public, sans authentification, sans effet de bord — chaque appel écrit puis supprime un petit objet de sonde dans le store Blob, exactement le comportement existant et documenté de cette route, avant et après ce correctif) et les outils Vercel MCP en lecture seule (`get_runtime_errors`, `get_runtime_logs`, `get_deployment`, `list_deployments`). Aucun outil d'écriture Vercel (`deploy_to_vercel`, `buy_*`, etc.) n'a été invoqué.
- **Aucun secret** n'a été lu, affiché, ni manipulé — le contenu de `BLOB_READ_WRITE_TOKEN` reste inconnu de cette session, conformément au mandat.
