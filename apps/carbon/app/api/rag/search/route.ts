import { type NextRequest, NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/verify-jwt";
import { embedQuery } from "@/lib/rag/embeddings";
import {
  ESRS_NORMS_NAMESPACE,
  querySimilar,
  tenantNamespace,
  type RagSearchResult,
} from "@/lib/rag/vector-store";

export const runtime = "nodejs";
export const maxDuration = 30;

type SearchBody = {
  query: string;
  topK?: number;
  includeNorms?: boolean;
};

export type RagSearchHit = {
  id: string;
  score: number;
  filename: string;
  blobUrl: string;
  page?: number;
  sheet?: string;
  snippet: string;
  source: "tenant" | "esrs-norms";
};

function toHit(r: RagSearchResult, source: RagSearchHit["source"]): RagSearchHit {
  return {
    id: r.id,
    score: r.score,
    filename: r.metadata.filename,
    blobUrl: r.metadata.blobUrl,
    page: r.metadata.page,
    sheet: r.metadata.sheet,
    snippet: r.metadata.text,
    source,
  };
}

export async function POST(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query manquant" }, { status: 400 });
  }
  const topK = Math.max(1, Math.min(20, body.topK ?? 6));

  try {
    const vector = await embedQuery(query);
    const tenantNs = tenantNamespace(String(payload.cid));
    const promises: Promise<RagSearchResult[]>[] = [
      querySimilar(tenantNs, vector, topK),
    ];
    if (body.includeNorms) {
      promises.push(querySimilar(ESRS_NORMS_NAMESPACE, vector, Math.min(4, topK)));
    }
    const [tenantHits, normHits = []] = await Promise.all(promises);

    const hits: RagSearchHit[] = [
      ...tenantHits.map((h) => toHit(h, "tenant")),
      ...normHits.map((h) => toHit(h, "esrs-norms")),
    ].sort((a, b) => b.score - a.score);

    return NextResponse.json({ query, hits });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur recherche" },
      { status: 500 },
    );
  }
}
