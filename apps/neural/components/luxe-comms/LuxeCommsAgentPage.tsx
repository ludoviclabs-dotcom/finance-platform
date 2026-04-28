/**
 * LuxeCommsAgentPage — Server Component template partage par les 5 pages agents
 * de la branche Luxe / Communication.
 *
 * Chaque page passe :
 *  - son slug agent (tire de LUXE_COMMS_AGENTS)
 *  - un enfant optionnel pour contenu specifique (showcase data propre a l'agent)
 *
 * Tout le reste (hero, metadata d'agent, CTA) est derive de luxe-comms-catalog.
 */
import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, FileCheck2, Landmark, Leaf, Newspaper, ShieldCheck, Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import { AgentSafetyModelCard } from "@/components/trust/agent-safety-model-card";
import { getAgentSafetyProfile } from "@/lib/data/agent-safety";
import { getAgentEntry, getBranchEntry } from "@/lib/public-catalog";
import {
  LUXE_COMMS_AGENTS,
  type LuxeCommsAgentSlug,
} from "@/lib/data/luxe-comms-catalog";

const AGENT_ICON: Record<LuxeCommsAgentSlug, typeof ShieldCheck> = {
  "maison-voice-guard": ShieldCheck,
  "luxe-press-agent": Newspaper,
  "luxe-event-comms": Sparkles,
  "heritage-comms": Landmark,
  "green-claim-checker": Leaf,
};

const GATE_TINT: Record<string, { border: string; bg: string; text: string; from: string; to: string }> = {
  BRAND: { border: "border-emerald-400/30", bg: "bg-emerald-400/10", text: "text-emerald-200", from: "from-emerald-500/15", to: "to-emerald-500/5" },
  CLAIM: { border: "border-rose-400/30", bg: "bg-rose-400/10", text: "text-rose-200", from: "from-rose-500/15", to: "to-rose-500/5" },
  HERITAGE: { border: "border-violet-400/30", bg: "bg-violet-400/10", text: "text-violet-200", from: "from-violet-500/15", to: "to-violet-500/5" },
  EVENT: { border: "border-amber-400/30", bg: "bg-amber-400/10", text: "text-amber-200", from: "from-amber-500/15", to: "to-amber-500/5" },
};

