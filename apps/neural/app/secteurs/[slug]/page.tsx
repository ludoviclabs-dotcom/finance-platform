import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { SECTORS_META, type Sector } from "@/lib/data/agents-registry";
import { getSectorEntry } from "@/lib/public-catalog";

export default async function SectorReadinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getSectorEntry(slug);

  if (!entry) {
    notFound();
  }

  // Le slug d'une SECTOR_ENTRY est une valeur de `Sector` (cf. buildSectorEntry).
  const coverageSector = slug in SECTORS_META ? (slug as Sector) : undefined;

  return <ReadinessPage entry={entry} eyebrow="Secteur" coverageSector={coverageSector} />;
}
