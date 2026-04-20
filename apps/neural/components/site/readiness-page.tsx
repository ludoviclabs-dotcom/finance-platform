import Link from "next/link";
import { ArrowRight, ClipboardList, Compass, Sparkles } from "lucide-react";

import { EvidenceCard } from "@/components/site/evidence-card";
import { ScopeCard } from "@/components/site/scope-card";
import { StatusBadge } from "@/components/site/status-badge";
import { type PublicEntry } from "@/lib/public-catalog";

export function ReadinessPage({
  entry,
  eyebrow,
}: {
  entry: PublicEntry;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-violet-500/12 blur-[120px]" />
      <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-500/6 blur-[120px]" />

      <section className="relative px-8 pb-18 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow ?? "Readiness publique"}
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-white md:text-6xl">
              {entry.label}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
              {entry.description}
            </p>
            <div className="mt-6">
              <StatusBadge status={entry.status} proofLevel={entry.proofLevel} />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={entry.ctaHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                {entry.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl border border-white/14 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white/85 transition-all hover:bg-white/[0.08]"
              >
                Contacter NEURAL
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Statut
              </p>
              <p className="mt-3 font-display text-2xl font-bold text-white">{entry.tagline}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Pret aujourd&apos;hui
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/68">{entry.readyNow}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Donnees
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/68">{entry.dataUsed}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                Prochaine etape
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/68">{entry.nextStep}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ScopeCard title="Perimetre actuel" does={entry.scopeNow} doesnt={entry.notYet} />
          <EvidenceCard
            title="Preuves visibles"
            dataUsed={entry.dataUsed}
            deliverable={entry.deliverable}
            status={entry.status}
            proofLevel={entry.proofLevel}
          />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-6 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-200">
              <Compass className="h-4 w-4" />
              Pourquoi cette page existe
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Cette page garde la structure publique du site lisible tout en indiquant clairement le
              niveau de maturite reel. Le visiteur voit ce qui est demonstrable maintenant et ce qui
              releve encore d&apos;une prochaine incremention.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
              <ClipboardList className="h-4 w-4" />
              Action recommandee
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Le meilleur usage de cette brique aujourd&apos;hui est une conversation de cadrage, une
              demo guidee ou un pilote cible. Rien n&apos;est presente ici comme un produit plus fini qu&apos;il ne l&apos;est reellement.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
