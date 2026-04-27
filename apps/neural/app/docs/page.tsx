import Link from "next/link";
import { BookOpen, ArrowRight, Clock } from "lucide-react";

import gettingStarted from "@/content/docs/getting-started.json";
import agentsArch from "@/content/docs/agents-architecture.json";
import mcp from "@/content/docs/mcp-protocol.json";
import auditTrail from "@/content/docs/audit-trail.json";

export const metadata = {
  title: "Documentation — NEURAL",
  description:
    "Documentation produit NEURAL : démarrage, architecture des agents, protocole MCP, audit trail signé. Pour CIO, CTO, DPO, RSSI.",
};

const DOCS = [
  { data: gettingStarted, accent: "violet" },
  { data: agentsArch, accent: "cyan" },
  { data: mcp, accent: "emerald" },
  { data: auditTrail, accent: "amber" },
];

const ACCENT_CLS: Record<string, { border: string; text: string; gradient: string }> = {
  violet: {
    border: "border-violet-400/25",
    text: "text-violet-200",
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
  },
  cyan: {
    border: "border-cyan-400/25",
    text: "text-cyan-200",
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
  },
  emerald: {
    border: "border-emerald-400/25",
    text: "text-emerald-200",
    gradient: "from-emerald-500/[0.10] via-white/[0.04] to-emerald-500/[0.04]",
  },
  amber: {
    border: "border-amber-400/25",
    text: "text-amber-200",
    gradient: "from-amber-500/[0.10] via-white/[0.04] to-amber-500/[0.04]",
  },
};

export default function DocsIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <BookOpen className="h-3.5 w-3.5" />
            Documentation
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Documentation produit
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Quatre documents fondamentaux pour comprendre comment NEURAL est structuré, opéré
            et gouverné. Pour CIO, CTO, DPO, RSSI et auditeurs externes.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 md:grid-cols-2">
            {DOCS.map(({ data, accent }) => {
              const cls = ACCENT_CLS[accent];
              return (
                <Link
                  key={data.slug}
                  href={`/docs/${data.slug}`}
                  className={`group flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                    >
                      {data.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                      <Clock className="h-3 w-3" />
                      {data.readTime}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                      {data.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">{data.subtitle}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                    <span>Lire la doc</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
