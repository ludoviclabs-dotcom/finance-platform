# SETUP_PROGRESS — mise en service des connecteurs

> Suivi des 6 tâches de câblage (session 04/07/2026). Réalité du terrain :
> le backend (stockage, RLS, worker, TOTP, /factors) vit dans **`apps/api`**
> (FastAPI, projet Vercel `carbonco-api`) — pas dans `apps/carbon` (Next.js,
> projet `carbon`) comme le supposait le brief initial.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 1 | Vercel Blob (pièces justificatives) | ✅ Terminé | Front : déjà câblé (rien touché, validé). API : 3 variables posées via CLI sur Production+Preview (`STORAGE_BACKEND=vercel-blob`, `BLOB_READ_WRITE_TOKEN` copié du store carbon — store partagé, namespaces distincts —, `SIGNED_URL_SECRET` aléatoire). `/health` durci : sonde réelle PUT+GET+DELETE clé fixe `health/probe` (timeout 5 s/appel), valeurs `local`/`not_configured`/`ok`/`down` ; `/status` affiche `local` en ambre. 6 tests pytest neufs (16/16 verts avec l'existant). ⚠️ Vérif prod au déploiement final (redeploy immédiat refusé — attendu : déploiement groupé après les 6 tâches). |
| 2 | RLS_FORCE (Neon) | ❌ Bloqué (prod) | Validé de fond en comble sur une branche Neon jetable (`rls-validation`, supprimée) — **3 bugs réels trouvés et corrigés**, voir détail ci-dessous. **Ne PAS flipper `RLS_FORCE=1` en prod tel quel** : le rôle Postgres actuel de carbonco-api (`neondb_owner`) a `BYPASSRLS=true`, ce qui annule silencieusement TOUTE la RLS. Remédiation prête (rôle restreint) mais pas encore appliquée en prod — décision utilisateur requise avant d'y toucher. |
| 3 | Sentry front (@sentry/nextjs) | ⏳ En attente | Confirmé absent de package.json. `SENTRY_DSN` absent aussi côté API (le hook backend est no-op sans). |
| 4 | 2FA TOTP (UI carbon) | ⏳ En attente | Backend prêt (apps/api, statut registre `beta`). Aucun fichier UI. `TOTP_ENCRYPTION_KEY` absente de carbonco-api. |
| 5 | Worker asynchrone (Procrastinate) | ⏳ En attente | `/health` = `"worker": "inline"`. `WORKER_MODE` absent ; le code attend `DATABASE_URL_DIRECT` — absent, mais Neon fournit `DATABASE_URL_UNPOOLED` (à dupliquer). Procrastinate = Python, PAS de worker Node. |
| 6 | /factors erreur 500 | ⏳ En attente | `GET /factors?limit=1` → FUNCTION_INVOCATION_FAILED en prod alors que `/health` (même app) répond. ⚠️ Les facteurs sont **seedés depuis CSV ADEME** en base (pas d'appel API ADEME au runtime — interdit par les règles projet). |

## Tâche 2 — détail de la validation RLS_FORCE (branche Neon jetable)

Méthode : création d'une branche Neon `rls-validation` (copie-sur-écriture de
prod, isolée), migrations 001-026 appliquées avec `RLS_FORCE=1`, suite de
tests réelle, puis **branche supprimée** en fin de session — aucune trace ne
subsiste sur Neon. Trois défauts réels découverts et corrigés :

### 🔴 Bloquant — `neondb_owner` a BYPASSRLS
`SELECT rolbypassrls FROM pg_roles WHERE rolname='neondb_owner'` → `true`.
BYPASSRLS annule FORCE ROW LEVEL SECURITY (FORCE ne contre que l'exemption
« owner », pas l'attribut BYPASSRLS). Confirmé en conditions réelles : avec
`neondb_owner`, 2 companies se voient mutuellement leurs facts (10 assertions
d'isolation → 6 échecs). **Piège Neon** : même un rôle fraîchement créé via
la **console/API Neon** hérite par défaut de BYPASSRLS+CREATEDB+CREATEROLE
(comportement de la plateforme, pas de Postgres) — impossible à retirer après
coup (`ALTER ROLE` refusé : pas d'ADMIN OPTION sur un rôle créé par le control
plane Neon). **Seule voie qui fonctionne** : créer le rôle applicatif via
`CREATE ROLE ... NOBYPASSRLS NOCREATEDB NOCREATEROLE` en **SQL brut** (pas
l'API Neon), exécuté par `neondb_owner`. Testé : rôle `carbonco_app2` ainsi
créé + `GRANT SELECT/INSERT/UPDATE/DELETE` sur toutes les tables + `GRANT
MAINTAIN` sur `facts_current` (REFRESH sans ownership, dispo depuis PG17,
utilisé par ce projet) + `ALTER DEFAULT PRIVILEGES` pour les futures tables
→ **10/10 tests d'isolation verts**, REFRESH sous RLS FORCE OK.

### 🔴 Bug réel (indépendant de RLS) — chaîne hash cassée dès le 1er event
`services/facts_service.py::emit_fact` — `SELECT ... FOR UPDATE` sur le
dernier event ne verrouille RIEN quand aucune ligne n'existe encore (rien à
verrouiller). Sur une company neuve, 10 `emit_fact` concurrents produisaient
**10 lignes avec `hash_prev=NULL`** au lieu d'une vraie chaîne. Corrigé par
`pg_advisory_xact_lock(company_id)` avant la lecture (sérialise sur le
company_id, pas sur une ligne — protège aussi le tout premier insert).

### 🟠 Second bug, révélé par le premier — mauvais critère de tri
Après le verrou advisory, la chaîne se **ramifiait** encore (plusieurs lignes
partageant le même `hash_prev`) : le tri `ORDER BY computed_at DESC` utilise
un timestamp capturé **avant** l'acquisition du verrou (horloge client), qui
ne reflète pas l'ordre réel de sérialisation sous contention. Corrigé en
triant par `id DESC` (assigné par la séquence Postgres à l'exécution réelle
de l'INSERT, donc dans l'ordre vrai). `verify_chain()` mis à jour pour lire
dans le même ordre (`id ASC`). **10/10 threads → chaîne parfaitement
intègre, `verify_chain().ok == True`.**

### 🟡 Durcissement — policies 009 sans garde NULLIF
`current_setting('app.current_company_id', true)::int` plante (`invalid
input syntax for type integer: ''`) si le GUC custom a déjà été référencé une
fois sur ce backend physique puis désactivé (fréquent sous PgBouncer
transaction pooling, où le backend est réutilisé entre clients) — Postgres
renvoie `''` et non `NULL` dans ce cas. La migration 008b (suppliers) s'en
protégeait déjà via `NULLIF(current_setting(...), '')::int` ; la 009 (RLS
FORCE, jamais livrée en prod) ne l'avait pas. Alignée sur 008b avant sa
première activation — n'affecte aucune donnée existante, juste les policies.

**Fichiers modifiés** : `services/facts_service.py` (verrou + tri),
`db/migrations/009_rls_force.sql` (garde NULLIF), `tests/test_facts_tx.py`
(assertion mise à jour). Suite complète API : **547 passed, 36 skipped**.

### Ce qu'il reste avant d'activer en prod
1. Créer le rôle restreint en SQL brut sur le projet Neon **prod** (pas de
   branche cette fois) — même recette que validée : `CREATE ROLE
   carbonco_app LOGIN PASSWORD '...' NOBYPASSRLS NOCREATEDB NOCREATEROLE`
   + les GRANTs + `GRANT MAINTAIN ON facts_current`.
2. Construire sa chaîne de connexion (même host que `DATABASE_URL` actuel,
   juste le rôle/mdp qui changent) et la poser comme **nouveau**
   `DATABASE_URL` sur Vercel carbonco-api (garder `neondb_owner` uniquement
   pour les migrations/DDL, jamais pour le trafic applicatif).
3. Poser `RLS_FORCE=1`.
4. Redéployer, revérifier `/health` + un test de fumée applicatif.

Action à risque (rôle applicatif + `DATABASE_URL` prod) — **je ne l'exécute
pas sans confirmation explicite**, distincte de l'accord initial qui portait
sur « flipper RLS_FORCE=1 », pas sur un changement de rôle de connexion.

## Découvertes hors périmètre (à traiter ou planifier)

- **`CRON_SERVICE_TOKEN` absent de carbonco-api** → les crons P7 (rappels BEGES,
  relances fournisseurs) ne peuvent pas s'authentifier aujourd'hui.
- **`NEXT_PUBLIC_SITE_URL` absent du projet carbon** → canonical SEO (P0, action
  Ludo n° 9) jamais posée. Idem `NEXT_PUBLIC_CONTACT_EMAIL`.
- `AUTH_JWT_SECRET` posé en Production uniquement (pas Preview) sur les 2 projets.

## Vérité terrain env Vercel (04/07/2026, via `vercel env ls`)

- **carbon** : BLOB_READ_WRITE_TOKEN ✅ (82 j), AUTH_JWT_SECRET ✅, KV/Redis ✅,
  Inngest ✅, AI Gateway ✅, NEXT_PUBLIC_API_BASE_URL ✅, NEXT_PUBLIC_MAPBOX_TOKEN ✅ (04/07).
- **carbonco-api** : intégration Neon complète ✅ (DATABASE_URL, *_UNPOOLED, PG*),
  AUTH_JWT_SECRET ✅, ALLOWED_ORIGINS ✅ — **rien d'autre** : ni stockage, ni TOTP,
  ni Sentry, ni worker, ni RLS_FORCE, ni CRON_SERVICE_TOKEN.
