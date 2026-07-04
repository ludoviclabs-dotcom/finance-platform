"use client";

/**
 * /status — page publique d'état (T1.7). Interroge l'API /health côté client
 * toutes les 30 s. N'affiche AUCUNE donnée métier — uniquement l'état des
 * dépendances (DB, stockage, worker) et la version déployée.
 */

import { useEffect, useState } from "react";

type Health = {
  status: string;
  service: string;
  version: string;
  time: string;
  db: string;
  storage: string;
  worker: string;
};

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function tone(value: string): string {
  if (["ok", "inline", "worker"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  // "local" = backend filesystem (dev) — fonctionnel mais non durable sur serverless
  if (value === "local") return "bg-amber-50 text-amber-700 border-amber-200";
  if (value === "not_configured") return "bg-neutral-50 text-neutral-500 border-neutral-200";
  return "bg-red-50 text-red-700 border-red-200"; // down / inconnu
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100">
      <span className="text-sm text-neutral-700">{label}</span>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${tone(value)}`}>{value}</span>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/health`, { cache: "no-store" });
        const j = (await r.json()) as Health;
        if (active) {
          setHealth(j);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const apiUp = !error && health?.status === "ok";

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-neutral-950 text-white py-20 px-8 md:px-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">État du service</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-5">Statut</h1>
          <div className="inline-flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${apiUp ? "bg-emerald-400" : error ? "bg-red-400" : "bg-amber-400"}`} />
            <span className="text-neutral-300">
              {apiUp ? "Tous les services répondent" : error ? "API injoignable" : "Vérification…"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 md:px-16 py-12">
        <div className="rounded-2xl border border-neutral-200 p-6">
          {health ? (
            <>
              <Row label="API" value={health.status} />
              <Row label="Base de données" value={health.db} />
              <Row label="Stockage objet" value={health.storage} />
              <Row label="Worker d'ingestion" value={health.worker} />
              <div className="flex items-center justify-between pt-4 text-xs text-neutral-400">
                <span>Version {health.version}</span>
                <span>Mis à jour {new Date(health.time).toLocaleTimeString("fr-FR")}</span>
              </div>
            </>
          ) : error ? (
            <p className="text-sm text-red-600">Impossible de joindre l&apos;API ({API || "URL non configurée"}).</p>
          ) : (
            <p className="text-sm text-neutral-400">Chargement de l&apos;état…</p>
          )}
        </div>
        <p className="mt-6 text-xs text-neutral-400">
          Cette page n&apos;expose aucune donnée métier — uniquement la disponibilité des composants.
        </p>
      </div>
    </div>
  );
}
