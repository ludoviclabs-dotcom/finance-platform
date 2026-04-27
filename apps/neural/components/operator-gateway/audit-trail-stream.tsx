"use client";

import { useState } from "react";
import { ChevronDown, Hash, Clock, Cpu, FileSignature } from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  agent: string;
  decision: string;
  promptHash: string;
  promptVersion: string;
  model: string;
  tokens: number;
  latency: string;
  cost: string;
  tenant: string;
  signedBy: string;
  outcome: string;
  trigger: string;
}

const DECISION_CLS: Record<string, string> = {
  APPROVE: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  REVIEW: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
  REWORK: "border-orange-400/25 bg-orange-400/[0.10] text-orange-200",
  BLOCK: "border-red-500/30 bg-red-500/[0.10] text-red-300",
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditTrailStream({ entries }: { entries: AuditEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(entries[0]?.id || null);

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isExpanded = expandedId === entry.id;
        const dCls = DECISION_CLS[entry.decision] || DECISION_CLS["REVIEW"];
        return (
          <div
            key={entry.id}
            className={`overflow-hidden rounded-[16px] border transition-colors ${
              isExpanded ? "border-white/20 bg-white/[0.05]" : "border-white/8 bg-white/[0.03]"
            }`}
          >
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              className="grid w-full grid-cols-[80px_1fr_auto_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
              aria-expanded={isExpanded}
            >
              <span className="font-mono text-[11px] tabular-nums text-white/45">
                {formatTimestamp(entry.timestamp)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{entry.agent}</p>
                <p className="truncate text-xs text-white/50">{entry.outcome}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${dCls}`}
              >
                {entry.decision}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-white/40 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              className="grid transition-all duration-300"
              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="space-y-3 border-t border-white/8 bg-black/20 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                        <Hash className="h-3 w-3" />
                        Prompt hash signé
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-white/85">{entry.promptHash}</p>
                      <p className="text-[10px] text-white/40">
                        Version : {entry.promptVersion}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                        <FileSignature className="h-3 w-3" />
                        Signataire
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-white/85">{entry.signedBy}</p>
                      <p className="text-[10px] text-white/40">Tenant : {entry.tenant}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Modèle
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
                        <Cpu className="h-3 w-3 text-violet-300" />
                        {entry.model}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Tokens
                      </p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-white/85">
                        {entry.tokens}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                        <Clock className="h-3 w-3" />
                        Latence
                      </p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-white/85">
                        {entry.latency}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        Coût
                      </p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-emerald-300">
                        {entry.cost}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Trigger d&apos;origine
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/70">{entry.trigger}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
