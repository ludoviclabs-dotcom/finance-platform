# Remédiation du rapport QA CarbonCo du 16/09/2026

Rapport source : `TEST_REPORT_CARBONCO_2026-09-16.md` (commit testé `44816cd`,
7 bloquants · 18 majeurs · 20 mineurs). Ce document trace, anomalie par
anomalie, la cause retenue, le correctif et sa preuve, puis les **actions
d'exploitation** à réaliser après fusion (elles ne peuvent pas être faites
depuis le code).

> Ordre de correction respecté : les failles B-02, B-03 et B-07 (et les failles
> connexes découvertes pendant la remédiation, §3) sont corrigées dans la même
> livraison que la réparation de l'API (B-01). Déployer B-01 seul aurait ouvert
> la prise de contrôle admin et le contournement 2FA.

---

## 1. Actions d'exploitation (à faire, dans cet ordre)

| # | Où | Action | Pourquoi |
|---|---|---|---|
| 1 | GitHub → workflow **DB Migrate** | Appliquer la migration **044** (`plan` puis `apply`, approbation humaine) | Anti-rejeu TOTP en base + nouveaux types d'audit. Le code tolère son absence (anti-rejeu inactif et journalisé, types d'audit réécrits), mais la protection n'est complète qu'après 044. |
| 2 | Poste opérateur (ou workflow équivalent) | `DATABASE_URL=… python apps/api/scripts/neutralize_dev_accounts.py` puis `--apply` si des comptes sont signalés (`--all-users` pour tout vérifier) | Désactive les comptes encore protégés par un mot de passe publié dans le dépôt (`Admin2024!`…) et révoque leurs sessions. Le code refuse déjà ces mots de passe en production. |
| 3 | Vercel → projet **carbon** | Définir `CRON_SECRET` (≥ 16 caractères) | Sans lui, le cron est désormais refusé (401) : plus de repli sur l'en-tête falsifiable `x-vercel-cron`. |
| 4 | Vercel → projets **carbon** et **carbonco-api** | Définir la **même** valeur `CRON_SERVICE_TOKEN` (≥ 16 caractères, p. ex. `openssl rand -hex 32`) | Jeton de service du cron vers l'API (`/alerts/evaluate`, rappels BEGES et fournisseurs). |
| 5 | Vercel → projet **carbonco-api** | Définir `PLATFORM_ADMIN_EMAILS` (vos adresses d'administration, séparées par des virgules) | Seuls ces comptes `admin` gèrent plusieurs organisations. Vide = aucun geste inter-organisations (fail-secure). |
| 6 | Vercel → projet **carbon** | Corriger `NEXT_PUBLIC_API_BASE_URL` (retirer le retour à la ligne final) | Le code le normalise désormais, mais la valeur doit être propre (m-13). |
| 7 | Vercel → projet **carbon** (optionnel) | Activer Web Analytics / Speed Insights **et** définir `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=1` (et/ou `NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS=1`) | Sans activation, les scripts ne sont plus chargés (m-08). Ils ne se chargent qu'après consentement (M-10). |
| 8 | Après déploiement | Vérifier `GET https://carbonco-api-ludovics-projects-159c139c.vercel.app/health` → 200, `status` = `ok`, `db` = `ok` ; `GET /health/schema` → `schema_version` = 044 après l'étape 1 | Preuve de B-01 et de la migration. |
| 9 | Après déploiement | Déclencher le cron manuellement (`vercel crons run /api/cron/evaluate-alerts`) et vérifier un 200 | Preuve de B-07. |

---

## 2. Anomalies du rapport

### Bloquantes

| ID | Cause retenue | Correctif | Preuve |
|---|---|---|---|
| **B-01** | Vercel CLI 59.16 / `@vercel/python` 14 : « *Internal rewrites in backend framework projects now route requests using the rewritten destination path* » (journal de build du déploiement `dpl_AEcUAx…`). La réécriture `/(.*)` → `/api/index` faisait recevoir `/api/index` à FastAPI → 404 partout. Le projet est en préréglage **FastAPI** (point d'entrée détecté : `app.py`, `index.py`, `server.py`, `main.py`…) ; un `app.py` **vide** traînait à la racine. | `apps/api/vercel.json` sans réécriture (le préréglage route toutes les requêtes vers l'app), fonction clé `main.py` ; suppression de `api/index.py` et du `app.py` vide ; `excludeFiles` limité à `tests/` et `scripts/` (le dossier `demo/`, importé à l'exécution, n'était pas embarqué auparavant). | `tests/test_qa_2026_09_16.py::TestVercelConfig` ; à confirmer sur le déploiement (action 8). |
| **B-02** | `decode_token` ne vérifiait pas le `scope` : le jeton pré-auth TOTP (et la session démo du front, signée avec le même secret) valait un jeton d'accès. | Jetons d'accès marqués `scope: access` ; `decode_token` exige ce scope, un `exp` (m-01), un rôle connu et un `cid` entier. | `TestAccessTokenScope`, `test_totp.py` (étape 7). |
| **B-03** | Routeur admin sans aucun filtre d'organisation ; comptes de développement ensemencés au premier login, y compris en production. | Admin cloisonné à son organisation (utilisateur d'une autre organisation = 404) ; gestes inter-organisations réservés à `PLATFORM_ADMIN_EMAILS` ; changement de plan réservé à la plateforme ; dernier admin actif protégé ; mot de passe conforme à la recommandation CNIL n° 2022-100 ; sessions révoquées au changement de mot de passe ou à la désactivation ; gestes journalisés (`admin_user_change`, `admin_company_change`). Comptes de développement : jamais en production ni en preview (`is_production()`), ensemencement sur opt-in `CARBONCO_SEED_DEV_ACCOUNTS=1`, mots de passe publics refusés en production, hachage paresseux (−1 s de démarrage à froid). | `TestDevAccounts`, `TestPlatformAdmin`, `test_qa_2026_09_16_db.py::TestAdminTenantScoping` (CI). |
| **B-04** | `row[0]` sur un `RealDictCursor` → `KeyError`, exception avalée, écriture dans un fichier `/tmp` **global** ; lecture en échec servie depuis ce même fichier ; `cache_status`/`invalidate` sans contexte d'organisation (zéro ligne sous RLS FORCE → dashboard toujours « démo »). | `snapshot_cache.py` réécrit : en base, erreurs remontées (`SnapshotStoreError` → 503), verrou consultatif par (organisation, domaine), contexte tenant partout, pas d'expiration des imports ; sans base, fichiers cloisonnés par organisation. `ingest-uploaded` ne répond jamais 200 sans enregistrement. | `TestSnapshotPersistence`, `test_qa_2026_09_16_db.py::TestSnapshotPersistence`. |
| **B-05** | Récursion infinie de `splitTreemap` sur des groupes de somme nulle/NaN. | Voir §4 (front). | Tests Vitest dédiés. |
| **B-06** | `params` lu de façon synchrone (Promise en Next 16). | Voir §4. | — |
| **B-07** | `/alerts/evaluate` exigeait un JWT analyste ; route cron en 200 malgré l'échec ; protection par en-tête falsifiable ; mauvaise variable d'URL. | API : `require_cron_or_analyst` typé — le cron évalue **chaque** organisation (lecture des règles sous contexte tenant), sans renotifier une règle déclenchée depuis moins de 20 h (livraison Vercel « best effort », parfois dupliquée) ; un utilisateur n'agit que sur son organisation (idem rappels BEGES/fournisseurs) ; 403 pour un rôle insuffisant. Front : voir §4. | `TestCronEvaluation`, `test_cron_evaluates_each_organisation_once` (CI). |

