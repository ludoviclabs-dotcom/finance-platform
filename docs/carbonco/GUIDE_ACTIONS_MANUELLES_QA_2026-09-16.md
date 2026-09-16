# Guide pas à pas — actions manuelles après la remédiation QA du 16/09/2026

Ce guide couvre ce que le code ne peut pas faire à votre place : réglages
Vercel, migration de la base de production, neutralisation des comptes de
développement et vérifications finales. Les numéros d'anomalie (B-01, M-10…)
renvoient à [QA_2026-09-16_REMEDIATION.md](QA_2026-09-16_REMEDIATION.md).

**Durée totale : environ 1 h 15 de travail**, plus une attente éventuelle
jusqu'au lendemain matin pour voir passer le cron planifié (étape 7). Les
étapes 1 à 6 se font d'une traite, dans l'ordre.

---

## 0. Où en est la production (constaté le 16/09/2026 à 18:53, heure de Paris)

| Contrôle | Résultat | Conclusion |
|---|---|---|
| `GET https://carbonco-api-ludovics-projects-159c139c.vercel.app/health` | HTTP 200, `"status":"ok"`, `"db":"ok"`, `"storage":"ok"`, `"version":"31fe37b14a9d"` | **B-01 corrigé en production** : l'API ne répond plus 404, et elle tourne bien sur le commit de fusion de la PR #182. |
| `GET …/health/schema` | `"schema_version":"043"`, `"up_to_date":false`, `"pending_count":1` | La migration **044** est la seule en attente → étape 4. |
| Workflow GitHub « E2E Tests » (`e2e.yml`) | Annulé à chaque exécution depuis juillet 2026 (délai de 20 min dépassé) | Option 2 appliquée par PR dédiée (étape 10) ; activer le périmètre complet reste facultatif. |

---

## Vue d'ensemble

| # | Action | Où | Durée | Bloquant ? |
|---|---|---|---|---|
| 1 | Générer 2 secrets | Votre poste | 2 min | Oui |
| 2 | Variables de l'API + redéploiement | Vercel → `carbonco-api` | 10 min | Oui |
| 3 | Variables du front + redéploiement | Vercel → `carbon` | 12 min | Oui |
| 4 | Appliquer la migration 044 | GitHub → Actions → DB Migrate | 10 min | Oui (sécurité 2FA) |
| 5 | Neutraliser les comptes de développement | Votre poste + console Neon | 15 min | Oui (sécurité) |
| 6 | Vérifier l'API et l'administration | Navigateur | 5 min | — |
| 7 | Vérifier le cron quotidien | Vercel (CLI ou tableau de bord) | 5 min, ou le lendemain entre 08:00 et 08:59 | — |
| 8 | Fusionner la PR des reliquats | GitHub | 5 min + CI | Non |
| 9 | (Optionnel) Mesure d'audience | Vercel → `carbon` | 5 min | Non |
| 10 | (Décision) Suite e2e historique | GitHub → Settings → Secrets | 30 min | Non |

### Prérequis (10 min, une seule fois)

- Accès au tableau de bord Vercel, équipe **ludovics-projects-159c139c**
  (projets **carbon** et **carbonco-api**).
- Droits d'administration sur le dépôt GitHub
  `ludoviclabs-dotcom/finance-platform`. Vous êtes le seul approbateur de
  l'environnement protégé `production-db`, et l'auto-approbation y est
  autorisée : vous pourrez approuver vos propres exécutions.
