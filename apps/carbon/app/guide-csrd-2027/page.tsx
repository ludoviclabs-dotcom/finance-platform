/**
 * Lead magnet : "Préparer son audit CSRD 2027 — guide pratique en 12 points"
 *
 * Le guide est délibérément servi en HTML imprimable plutôt qu'en PDF binaire :
 *   - Indexable Google (SEO long-tail "préparer audit CSRD")
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
  title: "Guide pratique CSRD 2027 — checklist en 12 points | CarbonCo",
  description:
    "Le guide pratique CarbonCo pour préparer son audit CSRD 2027 : périmètre, gouvernance, " +
    "double matérialité, datapoints, OTI, calendrier. 12 points à verrouiller dès maintenant.",
  alternates: { canonical: "https://carbonco.fr/guide-csrd-2027" },
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
      "Pour une ETI typique, 250 à 400 datapoints opérationnels (sur les 1 100 ESRS au total). Pour chaque datapoint : équipe propriétaire, système source, fréquence de mise à jour, méthode de calcul.",
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
    title: "Définir la chaîne de responsabilité OTI",
    body:
      "Chaque datapoint a un propriétaire métier, avec validation formelle par un valideur distinct (séparation des rôles). Workflow d'approbation tracé. L'auditeur vérifiera la séparation saisie/validation.",
  },
  {
    num: "08",
    title: "Choisir un outil avec audit trail cryptographique",
    body:
      "Hash SHA-256 chaîné, lignée préservée, hébergement UE, export PDF signé incluant la justification méthodologique. Un Excel partagé ne passe plus l'assurance limitée 2027.",
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
    title: "Cadrer le plan d'assurance avec l'OTI à T-6 mois",
    body:
      "Réunion de cadrage formelle : périmètre d'assurance, méthode d'échantillonnage, accès systèmes, format de restitution. Un OTI bien cadré est un OTI moins coûteux.",
  },
  {
    num: "12",
    title: "Anticiper la communication externe",
    body:
      "Le rapport CSRD est public. Aligner DAF, RSE, communication et relations investisseurs en amont. Un rapport solide qui passe l'assurance limitée vaut mieux qu'un rapport ambitieux qui se fait recadrer en réserve.",
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
            Préparer son audit CSRD 2027.
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">
            12 points à verrouiller dès maintenant pour que la première vague d&apos;assurance
            limitée se passe sans réserve. Conçu pour les DAF et responsables ESG d&apos;ETI.
          </p>
          <div className="mt-6 flex items-center gap-4 text-xs text-neutral-500">
            <span>Avril 2026</span>
            <span>·</span>
            <span>20 minutes de lecture</span>
            <span>·</span>
            <span>Version imprimable</span>
          </div>
        </header>

        {/* Intro */}
        <section className="mb-10">
          <p className="text-base text-neutral-800 leading-relaxed">
            La directive CSRD impose à plus de 50 000 entreprises européennes de publier un
            rapport de durabilité aussi rigoureux que leurs comptes financiers, soumis à
            assurance limitée par un OTI (Organisme Tiers Indépendant). Pour les ETI françaises
            (vague 2), le premier exercice à reporter est <strong>2026</strong>, avec
            publication et audit en 2027.
          </p>
          <p className="mt-3 text-base text-neutral-800 leading-relaxed">
            Ce guide n&apos;est ni théorique ni exhaustif : il liste les 12 chantiers
            opérationnels les plus structurants à verrouiller dès maintenant pour ne pas
            découvrir les manques en cours d&apos;audit.
          </p>
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
            Sur ces 12 points, les trois leviers à plus haut ROI sur 2026 sont :{" "}
            <strong>double matérialité (3)</strong>, <strong>cartographie datapoints (4)</strong>,
            et <strong>chaîne OTI (7-8)</strong>. Le reste s&apos;exécute mieux une fois ces
            trois sujets verrouillés.
          </p>
        </section>

        {/* Newsletter */}
        <section className="mt-12 guide-newsletter">
          <NewsletterForm source="guide-csrd-2027" />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            © CarbonCo 2026 · Édition gratuite, libre redistribution sans modification ·{" "}
            <a href="https://carbonco.fr" className="text-green-700 hover:underline">
              carbonco.fr
            </a>
          </p>
        </footer>
      </article>
    </main>
  );
}
