import { notFound, redirect } from "next/navigation";

import { ReadinessPage } from "@/components/site/readiness-page";
import { isFeatureOn } from "@/lib/features";
import { getResourceEntry } from "@/lib/public-catalog";

export default async function ResourcesCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;

  // /resources/blog/* reste un alias public vers /publications (zone live) — indépendant du flag.
  if (slug[0] === "blog") {
    if (slug[1]) {
      redirect(`/publications/${slug[1]}`);
    }

    redirect("/publications");
  }

  // Sprint P0 — tout le reste des ressources est masqué derrière le flag.
  if (!isFeatureOn("resources")) notFound();

  const entry = getResourceEntry(slug.join("/"));

  if (!entry) {
    notFound();
  }

  return <ReadinessPage entry={entry} eyebrow="Ressource" />;
}
