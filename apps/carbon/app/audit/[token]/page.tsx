"use client";

/**
 * /audit/[token] — Vue auditeur invité (T2.2). Lecture seule, sans compte.
 * Le lien (token 64 hex) est résolu par l'API publique /auditor/public/{token}.
 * L'auditeur remonte d'un KPI à sa source (cellule Excel) et à ses pièces
 * justificatives en quelques clics. Aucune écriture possible.
 */

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type Kpi = {
  code: string;
  value: number | null;
  unit: string;
  source_path: string;
  computed_at: string;
  hash_self: string;
};
type Verify = { ok: boolean; broken_at: number | null; checked: number };
type View = {
  company_name: string | null;
  expires_at: string | null;
  label: string | null;
  kpis: Kpi[];
  verify: Verify;
};
type TrailEvent = {
  id: number;
  value: number | null;
  unit: string;
  source_path: string;
  computed_at: string;
  hash_self: string;
};
type Evidence = { sha256: string; filename: string; size: number; url: string | null };

function fmt(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}

export default function AuditorView() {
  const token = String(useParams().token ?? "");
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<{ code: number; detail: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trail, setTrail] = useState<TrailEvent[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`${API}/auditor/public/${token}`, { cache: "no-store" });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (active) setError({ code: r.status, detail: j.detail ?? "Lien inaccessible." });
          return;
        }
        if (active) setView((await r.json()) as View);
      } catch {
        if (active) setError({ code: 0, detail: "API injoignable." });
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const selectKpi = useCallback(
    async (code: string) => {
      setSelected(code);
      setTrail([]);
      setEvidence([]);
      const [t, e] = await Promise.all([
        fetch(`${API}/auditor/public/${token}/trail/${encodeURIComponent(code)}`, { cache: "no-store" }),
        fetch(`${API}/auditor/public/${token}/evidence/${encodeURIComponent(code)}`, { cache: "no-store" }),
      ]);
      if (t.ok) setTrail(((await t.json()).events ?? []) as TrailEvent[]);
      if (e.ok) setEvidence(((await e.json()).evidence ?? []) as Evidence[]);
    },
    [token],
  );

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-white px-6">
        <div className="max-w-md text-center">
          <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Accès auditeur</p>
          <h1 className="text-2xl font-extrabold tracking-tight mb-3">Lien inaccessible</h1>
          <p className="text-sm text-neutral-500">
            {error.code === 410
              ? "Ce lien a expiré."
              : error.code === 403
                ? "Ce lien a été révoqué."
                : error.code === 404
                  ? "Lien invalide ou introuvable."
                  : error.detail}
          </p>
        </div>
      </div>
    );
  }

  if (!view) {
    return <div className="min-h-screen grid place-items-center text-sm text-neutral-400">Chargement…</div>;
  }

  const chainOk = view.verify.ok;

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-neutral-950 text-white py-16 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Accès auditeur — lecture seule</p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter mb-4">
            {view.company_name ?? "Organisation"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${
                chainOk ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-300" : "bg-red-500/10 border-red-400/30 text-red-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${chainOk ? "bg-emerald-400" : "bg-red-400"}`} />
              {chainOk
                ? `Chaîne d'intégrité vérifiée — ${view.verify.checked} events`
                : `Altération détectée (event #${view.verify.broken_at})`}
            </span>
            {view.expires_at && (
              <span className="text-neutral-400 text-xs">
                Accès valable jusqu&apos;au {new Date(view.expires_at).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
          <a
            href={`${API}/auditor/public/${token}/pack`}
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:scale-105 transition-transform"
          >
            Télécharger le pack de preuve (ZIP)
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 md:px-16 py-12 grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-4">Indicateurs ({view.kpis.length})</h2>
          <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
            {view.kpis.length === 0 && <p className="p-5 text-sm text-neutral-400">Aucun indicateur publié.</p>}
            {view.kpis.map((k) => (
              <button
                key={k.code}
                onClick={() => selectKpi(k.code)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-neutral-50 transition-colors ${
                  selected === k.code ? "bg-neutral-50" : ""
                }`}
              >
                <span className="text-sm text-neutral-700 font-mono">{k.code}</span>
                <span className="text-sm font-semibold text-black tabular-nums">
                  {fmt(k.value)} <span className="text-neutral-400 font-normal">{k.unit}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-4">
            {selected ? `Traçabilité — ${selected}` : "Sélectionnez un indicateur"}
          </h2>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-neutral-200 p-5">
                <p className="text-xs font-semibold text-neutral-400 uppercase mb-3">Trail (source & hash)</p>
                {trail.length === 0 && <p className="text-sm text-neutral-400">Aucun event.</p>}
                <ul className="space-y-3">
                  {trail.map((e) => (
                    <li key={e.id} className="text-xs border-l-2 border-neutral-200 pl-3">
                      <div className="font-semibold text-neutral-700">
                        {fmt(e.value)} {e.unit}
                      </div>
                      <div className="text-neutral-500">{e.source_path}</div>
                      <div className="font-mono text-[10px] text-neutral-400 break-all">{e.hash_self.slice(0, 32)}…</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-neutral-200 p-5">
                <p className="text-xs font-semibold text-neutral-400 uppercase mb-3">Pièces justificatives</p>
                {evidence.length === 0 && <p className="text-sm text-neutral-400">Aucune pièce attachée.</p>}
                <ul className="space-y-2">
                  {evidence.map((ev) => (
                    <li key={ev.sha256} className="text-xs flex items-center justify-between gap-2">
                      <a
                        href={ev.url ? `${API}${ev.url}` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-700 underline hover:text-black truncate"
                      >
                        {ev.filename}
                      </a>
                      <span className="font-mono text-[10px] text-neutral-400 shrink-0">{ev.sha256.slice(0, 12)}…</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
