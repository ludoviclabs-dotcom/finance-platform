# NEURAL — `apps/neural`

Application publique NEURAL AI Consulting. Vitrine produit + démos live trust-first pour les branches **Luxe / Communication** et **Banque / Communication**.

- **Stack** : Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Prisma / Postgres · Zod
- **IA** : Vercel AI Gateway (provider strings `"provider/model"`) · AI SDK v6 · Langfuse (tracing) · Lakera (input guard)
- **Déploiement cible** : Vercel (Fluid Compute) + Neon (Postgres) + Upstash Redis + Blob — tout via Vercel Marketplace
- **Principe** : gates déterministes côté serveur qui overrident le LLM ; aucune autopublication ; chaque sortie est défendable (registre de sources, hash, logs)

---

## Prérequis

- **Node.js** 20 ou 24 LTS (le repo est validé sur 24.14)
- **npm** — le lockfile est npm. Pas de pnpm/yarn.
- **Postgres** accessible via `DATABASE_URL` (optionnel : le build passe sans)
- **Clé AI Gateway** pour activer les démos Luxe / Banque en mode `gateway` (sinon mode `fallback` déterministe)

Tout est optionnel au build : chaque capacité s'auto-gate sur `env.<group>.ready` côté runtime (cf. `lib/env.ts`).

---

## Lancement local

```bash
# depuis apps/neural/
npm install                  # une seule fois
cp .env.example .env.local   # à remplir selon besoin (voir matrice ci-dessous)
npm run dev                  # → http://localhost:3002 (port custom, cf. package.json)
```

Autres commandes utiles :

```bash
npm run build                # next build (valide SSR + metadata + static generation)
npm run start                # next start — nécessite un build préalable
npm run lint                 # ESLint
npx tsc --noEmit             # typecheck sans émettre

# Sync workbooks Luxe Comms (si data/luxe-comms/*.xlsx présent)
npx tsx scripts/sync-luxe-comms.ts

# Sync workbooks Banque Comms (quand data/bank-comms/*.xlsx existera)
npx tsx scripts/sync-bank-comms.ts

# Prisma (DB)
npx prisma generate          # génère le client
npx prisma migrate dev       # applique migrations en dev
```

---

## Matrice d'environnement (minimum par capacité)

| Capacité | Vars requises | Conséquence si absent |
|---|---|---|
| **Site statique / démos fallback** | — | Tout fonctionne, démos en mode `fallback` déterministe |
| **Démos IA live** (Luxe + Banque) | `AI_GATEWAY_API_KEY` | Sinon fallback templates/gates uniquement |
| **Persistence HITL / approvals** | `DATABASE_URL` (+ optionnel `DIRECT_URL`) | Routes approvals renvoient 503 |
| **Rate limiting persistant** | `KV_REST_API_URL` + `KV_REST_API_TOKEN` (ou `UPSTASH_*`) | Rate limiting en mémoire (non scalable) |
| **Observability** | `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` | Traces agents non envoyées |
| **Input guardrail** | `LAKERA_API_KEY` | Guard basique en local (heuristique) |
| **Contact form** | `RESEND_API_KEY` + `CONTACT_TO_EMAIL` | Form désactivé |

`lib/env.ts` contient le schéma Zod complet et le module d'auto-gate. Tout est `.optional()` au parse ; le `next build` passe sans aucune variable.

### Sur Vercel

Installer via **Vercel Marketplace** : Neon (auto-set `DATABASE_URL` et `DIRECT_URL`), Upstash Redis (auto-set `KV_*`), AI Gateway (OIDC auto, pas besoin de clé).

En local, `vercel env pull` récupère les valeurs du projet lié pour remplir `.env.local`.

---

## Arborescence

