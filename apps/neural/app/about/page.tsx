import { ReadinessPage } from "@/components/site/readiness-page";
import { getPageEntry } from "@/lib/public-catalog";

export default function AboutPage() {
  const entry = getPageEntry("about");

  if (!entry) {
    return null;
  }

  return <ReadinessPage entry={entry} eyebrow="A propos" />;
}