- Accès à la console Neon (<https://console.neon.tech>), projet de la base
  de production.
- Python 3.12 ou plus récent sur votre poste, avec les dépendances de l'API
  (`pip install -r apps/api/requirements.txt`). Elles sont déjà installées si
  vous lancez les tests de l'API en local.
- Un gestionnaire de mots de passe pour conserver les secrets de l'étape 1.
- (Étape 7, option A seulement) la CLI Vercel : `npm i -g vercel`, puis
  `vercel login`.

---

## Étape 1 — Générer deux secrets (2 min)

Il faut deux valeurs aléatoires **différentes**, de 64 caractères
hexadécimaux. Vercel recommande pour `CRON_SECRET` « une chaîne aléatoire d'au
moins 16 caractères ». Dans PowerShell :

```powershell
python -c "import secrets; print('CRON_SECRET=' + secrets.token_hex(32)); print('CRON_SERVICE_TOKEN=' + secrets.token_hex(32))"
```

Enregistrez tout de suite les deux lignes dans votre gestionnaire de mots de
passe. Si vous cochez « Sensitive » dans Vercel, les valeurs ne seront plus
relisibles ensuite, et `CRON_SERVICE_TOKEN` doit être saisi **à l'identique**
dans deux projets.

| Secret | Rôle | Projets Vercel |
|---|---|---|
| `CRON_SECRET` | Vercel l'envoie au cron du front (`Authorization: Bearer …`) | `carbon` uniquement |
| `CRON_SERVICE_TOKEN` | Le cron du front le présente à l'API | `carbon` **et** `carbonco-api`, même valeur |

---

## Étape 2 — Variables de l'API (`carbonco-api`) puis redéploiement (10 min)

**Où :** <https://vercel.com/ludovics-projects-159c139c/carbonco-api/settings/environment-variables>
(Vercel → projet **carbonco-api** → **Settings** → **Environment Variables**).

1. Ajoutez `CRON_SERVICE_TOKEN` :
   - **Key** : `CRON_SERVICE_TOKEN` ;
   - **Value** : la valeur de l'étape 1 ;
   - **Environments** : **Production** (et **Preview** si vous testez les
     crons sur des déploiements de prévisualisation) ;
   - **Sensitive** : coché ;
   - cliquez sur **Save**.
2. Ajoutez `PLATFORM_ADMIN_EMAILS` :
   - **Value** : l'adresse de **votre** compte CarbonCo de rôle `admin`, en
     minuscules. S'il y en a plusieurs, séparez-les par des virgules, par
     exemple `vous@exemple.fr,associe@exemple.fr` ;
   - **Environments** : **Production** ;
   - cliquez sur **Save**. Ce n'est pas un secret.
   - ⚠️ N'y mettez **jamais** `admin@carbonco.fr`, `demo@carbonco.fr` ni
     `viewer@carbonco.fr` : ce sont les comptes de développement dont le mot
     de passe est public.
3. Redéployez, car une variable modifiée ne s'applique qu'aux **nouveaux**
   déploiements :
   - ouvrez **Deployments** ;
   - sur la ligne marquée **Production** (la plus récente), cliquez sur **⋯**
     puis **Redeploy** ;
   - dans la fenêtre **Redeploy to Production**, cliquez sur **Redeploy**.
   - Comptez 1 à 3 minutes.
4. Contrôlez que le nouveau déploiement est **Ready**, puis ouvrez
   <https://carbonco-api-ludovics-projects-159c139c.vercel.app/health>. Vous
   devez obtenir `"status":"ok"`.

> Sans `PLATFORM_ADMIN_EMAILS`, personne ne peut créer d'organisation, changer
> un plan ni gérer les comptes d'une autre organisation. C'est voulu
> (fail-secure) : chaque admin reste limité à sa propre organisation.

---

## Étape 3 — Variables du front (`carbon`) puis redéploiement (12 min)

**Où :** <https://vercel.com/ludovics-projects-159c139c/carbon/settings/environment-variables>

1. Ajoutez `CRON_SECRET` :
   - **Value** : la valeur de l'étape 1 ;
   - **Environments** : **Production**. Les crons Vercel ne tournent que sur la
     production ;
   - **Sensitive** : coché ;
   - cliquez sur **Save**.
2. Ajoutez `CRON_SERVICE_TOKEN` :
   - **Value** : **exactement** la même valeur qu'à l'étape 2 ;
   - **Environments** : **Production** ;
   - **Sensitive** : coché ;
   - cliquez sur **Save**.
3. Corrigez `NEXT_PUBLIC_API_BASE_URL` (anomalie m-13) :
   - dans la liste, trouvez la variable avec la zone de recherche, puis
     cliquez sur **⋯** → **Edit** ;
   - dans le champ **Value**, sélectionnez tout (Ctrl+A) et **retapez**
     l'URL de l'API, sans barre oblique finale ni retour à la ligne. Par
     exemple : `https://carbonco-api-ludovics-projects-159c139c.vercel.app` ;
   - cliquez sur **Save**.
   - Le code tolère déjà la valeur actuelle, mais une valeur propre évite les
     surprises dans d'autres outils.
4. Redéployez **sans le cache de build**. Les variables `NEXT_PUBLIC_*` sont
   intégrées au moment du build.
   - Allez dans **Deployments**, puis sur la ligne **Production** cliquez sur
     **⋯** → **Redeploy** ;
   - **décochez** l'option d'utilisation du cache de build existant ;
   - cliquez sur **Redeploy** et comptez 3 à 6 minutes.
   - *Variante :* si vous fusionnez la PR des reliquats (étape 8) juste après
     avoir saisi ces variables, le déploiement déclenché par la fusion les
     prendra en compte, et ce redéploiement devient inutile.
5. Contrôlez que le déploiement est **Ready** et que
   <https://carbon-snowy-nine.vercel.app/status> (ou votre domaine de
   production) affiche des services opérationnels.

