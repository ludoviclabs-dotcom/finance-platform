import Link from "next/link";
import { FileSignature, ArrowLeft } from "lucide-react";

import { DpiaWizard } from "@/components/outils/dpia-wizard";

export const metadata = {
  title: "DPIA / AIPD Generator — NEURAL",
  description:
    "Générateur de brouillon AIPD (Analyse d'Impact à la Protection des Données) pour vos projets agents IA. 8 questions structurées RGPD, sortie sectionnée prête à compléter par DPO.",
};

export default function DpiaPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <Link
            href="/outils"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Tous les outils
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <FileSignature className="h-3.5 w-3.5" />
            DPIA / AIPD · Outil gratuit
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Générateur d&apos;AIPD
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            8 questions structurées sur votre projet agent IA → brouillon d&apos;Analyse
            d&apos;Impact à la Protection des Données (RGPD article 35) en sortie. Ne remplace
            pas la validation DPO, mais accélère le cadrage initial de plusieurs semaines.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>~3 minutes</span>
            <span>·</span>
            <span>8 questions RGPD</span>
            <span>·</span>
            <span>7 sections générées</span>
          </div>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <DpiaWizard />
        </div>
      </section>
    </div>
  );
}
