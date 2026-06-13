import type { Metadata } from "next";

import {
  featuresByStatus,
  lastUpdateLabel,
  type FeatureStatus,
} from "@/lib/feature-registry";

export const metadata: Metadata = {
  title: "État du produit — CarbonCo",
  description:
    "Ce que CarbonCo fait aujourd'hui, ce qui est en Beta et ce qui est planifié. Transparence totale sur les fonctionnalités disponibles.",
};

// Présentation par statut (couleurs, intitulé, sous-titre). Les DONNÉES (features)
// proviennent exclusivement du registre lib/feature-registry — aucun statut codé
// en dur ici.
const STATUS_META: Array<{
  status: FeatureStatus;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}> = [
  {
    status: "live",
    label: "🟢 Disponible aujourd'hui",
    subtitle: "Ces fonctionnalités sont en production et utilisables pour un rapport CSRD réel.",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    status: "beta",
    label: "🟡 Beta — En cours de stabilisation",
    subtitle: "Fonctionnels et accessibles, mais encore en validation. Des évolutions sont à prévoir.",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  {
    status: "planifie",
    label: "⚪ Planifié — Sur la roadmap",
    subtitle: "Ces fonctionnalités sont sur la roadmap mais pas encore développées. Aucune date garantie.",
    color: "text-neutral-500",
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    dot: "bg-neutral-300",
  },
];

export default function EtatDuProduitPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-neutral-950 text-white py-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Transparence produit</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-5">
            État du produit
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Pas de vaporware. Pas de fausses promesses. Voici exactement ce que CarbonCo fait aujourd&apos;hui,
            ce qui est en cours de stabilisation, et ce qui est sur la roadmap.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-8 md:px-16 py-16 space-y-16">
        {STATUS_META.map((section) => {
          const features = featuresByStatus(section.status);
          return (
            <div key={section.status}>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold mb-3 ${section.bg} ${section.border} ${section.color}`}>
                <span className={`w-2 h-2 rounded-full ${section.dot}`} />
                {section.label}
              </div>
              <p className="text-neutral-500 text-sm mb-8">{section.subtitle}</p>

              <div className="space-y-4">
                {features.map((feature) => (
                  <div key={feature.id} className={`p-5 rounded-xl border ${section.border} ${section.bg}`}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-bold text-black text-sm">{feature.label}</h3>
                      {feature.tag && (
                        <span className="text-xs font-semibold text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                          {feature.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer note */}
        <div className="pt-8 border-t border-neutral-200">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Cette page est mise à jour à chaque sprint (toutes les 2 semaines).
            Si une fonctionnalité que vous attendez n&apos;est pas dans la liste planifiée,{" "}
            <a href="mailto:ludoviclabs@gmail.com" className="text-emerald-600 hover:underline">
              contactez-nous
            </a>{" "}
            — les demandes clients remontent directement dans la priorisation de la roadmap.
          </p>
          <p className="text-xs text-neutral-300 mt-3">Dernière mise à jour : {lastUpdateLabel()}</p>
        </div>
      </div>
    </div>
  );
}
