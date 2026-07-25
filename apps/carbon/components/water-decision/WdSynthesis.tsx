/**
 * components/water-decision/WdSynthesis.tsx — panneau des six facettes
 * (Wave E-Interface, commit F2).
 *
 * Rend TOUJOURS les six facettes, quel que soit l'état de la requête. Aucune
 * branche ne remplace la grille par un bandeau global : un bandeau unique
 * « erreur » masquerait le fait que six questions distinctes sont restées sans
 * réponse, et un bandeau unique « chargé » masquerait celles qui, elles, n'ont
 * rien renvoyé.
 */

import { WdFacetCard } from "@/components/water-decision/WdStates";
import {
  FACET_ORDER,
  availabilitySentence,
  summariseAvailability,
  type WdFacetState,
} from "@/lib/water-decision/facets";
import type { WiFacetKind } from "@/lib/api/water-decision";

/**
 * Ligne d'état global.
 *
 * Compte des facettes, pas un score : aucune valeur métier n'y entre, et la
 * phrase le dit explicitement pour qu'on ne la lise pas comme un niveau de
 * risque agrégé.
 */
export function WdAvailabilityLine({
  states,
}: {
  states: Record<WiFacetKind, WdFacetState>;
}) {
  const availability = summariseAvailability(states);
  return (
    <p
      className="text-sm text-[var(--color-foreground-muted)]"
      data-testid="wd-availability"
      data-available={availability.available}
      data-empty={availability.empty}
      data-unavailable={availability.unavailable}
    >
      {availabilitySentence(availability)}
    </p>
  );
}

export function WdSynthesisPanel({
  states,
}: {
  states: Record<WiFacetKind, WdFacetState>;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      data-testid="wd-synthesis"
    >
      {FACET_ORDER.map((facet) => (
        <WdFacetCard key={facet} facet={facet} state={states[facet]} />
      ))}
    </div>
  );
}