### Majeures (API)

| ID | Correctif |
|---|---|
| **M-01** | Classeur ESG : les 34 plages `CC_VSME_*` pointaient sur la colonne des **libellés** (D) → repointées sur les valeurs (E). Complétude : une valeur « auto » doit avoir le type attendu (nombre pour un datapoint quantitatif, O/N pour un booléen). En base, jamais de repli sur le classeur maître. |
| **M-02** | Modèle carbone : totaux, intensités, parts, énergie, taxonomie et coût CBAM étaient **figés**. Formules restaurées (vérifiées par recalcul LibreOffice), entreprise fictive retirée. Serveur : agrégats **recomposés depuis les lignes de détail** (`services/carbon/workbook_totals.py`), ce qui neutralise aussi les anciens modèles déjà téléchargés (avertissement si écart) ; un classeur sans émissions ou sans résultats de calcul est refusé avec un message actionnable. |
| **M-03** | Éligibilité BEGES (art. L229-25, rédaction loi n° 2025-391 ; art. R229-46) : effectif inconnu → `indetermine` (plus jamais « volontaire ») ; seuil outre-mer (DROM) ; périodicité 4 ans ; dispense CSRD, plan de transition et sanctions (50 000 € / 100 000 €) dans les notes ; effectif lu dans le bilan importé. |
| **M-06** | `/health` : `status` = `degraded` si la base ou le stockage est en panne (ou base absente en production). |
| **M-11** | `status = ANY(%s::datapoint_status[])`. |
| **M-12** | `/excel/validate` applique les mêmes règles que l'import (plages `CC_*`, feuilles du modèle) ; le modèle officiel passe sa propre validation. |
| **M-13** | Désactivation 2FA : code TOTP ou code de récupération exigé ; journalisée `2fa_disable`. |
| **M-14** | `/history/*` : jeton obligatoire, organisation du jeton. |
| **M-15** | CORS : domaines de production du front + URL de preview du projet `carbon` **de l'équipe** uniquement (`utils/cors.py`) ; `Origin` vérifié sur `/auth/refresh` et `/auth/logout` (anti-CSRF sur le cookie SameSite=None). |

