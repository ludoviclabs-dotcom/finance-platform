import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { isFeatureOn } from "@/lib/features";
import { getPageEntry } from "@/lib/public-catalog";

export default function ForfaitsPage() {
  // Sprint P0 — masqué tant que le flag n'est pas activé.
  if (!isFeatureOn("forfaits")) notFound();

  const entry = getPageEntry("forfaits");
  if (!entry) return null;

  return <ReadinessPage entry={entry} eyebrow="Forfaits" />;
}
