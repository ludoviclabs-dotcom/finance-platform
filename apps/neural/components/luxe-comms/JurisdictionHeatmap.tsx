/**
 * JurisdictionHeatmap — Server Component
 * Matrice 10 claims x 5 juridictions (EU / FR / UK / US / CH).
 * Code couleur : vert = OK, ambre = REVIEW, rouge = INTERDIT.
 */
import { Scale } from "lucide-react";

import { JURISDICTION_MATRIX } from "@/lib/data/luxe-comms-catalog";

function verdictClass(text: string | null | undefined): string {
  if (!text) return "bg-white/[0.02] text-white/30";
  const t = text.toUpperCase();
  if (t.includes("INTERDIT") || t.includes("BLOCK")) return "bg-rose-400/10 text-rose-200 border-rose-400/20";
  if (t.includes("REVIEW") || t.includes("A QUALIFIER")) return "bg-amber-400/10 text-amber-200 border-amber-400/20";
  if (t.includes("N/A")) return "bg-white/[0.02] text-white/30 border-white/5";
  return "bg-emerald-400/10 text-emerald-200 border-emerald-400/20";
}

function shortLabel(text: string | null | undefined): string {
  if (!text) return "—";
  if (text.length <= 18) return text;
  return text.slice(0, 16) + "…";
}

export function JurisdictionHeatmap() {
  const juris = ["eu", "fr", "uk", "us", "ch"] as const;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/10">
          <Scale className="h-4 w-4 text-violet-200" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            AG-005 Multi-juridiction
          </p>
          <h3 className="font-display text-xl font-bold text-white">
            Matrice claims × regulations
          </h3>
          <p className="mt-1 text-sm text-white/55">
            Green Claims Directive (EU) · Loi Climat (FR) · CMA (UK) · Green Guides FTC (US) · CH
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="pb-3 pr-4 font-semibold text-white/55">Pattern</th>
              {juris.map((j) => (
                <th key={j} className="pb-3 pr-2 font-semibold uppercase tracking-wider text-white/55">
                  {j.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JURISDICTION_MATRIX.map((row) => (
              <tr key={row.lib_id} className="border-b border-white/5">
                <td className="py-2.5 pr-4">
                  <span className="font-mono text-[11px] text-white/40">{row.lib_id}</span>
                  <div className="font-semibold text-white/85">{row.claim_pattern}</div>
                </td>
                {juris.map((j) => {
                  const v = row[j];
                  return (
                    <td key={j} className="py-2.5 pr-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-medium ${verdictClass(v)}`}
                        title={v ?? ""}
                      >
                        {shortLabel(v)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-white/45">
        Note : une meme formulation peut etre <span className="text-emerald-300">autorisee EU</span> et{" "}
        <span className="text-rose-300">interdite FR</span> (Loi Climat 2023 sur &quot;carbon neutral&quot;).
      </p>
    </div>
  );
}
