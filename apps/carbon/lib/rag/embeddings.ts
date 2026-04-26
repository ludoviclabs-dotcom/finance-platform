const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_MODEL = "voyage-3-large";
const BATCH_SIZE = 64;

export type EmbeddingInputType = "document" | "query";

type VoyageResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
};

function getApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "VOYAGE_API_KEY manquant. Définir la variable d'environnement avant l'ingestion.",
    );
  }
  return key;
}

async function embedBatch(
  texts: string[],
  inputType: EmbeddingInputType,
  model: string,
): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      input: texts,
      model,
      input_type: inputType,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings échoué (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as VoyageResponse;
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType,
  model: string = DEFAULT_MODEL,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const vecs = await embedBatch(batch, inputType, model);
    out.push(...vecs);
  }
  return out;
}

export async function embedQuery(text: string, model: string = DEFAULT_MODEL): Promise<number[]> {
  const [vec] = await embedTexts([text], "query", model);
  return vec;
}
