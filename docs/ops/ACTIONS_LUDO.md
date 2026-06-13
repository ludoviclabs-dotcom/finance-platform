# Actions Ludo — mise en service P1 (hors session)

Le code P1 est livré et testé en mode dégradé (/tmp, mocks). Les critères
d'acceptation suivants nécessitent des ressources externes à provisionner.

## 1. Neon (base de données)
- [ ] Créer un projet Neon (free tier).
- [ ] Sur Vercel « carbonco-api » : `DATABASE_URL` (pooled) + `DATABASE_URL_DIRECT` (direct).
- [ ] Vérifier au démarrage : les migrations 001→011 s'appliquent (009 reste OFF, cf. RLS).

## 2. RLS FORCE (T1.1)
- [ ] Sur une **branche Neon de test**, mettre `RLS_FORCE=1` et valider :
      `tests/test_rls_isolation.py` non-skippé, `REFRESH facts_current` OK,
      inserts `audit_events` OK. Puis activer en prod.
- [ ] Rejouer `pytest tests/test_facts_tx.py -k concurrent` avec `DATABASE_URL_DIRECT`.
- [ ] `GET /facts/verify` → `{ ok: true }` ; p95 `/facts/{code}/trail` < 500 ms.

## 3. Facteurs ADEME (T1.2)
- [ ] Compte gratuit ADEME, télécharger l'export CSV Base Empreinte.
- [ ] Déposer dans `apps/api/data/ademe/` (gitignoré), puis
      `python apps/api/scripts/seed_emission_factors.py --csv apps/api/data/ademe/<fichier>.csv`.
- [ ] `SELECT COUNT(*) FROM emission_factors WHERE version='v2025'` ≥ 500.

## 4. Worker asynchrone (T1.3)
- [ ] `WORKER_MODE=worker` + `DATABASE_URL_DIRECT` ; appliquer le schéma
      procrastinate (`python -m procrastinate --app jobs.app schema --apply`).
- [ ] Lancer le worker (local ou `worker.yml`) ; `POST /ingest` < 1 s en mode worker.

## 5. 2FA TOTP (T1.4)
- [ ] `TOTP_ENCRYPTION_KEY` (clé Fernet) sur Vercel.
- [ ] Câbler l'UI carbon (champ code au login + page réglages QR) → passer le
      registre `2fa-totp` de `beta` à `live`. Playwright `13-totp.spec.ts`.

## 6. Stockage (T1.6)
- [ ] `STORAGE_BACKEND=vercel-blob` + `BLOB_READ_WRITE_TOKEN` (store Vercel Blob)
      + `SIGNED_URL_SECRET`.

## 7. Observabilité (T1.7)
- [ ] `SENTRY_DSN` (API) + `NEXT_PUBLIC_SENTRY_DSN` (front, après install
      `@sentry/nextjs`). Vérifier qu'une exception volontaire apparaît dans Sentry
      avec le bon `release`.

## 8. Sauvegardes & CI (T1.8)
- [ ] Secrets GitHub : `NEON_DATABASE_URL`, `BACKUP_PASSPHRASE` (+ E2E si besoin).
- [ ] Activer les « required checks » (api.yml, carbon.yml) sur la branche par défaut.

## 9. Front / SEO (P0)
- [ ] Vercel « carbon » : `NEXT_PUBLIC_SITE_URL=https://carbon-snowy-nine.vercel.app`
      + `NEXT_PUBLIC_CONTACT_EMAIL`.
