# Runbook — E2E authentifiés sur environnement protégé

**Statut : `prepared_not_executed_environment_not_configured`**

Ce runbook décrit un geste d'exploitation qui **n'a pas été fait**. Le workflow
existe, les scénarios existent, l'environnement GitHub `e2e-preview` n'existe
pas, et ses secrets non plus.

Aucune ligne de ce document ne doit être lue comme le compte rendu d'une
exécution. Tant que la section « Journal des exécutions » est vide, ces tests
n'ont jamais tourné.

| Élément | Emplacement | État |
|---|---|---|
| Workflow | [`.github/workflows/e2e-authenticated.yml`](../../../.github/workflows/e2e-authenticated.yml) | écrit, jamais déclenché |
| Configuration Playwright | `apps/carbon/playwright.authenticated.config.ts` | écrite, jamais chargée en CI |
| Scénarios | `apps/carbon/e2e/authenticated/water-decision.spec.ts` | écrits, jamais exécutés |
| Environnement `e2e-preview` | GitHub → Settings → Environments | **inexistant** |
| Secrets | environnement `e2e-preview` | **inexistants** |
| Reviewers | environnement `e2e-preview` | **non désignés** |

---

## 1. Pourquoi le modèle s'est arrêté ici

Créer un environnement de secrets et y déposer des identifiants n'est pas un
geste de code. Il engage :

- **un compte réel**, dont le mot de passe circulera dans un runner ;
- **une Preview réelle**, avec sa base et ses données ;
- **une durée de vie**, que quelqu'un devra surveiller et révoquer.

Un modèle qui poserait ces trois choix déciderait à la place de l'exploitant,
sans en porter les conséquences. Le workflow est donc livré prêt et inerte.

## 2. Secrets attendus

Ces noms sont ceux que le workflow lit. **Aucune valeur n'est donnée ici, et
aucune ne doit y être ajoutée** — ce fichier est versionné.

| Nom | Contenu attendu | Remarques |
|---|---|---|
| `E2E_USER_EMAIL` | adresse du compte de test | jamais un compte d'administration, jamais un compte client |
| `E2E_USER_PASSWORD` | mot de passe de ce compte | propre à ce compte, non réutilisé ailleurs |
| `E2E_API_URL` | URL du backend servant la Preview | `https://…`, sans barre oblique finale |

L'URL de la Preview frontale n'est **pas** un secret : elle est passée en
`input` au lancement, parce qu'elle change à chaque déploiement.

Le workflow vérifie la **présence** de ces trois entrées et échoue si l'une
manque. Il n'affiche jamais leur valeur, ni tronquée, ni hachée.

## 3. Créer l'environnement (geste humain)

1. GitHub → **Settings** → **Environments** → **New environment**.
2. Nom exact : `e2e-preview`. Le workflow le désigne littéralement ; un autre
   nom le laisse échouer au démarrage.
3. **Deployment protection rules** → **Required reviewers** : désigner au moins
   une personne. Sans reviewer, n'importe qui pouvant lancer un
   `workflow_dispatch` déclenche une exécution qui lit les secrets.
4. Facultatif mais recommandé : **Deployment branches** limité aux branches
   depuis lesquelles le lancement est autorisé.
5. **Environment secrets** → ajouter les trois secrets du tableau ci-dessus.
   Les ajouter au niveau *dépôt* plutôt qu'*environnement* annulerait la
   protection : ils redeviendraient lisibles par d'autres workflows.

## 4. Lancer

1. Déployer ou identifier la Preview à tester ; copier son URL complète.
2. GitHub → **Actions** → **E2E authentifiés (environnement protégé)** →
   **Run workflow**.
3. Renseigner `preview_url` (l'URL relevée à l'étape 1, en `https://`).
   Laisser `project` sur `chromium` sauf raison contraire.
4. Le reviewer désigné reçoit une demande d'approbation. **Approuver, c'est
   autoriser la lecture des secrets** : vérifier d'abord que la branche et
   l'URL sont bien celles attendues.
5. L'exécution démarre après approbation.

## 5. Lire les résultats

- Le résumé du job liste les neuf scénarios : connexion, accès à
  `/water/decision`, chargement des six facettes, absence de fuite tenant,
  saisie, résultat central, sensibilités, réinitialisation, déconnexion.
- L'artefact `playwright-authenticated-report` contient le rapport HTML.
  **Rétention : 3 jours** — il porte des captures d'une session authentifiée.
- Un résultat annoté « état moteur » signale que la Preview a répondu
  « schéma non disponible » plutôt qu'un chiffre : c'est un comportement
  correct sur un environnement dont les migrations ne sont pas appliquées, pas
  un échec du cockpit.

### Ce qu'un succès prouve, et ce qu'il ne prouve pas

Un job vert établit que les parcours fonctionnent sur **cette** Preview, à
**cet** instant, pour **ce** compte.

Il n'établit pas que l'interface est correcte visuellement. Aucun test ne
regarde une page ; la vérification visuelle reste un geste humain, et sa
checklist est livrée non cochée dans
[`HUMAN_DECISION_PACKET.md`](./HUMAN_DECISION_PACKET.md).

## 6. Rotation

- Changer le mot de passe du compte de test **au moins tous les 90 jours**, et
  mettre à jour `E2E_USER_PASSWORD` dans l'environnement dans la foulée : un
  secret périmé fait échouer le job à la connexion, pas silencieusement.
- Après toute rotation, relancer une fois le workflow pour vérifier que la
  nouvelle valeur est bien celle qui est lue.
- Ne jamais réutiliser ce mot de passe ailleurs : il transite par un runner.

## 7. Révocation

À faire **immédiatement** si un rapport a été partagé hors de l'équipe, si un
runner a été compromis, ou si le compte de test a servi à autre chose :

1. Changer le mot de passe du compte de test.
2. Invalider les sessions actives du compte (déconnexion globale).
3. Supprimer les secrets de l'environnement `e2e-preview`.
4. Supprimer les artefacts d'exécution encore en rétention
   (Actions → run → Artifacts).
5. Consigner l'incident dans [`DECISION_LOG.md`](./DECISION_LOG.md).

## 8. Nettoyage

- Les artefacts expirent seuls au bout de 3 jours ; les supprimer plus tôt
  quand ils ne servent plus.
- Supprimer l'environnement `e2e-preview` quand les E2E authentifiés ne sont
  plus utilisés — un environnement de secrets oublié est un environnement que
  plus personne ne surveille.
- Le compte de test n'a pas vocation à survivre au chantier : le désactiver
  quand il n'a plus d'usage.

## 9. Ce que ce workflow ne fait délibérément pas

- **Aucun `pull_request_target`.** Il s'exécuterait dans le contexte du dépôt
  de base, avec accès aux secrets, tout en ayant checké out du code proposé par
  un tiers.
- **Aucun déclenchement automatique.** Ni `push`, ni `pull_request`, ni
  `schedule`.
- **Aucun repli sur une cible par défaut.** Sans `E2E_BASE_URL`, la
  configuration Playwright lève au chargement plutôt que de tester `localhost`
  en croyant tester la Preview.
- **Aucune écriture.** `permissions: contents: read`.
- **Aucune modification de la politique de secrets existante.** `e2e.yml`
  conserve ses secrets et son déclenchement sur `master`.

## 10. Journal des exécutions

Une ligne par lancement, ajoutée par la personne qui l'a lancé.

| Date | Preview testée | Lancé par | Approuvé par | Résultat | Rapport |
|---|---|---|---|---|---|
| — | — | — | — | *aucune exécution à ce jour* | — |