```
apps/neural/
├─ app/                          # Next.js App Router
│  ├─ page.tsx                   # Homepage
│  ├─ secteurs/
│  │  ├─ luxe/communication/     # Branche Luxe Comms (5 agents live)
│  │  └─ banque/communication/   # Branche Banque Comms (6 agents)
│  │     └─ dashboard/           # Dashboard opérationnel
│  ├─ agents/                    # Pages détail par agent
│  │  ├─ reg-bank-comms/
│  │  ├─ bank-crisis-comms/
│  │  ├─ esg-bank-comms/
│  │  ├─ client-bank-comms/
│  │  ├─ reg-watch-bank/         # service transverse
│  │  ├─ bank-evidence-guard/    # service transverse
│  │  ├─ maison-voice-guard/     # Luxe agents...
│  │  └─ ...
│  └─ api/
│     ├─ demo/                   # 10 routes publiques de démo
│     ├─ internal/               # services internes (evidence-guard)
│     └─ ...
├─ components/
│  ├─ bank-comms/                # 5 composants live (RegBank, Crisis, ESG, Client, EvidenceResolver)
│  ├─ luxe-comms/                # composants live Luxe
│  ├─ homepage/                  # sections homepage
│  └─ layout/                    # navbar, footer
├─ content/
│  ├─ bank-comms/*.json          # Seeds (foundations, master, agb001..agb006)
│  └─ luxe-comms/*.json          # Générés depuis data/luxe-comms/*.xlsx
├─ lib/
│  ├─ ai/                        # Modules par agent (reg-bank-comms, bank-crisis-comms, ...)
│  ├─ data/                      # Catalogs (bank-comms, luxe-comms, agents-registry)
│  ├─ regulatory/                # Veille réglementaire (classifier, store, watch)
│  ├─ types/                     # Types métier partagés (bank-comms)
│  ├─ security/                  # Guardrails (input + output)
│  ├─ env.ts                     # Schéma Zod + auto-gate par capacité
│  └─ public-catalog.ts          # NAVIGATION, SECTOR_ENTRIES, BRANCH_ENTRIES
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
└─ scripts/
   ├─ sync-luxe-comms.ts
   ├─ sync-bank-comms.ts
   └─ test-*.ts                  # fumée locale
```

---

## Architecture des démos (contrat trust-first)

Chaque route démo respecte le même contrat :

1. **Scenario-id only** — aucun texte libre accepté. Les scénarios sont figés dans `content/{vertical}/agbNNN-*.json`.
2. **Gates déterministes côté serveur** (TypeScript pur) exécutées **avant** l'appel LLM.
3. **Le LLM est overridé** : même si la réponse du modèle contredit les gates, la décision finale est la valeur des gates côté serveur.
4. **Fallback** : si `AI_GATEWAY_API_KEY` absent ou appel en erreur → template déterministe, même décision.
5. **Trace** : chaque run renvoie `traceId` + `mode` + `latencyMs` dans les headers et le body.

### Gates en production (16 sur la branche Banque)

| Agent | Gates |
|---|---|
| **AG-B001 RegBankComms** | `GATE-PRIV` · `GATE-NUM-VALIDATED` · `GATE-SOURCE-ACTIVE` · `GATE-WORDING` |
| **AG-B002 BankCrisisComms** | `GATE-CRISIS-ROOT-CAUSE` · `GATE-CRISIS-APPROVED-MESSAGE` · `GATE-CRISIS-REMEDIATION` · `GATE-CRISIS-SLA` |
| **AG-B003 ESGBankComms** | `GATE-ESG-WORDING` · `GATE-ESG-EVIDENCE` · `GATE-ESG-JURISDICTION` · `GATE-ESG-CLAIM-MATCH` |
| **AG-B004 ClientBankComms** | `GATE-CLIENT-MENTIONS` · `GATE-CLIENT-CANAL` · `GATE-CLIENT-TON` · `GATE-CLIENT-LISIBILITE` |

+ **AG-B006 BankEvidenceGuard** : résolveur déterministe sans LLM, consommé en interne par les 4 agents (`POST /api/internal/evidence-guard/resolve`).

### Routes clés

```
POST /api/demo/reg-bank-comms                   # { scenario_id }
POST /api/demo/reg-bank-comms/export            # → markdown + hash SHA-256
POST /api/demo/bank-crisis-comms                # idem
POST /api/demo/bank-crisis-comms/export
POST /api/demo/esg-bank-comms
POST /api/demo/esg-bank-comms/export
POST /api/demo/client-bank-comms
POST /api/demo/client-bank-comms/export
GET  /api/demo/reg-watch-bank?agent=AG-BXXX     # digests filtrable
POST /api/internal/evidence-guard/resolve       # service transverse
GET  /api/internal/evidence-guard/resolve       # + testset auto-exécuté
```

---

## Conventions

- Commits : `feat(neural):` · `fix(neural):` · `chore(repo):` · `docs(neural):`
- IDs stables : `SRC-{AUT}-NNN` (sources) · `RUL-{TYPE}-NNN` (règles) · `GATE-*` (gates) · `SCN-*` / `CRS-*` / `ESG-*` / `CLI-*` (scénarios) · `EVD-*` (evidences) · `DIG-*` (digests)
- Pas d'emoji sauf CTA explicite
- Tout fichier de test exploratoire ignoré par `.gitignore` (`debug-*.ts`, `test-debug*.ts`, `test-parser.ts`)

---

## Ressources complémentaires

- `/apps/neural/docs/` — docs internes (AI-ACT, gouvernance, dossiers par agent)
- `/scripts/workbook-generators/` — générateurs Python des workbooks xlsx
- `/DEPLOYMENT.md` — déploiement côté infra (Vercel + Marketplace)
- `/CLAUDE.md` à la racine si présent — conventions projet pour les agents Claude Code
