import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, FileSearch, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Offres pilotes | NEURAL",
  description:
    "Trois formats d'engagement NEURAL: audit de preuve, agent pack 30 jours et sprint runtime gouverné.",
};

const offers = [
  {
    title: "Proof Audit",
    tag: "5 à 10 jours",
    icon: FileSearch,
    price: "Sur devis court",
    promise:
      "Cartographier vos process, vos données disponibles et les agents réellement industrialisables.",
    includes: [
      "Inventaire des cas d'usage et risques de sur-promesse",
      "Matrice données, conformité, supervision humaine",
      "Score de maturité agent par agent",
      "Recommandation go / no-go sur un pilote",
    ],
  },
  {
    title: "Agent Pack 30 jours",
    tag: "Pilot ciblé",
    icon: ClipboardCheck,
    price: "1 agent prioritaire",
    promise:
      "Brancher un agent métier auditable sur un périmètre réduit, avec limites visibles et export.",
    includes: [
      "Source de données contrôlée ou workbook validé",
      "Démo stable avec exemple input/output",
      "Trace d'exécution et export JSON/CSV ou rapport",
      "Revue humaine obligatoire avant usage opérationnel",
    ],
  },
  {
    title: "Governed Runtime Sprint",
    tag: "30 à 45 jours",
    icon: ShieldCheck,
    price: "2 à 3 agents",
    promise:
      "Tester une mini-chaîne d'agents supervisés avec gouvernance, preuves et rapport de limites.",
    includes: [
      "Orchestration contrôlée sur 2 ou 3 agents",
      "Journal d'audit structuré et fallback erreurs",
      "Tableau de preuves, blocages et next actions",
      "Dossier de décision pour CTO, DPO, DAF ou direction métier",
    ],
  },
] as const;

export default function ForfaitsPage() {
  return (
    <main className="min-h-screen bg-gradient-neural text-white">
      <section className="mx-auto max-w-[1180px] px-6 pb-20 pt-32 md:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
            Offres pilotes
          </p>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-6xl">
            Acheter une preuve, pas une promesse de plateforme.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/65">
            NEURAL n'est pas vendu comme un parc complet d'agents actifs. Les formats ci-dessous
            servent à prouver un périmètre métier précis, avec données, limites,
            supervision humaine et livrable vérifiable.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {offers.map((offer) => {
            const Icon = offer.icon;
            return (
              <article
                key={offer.title}
                className="flex min-h-[500px] flex-col rounded-[24px] border border-white/10 bg-white/[0.045] p-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08]">
                    <Icon className="h-5 w-5 text-violet-200" />
                  </div>
                  <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    {offer.tag}
                  </span>
                </div>
                <h2 className="mt-6 font-display text-2xl font-bold tracking-tight">
                  {offer.title}
                </h2>
                <p className="mt-2 text-sm font-semibold text-emerald-200">
                  {offer.price}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  {offer.promise}
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-white/62">
                  {offer.includes.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
                >
                  Lancer le cadrage
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-10 rounded-[24px] border border-amber-300/20 bg-amber-300/[0.07] p-6 text-sm leading-relaxed text-amber-50/80">
          <p className="font-semibold text-amber-100">Limite commerciale assumée</p>
          <p className="mt-2">
            Le palier Enterprise reste volontairement sur devis après design partner.
            Aucun engagement de ROI contractualisé n'est proposé sans baseline,
            accès données, périmètre juridique et critères de succès validés.
          </p>
        </div>
      </section>
    </main>
  );
}
