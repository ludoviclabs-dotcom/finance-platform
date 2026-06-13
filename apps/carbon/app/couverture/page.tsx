import type { Metadata } from "next";

import {
  esrsRows,
  esrsCounts,
  lastUpdateLabel,
  type FeatureStatus,
} from "@/lib/feature-registry";

export const metadata: Metadata = {
  title: "Couverture ESRS — CarbonCo",
  description:
    "Ce que CarbonCo couvre vraiment : matrice complète des standards ESRS avec statut réel (Live / Beta / Planifié).",
};

// Présentation par statut. Les DONNÉES (lignes ESRS) proviennent exclusivement
// du registre lib/feature-registry — aucun statut codé en dur ici.
const STATUS_CONFIG: Record<FeatureStatus, { label: string; color: string; bg: string; dot: string }> = {
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
  planifie: {
    label: "Planifié",
    color: "text-neutral-500",
    bg: "bg-neutral-50 border-neutral-200",
    dot: "bg-neutral-300",
  },
};

function StatusBadge({ status }: { status: FeatureStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function CouverturePage() {
  const rows = esrsRows();
  const counts = esrsCounts();

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
              <strong className="text-white">{counts.planifie} standards</strong> planifiés
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
              {rows.map((row) => (
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
                    <StatusBadge status={row.statut} />
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
            Dernière mise à jour : {lastUpdateLabel()} · Facteurs d&apos;émission ADEME Base Empreinte® · Référentiel EFRAG 2024
          </p>
        </div>
      </div>
    </div>
  );
}
