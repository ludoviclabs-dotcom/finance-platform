import { notFound, redirect } from "next/navigation";

import { isFeatureOn } from "@/lib/features";

export default async function ForfaitsCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  // Sprint P0 — masqué tant que le flag n'est pas activé.
  if (!isFeatureOn("forfaits")) notFound();

  const { slug } = await params;

  if (slug[0] === "simulateur") {
    redirect("/resources/outils/roi");
  }

  redirect("/forfaits");
}
