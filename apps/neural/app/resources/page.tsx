import Link from "next/link";
import { notFound } from "next/navigation";

import { isFeatureOn } from "@/lib/features";
import { RESOURCE_ENTRIES } from "@/lib/public-catalog";
import { StatusBadge } from "@/components/site/status-badge";

export default function ResourcesPage() {
  // Sprint P0 — masqué tant que le flag n'est pas activé.
  if (!isFeatureOn("resources")) notFound();

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <section className="px-8 pb-16 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            Ressources
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Publications live, outils en preparation
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Le hub ressources conserve une navigation propre tout en rendant explicite ce qui est
            deja disponible publiquement.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/publications"
              className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.06] p-6 transition-all hover:-translate-y-1 hover:border-emerald-400/25"
            >
              <StatusBadge status="live" />
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">Publications</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/68">
                Hub editorial deja en ligne avec analyses, benchmarks et pages article.
              </p>
            </Link>

            {RESOURCE_ENTRIES.map((entry) => (
              <Link
                key={entry.slug}
                href={entry.href}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 transition-all hover:-translate-y-1 hover:border-neural-violet/20"
              >
                <StatusBadge status={entry.status} proofLevel={entry.proofLevel} />
                <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">{entry.label}</h2>
                <p className="mt-2 text-sm font-medium text-violet-200">{entry.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{entry.readyNow}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
