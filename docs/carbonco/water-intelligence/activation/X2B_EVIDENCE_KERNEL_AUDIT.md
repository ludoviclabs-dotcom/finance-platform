# X2B — Audit du noyau de preuve avant tout graveur Eau

**Phase :** X2B — graveur Evidence Kernel et releases staging
**Branche :** `feat/water-evidence-kernel-staging-ingestion`
**Base :** `master` à `8993dc6` (PR #162, #163, #164 fusionnées)
**Audité le :** 2026-07-26

**Écritures en base pendant cet audit : 0. Migration proposée : 0.**

Cet audit précède le code. Son objet est de répondre à une question et une
seule : **le noyau de preuve existant peut-il porter une release Eau en
staging telle quelle, sans second noyau, sans registre parallèle et sans
migration ?**

La réponse est **oui pour la release**, avec **une limite nommée** sur
l'identité des observations (§6 et §11). Aucun statut n'est simulé dans un
champ libre ni dans du JSON.

---

## 0. Périmètre lu

| Objet | Emplacement |
|---|---|
| Schéma du noyau | `apps/api/db/migrations/028_evidence_kernel.sql` (6 tables, RLS, triggers) |
| Vue de fraîcheur | `apps/api/db/migrations/029_source_admin.sql` (aucune table) |
| Modèles 1:1 | `apps/api/models/intelligence.py` |
| Services d'écriture | `apps/api/services/intelligence/{source,release,observation,ingestion,artifact,claim_link}_service.py` |
| Orchestrateur multi-étapes | `apps/api/services/intelligence/snapshot_migration.py` |
| Politique de licence | `apps/api/services/intelligence/license_policy.py` |
| Contrats P02 Eau | `apps/api/models/water_intelligence.py` |
| Pipeline P03 Eau | `apps/api/services/water_intelligence/pipeline.py` |
| Identité Eau | `apps/api/services/water_intelligence/observation_identity.py` |
| Décisions de publication Eau | `apps/api/services/water_intelligence/publication_decisions.py` |
| Transactions | `apps/api/db/database.py` |

**Vérification faite :** aucune migration `029`→`043` n'ALTER une table du
noyau ni n'élargit une de ses contraintes CHECK. Le schéma du noyau est
exactement celui de `028`.

---

## 1. Quelle table représente une source ?

`source_registry` (`028:24-60`).

- Clé métier : `code TEXT NOT NULL`, unique via **deux index partiels** —
  `(code) WHERE company_id IS NULL` (sources globales) et
  `(company_id, code) WHERE company_id IS NOT NULL` (sources de tenant).
- Aucune colonne de statut de cycle de vie : seulement `active BOOLEAN`.
  `source_type` (`api`/`file`/`webpage`/`manual`/`licensed_feed`) est une
  nature, pas un état.

Les quatre sources Hub'Eau visées par X2B sont des **données publiques
d'État**, donc des lignes **globales** (`company_id IS NULL`).

## 2. Quelle entité représente une release ?

`source_releases` (`028:65-95`) — une ligne par version d'une source.

- `source_id` → `source_registry(id)`, **NOT NULL**.
- `release_key TEXT NOT NULL`, `checksum_sha256 TEXT NOT NULL`.
- `status TEXT NOT NULL`, **sans DEFAULT** — chaque INSERT doit le déclarer.
- Idempotence native : `UNIQUE (source_id, release_key, checksum_sha256)`.

## 3. Où sont conservés checksum, licence, attribution, méthode, version de méthode, période, géographie, statut de publication ?

| Élément | Emplacement réel | Remarque |
|---|---|---|
| Checksum | `source_releases.checksum_sha256` (NOT NULL) ; `evidence_artifacts.sha256` (NOT NULL) | Deux noms de colonne différents pour la même notion — piège de recopie |
| Licence | `source_registry.license_code` + **6 booléens** (`automated_access_allowed`, `storage_allowed`, `commercial_use_allowed`, `redistribution_allowed`, `derived_use_allowed`, `display_allowed`) + `terms_uri` | Aucune table `license_decisions` |
| Attribution | `source_registry.attribution_text` | |
| Méthode | **Aucune table.** `observations.methodology_version TEXT` (nullable) ; côté Python `MethodRef(code, version)` dans `models/analytics.py:55-59` | Le `code` de méthode n'a **aucune colonne** dans `observations` — seule la version en a une (§11) |
| Version de méthode | `observations.methodology_version` | |
| Période | `observations.valid_from` / `valid_to` (+ `observed_at`) ; `source_releases.valid_from` / `valid_to` | |
| Géographie | `observations.geography_code TEXT` | Le **scope** (`world`/`country`/`station`…) n'a pas de colonne (§11) |
| Statut de publication | `source_releases.status` + `published_at` | Seule source de vérité du cycle |

**La licence est une donnée du registre, jamais une autorisation de
publication.** `license_policy.evaluate()` (`license_policy.py:17-71`) rend un
`LicenseDecision(allow_ingest, allow_store, allow_display, allow_derived_use)`
qui n'est **pas persisté** ; la seule trace en base d'un refus est
`status='blocked_license'`. L'autorisation de publier, côté Eau, est un objet
distinct : `publication_decisions.CURRENT_DECISIONS` — **aucune des 7 sources
n'y est `approved`** (2 `refused`, 5 `proposed`).

## 4. Comment les artefacts sont-ils stockés ?

`evidence_artifacts` (`028:101-124`) porte les **métadonnées** ; les octets
vont dans un magasin externe via `services.storage.get_storage()` —
`LocalStorage` par défaut (`STORAGE_BACKEND` non défini ⇒ `local`), Vercel
Blob **privé** en production. Aucun octet n'est stocké en base.

- `blob_key TEXT NOT NULL`, `sha256 TEXT NOT NULL`, `filename`, `mime_type`,
  `size_bytes`, `sensitivity` (`public`/`internal`/`confidential`/`restricted`).
- `source_release_id` est **nullable** — un artefact peut exister hors release.
- **Aucune contrainte UNIQUE** : `idx_evidence_artifacts_sha256` n'est pas
  unique. `artifact_service.register_artifact` ne déduplique pas du tout ;
  seul `snapshot_migration._register_global_artifact` (`:429-460`) fait un
  SELECT-avant-INSERT sur `(sha256, company_id IS NULL)`. C'est ce dernier
  motif que X2B reprend.

## 5. Existe-t-il une distinction native récupéré / validé / staging / publié / rejeté ?

**Partiellement.** `source_releases.status` est contraint par
`source_releases_status_check` (`028:83-85`) à exactement six valeurs :

```
'detected', 'quarantined', 'validated', 'published', 'superseded', 'blocked_license'
```

| Notion demandée | Valeur native | Verdict |
|---|---|---|
| récupéré | `detected` | ✅ exact |
| validé | `validated` | ✅ exact |
| **staging** | — | ❌ **le littéral `staging` n'existe dans aucune contrainte, aucun fichier SQL** |
| publié | `published` | ✅ exact |
| rejeté | `quarantined` (schéma) / `blocked_license` (licence) | ✅ deux motifs distincts |

`ingestion_runs.status` (`028:146-148`) porte un vocabulaire voisin :
`pending`, `running`, `quarantined`, `validated`, `published`, `failed`,
`blocked_license`. `observations.data_status` (`verified`/`estimated`/
`manual`/`inferred`) est une **qualité d'ingestion**, pas un cycle de
publication : une observation n'a aucun état publié/brouillon.

**Conséquence, et c'est le point central de cet audit :** « staging » n'est
pas un état de release manquant, c'est le **nom que ce chantier donne à
l'état `validated`** — validée, non publiée, `published_at IS NULL`. Voir §10.

## 6. Comment fonctionne l'idempotence ?

Trois niveaux, de la plus forte à la plus faible garantie :

| Objet | Mécanisme | Garantie |
|---|---|---|
| Release | `UNIQUE (source_id, release_key, checksum_sha256)` + `ON CONFLICT DO NOTHING` + relecture scopée (`release_service.py:51-79`) | **Base** — rejouer les mêmes octets ne crée jamais de doublon |
| Run d'ingestion | `UNIQUE (idempotency_key)` + `ON CONFLICT DO NOTHING` (`ingestion_service.py:59`) | **Base** — sérialise aussi deux ingestions concurrentes de la même release |
| Source globale | `ON CONFLICT (code) WHERE company_id IS NULL DO NOTHING` | **Base** |
| Artefact | SELECT-avant-INSERT sur `sha256` (`snapshot_migration.py:436-443`) | **Applicative** — fenêtre TOCTOU, index non unique |
| **Observation** | **aucune contrainte, aucun index unique** | **Aucune garantie native** |

L'idempotence des observations est aujourd'hui assurée par un ensemble
Python chargé avant la boucle d'écriture (`snapshot_migration.py:526-536`), sur
la clé `ObservationDraft.dedup_key() = (subject_type, subject_key,
metric_code)`. **Ce comportement est « le premier gagne » en silence** — c'est
exactement le défaut que `WaterObservationIdentity` a été écrit pour empêcher
(`observation_identity.py:14-21` : une telle clé « écraserait silencieusement
toutes les périodes sauf la première »).

X2B n'utilisera donc **jamais** `dedup_key()` (§11).

## 7. Comment fonctionne le rollback ?

**Il n'existe aucun rollback post-commit, et c'est structurel.**

`evidence_kernel_guard()` (`028:453-525`) :

- mode `frozen` sur `observations` : **toute** UPDATE et **toute** DELETE
  lèvent une exception. Une correction = nouvelle ligne + `supersedes_id` ;
- mode `source_release` : DELETE **toujours** refusée (registre append-only) ;
- mode `evidence_artifact` : DELETE refusée si l'artefact est référencé.

Aucune fonction, aucun script, aucune route ne supprime une release ou ses
observations. Le seul nettoyage existant est celui des **teardowns de test**,
qui doivent poser `SET session_replication_role = replica` pour désactiver les
triggers — un geste réservé au superuser de CI.

Le seul rollback disponible est donc celui de la **transaction ouverte** :
`get_db()` / `get_admin_db()` (`database.py:59-80`, `:102-125`) committent à la
sortie du contexte et `rollback()` sur exception. **Aucun service n'appelle
`commit()` lui-même.**

**Conséquence pour X2B :** « rollback complet » ne peut signifier qu'une
chose — **une seule transaction, tout ou rien, avortée avant commit**. Toute
autre lecture (suppression compensatoire après coup) est impossible sans
superuser et serait une violation du caractère append-only du noyau.

**Conséquence structurelle sur la réutilisation des services :** chaque
fonction de `services/intelligence/*_service.py` ouvre **sa propre**
`get_db()`, donc **sa propre transaction**. Les enchaîner donnerait 4 à 6
transactions distinctes et un état partiel en cas d'échec au milieu. Le
graveur X2B ne peut donc pas les appeler telles quelles ; il reprend le motif
déjà éprouvé de `snapshot_migration.import_snapshot` (`:567-582`, « Une seule
transaction : source → artefact → release → observations »), où chaque
helper reçoit un `cur` nu et n'ouvre jamais de connexion. **Ce n'est pas un
second noyau : ce sont les mêmes tables, le même vocabulaire de statut, la
même politique de licence et les mêmes modèles — un second *graveur*, pas un
second *noyau*.**

## 8. Comment une observation est-elle rattachée à une release ?

`observations.source_release_id BIGINT **NOT NULL** REFERENCES
source_releases(id)` (`028:176`). Toute observation appartient donc
obligatoirement à une release.

- Il n'y a **aucun FK direct** observation → source : le chemin est
  `observations.source_release_id` → `source_releases.source_id` →
  `source_registry.id`.
- **Aucune précondition de statut** n'existe, ni en SQL ni en Python
  (`observation_service.py:77-96` n'en vérifie aucune) : une observation peut
  légalement être rattachée à une release `detected`, `quarantined`,
  `validated` ou `blocked_license`. C'est précisément ce qui rend l'ingestion
  staging possible sans migration.

## 9. Comment le noyau distingue-t-il données publiques et données tenant ?

Par la **nullabilité de `company_id`**, sur les six tables :

- `company_id IS NULL` = ligne **globale**, lisible par tous les tenants ;
- `company_id NOT NULL` = ligne **privée** d'un tenant.

La RLS (`ENABLE` + `FORCE`, policies **par commande**) encode l'asymétrie :

```sql
FOR SELECT USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id IS NULL                      -- lecture globale : autorisée
    OR company_id = NULLIF(current_setting('app.current_company_id', true), '')::bigint
);
FOR INSERT WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR company_id = NULLIF(...)::bigint        -- écriture globale : JAMAIS par un tenant
);
```

Un tenant ne peut donc **jamais** créer ni modifier une ligne globale : seul
`app.rls_bypass = 'on'` (opérateur/admin) le peut. Les données Hub'Eau étant
publiques et non tenant, X2B écrit des lignes **globales** et refuse tout
identifiant de tenant dans son entrée.

## 10. Le schéma actuel peut-il représenter une release staging sans migration ?

**Oui.** Une release Eau en staging est représentée nativement par :

| Colonne | Valeur | Justification |
|---|---|---|
| `status` | `'validated'` | Valeur **native** de `source_releases_status_check`. Elle signifie exactement « validée, non publiée » |
| `published_at` | `NULL` | Aucune publication |
| `company_id` | `NULL` | Donnée publique de référence, jamais tenant |
| `checksum_sha256` | checksum réel de l'artefact | NOT NULL, vérifié avant écriture |

Trois arguments rendent ce choix préférable à l'ajout d'un statut `'staging'` :

1. **`validated` est la précondition exacte de la publication.**
   `release_service.publish_release` (`:159`) exige `status == 'validated'`.
   Un statut `'staging'` inventé obligerait à modifier ce service partagé, ou
   à ajouter une transition `staging → validated` qui ne dit rien de plus.
   X4 pourra promouvoir la release **sans une ligne de code nouvelle**.
2. **Le trigger laisse `validated` librement mutable** (`028:487`) : seuls
   `published` et `superseded` sont gelés. L'état staging reste donc
   corrigeable, ce qu'exige une répétition (X3).
3. **Aucune simulation.** Le statut n'est écrit ni dans un champ libre ni
   dans `metadata` JSONB. `metadata` ne portera aucune clé de statut.

**Aucune migration n'est donc nécessaire, et aucune ADR de blocage n'est
ouverte.** La condition d'arrêt de la consigne (« si le schéma ne peut pas
représenter proprement une release privée staging ») **n'est pas atteinte**.

Le mot « staging » reste employé dans ce chantier pour désigner
l'**environnement cible** de l'écriture — une garde du graveur, pas une
colonne.

---

## 11. Limites nommées (ce que le schéma ne porte pas)

Ces limites ne bloquent pas X2B ; elles bornent ce qu'il peut prétendre
garantir, et sont donc écrites ici plutôt que découvertes plus tard.

### 11.1 L'identité Eau complète n'est pas persistable

`WaterObservationIdentity` (`observation_identity.py:107-144`) porte **12
champs**. La table `observations` n'en stocke qu'une **projection** :

| Champ d'identité | Colonne | Persisté ? |
|---|---|---|
| `schema_version` | — | ❌ (constante `1.0.0`) |
| `source_code`, `release_key` | via `source_release_id` | ✅ indirect |
| `subject_type`, `subject_key`, `metric_code` | idem | ✅ |
| `geography_code` | `geography_code` | ✅ |
| `geography_scope` | — | ❌ |
| `period_start`, `period_end` | `valid_from`, `valid_to` | ✅ |
| `scenario_code`, `horizon_year` | — | ❌ |

Il n'existe **ni colonne d'empreinte, ni index unique** sur `observations`,
et **aucune colonne `metadata`** où en loger une. Conséquences retenues :

- l'idempotence et la détection de collision sont **applicatives**, faites
  dans la transaction unique, sur la projection ci-dessus, avec comparaison
  du **contenu** (valeur, unité, statut, méthode) — jamais un « premier
  gagne » silencieux ;
- deux identités qui ne diffèrent **que** par `scenario_code` ou
  `horizon_year` se projetteraient sur la même ligne. X2B **refuse donc toute
  observation porteuse d'un scénario**, plutôt que d'écrire une identité
  qu'il ne saurait pas relire. Les quatre familles Hub'Eau sont des mesures
  observées, sans scénario : la restriction ne les affecte pas ;
- la concurrence est bornée par `ingestion_runs.idempotency_key UNIQUE`, qui
  sérialise deux ingestions de la même release ;
- **levée future** : une migration ajoutant `observations.identity_fingerprint`
  + index unique rendrait la garantie native. Elle n'est **pas** proposée ici
  — X2B n'en a pas besoin pour les sources qu'il admet, et une migration se
  décide sur un besoin démontré.

### 11.2 Le code de méthode n'a pas de colonne

`observations` porte `methodology_version` mais **pas** `methodology_code`.
Le contrat X2B exige méthode **et** version : la version part dans sa colonne,
le code reste porté par la release (`metadata`) — c'est une **donnée
descriptive de provenance**, pas un statut simulé.

### 11.3 Une valeur retenue ne peut pas être écrite

`observations_value_presence_check` (`028:187-191`) exige qu'au moins une des
trois colonnes de valeur soit renseignée. Or `WaterMetricObservation`
(`models/water_intelligence.py:194-208`) **impose** `value_withheld=True` —
donc `value is None` — dès que `source.license.allow_display` est faux.

Une source dont la licence ne permet pas l'affichage produit donc des
observations **structurellement non insérables**. X2B ne contourne pas ce
mur : il **refuse explicitement** l'ingestion en le nommant, plutôt que
d'écrire des lignes vides ou de forcer un statut.

Ce point ne fait de la licence **aucune autorisation de publication** :
`allow_display` conditionne la possibilité de **stocker une valeur**, jamais
le passage à `status='published'`, qui reste soumis à une décision humaine
absente pour les sept sources.

### 11.4 Deux vocabulaires de statut de donnée coexistent

`WaterDataStatus` (`observed`/`modelled`/`estimated`/`manual`/`fixture`) et
le `data_status` du noyau (`verified`/`estimated`/`manual`/`inferred`) sont
**délibérément distincts** (`models/water_intelligence.py:18-26` interdit toute
conversion implicite). Le graveur doit porter une **table de correspondance
explicite**, refusant tout statut non cartographié.

---

## 12. Verdict

| Question | Réponse |
|---|---|
| Un second Evidence Kernel est-il nécessaire ? | **Non** — les 6 tables de `028` suffisent |
| Un registre Water parallèle est-il nécessaire ? | **Non** |
| Une release staging est-elle représentable sans migration ? | **Oui** — `status='validated'`, `published_at IS NULL`, `company_id IS NULL` |
| Un statut doit-il être simulé dans un champ libre ou du JSON ? | **Non** — aucune clé de statut n'ira dans `metadata` |
| Une ADR de blocage doit-elle être ouverte ? | **Non** — la condition d'arrêt n'est pas atteinte |
| Le développement fonctionnel X2B peut-il commencer ? | **Oui**, avec les limites §11 écrites |

Le graveur X2B réutilisera : `source_registry`, `source_releases`,
`evidence_artifacts`, `ingestion_runs`, `observations`,
`license_policy.evaluate`, les modèles `models/intelligence.py`,
`WaterObservationIdentity` et le motif transactionnel de
`snapshot_migration.import_snapshot`. Il n'ajoutera aucune table, aucune
colonne, aucun statut.
