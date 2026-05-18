# Article Studio

Studio éditorial privé **source-grounded**. Ingère un corpus privé (`.md` / `.pdf` / `.docx`), indexe via embeddings + pgvector, et génère des articles avec citations inline et refus d'inventer hors corpus (RAG strict).

Stack : **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind v4** · **Prisma 7 / Postgres / pgvector** · **Claude API** (Opus 4.7 + Sonnet 4.6 + Haiku 4.5) via **AI Gateway** · **Voyage AI** embeddings · **Langfuse** observabilité · **Tiptap** éditeur.

## Démarrage

```bash
# Depuis la racine du monorepo
cd apps/article-studio
npm install
cp .env.example .env.local   # remplir les clés voulues (tout est optionnel au build)
npm run db:generate          # génère le client Prisma
npm run db:migrate           # crée la BDD + extension pgvector
npm run dev                  # http://localhost:3003
```

L'app démarre même sans clés API ; les capacités s'affichent comme actives ou indisponibles sur le dashboard `/`.

## Vérification rapide

```bash
curl http://localhost:3003/api/health | jq
```

Retourne l'état de chaque capacité (`database`, `embeddings_voyage`, `ai_gateway`, `observability`, …).

## Pipeline — vue d'ensemble

```
Upload .md/.pdf/.docx
    → Parsing (remark / pdf-parse / mammoth)
    → Chunking sémantique (500-800 tokens, overlap 15%)
    → Embeddings Voyage voyage-3-large (1024d)
    → pgvector HNSW cosine

Brief éditorial (sujet, angle, audience, ton, sources)
    → Query expansion (Haiku 4.5 → 3-5 reformulations)
    → Retrieval multi-query + RRF (topK=10 par query)
    → Reranking (Cohere rerank-3 ou Haiku-as-reranker) → top 8
    → Context builder ⇒ bloc <sources> [S1]..[Sn] avec prompt caching

Génération
    → Outline (Opus 4.7) — plan JSON structuré
    → Sections (Sonnet 4.6) — streamées via SSE, [S\d] inline
    → Grounding guard — ratio citations/paragraphes
    → Infographics — détection tables/stats + confirmation Haiku

Éditeur Tiptap
    → Citation popovers, regenerate par section, infographic toggle

Export
    → HTML · Markdown + frontmatter · PDF (puppeteer + Sparticuz) · DOCX (docx) · JSON canonique
```

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Next dev (port 3003) |
| `npm run build` / `start` | Build prod + start |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint flat config |
| `npm run test` | Vitest |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:setup-pgvector` | `CREATE EXTENSION vector` + HNSW index |
| `npm run db:studio` | Prisma Studio |
| `npm run seed:corpus` | Charge `content/fixtures/` dans la base |
| `npm run eval:rag` | Mesure precision@5 sur questions golden |

## API HTTP

| Méthode + Route | Effet |
|---|---|
| `POST /api/ingest` | Multipart `file` ; parse → chunk → embed en background |
| `GET  /api/sources` / `[id]` | Liste + détail des Sources |
| `POST /api/articles` | Crée un Article depuis un brief (Zod-validé) |
| `GET  /api/articles` | Liste des articles |
| `POST /api/articles/[id]/retrieve` | Debug : expansion + RRF + rerank + context |
| `POST /api/articles/[id]/generate` | **SSE** — outline + sections streamées |
| `POST /api/articles/[id]/sections/regenerate` | **SSE** — régénère une section seule |
| `GET  /api/export/[id]/[format]` | `markdown` · `json` · `html` · `docx` · `pdf` |
| `GET  /api/health` | État des capacités |

## État du projet

| Sprint | Livraison |
|---|---|
| **0 — Bootstrap** | env, security, langfuse, router 4 surfaces, schéma Prisma, layout |
| **1 — Ingestion** | Parsers markdown / pdf / docx + tests fixtures + dedup sha256 |
| **2 — Chunking + embeddings + pgvector** | Splitter sémantique, Voyage/OpenAI, HNSW cosine, pipeline async via `after()` |
| **3 — RAG retrieval** | Query expansion (Haiku) · multi-query + RRF · rerank Cohere/Haiku · context builder |
| **4 — Génération streamée** | Outline (Opus) + sections (Sonnet) SSE · grounding guard · infographic detector · Tiptap citation mark |
| **5 — Export + observabilité** | 5 formats · preview iframe · dashboard avec compteurs DB · `.env.example` |

Détails du plan : `il-me-faut-un-golden-puffin.md` (racine `~/.claude/plans/`).
