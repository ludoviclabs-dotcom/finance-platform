import Link from "next/link";
import { ShieldCheck, ArrowRight, Search } from "lucide-react";

export const metadata = {
  title: "Vérifier une signature agent — NEURAL",
  description:
    "Vérifiez l'authenticité d'une décision agent NEURAL signée. Collez la signature SHA-256 du journal Operator Gateway pour confirmer qu'elle est intègre.",
};

export default function VerifySignatureIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[820px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Vérification Operator Gateway
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Vérifier une décision agent
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Chaque décision passée par l&apos;Operator Gateway est signée par un SHA-256 chaîné à
            la précédente. Cette page confirme qu&apos;une signature donnée existe bien dans le
            registre et expose les métadonnées non sensibles associées (agent, décision, modèle,
            tenant).
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[820px]">
          <form
            action="/verify/signature/redirect"
            method="GET"
            className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:p-8"
          >
            <label
              htmlFor="hash"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55"
            >
              Signature SHA-256 (64 caractères hexadécimaux)
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
              La signature apparaît dans le journal Operator Gateway, déplié pour une décision.
              C&apos;est le champ « Signataire ».
            </p>
          </form>

          <div className="mt-10 rounded-[24px] border border-white/8 bg-white/[0.02] p-6 md:p-8">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Comment ça marche
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/60">
              <li className="flex gap-2">
                <span className="text-emerald-300">1.</span>
                Chaque évènement est journalisé avec sa séquence, son agent, sa décision et le
                hash de signature de l&apos;évènement précédent.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-300">2.</span>
                Sa signature finale SHA-256 inclut toutes ces données + le hash précédent. Modifier
                un seul évènement casserait tous les suivants.
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-300">3.</span>
                Cette page recalcule la signature attendue à partir des données stockées et la
                compare à la signature enregistrée. Tout écart est signalé.
              </li>
            </ul>
            <Link
              href="/operator-gateway"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
            >
              Voir l&apos;Operator Gateway <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
