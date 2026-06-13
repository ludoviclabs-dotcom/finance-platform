"use client";

/**
 * /vsme/completude — Écran de complétude VSME (T3.2). Affiche le mapping
 * automatique (E1 / matérialité / S1 / G1 → modules VSME), la complétude par
 * module (dénominateur = datapoints obligatoires), et une saisie guidée des
 * datapoints manquants (chaque saisie = fact chaîné). Un datapoint auto-rempli
 * porte sa source ; « non applicable » exige une justification.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  downloadVsmeReport,
  fetchVsmeMappingStatus,
  saveVsmeDatapoint,
  type VsmeDatapointRow,
  type VsmeMappingStatus,
} from "@/lib/api";

const STATUS_BADGE: Record<string, string> = {
  auto: "bg-emerald-50 text-emerald-700 border-emerald-200",
  manuel: "bg-blue-50 text-blue-700 border-blue-200",
  na: "bg-neutral-100 text-neutral-500 border-neutral-200",
  missing: "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_LABEL: Record<string, string> = {
  auto: "auto",
  manuel: "saisi",
  na: "n/a",
  missing: "manquant",
};

function GuidedEntry({ row, onSaved }: { row: VsmeDatapointRow; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [na, setNa] = useState(false);
  const [justif, setJustif] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await saveVsmeDatapoint(
        na
          ? { code: row.code, is_applicable: false, na_justification: justif }
          : { code: row.code, value: row.type === "quantitatif" ? Number(value) : value, is_applicable: true },
      );
      onSaved();
    } catch {
      setErr("Échec de l'enregistrement (justification ≥ 10 caractères si non applicable).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {!na ? (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={row.unit ? `valeur (${row.unit})` : "valeur"}
          className="px-2 py-1 text-xs rounded border border-neutral-200 w-40"
        />
      ) : (
        <input
          value={justif}
          onChange={(e) => setJustif(e.target.value)}
          placeholder="justification (≥ 10 car.)"
          className="px-2 py-1 text-xs rounded border border-neutral-200 w-64"
        />
      )}
      <label className="text-xs text-neutral-500 flex items-center gap-1">
        <input type="checkbox" checked={na} onChange={(e) => setNa(e.target.checked)} /> non applicable
      </label>
      <button
        onClick={submit}
        disabled={busy}
        className="px-3 py-1 text-xs rounded bg-black text-white disabled:opacity-40"
      >
        {busy ? "…" : "Enregistrer"}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

export default function VsmeCompletudePage() {
  const [data, setData] = useState<VsmeMappingStatus | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    fetchVsmeMappingStatus(ctrl.signal)
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
    return ctrl;
  }, []);

  useEffect(() => {
    const ctrl = load();
    return () => ctrl.abort();
  }, [load]);

  const byModule = useMemo(() => {
    const map = new Map<string, VsmeDatapointRow[]>();
    data?.datapoints.forEach((d) => {
      const arr = map.get(d.module) ?? [];
      arr.push(d);
      map.set(d.module, arr);
    });
    return map;
  }, [data]);

  if (error) return <div className="p-8 text-sm text-red-600">Impossible de charger la complétude VSME.</div>;
  if (!data) return <div className="p-8 text-sm text-neutral-400">Chargement…</div>;

  const c = data.completeness;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Complétude VSME</h1>
          <p className="text-sm text-neutral-500">
            Référentiel {data.version} · {c.mandatory_filled}/{c.mandatory_total} datapoints obligatoires renseignés
          </p>
        </div>
        <button
          onClick={async () => {
            setExporting(true);
            try {
              await downloadVsmeReport();
            } catch {
              /* ignore */
            } finally {
              setExporting(false);
            }
          }}
          disabled={exporting}
          className="shrink-0 px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-40"
        >
          {exporting ? "Génération…" : "Télécharger le rapport VSME"}
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold uppercase tracking-wide text-neutral-500">Global</span>
          <span className="text-3xl font-extrabold tabular-nums">{c.overall_pct}%</span>
        </div>
        <div className="space-y-1.5">
          {c.modules.map((m) => (
            <div key={m.module} className="flex items-center gap-2 text-xs">
              <span className="w-10 shrink-0 font-mono text-neutral-500">{m.module}</span>
              <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${m.pct}%` }} />
              </div>
              <span className="w-14 text-right tabular-nums text-neutral-600">
                {m.filled}/{m.total}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {[...byModule.entries()].map(([mod, rows]) => (
          <div key={mod}>
            <h2 className="text-sm font-bold text-neutral-700 mb-2">Module {mod}</h2>
            <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              {rows.map((r) => (
                <div key={r.code} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-neutral-400 mr-2">{r.code}</span>
                      <span className="text-sm text-neutral-700">{r.label}</span>
                      {r.source && r.status === "auto" && (
                        <span className="ml-2 text-[10px] text-neutral-400">source : {r.source}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.value != null && r.status !== "na" && (
                        <span className="text-sm tabular-nums text-black">
                          {String(r.value)} {r.unit}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {(r.status === "missing" || r.status === "manuel") && (
                        <button
                          onClick={() => setEditing(editing === r.code ? null : r.code)}
                          className="text-xs text-neutral-500 underline"
                        >
                          {editing === r.code ? "fermer" : "renseigner"}
                        </button>
                      )}
                    </div>
                  </div>
                  {editing === r.code && (
                    <GuidedEntry
                      row={r}
                      onSaved={() => {
                        setEditing(null);
                        load();
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
