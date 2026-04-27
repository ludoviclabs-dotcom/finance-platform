import Link from "next/link";
import { Code2, ArrowRight, Webhook, Boxes, Sparkles } from "lucide-react";

export const metadata = {
  title: "Developer surface — NEURAL",
  description:
    "Ressources techniques NEURAL : webhooks reference, Embed SDK, MCP Gateway. Pour intégrer NEURAL dans votre produit ou workflow technique.",
};

const RESOURCES = [
  {
    href: "/dev/webhooks",
    title: "Webhooks",
    description: "4 types d'événements émis par l'Operator Gateway · payloads JSON + cURL · signature HMAC-SHA256",
    Icon: Webhook,
    accent: "violet",
    status: "live",
  },
  {
    href: "/dev/embed",
    title: "Embed SDK",
    description: "Embarquez un agent NEURAL dans votre SaaS · TypeScript/React + Vanilla · iframe sandbox sécurisée",
    Icon: Boxes,
    accent: "cyan",
    status: "roadmap",
  },
  {
    href: "/operator-gateway",
    title: "Operator Gateway",
    description: "MCP servers + audit trail signé + policies + cost dashboard · démo mock visible aujourd'hui",
    Icon: Sparkles,
    accent: "emerald",
    status: "demo",
  },
];

const ACCENT_CLS: Record<string, { border: string; bg: string; text: string; gradient: string }> = {
  violet: {
    border: "border-violet-400/25",
    bg: "bg-violet-400/[0.08]",
    text: "text-violet-200",
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
  },
  cyan: {
    border: "border-cyan-400/25",
    bg: "bg-cyan-400/[0.08]",
    text: "text-cyan-200",
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
  },
  emerald: {
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.08]",
    text: "text-emerald-200",
    gradient: "from-emerald-500/[0.10] via-white/[0.04] to-emerald-500/[0.04]",
  },
};

const STATUS_CLS: Record<string, string> = {
  live: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  demo: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  roadmap: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
};

const STATUS_LABELS: Record<string, string> = {
  live: "Live",
  demo: "Demo mock",
  roadmap: "Roadmap T1 2027",
};

export default function DevPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Code2 className="h-3.5 w-3.5" />
            Developer surface
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Ressources techniques
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Pour intégrer NEURAL dans votre produit, votre workflow ou votre stack — webhooks
            reference, Embed SDK, Operator Gateway documentés.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.map((r) => {
              const cls = ACCENT_CLS[r.accent];
              const Icon = r.Icon;
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className={`group flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${cls.border} ${cls.bg} ${cls.text}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                        STATUS_CLS[r.status]
                      }`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                    {r.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-white/65">{r.description}</p>
                  <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                    <span>Voir la documentation</span>
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
