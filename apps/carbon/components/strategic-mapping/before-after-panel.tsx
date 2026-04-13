"use client";

import { motion } from "framer-motion";
import { XCircle, CheckCircle2 } from "lucide-react";
import { staggerItem } from "@/lib/animations";
import type { BeforeAfterItem } from "@/lib/api";

interface Props {
  items: BeforeAfterItem[];
}

const TAG_COLORS: Record<string, string> = {
  "financement": "bg-blue-400/10 text-blue-400",
  "commercial": "bg-violet-400/10 text-violet-400",
  "opérationnel": "bg-amber-400/10 text-amber-400",
  "réputation": "bg-pink-400/10 text-pink-400",
  "réglementaire": "bg-red-400/10 text-red-400",
  "rh": "bg-emerald-400/10 text-emerald-400",
};

export function BeforeAfterPanel({ items }: Props) {
  return (
    <motion.div variants={staggerItem} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">
          Avant / Après l&apos;adhésion volontaire
        </h2>
        <p className="text-sm text-[var(--color-foreground-muted)]">
          Ce que la démarche ESG volontaire transforme concrètement.
        </p>
      </div>

      {/* En-têtes colonnes */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">Sans démarche</span>
        </div>
        <div className="w-px" />
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Avec démarche</span>
        </div>
      </div>

      {/* Lignes */}
      <div className="space-y-2">
        {items.map((item) => {
          const tagColor = item.impactTag ? (TAG_COLORS[item.impactTag] ?? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]") : "";
          return (
            <div
              key={item.category}
              className="grid grid-cols-[1fr_auto_1fr] gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
            >
              {/* Avant */}
              <div className="p-4 border-r border-[var(--color-border)]/50 bg-red-500/3">
                <p className="text-sm text-[var(--color-foreground-muted)]">{item.before}</p>
              </div>

              {/* Catégorie */}
              <div className="flex flex-col items-center justify-center px-3 gap-1.5 min-w-[90px]">
                <span className="text-[10px] font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide text-center">
                  {item.category}
                </span>
                {item.impactTag && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${tagColor}`}>
                    {item.impactTag}
                  </span>
                )}
              </div>

              {/* Après */}
              <div className="p-4 border-l border-[var(--color-border)]/50 bg-emerald-500/3">
                <p className="text-sm text-[var(--color-foreground)] font-medium">{item.after}</p>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
