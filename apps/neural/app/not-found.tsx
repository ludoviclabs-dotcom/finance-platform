import Link from "next/link";
import { ArrowRight, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-neural px-6 py-32 text-white md:px-10">
      <section className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.045] p-8 md:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08]">
          <SearchX className="h-5 w-5 text-violet-200" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
          Page introuvable
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
          Cette route NEURAL n'est pas disponible.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/65">
          Certaines pages restent volontairement en roadmap. Pour vérifier ce qui
          est réellement exposé, utilisez la console de preuve ou le hub secteurs.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/proof"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Voir la Proof Console
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/secteurs"
            className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
          >
            Explorer les secteurs
          </Link>
        </div>
      </section>
    </main>
  );
}
