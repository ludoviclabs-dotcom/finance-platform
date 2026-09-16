import { get, put } from "@vercel/blob";
import {
  DatapointStateSchema,
  type DatapointState,
  type ExtractedDatapoint,
} from "@/lib/esrs/schema";

const STATE_FILENAME = "state.json";

function statePathname(cid: string): string {
  return `workbooks/company-${cid}/datapoints/${STATE_FILENAME}`;
}

function emptyState(cid: string): DatapointState {
  return { cid, updatedAt: new Date().toISOString(), datapoints: {} };
}

/**
 * État des datapoints de l'organisation. Store PRIVÉ : lecture par le SDK
 * (jeton du store), jamais par un fetch public — celui-ci échouait sur un
 * store privé et faisait croire à un état vide. Seul l'état ABSENT donne un
 * état vide ; une erreur de lecture remonte (sinon la sauvegarde suivante
 * écraserait l'état réel par un état vide).
 */
export async function loadState(cid: string): Promise<DatapointState> {
  const result = await get(statePathname(cid), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    return emptyState(cid);
  }
  const json: unknown = await new Response(result.stream).json();
  return DatapointStateSchema.parse(json);
}

export async function saveState(state: DatapointState): Promise<void> {
  const validated = DatapointStateSchema.parse({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  await put(statePathname(state.cid), JSON.stringify(validated, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function upsertExtraction(
  cid: string,
  extraction: ExtractedDatapoint,
): Promise<DatapointState> {
  const state = await loadState(cid);
  state.datapoints[extraction.datapointId] = extraction;
  await saveState(state);
  return state;
}
