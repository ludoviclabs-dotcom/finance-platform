import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { isFeatureOn } from "@/lib/features";
import { getPageEntry } from "@/lib/public-catalog";

export default function MarketplacePage() {
  // Sprint P0 — masqué tant que le flag n'est pas activé.
  if (!isFeatureOn("marketplace")) notFound();

  const entry = getPageEntry("marketplace");
  if (!entry) return null;

  return <ReadinessPage entry={entry} eyebrow="Marketplace" />;
}
