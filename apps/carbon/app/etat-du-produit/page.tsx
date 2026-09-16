import { CONTACT_EMAIL } from "@/lib/site-url";
import type { Metadata } from "next";
import Link from "next/link";

import {
  featuresByStatus,
  lastUpdateLabel,
  lastVerificationLabel,
  type FeatureStatus,
} from "@/lib/feature-registry";

export const metadata: Metadata = {
  title: "État du produit — CarbonCo",
  description:
    "Ce que CarbonCo fait aujourd'hui, ce qui est en cours de vérification, en Beta ou planifié. Statuts revus au dernier contrôle de disponibilité.",
};

// Présentation par statut (couleurs, intitulé, sous-titre). Les DONNÉES (features)
// proviennent exclusivement du registre lib/feature-registry — aucun statut codé
// en dur ici.
const STATUS_META: Array<{
  status: FeatureStatus;
  label: string;
  subtitle: string;
  /** Lien d'accompagnement optionnel sous le sous-titre. */
  link?: { href: string; label: string };
  color: string;
  bg: string;
  border: string;
  dot: string;
}> = [
  {
    status: "live",
    label: "🟢 Disponible aujourd'hui",
    subtitle:
      "Accessibles aujourd'hui en production : leur disponibilité a été confirmée lors du dernier contrôle.",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    // Statut neutre : ni « disponible » (non confirmé), ni incident déclaré.
    status: "verification",
    label: "⏳ En cours de vérification",
    subtitle:
      `Livrées dans le code, mais leur disponibilité en production n'a pas pu être confirmée lors du dernier contrôle (${lastVerificationLabel()}) : elles dépendent de l'API authentifiée ou d'une tâche planifiée quotidienne. Elles repasseront « Disponible » après une vérification concluante.`,
    link: { href: "/status", label: "Consulter l'état des services →" },
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
    dot: "bg-slate-400",
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
            ce qui attend une vérification en production, ce qui est en cours de stabilisation, et ce qui
            est sur la roadmap.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-8 md:px-16 py-16 space-y-16">
        {STATUS_META.map((section) => {
          const features = featuresByStatus(section.status);
          if (features.length === 0) return null;
          return (
            <div key={section.status}>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold mb-3 ${section.bg} ${section.border} ${section.color}`}>
                <span className={`w-2 h-2 rounded-full ${section.dot}`} />
                {section.label}
              </div>
              <p className={`text-neutral-500 text-sm ${section.link ? "mb-2" : "mb-8"}`}>{section.subtitle}</p>
              {section.link && (
                <Link
                  href={section.link.href}
                  className="inline-block mb-8 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  {section.link.label}
                </Link>
              )}

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
                    {feature.href && (
                      <Link
                        href={feature.href}
                        className="inline-block mt-3 text-sm font-semibold text-emerald-600 hover:underline"
                      >
                        Voir la page →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer note */}
        <div className="pt-8 border-t border-neutral-200">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Cette page reflète le registre des statuts produit, daté ci-dessous.
            Si une fonctionnalité que vous attendez n&apos;est pas dans la liste planifiée,{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-600 hover:underline">
              contactez-nous
            </a>{" "}
            — les demandes clients remontent directement dans la priorisation de la roadmap.
          </p>
          <p className="text-xs text-neutral-500 mt-3">
            Dernière mise à jour : {lastUpdateLabel()} · Dernière vérification des statuts :{" "}
            {lastVerificationLabel()}
          </p>
        </div>
      </div>
    </div>
  );
}
