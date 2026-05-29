"use client";

/**
 * SectorImpactDrawer — drawer latéral « Impacts sectoriels ».
 *
 * Angle : les impacts environnementaux réels que le reporting ESG doit rendre
 * mesurables, par thème, avec chiffres SOURCÉS (cf. lib/sector-impacts.ts).
 *
 * Réutilise le PATTERN d'animation/style de KpiProvenanceDrawer (framer-motion,
 * tokens CSS, ESC + backdrop) — sans le coupler (ce dernier est spécifique aux KPI).
 * Aucune dépendance nouvelle : framer-motion + lucide-react déjà présents, viz SVG inline.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ExternalLink, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SECTOR_IMPACTS, type ImpactTheme } from "@/lib/sector-impacts";

interface SectorImpactDrawerProps {
  open: boolean;
  onClose: () => void;
  onEnterApp?: () => void;
  initialThemeId?: ImpactTheme["id"];
}

export function SectorImpactDrawer({
  open,
  onClose,
  onEnterApp,
  initialThemeId,
}: SectorImpactDrawerProps) {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState<ImpactTheme["id"]>(
    initialThemeId ?? SECTOR_IMPACTS[0].id,
  );

  // Re-synchronise l'onglet si on rouvre le drawer sur un thème précis.
  useEffect(() => {
    if (open && initialThemeId) setActiveId(initialThemeId);
  }, [open, initialThemeId]);

  // ESC pour fermer (parité avec KpiProvenanceDrawer).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const theme = SECTOR_IMPACTS.find((t) => t.id === activeId) ?? SECTOR_IMPACTS[0];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            data-testid="impacts-backdrop"
          />
          {/* Drawer */}
          <motion.aside
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", damping: 28, stiffness: 320 }
            }
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="impacts-drawer-title"
            data-testid="impacts-drawer"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-3 p-5 border-b border-[var(--color-border)]">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-foreground-subtle)]">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                  Impacts sectoriels
                </div>
                <h2
                  id="impacts-drawer-title"
                  className="mt-1 text-lg font-display font-semibold text-[var(--color-foreground)]"
                >
                  Ce que le reporting doit rendre mesurable
                </h2>
                <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
                  Chiffres publics sourcés — la donnée avant l&apos;outil.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-md text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors"
                aria-label="Fermer le panneau impacts sectoriels"
                data-testid="impacts-close"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Onglets thèmes */}
            <div
              role="tablist"
              aria-label="Thèmes d'impact environnemental"
              className="flex gap-1 px-3 py-2.5 border-b border-[var(--color-border)] overflow-x-auto"
            >
              {SECTOR_IMPACTS.map((t) => {
                const active = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveId(t.id)}
                    className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                    style={{
                      color: active ? "#fff" : "var(--color-foreground-muted)",
                      background: active ? t.accent : "var(--color-surface-raised)",
                    }}
                  >
                    <span aria-hidden>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Corps */}
            <div key={theme.id} className="flex-1 overflow-y-auto p-5">
              <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed">
                {theme.intro}
              </p>

              {/* Mini-viz SVG sobre */}
              <ThemeViz theme={theme} />

              {/* Métriques sourcées */}
              <ul className="mt-5 flex flex-col gap-3">
                {theme.metrics.map((m) => (
                  <li
                    key={m.label}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        className="text-2xl font-display font-bold tracking-tight tabular-nums"
                        style={{ color: theme.accent }}
                      >
                        {m.value}
                      </span>
                      <TagBadge tag={m.tag} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-foreground)] leading-snug">
                      {m.label}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-foreground-muted)] leading-relaxed">
                      {m.carbonLink}
                    </p>
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden />
                      <span>
                        {m.source} · {m.year}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>

              {/* Lien ESRS — relie au moteur produit */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-foreground-subtle)]">
                <span>Standards ESRS concernés :</span>
                {theme.esrsRefs.map((ref) => (
                  <span
                    key={ref}
                    className="inline-flex items-center font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: `color-mix(in oklab, ${theme.accent} 12%, transparent)`,
                      color: theme.accent,
                    }}
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>

            {/* Pied : angle Carbon&Co + CTA */}
            <footer className="border-t border-[var(--color-border)] p-5">
              <p className="text-sm text-[var(--color-foreground)] leading-relaxed">
                {theme.carbonAngle}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onEnterApp?.();
                }}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-transform hover:scale-[1.02]"
                style={{ background: "var(--carbon-emerald)" }}
              >
                Voir comment Carbon&amp;Co rend ça mesurable
                <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: ImpactTheme["metrics"][number]["tag"] }) {
  const real = tag === "réel";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        background: real ? "var(--color-success-bg)" : "var(--color-surface-raised)",
        color: real ? "var(--color-success)" : "var(--color-foreground-muted)",
      }}
    >
      {real ? "Source officielle" : "Illustratif"}
    </span>
  );
}

/**
 * Viz sobre : 2 barres de proportion par thème, adossées à une vraie donnée
 * (pas de chart décoratif trompeur). Style aligné sur sector-mockups.
 */
function ThemeViz({ theme }: { theme: ImpactTheme }) {
  const viz = VIZ[theme.id];
  return (
    <figure className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
      <figcaption className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-foreground-subtle)] mb-3">
        {viz.caption}
      </figcaption>
      <div className="flex flex-col gap-2.5">
        {viz.bars.map((b) => (
          <div key={b.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="text-[var(--color-foreground)] truncate">{b.label}</span>
              <b className="font-bold tabular-nums" style={{ color: theme.accent }}>
                {b.value}
              </b>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${b.pct}%`,
                  background: b.highlight
                    ? theme.accent
                    : `color-mix(in oklab, ${theme.accent} 28%, transparent)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

interface VizBar {
  label: string;
  value: string;
  pct: number;
  highlight?: boolean;
}
const VIZ: Record<ImpactTheme["id"], { caption: string; bars: VizBar[] }> = {
  industrie: {
    caption: "Où se situe l'empreinte d'un industriel (moyenne CDP)",
    bars: [
      { label: "Scope 1 & 2 (opérations)", value: "≈ 25 %", pct: 25 },
      { label: "Scope 3 (chaîne de valeur)", value: "≈ 75 %", pct: 75, highlight: true },
    ],
  },
  "eau-pollution": {
    caption: "Prélèvements d'eau douce en France (2023)",
    bars: [
      { label: "Refroidissement des centrales", value: "45 %", pct: 45, highlight: true },
      { label: "Autres usages (eau potable, industrie, agri.)", value: "55 %", pct: 55 },
    ],
  },
  energie: {
    caption: "Intensité carbone de l'électricité — gCO₂/kWh",
    bars: [
      { label: "France", value: "≈ 32 g", pct: 18, highlight: true },
      { label: "Moyenne UE+", value: "≈ 175 g", pct: 100 },
    ],
  },
  "agri-viti": {
    caption: "Empreinte d'une bouteille de vin (75 cl)",
    bars: [
      { label: "Emballage (verre)", value: "≈ 46 %", pct: 46, highlight: true },
      { label: "Vigne, vinification, transport", value: "≈ 54 %", pct: 54 },
    ],
  },
};
