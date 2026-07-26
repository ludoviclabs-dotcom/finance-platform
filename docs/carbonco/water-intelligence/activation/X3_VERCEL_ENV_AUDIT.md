# X3 — Audit non destructif des variables Vercel de `carbonco-api`

**Phase :** X3 — préalable à la répétition sur staging CI éphémère
**Branche :** `ops/water-staging-rehearsal-execution`
**Audité le :** 2026-07-26

**Modifications : 0. Valeurs lues : 0. Variables touchées : 0.**

---

## 1. Méthode et garanties

L'audit s'est fait via `vercel env ls` et `vercel integration ls`, **depuis un
répertoire temporaire hors du dépôt** — aucun `.vercel/` n'a été créé dans
l'arbre de travail, et `git status` est resté vide de bout en bout.

`vercel env ls` n'affiche **jamais** les valeurs : la colonne correspondante
vaut `Encrypted` pour chaque entrée. Aucune commande susceptible de révéler
une valeur (`vercel env pull`, `vercel env add`) n'a été exécutée.

Le `vercel link` temporaire dépose un jeton OIDC dans un `.env.local` local ;
les deux répertoires d'audit ont été **supprimés** à la fin, jeton compris.

Ce rapport ne contient aucune valeur, aucune URL, aucun hôte, aucun
identifiant, aucun secret — uniquement des **noms**, des **environnements**
et des **âges**.

## 2. Inventaire des noms — projet `carbonco-api`

27 entrées. Regroupées par âge, ce qui est l'information utile ici.

### 2.1 Famille « intégration Neon » — 103 jours

| Nom | Environnements |
|---|---|
| `NEON_PROJECT_ID` | Production, Preview, Development |
| `PGHOST` | Production, Preview, Development |
| `PGHOST_UNPOOLED` | Production, Preview, Development |
| `PGDATABASE` | Production, Preview, Development |
| `PGUSER` | Production, Preview, Development |
| `POSTGRES_HOST` | Production, Preview, Development |
| `POSTGRES_USER` | Production, Preview, Development |
| `POSTGRES_DATABASE` | Production, Preview, Development |
| `POSTGRES_URL` | Production, Preview, Development |
| `POSTGRES_URL_NO_SSL` | Production, Preview, Development |
| `POSTGRES_URL_NON_POOLING` | Production, Preview, Development |
| `POSTGRES_PRISMA_URL` | Production, Preview, Development |

Ce bloc porte la signature d'un provisionnement automatique par l'intégration
Neon : douze variables créées le même jour, mêmes trois environnements.

### 2.2 Famille « applicative », gérée à la main — 21 à 22 jours

| Nom | Environnements | Âge |
|---|---|---|
| `DATABASE_URL` | Preview *(entrée distincte)* | 22 j |
| `DATABASE_URL` | Production *(entrée distincte)* | 22 j |
| `DATABASE_URL_UNPOOLED` | Preview, Production | 22 j |
| `DATABASE_URL_DIRECT` | Preview, Production | 21 j |
| `RLS_FORCE` | Preview / Production *(deux entrées)* | 22 j |
| `STORAGE_BACKEND` | Preview / Production *(deux entrées)* | 22 j |
| `SIGNED_URL_SECRET` | Preview / Production *(deux entrées)* | 22 j |

### 2.3 Autres — application

| Nom | Environnements | Âge |
|---|---|---|
| `WORKER_MODE` | Preview, Production | 21 j |
| `SENTRY_DSN` | Production, Preview | 21 j |
| `NEXT_PUBLIC_SITE_URL` | Preview, Production | 21 j |
| `AUTH_JWT_SECRET` | Production | 103 j |
| `ALLOWED_ORIGINS` | Development, Preview, Production | 128 j |

### 2.4 Absente de Vercel

`DATABASE_ADMIN_URL` **n'existe pas** dans les variables de `carbonco-api`.
C'est un secret GitHub Actions, consommé uniquement par
`.github/workflows/db-migrate.yml` (environnement protégé `production-db`).
Cohérent avec l'architecture ; noté pour lever toute ambiguïté.

## 3. Intégrations connectées

| Projet | Ressource | Produit | Statut |
|---|---|---|---|
| `carbonco-api` | **`neon-purple-engine`** | Neon | ● Available |
| `carbon` | `account-byzantium-feather` | Inngest | ● Available |
| `carbon` | `upstash-kv-alizarin-ribbon` | Upstash for Redis | Uninstalled |

Le projet `carbon` ne porte **aucune** ressource Neon et **aucune** variable
de base de données.

## 4. Réponse à la question posée

> Déterminer si la ressource `neon-carbonco` récemment reliée a créé une
> nouvelle variable ou remplacé une variable préexistante.

**Aucune ressource nommée `neon-carbonco` n'a été trouvée**, ni sur
`carbonco-api`, ni sur `carbon`. La seule ressource Neon de l'équipe visible
depuis ces deux projets est **`neon-purple-engine`**, attachée à
`carbonco-api`.

**Aucune variable de `carbonco-api` n'a été créée ou modifiée récemment** : la
plus récente date de **21 jours**. Une connexion d'intégration survenue ces
derniers jours aurait laissé des variables d'âge nul — il n'y en a aucune.

**Conclusion : ni création, ni remplacement.** Sur la base des noms et des
dates observables, la connexion évoquée n'a produit aucun effet sur les
variables de `carbonco-api`. Deux lectures restent possibles et ne peuvent
pas être départagées sans information supplémentaire : la ressource a été
renommée depuis, ou la connexion n'a pas abouti sur ce projet.

## 5. Collision latente — documentée, NON corrigée

`carbonco-api` porte **deux familles de variables décrivant vraisemblablement
la même base**, d'origines différentes :

- la famille Neon (`POSTGRES_*`, `PG*`, `NEON_PROJECT_ID`), **posée par
  l'intégration** et donc **réécrite à chaque reconnexion** ;
- la famille applicative (`DATABASE_URL`, `DATABASE_URL_DIRECT`,
  `DATABASE_URL_UNPOOLED`), **gérée à la main**, et la seule que le code lise
  réellement (`db/database.py` : `DATABASE_ADMIN_URL` puis `DATABASE_URL`).

Aujourd'hui les deux familles sont **indépendantes** : l'application ne lit
aucune variable `POSTGRES_*`, donc une reconnexion de l'intégration ne peut
pas déplacer la destination de l'application.

Le risque est **de gouvernance, pas d'exécution** : deux sources de vérité
pour une même connexion, dont une seule est réécrite automatiquement. Si un
jour du code (ou une bibliothèque tierce lisant `POSTGRES_URL` par convention)
venait à consommer la famille Neon, les deux pourraient diverger sans que rien
ne le signale.

**Conformément à la consigne, rien n'est corrigé dans cette PR.** La décision
— aligner les deux familles, ou documenter explicitement laquelle fait foi —
appartient à l'exploitation de Carbon&Co, pas à X3.

## 6. Ce que cet audit n'a pas fait

- aucune variable créée, modifiée ou supprimée ;
- aucune valeur lue, affichée ou consignée ;
- aucune intégration connectée, déconnectée ou reconfigurée ;
- aucun `vercel env pull`, aucun `.env` produit dans le dépôt ;
- aucune ressource Neon créée ou touchée ;
- **aucune de ces variables ne sera utilisée par X3** : la répétition se fera
  sur un PostgreSQL éphémère de CI, isolé du réseau, sans aucun lien avec
  Vercel ni Neon.
