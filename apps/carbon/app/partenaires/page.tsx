/**
 * Page publique /partenaires — programme partenaire experts-comptables (T7.5).
 *
 * Les cabinets EC sont le premier point de contact ESG des PME françaises.
 * Positionnement STRICTEMENT honnête (garde-fous du plan d'action) :
 *   - ce qui existe aujourd'hui : équiper chaque dossier client organisation
 *     par organisation (multi-utilisateurs, exports auditables, VSME, BEGES)
 *   - ce qui est en construction : l'espace multi-dossiers unifié (statut
 *     `planifie` au registre feature-status) — présenté comme tel
 *   - AUCUNE grille tarifaire inventée : programme pilote sur candidature
 *     (la tarification partenaire est une décision humaine non actée).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PartnerApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Partenaires experts-comptables — programme pilote | CarbonCo",
  description:
    "Cabinets d'expertise comptable : équipez vos dossiers clients d'un reporting ESG auditable " +
    "(VSME, BEGES, Scope 3) avec traçabilité jusqu'à la pièce. Programme partenaire pilote sur " +
    "candidature — espace multi-dossiers en construction.",
  alternates: { canonical: "/partenaires" },
};

const TODAY_ITEMS = [
  {
    title: "Un espace par dossier client",
    body: "Chaque client dispose de son organisation isolée (cloisonnement strict des données), avec vos collaborateurs invités par rôle : administrateur, analyste ou lecture seule. Chaque action est journalisée.",
  },
  {
    title: "Des livrables opposables",
    body: "Rapport VSME, export BEGES v5 prêt pour bilans-ges.ademe.fr, screening Scope 3 depuis le FEC — chaque chiffre est traçable jusqu'à sa source et chaque export est vérifiable publiquement par hash, sans outil propriétaire.",
  },
  {
    title: "Le FEC comme point d'entrée",
    body: "Vous avez déjà la donnée qui compte : le FEC. CarbonCo le transforme en pré-screening Scope 3 monétaire (mapping PCG → catégories GHG, ratios ADEME), avec écran de revue systématique avant toute intégration.",
  },
  {
    title: "Un accès revue pour l'auditeur",
    body: "Lien lecture seule, expirant et révocable, permettant à un OTI ou à un confrère de remonter d'un indicateur à la cellule source et à la pièce justificative en trois clics.",
  },
];

const ROADMAP_ITEMS = [
  "Espace cabinet unifié : tous vos dossiers derrière une seule connexion, avec bascule en un clic",
  "Export groupé : les rapports de tous vos clients pour une période donnée en un seul téléchargement",
  "Co-branding : votre logo sur les exports PDF remis à vos clients",
];

export default function PartenairesPage() {
  return (
    <main className="bg-white min-h-screen">
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
            <Link href="/etat-du-produit" className="text-sm text-neutral-600 hover:text-neutral-900">
              État du produit
            </Link>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-10 pb-8 border-b border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
            Programme partenaire · Experts-comptables
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
            Vos clients vous demandent déjà leur bilan GES. Répondez avec de l&apos;auditable.
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">
            BEGES obligatoire dès 500 salariés, questionnaires bancaires, standard volontaire
            VSME/VS attendu par les donneurs d&apos;ordre : la demande ESG arrive par votre
            cabinet. CarbonCo vous équipe avec ce qu&apos;un cabinet exige — de la traçabilité,
            pas des promesses.
          </p>
        </header>

        {/* Aujourd'hui */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-6">
            Ce que vous pouvez faire dès aujourd&apos;hui
          </h2>
          <div className="space-y-6">
            {TODAY_ITEMS.map((item) => (
              <div key={item.title}>
                <p className="font-bold text-lg text-neutral-900 mb-1">{item.title}</p>
                <p className="text-sm text-neutral-700 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* En construction — honnêteté structurelle */}
        <section className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
            En construction — priorisé avec les cabinets pilotes
          </p>
          <ul className="space-y-2 ml-5 list-disc marker:text-green-600 text-sm text-neutral-700 leading-relaxed">
            {ROADMAP_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-neutral-500">
            Statut exact et à jour de chaque fonctionnalité :{" "}
            <Link href="/etat-du-produit" className="text-green-700 hover:underline">
              /etat-du-produit
            </Link>
            . Nous n&apos;affichons jamais comme disponible ce qui ne l&apos;est pas.
          </p>
        </section>

        {/* Candidature */}
        <section id="candidature" className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-2">
            Candidater au programme pilote
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed mb-6">
            Nous ouvrons un nombre limité de places aux cabinets pour l&apos;exercice 2026 :
            accompagnement direct, conditions préférentielles définies ensemble, et priorité sur
            la feuille de route de l&apos;espace multi-dossiers. Réponse sous quelques jours
            ouvrés.
          </p>
          <PartnerApplyForm />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            Les données transmises via ce formulaire servent uniquement au traitement de votre
            candidature (voir <Link href="/confidentialite" className="hover:underline">politique de confidentialité</Link>).
          </p>
        </footer>
      </article>
    </main>
  );
}
