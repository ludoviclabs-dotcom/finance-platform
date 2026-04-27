import Link from "next/link";
import { FlaskConical, ArrowRight, Clock, Cpu } from "lucide-react";

import demosData from "@/content/sandbox/demos.json";

export const metadata = {
  title: "Sandbox — démos publiques NEURAL",
  description:
    "Démos cliquables sans login : 5 agents Luxe Comms (Voice Guard, Press, Heritage, Claim, Event) + Document Processing. Modèles Claude Sonnet 4.6.",
};

const COLOR_CLS: Record<string, { border: string; gradient: string; text: string }> = {
  violet: {
    border: "border-violet-400/25",
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
    text: "text-violet-200",
  },
  emerald: {
    border: "border-emerald-400/25",
    gradient: "from-emerald-500/[0.10] via-white/[0.04] to-emerald-500/[0.04]",
    text: "text-emerald-300",
  },
  cyan: {
    border: "border-cyan-400/25",
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
    text: "text-cyan-200",
  },
};

export default function SandboxPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <FlaskConical className="h-3.5 w-3.5" />
            Sandbox
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Démos cliquables sans login
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            5 agents Luxe Comms en runtime public + 1 démo Document Processing avec données
            pré-extraites. Aucune inscription, aucun email demandé. Les démos live appellent
            réellement Claude Sonnet 4.6 via Vercel AI Gateway avec rate-limiting par IP.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {demosData.demos.map((demo) => {
              const cls = COLOR_CLS[demo.color] || COLOR_CLS["violet"];
              const targetHref =
                demo.id === "idp-demo"
                  ? "/sandbox/idp"
                  : demo.agentSlug
                  ? `/agents/${demo.agentSlug}`
                  : "#";
              return (
                <Link
                  key={demo.id}
                  href={targetHref}
                  className={`group flex flex-col gap-3 rounded-[24px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                    >
                      {demo.category}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                        demo.status === "live"
                          ? "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300"
                          : "border-amber-400/25 bg-amber-400/[0.10] text-amber-200"
                      }`}
                    >
                      {demo.status === "live" ? "Live" : "Demo mock"}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight text-white">
                      {demo.label}
                    </h2>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
                      {demo.agent}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/65">{demo.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/8 pt-3 text-[11px] uppercase tracking-[0.16em] text-white/40">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {demo.duration}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="h-3 w-3" />
                      {demo.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                    <span>Lancer la démo</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Posture des sandbox
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200">
                  Aucune donnée stockée
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Les inputs ne sont pas persistés. Rate-limit par IP pour éviter l&apos;abus.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                  Modèles réels
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  5 démos appellent Claude Sonnet 4.6 via Vercel AI Gateway. La 6e (IDP) utilise
                  des données pré-extraites pour démontrer le format de sortie.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                  Zéro engagement
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Pas d&apos;email, pas de form gating. Si vous voulez creuser un cas, le contact
                  est explicite côté CTA.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
