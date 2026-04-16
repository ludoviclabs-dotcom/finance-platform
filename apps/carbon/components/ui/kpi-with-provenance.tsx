"use client";

/**
 * KpiWithProvenance — wrapper autour de <KpiCard> qui ajoute :
 *   - un bouton "Voir la provenance" en bas
 *   - un drawer latéral (KpiProvenanceDrawer) piloté par état local
 *
 * Utilisation :
 *   <KpiWithProvenance
 *     label="Scope 1 — Direct"
 *     value={120.5}
 *     unit="tCO₂e"
 *     change={-5}
 *     icon={<FlameIcon />}
 *     factCode="CC.GES.SCOPE1"
 *   />
 */

import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { useState } from "react";

import { KpiCard } from "@/components/ui/kpi-card";
import { KpiProvenanceDrawer } from "@/components/ui/kpi-provenance-drawer";
import { staggerItem } from "@/lib/animations";

interface KpiWithProvenanceProps {
  label: string;
  value: number;
  unit: string;
  change: number;
  icon: React.ReactNode;
  /** fact_code ADEME — si absent, le bouton provenance est masqué (ex: KPIs dérivés non tracés). */
  factCode?: string;
  /** Affichage condensé (dashboard grid) — défaut true. */
  compact?: boolean;
}

export function KpiWithProvenance({
  label,
  value,
  unit,
  change,
  icon,
  factCode,
  compact: _compact = true,
}: KpiWithProvenanceProps) {
  const [open, setOpen] = useState(false);

  // Si pas de factCode, fallback au KpiCard classique sans wrapper.
  if (!factCode) {
    return <KpiCard label={label} value={value} unit={unit} change={change} icon={icon} />;
  }

  return (
    <>
      <motion.div
        variants={staggerItem}
        whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 cursor-default relative group"
      >
        {/* Corps KpiCard réutilisé */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[var(--color-foreground-muted)]">{label}</span>
          <div className="w-9 h-9 rounded-lg bg-carbon-emerald/10 flex items-center justify-center text-carbon-emerald">
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-display font-bold text-[var(--color-foreground)]">
            {value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          </span>
          <span className="text-sm text-[var(--color-foreground-muted)]">{unit}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span
            className={
              change >= 0
                ? "text-[var(--color-danger)]"
                : "text-[var(--color-success)]"
            }
          >
            {change >= 0 ? "+" : ""}
            {change}% vs. 2023
          </span>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors opacity-60 group-hover:opacity-100"
            aria-label={`Voir la provenance de ${label}`}
            data-testid={`provenance-trigger-${factCode}`}
          >
            <Info className="w-3 h-3" aria-hidden />
            <span>Provenance</span>
          </button>
        </div>
      </motion.div>

      <KpiProvenanceDrawer
        open={open}
        onClose={() => setOpen(false)}
        code={factCode}
        label={label}
        unit={unit}
      />
    </>
  );
}
