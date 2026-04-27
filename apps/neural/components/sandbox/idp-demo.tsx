"use client";

import { useState } from "react";
import { FileText, CheckCircle2, AlertTriangle, Hash, Clock, Sparkles } from "lucide-react";

import samples from "@/content/sandbox/idp-samples.json";

type Sample = (typeof samples.samples)[number];

export function IdpDemo() {
  const [activeSampleId, setActiveSampleId] = useState<string>(samples.samples[0].id);
  const active = samples.samples.find((s) => s.id === activeSampleId) as Sample;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Sample selector */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          Documents-types
        </p>
        {samples.samples.map((s) => {
          const isActive = activeSampleId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSampleId(s.id)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                isActive
                  ? "border-violet-400/50 bg-violet-400/[0.10]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${
                  isActive
                    ? "border-violet-400/40 bg-violet-400/[0.16] text-violet-200"
                    : "border-white/10 bg-white/[0.04] text-white/55"
                }`}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    isActive ? "text-white" : "text-white/85"
                  }`}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">
                  {s.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Extraction display */}
      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/8 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/[0.10]">
              <FileText className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base font-bold text-white">{active.label}</p>
              <p className="font-mono text-[11px] text-white/45 truncate">{active.fileMeta}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Extraction OK
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                <Clock className="h-3 w-3" />
                Latence
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-white/85">
                {active.extractionLatency}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                <Sparkles className="h-3 w-3" />
                Confiance
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-emerald-300">
                {(active.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                <Hash className="h-3 w-3" />
                Horodatage
              </p>
              <p className="mt-1 font-mono text-xs text-white/85">
                {new Date(active.extractedAt).toLocaleTimeString("fr-FR")}
              </p>
            </div>
          </div>
        </div>

        {/* Extracted fields */}
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
            Champs extraits
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {Object.entries(active.extractedFields).map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
              >
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  {key}
                </span>
                <span className="font-mono text-xs text-white/85 break-words">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line items / clauses / KPI based on type */}
        {"lineItems" in active && active.lineItems ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
              Lignes de commande
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
              <div className="grid grid-cols-[1fr_60px_100px_100px] gap-2 border-b border-white/8 bg-white/[0.04] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <span>Description</span>
                <span className="text-right">Qté</span>
                <span className="text-right">PU</span>
                <span className="text-right">Total</span>
              </div>
              {active.lineItems.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_60px_100px_100px] gap-2 border-b border-white/8 px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="text-white/75">{item.description}</span>
                  <span className="text-right font-mono tabular-nums text-white/65">
                    {item.qty}
                  </span>
                  <span className="text-right font-mono tabular-nums text-white/65">
                    {item.unitPrice} €
                  </span>
                  <span className="text-right font-mono tabular-nums text-white">
                    {item.total} €
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {"clausesIdentifiees" in active && active.clausesIdentifiees ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
              Clauses contractuelles identifiées
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {active.clausesIdentifiees.map((c) => (
                <div
                  key={c.clause}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{c.clause}</p>
                    <p className="text-[10px] text-white/50">Page {c.page}</p>
                  </div>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    {c.robustness}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {"kpiFinanciers" in active && active.kpiFinanciers ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
              KPI financiers calculés
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {active.kpiFinanciers.map((kpi) => (
                <div
                  key={kpi.label}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{kpi.label}</p>
                    <p className="text-[10px] text-white/50">{kpi.delta}</p>
                  </div>
                  <span className="font-display text-sm font-bold tabular-nums text-emerald-300">
                    {kpi.valeur}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Anomalies */}
        {active.anomalies.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                Anomalies signalées ({active.anomalies.length})
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {active.anomalies.map((a) => (
                <li key={a} className="text-xs text-white/75">
                  • {a}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Aucune anomalie détectée
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
