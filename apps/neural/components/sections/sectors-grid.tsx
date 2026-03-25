import Link from "next/link";

const sectors = [
  { id: "transport",    label: "Transport",    emoji: "\u{1F686}", desc: "Optimisation logistique, maintenance prédictive, conformité OIV" },
  { id: "luxe",         label: "Luxe",         emoji: "\u{1F45C}", desc: "Inventaire multi-maisons, ESG, recrutement haute couture" },
  { id: "aeronautique", label: "Aéronautique", emoji: "\u{2708}\u{FE0F}", desc: "Supply chain critique, conformité EASA, MRO intelligent" },
  { id: "saas",         label: "SaaS",         emoji: "\u{1F4BB}", desc: "PLG analytics, churn prediction, revenue intelligence" },
  { id: "banque",       label: "Banque",       emoji: "\u{1F3E6}", desc: "Risque crédit, conformité Bâle IV, KYC automatisé" },
  { id: "assurance",    label: "Assurance",    emoji: "\u{1F6E1}\u{FE0F}", desc: "IFRS 17, tarification dynamique, gestion sinistres" },
];

export function SectorsGrid() {
  return (
    <section className="bg-surface-raised py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">
            6 secteurs d&apos;expertise
          </h2>
          <p className="mt-4 text-lg text-foreground-muted">
            Des agents calibrés pour les spécificités réglementaires et métier
            de votre industrie
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((sector) => (
            <Link
              key={sector.id}
              href={`/secteurs/${sector.id}`}
              className="card group p-6 transition-all hover:border-neural-violet/30 hover:shadow-md"
            >
              <span className="text-4xl">{sector.emoji}</span>
              <h3 className="mt-3 font-display text-lg font-semibold">
                {sector.label}
              </h3>
              <p className="mt-2 text-sm text-foreground-muted">
                {sector.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
