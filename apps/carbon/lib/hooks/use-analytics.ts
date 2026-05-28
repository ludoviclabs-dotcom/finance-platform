/**
 * useAnalytics — wrapper minimal pour les événements d'engagement marketing.
 *
 * Implémentation : délégué à `@vercel/analytics`. Le hook expose une API
 * stable (`track`) appelée aux moments clés (clic CTA démo, soumission
 * newsletter, démarrage essai…). Les événements remontent dans le dashboard
 * Vercel Analytics du projet.
 *
 * Choix de design :
 *   - Retourne une fonction stable via useCallback pour ne pas réinstancier les
 *     handlers à chaque render.
 *   - En mode dev, on log aussi la trace en console pour diagnostiquer
 *     localement sans devoir attendre le tableau de bord Vercel.
 *
 * Exemples d'événements suggérés :
 *   track("demo_requested", { source: "hero" })
 *   track("trial_started", { source: "pricing_business" })
 *   track("contact_clicked", { source: "footer" })
 *   track("newsletter_subscribed", { source: "landing_footer" })
 */

"use client";

import { useCallback } from "react";
import { track as vercelTrack } from "@vercel/analytics";

export type AnalyticsEvent =
  | "demo_requested"
  | "trial_started"
  | "contact_clicked"
  | "newsletter_subscribed"
  | "pricing_viewed"
  | "brochure_opened"
  | "trust_link_clicked";

export interface AnalyticsProps {
  source?: string;
  plan?: string;
  destination?: string;
  [key: string]: string | number | boolean | undefined;
}

export function useAnalytics() {
  const track = useCallback((event: AnalyticsEvent, props?: AnalyticsProps) => {
    // Vercel Analytics filtre les undefined et accepte les primitives.
    // Cast safe : AnalyticsProps est compatible avec la signature attendue.
    vercelTrack(event, props as Record<string, string | number | boolean | null>);
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", event, props ?? {});
    }
  }, []);

  return { track };
}
