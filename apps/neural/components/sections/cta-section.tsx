import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

export function CTASection() {
  return (
    <section className="bg-gradient-neural py-20 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-4xl font-bold">
          Prêt à rejoindre les{" "}
          <span className="text-neural-violet-light">20%</span> qui réussissent ?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-300">
          Réservez un audit gratuit de 30 minutes. Nous analyserons votre
          maturité IA et identifierons les 3 premiers agents à déployer.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/contact"
            className="group inline-flex items-center rounded-xl bg-neural-violet px-8 py-4 text-lg font-semibold shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-xl"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Réserver mon audit gratuit
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/forfaits/simulateur"
            className="inline-flex items-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-lg font-semibold backdrop-blur-sm transition-all hover:bg-white/10"
          >
            Simuler mon ROI
          </Link>
        </div>
      </div>
    </section>
  );
}
