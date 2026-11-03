"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAnalytics, type AnalyticsEvent } from "@/lib/hooks/use-analytics";

/**
 * Lien qui émet un événement d'audience au clic (essai, démo, contact), avec
 * sa provenance : les mêmes événements que l'ancienne home, pour que
 * l'entonnoir reste comparable d'une version à l'autre. Le suivi lui-même
 * respecte le consentement (lib/hooks/use-analytics).
 */
export function TrackedLink({
  event,
  source,
  onClick,
  ...rest
}: ComponentProps<typeof Link> & { event: AnalyticsEvent; source: string }) {
  const { track } = useAnalytics();
  return (
    <Link
      {...rest}
      onClick={(e) => {
        track(event, { source });
        onClick?.(e);
      }}
    />
  );
}
