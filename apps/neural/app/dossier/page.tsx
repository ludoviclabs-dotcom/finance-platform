import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  FileDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getProofCatalog } from "@/lib/proof-catalog";

export const metadata: Metadata = {
  title: "Dossier NEURAL — recruteur, client, investisseur",
  description:
    "Synthèse imprimable NEURAL : architecture, preuves publiques, agents vitrines, limites, pilots et lecture recruteur/client/investisseur.",
};

const audiences = [
  {
    title: "Recruteur senior",
    icon: BriefcaseBusiness,
    points: [
      "Capacité à transformer des workbooks Excel en surfaces produit vérifiables.",
      "Maîtrise produit: statuts, limites, exports, QA et confiance.",
      "Signal fort sur secteurs régulés, conformité et industrialisation IA.",
    ],
  },
  {
    title: "Acheteur enterprise",
    icon: Building2,
    points: [
      "Pilot cadré sur 1 agent et 1 résultat métier, sans promesse plateforme prématurée.",
      "Preuves visibles: source workbook, démo, export, supervision et limite.",
      "Discussion sécurité structurée: sous-traitants, données, traces, DPA et roadmap.",
    ],
  },
  {
    title: "Investisseur / design partner",
    icon: Sparkles,
    points: [
      "Wedge clair: opérateur d'agents IA gouvernés pour secteurs régulés EU.",
      "Traction à obtenir sur 3 pilots: Luxe Communication, Banque Communication, Assurance Supply Chain.",
      "Risque principal assumé: passer d'actifs démontrables à usages client récurrents.",
    ],
  },
];

const pilotPacks = [
  {
    name: "Proof Audit",
    price: "1 500 à 3 500 EUR",
    outcome: "Inventaire agents/process, score de maturité, risques et backlog 30 jours.",
  },
  {
    name: "Agent Pack 30 jours",
    price: "8 000 à 20 000 EUR",
    outcome: "1 agent branché, model card, exemple input/output, export et limites.",
  },
  {
    name: "Governed Runtime Sprint",
    price: "sur devis après design partner",
    outcome: "2-3 agents avec supervision, traces, owners et premier cockpit gouverné.",
  },
];

export default function DossierPage() {
  const catalog = getProofCatalog();
  const flagship = catalog.priorityModelCards;

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-neural text-white">
      <section className="px-6 pb-14 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <FileDown className="h-3.5 w-3.5" />
            Dossier public
          </span>
          <h1
            className="mt-6 max-w-5xl break-words font-display font-bold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 9vw, 3.75rem)", lineHeight: 1.12 }}
          >
            <span className="block">NEURAL en une lecture</span>
            <span className="block">recruteur, client</span>
            <span className="block">et investisseur.</span>
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/68">
            <span className="block sm:inline">Cette page synthétise les preuves,</span>{" "}
            <span className="block sm:inline">les briques à brancher</span>{" "}
            <span className="block sm:inline">et les pilots lançables.</span>{" "}
            <span className="block sm:inline">La lecture reste exploitable.</span>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/proof"
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-violet-100"
            >
              Voir la Proof Console
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact?subject=Design%20Partner%20NEURAL"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
            >
              Proposer un design partner
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-4 md:grid-cols-4">
          {[
            ["Agents avec données Excel", catalog.counts.liveAgentsWithExcel],
            ["Workbooks runtime", catalog.counts.runtimeWorkbooks],
            ["Cellules alimentées", `${catalog.counts.liveCells}/${catalog.counts.frameworkCells}`],
            ["Client-ready", catalog.counts.clientReady],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="font-display text-4xl font-bold">{value}</p>
              <p className="mt-2 text-sm text-white/58">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-5 lg:grid-cols-3">
          {audiences.map((audience) => (
            <article key={audience.title} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <audience.icon className="h-6 w-6 text-violet-200" />
              <h2 className="mt-4 font-display text-2xl font-bold">{audience.title}</h2>
              <ul className="mt-5 space-y-3">
                {audience.points.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-relaxed text-white/64">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Agents vitrines
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
              5 preuves à montrer, pas 168 promesses.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {flagship.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold">{card.name}</h3>
                    <p className="mt-1 text-xs text-white/42">{card.workbookSource}</p>
                  </div>
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-xs font-semibold text-amber-100">
                    Score {card.proofScore}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/64">{card.exampleOutput}</p>
                <p className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/50">
                  Limite: {card.clientReadyBlocker}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              Packaging pilot
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
              Vendre un résultat métier, pas une plateforme abstraite.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/62">
              Les trois offres encadrent le passage de l'actif Excel au produit gouverné. Enterprise
              reste sur devis après design partner.
            </p>
          </div>
          <div className="grid gap-3">
            {pilotPacks.map((pack) => (
              <div key={pack.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-bold">{pack.name}</h3>
                  <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/65">
                    {pack.price}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{pack.outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
