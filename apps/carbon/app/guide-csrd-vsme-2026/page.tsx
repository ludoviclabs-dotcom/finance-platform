/**
 * Lead magnet : "CSRD & VSME après l'Omnibus (2026) — guide pratique"
 *
 * Le guide est délibérément servi en HTML imprimable plutôt qu'en PDF binaire :
 *   - Indexable Google (SEO long-tail "CSRD VSME Omnibus")
 *   - Imprimable via Cmd/Ctrl+P → PDF instantané
 *   - Aucune dépendance backend, aucun stockage de fichier binaire
 *
 * La page propose un formulaire d'inscription newsletter en parallèle, mais
 * le contenu reste accessible sans inscription (pas de gating).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "@/components/landing/newsletter-form";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "CSRD & VSME après l'Omnibus (2026) — guide pratique | CarbonCo",
  description:
    "Le guide pratique CarbonCo après la directive (UE) 2026/470 (Omnibus I) : qui reste soumis à la CSRD, " +
    "pourquoi la norme volontaire (VS, ex-VSME) devient le langage de la chaîne de valeur, et 12 points " +
    "opérationnels pour produire un reporting auditable.",
  alternates: { canonical: "/guide-csrd-vsme-2026" },
};

const PRINT_STYLE = `
  @page { size: A4; margin: 18mm 16mm; }
  @media print {
    .guide-toolbar { display: none !important; }
    .guide-newsletter { display: none !important; }
    body { background: #ffffff !important; }
  }
`;

const POINTS: { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "Cadrer le périmètre exact de reporting",
    body:
      "Le périmètre CSRD est calé sur le périmètre de consolidation IFRS 10. Première décision à acter avec le commissaire aux comptes : périmètre identique ou élargi ? Documenter par écrit avant tout démarrage opérationnel.",
  },
  {
    num: "02",
    title: "Constituer une équipe projet pluri-fonctionnelle",
    body:
      "Sponsor exécutif (DAF/DG), chef de projet ESG (RSE ou DAF adjoint), référents données (IT + métiers). Minimum 3 rôles formellement désignés dans la première semaine.",
  },
  {
    num: "03",
    title: "Réaliser une analyse de double matérialité documentée",
    body:
      "Selon ESRS 1, chapitre 3 : 6 à 10 enjeux matériels priorisés, scoring justifié sur impact + financier, parties prenantes consultées (3 externes minimum), arbitrage gouvernance acté en COMEX ou comité ESG. Les ESRS 2026 admettent une approche descendante (top-down).",
  },
  {
    num: "04",
    title: "Cartographier les datapoints obligatoires",
    body:
      "Entité soumise à la CSRD : prioriser les datapoints matériels parmi les ESRS 2026 (règlement délégué (UE) 2026/1563), qui réduisent d'environ 61 % les points obligatoires. Reporting volontaire selon la norme volontaire (VS, ex-VSME) : le socle est bien plus léger (modules Basic B1-B11). Pour chaque datapoint : équipe propriétaire, système source, fréquence, méthode de calcul.",
  },
  {
    num: "05",
    title: "Verrouiller la collecte Scope 1 & 2",
    body:
      "Scope 1 : factures gaz/fioul + carnet de maintenance + relevés. Scope 2 : factures électricité + attestations garanties d'origine si market-based. Réconciliation systématique factures vs déclaration site.",
  },
  {
    num: "06",
    title: "Structurer le Scope 3 par matérialité",
    body:
      "Méthode pragmatique : (a) estimer les 15 catégories en ratios monétaires, (b) identifier les 3-5 catégories matérielles, (c) raffiner uniquement celles-ci par collecte primaire fournisseurs, (d) documenter taux de couverture.",
  },
  {
    num: "07",
    title: "Définir la chaîne de responsabilité auditeur",
    body:
      "Chaque datapoint a un propriétaire métier, avec validation formelle par un valideur distinct (séparation des rôles). Workflow d'approbation tracé. Le vérificateur (commissaire aux comptes ou OTI inscrit à la H2A pour la CSRD) ou le destinataire d'un rapport selon la norme volontaire (banque, donneur d'ordre) vérifiera la séparation saisie/validation.",
  },
  {
    num: "08",
    title: "Choisir un outil avec audit trail cryptographique",
    body:
      "Journal en ajout seul chaîné par empreinte SHA-256 (toute modification devient détectable), lignée préservée, données stockées en UE, export PDF avec empreinte vérifiable incluant la justification méthodologique. L'empreinte prouve l'intégrité, pas l'exactitude ni l'exhaustivité : les rapprochements restent nécessaires. Un Excel partagé se défend mal en assurance limitée CSRD comme devant une revue exigeante.",
  },
  {
    num: "09",
    title: "Préparer la note méthodologique annexe",
    body:
      "Pour chaque KPI matériel : périmètre, sources, facteurs d'émission, hypothèses, incertitude. C'est le premier document que l'auditeur lira. Compter 30 à 60 pages selon couverture.",
  },
  {
    num: "10",
    title: "Programmer une pré-revue interne à T-3 mois",
    body:
      "Revue blanche avec un binôme externe (RSE + DAF ou consultant). Objectif : identifier les manques avant que l'auditeur ne les trouve. ROI évident vs le coût des réserves d'audit.",
  },
  {
    num: "11",
    title: "Cadrer le plan d'assurance avec l'auditeur en amont",
    body:
      "Réunion de cadrage formelle : périmètre d'assurance, méthode d'échantillonnage, accès systèmes, format de restitution. Un auditeur bien cadré est un auditeur moins coûteux.",
  },
  {
    num: "12",
    title: "Anticiper la communication externe",
    body:
      "Un rapport de durabilité solide qui passe la revue vaut mieux qu'un rapport ambitieux qui se fait recadrer. Aligner DAF, RSE, communication et relations investisseurs en amont.",
  },
];

export default function GuidePage() {
  return (
    <main className="bg-white min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />

      <div className="guide-toolbar border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-sm text-neutral-600 hover:text-neutral-900">
              ← Blog
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12 pb-8 border-b border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
            Guide pratique CarbonCo · Édition 2026
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
            CSRD &amp; VSME après l&apos;Omnibus.
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">
            Qui reste soumis à la CSRD, pourquoi la norme volontaire (VS, ex-VSME) devient le
            langage de la chaîne de valeur, et 12 points opérationnels pour produire un reporting
            auditable. Conçu pour les DAF et responsables ESG de PME et d&apos;ETI.
          </p>
          <div className="mt-6 flex items-center gap-4 text-xs text-neutral-500">
            <span>État du droit au 2 novembre 2026</span>
            <span>·</span>
            <span>20 minutes de lecture</span>
            <span>·</span>
            <span>Version imprimable</span>
          </div>
        </header>

        {/* Intro — contexte réglementaire (annexe A.1) */}
        <section className="mb-10">
          <p className="text-base text-neutral-800 leading-relaxed">
            Depuis le 18 mars 2026, la directive (UE) 2026/470 du 24 février 2026
            (« Omnibus I ») réserve la CSRD aux entreprises de plus de{" "}
            <strong>1 000 salariés et</strong> de plus de <strong>450 M€</strong> de chiffre
            d&apos;affaires net, deux critères cumulatifs : environ 90 % d&apos;entreprises en moins
            dans le champ, selon l&apos;ordre de grandeur cité par les cabinets. Les nouvelles
            entreprises concernées publieront en 2028 sur l&apos;exercice 2027. En France, la loi
            de transposition est en cours d&apos;examen (échéance : 19 mars 2027).
          </p>
          <p className="mt-3 text-base text-neutral-800 leading-relaxed">
            Pour toutes les autres, la pression change de canal : banques, assureurs et donneurs
            d&apos;ordre demandent des données ESG structurées. La <strong>norme volontaire</strong>{" "}
            (ex-VSME), adoptée par le règlement délégué (UE) 2026/1560 et en vigueur depuis le
            24 septembre 2026, devient leur langage commun ; à partir de l&apos;exercice 2027, un
            donneur d&apos;ordre soumis à la CSRD ne pourra plus exiger d&apos;une entreprise de
            1 000 salariés ou moins davantage que ses points « nécessaires », pour son propre
            rapport. Enfin, le <strong>BEGES</strong> reste obligatoire en France au-delà de
            500 salariés, et les entreprises qui sortent de la CSRD perdent la dispense prévue par
            la loi n° 2025-391 du 30 avril 2025 : leur bilan redevient dû tous les quatre ans.
          </p>
          <p className="mt-3 text-base text-neutral-800 leading-relaxed">
            Que vous restiez soumis à la CSRD ou que vous prépariez un rapport volontaire selon la
            norme VS, les 12 chantiers ci-dessous sont les plus structurants à verrouiller pour
            produire des chiffres opposables à un auditeur.
          </p>
          <aside className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">
              Mise à jour · 2 novembre 2026
            </p>
            <p className="text-sm text-neutral-800 leading-relaxed">
              La norme volontaire a été adoptée le 3 juillet 2026 (règlement délégué (UE)
              2026/1560, JOUE du 21 septembre 2026, en vigueur le 24 septembre 2026). Elle classe
              chaque point en « nécessaire », « nécessaire si applicable », « volontaire » ou
              « information sectorielle à considérer ». Le plafond de la chaîne de valeur
              s&apos;applique aux exercices ouverts à compter du 1er janvier 2027, pour la seule
              collecte faite au titre du reporting CSRD : les demandes d&apos;une banque, d&apos;un
              contrat ou du devoir de vigilance n&apos;en relèvent pas. Les ESRS 2026 (règlement
              délégué (UE) 2026/1563) entrent en vigueur le 10 novembre 2026.{" "}
              <Link href="/blog/vsme-devient-vs-2026" className="text-green-700 font-semibold hover:underline">
                Notre analyse détaillée →
              </Link>
            </p>
          </aside>
        </section>

        {/* 12 points */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-8">
            Les 12 points opérationnels
          </h2>
          <div className="space-y-8">
            {POINTS.map((p) => (
              <div key={p.num} className="grid grid-cols-[auto_1fr] gap-5">
                <div className="text-3xl font-extrabold tracking-tighter text-green-600">
                  {p.num}
                </div>
                <div>
                  <p className="font-bold text-lg text-neutral-900 mb-1">{p.title}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Récap */}
        <section className="mt-12 rounded-2xl bg-neutral-50 border border-neutral-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
            À retenir
          </p>
          <p className="text-base text-neutral-800 leading-relaxed">
            Sur ces 12 points, les trois leviers à plus haut ROI sont :{" "}
            <strong>double matérialité (3)</strong>, <strong>cartographie datapoints (4)</strong>,
            et <strong>chaîne d&apos;assurance (7-8)</strong>. Le reste s&apos;exécute mieux une fois
            ces trois sujets verrouillés.
          </p>
        </section>

        {/* Newsletter */}
        <section className="mt-12 guide-newsletter">
          <NewsletterForm source="guide-csrd-vsme-2026" />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            © CarbonCo 2026 · Édition gratuite, libre redistribution sans modification ·{" "}
            <a href="https://carbon-snowy-nine.vercel.app" className="text-green-700 hover:underline">
              carbon-snowy-nine.vercel.app
            </a>
          </p>
        </footer>
      </article>
    </main>
  );
}
