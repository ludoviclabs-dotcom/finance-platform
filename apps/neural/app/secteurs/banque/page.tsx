import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Gauge,
  Landmark,
  Leaf,
  Mail,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { CoverageGridFiltered } from "@/components/coverage/coverage-grid-filtered";
import { LearnMoreBlock } from "@/components/site/learn-more-block";

export const metadata: Metadata = {
  title: "Banque - Communication & Marketing regules | NEURAL",
  description:
    "Deux branches NEURAL pour la banque : Communication régulée et Marketing Excel-first. Gates déterministes, scénario-id only, validation humaine et données synthétiques.",
  openGraph: {
    title: "NEURAL - Banque",
    description:
      "Communication bancaire + Marketing AMF/ACPR, MiFID, PRIIPs, MiCA et segmentation.",
  },
};

const BRANCHES = [
  {
    slug: "communication",
    href: "/secteurs/banque/communication",
    label: "Communication",
    tagline: "Réglementaire, crise, ESG, clients sensibles",
    description:
      "4 agents publics et 2 services transverses pour les communications corporate et clients : resultats, crise, ESG et notices sensibles. Runtime scénario-id only déjà visible.",
    agents: [
      { icon: Landmark, name: "RegBankComms", tag: "Réglementaire" },
      { icon: ShieldAlert, name: "BankCrisisComms", tag: "Crise" },
      { icon: Leaf, name: "ESGBankComms", tag: "ESG" },
      { icon: Mail, name: "ClientBankComms", tag: "Clients" },
    ],
    kpis: ["4 agents", "16 gates", "19 scénarios"],
    accent: "#8B5CF6",
    bg: "#0A1628",
    cls: "branche-comms",
  },
  {
    slug: "marketing",
    href: "/secteurs/banque/marketing",
    label: "Marketing",
    tagline: "AMF/ACPR, education, segmentation, MiFID/MiCA",
    description:
      "4 agents portfolio et 2 services réservés pour auditer campagnes, contenus pedagogiques, personnalisation CRM et supports produits d'investissement. 6 Excel générés et verifiees.",
    agents: [
      { icon: ShieldCheck, name: "BankMarketingComplianceGuard", tag: "AMF/ACPR" },
      { icon: BookOpen, name: "FinLiteracyContent", tag: "Education" },
      { icon: UsersRound, name: "SegmentedBankMarketing", tag: "CRM / DPO" },
      { icon: Scale, name: "MiFIDProductMarketingGuard", tag: "MiFID / MiCA" },
    ],
    kpis: ["4 agents", "6 workbooks", "10 gates"],
    accent: "#22D3EE",
    bg: "#07111C",
    cls: "branche-marketing",
  },
] as const;

const SECTOR_STATS = [
  { value: "8", label: "agents publics" },
  { value: "4", label: "services réservés" },
  { value: "26", label: "gates explicites" },
  { value: "0", label: "texte libre impose" },
];

export default function BanquePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07111c] text-white">
      <style>{`
        .bank-branche-card { transition: border-color .2s, transform .2s, background .2s; }
        .branche-comms:hover { border-color: #8B5CF6 !important; transform: translateY(-3px); }
        .branche-marketing:hover { border-color: #22D3EE !important; transform: translateY(-3px); }
      `}</style>

      <nav className="flex items-center gap-2 border-b border-white/10 px-6 py-4 text-sm md:px-8">
        <Link href="/" className="text-white/55 transition-colors hover:text-white">NEURAL</Link>
        <span className="text-white/25">/</span>
        <Link href="/secteurs" className="text-white/55 transition-colors hover:text-white">Secteurs</Link>
        <span className="text-white/25">/</span>
        <span className="font-semibold text-white">Banque</span>
      </nav>

      <div className="mx-auto max-w-[1180px] px-6 md:px-8">
        <section className="py-16 md:py-20">
          <div className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">
            Secteur Banque
          </div>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Banque.
            <span className="block text-cyan-100/80">Deux branches, une discipline.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
            Communication et Marketing ne portent pas les memes risques. NEURAL
            les separe pour garder des gates explicites, une revue humaine et un
            mode démo sans texte libre.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTOR_STATS.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="font-display text-4xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/45">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-12">
          <CoverageGridFiltered
            sector="banque"
            title="Couverture Banque — 7 branches métier"
            description="Vue intégrale lue depuis le registry. Communication et Marketing sont détaillées en éditorial ci-dessous."
          />
        </section>

        <section className="pb-20">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
            Branches disponibles
          </h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {BRANCHES.map((branche) => (
              <Link key={branche.slug} href={branche.href} className="block no-underline">
                <article
                  className={`bank-branche-card ${branche.cls} rounded-[28px] border border-white/10 p-6 md:p-8`}
                  style={{ background: branche.bg }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: branche.accent }}>
                        Branche
                      </p>
                      <h3 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
                        {branche.label}
                      </h3>
                      <p className="mt-1 text-sm text-white/55">{branche.tagline}</p>
                    </div>
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                      style={{ background: `${branche.accent}20`, color: branche.accent }}
                    >
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-white/64">{branche.description}</p>

                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {branche.agents.map((agent) => {
                      const Icon = agent.icon;
                      return (
                        <div key={agent.name} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: `${branche.accent}20`, color: branche.accent }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-white">{agent.name}</p>
                            <p className="text-[11px] text-white/40">{agent.tag}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {branche.kpis.map((kpi) => (
                      <span
                        key={kpi}
                        className="rounded-full border px-3 py-1 text-[11px] font-semibold"
                        style={{ borderColor: `${branche.accent}55`, color: branche.accent, background: `${branche.accent}12` }}
                      >
                        {kpi}
                      </span>
                    ))}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-10">
          <Link href="/secteurs" className="text-sm font-medium text-white/50 transition-colors hover:text-white">
            Tous les secteurs
          </Link>
          <Link
            href="/contact?subject=Banque%20-%20demo"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#07111c] transition-colors hover:bg-cyan-50"
          >
            Cadrer une démo Banque
            <Gauge className="h-4 w-4" />
          </Link>
        </section>
      </div>

      <LearnMoreBlock
        subtitle="Comprendre les exigences DORA, AI Act et l'audit trail signé que NEURAL applique aux agents bancaires."
        items={[
          {
            kind: "doc",
            label: "Audit trail signé",
            description: "Format, chaîne de signature HMAC-SHA256, export, opposabilité juridique (article 1366 du Code civil).",
            href: "/docs/audit-trail",
          },
          {
            kind: "glossary",
            label: "DORA",
            description: "Digital Operational Resilience Act — résilience opérationnelle TIC pour les entités financières EU.",
            href: "/glossaire/dora",
          },
          {
            kind: "glossary",
            label: "Audit trail signé",
            description: "Journal immuable et signé des décisions IA, préparé pour revue juridique.",
            href: "/glossaire/audit-trail",
          },
        ]}
      />
    </main>
  );
}
