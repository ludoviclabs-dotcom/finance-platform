import type { Metadata } from "next";

import { PublicationsExplorer } from "@/components/publications/publications-explorer";
import { getAllPublications } from "@/lib/publications";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Publications",
  description:
    "Le hub éditorial NEURAL : benchmarks, guides, retours terrain et perspectives sur l'IA en entreprise.",
  alternates: {
    canonical: `${SITE_URL}/publications`,
  },
  openGraph: {
    title: "Publications | NEURAL",
    description:
      "Benchmarks, guides, retours terrain et perspectives sur l'IA en entreprise.",
    url: `${SITE_URL}/publications`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Publications | NEURAL",
    description:
      "Benchmarks, guides, retours terrain et perspectives sur l'IA en entreprise.",
  },
};

export default async function PublicationsPage() {
  const publications = await getAllPublications();

  return <PublicationsExplorer publications={publications} />;
}
