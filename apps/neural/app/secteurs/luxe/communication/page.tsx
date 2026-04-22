import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  Globe,
  Layers,
  Leaf,
  Landmark,
  Newspaper,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import { getBranchEntry } from "@/lib/public-catalog";
import {
  LUXE_COMMS_AGENTS,
  LUXE_COMMS_SUMMARY,
  type LuxeCommsAgentSlug,
} from "@/lib/data/luxe-comms-catalog";

import { BrandVocabShowcase } from "@/components/luxe-comms/BrandVocabShowcase";
import { ClaimStatusTiles } from "@/components/luxe-comms/ClaimStatusTiles";
import { HeritageSourceTree } from "@/components/luxe-comms/HeritageSourceTree";
import { JurisdictionHeatmap } from "@/components/luxe-comms/JurisdictionHeatmap";
import { MediaMatrixGrid } from "@/components/luxe-comms/MediaMatrixGrid";
import { LuxeCommsFlow } from "@/components/luxe-comms/LuxeCommsFlow";

const commsEntryRaw = getBranchEntry("communication");
if (!commsEntryRaw) throw new Error("Missing public catalog entry for communication branch.");
const commsEntry = commsEntryRaw;

export const metadata: Metadata = {
  title: "Luxe / Communication — 5 agents pour scorer, rediger, prouver | NEURAL",
  description:
    "Branche Communication LUXE : MaisonVoiceGuard, LuxePressAgent, LuxeEventComms, HeritageComms, GreenClaimChecker. Charte brand + registre claims EU/FR/UK/US/CH + sources patrimoniales sourcees.",
  openGraph: {
    title: "NEURAL — Luxe / Communication",
    description:
      "5 agents pour contrôler la voix, rédiger la presse, préparer les événements, sourcer l'héritage et bloquer le greenwashing.",
  },
};

// Icones mappees pour les 5 agents
const AGENT_ICON: Record<LuxeCommsAgentSlug, typeof ShieldCheck> = {
  "maison-voice-guard": ShieldCheck,
  "luxe-press-agent": Newspaper,
  "luxe-event-comms": Sparkles,
  "heritage-comms": Landmark,
  "green-claim-checker": Leaf,
};

const GATE_TINT: Record<string, { border: string; bg: string; text: string }> = {
  BRAND: { border: "border-emerald-400/30", bg: "bg-emerald-400/10", text: "text-emerald-200" },
  CLAIM: { border: "border-rose-400/30", bg: "bg-rose-400/10", text: "text-rose-200" },
  HERITAGE: { border: "border-violet-400/30", bg: "bg-violet-400/10", text: "text-violet-200" },
  EVENT: { border: "border-amber-400/30", bg: "bg-amber-400/10", text: "text-amber-200" },
  CRISIS: { border: "border-rose-400/50", bg: "bg-rose-400/15", text: "text-rose-300" },
};

