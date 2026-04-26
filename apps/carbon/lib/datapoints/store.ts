import { put, list, head } from "@vercel/blob";
import {
  DatapointStateSchema,
  type DatapointState,
  type ExtractedDatapoint,
} from "@/lib/esrs/schema";

const STATE_FILENAME = "state.json";

function statePathname(cid: string): string {
  return `workbooks/company-${cid}/datapoints/${STATE_FILENAME}`;
}

async function findExistingStateUrl(cid: string): Promise<string | null> {
  const prefix = `workbooks/company-${cid}/datapoints/`;
  const res = await list({ prefix, limit: 100 });
  if (!res.blobs.length) return null;
  const matches = res.blobs.filter((b) => b.pathname.endsWith(STATE_FILENAME));
  if (!matches.length) return null;
  matches.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return matches[0].url;
}

export async function loadState(cid: string): Promise<DatapointState> {
  const url = await findExistingStateUrl(cid);
  if (!url) {
    return { cid, updatedAt: new Date().toISOString(), datapoints: {} };
  }
  try {
    const meta = await head(url);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Lecture state.json échouée (${res.status})`);
    }
    const json = await res.json();
    return DatapointStateSchema.parse(json);
  } catch {
    return { cid, updatedAt: new Date().toISOString(), datapoints: {} };
  }
}

export async function saveState(state: DatapointState): Promise<void> {
  const validated = DatapointStateSchema.parse({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  await put(statePathname(state.cid), JSON.stringify(validated, null, 2), {
    access: "public",
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
