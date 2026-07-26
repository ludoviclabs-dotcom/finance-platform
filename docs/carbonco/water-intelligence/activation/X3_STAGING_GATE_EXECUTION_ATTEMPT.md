# X3 — Tentative d'exécution : `staging_credential_not_reachable`

**Phase :** X3 — répétition staging réelle (reprise après provisionnement)
**Branche :** `ops/water-staging-rehearsal-execution`
**Base :** `master` à `9a8e44b` (PR #162 à #166 fusionnées)
**Tenté le :** 2026-07-26

**Appels Hub'Eau : 0. Écritures : 0. Repli sur la production : 0.**

---

## 1. Préflight — vert

| Vérification | Résultat |
|---|---|
| PR #162, #163, #164, #165, #166 | **toutes fusionnées** |
| `carbon` / `carbonco-api` sur `9a8e44b` | **READY** |
| Migration la plus récente du dépôt | **043** |
| Branche `ops/water-staging-rehearsal-execution` | créée depuis `9a8e44b` |

## 2. Gate de base — échec à l'étape 1

L'autorisation humaine est bien reçue, et la base
`carbonco_water_staging` est annoncée comme provisionnée. Mais **la chaîne de
connexion n'atteint pas l'environnement d'exécution** de cette session.

| Emplacement vérifié | `WATER_STAGING_DATABASE_URL` |
|---|---|
| Environnement du processus | **absente** |
| Variable Windows, portée `User` | **absente** |
| Variable Windows, portée `Machine` | **absente** |
| `.env`, `.env.local`, `.env.staging` (racine, `apps/api`, `apps/carbon`) | **aucun fichier** |

Pour mémoire, également absentes : `STAGING_DATABASE_URL`, `DATABASE_URL`,
`DATABASE_ADMIN_URL`, et tout indicateur `production`.

**Aucune valeur n'a été affichée, lue ni consignée** au cours de ces
vérifications : seule la présence a été testée.

### Ce qui n'a donc pas été fait

Conformément à X3 §1 (« si une vérification échoue : arrêter ; ne faire aucun
appel Hub'Eau ; ne faire aucune écriture »), la séquence s'est arrêtée avant :

- toute connexion (`current_database()`, `current_user`, version, migration) ;
- toute inspection ou écriture du Source Registry de staging ;
- toute acquisition Hub'Eau ;
- tout dry-run, toute ingestion, tout snapshot candidat.

**Aucun repli sur `DATABASE_URL` / `DATABASE_ADMIN_URL` n'a été tenté**, et
aucune URL n'a été devinée ou reconstruite.

## 3. La porte X3 a fonctionné comme prévu

Ce blocage est le comportement correct de la porte livrée en PR #166 : elle
exige une URL fournie sous un nom réservé et refuse tout repli. Elle a
transformé une situation potentiellement dangereuse — « la base existe, il n'y
a qu'à se connecter » — en un arrêt net et lisible.

## 4. Ce qu'il faut pour reprendre

Un seul élément manque. La chaîne de connexion doit être **exportée dans
l'environnement où Claude Code s'exécute**, puis la session relancée (une
variable définie dans un autre terminal, ou après le démarrage de la session,
n'est pas héritée par les processus déjà lancés).

Sous PowerShell, en portée utilisateur persistante :

```
[Environment]::SetEnvironmentVariable('WATER_STAGING_DATABASE_URL','<URL>','User')
```

puis **redémarrer Claude Code** pour que la variable soit héritée.

Contraintes rappelées :

- l'URL ne doit **jamais** être collée dans la conversation, ni passée en
  argument de commande (elle atterrirait dans l'historique du shell et la
  table des processus) ;
- elle ne doit **jamais** être écrite dans un fichier suivi par Git ;
- l'environnement ne doit porter aucun indicateur `production`.

Prérequis restants côté base, inchangés depuis `X3_STAGING_REHEARSAL_GATE.md`
§5 : migrations appliquées **jusqu'à 043** (borne courante du dépôt), et base
nommée exactement `carbonco_water_staging` — le graveur confronte ce nom à
`current_database()` avant toute écriture.

## 5. Observation de sécurité, hors périmètre

Un fichier `.env.prod.tmp` est présent à la racine du dépôt principal
(`C:\Users\Ludo\finance-platform`). Il est **couvert par `.gitignore`
(`.env*`) et non suivi par Git** — aucune fuite dans l'historique.

Son contenu n'a **pas** été lu : son nom désigne la production, et X3 interdit
d'en approcher. Signalé simplement parce qu'un fichier d'identifiants de
production dans un arbre de travail mérite une décision explicite (le
déplacer hors du dépôt, ou le supprimer une fois son usage terminé) plutôt
que d'être découvert par hasard plus tard.

---

# Reprise — 2026-07-26, seconde tentative

**Verdict inchangé : `staging_credential_not_reachable`.**
**Appels Hub'Eau : 0. Écritures : 0. Repli : 0.**

La branche et le rapport du premier arrêt sont conservés ; cette section les
complète.

## 7. Ce qui a été vérifié cette fois

La variable a été annoncée configurée en portée utilisateur Windows, avec un
redémarrage complet de Claude Code. La vérification est donc allée plus loin
que la précédente : au lieu de se fier à l'environnement du processus (qui
peut ne pas hériter d'une variable posée après le démarrage), elle a lu le
**registre**, source de vérité des variables persistantes.

| Vérification | Résultat |
|---|---|
| `WATER_STAGING_DATABASE_URL` — environnement du processus | **absente** |
| `WATER_STAGING_DATABASE_URL` — portée Windows `User` | **absente** |
| `WATER_STAGING_DATABASE_URL` — portée Windows `Machine` | **absente** |
| `HKCU:\Environment` — inventaire complet des noms | **`OneDrive`, `Path`, `TEMP`, `TMP`** et rien d'autre |
| Nom approchant (`WATER`/`STAGING`/`DATABASE`/`POSTGRES`) dans le registre | **aucun** |
| `APP_ENV` (exigé à `staging` par le gate) | **absente**, toutes portées |

Aucune valeur n'a été lue ni affichée : seuls les **noms** de variables ont
été énumérés depuis le registre.

## 8. Diagnostic

`[Environment]::GetEnvironmentVariable(nom, 'User')` lit `HKCU:\Environment`
directement — indépendamment de la date de démarrage du processus appelant.
Une variable réellement persistée y apparaîtrait, restart ou pas. Le registre
ne contient aucune trace de la variable, ni sous ce nom ni sous un nom voisin.

**Ce n'est donc pas un problème d'héritage de session, et un nouveau
redémarrage n'y changera rien.** La variable n'a jamais été persistée.

Cause la plus probable : l'affectation a été faite sous la forme
`$env:WATER_STAGING_DATABASE_URL = '…'`, qui ne vaut **que pour le shell
courant** et disparaît avec lui. Seul
`[Environment]::SetEnvironmentVariable(nom, valeur, 'User')` écrit dans le
registre.

## 9. Reprise : deux variables, pas une

Le gate de la reprise exige désormais **`APP_ENV=staging`** en plus de l'URL.
Les deux manquent.

```
[Environment]::SetEnvironmentVariable('WATER_STAGING_DATABASE_URL','<URL>','User')
[Environment]::SetEnvironmentVariable('APP_ENV','staging','User')
```

Contrôle à faire **avant** de relancer Claude Code — il affiche `True/True`
sans révéler l'URL :

```
[bool][Environment]::GetEnvironmentVariable('WATER_STAGING_DATABASE_URL','User')
[Environment]::GetEnvironmentVariable('APP_ENV','User')
```

Si la première ligne rend `False`, l'écriture n'a pas eu lieu : inutile de
redémarrer.

---

# Troisième tentative — staging CI éphémère, 2026-07-26

**Verdict : `workflow_dispatch_requires_default_branch`.**
**Appels Hub'Eau : 0. Écritures : 0. Variable Carbon&Co touchée : 0.**

La piste du staging persistant local est abandonnée. L'outillage complet de la
répétition sur PostgreSQL éphémère de CI est **livré et poussé** ; il n'a pas
pu être **déclenché**.

## 11. Ce qui est prêt

| Livrable | État |
|---|---|
| Audit Vercel non destructif | livré (`X3_VERCEL_ENV_AUDIT.md`) |
| Workflow `water-x3-staging-rehearsal.yml` | livré, `workflow_dispatch` seul, `contents: read` |
| `staging_rehearsal.py` (`gate`/`migrate`/`seed-sources`/`verify`/`snapshot`) | livré, testé, derrière la porte d'environnement |
| Draft PR #167 | ouverte |

## 12. Le blocage

GitHub **n'enregistre un workflow `workflow_dispatch` que si son fichier
existe sur la branche par défaut**. Tant que
`.github/workflows/water-x3-staging-rehearsal.yml` n'est pas sur `master`, le
workflow n'existe pas pour l'API :

```
gh workflow run water-x3-staging-rehearsal.yml --ref ops/water-staging-rehearsal-execution
→ HTTP 404: workflow not found on the default branch

POST /actions/workflows/water-x3-staging-rehearsal.yml/dispatches  (ref explicite)
→ HTTP 404: Not Found
```

`gh api /actions/workflows` ne retourne aucune entrée correspondante : le
workflow n'est pas enregistré, donc pas déclenchable, quelle que soit la `ref`.

## 13. Pourquoi rien n'a été contourné

Deux contournements existent, et **les deux sont explicitement interdits** par
la consigne :

- **ajouter un déclencheur `push` ou `pull_request`** — la consigne §2 les
  proscrit nommément, et pour une bonne raison : ce workflow appelle des
  services publics officiels et écrit dans une base. Il ne doit jamais partir
  tout seul ;
- **merger** — la consigne §13 dit « ne merge pas ».

Aucun des deux n'a été fait. La décision appartient à l'exploitation.

## 14. Comment débloquer

Une seule action est nécessaire, et elle est réversible :

**faire arriver le fichier de workflow sur `master`.** Deux voies, au choix :

1. **PR dédiée minimale** (recommandé) — une PR ne portant que
   `.github/workflows/water-x3-staging-rehearsal.yml`, mergée sur `master`.
   C'est la pratique habituelle pour tout workflow manuel : le fichier doit
   être sur la branche par défaut pour devenir déclenchable. La PR #167 reste
   ouverte et non mergée ;
2. **merger #167** — écarté par la consigne en l'état.

Une fois le fichier sur `master`, la répétition se lance sur **cette branche**,
sans rien merger d'autre :

```
gh workflow run water-x3-staging-rehearsal.yml --ref ops/water-staging-rehearsal-execution
```

Le workflow monte alors son propre PostgreSQL éphémère, applique les
migrations jusqu'à 043, franchit le gate, déclare les quatre sources, acquiert
les quatre artefacts réels, exécute dry-runs puis ingestions, prouve
l'idempotence au rejeu, construit le manifeste candidat privé, et verse le
tout en artefacts GitHub Actions.

## 15. Ce que cette tentative n'a pas fait

- aucune écriture, aucune lecture de base ;
- aucun appel réseau ;
- aucune source enregistrée au Source Registry ;
- aucune décision de licence ou de publication ;
- aucune donnée synthétique produite en remplacement ;
- **X4, Phase B, WRI, EEA et Copernicus non commencés.**
