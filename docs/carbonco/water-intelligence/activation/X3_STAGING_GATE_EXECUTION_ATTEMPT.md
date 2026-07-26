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

## 6. Ce que cette tentative n'a pas fait

- aucune écriture, aucune lecture de base ;
- aucun appel réseau ;
- aucune source enregistrée au Source Registry ;
- aucune décision de licence ou de publication ;
- aucune donnée synthétique produite en remplacement ;
- **X4, Phase B, WRI, EEA et Copernicus non commencés.**
