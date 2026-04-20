import Link from "next/link";

import { BRANCH_ENTRIES } from "@/lib/public-catalog";
import { StatusBadge } from "@/components/site/status-badge";

export default function SolutionsPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <section className="px-8 pb-16 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            Solutions
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Les 7 branches du framework NEURAL
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Cette page donne un point d&apos;entree unique vers les branches visibles du framework,
            avec leur statut public reel.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {BRANCH_ENTRIES.map((entry) => (
              <Link
                key={entry.slug}
                href={entry.href}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-all hover:-translate-y-1 hover:border-neural-violet/20"
              >
                <StatusBadge status={entry.status} proofLevel={entry.proofLevel} />
                <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">{entry.label}</h2>
                <p className="mt-2 text-sm font-medium text-violet-200">{entry.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/62">{entry.readyNow}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
