"use client";

import { useMemo } from "react";
import {
  Banknote,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Flame,
  Leaf,
  BarChart3,
  Globe,
  Trophy,
  ThumbsDown,
} from "lucide-react";
import { useFinanceSnapshot } from "@/lib/hooks/use-finance-snapshot";
import type { BenchmarkIndicateur } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    if (isFinite(n)) return n;
  }
  return null;
}

function fmt(v: unknown, unit = "", decimals = 1): string {
  const n = toNum(v);
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit ? "\u202f" + unit : ""}`;
}

function fmtEur(v: unknown): string {
  const n = toNum(v);
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M€`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} k€`;
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral" | null;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}/15`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        {trend && (
          <TrendIcon
            className={`w-4 h-4 ${
              trend === "up"
                ? "text-[var(--color-success)]"
                : trend === "down"
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-foreground-muted)]"
            }`}
          />
        )}
      </div>
      <p className="font-display text-2xl font-extrabold text-[var(--color-foreground)]">{value}</p>
      <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-0.5">{sub}</p>}
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" | "neutral" }) {
  const cls =
    highlight === "good"
      ? "text-[var(--color-success)] font-semibold"
      : highlight === "bad"
        ? "text-[var(--color-danger)] font-semibold"
        : "text-[var(--color-foreground)] font-semibold";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-foreground-muted)]">{label}</span>
      <span className={`text-sm ${cls}`}>{value}</span>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function PositionBadge({ position }: { position: string | null | undefined }) {
  if (!position || position === "N/A") {
    return <span className="text-xs text-[var(--color-foreground-muted)]">—</span>;
  }
  const map: Record<string, string> = {
    Leader: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
    Bon: "bg-cyan-50 text-cyan-600",
    Moyen: "bg-amber-50 text-amber-600",
    "À améliorer": "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
  };
  const cls = map[position] ?? "bg-[var(--color-border)] text-[var(--color-foreground-muted)]";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {position === "Leader" && <Trophy className="w-2.5 h-2.5" />}
      {position === "À améliorer" && <ThumbsDown className="w-2.5 h-2.5" />}
      {position}
    </span>
  );
}

