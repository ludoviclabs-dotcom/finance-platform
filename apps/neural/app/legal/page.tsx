import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales | NEURAL",
  description: "Mentions légales, éditeur, hébergeur et limites du site NEURAL.",
};

const sections = [
  {
    title: "Éditeur du site",
    body: [
      "Le site NEURAL est édité par Ludovic Labs / NEURAL, projet digital en cours de construction.",
      "Adresse, SIREN/RCS et statut juridique définitif: informations à compléter avant tout usage commercial contractuel ou contractualisation client.",
      "Contact: ludoviclabs@gmail.com.",
    ],
  },
  {
    title: "Direction de la publication",
    body: [
      "Responsable de publication: Ludovic, fondateur du projet NEURAL.",
      "Le contenu publié présente un produit en développement, ses preuves disponibles, ses limites et sa roadmap.",
    ],
  },
  {
    title: "Hébergement",
    body: [
      "Le site est hébergé sur Vercel Inc., infrastructure cloud pour applications web.",
      "Les traitements associés aux formulaires et services tiers dépendent des variables d'environnement configurées en production.",
    ],
  },
  {
    title: "Propriété intellectuelle",
    body: [
      "Les textes, interfaces, catalogues d'agents, structures de preuve et éléments visuels du site sont protégés par le droit applicable.",
      "Toute réutilisation substantielle doit faire l'objet d'une autorisation écrite.",
    ],
  },
  {
    title: "Statut des informations",
    body: [
      "Les contenus du site ne constituent pas un conseil juridique, financier, RH ou réglementaire.",
      "Les pages distinguent les surfaces runtime, les démos publiques, les workbooks créés et les éléments en roadmap. Un agent visible n'est pas nécessairement client-ready.",
    ],
  },
] as const;

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-gradient-neural px-6 pb-16 pt-32 text-white md:px-12">
      <section className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-white/[0.04] p-8 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
          Cadre légal
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
          Mentions légales
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/68">
          Cette page fournit le socle légal minimal du site public. Les
          informations administratives définitives devront être complétées avant
          vente contractuelle, facturation ou relation client formalisée.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-white/70">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl font-bold text-white">
                {section.title}
              </h2>
              <div className="mt-2 space-y-2">
                {section.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
