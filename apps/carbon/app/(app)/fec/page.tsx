"use client";

/**
 * /fec — Import FEC → screening Scope 3 monétaire (T4.3). On dépose un FEC, le
 * serveur estime les émissions Scope 3 par catégorie via les ratios monétaires.
 * RIEN n'entre dans la chaîne de preuve tant que l'utilisateur ne valide pas
 * explicitement (bouton « Valider et émettre »).
 */

import { useState } from "react";

import { emitFec, uploadFec, type FecUploadResult } from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

export default function FecPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<FecUploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emitted, setEmitted] = useState<number | null>(null);

  const analyse = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setEmitted(null);
    try {
      setResult(await uploadFec(file));
    } catch {
      setError("Échec de l'analyse du FEC (format attendu : 18 champs, séparateur | ou tabulation).");
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    if (!result?.id) return;
    setBusy(true);
    try {
      const res = await emitFec(result.id);
      setEmitted(res?.emitted_facts ?? 0);
    } catch {
      setError("Échec de l'émission.");
    } finally {
      setBusy(false);
    }
  };

  const s = result?.screening;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Import FEC — screening Scope 3</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Estimation monétaire des émissions Scope 3 à partir de vos écritures comptables (classe 6).
        Rien n&apos;est émis sans votre validation.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="file"
          accept=".txt,.csv,text/plain"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setEmitted(null);
          }}
          className="text-xs text-neutral-500 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-neutral-100 file:cursor-pointer"
        />
        <button
          onClick={analyse}
          disabled={!file || busy}
          className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40"
        >
          {busy ? "Analyse…" : "Analyser le FEC"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {s && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-neutral-50 py-3">
              <p className={`text-xl font-bold ${s.mappable_pct >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                {fmt(s.mappable_pct)}%
              </p>
              <p className="text-[10px] text-neutral-500">spend mappé</p>
            </div>
            <div className="rounded-xl bg-neutral-50 py-3">
              <p className="text-xl font-bold tabular-nums">{fmt(s.total_tco2e)}</p>
              <p className="text-[10px] text-neutral-500">tCO2e estimées (Scope 3)</p>
            </div>
            <div className="rounded-xl bg-neutral-50 py-3">
              <p className="text-xl font-bold tabular-nums">{fmt(s.total_spend)}</p>
              <p className="text-[10px] text-neutral-500">€ de charges analysées</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">Par catégorie Scope 3</h2>
            <table className="w-full text-xs">
              <tbody>
                {s.by_category.map((c) => (
                  <tr key={c.category} className="border-t border-neutral-100">
                    <td className="py-2 font-mono text-neutral-400">3.{c.category}</td>
                    <td className="py-2 text-neutral-700">{c.label}</td>
                    <td className="py-2 text-right tabular-nums text-neutral-500">{fmt(c.spend)} €</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmt(c.tco2e)} tCO2e</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.unmapped_accounts.length > 0 && (
              <p className="mt-3 text-[10px] text-amber-600">
                Comptes non mappés (hors Scope 3) : {s.unmapped_accounts.join(", ")}
              </p>
            )}
          </div>

          {emitted === null ? (
            result?.persisted ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
                <span className="text-sm text-amber-800">
                  Aucun fact n&apos;a encore été émis. Validez pour les inscrire dans la chaîne de preuve (qualité 4 — proxy monétaire).
                </span>
                <button
                  onClick={validate}
                  disabled={busy}
                  className="shrink-0 px-4 py-2 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40"
                >
                  {busy ? "…" : "Valider et émettre"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">Mode hors-ligne : screening non enregistré (base indisponible).</p>
            )
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              ✓ {emitted} fact(s) Scope 3 émis et chaînés. Visibles dans le dashboard et le trail.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