### Mineures (API)

| ID | Correctif |
|---|---|
| **m-01** | `exp` obligatoire (jetons d'accès et pré-auth). |
| **m-02** | Anti-rejeu TOTP (RFC 6238 §5.2) : un pas de temps accepté ne l'est qu'une fois (table `user_totp_used_steps`, migration 044 ; fichier en développement). La persistance TOTP ne se replie plus silencieusement sur `/tmp` en cas d'erreur de base (fail-closed). |
| **m-03** | Le jeton rafraîchi conserve `uid`. |
| **m-15** | `pytest` retiré des dépendances d'exécution (il était embarqué dans la fonction de production) ; `requirements-dev.txt` cohérent ; jobs CI concernés mis à jour. |
| **m-17** | Non reproduit sans PostgreSQL local ; `build_full_db` suit désormais 044 ; le nouveau module DB-gated purge ses types d'audit élargis pour ne pas casser les modules suivants. |

---

## 3. Failles supplémentaires découvertes pendant la remédiation

| Réf. | Constat | Correctif |
|---|---|---|
| **N-01** | `get_company_id` renvoyait l'organisation **n°1** sans jeton : lecture anonyme de ses fournisseurs, campagnes, matérialité, snapshots, dashboards… et écriture (`POST /ingest`, `POST /report/generate`). Les exports « adhésion volontaire » (liens sans en-tête) exposaient ses KPIs à tout utilisateur. | Jeton obligatoire (401) ; exports front téléchargés avec authentification. |
| **N-02** | Exécution de code à distance : le moteur de formules évaluait les formules des classeurs importés avec `eval()` (primitive `object.__subclasses__()` atteinte, vérifié). | `utils/safe_formula.py` : évaluation par liste blanche d'AST (nombres, texte, + − × ÷ ^ bornés, comparaisons, et/ou/non). Au passage, les branches de `IF()` sont réellement évaluées. |
| **N-03** | `/excel/upload`, `/preview`, `/validate`, `/read-cell`, `/read-range` sans authentification (et sans garde anti zip-bomb pour deux d'entre elles). | Rôle analyste + `check_upload_bytes`. |
| **N-04** | `/alerts/history` renvoyait les déclenchements de **toutes** les organisations. | Filtré par organisation. |
| **N-05** | Rappels BEGES : jointure sans contexte tenant → jamais de rappel en production (RLS). | Itération par organisation. |
| **N-06** | Candidatures partenaires (données plateforme) lisibles par tout admin client. | Réservées aux administrateurs de la plateforme. |
| **N-07** | `POST /ingest` injectait les classeurs **de démonstration** dans le compte du client. | Admin requis ; en production, administrateurs de plateforme uniquement. |

---

## 4. Front (apps/carbon)

| ID | Correctif |
|---|---|
| **B-05** | `splitTreemap` total : valeurs non finies/négatives neutralisées, récursion toujours décroissante ; état vide si tout vaut 0. |
| **B-06** | `/q/[token]` lit `params` avec `use()` ; écrans d'erreur (lien invalide, expiré, service indisponible). |
| **B-07** | Route cron : modèle officiel Vercel (`CRON_SECRET` obligatoire, comparaison à temps constant, plus de repli `x-vercel-cron`), URL d'API normalisée, 200 seulement si toutes les étapes réussissent, sinon 502. |
| **M-04 / m-18** | Dashboard : aucune attestation d'intégrité ni score inventé sur données de démonstration ; bandeau réglementaire sourcé ; persona = utilisateur connecté. |
| **M-05** | `/esrs` sans repli démo ; faux comptes à rebours retirés du header (seule l'échéance BEGES réelle est affichée). |
| **M-06** | `/status` : statut HTTP vérifié, délai de 8 s, état dérivé de `db`/`storage`. |
| **M-07** | Texte du cron conforme (entre 06:00 et 07:00 UTC, offre Hobby). |
| **M-08** | Statut « En cours de vérification » pour les fonctionnalités dépendant de l'API ou du cron. |
| **M-09, m-04, m-05, m-11** | Calculateur ROI (surcoût non vert, saisie numérique bornée, hypothèse unique −60 %), raccourcis clavier de la maquette limités à celle-ci. |
| **M-10, m-08** | Vercel Analytics / Speed Insights chargés seulement après « Tout accepter » et si le drapeau d'environnement vaut `1`. |
| **M-16** | Session démo : `/login` propose « Quitter la démo » ; `/audit/<jeton>` n'est plus bloqué. |
| **M-17** | Jetons `--color-primary` (et 5 autres jetons manquants) définis ; test de couverture des jetons. |
| **M-18, m-19** | Pièces client en Blob **privé** (upload, RAG, état des datapoints) ; lecture serveur contrôlée par organisation (`lib/blob/private-blob.ts`, route `/api/blob/source`) ; erreurs présentables. |
| **m-06, m-07** | Bandeau cookies ne masque plus les CTA ; menu mobile défilable ; débordements horizontaux corrigés. |
| **m-09, m-10, m-12** | Fraîcheurs fictives retirées ; titre `/verify` selon le verdict ; recherche matériaux normalisée avec état vide. |
| **m-13, m-14, m-20** | URL d'API normalisée ; CSP `vercel.live` en preview seulement ; erreurs de connexion visibles. |
| Front B-02 | `verifyBearerToken` (routes `/api/*`) exige un jeton `scope: access` avec `exp`. |

Reliquats connus : page `/cookies` à réécrire (elle ne décrit pas encore la bannière), expiration du consentement à 6 mois (recommandation CNIL n° 2020-092) non implémentée, specs e2e `03-phase-0` et `18-resources-demo-auth-redirect` à mettre à jour, `npm ci` requis localement (`three` absent du `node_modules`).
