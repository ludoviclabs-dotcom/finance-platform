import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
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
  return (await loadStateWithEtag(cid)).state;
}

/** Comme `loadState`, avec l'ETag du blob (null si l'état n'existe pas encore). */
async function loadStateWithEtag(
  cid: string,
): Promise<{ state: DatapointState; etag: string | null }> {
  const result = await get(statePathname(cid), { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    return { state: emptyState(cid), etag: null };
  }
  const json: unknown = await new Response(result.stream).json();
  return { state: DatapointStateSchema.parse(json), etag: result.blob.etag };
}

export async function saveState(
  state: DatapointState,
  options: { ifMatch?: string } = {},
): Promise<void> {
  const validated = DatapointStateSchema.parse({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  await put(statePathname(state.cid), JSON.stringify(validated, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    addRandomSuffix: false,
    ...(options.ifMatch ? { ifMatch: options.ifMatch } : {}),
  });
}

const MAX_WRITE_ATTEMPTS = 5;

/**
 * Lecture-modification-écriture d'un datapoint, sans perte d'écriture
 * concurrente : l'écriture est conditionnée à l'ETag lu (`ifMatch`) ; si un
 * autre écrivain est passé entre-temps, on relit et on réapplique `update`
 * sur l'état frais. `update` reçoit le datapoint courant (undefined s'il n'a
 * jamais été extrait) et renvoie le nouveau, ou null pour ne rien écrire.
 */
export async function updateDatapoint(
  cid: string,
  datapointId: string,
  update: (existing: ExtractedDatapoint | undefined) => ExtractedDatapoint | null,
): Promise<ExtractedDatapoint | null> {
  for (let attempt = 1; ; attempt++) {
    const { state, etag } = await loadStateWithEtag(cid);
    const next = update(state.datapoints[datapointId]);
    if (!next) return null;
    state.datapoints[datapointId] = next;
    try {
      await saveState(state, etag ? { ifMatch: etag } : {});
      return next;
    } catch (err) {
      if (!(err instanceof BlobPreconditionFailedError) || attempt >= MAX_WRITE_ATTEMPTS) {
        throw err;
      }
    }
  }
}

/**
 * Enregistre une extraction. Une ré-extraction remplace la valeur proposée,
 * mais conserve l'historique des décisions de revue déjà prises.
 */
export async function upsertExtraction(
  cid: string,
  extraction: ExtractedDatapoint,
): Promise<ExtractedDatapoint> {
  const saved = await updateDatapoint(cid, extraction.datapointId, (existing) => {
    const history = extraction.reviewHistory ?? existing?.reviewHistory;
    return history ? { ...extraction, reviewHistory: history } : extraction;
  });
  return saved!;
}
