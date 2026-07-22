/**
 * MethodologyDisclaimer — bandeau rappelant que l'indice d'exposition ressources
 * est une méthode CarbonCo versionnée, PAS une notation officielle de l'Union
 * européenne (Module 2, PR-M2C).
 *
 * Affiché partout où l'indice global apparaît (fiche, assessments, méthodologie)
 * pour qu'aucun écran ne laisse croire à un score réglementaire. Le texte par
 * défaut est le miroir EXACT de `scoring.py::DISCLAIMER` (backend).
 */

import { RESOURCE_DISCLAIMER } from "@/lib/api/resources";

export function MethodologyDisclaimer({
  text,
  className = "",
  compact = false,
}: {
  text?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="note"
      aria-label="Avertissement méthodologique"
      data-testid="resource-methodology-disclaimer"
      className={`rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-300 ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide">
        Méthode CarbonCo — non officielle
      </p>
      {!compact && <p className="mt-1 text-xs leading-relaxed">{text ?? RESOURCE_DISCLAIMER}</p>}
    </div>
  );
}

export default MethodologyDisclaimer;
