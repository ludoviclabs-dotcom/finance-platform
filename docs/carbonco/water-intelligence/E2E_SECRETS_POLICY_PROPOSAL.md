# Proposition — exécution E2E et politique de secrets

**Statut : PROPOSITION NON APPLIQUÉE.** Aucune modification du workflow E2E
n'est incluse dans la PR Wave E-Core. Ce document existe pour qu'une décision
humaine puisse être prise sur des faits, pas sur une intuition.

**Décision requise avant toute mise en œuvre.** Le modèle ne modifie pas la
politique de secrets.

---

## 1. L'état actuel, vérifié

`.github/workflows/e2e.yml` se déclenche sur :

- `push` sur `master`, quand `apps/carbon/**` change ;
- `workflow_dispatch` (manuel).

**Il ne se déclenche pas sur `pull_request`.** Conséquence directe : un test
Playwright ajouté dans une PR **ne s'exécute jamais dans la CI de cette PR**. Il
ne s'exécutera qu'après fusion, sur `master`.

Le job consomme cinq secrets : `E2E_API_URL`, `E2E_USER_EMAIL`,
`E2E_USER_PASSWORD`, `AUTH_JWT_SECRET`, plus les variables Upstash.

## 2. Pourquoi ne pas simplement ajouter `pull_request`

Parce que le déclencheur et l'exposition des secrets sont **deux décisions
distinctes**, et que les confondre est le mécanisme classique d'une fuite.

- Sur une PR issue d'une **branche du dépôt**, les secrets sont disponibles :
  ajouter `pull_request` les exposerait à tout code poussé sur une branche —
  y compris un workflow modifié dans la PR elle-même.
- Sur une PR issue d'un **fork**, GitHub retire les secrets par défaut. Le job
  échouerait, et la tentation serait alors d'utiliser `pull_request_target`,
  qui exécute le workflow de la base **avec les secrets** sur du code non revu.
  C'est le vecteur d'exfiltration le mieux documenté de GitHub Actions.

**`pull_request_target` ne doit jamais être utilisé ici.**

## 3. Proposition — deux jobs séparés, deux niveaux de confiance

### Job 1 — E2E public, sur `pull_request`, **sans aucun secret**

Ce qu'il peut couvrir sans jamais s'authentifier :

- `/water-intelligence` : rendu, ancres, hiérarchie de titres, absence de
  débordement horizontal ;
- **la garde d'authentification** : un accès anonyme à `/water/decision` doit
  rediriger vers `/login` ou renvoyer le statut attendu — c'est précisément le
  comportement qu'on veut prouver, et il ne demande aucun compte ;
- responsive (desktop / tablette / mobile) et thème clair / sombre ;
- accessibilité de la surface publique : focus visible, navigation clavier,
  lien d'évitement, contrastes.

Aucun secret n'est nécessaire : la page publique est prérendue et la garde
d'auth se vérifie *en n'étant pas authentifié*.

### Job 2 — E2E authentifié, **hors `pull_request`**

- déclencheur : `workflow_dispatch` uniquement ;
- `environment: e2e-preview` — un environnement GitHub protégé ;
- les secrets vivent sur **l'environnement**, pas sur le dépôt : ils ne sont
  lisibles que par un job qui déclare cet environnement ;
- **approbation humaine requise** (« Required reviewers » sur l'environnement),
  donc aucun code non revu ne s'exécute avec les identifiants ;
- jamais `pull_request_target` ; jamais de secrets sur une PR issue d'un fork.

### Garde-fous à conserver dans les deux cas

- un compte d'essai dédié, sans droit d'écriture en production ;
- des identifiants distincts de ceux de tout environnement réel ;
- rotation après incident ou départ ;
- aucun secret imprimé dans les journaux (Playwright masque les valeurs, pas
  les URL — attention aux traces réseau).

## 4. Ce que la PR Wave E-Core contient réellement

Rien de ce qui précède n'est appliqué. La PR E-Core :

- **ne modifie pas** `.github/workflows/e2e.yml` ;
- **ne modifie pas** la politique de secrets ;
- **n'ajoute aucun scénario Playwright authentifié**.

Les tests Playwright publics et la mise en œuvre éventuelle de cette
proposition relèvent de la PR **Wave E-Interface & Closeout**, après décision
humaine.

## 5. La question à trancher

> Accepte-t-on d'ajouter un job `pull_request` **sans secret** couvrant la
> surface publique et la garde d'authentification, et de réserver les scénarios
> authentifiés à un job `workflow_dispatch` sur environnement protégé avec
> approbation humaine ?

Trois réponses possibles, toutes légitimes :

1. **oui aux deux jobs** — meilleure couverture, coût : un environnement GitHub
   à créer et à protéger ;
2. **oui au job public seulement** — les scénarios authentifiés restent
   manuels ; couverture moindre, aucune surface d'attaque ajoutée ;
3. **statu quo** — E2E reste post-fusion sur `master` ; il faut alors accepter
   qu'un test Playwright ajouté en PR n'y soit pas exercé, et ne pas le compter
   comme une vérification de la PR.
