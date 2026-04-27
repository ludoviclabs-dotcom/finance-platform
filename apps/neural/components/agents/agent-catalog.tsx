"use client";

import { useMemo, useState } from "react";

import { AgentCard, type EnrichedAgent } from "./agent-card";

interface AgentCatalogProps {
  agents: EnrichedAgent[];
}

const BRANCH_OPTIONS = [
  { id: "finance", label: "Finance" },
  { id: "rh", label: "RH" },
  { id: "communication", label: "Communication" },
  { id: "supply-chain", label: "Supply Chain" },
  { id: "marketing", label: "Marketing" },
  { id: "comptabilite", label: "Comptabilité" },
];

const SECTOR_OPTIONS = [
  { id: "luxe", label: "Luxe" },
  { id: "transport", label: "Transport" },
  { id: "aero", label: "Aéronautique" },
  { id: "banque", label: "Banque" },
  { id: "assurance", label: "Assurance" },
  { id: "saas", label: "SaaS" },
];

const STATUS_OPTIONS = [
  { id: "live", label: "Live" },
  { id: "demo", label: "Demo" },
  { id: "planned", label: "Planifié" },
];

const RISK_OPTIONS = [
  { id: "haut-risque", label: "Haut-risque" },
  { id: "limite", label: "Limité" },
  { id: "minimal", label: "Minimal" },
];

export function AgentCatalog({ agents }: AgentCatalogProps) {
  const [branch, setBranch] = useState<string | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [risk, setRisk] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (branch && a.meta.branch !== branch) return false;
      if (sector && !a.meta.sectors.includes(sector)) return false;
      if (status && a.status !== status) return false;
      if (risk && a.meta.aiActRisk !== risk) return false;
      return true;
    });
  }, [agents, branch, sector, status, risk]);

  const totalLive = agents.filter((a) => a.status === "live").length;
  const totalDemo = agents.filter((a) => a.status === "demo").length;
  const totalPlanned = agents.filter((a) => a.status === "planned").length;

  const hasActiveFilter = Boolean(branch || sector || status || risk);

  return (
    <div>
      {/* Stats banner */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Catalogue</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">{agents.length}</p>
          <p className="mt-1 text-xs text-white/55">agents documentés</p>
        </div>
        <div className="rounded-[20px] border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">Live</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-emerald-200">
            {totalLive}
          </p>
          <p className="mt-1 text-xs text-white/55">avec données réelles</p>
        </div>
        <div className="rounded-[20px] border border-violet-400/25 bg-violet-400/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">Demo</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-violet-100">
            {totalDemo}
          </p>
          <p className="mt-1 text-xs text-white/55">démonstration UI</p>
        </div>
        <div className="rounded-[20px] border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">Planifiés</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-amber-200">
            {totalPlanned}
          </p>
          <p className="mt-1 text-xs text-white/55">en préparation</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-10 space-y-4">
        <FilterRow
          label="Branche"
          options={BRANCH_OPTIONS}
          value={branch}
          onChange={setBranch}
        />
        <FilterRow
          label="Secteur"
          options={SECTOR_OPTIONS}
          value={sector}
          onChange={setSector}
        />
        <FilterRow
          label="Statut"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
        />
        <FilterRow
          label="Risque AI Act"
          options={RISK_OPTIONS}
          value={risk}
          onChange={setRisk}
        />
      </div>

      {/* Active filter summary + reset */}
      {hasActiveFilter && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3">
          <p className="text-xs text-white/70">
            <span className="font-semibold text-violet-200">{filtered.length}</span> agent
            {filtered.length > 1 ? "s" : ""} correspondant{filtered.length > 1 ? "s" : ""} aux
            filtres
          </p>
          <button
            type="button"
            onClick={() => {
              setBranch(null);
              setSector(null);
              setStatus(null);
              setRisk(null);
            }}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200 hover:text-white"
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-white/55">
              Aucun agent ne correspond aux filtres sélectionnés.
            </p>
          </div>
        ) : (
          filtered.map((agent) => <AgentCard key={agent.slug} agent={agent} />)
        )}
      </div>
    </div>
  );
}

function FilterRow<T extends { id: string; label: string }>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: T[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-32 flex-shrink-0 text-[11px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
          value === null
            ? "border-white/30 bg-white/[0.10] text-white"
            : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
        }`}
      >
        Tout
      </button>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(value === opt.id ? null : opt.id)}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
            value === opt.id
              ? "border-violet-400/50 bg-violet-400/[0.16] text-violet-100"
              : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
