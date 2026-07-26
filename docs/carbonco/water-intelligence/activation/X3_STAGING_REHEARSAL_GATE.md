# X3 — Gate d'environnement staging : `staging_environment_missing`

**Phase :** X3 — répétition complète du pipeline avec artefacts réels en staging
**Branche :** `ops/water-staging-rehearsal`
**Base :** `master` à `e7d5951` (PR #162, #163, #164, #165 fusionnées)
**Exécuté le :** 2026-07-26

**Verdict : `staging_environment_missing`.**

**Écritures en base : 0. Acquisitions réseau : 0. Releases créées : 0.
Publications : 0. Migrations : 0. Repli sur la production : 0.**

---

## 1. Ce qui s'est passé

X3 §1 impose d'identifier la base PostgreSQL cible **avant toute acquisition
ou écriture**. Cette porte a été franchie en premier, et elle s'est **fermée** :
aucune base de staging n'existe dans cet environnement.

Conformément à la consigne, l'exécution s'est **arrêtée avant toute écriture**,
et **aucun repli sur la production n'a été tenté**.

L'ouverture de cette porte a par ailleurs révélé un **défaut réel du graveur
X2B**, corrigé dans cette même branche (§4). C'est le résultat principal de
X3 à ce stade : la répétition n'a pas pu avoir lieu, mais elle a montré que le
chemin d'écriture n'était pas sûr.

## 2. Preuve de l'absence

Constaté le 2026-07-26, sans jamais afficher ni consigner de secret :

| Vérification | Résultat |
|---|---|
| `WATER_STAGING_DATABASE_URL` | **absente** |
| `STAGING_DATABASE_URL` | absente |
| `DATABASE_URL`, `DATABASE_ADMIN_URL` | **absentes** |
| `POSTGRES_URL`, `NEON_DATABASE_URL`, `PGHOST`, `PGDATABASE` | absentes |
| Toute autre variable évoquant une base | **aucune** |
| Fichiers `.env` / `.env.local` (racine, `apps/api`, `apps/carbon`) | **aucun** |
| Convention staging dans le dépôt (workflows, docs, code) | **aucune** — recherche sur `STAGING_DATABASE_URL`, `WATER_STAGING`, `DATABASE_URL_STAGING` : zéro occurrence |
| Binaires PostgreSQL locaux (`psql`, `pg_ctl`, `postgres`, `initdb`) | **absents** |
| Runtime de conteneurs (`docker`, `podman`, `nerdctl`) | **absents** |
| Installation Windows `C:\Program Files\PostgreSQL` | **absente** |

Le seul environnement de base connu du dépôt est l'environnement GitHub
**`production-db`** (`.github/workflows/db-migrate.yml:52`), protégé par une
approbation humaine et alimenté par le secret `DATABASE_ADMIN_URL`. **Il est
hors de question de s'en servir** : c'est exactement l'interdiction n°1 de
X3 §1.

**Option A (staging persistant)** : indisponible — aucune base non-production
n'est déclarée nulle part.

**Option B (staging éphémère)** : indisponible également — ni Docker, ni
podman, ni PostgreSQL local, et provisionner une base jetable exigerait soit
d'installer un serveur sur le poste, soit de créer une ressource cloud avec
des identifiants qui ne sont pas présents. Aucune de ces deux actions n'est du
ressort de cette phase.

## 3. Ce qui n'a donc PAS été fait

Aucune de ces étapes n'a été entamée, et aucune n'est simulée :

- acquisition réseau des artefacts réels (§4) — inutile sans cible d'écriture,
  et rejouer les mêmes recettes qu'en X2A sur des services publics officiels
  sans pouvoir en faire quoi que ce soit n'aurait rien prouvé de neuf ;
- déclaration des quatre sources au Source Registry de staging (§3) ;
- dry-run du graveur (§5) — il ouvre une **vraie** transaction, donc il
  requiert lui aussi une base prouvée ;
- ingestion, release `validated`, snapshot candidat privé.

**Aucun artefact fictif ou synthétique n'a été produit pour compenser.** Une
répétition sur des données inventées ne prouverait pas le parcours ; elle
prouverait seulement qu'on sait fabriquer un rapport.

## 4. Défaut trouvé et corrigé : `--environment staging` ne gardait rien

En instrumentant la porte, un écart réel est apparu dans le graveur livré par
X2B :

- `WaterStagingIngestionRequest._check_environment()` valide que
  `--environment` vaut la **chaîne** `staging` ;
- mais `ingest_release.py` ouvrait sa connexion via
  `db.database.get_admin_db()`, qui résout `DATABASE_ADMIN_URL` puis
  **retombe silencieusement sur `DATABASE_URL`**
  (`db/database.py:83-99`).

Conséquence : sur une machine portant les identifiants de production — le
runner de `db-migrate.yml`, ou un poste d'opérateur configuré pour la prod —
`ingest_release --commit --environment staging` aurait écrit **dans la base de
production**, et le mot « staging » n'y aurait rien changé. Le drapeau était
une **déclaration d'intention**, pas une garde.

C'est précisément l'interdiction que X3 §1 formule : « ne jamais utiliser
automatiquement `DATABASE_URL` sans avoir prouvé sa destination ».

### Correction livrée

`apps/api/services/water/staging_environment.py` :

| Règle | Mise en œuvre |
|---|---|
| URL dédiée obligatoire | `WATER_STAGING_DATABASE_URL`, nom réservé ; **aucun repli** sur `DATABASE_URL`/`DATABASE_ADMIN_URL`. Le refus **nomme** ces variables et explique pourquoi il ne s'en sert pas — sinon l'opérateur croit à une panne et force |
| Production interdite | Refus inconditionnel si `VERCEL_ENV`, `ENVIRONMENT`, `APP_ENV`, `NODE_ENV` ou `DEPLOY_ENV` vaut `production`/`prod`, vérifié **avant même** de regarder l'URL |
| Destination **prouvée** | `--expect-database` obligatoire, confronté à `SELECT current_database()` **dans la transaction, avant toute écriture** — une faute de frappe dans l'URL échoue là, à coup sûr, sans rien avoir écrit |
| Secret jamais exposé | L'URL n'est ni journalisée, ni retournée, ni passée en argument de commande (un secret en argument atterrit dans l'historique du shell et la table des processus). Seuls le nom de base et le verdict circulent |
| Porte franchie en premier | Sur une machine de production, le premier message est le **refus**, pas une remarque sur un chemin de fichier |
| Dry-run non exempté | Il ouvre une vraie transaction : le laisser contourner la porte reviendrait à se connecter à la production « pour vérifier » |

Vérifié en exécutant réellement la CLI :

- `DATABASE_URL` de production présente, pas d'URL de staging →
  `ENVIRONNEMENT REFUSÉ — staging_environment_missing` ;
- URL de staging fournie **mais** `VERCEL_ENV=production` →
  `ENVIRONNEMENT REFUSÉ — production_environment_refused` ;
- `--expect-database` omis → la commande n'existe pas sans lui.

Aucune URL n'apparaît dans aucun de ces messages.

**Ce que la porte prouve, et ce qu'elle ne prouve pas.** Elle prouve qu'une
URL a été fournie sous un nom dédié, qu'aucun indicateur de production n'est
présent, et que la base atteinte porte bien le nom annoncé. Elle **ne peut pas**
prouver qu'une base ainsi déclarée n'est pas, en réalité, la production : cela,
seul l'opérateur le sait. Ce qu'elle supprime, c'est l'**accident silencieux**.

## 5. Prérequis exacts pour reprendre X3

### Option A — staging persistant (recommandé, débloque X4)

1. Provisionner une base PostgreSQL **non-production** (branche Neon dédiée,
   base séparée, ou instance distincte).
2. Y appliquer les migrations jusqu'à **029** au minimum (noyau Evidence
   Kernel `028` + vue de fraîcheur `029`).
3. Exporter dans l'environnement d'exécution, **jamais dans Git** :
   `WATER_STAGING_DATABASE_URL=<URL de cette base>`
4. Noter le **nom** de la base : il sera passé en `--expect-database`.
5. Vérifier qu'aucun indicateur de production n'est positionné dans cet
   environnement (`VERCEL_ENV`, `ENVIRONMENT`, `APP_ENV`, `NODE_ENV`,
   `DEPLOY_ENV`).
6. Déclarer les quatre sources Hub'Eau au Source Registry de cette base, avec
   leurs booléens de licence — **geste humain**, le graveur n'en crée aucune
   (cf. `X2_EVIDENCE_INGESTION_HANDOFF.md` §8).

### Option B — staging éphémère

Mêmes étapes 2 à 6, sur un PostgreSQL jetable (conteneur, instance locale).
Le rapport devra alors porter `ephemeral_staging`, et **X4 restera bloqué** :
des releases qui disparaissent avec leur base ne sont pas promouvables.

### Puis, dans l'ordre

1. acquisition bornée des quatre sources, mêmes recettes techniques qu'en X2A
   (même station hydrométrique, même point piézométrique, même territoire et
   même année BNPE, mêmes stations et codes SANDRE qualité), octets déposés
   **hors du dépôt** ;
2. dry-run du graveur pour les quatre sources ;
3. ingestion, release `validated` non publiée ;
4. snapshot candidat privé.

## 6. Ce que X3 n'a pas fait

- aucune écriture, nulle part ;
- aucun repli sur la production, ni tentative d'en approcher ;
- aucune acquisition réseau ;
- aucune donnée de tenant lue ou écrite ;
- aucune décision de licence, de publication ou d'approbation ;
- aucun `published`, aucun `published_at`, aucune entrée de snapshot public ;
- aucune migration ;
- aucun cron, aucune collecte automatisée ;
- **X4, Phase B, WRI, Copernicus et EEA non commencés.**
