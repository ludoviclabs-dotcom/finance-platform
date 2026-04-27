import Link from "next/link";
import { ArrowLeft, FileText, AlertTriangle } from "lucide-react";

import { IdpDemo } from "@/components/sandbox/idp-demo";

export const metadata = {
  title: "Document Processing (IDP) — Sandbox NEURAL",
  description:
    "Démo extraction structurée de documents : facture, contrat, bilan. 3 documents-types pré-extraits avec champs structurés, anomalies et KPI calculés.",
};

export default function IdpSandboxPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />

      <div className="relative border-b border-amber-400/15 bg-amber-400/[0.04] px-8 py-3 md:px-12">
        <div className="mx-auto flex max-w-[1320px] items-start gap-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-100/80">
            <span className="font-semibold">Démo mock</span> — données pré-extraites pour montrer
            le format de sortie. La version live (upload PDF + extraction temps réel) est sur la
            roadmap. Aujourd&apos;hui, choisissez un document-type ci-dessous.
          </p>
        </div>
      </div>

      <section className="relative px-8 pb-12 pt-20 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/sandbox"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Toutes les démos
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <FileText className="h-3.5 w-3.5" />
            Document Processing
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Extraction structurée de documents
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Trois documents-types pré-extraits : facture B2B, contrat de prestation, bilan
            comptable. Cliquez sur l&apos;un pour voir le format de sortie : champs structurés,
            lignes de commande, clauses identifiées, KPI calculés, anomalies signalées.
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <IdpDemo />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-cyan-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Tester sur vos documents réels ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Démo personnalisée : on charge 3-5 documents de votre stack, on calibre
                  l&apos;extraction sur votre format, on vous envoie le rapport. Sans engagement.
                </p>
              </div>
              <Link
                href="/contact?source=idp-demo"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Demander une démo personnalisée
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
