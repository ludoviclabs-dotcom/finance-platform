/**
 * RAG retrieval evaluation — golden questions sanity check.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/eval-rag.ts
 *
 * For each golden question:
 *   1. Embed the query with `taskType: "query"`.
 *   2. Run ANN search (k=8) over the indexed Chunk corpus.
 *   3. Print top results so we can eyeball precision@5.
 *
 * Bloquant: at least 3/5 questions must return at least one chunk whose
 * heading or content mentions the expected topic. This is intentionally
 * loose; tighter evaluation comes in Sprint 3 with reranking.
 */

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getEmbeddingClient } from "@/lib/embeddings/client";
import { searchChunks } from "@/lib/vector-store/search";

interface GoldenQuestion {
  q: string;
  expects: string[]; // any of these substrings should appear in top-5 content/heading
}

const QUESTIONS: GoldenQuestion[] = [
  {
    q: "Quelles sont les obligations de transparence de l'AI Act ?",
    expects: ["transparence", "AI Act", "documentation"],
  },
  {
    q: "Quel est l'impact du cache prompt sur le coût des LLM ?",
    expects: ["cache", "prompt", "coût"],
  },
  {
    q: "Pourquoi les agents IA autonomes intéressent-ils l'industrie ?",
    expects: ["agent", "autonome"],
  },
  {
    q: "Quels acteurs investissent dans les TPU ou GPU récents ?",
    expects: ["TPU", "GPU", "Google", "Nvidia"],
  },
  {
    q: "Quelles sont les régulations IA en Europe ?",
    expects: ["Europe", "régulation", "AI Act", "Commission"],
  },
];

function matches(text: string | null, expects: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return expects.some((e) => lower.includes(e.toLowerCase()));
}

async function main(): Promise<void> {
  if (!env.database.ready || !env.embeddings.ready) {
    console.error(
      "Need DATABASE_URL and an embeddings provider (VOYAGE_API_KEY or OPENAI_API_KEY).",
    );
    process.exit(1);
  }

  const totalChunks = await db.chunk.count();
  if (totalChunks === 0) {
    console.error("No chunks in DB. Run `npm run seed:corpus` first.");
    process.exit(1);
  }
  console.log(`Corpus: ${totalChunks} chunks indexed.\n`);

  const client = await getEmbeddingClient();
  let passed = 0;

  for (const golden of QUESTIONS) {
    const [vector] = await client.embed([golden.q], "query");
    const results = await searchChunks(vector, { k: 5 });
    const hit = results.some(
      (r) => matches(r.content, golden.expects) || matches(r.heading, golden.expects),
    );
    if (hit) passed++;

    console.log(`Q: ${golden.q}`);
    console.log(`   expects: [${golden.expects.join(", ")}]  → ${hit ? "HIT" : "MISS"}`);
    for (const r of results.slice(0, 3)) {
      const head = r.heading ?? "(no heading)";
      const snippet = r.content.replace(/\s+/g, " ").slice(0, 120);
      console.log(`     • score=${r.score.toFixed(3)}  ${head}  — ${snippet}…`);
    }
    console.log();
  }

  const ratio = passed / QUESTIONS.length;
  console.log(`Score: ${passed}/${QUESTIONS.length} (${(ratio * 100).toFixed(0)}%)`);
  await db.$disconnect();
  if (ratio < 0.6) {
    console.error("FAIL: precision@5 below 60% threshold.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
