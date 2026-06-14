"use client";

/**
 * /diff — Comparaison multi-exercices (T5.5). Variations par poste entre les deux
 * dernières versions d'un snapshot + export « réponses prêtes » questionnaires
 * (CDP / EcoVadis) en CSV avec référence du fact source.
 */

import { useCallback, useEffect, useState } from "react";

import {
  downloadQuestionnaire,
  fetchDiff,
  fetchQuestionnaireCatalogs,
  type QuestionnaireCatalog,
  type SnapshotDiff,
} from "@/lib/api";

const DOMAINS = ["carbon", "vsme", "esg", "finance"];

function pct(v: number | null): string {
  return v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`;
}

export default function DiffPage() {
  const [domain, setDomain] = useState("carbon");
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [cat, setCat] = useState<QuestionnaireCatalog | null>(null);

  const load = useCallback((d: string) => {
    fetchDiff(d).then(setDiff).catch(() => setDiff(null));
  }, []);

  useEffect(() => { load(domain); }, [domain, load]);
  useEffect(() => { fetchQuestionnaireCatalogs().then(setCat).catch(() => setCat(null)); }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Comparaison multi-exercices</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Variations par poste entre les deux dernières versions, et export de réponses prêtes pour les questionnaires clients.
      </p>

      <div className="flex gap-2 mb-6">
        {DOMAINS.map((d) => (
          <button key={d} onClick={() => setDomain(d)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${domain === d ? "bg-black text-white border-black" : "border-neutral-200"}`}>
            {d}
          </button>
        ))}
      </div>

      {diff && diff.available ? (
        <div className="rounded-2xl border border-neutral-200 p-5 mb-6">
          <div className="flex gap-4 text-xs text-neutral-500 mb-3">
            <span>{diff.diff.changed_count} modifié(s)</span>
            <span>{diff.diff.added_count} nouveau(x)</span>
            <span>{diff.diff.removed_count} disparu(s)</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400 uppercase tracking-wide">
                <th className="text-left py-1">Poste</th>
                <th className="text-right py-1">Avant</th>
                <th className="text-right py-1">Après</th>
                <th className="text-right py-1">Δ%</th>
              </tr>
            </thead>
            <tbody>
              {diff.diff.changed.map((c) => (
                <tr key={c.path} className="border-t border-neutral-100">
                  <td className="py-1 font-mono text-neutral-500">{c.path}</td>
                  <td className="py-1 text-right tabular-nums">{c.before}</td>
                  <td className="py-1 text-right tabular-nums">{c.after}</td>
                  <td className={`py-1 text-right tabular-nums ${c.change_pct != null && c.change_pct > 0 ? "text-red-600" : c.change_pct != null && c.change_pct < 0 ? "text-emerald-600" : "text-neutral-400"}`}>{pct(c.change_pct)}</td>
                </tr>
              ))}
              {diff.diff.added.map((a) => (
                <tr key={a.path} className="border-t border-neutral-100 text-emerald-700">
                  <td className="py-1 font-mono">{a.path}</td>
                  <td className="py-1 text-right">—</td>
                  <td className="py-1 text-right tabular-nums">{a.value}</td>
                  <td className="py-1 text-right">nouveau</td>
                </tr>
              ))}
            </tbody>
          </table>
          {diff.diff.meta_changed.length > 0 && (
            <div className="mt-3 text-xs text-neutral-500">
              {diff.diff.meta_changed.map((m) => (
                <div key={m.path}>FE/méta : <span className="font-mono">{m.path}</span> {m.before} → {m.after}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 mb-6">
          Au moins deux versions de snapshot sont nécessaires pour comparer ce domaine.
        </p>
      )}

      <div className="rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">Export réponses questionnaires</h2>
        <div className="flex flex-wrap gap-2">
          {cat?.questionnaires.map((q) => (
            <button key={q.key} onClick={() => downloadQuestionnaire(q.key).catch(() => null)}
              className="px-3 py-1.5 rounded-full border border-neutral-300 text-sm font-semibold">
              {q.label} ({q.question_count})
            </button>
          ))}
          <button onClick={() => downloadQuestionnaire().catch(() => null)}
            className="px-3 py-1.5 rounded-full bg-black text-white text-sm font-semibold">
            Tout exporter (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}
