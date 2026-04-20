import { notFound } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { getAgentEntry } from "@/lib/public-catalog";

export default async function AgentReadinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getAgentEntry(slug);

  if (!entry) {
    notFound();
  }

  return <ReadinessPage entry={entry} eyebrow="Agent" />;
}