> ⚠️ **Tant que `CRON_SECRET` n'est pas défini et redéployé, le cron
> quotidien répond 401** : il n'y a plus de repli sur l'en-tête
> `x-vercel-cron`, qui pouvait être falsifié.

---

## Étape 4 — Appliquer la migration 044 (10 min)

La migration ajoute la table anti-rejeu des codes TOTP et trois types
d'audit. Elle ne modifie aucune donnée existante.

**Où :** <https://github.com/ludoviclabs-dotcom/finance-platform/actions/workflows/db-migrate.yml>
(GitHub → **Actions** → **DB Migrate**).

1. **Plan** (lecture seule, 2 à 3 min) :
   1. cliquez sur **Run workflow** ;
   2. **Branch** : `master` ;
   3. **Commande CLI** : `plan` ;
   4. cliquez sur **Run workflow**.
   5. Ouvrez l'exécution qui apparaît : elle attend une approbation
      (« Waiting for review »). Cliquez sur **Review deployments**, cochez
      **production-db**, puis **Approve and deploy**.
   6. Dans le journal de l'étape « Run migration command », vérifiez :
      - `"has_blocking_issues": false` ;
      - pour `"version": "044"`, `"ledger_status": "pending"` et
        `"action": "apply"` ;
      - pour toutes les autres versions, `"action": "skip"`.
   7. **Si ce n'est pas le cas, arrêtez-vous** et gardez le journal.
2. **Apply** (2 à 3 min) : relancez **Run workflow** avec **Commande CLI** =
   `apply`, puis approuvez de la même façon. Résultat attendu :
   `"applied_count": 1` et `"version": "044"`.
3. **Verify** (2 min) : relancez avec `verify` et approuvez. Résultat
   attendu : `"anomalies": []`.
4. Contrôle public : ouvrez
   <https://carbonco-api-ludovics-projects-159c139c.vercel.app/health/schema>.
   Vous devez voir `"schema_version":"044"`, `"up_to_date":true` et
   `"pending_count":0`. Aucun redéploiement n'est nécessaire.

---

## Étape 5 — Neutraliser les comptes de développement (15 min)

Le script désactive les comptes qui utilisent encore un mot de passe publié
dans le dépôt (`admin@carbonco.fr` etc.) et révoque leurs sessions.

