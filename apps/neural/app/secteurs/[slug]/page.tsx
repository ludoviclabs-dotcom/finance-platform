import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
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

  return <ReadinessPage entry={entry} eyebrow="Secteur" />;
}
