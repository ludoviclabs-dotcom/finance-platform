import { Index } from "@upstash/vector";

export type ChunkMetadata = {
  cid: string;
  blobUrl: string;
  filename: string;
  mimeType: string;
  page?: number;
  sheet?: string;
  chunkIndex: number;
  uploadedAt: string;
  text: string;
};

export type RagSearchResult = {
  id: string;
  score: number;
  metadata: ChunkMetadata;
};

let _index: Index | null = null;

function getIndex(): Index {
  if (_index) return _index;
  const url = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_VECTOR_REST_URL et UPSTASH_VECTOR_REST_TOKEN doivent être définis.",
    );
  }
  _index = new Index({ url, token });
  return _index;
}

export function tenantNamespace(cid: string): string {
  return `cid-${cid}`;
}

export const ESRS_NORMS_NAMESPACE = "esrs-norms";

export type UpsertVector = {
  id: string;
  vector: number[];
  metadata: ChunkMetadata;
};

export async function upsertChunks(
  namespace: string,
  vectors: UpsertVector[],
): Promise<void> {
  if (vectors.length === 0) return;
  const ns = getIndex().namespace(namespace);
  const BATCH = 100;
  for (let i = 0; i < vectors.length; i += BATCH) {
    const slice = vectors.slice(i, i + BATCH);
    await ns.upsert(
      slice.map((v) => ({
        id: v.id,
        vector: v.vector,
        metadata: v.metadata as unknown as Record<string, unknown>,
      })),
    );
  }
}

export async function querySimilar(
  namespace: string,
  vector: number[],
  topK: number,
): Promise<RagSearchResult[]> {
  const ns = getIndex().namespace(namespace);
  const res = await ns.query({
    vector,
    topK,
    includeMetadata: true,
  });
  return (res ?? []).map((r) => ({
    id: String(r.id),
    score: r.score,
    metadata: (r.metadata ?? {}) as unknown as ChunkMetadata,
  }));
}

export async function deleteByBlobUrl(namespace: string, blobUrl: string): Promise<void> {
  const ns = getIndex().namespace(namespace);
  await ns.delete({ filter: `blobUrl = '${blobUrl.replace(/'/g, "\\'")}'` });
}
