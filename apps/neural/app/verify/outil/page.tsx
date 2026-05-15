import Link from "next/link";
import { ShieldCheck, ArrowRight, Search } from "lucide-react";

export const metadata = {
  title: "Vérifier une synthèse signée — NEURAL",
  description:
    "Vérifiez l'authenticité d'une synthèse PDF NEURAL générée par les outils gratuits (AI Act Classifier, ROI Calculator, Maturity Quiz). Collez le hash SHA-256 du pied de page.",
};

export default function VerifyOutilIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[820px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Vérification publique
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Vérifier une synthèse signée
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Chaque synthèse PDF produite par les outils gratuits NEURAL embarque un hash
            SHA-256 dans son pied de page. Cette page confirme qu&apos;un hash donné a bien
            été produit par notre infrastructure et n&apos;a pas été fabriqué après coup.
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[820px]">
          <form
            action="/verify/outil/redirect"
            method="GET"
            className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-8"
          >
            <label
              htmlFor="hash"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
            >
              Hash SHA-256 (64 caractères hexadécimaux)
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="hash"
                name="hash"
                type="text"
                required
                minLength={64}
                maxLength={64}
                pattern="[a-f0-9]{64}"
                placeholder="abcdef0123456789…"
                className="flex-1 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 font-mono text-sm text-white placeholder:text-white/30 focus:border-emerald-400/40 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                <Search className="h-4 w-4" />
                Vérifier
              </button>
            </div>
            <p className="mt-3 text-xs text-white/40">
              Le hash se trouve au pied de chaque page de la synthèse, juste à côté de
              l&apos;URL de cette page.
            </p>
          </form>

          <div className="mt-10 rounded-[24px] border border-white/8 bg-white/[0.02] p-6 md:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Pas encore généré de synthèse ?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Lancez un des outils gratuits NEURAL — chaque résultat est téléchargeable en PDF
              signé.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {[
                { href: "/outils/ai-act-classifier", label: "AI Act Classifier" },
                { href: "/outils/roi", label: "ROI Calculator" },
                { href: "/outils/maturite", label: "Maturity Quiz" },
              ].map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
                >
                  {tool.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
