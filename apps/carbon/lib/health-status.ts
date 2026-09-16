/**
 * Dérivation de l'état global affiché par /status à partir de GET /health.
 *
 * Contrat API : `{status: "ok" | "degraded", db, storage, worker, version,
 * time}` avec db / storage ∈ ok | down | not_configured (storage peut aussi
 * valoir `local` en développement).
 *
 * Vert UNIQUEMENT si la réponse HTTP est un succès ET `status === "ok"` ET ni
 * la base ni le stockage ne sont `down`. Un `status: "ok"` accompagné d'une
 * base `down` n'est donc plus présenté comme « Tous les services répondent ».
 */

export interface HealthPayload {
  status: string | null;
  version: string | null;
  time: string | null;
  db: string | null;
  storage: string | null;
  worker: string | null;
}

/** Résultat brut d'une sonde : réponse HTTP (lisible ou non) ou API injoignable. */
export type HealthProbe =
  | { kind: "response"; httpOk: boolean; httpStatus: number; payload: HealthPayload | null }
  | { kind: "unreachable" };

export type HealthLevel = "operational" | "degraded" | "down";

export interface OverallHealth {
  level: HealthLevel;
  label: string;
}

function field(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Corps JSON → payload typé ; `null` si ce n'est pas un objet exploitable. */
export function parseHealthPayload(json: unknown): HealthPayload | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const source = json as Record<string, unknown>;
  return {
    status: field(source, "status"),
    version: field(source, "version"),
    time: field(source, "time"),
    db: field(source, "db"),
    storage: field(source, "storage"),
    worker: field(source, "worker"),
  };
}

export function deriveOverallHealth(probe: HealthProbe): OverallHealth {
  if (probe.kind === "unreachable") {
    return { level: "down", label: "API injoignable" };
  }
  if (!probe.httpOk || !probe.payload) {
    return { level: "down", label: "API en erreur" };
  }
  const { status, db, storage } = probe.payload;
  if (status === "ok" && db !== "down" && storage !== "down") {
    return { level: "operational", label: "Tous les services répondent" };
  }
  return { level: "degraded", label: "Service dégradé" };
}

/** Heure lisible (fr-FR) ou `null` — jamais « Invalid Date ». */
export function formatHealthTime(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("fr-FR");
}
