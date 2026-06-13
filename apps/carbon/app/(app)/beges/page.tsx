"use client";

/**
 * /beges — Bilan GES réglementaire France (BEGES v5, T4.2). Éligibilité,
 * ventilation 6 catégories / 22 postes (total BEGES = total GHG), export ZIP
 * (PDF + Excel auditable), checklist de dépôt ADEME.
 */

import { useEffect, useState } from "react";

import { downloadBegesReport, fetchBegesStatus, type BegesStatus } from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

const ELIG_TONE: Record<string, string> = {
  obligatoire: "bg-amber-50 border-amber-200 text-amber-800",
  obligatoire_om: "bg-amber-50 border-amber-200 text-amber-800",
  volontaire: "bg-emerald-50 border-emerald-200 text-emerald-700",
};

export default function BegesPage() {
  const [data, setData] = useState<BegesStatus | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchBegesStatus(ctrl.signal)
      .then(setData)
      .catch(() => setError(true));
    return () => ctrl.abort();
  }, []);

  if (error) return <div className="p-8 text-sm text-red-600">Impossible de charger le bilan BEGES.</div>;
  if (!data) return <div className="p-8 text-sm text-neutral-400">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Bilan GES réglementaire (BEGES v5)</h1>
          <p className="text-sm text-neutral-500">
            {data.breakdown.standard} · Total {fmt(data.breakdown.total)} tCO2e
          </p>
        </div>
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await downloadBegesReport();
            } catch {
              /* ignore */
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="shrink-0 px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-40"
        >
          {busy ? "Génération…" : "Exporter (PDF + Excel)"}
        </button>
      </div>

      <div className={`rounded-2xl border p-4 mb-8 text-sm ${ELIG_TONE[data.eligibility.status] ?? ELIG_TONE.volontaire}`}>
        <strong>Éligibilité :</strong> {data.eligibility.label}
      </div>

      <div className="space-y-4 mb-8">
        {data.breakdown.categories.map((cat) => (
          <div key={cat.code} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-neutral-800">
                Catégorie {cat.code} — {cat.label}
              </span>
              <span className="text-sm tabular-nums font-semibold">{fmt(cat.total)} tCO2e</span>
            </div>
            <div className="space-y-0.5">
              {cat.postes.map((p) => (
                <div key={p.code} className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    <span className="font-mono text-neutral-400 mr-2">{p.code}</span>
                    {p.label}
                  </span>
                  <span className="tabular-nums">{fmt(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">Dépôt sur bilans-ges.ademe.fr</h2>
        <ol className="text-sm text-neutral-600 space-y-1.5 list-decimal list-inside">
          <li>Créez ou connectez-vous à votre compte sur bilans-ges.ademe.fr.</li>
          <li>Renseignez le périmètre organisationnel et l'année de reporting.</li>
          <li>Reportez les 6 catégories / 22 postes de l'export Excel ci-dessus.</li>
          <li>Joignez la note méthodologique (incluse dans le PDF exporté).</li>
          <li>Soumettez le bilan pour publication.</li>
        </ol>
        <a
          href="https://bilans-ges.ademe.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs underline text-neutral-500 hover:text-black"
        >
          bilans-ges.ademe.fr →
        </a>
      </div>
    </div>
  );
}
