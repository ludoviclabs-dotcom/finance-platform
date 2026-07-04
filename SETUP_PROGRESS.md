# SETUP_PROGRESS — mise en service des connecteurs

> Suivi des 6 tâches de câblage (session 04/07/2026). Réalité du terrain :
> le backend (stockage, RLS, worker, TOTP, /factors) vit dans **`apps/api`**
> (FastAPI, projet Vercel `carbonco-api`) — pas dans `apps/carbon` (Next.js,
> projet `carbon`) comme le supposait le brief initial.

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 1 | Vercel Blob (pièces justificatives) | ✅ Terminé | Front : déjà câblé (rien touché, validé). API : 3 variables posées via CLI sur Production+Preview (`STORAGE_BACKEND=vercel-blob`, `BLOB_READ_WRITE_TOKEN` copié du store carbon — store partagé, namespaces distincts —, `SIGNED_URL_SECRET` aléatoire). `/health` durci : sonde réelle PUT+GET+DELETE clé fixe `health/probe` (timeout 5 s/appel), valeurs `local`/`not_configured`/`ok`/`down` ; `/status` affiche `local` en ambre. 6 tests pytest neufs (16/16 verts avec l'existant). ⚠️ Vérif prod au déploiement final (redeploy immédiat refusé — attendu : déploiement groupé après les 6 tâches). |
| 2 | RLS_FORCE (Neon) | ⏳ En attente | Migration 009 prête (opt-in `RLS_FORCE=1`), jamais validée sur branche Neon. Variable absente de carbonco-api (défaut 0). |
| 3 | Sentry front (@sentry/nextjs) | ⏳ En attente | Confirmé absent de package.json. `SENTRY_DSN` absent aussi côté API (le hook backend est no-op sans). |
| 4 | 2FA TOTP (UI carbon) | ⏳ En attente | Backend prêt (apps/api, statut registre `beta`). Aucun fichier UI. `TOTP_ENCRYPTION_KEY` absente de carbonco-api. |
| 5 | Worker asynchrone (Procrastinate) | ⏳ En attente | `/health` = `"worker": "inline"`. `WORKER_MODE` absent ; le code attend `DATABASE_URL_DIRECT` — absent, mais Neon fournit `DATABASE_URL_UNPOOLED` (à dupliquer). Procrastinate = Python, PAS de worker Node. |
| 6 | /factors erreur 500 | ⏳ En attente | `GET /factors?limit=1` → FUNCTION_INVOCATION_FAILED en prod alors que `/health` (même app) répond. ⚠️ Les facteurs sont **seedés depuis CSV ADEME** en base (pas d'appel API ADEME au runtime — interdit par les règles projet). |

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