export function LuxeCommsAgentPage({
  slug,
  children,
  hideDemoPlaceholder = false,
}: {
  slug: LuxeCommsAgentSlug;
  children?: React.ReactNode;
  /** Masquer le slot "démo Sprint 3 à venir" (ex : page avec démo déjà live). */
  hideDemoPlaceholder?: boolean;
}) {
  const agent = LUXE_COMMS_AGENTS.find((a) => a.slug === slug);
  if (!agent) throw new Error(`Unknown luxe-comms agent: ${slug}`);
  const publicEntry = getAgentEntry(slug);
  if (!publicEntry) throw new Error(`Missing public catalog entry for agent: ${slug}`);

  const commsEntry = getBranchEntry("communication");
  if (!commsEntry) throw new Error("Missing communication branch entry.");

  const Icon = AGENT_ICON[slug];
  const tint = GATE_TINT[agent.primaryGate];
  const safetyProfile = getAgentSafetyProfile(slug);

  // Autres agents de la branche, pour cross-link
  const siblings = LUXE_COMMS_AGENTS.filter((a) => a.slug !== slug);

  return (
    <div className="min-h-screen bg-[#0A1628] text-white">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5 px-6 pb-16 pt-32 md:px-12">
        <div className={`absolute inset-0 bg-gradient-to-b ${tint.from} via-transparent to-transparent`} />
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-500/15 blur-[120px]" />

        <div className="relative mx-auto max-w-[1280px]">
          <Link
            href="/secteurs/luxe/communication"
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a la branche Communication
          </Link>

          <div className="flex flex-wrap items-start gap-6">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border ${tint.border} ${tint.bg}`}>
              <Icon className={`h-7 w-7 ${tint.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-white/50">{agent.id}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tint.border} ${tint.bg} ${tint.text}`}>
                  Gate {agent.primaryGate}
                </span>
                <StatusBadge status={publicEntry.status} proofLevel={publicEntry.proofLevel} />
              </div>
              <h1 className="mt-3 font-display text-5xl font-extrabold tracking-[-0.04em] md:text-6xl">
                {agent.name}
              </h1>
              <p className="mt-4 max-w-3xl text-lg italic text-white/70">{agent.tagline}</p>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/60">{agent.mission}</p>
            </div>
          </div>
        </div>
      </section>

      {/* I/O + EVIDENCE */}
      <section className="border-b border-white/5 px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1280px] grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
              <Database className="h-4 w-4" />
              Input principal
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{agent.inputMain}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
              <FileCheck2 className="h-4 w-4" />
              Output produit
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{agent.outputMain}</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-200">
              <ShieldCheck className="h-4 w-4" />
              Niveau de preuve
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              {publicEntry.readyNow}
            </p>
          </div>
        </div>
      </section>

      {safetyProfile ? (
        <section className="border-b border-white/5 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1280px]">
            <AgentSafetyModelCard profile={safetyProfile} compact />
          </div>
        </section>
      ) : null}

      {/* SCOPE ≠ PROMISE */}
      <section className="border-b border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Scope vs. promesse
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Ce que l&apos;agent fait deja vs. ce qui arrive.
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                Deja operable
              </p>
              <ul className="mt-4 space-y-2">
                {publicEntry.scopeNow.map((s: string) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-white/75">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/[0.04] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
                Prochaines etapes
              </p>
              <ul className="mt-4 space-y-2">
                {publicEntry.notYet.map((s: string) => (
                  <li key={s} className="flex items-start gap-2 text-sm text-white/75">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENU SPECIFIQUE AGENT (injecte par chaque page) */}
      {children ? (
        <section className="border-b border-white/5 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </section>
      ) : null}

      {/* DEMO CTA (placeholder Sprint 3) — masque si la page expose deja une demo live */}
      {hideDemoPlaceholder ? null : (
        <section className="border-b border-white/5 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1280px]">
            <div className="rounded-[28px] border border-dashed border-violet-400/30 bg-violet-400/[0.04] p-8 md:p-12">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                    Demo Sprint 3
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold tracking-tight md:text-3xl">
                    Demo interactive en arrivee
                  </h3>
                  <p className="mt-2 text-white/65">
                    L&apos;endpoint <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-violet-200">{agent.demoEndpoint}</code> exposera
                    cet agent live (AI Gateway + Claude Sonnet) avec rate-limit Upstash et observabilite Langfuse.
                  </p>
                </div>
                <Link
                  href="/contact?subject=demo-luxe-comms"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-violet-100"
                >
                  Acces anticipe
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* AUTRES AGENTS */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            Les 4 autres agents de la branche
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Pipeline complet — chaque agent a un role dedie.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {siblings.map((s) => {
              const SIcon = AGENT_ICON[s.slug];
              const stint = GATE_TINT[s.primaryGate];
              return (
                <Link
                  key={s.slug}
                  href={`/agents/${s.slug}`}
                  className="group rounded-[20px] border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-violet-400/30 hover:bg-white/[0.05]"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${stint.border} ${stint.bg}`}>
                    <SIcon className={`h-4 w-4 ${stint.text}`} />
                  </div>
                  <p className="mt-3 font-mono text-[10px] text-white/45">{s.id}</p>
                  <p className="mt-0.5 font-display text-base font-bold text-white">{s.name}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-white/55">{s.tagline}</p>
                </Link>
              );
            })}
          </div>
          <div className="mt-8">
            <Link
              href="/secteurs/luxe/communication"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 hover:text-violet-200"
            >
              Voir la branche entiere
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