> ⚠️ **Avant toute chose** : si le **seul** compte admin de votre
> organisation est l'un de ces comptes, `--apply` vous privera
> d'administration. Dans ce cas :
> 1. connectez-vous d'abord avec ce compte ;
> 2. créez votre compte personnel `admin` via **Administration**, avec un
>    mot de passe d'au moins 12 caractères qui mélange majuscules,
>    minuscules, chiffres et caractères spéciaux (recommandation CNIL
>    n° 2022-100) ;
> 3. déconnectez-vous et reconnectez-vous avec ce nouveau compte ;
> 4. seulement ensuite, lancez le script.

1. **Récupérez la chaîne de connexion.**
   - Allez sur <https://console.neon.tech> et choisissez le projet de
     production.
   - Sur **Project Dashboard**, cliquez sur le bouton **Connect**.
   - Dans la fenêtre « Connect to your database », sélectionnez la branche
     de production, la base, et le rôle propriétaire (`neondb_owner`).
   - **Désactivez « Connection pooling »** pour obtenir une connexion
     directe, sans `-pooler` dans le nom d'hôte.
   - Copiez la chaîne `postgresql://…?sslmode=require…`.
2. **Simulation** (PowerShell, à la racine du dépôt). Le script n'écrit
   rien et affiche la liste des comptes concernés :
   ```powershell
   cd apps\api
   $env:DATABASE_URL = "postgresql://..."   # collez la chaîne Neon
   python scripts\neutralize_dev_accounts.py --all-users
   ```
   Résultats possibles :
   - `Aucun compte n'utilise un mot de passe public.` : c'est terminé, passez
     au point 4 ;
   - `- admin@carbonco.fr (id 1, actif) : MOT DE PASSE PUBLIC`, suivi de
     `Simulation : N compte(s) à neutraliser — relancer avec --apply.` : passez
     au point 3.
   - `--all-users` vérifie tous les comptes (bcrypt, quelques secondes par
     compte). Sans cette option, seules les trois adresses connues sont
     vérifiées.
3. **Application** :
   ```powershell
   python scripts\neutralize_dev_accounts.py --all-users --apply
   ```
   Résultat attendu : `N compte(s) désactivé(s), sessions révoquées.`
4. **Nettoyage** : effacez la variable, puis fermez le terminal.
   ```powershell
   Remove-Item Env:DATABASE_URL
   ```

---

## Étape 6 — Vérifier l'API et l'administration (5 min)

1. <https://carbonco-api-ludovics-projects-159c139c.vercel.app/health> doit
   afficher `"status":"ok"`, `"db":"ok"` et `"storage":"ok"`. Si `status`
   vaut `degraded`, regardez quel champ vaut `down`.
2. Connectez-vous au front avec votre compte admin et ouvrez
   **Administration**. Selon ce que vous avez mis dans
   `PLATFORM_ADMIN_EMAILS` :
   - **votre adresse y figure** : vous voyez toutes les organisations et
     pouvez en créer ;
   - **elle n'y figure pas** : vous ne voyez que votre organisation. C'est le
     comportement attendu.
3. Si la 2FA est activée sur votre compte, faites ce test :
   - déconnectez-vous puis reconnectez-vous avec un code ;
   - essayez de réutiliser **le même** code dans les 90 secondes.

   Il doit être refusé : l'anti-rejeu est actif depuis l'étape 4.

---

## Étape 7 — Vérifier le cron quotidien (5 min, ou le lendemain matin)

Le cron `/api/cron/evaluate-alerts` est planifié à `0 6 * * *` (UTC). Sur le
plan Hobby, Vercel peut le lancer **à n'importe quel moment de l'heure
indiquée**, soit :

