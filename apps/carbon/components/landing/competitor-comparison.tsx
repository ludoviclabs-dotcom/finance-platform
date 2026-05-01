/**
 * Comparatif concurrents — matrice positionnement.
 *
 * Stratégie : ne pas dénigrer les acteurs établis (Workiva, Enablon) ni les
 * outils plus jeunes (Greenly, Sweep, Plan A). Mettre en avant ce qui distingue
 * objectivement CarbonCo : audit trail SHA-256 natif, tarification ETI, IA
 * sourcée ESRS, infrastructure UE, mise en route rapide.
 */

interface Row {
  feature: string;
  carbonco: "yes" | "partial" | "no";
  workiva: "yes" | "partial" | "no";
  enablon: "yes" | "partial" | "no";
  greenly: "yes" | "partial" | "no";
  hint?: string;
}

const ROWS: readonly Row[] = [
  { feature: "Couverture ESRS E1 prioritaire",          carbonco: "yes",     workiva: "yes",     enablon: "yes",     greenly: "yes" },
  { feature: "Audit trail signé SHA-256 (append-only)", carbonco: "yes",     workiva: "partial", enablon: "partial", greenly: "no" },
  { feature: "Copilote IA avec citations ESRS",         carbonco: "yes",     workiva: "no",      enablon: "no",      greenly: "partial" },
  { feature: "Hébergement & traitement IA UE",          carbonco: "yes",     workiva: "partial", enablon: "yes",     greenly: "partial" },
  { feature: "Mise en route < 3 semaines",              carbonco: "yes",     workiva: "no",      enablon: "no",      greenly: "yes" },
  { feature: "Tarif ETI lisible (à partir de 490 €)",    carbonco: "yes",     workiva: "no",      enablon: "no",      greenly: "partial", hint: "Workiva/Enablon : sur devis enterprise" },
  { feature: "Import Excel structuré (lignée préservée)", carbonco: "yes",   workiva: "yes",     enablon: "yes",     greenly: "partial" },
  { feature: "Export PDF prêt OTI signé",               carbonco: "yes",     workiva: "yes",     enablon: "yes",     greenly: "partial" },
];

const Yes = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-label="Oui" role="img" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);
const Partial = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-label="Partiel" role="img" stroke="#D97706" strokeWidth="3" strokeLinecap="round">
    <line x1="6" y1="12" x2="18" y2="12" />
  </svg>
);
const No = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-label="Non" role="img" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);
const cell = (v: "yes" | "partial" | "no") => (v === "yes" ? Yes : v === "partial" ? Partial : No);

interface ComparisonProps {
  className?: string;
}

export function CompetitorComparison({ className = "" }: ComparisonProps) {
  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-5 py-4 font-bold text-neutral-700">Critère</th>
              <th className="text-center px-3 py-4 font-bold text-green-700 bg-green-50">CarbonCo</th>
              <th className="text-center px-3 py-4 font-medium text-neutral-500">Workiva</th>
              <th className="text-center px-3 py-4 font-medium text-neutral-500">Enablon</th>
              <th className="text-center px-3 py-4 font-medium text-neutral-500">Greenly</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.feature} className="border-b border-neutral-100 last:border-b-0">
                <td className="px-5 py-3.5 text-neutral-800">
                  {r.feature}
                  {r.hint && <span className="block text-[11px] text-neutral-400 mt-0.5">{r.hint}</span>}
                </td>
                <td className="px-3 py-3.5 bg-green-50/40">
                  <div className="flex items-center justify-center">{cell(r.carbonco)}</div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-center">{cell(r.workiva)}</div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-center">{cell(r.enablon)}</div>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-center">{cell(r.greenly)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">{Yes} Disponible</span>
        <span className="inline-flex items-center gap-1.5">{Partial} Partiel / sur devis</span>
        <span className="inline-flex items-center gap-1.5">{No} Indisponible</span>
      </div>
      <p className="mt-3 text-center text-xs text-neutral-400 max-w-3xl mx-auto">
        Comparatif basé sur les fiches produit publiques au 28 avril 2026. Chaque outil a ses forces : ce tableau cible les critères les plus différenciants pour les ETI européennes en préparation CSRD.
      </p>
    </div>
  );
}
