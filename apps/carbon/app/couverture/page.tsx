import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Couverture ESRS — CarbonCo",
  description:
    "Ce que CarbonCo couvre vraiment : matrice complète des standards ESRS avec statut réel (Live / Beta / Planifié).",
};

type CoverageStatus = "live" | "beta" | "planned";

type EsrsRow = {
  id: string;
  name: string;
  description: string;
  status: CoverageStatus;
  exports: string[];
  note?: string;
};

const STATUS_CONFIG: Record<CoverageStatus, { label: string; color: string; bg: string; dot: string }> = {
  live: {
    label: "Live",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
  },
  beta: {
    label: "Beta",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-400",
  },
  planned: {
    label: "Planifié",
    color: "text-neutral-500",
    bg: "bg-neutral-50 border-neutral-200",
    dot: "bg-neutral-300",
  },
};

const ESRS_COVERAGE: EsrsRow[] = [
  {
    id: "ESRS 1",
    name: "Exigences générales",
    description: "Principes de reporting, périmètre, double matérialité, chaîne de valeur",
    status: "live",
    exports: ["PDF", "Excel"],
    note: "Couvre les exigences de présentation et de périmètre",
  },
  {
    id: "ESRS 2",
    name: "Informations générales",
    description: "Stratégie, gouvernance, matérialité, gestion des impacts risques et opportunités",
    status: "live",
    exports: ["PDF", "Excel"],
    note: "Questionnaire double matérialité intégré",
  },
  {
    id: "ESRS E1",
    name: "Changement climatique",
    description: "Atténuation, adaptation, énergie — Scope 1, 2 & 3, GHG Protocol, ADEME Base Empreinte®",
    status: "live",
    exports: ["PDF", "Excel", "Audit trail"],
    note: "Module principal — couverture la plus approfondie",
  },
  {
    id: "ESRS E2",
    name: "Pollution",
    description: "Pollution de l'air, de l'eau et des sols, substances préoccupantes",
    status: "beta",
    exports: ["PDF"],
    note: "Collecte de données disponible, calculs en cours de validation",
  },
  {
    id: "ESRS E3",
    name: "Eau & ressources marines",
    description: "Consommation d'eau, rejets, impact sur les écosystèmes aquatiques et marins",
    status: "planned",
    exports: [],
  },
  {
    id: "ESRS E4",
    name: "Biodiversité & écosystèmes",
    description: "Impacts, dépendances, zones sensibles, contribution à la perte de biodiversité",
    status: "planned",
    exports: [],
  },
  {
    id: "ESRS E5",
    name: "Utilisation des ressources",
    description: "Économie circulaire, flux de ressources, déchets, réparation et réutilisation",
    status: "planned",
    exports: [],
  },
  {
    id: "ESRS S1",
    name: "Effectifs propres",
    description: "Conditions de travail, santé-sécurité, égalité, rémunérations",
    status: "beta",
    exports: ["PDF"],
    note: "Formulaire de collecte disponible, scoring en développement",
  },
  {
    id: "ESRS S2",
    name: "Travailleurs chaîne de valeur",
    description: "Conditions de travail, droits fondamentaux, travail forcé dans la chaîne d'approvisionnement",
    status: "planned",
    exports: [],
  },
  {
    id: "ESRS S3",
    name: "Communautés affectées",
    description: "Droits des communautés riveraines, impact territorial, engagement parties prenantes",
    status: "planned",
    exports: [],
  },
  {
    id: "ESRS S4",
    name: "Consommateurs & utilisateurs",
    description: "Sécurité des produits, vie privée, inclusion, accessibilité",
    status: "planned",
    exports: [],
  },
  {
    id: "ESRS G1",
    name: "Conduite des affaires",
    description: "Éthique des affaires, corruption, lobbying, paiements aux pouvoirs publics",
    status: "live",
    exports: ["PDF"],
    note: "Questionnaire structuré + export rapport narratif",
  },
];

function StatusBadge({ status }: { status: CoverageStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function CouverturePage() {
  const counts = {
    live: ESRS_COVERAGE.filter((r) => r.status === "live").length,
    beta: ESRS_COVERAGE.filter((r) => r.status === "beta").length,
    planned: ESRS_COVERAGE.filter((r) => r.status === "planned").length,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-neutral-950 text-white py-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Transparence produit</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-5">
            Ce que CarbonCo couvre vraiment
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Nous préférons la clarté aux promesses vagues. Voici la matrice exacte de notre couverture ESRS,
            avec un statut honnête pour chaque standard.
          </p>
          <div className="flex flex-wrap gap-4 mt-10">
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <strong className="text-white">{counts.live} standards</strong> disponibles aujourd&apos;hui
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <strong className="text-white">{counts.beta} standards</strong> en Beta
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              <strong className="text-white">{counts.planned} standards</strong> planifiés
            </div>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="max-w-5xl mx-auto px-8 md:px-16 py-16">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-neutral-200">
                <th className="text-left py-3 pr-6 font-bold text-neutral-500 uppercase tracking-widest text-xs w-28">Standard</th>
                <th className="text-left py-3 pr-6 font-bold text-neutral-500 uppercase tracking-widest text-xs">Description</th>
                <th className="text-left py-3 pr-6 font-bold text-neutral-500 uppercase tracking-widest text-xs w-28">Statut</th>
                <th className="text-left py-3 font-bold text-neutral-500 uppercase tracking-widest text-xs w-40">Exports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {ESRS_COVERAGE.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-4 pr-6">
                    <span className="font-bold text-black">{row.id}</span>
                  </td>
                  <td className="py-4 pr-6">
                    <div className="font-semibold text-black mb-0.5">{row.name}</div>
                    <div className="text-neutral-500 text-xs leading-relaxed">{row.description}</div>
                    {row.note && (
                      <div className="mt-1 text-xs text-emerald-600 font-medium">{row.note}</div>
                    )}
                  </td>
                  <td className="py-4 pr-6">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-4">
                    {row.exports.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.exports.map((exp) => (
                          <span key={exp} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium">
                            {exp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Note de bas de page */}
        <div className="mt-12 p-6 bg-neutral-50 rounded-2xl border border-neutral-200">
          <h2 className="font-bold text-sm text-black mb-3">À propos de cette matrice</h2>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold mt-0.5">▸</span>
              <span><strong className="text-black">Live</strong> : collecte, calcul et export disponibles en production — utilisables pour un rapport CSRD réel.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 font-bold mt-0.5">▸</span>
              <span><strong className="text-black">Beta</strong> : fonctionnalité accessible mais en cours de validation — peut évoluer. Feedback utilisateurs bienvenus.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neutral-400 font-bold mt-0.5">▸</span>
              <span><strong className="text-black">Planifié</strong> : sur la roadmap — pas encore développé. Aucune date garantie.</span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-neutral-400">
            Dernière mise à jour : avril 2026 · Facteurs d&apos;émission ADEME Base Empreinte® · Référentiel EFRAG 2024
          </p>
        </div>
      </div>
    </div>
  );
}
