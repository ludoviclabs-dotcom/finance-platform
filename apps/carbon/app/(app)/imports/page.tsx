"use client";

/**
 * /imports — Adaptateurs d'import fichiers (T5.4) : AWS CCFT, GCP Carbon
 * Footprint, Qonto CSV. Upload → écran de revue (ventilation Scope 3) → émission
 * validée (gate : aucun fact sans validation analyste).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  emitImport,
  fetchImports,
  uploadImport,
  type ImportScreening,
  type ImportType,
  type ImportUploadResult,
} from "@/lib/api";

const TYPES: { key: ImportType; label: string; hint: string }[] = [
  { key: "aws", label: "AWS CCFT", hint: "Customer Carbon Footprint (CSV, MTCO2e)" },
  { key: "gcp", label: "GCP", hint: "Carbon Footprint export (CSV, kgCO2e)" },
  { key: "qonto", label: "Qonto", hint: "Relevé CSV → screening monétaire" },
];

export default function ImportsPage() {
  const [type, setType] = useState<ImportType>("aws");
  const [preview, setPreview] = useState<ImportUploadResult | null>(null);
  const [imports, setImports] = useState<ImportScreening[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchImports().then((r) => setImports(r.imports)).catch(() => setImports([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await uploadImport(type, file);
      setPreview(res);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'import");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const emit = async (id: number) => {
    setBusy(true);
    try {
      await emitImport(id);
      setPreview(null);
      load();
    } catch {
      /* gate / DB */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Imports fichiers</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Importez un export AWS, GCP ou Qonto. Chaque import est screené puis revu avant émission — aucun chiffre n&apos;entre dans la chaîne sans validation.
      </p>

      <div className="rounded-2xl border border-neutral-200 p-5 mb-6">
        <div className="flex gap-2 mb-4">
          {TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${type === t.key ? "bg-black text-white border-black" : "border-neutral-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400 mb-3">{TYPES.find((t) => t.key === type)?.hint}</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy}
          className="text-sm file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-neutral-900 file:text-white file:text-sm file:font-semibold" />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {preview && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-2">Revue — {preview.filename}</h2>
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <span><b>{preview.screening.total_tco2e}</b> tCO2e</span>
            {preview.screening.total_spend != null && <span><b>{preview.screening.total_spend}</b> € de dépenses</span>}
            <span>{preview.screening.mappable_pct}% mappé</span>
            <span>qualité {preview.screening.quality}</span>
          </div>
          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="text-neutral-400 uppercase tracking-wide">
                <th className="text-left py-1">Catégorie Scope 3</th>
                {preview.screening.total_spend != null && <th className="text-right py-1">€</th>}
                <th className="text-right py-1">tCO2e</th>
              </tr>
            </thead>
            <tbody>
              {preview.screening.by_category.map((c) => (
                <tr key={c.category} className="border-t border-neutral-100">
                  <td className="py-1">{c.category}. {c.label}</td>
                  {preview.screening.total_spend != null && <td className="py-1 text-right tabular-nums">{c.spend}</td>}
                  <td className="py-1 text-right tabular-nums">{c.tco2e}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.persisted && preview.id != null ? (
            <button onClick={() => emit(preview.id!)} disabled={busy}
              className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
              Valider et émettre les facts
            </button>
          ) : (
            <p className="text-xs text-neutral-400">Aperçu non persisté (base indisponible).</p>
          )}
        </div>
      )}

      {imports.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100">
          {imports.map((im) => (
            <div key={im.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <span className="font-semibold">{im.import_type.toUpperCase()} · {im.filename}</span>
              <span className="flex items-center gap-3 text-xs text-neutral-400">
                {im.total_tco2e != null && <span>{im.total_tco2e} tCO2e</span>}
                <span className={`px-2 py-0.5 rounded-full ${im.status === "emitted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{im.status}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
