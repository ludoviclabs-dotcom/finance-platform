/**
 * Landing SEO : "BEGES obligatoire" — bilan GES réglementaire français.
 *
 * Cible les requêtes "bilan carbone obligatoire entreprise", "BEGES 500 salariés",
 * "bilan GES réglementaire 2026". Le BEGES (art. L229-25 du code de l'environnement)
 * est un droit NATIONAL, indépendant de la CSRD et de l'Omnibus : c'est l'angle
 * différenciant de la page.
 *
 * Tous les faits réglementaires cités sont sourcés (décret n° 2022-982, arrêté du
 * 25/01/2022, loi Industrie verte du 23/10/2023) et re-vérifiés en juillet 2026.
 * Les capacités produit mentionnées reflètent le registre feature-status.json
 * (export-beges = beta) — aucune promesse au-delà.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "@/components/landing/newsletter-form";

export const metadata: Metadata = {
  title: "BEGES obligatoire 2026 : seuils, contenu, sanctions — le guide | CarbonCo",
  description:
    "Bilan GES réglementaire (BEGES) : obligatoire tous les 4 ans dès 500 salariés (250 en outre-mer), " +
    "postes indirects significatifs inclus, plan de transition exigé, jusqu'à 50 000 € d'amende. " +
    "Ce que dit vraiment la réglementation en 2026 — et en quoi elle ne dépend pas de la CSRD.",
  alternates: { canonical: "/bilan-carbone-beges" },
};

const KEY_FACTS = [
  { value: "≥ 500", label: "salariés en métropole (250 en outre-mer) : seuil d'assujettissement des entreprises" },
  { value: "4 ans", label: "périodicité maximale entre deux bilans déposés (3 ans pour les collectivités)" },
  { value: "50 000 €", label: "amende encourue en cas de manquement — 100 000 € en cas de récidive" },
  { value: "6 × 22", label: "catégories × postes de la nomenclature réglementaire v5 (arrêté du 25/01/2022)" },
];

const CHECKLIST = [
  {
    num: "01",
    title: "Vérifier votre assujettissement",
    body:
      "Effectif ≥ 500 ETP en France métropolitaine (≥ 250 dans les DROM) sur l'entité légale ou le groupe " +
      "d'établissements. Les collectivités de plus de 50 000 habitants et les établissements publics de plus " +
      "de 250 agents sont également concernés. Vérifiez la date de votre dernier dépôt sur bilans-ges.ademe.fr : " +
      "l'échéance suivante en découle.",
  },
  {
    num: "02",
    title: "Couvrir les 6 catégories de la nomenclature v5",
    body:
      "Depuis le décret n° 2022-982, le bilan ne se limite plus aux émissions directes (catégorie 1) et à " +
      "l'énergie (catégorie 2) : les postes significatifs d'émissions indirectes — transport, achats, produits " +
      "vendus — sont obligatoires pour les entités assujetties. Un BEGES « Scopes 1+2 seulement » n'est plus conforme.",
  },
  {
    num: "03",
    title: "Rédiger le plan de transition",
    body:
      "Le bilan doit être accompagné d'un plan de transition : actions engagées, moyens alloués, et résultats " +
      "obtenus depuis le bilan précédent. C'est une pièce exigée au dépôt, pas une option.",
  },
  {
    num: "04",
    title: "Déposer sur la plateforme ADEME",
    body:
      "Le dépôt s'effectue sur bilans-ges.ademe.fr (compte gratuit). Il n'existe pas d'API publique de dépôt : " +
      "la saisie est manuelle, d'où l'intérêt d'un export déjà ventilé selon la nomenclature 6 catégories / 22 postes.",
  },
  {
    num: "05",
    title: "Programmer l'échéance suivante",
    body:
      "La date du prochain bilan court à partir du dépôt (+ 4 ans maximum pour une entreprise). Une échéance " +
      "manquée expose à l'amende — et, depuis juin 2024, conditionne l'accès aux aides publiques de transition " +
      "écologique et énergétique.",
  },
];

const FAQ = [
  {
    q: "Le BEGES est-il supprimé ou allégé par la directive Omnibus ?",
    a: "Non. L'Omnibus (publiée au JOUE en février 2026) relève les seuils de la CSRD — plus de 1 000 salariés " +
      "et plus de 450 M€ de chiffre d'affaires — mais ne modifie en rien le BEGES, qui relève du droit national " +
      "français (article L229-25 du code de l'environnement). Une ETI sortie du champ CSRD peut parfaitement " +
      "rester assujettie au BEGES.",
  },
  {
    q: "Le Scope 3 est-il obligatoire dans le BEGES ?",
    a: "Oui, pour les postes significatifs. Depuis le décret n° 2022-982 (applicable aux bilans publiés depuis 2023), " +
      "les entités assujetties doivent couvrir leurs émissions indirectes significatives : transport, achats de biens " +
      "et services, utilisation des produits vendus… La nomenclature v5 organise l'ensemble en 6 catégories et 22 postes.",
  },
  {
    q: "Quelles sont les sanctions en cas de non-dépôt ?",
    a: "Depuis la loi Industrie verte du 23 octobre 2023, l'amende peut atteindre 50 000 € par manquement, et " +
      "100 000 € en cas de récidive. S'y ajoute une sanction indirecte : depuis le 1er juin 2024, le bénéfice de " +
      "certaines aides publiques à la transition est conditionné au dépôt d'un BEGES à jour.",
  },
  {
    q: "Quelle est la différence entre BEGES et « Bilan Carbone » ?",
    a: "Le BEGES est l'obligation réglementaire française. « Bilan Carbone® » est une marque déposée de " +
      "l'Association pour la transition Bas Carbone (ABC) désignant une méthodologie compatible. On peut " +
      "produire un BEGES conforme avec la méthodologie réglementaire (v5) et des facteurs d'émission publics " +
      "comme la Base Empreinte® de l'ADEME.",
  },
  {
    q: "Un BEGES volontaire a-t-il un intérêt sous les seuils ?",
    a: "Oui : banques, assureurs et donneurs d'ordre demandent de plus en plus un bilan GES structuré, quelle que " +
      "soit la taille. Un BEGES volontaire déposé sur la plateforme ADEME est un signal public vérifiable — et le " +
      "travail de collecte alimente directement un rapport VSME/VS ou les réponses aux questionnaires clients.",
  },
];

export default function BegesPage() {
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
            <Link href="/blog" className="text-sm text-neutral-600 hover:text-neutral-900">
              Blog
            </Link>
            <Link href="/guide-csrd-vsme-2026" className="text-sm text-neutral-600 hover:text-neutral-900">
              Guide CSRD &amp; VSME
            </Link>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-10 pb-8 border-b border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
            Réglementation France · Mise à jour juillet 2026
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
            BEGES : le bilan GES obligatoire, expliqué sans détour.
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">
            Qui est concerné, ce que le bilan doit contenir depuis 2023, ce que vous risquez,
            et pourquoi la directive Omnibus n&apos;y change strictement rien. Pour les DAF,
            responsables RSE et dirigeants d&apos;entreprises de 250 à 5 000 salariés.
          </p>
        </header>

        {/* Chiffres clés */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {KEY_FACTS.map((f) => (
            <div key={f.value} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-2xl font-extrabold tracking-tight text-green-700">{f.value}</p>
              <p className="mt-1 text-xs text-neutral-600 leading-snug">{f.label}</p>
            </div>
          ))}
        </section>

        {/* Corps */}
        <section className="space-y-5 text-neutral-800 leading-relaxed">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900">
            Une obligation française, indépendante de la CSRD
          </h2>
          <p>
            Le bilan d&apos;émissions de gaz à effet de serre (<strong>BEGES</strong>) est prévu par
            l&apos;article L229-25 du code de l&apos;environnement. Il s&apos;impose tous les
            <strong> 4 ans</strong> aux entreprises de plus de <strong>500 salariés</strong> en
            métropole (<strong>250</strong> dans les départements et régions d&apos;outre-mer), tous
            les 3 ans aux collectivités de plus de 50 000 habitants et aux établissements publics de
            plus de 250 agents.
          </p>
          <p>
            C&apos;est un point que le marché confond en permanence : la directive Omnibus a réduit le
            champ de la CSRD aux entreprises de plus de 1 000 salariés et 450 M€ de chiffre
            d&apos;affaires — mais le BEGES est du <strong>droit national</strong>. Sortir du champ de
            la CSRD ne dispense de rien côté ADEME.
          </p>

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 pt-4">
            Ce que le bilan doit contenir depuis 2023
          </h2>
          <p>
            La réforme de 2022 (décret n° 2022-982 et arrêté du 25 janvier 2022) a durci le contenu :
          </p>
          <ul className="space-y-2 ml-5 list-disc marker:text-green-600">
            <li>
              <strong>Nomenclature v5</strong> : 6 catégories d&apos;émissions détaillées en 22 postes,
              qui remplacent l&apos;ancien découpage en 3 scopes.
            </li>
            <li>
              <strong>Émissions indirectes significatives obligatoires</strong> : transport, achats,
              produits vendus… Un bilan limité aux Scopes 1 et 2 n&apos;est plus conforme pour les
              entités assujetties.
            </li>
            <li>
              <strong>Plan de transition</strong> exigé au dépôt : actions, moyens, et résultats
              obtenus depuis le bilan précédent.
            </li>
            <li>
              <strong>Dépôt public</strong> sur la plateforme ADEME{" "}
              <a
                href="https://bilans-ges.ademe.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 hover:underline"
              >
                bilans-ges.ademe.fr
              </a>{" "}
              — consultable par n&apos;importe qui, y compris vos clients et candidats.
            </li>
          </ul>

          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 pt-4">
            Sanctions : × 5 depuis la loi Industrie verte
          </h2>
          <p>
            La loi Industrie verte du 23 octobre 2023 a multiplié les sanctions par cinq :
            jusqu&apos;à <strong>50 000 €</strong> d&apos;amende par manquement, <strong>100 000 €</strong> en
            récidive. Et depuis le 1er juin 2024, l&apos;accès à certaines aides publiques de transition
            écologique et énergétique est <strong>conditionné</strong> à un BEGES à jour — une sanction
            économique souvent plus lourde que l&apos;amende elle-même.
          </p>
        </section>

        {/* Checklist */}
        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-8">
            Mise en conformité en 5 étapes
          </h2>
          <div className="space-y-8">
            {CHECKLIST.map((p) => (
              <div key={p.num} className="grid grid-cols-[auto_1fr] gap-5">
                <div className="text-3xl font-extrabold tracking-tighter text-green-600">{p.num}</div>
                <div>
                  <p className="font-bold text-lg text-neutral-900 mb-1">{p.title}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Encart produit — capacités réelles uniquement (registre : export-beges = beta) */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
            Ce que CarbonCo automatise (beta)
          </p>
          <ul className="space-y-2 text-sm text-neutral-800 leading-relaxed ml-5 list-disc marker:text-green-600">
            <li>
              Ventilation automatique de vos émissions GHG Protocol vers la nomenclature
              <strong> BEGES v5 (6 catégories / 22 postes)</strong>, avec réconciliation garantie :
              total BEGES = total GHG.
            </li>
            <li>
              Export <strong>PDF + annexe Excel</strong> déterministes avec note méthodologique,
              prêts pour la saisie sur bilans-ges.ademe.fr (checklist de dépôt incluse).
            </li>
            <li>
              Suivi de vos bilans déposés et de la <strong>prochaine échéance (+ 4 ans)</strong>,
              avec rappel automatique en amont.
            </li>
            <li>
              Plan de transition adossé à vos leviers de réduction chiffrés (courbe de coût
              d&apos;abattement, statuts journalisés).
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Voir le module BEGES
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
          <NewsletterForm source="bilan-carbone-beges" />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            Références : art. L229-25 du code de l&apos;environnement · décret n° 2022-982 du
            1er juillet 2022 · arrêté du 25 janvier 2022 (méthodologie v5) · loi n° 2023-973 du
            23 octobre 2023 relative à l&apos;industrie verte. Cette page est informative et ne
            constitue pas un conseil juridique.
          </p>
        </footer>
      </article>
    </main>
  );
}