export default function LuxeCommunicationPage() {
  const s = LUXE_COMMS_SUMMARY;

  const heroStats = [
    { label: "Regles de charte", value: String(s.brandRulesCount), hint: `dont ${s.criticalRulesCount} CRITICAL`, Icon: ShieldCheck },
    { label: "Termes normes FR", value: String(s.vocabFrCount), hint: `${s.forbiddenTermsCount} interdits`, Icon: Database },
    { label: "Claims audites", value: String(s.claimsTotal), hint: `EU / FR / UK / US / CH`, Icon: Leaf },
    { label: "Sources patrimoniales", value: String(s.heritageSourcesCount), hint: `${s.primarySourcesCount} primaires`, Icon: Landmark },
    { label: "Medias references", value: String(s.mediaDirectoryCount), hint: `${s.p1MediaCount} priorite 1`, Icon: Newspaper },
    { label: "Juridictions mappees", value: String(s.juridictionsCovered), hint: `${s.jurisdictionsCount} claims-types`, Icon: Globe },
  ];

  const problemSolution = [
    {
      probleme: "Controle absolu du brand voice",
      solution: "MaisonVoiceGuard score chaque sortie sur la charte ; refus automatique si score insuffisant",
      agent: "AG-001",
    },
    {
      probleme: "Relations presse haute couture / joaillerie",
      solution: "LuxePressAgent redige dans le registre luxe ; adapte Vogue/Harper's Bazaar vs. FT/BoF",
      agent: "AG-002",
    },
    {
      probleme: "Evenementiel de prestige",
      solution: "LuxeEventComms genere invitations VIP, scripts, social live pour defiles / lancements / expos",
      agent: "AG-003",
    },
    {
      probleme: "Communication patrimoniale",
      solution: "HeritageComms valorise l'heritage — zero citation sans source active, 4 formats normes",
      agent: "AG-004",
    },
    {
      probleme: "Anti-greenwashing",
      solution: "GreenClaimChecker verifie chaque claim RSE contre la Green Claims Directive + juridictions",
      agent: "AG-005",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/5 px-6 pb-16 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent" />
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <Link
            href="/secteurs/luxe"
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au hub Luxe
          </Link>

          <div className="max-w-4xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
              Branche Communication · Verticale Luxe
            </p>
            <StatusBadge status={commsEntry.status} proofLevel={commsEntry.proofLevel} className="mt-4" />
            <h1 className="mt-6 font-display text-5xl font-extrabold tracking-[-0.05em] md:text-6xl">
              La voix de votre maison, <span className="text-violet-300">scoree</span>, <span className="text-amber-300">sourcee</span>, <span className="text-emerald-300">prouvee</span>.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
              5 agents qui travaillent ensemble sur chaque communication externe. Chaque sortie
              traverse un gate brand, un gate claim (si RSE), un gate heritage (si patrimoine).
              Zero publication sans traçabilite.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {heroStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06]">
                  <item.Icon className="h-4 w-4 text-violet-200" />
                </div>
                <p className="mt-4 font-display text-3xl font-bold tracking-tight">{item.value}</p>
                <p className="mt-1 text-sm text-white/70">{item.label}</p>
                <p className="mt-1 text-xs text-white/45">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ↔ SOLUTION ─────────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            5 problematiques, 5 agents
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
            Une branche qui adresse le pipeline de communication luxe de bout en bout.
          </h2>

          <div className="mt-10 overflow-hidden rounded-[28px] border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/55">
                <tr>
                  <th className="px-6 py-4">Problematique</th>
                  <th className="px-6 py-4">Agent NEURAL</th>
                  <th className="px-6 py-4 text-right">Reference</th>
                </tr>
              </thead>
              <tbody>
                {problemSolution.map((row) => (
                  <tr key={row.agent} className="border-t border-white/5 align-top">
                    <td className="px-6 py-5 font-semibold text-white/85">{row.probleme}</td>
                    <td className="px-6 py-5 text-sm text-white/65">{row.solution}</td>
                    <td className="px-6 py-5 text-right">
                      <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 font-mono text-xs text-violet-200">
                        {row.agent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FLOW DIAGRAM ───────────────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <LuxeCommsFlow />
        </div>
      </section>

      {/* ── 5 AGENTS GRID ──────────────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Les 5 agents
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
            Chaque agent est une surface operable, avec son own runtime.
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {LUXE_COMMS_AGENTS.map((a) => {
              const Icon = AGENT_ICON[a.slug];
              const tint = GATE_TINT[a.primaryGate];
              // Les 4 agents live en Sprint 3-4. AG-003 EventComms n'a pas encore de demo.
              const hasLiveDemo = a.slug !== "luxe-event-comms";
              return (
                <Link
                  key={a.slug}
                  href={`/agents/${a.slug}`}
                  className="group rounded-[24px] border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-violet-400/30 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tint.border} ${tint.bg}`}>
                      <Icon className={`h-5 w-5 ${tint.text}`} />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tint.border} ${tint.bg} ${tint.text}`}>
                        Gate {a.primaryGate}
                      </span>
                      {hasLiveDemo ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                          Demo live
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] font-mono font-semibold text-white/45">{a.id}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-white">{a.name}</h3>
                  <p className="mt-2 text-sm italic text-white/65">{a.tagline}</p>
                  <p className="mt-4 text-sm leading-relaxed text-white/55">{a.mission}</p>
                  <div className="mt-5 space-y-2 border-t border-white/5 pt-4">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-white/40">Input :</span>
                      <span className="text-white/70">{a.inputMain}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-white/40">Output :</span>
                      <span className="text-white/70">{a.outputMain}</span>
                    </div>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-300 group-hover:text-violet-200">
                    Voir la fiche agent
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}

            {/* Slot demos - summary */}
            <div className="flex flex-col justify-between rounded-[24px] border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-6">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  4 demos live disponibles
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-white">
                  Voice Scorer · Claim Checker · Heritage Quote · Press Angle
                </h3>
                <p className="mt-2 text-sm text-white/70">
                  4 agents sur 5 sont testables en live depuis leur fiche agent.
                  AI Gateway (Claude Sonnet) avec fallback deterministique en mode degrade.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href="/agents/maison-voice-guard"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
                >
                  Voice Scorer →
                </Link>
                <Link
                  href="/agents/green-claim-checker"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
                >
                  Claim Checker →
                </Link>
                <Link
                  href="/agents/heritage-comms"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
                >
                  Heritage →
                </Link>
                <Link
                  href="/agents/luxe-press-agent"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
                >
                  Press Angle →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DATA SHOWCASES ─────────────────────────────────────────────────── */}
      <section className="border-b border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px] space-y-12">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
              Preuves runtime
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
              Ce que les agents lisent reellement — sources workbook visibles.
            </h2>
            <p className="mt-3 max-w-3xl text-white/60">
              Toutes les donnees affichees ci-dessous sont extraites en SSR des 7 workbooks runtime
              de la branche (Foundations + Master + 5 agents), synchronises via
              <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">scripts/sync-luxe-comms.ts</code>.
              Pas de stub, pas de placeholder.
            </p>
          </div>

          <ClaimStatusTiles />

          <BrandVocabShowcase />

          <div className="grid gap-6 lg:grid-cols-2">
            <HeritageSourceTree />
            <MediaMatrixGrid max={9} />
          </div>

          <JurisdictionHeatmap />
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1100px] rounded-[32px] border border-white/10 bg-gradient-to-br from-violet-500/15 via-white/[0.02] to-amber-500/10 p-10 md:p-16">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
                Prochaine etape
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
                Audit gratuit de votre comms — sous 15 jours.
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-white/70">
                On branche vos 3 derniers communiques sur AG-001 et AG-005. Vous recevez un rapport
                avec score brand, claims a risque, suggestions de rewrite. Sans engagement.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/55">
                <Layers className="h-3.5 w-3.5 text-violet-200" />
                <span>Ready now : {commsEntry.readyNow}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/contact?subject=luxe-comms-audit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-violet-100"
              >
                Demander l&apos;audit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/forfaits"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40"
              >
                Voir les forfaits
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
