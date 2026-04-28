import Link from "next/link";
import { ArrowRight, BookOpen, Library, Wrench } from "lucide-react";

const RESOURCES = [
  {
    icon: BookOpen,
    eyebrow: "Documentation",
    title: "Documentation produit",
    description:
      "4 documents fondamentaux : démarrage, architecture des agents, protocole MCP, audit trail signé. Pour CIO, CTO, DPO, RSSI.",
    href: "/docs",
    cta: "Lire la doc",
    accent: "violet",
  },
  {
    icon: Library,
    eyebrow: "Glossaire IA",
    title: "26 termes contextualisés",
    description:
      "AI Act, DORA, MCP, RAG, audit trail, double matérialité… avec contexte métier NEURAL et secteurs concernés.",
    href: "/glossaire",
    cta: "Ouvrir le glossaire",
    accent: "cyan",
  },
  {
    icon: Wrench,
    eyebrow: "Outils gratuits",
    title: "9 outils en ligne",
    description:
      "ROI Calculator, Audit Maturité IA, AI Act Classifier, DPIA Generator, Operator Score, Empreinte IA, Sandbox.",
    href: "/outils/roi",
    cta: "Tester un outil",
    accent: "emerald",
  },
];

const ACCENT: Record<string, { border: string; bg: string; text: string; gradient: string }> = {
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

export function SectionResources() {
  return (
    <section className="relative overflow-hidden border-t border-white/8 bg-gradient-neural px-8 py-24 text-white md:px-12">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <div className="relative mx-auto max-w-[1320px]">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <BookOpen className="h-3.5 w-3.5" />
            Comprendre la plateforme
          </span>
          <h2 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Ressources & apprendre
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/68">
            Documentation produit, glossaire IA contextualisé et outils gratuits — tout ce
            qu'il faut pour comprendre comment NEURAL est structuré, opéré et gouverné, sans
            passer par une démo.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {RESOURCES.map(({ icon: Icon, eyebrow, title, description, href, cta, accent }) => {
            const cls = ACCENT[accent];
            return (
              <div
                key={href}
                className={`group relative flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {eyebrow}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{description}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                  <span>{cta}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
                <Link
                  href={href}
                  aria-label={title}
                  className="absolute inset-0 rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
