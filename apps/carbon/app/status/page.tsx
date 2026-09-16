"use client";

/**
 * /status — page publique d'état (T1.7). Interroge l'API /health côté client
 * toutes les 30 s. N'affiche AUCUNE donnée métier — uniquement l'état des
 * dépendances (DB, stockage, worker) et la version déployée.
 *
 * L'état global est dérivé des champs de la réponse (lib/health-status) :
 * une réponse 404/5xx, un corps illisible ou un délai dépassé (8 s) ne
 * laissent plus la page sur « Vérification… », et un `db: "down"` n'est plus
 * présenté comme « Tous les services répondent ».
 */

import { useEffect, useState } from "react";

import { normalizeApiBaseUrl } from "@/lib/api-base-url";
import {
  deriveOverallHealth,
  formatHealthTime,
  parseHealthPayload,
  type HealthPayload,
  type HealthProbe,
} from "@/lib/health-status";

const API = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
const POLL_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 8_000;

type CheckState =
  | { phase: "checking" }
  | { phase: "done"; probe: HealthProbe; checkedAt: Date };

const COMPONENT_LABELS: Record<string, string> = {
  ok: "opérationnel",
  degraded: "dégradé",
  down: "indisponible",
  not_configured: "non configuré",
  local: "local (développement)",
  inline: "intégré",
  worker: "dédié",
};

function tone(value: string): string {
  if (["ok", "inline", "worker"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  // "local" = backend filesystem (dev) — fonctionnel mais non durable sur serverless
  if (value === "local" || value === "degraded") return "bg-amber-50 text-amber-700 border-amber-200";
  if (value === "not_configured") return "bg-neutral-50 text-neutral-500 border-neutral-200";
  return "bg-red-50 text-red-700 border-red-200"; // down / inconnu
}

function Row({ label, value }: { label: string; value: string | null }) {
  const shown = value ?? "inconnu";
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100">
      <span className="text-sm text-neutral-700">{label}</span>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tone(shown)}`}>
        {COMPONENT_LABELS[shown] ?? shown}
      </span>
    </div>
  );
}

async function probeHealth(apiBase: string): Promise<HealthProbe> {
  try {
    const res = await fetch(`${apiBase}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    let payload: HealthPayload | null;
    try {
      payload = parseHealthPayload(await res.json());
    } catch {
      payload = null; // corps non JSON (page d'erreur d'un intermédiaire)
    }
    return { kind: "response", httpOk: res.ok, httpStatus: res.status, payload };
  } catch {
    // Réseau, CORS, DNS ou délai dépassé.
    return { kind: "unreachable" };
  }
}

export default function StatusPage() {
  const [check, setCheck] = useState<CheckState>({ phase: "checking" });

  useEffect(() => {
    if (!API) {
      setCheck({ phase: "done", probe: { kind: "unreachable" }, checkedAt: new Date() });
      return;
    }
    const apiBase = API;
    let active = true;
    const poll = async () => {
      const probe = await probeHealth(apiBase);
      if (active) setCheck({ phase: "done", probe, checkedAt: new Date() });
    };
    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const overall = check.phase === "done" ? deriveOverallHealth(check.probe) : null;
  const probe = check.phase === "done" ? check.probe : null;
  const payload = probe?.kind === "response" && probe.httpOk ? probe.payload : null;
  const updatedAt =
    check.phase === "done"
      ? formatHealthTime(payload?.time) ?? formatHealthTime(check.checkedAt)
      : null;

  const dotClass = !overall
    ? "bg-amber-400"
    : overall.level === "operational"
      ? "bg-emerald-400"
      : overall.level === "degraded"
        ? "bg-amber-400"
        : "bg-red-400";

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-neutral-950 text-white py-20 px-8 md:px-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">État du service</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-5">Statut</h1>
          <div className="inline-flex items-center gap-2 text-sm" role="status" aria-live="polite">
            <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
            <span className="text-neutral-300">{overall ? overall.label : "Vérification…"}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 md:px-16 py-12">
        <div className="rounded-2xl border border-neutral-200 p-6">
          {check.phase === "checking" ? (
            <p className="text-sm text-neutral-400">Chargement de l&apos;état…</p>
          ) : payload ? (
            <>
              <Row label="API" value={payload.status} />
              <Row label="Base de données" value={payload.db} />
              <Row label="Stockage objet" value={payload.storage} />
              <Row label="Worker d'ingestion" value={payload.worker} />
              <div className="flex items-center justify-between pt-4 text-xs text-neutral-400">
                <span>{payload.version ? `Version ${payload.version}` : "Version inconnue"}</span>
                {updatedAt && <span>Mis à jour {updatedAt}</span>}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-red-600">
                {!API
                  ? "L'adresse de l'API n'est pas configurée sur ce déploiement."
                  : probe?.kind === "response"
                    ? `L'API a répondu avec une erreur (HTTP ${probe.httpStatus}).`
                    : "Impossible de joindre l'API pour le moment."}
              </p>
              {updatedAt && (
                <p className="pt-4 text-xs text-neutral-400">Dernière vérification {updatedAt}</p>
              )}
            </>
          )}
        </div>
        <p className="mt-6 text-xs text-neutral-400">
          Cette page n&apos;expose aucune donnée métier — uniquement la disponibilité des composants.
        </p>
      </div>
    </div>
  );
}
