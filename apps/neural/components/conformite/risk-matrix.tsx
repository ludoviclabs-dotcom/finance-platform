/**
 * RiskMatrix — grille des 4 niveaux AI Act avec hover détaillé.
 */

"use client";

import { useState } from "react";

interface RiskLevel {
  label: string;
  color: string;
  agentCount: number;
  description: string;
  examples: string[];
}

interface RiskMatrixProps {
  classification: {
    interdit: RiskLevel;
    "haut-risque": RiskLevel;
    limite: RiskLevel;
    minimal: RiskLevel;
  };
}

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; bgHover: string }> = {
  red: {
    bg: "bg-red-500/[0.10]",
    border: "border-red-500/30",
    text: "text-red-300",
    bgHover: "hover:bg-red-500/[0.16]",
  },
  orange: {
    bg: "bg-orange-500/[0.10]",
    border: "border-orange-500/30",
    text: "text-orange-300",
    bgHover: "hover:bg-orange-500/[0.16]",
  },
  amber: {
    bg: "bg-amber-400/[0.10]",
    border: "border-amber-400/25",
    text: "text-amber-200",
    bgHover: "hover:bg-amber-400/[0.16]",
  },
  emerald: {
    bg: "bg-emerald-400/[0.10]",
    border: "border-emerald-400/25",
    text: "text-emerald-300",
    bgHover: "hover:bg-emerald-400/[0.16]",
  },
};

const ORDERED_KEYS = ["interdit", "haut-risque", "limite", "minimal"] as const;

export function RiskMatrix({ classification }: RiskMatrixProps) {
  const [active, setActive] = useState<string>("haut-risque");
  const activeData = classification[active as keyof typeof classification];
  const activeCls = COLOR_CLASSES[activeData.color];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        {ORDERED_KEYS.map((key) => {
          const level = classification[key];
          const cls = COLOR_CLASSES[level.color];
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`group flex flex-col items-start gap-3 rounded-[24px] border p-5 text-left transition-all duration-300 ${
                cls.bg
              } ${cls.border} ${cls.bgHover} ${
                isActive
                  ? "ring-2 ring-offset-2 ring-offset-neural-midnight " + cls.border.replace("border-", "ring-")
                  : ""
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.text}`}
              >
                {level.label}
              </span>
              <p className="font-display text-4xl font-bold tabular-nums text-white">
                {level.agentCount}
              </p>
              <p className="text-xs text-white/55">
                {level.agentCount === 0
                  ? "Aucun agent NEURAL dans cette catégorie"
                  : level.agentCount === 1
                  ? "1 agent concerné"
                  : `${level.agentCount} agents concernés`}
              </p>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className={`flex flex-col gap-4 rounded-[24px] border ${activeCls.border} ${activeCls.bg} p-6`}>
        <div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${activeCls.border} ${activeCls.text}`}
          >
            {activeData.label}
          </span>
          <p className="mt-3 font-display text-2xl font-bold tracking-tight text-white">
            {activeData.agentCount} agent{activeData.agentCount > 1 ? "s" : ""}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-white/70">{activeData.description}</p>
        {activeData.examples.length > 0 ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Exemples</p>
            <ul className="mt-2 space-y-1.5">
              {activeData.examples.map((ex) => (
                <li key={ex} className="flex gap-2 text-sm text-white/65">
                  <span className={`mt-1.5 h-1 w-1 flex-shrink-0 rounded-full ${activeCls.text.replace("text-", "bg-")}`} />
                  <span>{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
