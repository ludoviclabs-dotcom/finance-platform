"use client";

/**
 * Vercel Web Analytics & Speed Insights, chargés UNIQUEMENT si :
 *   1. le drapeau d'environnement de l'outil vaut "1"
 *      (NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS / NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS) ;
 *   2. le visiteur a explicitement choisi « Tout accepter » dans la bannière.
 *
 * Par défaut rien n'est rendu (QA 2026-09-16, M-10 / m-08). La CNIL n'exempte
 * la mesure d'audience de consentement que sous conditions strictes : nous
 * retenons l'opt-in. Un retrait du consentement démonte les composants et, si
 * un script était déjà chargé, `beforeSend` écarte tout envoi ultérieur.
 */

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import {
  allowsAudienceMeasurement,
  dropWithoutConsent,
  MEASUREMENT_FLAGS,
  type MeasurementFlags,
} from "./consent-store";
import { useCookieConsent } from "./use-cookie-consent";

export function ConsentedAnalytics({
  flags = MEASUREMENT_FLAGS,
}: {
  /** Drapeaux résolus depuis l'environnement ; surchargeables pour les tests. */
  flags?: MeasurementFlags;
}) {
  const consent = useCookieConsent();
  const { analytics, speedInsights } = flags;

  if (!allowsAudienceMeasurement(consent) || (!analytics && !speedInsights)) {
    return null;
  }

  return (
    <>
      {analytics && <Analytics beforeSend={dropWithoutConsent} />}
      {speedInsights && <SpeedInsights beforeSend={dropWithoutConsent} />}
    </>
  );
}
