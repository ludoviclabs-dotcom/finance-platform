import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { BRANCHES_META, SECTORS_META, type Branch } from "@/lib/data/agents-registry";
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

  // Le slug d'une BRANCH_ENTRY est une valeur de `Branch` (cf. buildBranchEntry).
  const coverageBranch = slug in BRANCHES_META ? (slug as Branch) : undefined;

  return <ReadinessPage entry={entry} eyebrow={eyebrow} coverageBranch={coverageBranch} />;
}
