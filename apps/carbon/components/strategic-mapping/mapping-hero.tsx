"use client";

import { motion } from "framer-motion";
import { TrendingUp, Filter } from "lucide-react";
import { staggerItem } from "@/lib/animations";
import type {
  HeroContent,
  MappingGroundedKpis,
  MappingSegment,
  MappingPersona,
  MappingHorizon,
} from "@/lib/api";

interface Props {
  hero: HeroContent;
  groundedKpis: MappingGroundedKpis | null;
  segment: MappingSegment;
  persona: MappingPersona;
  horizon: MappingHorizon;
  onSegmentChange: (v: MappingSegment) => void;
  onPersonaChange: (v: MappingPersona) => void;
  onHorizonChange: (v: MappingHorizon) => void;
}

const SEGMENTS: { value: MappingSegment; label: string }[] = [
  { value: "generic", label: "Tous" },
  { value: "pme", label: "PME" },
  { value: "eti", label: "ETI" },
  { value: "grand_groupe", label: "Grand groupe" },
];

const PERSONAS: { value: MappingPersona; label: string }[] = [
  { value: "generic", label: "Toutes fonctions" },
  { value: "dg", label: "Direction Générale" },
  { value: "daf", label: "DAF" },
  { value: "investisseur", label: "Investisseur" },
  { value: "donneur_ordre", label: "Donneur d'ordre" },
];

const HORIZONS: { value: MappingHorizon; label: string }[] = [
  { value: "generic", label: "Tous horizons" },
  { value: "court_terme", label: "Court terme" },
  { value: "moyen_terme", label: "Moyen terme" },
  { value: "long_terme", label: "Long terme" },
];

export function MappingHero({
  hero,
  groundedKpis,
  segment,
  persona,
  horizon,
  onSegmentChange,
  onPersonaChange,
  onHorizonChange,
}: Props) {
  return (
    <motion.div variants={staggerItem} className="space-y-6">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-accent)]/5 border border-[var(--color-primary)]/20 p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-[var(--color-primary)]/15 shrink-0">
            <TrendingUp className="w-6 h-6 text-[var(--color-primary)]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--color-foreground)] leading-tight">
              {hero.title}
            </h1>
            <p className="text-base text-[var(--color-foreground-muted)] font-medium">
              {hero.subtitle}
            </p>
            <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed max-w-3xl">
              {hero.summary}
            </p>
          </div>
        </div>

        {/* Grounded KPIs banner — affiché si données disponibles */}
        {groundedKpis?.dataAvailable && (
          <div className="mt-6 pt-5 border-t border-[var(--color-primary)]/15">
            <p className="text-xs text-[var(--color-foreground-muted)] mb-3 font-medium uppercase tracking-wide">
              Vos données — {groundedKpis.companyName ?? "Entreprise"}{groundedKpis.reportingYear ? ` · ${groundedKpis.reportingYear}` : ""}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {groundedKpis.totalS123Tco2e != null && (
                <GroundedKpiChip
                  label="Émissions S1+S2+S3"
                  value={`${groundedKpis.totalS123Tco2e.toLocaleString("fr-FR")} tCO₂e`}
                />
              )}
              {groundedKpis.esgScoreGlobal != null && (
                <GroundedKpiChip
                  label="Score ESG global"
                  value={`${groundedKpis.esgScoreGlobal.toFixed(0)} / 100`}
                />
              )}
              {groundedKpis.vsmeCompletion != null && (
                <GroundedKpiChip
                  label="Complétude VSME"
                  value={`${groundedKpis.vsmeCompletion.toFixed(0)} %`}
                />
              )}
              {groundedKpis.greenCapexPct != null && (
                <GroundedKpiChip
                  label="Green CapEx"
                  value={`${groundedKpis.greenCapexPct.toFixed(1)} %`}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)] font-medium">
          <Filter className="w-3.5 h-3.5" />
          Filtrer par
        </div>

        <FilterSelect
          label="Segment"
          value={segment}
          options={SEGMENTS}
          onChange={(v) => onSegmentChange(v as MappingSegment)}
        />
        <FilterSelect
          label="Fonction"
          value={persona}
          options={PERSONAS}
          onChange={(v) => onPersonaChange(v as MappingPersona)}
        />
        <FilterSelect
          label="Horizon"
          value={horizon}
          options={HORIZONS}
          onChange={(v) => onHorizonChange(v as MappingHorizon)}
        />
      </div>
    </motion.div>
  );
}

function GroundedKpiChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-primary)]/8 px-3 py-2">
      <p className="text-[10px] text-[var(--color-foreground-muted)] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-primary)] mt-0.5">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-[var(--color-foreground-muted)]">{label} :</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-medium bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
