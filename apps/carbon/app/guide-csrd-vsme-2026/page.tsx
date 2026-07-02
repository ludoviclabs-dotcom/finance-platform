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
    "Le guide pratique CarbonCo après la directive Omnibus : qui reste soumis à la CSRD, " +
    "pourquoi le standard volontaire VSME devient le langage de la chaîne de valeur, et 12 points " +
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
      "Conforme ESRS 1 §3 : 6 à 10 enjeux matériels priorisés, scoring justifié sur impact + financier, parties prenantes consultées (3 externes minimum), arbitrage gouvernance acté en COMEX ou comité ESG.",
  },
  {
    num: "04",
    title: "Cartographier les datapoints obligatoires",
    body:
      "Entité soumise à la CSRD : prioriser les datapoints matériels parmi le référentiel ESRS (réduit d'environ 60 % par l'Omnibus). Reporting VSME volontaire : le socle est bien plus léger (modules Basic B1-B11). Pour chaque datapoint : équipe propriétaire, système source, fréquence, méthode de calcul.",
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
      "Chaque datapoint a un propriétaire métier, avec validation formelle par un valideur distinct (séparation des rôles). Workflow d'approbation tracé. L'auditeur (OTI pour la CSRD, ou banque/donneur d'ordre pour le VSME) vérifiera la séparation saisie/validation.",
  },
  {
    num: "08",
    title: "Choisir un outil avec audit trail cryptographique",
    body:
      "Hash SHA-256 chaîné, lignée préservée, hébergement UE, export PDF signé incluant la justification méthodologique. Un Excel partagé ne passe ni l'assurance limitée CSRD ni une revue VSME exigeante.",
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
            Qui reste soumis à la CSRD, pourquoi le standard volontaire VSME devient le langage de
            la chaîne de valeur, et 12 points opérationnels pour produire un reporting auditable.
            Conçu pour les DAF et responsables ESG de PME et d&apos;ETI.
          </p>
          <div className="mt-6 flex items-center gap-4 text-xs text-neutral-500">
            <span>Juin 2026</span>
            <span>·</span>
            <span>20 minutes de lecture</span>
            <span>·</span>
            <span>Version imprimable</span>
          </div>
        </header>

        {/* Intro — contexte réglementaire (annexe A.1) */}
        <section className="mb-10">
          <p className="text-base text-neutral-800 leading-relaxed">
            Depuis la directive Omnibus (en vigueur depuis mars 2026), seules les entreprises de plus
            de <strong>1 000 salariés</strong> réalisant plus de <strong>450 M€</strong> de chiffre
            d&apos;affaires restent soumises à la CSRD — environ 10 000 entreprises dans l&apos;UE,
            avec de premiers rapports attendus en 2028 sur l&apos;exercice 2027.
          </p>
          <p className="mt-3 text-base text-neutral-800 leading-relaxed">
            Pour toutes les autres, la pression ne disparaît pas : elle change de canal. Banques,
            assureurs et donneurs d&apos;ordre exigent des données ESG structurées, et le standard
            volontaire <strong>VSME</strong> — dont l&apos;adoption par acte délégué est attendue à
            l&apos;été 2026 — devient le langage commun de la chaîne de valeur. En France, le bilan
            d&apos;émissions de GES (<strong>BEGES</strong>) reste par ailleurs obligatoire pour les
            entreprises de plus de 500 salariés.
          </p>
          <p className="mt-3 text-base text-neutral-800 leading-relaxed">
            Que vous restiez soumis à la CSRD ou que vous prépariez un rapport VSME volontaire, les
            12 chantiers ci-dessous sont les plus structurants à verrouiller pour produire des
            chiffres opposables à un auditeur.
          </p>
          <aside className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1">
              Mise à jour · juillet 2026
            </p>
            <p className="text-sm text-neutral-800 leading-relaxed">
              Le projet d&apos;acte délégué publié le 6 mai 2026 rebaptise le VSME en
              « <strong>VS</strong> » (Voluntary Standard), allège ses datapoints et rend opposable
              le « value chain cap » (aucun donneur d&apos;ordre ne peut exiger plus que ce standard
              d&apos;un fournisseur de moins de 1 000 salariés). Texte final attendu mi-juillet 2026,
              application aux exercices 2027 avec anticipation possible dès 2026.{" "}
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
