import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { SECTORS_META } from "@/lib/data/agents-registry";
import { getBranchEntry } from "@/lib/public-catalog";

export default async function SolutionBranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sector?: keyof typeof SECTORS_META }>;
}) {
  const { slug } = await params;
  const { sector } = await searchParams;
  const entry = getBranchEntry(slug);

  if (!entry) {
    notFound();
  }

  const eyebrow =
    sector && sector in SECTORS_META
      ? `Solution · ${SECTORS_META[sector].label}`
      : "Solution";

  return <ReadinessPage entry={entry} eyebrow={eyebrow} />;
}
