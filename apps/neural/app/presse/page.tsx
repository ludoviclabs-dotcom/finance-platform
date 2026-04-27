import {
  Newspaper,
  Download,
  Mail,
  ArrowRight,
  Image as ImageIcon,
  FileText,
  Quote,
  Building,
} from "lucide-react";

export const metadata = {
  title: "Presse — NEURAL",
  description:
    "Kit presse NEURAL : boilerplate, brand assets, chiffres clés, contact presse. Pour journalistes, analystes et événements.",
};

const KEY_FACTS = [
  { label: "Spécialité", value: "Opérateur agents IA EU régulés" },
  { label: "Modèle", value: "Claude Sonnet 4.6 via Vercel AI Gateway" },
  { label: "Hébergement", value: "Frankfurt + Paris (CDG)" },
  { label: "Secteurs cibles", value: "Banque · Luxe · Aéro · Assurance · Transport · SaaS" },
  { label: "Branches métier", value: "7 branches × 6 secteurs = 42 combinaisons" },
  { label: "Forme juridique", value: "SAS française" },
];

const BOILERPLATE_LONG = `NEURAL AI Consulting est un opérateur d'agents IA spécialisé dans les secteurs régulés européens. La société conçoit, déploie et opère des agents Claude (Anthropic) pré-entraînés pour des cas d'usage métier verticaux dans la banque (DORA), l'assurance, le luxe (CSRD), l'aéronautique (EASA), le transport et le SaaS.

Différenciée des iPaaS génériques par son approche outcome-first et sa conformité native AI Act + RGPD, NEURAL adresse les directions financières, RH, communication et conformité d'organisations de plus de 50 personnes. La plateforme est intégralement hébergée en Union Européenne et expose publiquement ses sous-processeurs, son audit trail et sa roadmap.

NEURAL s'inscrit dans la thèse "Sovereign AI" française et européenne : verticalisation sectorielle, conformité réglementaire native, transparence opérationnelle.`;

const BOILERPLATE_SHORT = `NEURAL AI Consulting opère des agents IA Claude pré-entraînés pour les secteurs régulés européens (banque DORA, luxe CSRD, aéro EASA, assurance). Hébergement EU exclusif, conformité AI Act + RGPD native, méthodologie outcome cadré avant code.`;

export default function PressePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Newspaper className="h-3.5 w-3.5" />
            Presse
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Kit presse &amp; ressources
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Tout ce dont les journalistes, analystes et organisateurs d&apos;événements ont besoin :
            boilerplate, chiffres clés, brand assets, contact direct.
          </p>
        </div>
      </section>

      {/* Key facts */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Chiffres clés</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {KEY_FACTS.map((f) => (
              <div
                key={f.label}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{f.label}</p>
                <p className="mt-2 font-display text-base font-bold leading-snug text-white">
                  {f.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Boilerplate */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Quote className="h-3 w-3" />
            Boilerplate
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">À propos de NEURAL</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
                Format court (1 phrase)
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/85">{BOILERPLATE_SHORT}</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
                Format long (3 paragraphes)
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/85">
                {BOILERPLATE_LONG}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Brand assets */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <ImageIcon className="h-3 w-3" />
            Brand assets
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Logo &amp; ressources visuelles
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AssetCard
              icon={ImageIcon}
              title="Logo NEURAL — SVG"
              description="Logo principal en SVG pour print et web. Versions claire et sombre."
              status="preparing"
            />
            <AssetCard
              icon={ImageIcon}
              title="Logo NEURAL — PNG"
              description="Versions PNG transparent en 512 / 1024 / 2048 px."
              status="preparing"
            />
            <AssetCard
              icon={FileText}
              title="Brand guidelines"
              description="PDF avec palette couleurs, typographies, do/don't, exemples d'usage."
              status="preparing"
            />
            <AssetCard
              icon={ImageIcon}
              title="Captures d'écran produit"
              description="Operator Gateway, /agents catalog, /sandbox — résolution presse."
              status="preparing"
            />
            <AssetCard
              icon={Building}
              title="Photos dirigeant·e"
              description="Portrait HD libre de droits pour usage éditorial."
              status="preparing"
            />
            <AssetCard
              icon={FileText}
              title="One-pager corporate"
              description="PDF 1 page : positionnement, chiffres clés, secteurs, contact."
              status="preparing"
            />
          </div>
          <p className="mt-6 text-xs text-white/40">
            Assets en préparation — disponibles sur demande à <a className="text-violet-200" href="mailto:press@neural-ai.fr">press@neural-ai.fr</a>.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-violet-300">
                  <Mail className="h-4 w-4" />
                  <span className="text-[11px] uppercase tracking-[0.18em]">Contact presse</span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Une demande, un sujet, une interview ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Réponse sous 24h ouvrées. Sujets de prédilection : AI Act EU, opération
                  d&apos;agents en environnement régulé, souveraineté IA française.
                </p>
              </div>
              <a
                href="mailto:press@neural-ai.fr"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                press@neural-ai.fr <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function AssetCard({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: typeof ImageIcon;
  title: string;
  description: string;
  status: "available" | "preparing";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/[0.10] text-violet-200">
          <Icon className="h-4 w-4" />
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            status === "available"
              ? "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300"
              : "border-amber-400/25 bg-amber-400/[0.10] text-amber-200"
          }`}
        >
          {status === "available" ? (
            <>
              <Download className="h-3 w-3" />
              Disponible
            </>
          ) : (
            "En préparation"
          )}
        </span>
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{description}</p>
      </div>
    </div>
  );
}
