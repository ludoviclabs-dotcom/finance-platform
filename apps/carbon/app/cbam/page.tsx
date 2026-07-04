/**
 * Landing SEO : CBAM / MACF — mécanisme d'ajustement carbone aux frontières.
 *
 * Cible "CBAM 2026", "CBAM déclaration 2027", "MACF importateur". Régime définitif
 * en vigueur depuis le 1er janvier 2026 ; les dates et seuils repris ici sont ceux
 * de l'encart CBAM du pricing (annexe A.3 du plan d'action), re-vérifiés en
 * juillet 2026 : exemption de minimis 50 t/an, certificats à partir de février 2027,
 * première déclaration annuelle au 30 septembre 2027.
 *
 * Côté produit, on ne promet QUE ce qui existe : estimation d'exposition au
 * tableau de bord et préparation des données d'émissions intégrées.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "@/components/landing/newsletter-form";

export const metadata: Metadata = {
  title: "CBAM 2026-2027 : régime définitif, seuil 50 t, certificats — le point | CarbonCo",
  description:
    "Le mécanisme d'ajustement carbone aux frontières (CBAM/MACF) est en régime définitif depuis le " +
    "1er janvier 2026 : exemption sous 50 tonnes/an, statut de déclarant agréé, certificats à acheter " +
    "dès février 2027 et première déclaration annuelle au 30 septembre 2027. Qui est concerné et comment se préparer.",
  alternates: { canonical: "/cbam" },
};

const TIMELINE = [
  {
    date: "2023 → 2025",
    title: "Période transitoire",
    body: "Déclarations trimestrielles purement informatives pour les importateurs de marchandises couvertes — sans achat de certificats.",
  },
  {
    date: "1er janvier 2026",
    title: "Régime définitif",
    body: "Fin de la période transitoire. Les importateurs au-delà du seuil de minimis doivent disposer du statut de déclarant CBAM agréé pour importer les marchandises couvertes.",
  },
  {
    date: "Février 2027",
    title: "Ouverture de la vente de certificats",
    body: "Les certificats CBAM (adossés au prix du quota ETS) deviennent achetables. Ils couvriront les émissions intégrées des importations réalisées à partir de 2026.",
  },
  {
    date: "30 septembre 2027",
    title: "Première déclaration annuelle",
    body: "Dépôt de la déclaration CBAM portant sur les importations de l'année 2026 : volumes, émissions intégrées vérifiables, certificats restitués.",
  },
];

const FAQ = [
  {
    q: "Qui est exempté du CBAM ?",
    a: "Le paquet de simplification adopté en 2025 a introduit un seuil de minimis : les importateurs qui " +
      "restent sous 50 tonnes par an de marchandises couvertes (fer/acier, aluminium, ciment, engrais, " +
      "hydrogène) sont exemptés des obligations du régime définitif. Au-delà, le statut de déclarant CBAM " +
      "agréé est requis.",
  },
  {
    q: "Quelles marchandises sont couvertes ?",
    a: "Ciment, fer et acier, aluminium, engrais, hydrogène et électricité importés dans l'UE, y compris " +
      "certains produits transformés en aval (vis, boulons et articles similaires en fer ou en acier, par exemple). " +
      "La liste précise s'apprécie par code NC — c'est la première vérification à faire avec votre transitaire.",
  },
  {
    q: "Que faut-il déclarer exactement en 2027 ?",
    a: "La déclaration annuelle (au 30 septembre 2027 pour les importations 2026) porte sur les quantités " +
      "importées, les émissions intégrées (directes et, pour certaines marchandises, indirectes) calculées selon " +
      "les méthodes du règlement, le prix du carbone éventuellement déjà payé dans le pays d'origine, et la " +
      "restitution du nombre de certificats CBAM correspondant.",
  },
  {
    q: "Quel lien entre CBAM et bilan GES ?",
    a: "Les données se recoupent largement : les émissions intégrées de vos importations reposent sur les mêmes " +
      "données fournisseurs que votre Scope 3 amont (catégorie 3.1). Structurer la collecte fournisseurs une " +
      "fois permet d'alimenter les deux exercices.",
  },
];

export default function CbamPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="bg-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Toolbar */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/bilan-carbone-beges" className="text-sm text-neutral-600 hover:text-neutral-900">
              Guide BEGES
            </Link>
            <Link href="/blog" className="text-sm text-neutral-600 hover:text-neutral-900">
              Blog
            </Link>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-10 pb-8 border-b border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
            Réglementation UE · Mise à jour juillet 2026
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
            CBAM : le régime définitif est là. Les certificats arrivent en 2027.
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">
            Depuis le 1er janvier 2026, le mécanisme d&apos;ajustement carbone aux frontières
            (CBAM, ou MACF en français) est entré dans son régime définitif. Si vous importez
            de l&apos;acier, de l&apos;aluminium, du ciment, des engrais ou de l&apos;hydrogène,
            voici le calendrier exact et ce qu&apos;il faut préparer dès maintenant.
          </p>
        </header>

        {/* Timeline */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-8">
            Le calendrier qui compte
          </h2>
          <div className="space-y-6">
            {TIMELINE.map((t) => (
              <div key={t.date} className="grid grid-cols-[140px_1fr] gap-5 items-start">
                <div className="text-sm font-extrabold tracking-tight text-green-700 pt-0.5">{t.date}</div>
                <div>
                  <p className="font-bold text-neutral-900 mb-1">{t.title}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Corps */}
        <section className="space-y-5 text-neutral-800 leading-relaxed">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900">
            Le seuil des 50 tonnes : exemptés, mais pas exonérés de vigilance
          </h2>
          <p>
            L&apos;exemption de minimis (50 t/an de marchandises couvertes, tous codes NC confondus)
            sort la plupart des petits importateurs des obligations déclaratives. Deux pièges
            subsistent : le seuil s&apos;apprécie sur l&apos;<strong>année civile glissante</strong> —
            une commande exceptionnelle peut vous faire basculer — et l&apos;obtention du statut de
            <strong> déclarant CBAM agréé</strong> n&apos;est pas instantanée. Si vous êtes proche du
            seuil, le suivi des volumes importés devient une donnée de pilotage à part entière.
          </p>

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 pt-4">
            Les données à préparer : les mêmes que votre Scope 3
          </h2>
          <p>
            Les émissions intégrées de vos importations se calculent à partir des données de vos
            fournisseurs hors UE — exactement le même exercice de collecte que votre Scope 3 amont
            (catégorie 3.1 « biens et services achetés »). Les entreprises qui structurent dès
            maintenant leur collecte fournisseurs (questionnaires tracés, valeurs par défaut
            documentées, pièces justificatives) préparent les deux échéances d&apos;un coup.
          </p>
        </section>

        {/* Encart produit — capacités réelles uniquement */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
            Où CarbonCo intervient
          </p>
          <p className="text-sm text-neutral-800 leading-relaxed">
            CarbonCo aide à <strong>estimer votre exposition CBAM</strong> (volumes et intensités
            carbone des flux importés, visibles au tableau de bord) et à <strong>préparer les
            données d&apos;émissions intégrées</strong> : collecte fournisseurs tracée par
            questionnaire sécurisé, pièces justificatives hashées, export auditable. La
            télédéclaration CBAM elle-même s&apos;effectue dans le registre officiel de l&apos;UE.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/scope3-fournisseurs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Structurer la collecte fournisseurs
            </Link>
            <Link
              href="/etat-du-produit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-green-300 text-green-800 text-sm font-semibold hover:bg-green-100 transition-colors"
            >
              Statut exact de chaque fonctionnalité
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-6">
            Questions fréquentes
          </h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <p className="font-bold text-neutral-900 mb-1">{item.q}</p>
                <p className="text-sm text-neutral-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="mt-12">
          <NewsletterForm source="cbam" />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            Références : règlement (UE) 2023/956 (CBAM) et paquet de simplification 2025 (seuil de
            minimis). Cette page est informative et ne constitue pas un conseil juridique ou douanier.
          </p>
        </footer>
      </article>
    </main>
  );
}
