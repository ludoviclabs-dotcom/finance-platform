"use client";

import { useSimulateurStore } from "@/lib/store/simulateur-store";
import {
  Wallet,
  BarChart3,
  Banknote,
  Umbrella,
  Shield,
  PiggyBank,
  Home,
  Scale,
  Gift,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function fmtEur(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M\u20AC`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} K\u20AC`;
  return `${Math.round(v)} \u20AC`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)} %`;
}

/* ── card component ──────────────────────────────────────────────────────── */

interface KPICardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  color: string;
  subs: Array<{ label: string; value: string }>;
}

function KPICard({ icon: Icon, title, value, color, subs }: KPICardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 hover:border-[var(--color-border-hover,#555)] transition-colors">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          {title}
        </span>
      </div>
      <div className="text-2xl font-semibold tabnum text-foreground">{value}</div>
      <div className="flex flex-col gap-1">
        {subs.map((s) => (
          <div key={s.label} className="flex justify-between text-xs text-foreground-muted">
            <span>{s.label}</span>
            <span className="tabnum font-medium text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── main grid ───────────────────────────────────────────────────────────── */

export function KPICards() {
  const { resultats, calculsDone, client } = useSimulateurStore();

  if (!calculsDone || !resultats.cotisations || !resultats.fiscalite) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 h-36 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const c = resultats.cotisations;
  const f = resultats.fiscalite;
  const ifi = resultats.ifi;
  const ret = resultats.retraite;
  const prev = resultats.prevoyance;
  const per = resultats.per;
  const pat = client.patrimoine;
  const rem = resultats.remuneration;
  const proj = resultats.projection;

  const cards: KPICardProps[] = [
    {
      icon: Wallet,
      title: "Revenus & Cotisations",
      value: fmtEur(client.activite.bncN),
      color: "bg-emerald-500/15 text-emerald-400",
      subs: [
        { label: "Cotisations", value: fmtEur(c.totalCotisations) },
        { label: "Taux effectif", value: fmtPct(c.tauxEffectif) },
        { label: "Net mensuel", value: fmtEur(c.bncNetMensuel) },
      ],
    },
    {
      icon: BarChart3,
      title: "Fiscalit\u00e9 IR",
      value: fmtEur(f.irNet),
      color: "bg-blue-500/15 text-blue-400",
      subs: [
        { label: "TMI", value: fmtPct(f.tmi) },
        { label: "Taux moyen", value: fmtPct(f.tauxMoyen) },
        { label: "CEHR", value: fmtEur(f.cehr) },
      ],
    },
    {
      icon: Banknote,
      title: "Revenu Net Disponible",
      value: fmtEur((client.activite.bncN - c.totalCotisations - f.totalImpot) / 12),
      color: "bg-green-500/15 text-green-400",
      subs: [
        { label: "Annuel", value: fmtEur(client.activite.bncN - c.totalCotisations - f.totalImpot) },
        { label: "Pr\u00e9l\u00e8vement global", value: fmtPct((c.totalCotisations + f.totalImpot) / client.activite.bncN) },
      ],
    },
    {
      icon: Umbrella,
      title: "Retraite",
      value: ret ? fmtEur(ret.pensionMensuelle) + "/mois" : "—",
      color: "bg-amber-500/15 text-amber-400",
      subs: [
        { label: "Taux remplacement", value: ret ? fmtPct(ret.tauxRemplacement) : "—" },
        { label: "Gap vs objectif", value: ret ? fmtEur(ret.gapVsObjectif) : "—" },
        { label: "Trim. manquants", value: ret ? `${ret.trimestresManquants}` : "—" },
      ],
    },
    {
      icon: Shield,
      title: "Pr\u00e9voyance",
      value: prev ? fmtEur(prev.gapIJ.periode1.gap) + "/j" : "—",
      color: "bg-red-500/15 text-red-400",
      subs: [
        { label: "Gap capital d\u00e9c\u00e8s", value: prev ? fmtEur(prev.gapCapitalDeces) : "—" },
        { label: "IJ recommand\u00e9e", value: prev ? fmtEur(prev.ijComplementaireRecommandee) + "/j" : "—" },
      ],
    },
    {
      icon: PiggyBank,
      title: "PER",
      value: per ? fmtEur(per.plafondDisponible) : "—",
      color: "bg-purple-500/15 text-purple-400",
      subs: [
        { label: "\u00c9conomie IR", value: per ? fmtEur(per.economieFiscale) : "—" },
        { label: "Capital projet\u00e9", value: per ? fmtEur(per.projectionCapital.central) : "—" },
      ],
    },
    {
      icon: Home,
      title: "Patrimoine",
      value: fmtEur(pat.patrimoineNet),
      color: "bg-cyan-500/15 text-cyan-400",
      subs: [
        { label: "Actifs", value: fmtEur(pat.totalActifs) },
        { label: "Passifs", value: fmtEur(pat.totalPassifs) },
        { label: "IFI d\u00fb", value: ifi ? fmtEur(ifi.ifiNet) : "0 \u20AC" },
      ],
    },
    {
      icon: Scale,
      title: "Arbitrage R\u00e9mu/Div",
      value: rem?.scenarios?.[4] ? fmtEur(rem.scenarios[4].netDisponible) : "N/A",
      color: "bg-orange-500/15 text-orange-400",
      subs: rem?.scenarios?.[4]
        ? [
            { label: "Taux global", value: fmtPct(rem.scenarios[4].tauxGlobal) },
            { label: "Points retraite", value: `${rem.scenarios[4].pointsRetraiteEstimes}` },
          ]
        : [{ label: "Statut", value: "Non SELARL" }],
    },
    {
      icon: Gift,
      title: "Transmission",
      value: fmtEur(pat.patrimoineNet),
      color: "bg-pink-500/15 text-pink-400",
      subs: [
        { label: "Valeur transmissible", value: fmtEur(pat.patrimoineNet * 0.75) },
      ],
    },
    {
      icon: TrendingUp,
      title: "Projection 30 ans",
      value: proj?.synthese5ans?.length ? fmtEur(proj.synthese5ans[proj.synthese5ans.length - 1].central) : "—",
      color: "bg-indigo-500/15 text-indigo-400",
      subs: proj?.synthese5ans?.length
        ? [
            { label: "Pessimiste", value: fmtEur(proj.synthese5ans[proj.synthese5ans.length - 1].pessimiste) },
            { label: "Optimiste", value: fmtEur(proj.synthese5ans[proj.synthese5ans.length - 1].optimiste) },
          ]
        : [],
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card) => (
        <KPICard key={card.title} {...card} />
      ))}
    </div>
  );
}
