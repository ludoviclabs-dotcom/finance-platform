# Inngest — Job queue async (Chantier E)

Job queue durable pour l'ingestion bulk RAG et l'extraction batch ESRS.
Évite les timeouts 5 min des routes API synchrones lors du traitement
de gros volumes (50+ PDFs ou 127+ datapoints Set 2).

## Architecture

```
                           ┌──────────────────┐
  POST /api/rag/           │  rag/batch.      │
  ingest-async       ─────>│  ingest          │ (parent fan-out)
                           └────────┬─────────┘
                                    │ step.sendEvent(N)
                                    v
                           ┌──────────────────┐
                           │  rag/document.   │ (worker — concurrency 10)
                           │  ingest          │  parse → chunk → embed → upsert
                           └──────────────────┘

                           ┌──────────────────┐
  POST /api/datapoints/    │  datapoints/     │
  extract-async      ─────>│  batch.extract   │ (parent fan-out)
                           └────────┬─────────┘
                                    │ step.sendEvent(N)
                                    v
                           ┌──────────────────┐
                           │  datapoints/     │ (worker — concurrency 8)
                           │  extract.one     │  RAG search → Claude → persist
                           └──────────────────┘
```

État Redis temps réel : `job:${cid}:${batchId}` (TTL 24h).
Polling UI : `GET /api/jobs/[batchId]` retourne `{ total, done, failed, items[] }`.

## Variables d'environnement

| Var | Source | Usage |
|---|---|---|
| `INNGEST_EVENT_KEY` | Inngest dashboard → Keys | Auth pour `inngest.send()` |
| `INNGEST_SIGNING_KEY` | Inngest dashboard → Keys | Vérification HMAC du webhook `/api/inngest` |
| `UPSTASH_REDIS_REST_URL` | Existant | Job tracker state |
| `UPSTASH_REDIS_REST_TOKEN` | Existant | Job tracker state |
| `ANTHROPIC_API_KEY` | Existant | Réutilisé par `extract-datapoint-one` |
| `VOYAGE_API_KEY` | Existant | Réutilisé par embeddings |
| `BLOB_READ_WRITE_TOKEN` | Existant | Réutilisé par `upsertExtraction` |

## Dev local

```bash
# Terminal 1 : Next.js dev server
npm run dev

# Terminal 2 : Inngest dev server (auto-discovers les fonctions)
npx inngest-cli@latest dev -u http://localhost:3003/api/inngest
```

Dashboard local : http://localhost:8288

## Déploiement Vercel

1. Inngest est installable via le marketplace Vercel (auto-set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`)
2. Le webhook est exposé sur `/api/inngest` (déjà configuré)
3. Au premier deploy, Inngest fait un PUT sur ce endpoint pour synchroniser les fonctions

## Tests

```bash
npm run test -- queue
```

Couverture (11 tests) :
- `client.spec.ts` : `newBatchId()` unicité + format
- `job-tracker.spec.ts` : invariants `done`/`failed`, kind discrimination

Les chemins Redis et Inngest dispatch sont testés en intégration via le
dev server local (pas de mock — Inngest CLI fournit un environnement
fidèle).