- **entre 08:00 et 08:59 heure de Paris** jusqu'au samedi 24 octobre 2026
  (heure d'été, UTC+2) ;
- **entre 07:00 et 07:59** à partir du dimanche 25 octobre 2026 (heure
  d'hiver, UTC+1).

**Option A — déclenchement immédiat** (CLI Vercel) :

```powershell
cd apps\carbon
vercel link          # une seule fois : choisir l'équipe ludovics-projects-159c139c puis le projet carbon
vercel crons run /api/cron/evaluate-alerts
```

La commande est en bêta et déclenche le cron **déjà déployé en production**.

**Option B — attendre le passage planifié**, puis vérifier le lendemain.

**Vérification** (dans les deux cas) :

1. Ouvrez <https://vercel.com/ludovics-projects-159c139c/carbon/settings/cron-jobs>.
2. Sur la ligne `/api/cron/evaluate-alerts`, cliquez sur **View Logs**. Ce
   sont les journaux d'exécution, filtrés sur ce chemin.
3. Lisez le statut obtenu :

| Statut | Signification | Que faire |
|---|---|---|
| **200** | Toutes les étapes (alertes, rappels BEGES, relances fournisseurs) ont réussi | Rien : c'est terminé. |
| **401** | `CRON_SECRET` absent, ou déploiement antérieur à sa saisie | Refaire l'étape 3, points 1 et 4. |
| **500** | Aucune URL d'API configurée | Vérifier `NEXT_PUBLIC_API_BASE_URL`, puis redéployer. |
| **502** | Au moins une étape a échoué ; le détail figure dans le corps de la réponse | Si l'étape en échec renvoie 401 : les deux `CRON_SERVICE_TOKEN` diffèrent ou `carbonco-api` n'a pas été redéployé (étape 2). |

Vercel ne relance jamais un cron en échec : corrigez, puis relancez avec
l'option A.

---

## Étape 8 — Fusionner la PR des reliquats (5 min, plus la CI)

Cette PR contient :

- la réécriture de la page `/cookies` ;
- l'expiration du consentement cookies à 6 mois ;
- le masquage des jetons dans les URL envoyées à la mesure d'audience ;
- la mise à jour des specs e2e 03 et 18 ;
- le bouton démo de `/login?next=/resources`, qui mène désormais au parcours
  `/demo/asterion-resources`.

1. Attendez que les checks soient **verts**, puis fusionnez (**Merge pull
   request**).
2. **Effet visible pour les visiteurs** : la bannière cookies réapparaîtra
   **une fois** chez tous ceux qui avaient déjà fait un choix. L'ancien choix
   n'était pas daté et ne peut donc pas être considéré comme valable 6 mois.
   Ensuite, elle réapparaîtra tous les 6 mois.
3. Relisez la page `/cookies` en production. La date de mise à jour indiquée
   est le 16 septembre 2026.

---

## Étape 9 — (Optionnel) Mesure d'audience (5 min)

Ne faites cette étape que si vous voulez des statistiques de fréquentation.

1. Vercel → projet **carbon** → **Analytics** → **Enable**. Faites de même
   pour **Speed Insights** si vous le souhaitez.
2. Dans **Settings** → **Environment Variables**, ajoutez en **Production** :
   - `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` = `1` ;
   - `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS` = `1` (si Speed Insights est activé).
3. Redéployez **sans cache** (même procédure qu'à l'étape 3, point 4).

Les scripts ne se chargent **qu'après « Tout accepter »** dans la bannière.
Sans ces drapeaux, rien n'est chargé et les 404 constatées en QA (m-08)
n'apparaissent pas.

---

## Étape 10 — La suite e2e historique ne termine jamais (option 2 appliquée)

**Constat :** le workflow **E2E Tests** (`e2e.yml`, déclenché à chaque push
sur `master`) exécutait 138 tests Playwright, et la plupart échouaient. Le job
était coupé au bout de 20 minutes, et c'était le cas à chaque exécution depuis
juillet 2026 (dernier essai : 16/09/2026, 15:06 UTC).

**Cause :** le dépôt ne définit pas le secret `E2E_API_URL`, et le front était
construit sans `NEXT_PUBLIC_API_BASE_URL`. Les tests authentifiés tournaient
donc sans API. (`UPSTASH_REDIS_REST_*` manquent aussi, mais le rate limit est
en fail-open : ce n'est pas bloquant.)

Pour le vérifier : GitHub → **Settings** → **Secrets and variables** →
**Actions**. Seuls `AUTH_JWT_SECRET`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` et
`NEURAL_CRON_SECRET` y figurent.

**Décision appliquée (option 2, sans supprimer de test) :** la suite est
partagée en deux projets Playwright (`apps/carbon/playwright.config.ts`,
étiquette `@sans-api`) :

- `sans-api` (61 tests : pages publiques, démo fictive, redirections,
  en-têtes) est joué à **chaque** push sur `master`. Il dure environ 1 à
  2 minutes sur un build de production.
- `avec-api` (77 tests : vrai compte, données de l'API) ne tourne que si les
  secrets `E2E_API_URL` **et** `E2E_USER_PASSWORD` existent. Sinon, l'étape
  est sautée et une annotation l'indique dans le résumé du run.

La justification complète figure en tête de `.github/workflows/e2e.yml`.
En local, `npm run e2e` joue toujours les 138 tests.

**Pour aller plus loin (facultatif) :** il faut une API de test joignable
depuis GitHub Actions, sur un domaine autorisé par la CSP (`*.vercel.app`),
avec une base de test et un compte dédié. Créez ensuite le secret
`E2E_API_URL`, puis relancez le workflow à la main (**Actions** → **E2E
Tests** → **Run workflow**). Comptez environ une demi-journée, hors de ce
guide.

---

## Dépannage rapide

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `/health` → `"status":"degraded"`, `"db":"down"` | Base injoignable ou `DATABASE_URL` invalide côté `carbonco-api` | Vérifier la variable dans Vercel et l'état du projet Neon. |
| `/health/schema` → 503 | Base configurée mais injoignable pendant le contrôle (délai de 2 s) | Réessayer ; si ça persiste, vérifier l'état de Neon. |
| « DB Migrate » bloqué sur « Waiting for review » | Approbation non donnée | **Review deployments** → **production-db** → **Approve and deploy**. |
| `apply` échoue avec `checksum` | Fichier de migration modifié après application | Ne rien forcer ; garder le journal et ouvrir un ticket. |
| Un admin ne voit plus les autres organisations | Son adresse n'est pas dans `PLATFORM_ADMIN_EMAILS` | L'ajouter (étape 2), puis redéployer `carbonco-api`. |
| Connexion refusée avec « mot de passe public » | Le compte utilise un mot de passe publié dans le dépôt | Se connecter avec un autre admin et changer ce mot de passe. |
| Bannière cookies qui revient à chaque visite | Stockage local bloqué (navigation privée, réglage du navigateur) | Comportement attendu : le choix ne peut pas être conservé. |

## Références officielles

- Vercel, gérer et sécuriser les crons (`CRON_SECRET`, **View Logs**,
  précision horaire du plan Hobby) :
  <https://vercel.com/docs/cron-jobs/manage-cron-jobs>
- Vercel, CLI `vercel crons run` :
  <https://vercel.com/docs/cli/crons>
- Vercel, variables d'environnement (application aux nouveaux déploiements
  seulement) : <https://vercel.com/docs/environment-variables/managing-environment-variables>
- Vercel, redéployer : <https://vercel.com/docs/deployments/managing-deployments#redeploy-a-project>
- Neon, chaîne de connexion : <https://neon.com/docs/connect/connect-from-any-app>
- CNIL, recommandation « cookies et autres traceurs » (délibération
  n° 2020-092, version consolidée du 16/01/2026 : conservation des choix
  pendant 6 mois) :
  <https://www.cnil.fr/sites/default/files/2026-01/recommandation_cookies_consolidee.pdf>
- CNIL, recommandation mots de passe (délibération n° 2022-100) :
  <https://www.cnil.fr/fr/mots-de-passe-une-nouvelle-recommandation-pour-maitriser-sa-securite>
