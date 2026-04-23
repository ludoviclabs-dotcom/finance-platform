# Deployment — Finance Platform

> **État** : monorepo multi-app. Le flagship est `apps/neural` (Next.js 16 déployé sur Vercel). Les autres apps (`apps/api`, `apps/frontend`, `apps/carbon`, `apps/web`) sont en arrière-plan — voir § Apps héritées.

## Topologie actuelle

```
┌──────────────────────────────────────────────────────────────┐
│                         Vercel                                │
│                                                               │
│  apps/neural (Next.js 16 + Turbopack)                         │
│  ├─ Fluid Compute runtime (Node.js 24)                        │
│  ├─ Middleware (Vercel Functions)                             │
│  ├─ Static + SSG (62 pages prérendues)                        │
│  └─ Dynamic routes (/api/demo, /api/internal, ...)            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
        │             │                 │                │
        ▼             ▼                 ▼                ▼
    Neon            Upstash          AI Gateway      Blob / Langfuse
  (Postgres)       (Redis KV)      (OIDC auto-auth)
  via Marketplace  via Marketplace  via Marketplace
```

## Déploiement `apps/neural` sur Vercel

1. **Lier le projet**
   ```bash
   cd apps/neural
   npx vercel link
   ```

2. **Ajouter les intégrations Marketplace** (depuis le dashboard Vercel du projet) :
   - **Neon** → injecte automatiquement `DATABASE_URL`, `DIRECT_URL`
   - **Upstash Redis** → injecte `KV_REST_API_URL`, `KV_REST_API_TOKEN`
   - **AI Gateway** → OIDC : pas de clé à injecter, auth automatique en prod
   - **Vercel Blob** (optionnel) → `BLOB_READ_WRITE_TOKEN`

3. **Variables manuelles à ajouter** (onglet Settings → Environment Variables) :
   - `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` — observability
   - `LAKERA_API_KEY` — input guardrail
   - `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` — contact form
   - `NEXT_PUBLIC_SITE_URL` — URL de production (OpenGraph, sitemap)

4. **Build & deploy**
   ```bash
   npx vercel deploy            # preview
   npx vercel deploy --prod     # production
   ```

   Le build de production est validé par `next build` en local (62 pages statiques + routes dynamiques). Durée typique : ~40 s.

5. **Domaines** : configurer dans Settings → Domains. Le sitemap est servi sur `/sitemap.xml` et référence 9 URLs Banque + 5 URLs Luxe + les ressources publiques.

## Configuration minimale de capacités

Chaque capacité d'`apps/neural` s'auto-gate sur la présence de ses variables (cf. `apps/neural/lib/env.ts`) :

| Capacité | Vars requises | Si absent |
|---|---|---|
| Site + démos | aucune | Démos en mode `fallback` déterministe — OK pour recruteur |
| Démos IA live | `AI_GATEWAY_API_KEY` (ou OIDC Vercel) | Mode `fallback` |
| Approvals / HITL | `DATABASE_URL` | 503 sur routes approvals |
| Rate limit persistant | Upstash | Rate limit en mémoire (non scalable) |
| Observability | Langfuse | Pas de trace |
| Email contact | Resend | Form désactivé |

## Local development

```bash
cd apps/neural
cp .env.example .env.local    # remplir ce qui est utile
npm install
npm run dev                   # http://localhost:3002
```

Pour tester la prod localement :
```bash
npm run build
npm run start                 # http://localhost:3000
```

## CI / CD

Workflows GitHub Actions existants :

- **`.github/workflows/frontend.yml`** — `npm ci` → `lint` → `tsc --noEmit` → `build` sur `apps/frontend` (**app héritée — à déplacer vers `apps/neural` ou retirer**).
- **`.github/workflows/api.yml`** — `pip install` + imports check sur `apps/api` (backend carbone, cf. § Apps héritées).

**À faire** (non-bloquant pour Vercel qui build à chaque push) :
- [ ] Workflow `neural.yml` : `npm ci` → `lint` → `tsc` → `next build` sur `apps/neural`
- [ ] Vitest unit tests pour les 16 gates déterministes banque + testset EvidenceGuard
- [ ] Retirer ou archiver `workflows/frontend.yml` (cible l'ancien apps/frontend)

## Preview / production workflow

- Push sur une branche autre que `master` → preview Vercel automatique
- Merge dans `master` → déploiement production automatique
- Rollback : utiliser l'onglet Deployments de Vercel (instantané, pas de rebuild)

## Apps héritées (non déployées actuellement)

Le monorepo contient également :
- **`apps/api`** (FastAPI, Python) — backend carbone avec modules IFRS 9 / Bâle IV / DORA. Réutilisable comme future brique backend, pas déployée en production actuellement.
- **`apps/frontend`** (Next.js plus ancien) — antérieur à `apps/neural`, à archiver.
- **`apps/carbon`** — projet Carbon Compliance Management séparé.
- **`apps/web`** — placeholder / exploration.

Aucune de ces apps n'est déployée publiquement avec l'architecture actuelle. Elles peuvent être supprimées ou déplacées vers un repo dédié lors d'un prochain nettoyage. L'ancien guide Docker + Hostinger + FastAPI qui figurait dans ce fichier décrivait leur déploiement et n'est plus pertinent.

## Stratégie de données

- **Runtime production** : les agents lisent des JSON figés (`content/bank-comms/*.json`, `content/luxe-comms/*.json`) — pas de parsing xlsx au runtime.
- **Source éditoriale** : les xlsx sont générés par les scripts Python sous `scripts/workbook-generators/` puis synchronisés vers JSON via `apps/neural/scripts/sync-*.ts`. Cf. `scripts/workbook-generators/README.md`.
- **Persistence dynamique** (runs, approvals, regulatory digests persistés) : Postgres via Prisma — schéma dans `apps/neural/prisma/schema.prisma`.

## Checklist avant premier pilote client

- [ ] Domain configuré + SSL/TLS via Vercel
- [ ] Environnement `production` isolé de `preview`
- [ ] Intégrations Marketplace (Neon, Upstash, Langfuse) provisionnées
- [ ] `AI_GATEWAY_API_KEY` (OIDC Vercel) + fallback vérifié
- [ ] Migrations Prisma appliquées : `prisma migrate deploy` (dans le build command Vercel ou en post-deploy)
- [ ] Rate limiting testé (hitter la même route > seuil → 429)
- [ ] Smoke test complet des 11 routes publiques + 4 exports (cf. § Smoke test dans `apps/neural/README.md`)
- [ ] Workflow GitHub Actions `neural.yml` actif
- [ ] Politique de retention Langfuse / journaux définie

## Références

- Guide applicatif : [`apps/neural/README.md`](apps/neural/README.md)
- Documentation interne : `apps/neural/docs/`
- Conventions : `CLAUDE.md` (s'il existe) ou règles commit dans les PR récentes