// PAI indicator labels
const PAI_LABELS: Record<string, string> = {
  pai1_totalGes: "PAI 1 — GES totaux",
  pai2_empreinteCarbone: "PAI 2 — Empreinte carbone",
  pai3_intensiteGes: "PAI 3 — Intensité GES",
  pai4_combustiblesFossilesPct: "PAI 4 — Combustibles fossiles (%)",
  pai5_partEnrNonRenouvelablePct: "PAI 5 — ENR non renouvelable (%)",
  pai6_intensiteEnergie: "PAI 6 — Intensité énergie",
  pai7_biodiversite: "PAI 7 — Biodiversité",
  pai8_rejetsEau: "PAI 8 — Rejets eau",
  pai9_dechetsDangPct: "PAI 9 — Déchets dangereux (%)",
  pai10_violationsUngc: "PAI 10 — Violations UNGC",
  pai11_absenceConformiteUngc: "PAI 11 — Non-conformité UNGC",
  pai12_ecartSalaireHf: "PAI 12 — Écart salarial H/F",
  pai13_diversiteGenreGouv: "PAI 13 — Diversité genre gouvernance",
  pai14_armesControversees: "PAI 14 — Armes controversées",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinancePage() {
  const snap = useFinanceSnapshot();

  const climat = useMemo(() => (snap.status === "ready" ? snap.data.financeClimat : null), [snap]);
  const sfdr = useMemo(() => (snap.status === "ready" ? snap.data.sfdrPai : null), [snap]);
  const benchmark = useMemo(() => (snap.status === "ready" ? snap.data.benchmark : null), [snap]);

  const prixEts = toNum(climat?.prixEts);
  const exposition = toNum(climat?.expositionTotaleEur);
  const greenCapex = toNum(climat?.greenCapexPct);

  if (snap.status === "loading") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-foreground-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
          <span className="text-sm">Chargement des indicateurs Finance…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <Banknote className="w-6 h-6 text-carbon-emerald" />
          Finance Climat & SFDR
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Exposition carbone, indicateurs PAI SFDR, benchmark sectoriel.
        </p>
      </div>

      {/* Error */}
      {snap.status === "error" && (
        <div className="rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <span className="text-xs text-[var(--color-danger)]">{snap.error}</span>
        </div>
      )}

      {/* Warnings */}
      {snap.status === "ready" && snap.data.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              {snap.data.warnings.length} avertissement{snap.data.warnings.length > 1 ? "s" : ""}
            </span>
          </div>
          {snap.data.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-6">{w}</p>
          ))}
        </div>
      )}

      {/* Finance Climat KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Prix ETS carbone"
          value={fmt(climat?.prixEts, "€/tCO₂")}
          icon={Flame}
          color="text-orange-500"
          sub="Marché EU ETS"
        />
        <KpiCard
          label="Exposition carbone totale"
          value={fmtEur(climat?.expositionTotaleEur)}
          icon={AlertTriangle}
          color="text-amber-500"
          trend={exposition !== null ? (exposition <= 100_000 ? "up" : exposition <= 500_000 ? "neutral" : "down") : null}
          sub="Valeur à risque carbone"
        />
        <KpiCard
          label="Green CapEx"
          value={fmt(climat?.greenCapexPct, "%")}
          icon={Leaf}
          color="text-emerald-500"
          trend={greenCapex !== null ? (greenCapex >= 30 ? "up" : greenCapex >= 15 ? "neutral" : "down") : null}
          sub="Part des investissements verts"
        />
        <KpiCard
          label="Score ESG investisseur"
          value={fmt(sfdr?.scoreEsgInvestisseur, "/100", 0)}
          icon={BarChart3}
          color="text-violet-500"
          sub="Notation SFDR agrégée"
        />
      </div>

      {/* Finance Climat detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Finance Climat" icon={Globe} color="text-amber-500">
          <DataRow label="Prix ETS (€/tCO₂e)" value={fmt(climat?.prixEts, "€")} />
          <DataRow label="Exposition totale carbone" value={fmtEur(climat?.expositionTotaleEur)} />
          <DataRow label="CAGR prix carbone estimé" value={fmt(climat?.cagrPrixCarbone, "%")} />
          <DataRow label="CapEx décarb. Scope 1-2" value={fmtEur(climat?.capexDecarbS12Eur)} />
          <DataRow label="CapEx décarb. Scope 3" value={fmtEur(climat?.capexDecarbS3Eur)} />
          <DataRow label="Green CapEx (%)" value={fmt(climat?.greenCapexPct, "%")} />
          <DataRow
            label="Alignement Paris"
            value={typeof climat?.statutAlignementParis === "string" ? climat.statutAlignementParis : "—"}
            highlight={
              typeof climat?.statutAlignementParis === "string"
                ? climat.statutAlignementParis.toLowerCase().includes("aligné")
                  ? "good"
                  : climat.statutAlignementParis.toLowerCase().includes("non")
                    ? "bad"
                    : "neutral"
                : undefined
            }
          />
        </SectionCard>

        {/* SFDR PAI */}
        <SectionCard title="SFDR — Indicateurs PAI (14)" icon={BarChart3} color="text-violet-500">
          {sfdr
            ? Object.entries(PAI_LABELS).map(([key, label]) => (
                <DataRow
                  key={key}
                  label={label}
                  value={fmt((sfdr as unknown as Record<string, unknown>)[key], "")}
                />
              ))
            : <p className="py-4 text-sm text-[var(--color-foreground-muted)]">Données non disponibles</p>}
        </SectionCard>
      </div>

      {/* Benchmark sectoriel */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-carbon-emerald" />
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              Benchmark sectoriel
              {benchmark?.secteurNaf != null && (
                <span className="ml-2 text-xs font-normal text-[var(--color-foreground-muted)]">
                  — NAF {String(benchmark.secteurNaf)}
                </span>
              )}
            </h3>
          </div>
          {benchmark && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-[var(--color-success)]">
                <CheckCircle2 className="w-3 h-3" />
                {benchmark.nbLeader} Leader{benchmark.nbLeader > 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1 text-[var(--color-danger)]">
                <AlertTriangle className="w-3 h-3" />
                {benchmark.nbAAmeliorer} à améliorer
              </span>
            </div>
          )}
        </div>

        {!benchmark || benchmark.indicateurs.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--color-foreground-muted)]">
            Données benchmark non disponibles.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
                    Indicateur
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
                    Votre valeur
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
                    Médiane
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
                    Top 25%
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
                    Écart
                  </th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
                    Position
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {benchmark.indicateurs.map((ind: BenchmarkIndicateur, i: number) => (
                  <tr key={i} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                    <td className="px-5 py-3 text-[var(--color-foreground)]">{ind.label}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
                      {fmt(ind.valeurClient)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-foreground-muted)]">
                      {fmt(ind.medianneSecteur)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-foreground-muted)]">
                      {fmt(ind.top25Pct)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {toNum(ind.ecartPct) !== null ? (
                        <span
                          className={`font-semibold ${
                            (toNum(ind.ecartPct) ?? 0) >= 0
                              ? "text-[var(--color-success)]"
                              : "text-[var(--color-danger)]"
                          }`}
                        >
                          {(toNum(ind.ecartPct) ?? 0) >= 0 ? "+" : ""}
                          {fmt(ind.ecartPct, "%")}
                        </span>
                      ) : (
                        <span className="text-[var(--color-foreground-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <PositionBadge position={ind.position} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
