import Link from "next/link";
import { Wrench, Scale, TrendingUp, Award, ArrowRight, Clock, Sparkles } from "lucide-react";

export const metadata = {
  title: "Outils gratuits — NEURAL",
  description:
    "Outils interactifs gratuits NEURAL : AI Act Risk Classifier, ROI Calculator, Audit Maturité IA. Pas d'inscription, résultat immédiat.",
};

interface Tool {
  href: string;
  title: string;
  description: string;
  duration: string;
  output: string;
  icon: typeof Scale;
  gradient: string;
  borderCls: string;
  iconBgCls: string;
  iconTextCls: string;
}

const TOOLS: Tool[] = [
  {
    href: "/outils/ai-act-classifier",
    title: "AI Act Risk Classifier",
    description:
      "Classez votre cas d'usage IA selon l'EU AI Act en 8 questions. Obligations applicables et agent NEURAL adapté en sortie.",
    duration: "~2 min",
    output: "Classification + obligations",
    icon: Scale,
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
    borderCls: "border-violet-400/25",
    iconBgCls: "bg-violet-400/[0.10]",
    iconTextCls: "text-violet-200",
  },
  {
    href: "/outils/roi",
    title: "ROI Calculator",
    description:
      "Estimation chiffrée du ROI NEURAL en 4 étapes : coût mensuel, heures économisées, ETP équivalents, payback.",
    duration: "~3 min",
    output: "Estimation ROI annuel",
    icon: TrendingUp,
    gradient: "from-emerald-500/[0.10] via-white/[0.04] to-emerald-500/[0.04]",
    borderCls: "border-emerald-400/25",
    iconBgCls: "bg-emerald-400/[0.10]",
    iconTextCls: "text-emerald-300",
  },
  {
    href: "/outils/maturite",
    title: "Audit Maturité IA",
    description:
      "12 questions pour mesurer votre maturité IA sur 5 axes. Niveau (Explorateur → Leader) et plan d'action 90 jours.",
    duration: "~5 min",
    output: "Score + plan d'action",
    icon: Award,
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
    borderCls: "border-cyan-400/25",
    iconBgCls: "bg-cyan-400/[0.10]",
    iconTextCls: "text-cyan-200",
  },
];

export default function OutilsPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Wrench className="h-3.5 w-3.5" />
            Outils gratuits
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Trois outils, zéro inscription
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Outils interactifs pour cadrer votre projet IA avant même d&apos;échanger avec nous.
            Calculs côté client, données non stockées, hypothèses publiques. Sortie utilisable
            directement dans vos comités.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 lg:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`group flex flex-col gap-5 rounded-[28px] border ${tool.borderCls} bg-gradient-to-br ${tool.gradient} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline md:p-8`}
                >
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${tool.borderCls} ${tool.iconBgCls} ${tool.iconTextCls}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                      {tool.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">
                      {tool.description}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {tool.duration}
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                      ·
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-white/45">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      {tool.output}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                    <span>Lancer l&apos;outil</span>
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
              Posture des outils
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200">
                  Calcul côté client
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Toute la logique tourne dans votre navigateur. Nous ne stockons pas vos
                  réponses.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                  Hypothèses publiques
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Chaque calcul affiche les hypothèses utilisées. Vous pouvez les contester ou
                  les ajuster lors d&apos;un cadrage.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                  Sortie réutilisable
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Résultats formatés pour être inclus dans vos comités, dossiers d&apos;arbitrage
                  ou pré-études internes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
