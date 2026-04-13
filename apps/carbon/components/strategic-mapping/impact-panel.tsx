"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { staggerItem } from "@/lib/animations";
import type { FinancialGain, PositiveExternality } from "@/lib/api";

interface Props {
  financialGains: FinancialGain[];
  externalities: PositiveExternality[];
}

type Tab = "financier" | "extra_financier";

const CATEGORY_SCORE: Record<string, number> = {
  Gouvernance: 80,
  Environnement: 75,
  Réputation: 70,
  Finance: 85,
  Social: 65,
};

export function ImpactPanel({ financialGains, externalities }: Props) {
  const [tab, setTab] = useState<Tab>("financier");

  const radarData = externalities.map((e) => ({
    subject: e.label.length > 20 ? e.label.slice(0, 20) + "…" : e.label,
    value: CATEGORY_SCORE[e.category] ?? 70,
    fullLabel: e.label,
  }));

  return (
    <motion.div variants={staggerItem} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">
          Impacts et gains
        </h2>
        <p className="text-sm text-[var(--color-foreground-muted)]">
          Gains économiques documentés et externalités positives de la démarche.
        </p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] w-fit">
        {(["financier", "extra_financier"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {t === "financier" ? "Financier" : "Extra-financier"}
          </button>
        ))}
      </div>

      {tab === "financier" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {financialGains.map((gain) => (
            <GainCard key={gain.id} gain={gain} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Radar */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs font-medium text-[var(--color-foreground-muted)] uppercase tracking-wide mb-3">
              Vue radar — externalités positives
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--color-foreground-muted)", fontSize: 10 }}
                />
                <Radar
                  name="Impact"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-[var(--color-foreground-muted)] italic text-center">
              Scores indicatifs — Carbon & Co
            </p>
          </div>

          {/* Cartes externalités */}
          <div className="space-y-3">
            {externalities.map((ext) => (
              <ExternalityCard key={ext.id} ext={ext} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function GainCard({ gain }: { gain: FinancialGain }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 hover:border-[var(--color-primary)]/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm text-[var(--color-foreground)]">{gain.label}</h3>
        {gain.qualitative ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-foreground-muted)]/10 text-[var(--color-foreground-muted)] shrink-0">
            Qualitatif
          </span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium shrink-0">
            Chiffré
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--color-foreground-muted)] leading-relaxed">{gain.description}</p>

      {gain.magnitude && (
        <div className="rounded-lg bg-[var(--color-primary)]/8 px-3 py-2">
          <p className="text-xs font-medium text-[var(--color-primary)]">{gain.magnitude}</p>
        </div>
      )}

      {gain.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {gain.sources.map((src, i) => (
            src.url ? (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-[var(--color-foreground-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {src.publisher} {src.year}
              </a>
            ) : (
              <span key={i} className="text-[10px] text-[var(--color-foreground-muted)]">
                {src.publisher} {src.year}
              </span>
            )
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORY_COLOR: Record<string, string> = {
  Gouvernance: "text-violet-400 bg-violet-400/10",
  Environnement: "text-emerald-400 bg-emerald-400/10",
  Réputation: "text-pink-400 bg-pink-400/10",
  Finance: "text-blue-400 bg-blue-400/10",
  Social: "text-amber-400 bg-amber-400/10",
};

function ExternalityCard({ ext }: { ext: PositiveExternality }) {
  const colorClass = CATEGORY_COLOR[ext.category] ?? "text-[var(--color-primary)] bg-[var(--color-primary)]/10";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
          {ext.category}
        </span>
        <h3 className="font-semibold text-sm text-[var(--color-foreground)]">{ext.label}</h3>
      </div>
      <p className="text-xs text-[var(--color-foreground-muted)] leading-relaxed">{ext.description}</p>
    </div>
  );
}
