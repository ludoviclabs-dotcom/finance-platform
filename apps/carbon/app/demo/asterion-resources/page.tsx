import type { Metadata } from "next";

import { ResourcesDemoClient } from "@/components/demo/asterion/resources/resources-demo-client";

export const metadata: Metadata = {
  title: "Démo — Dépendances industrielles étendues (Asterion)",
  description:
    "Séquence de démonstration MODULE 2 : d'une ressource stratégique détectée à la décision humaine, risque et confiance séparés. 100 % fictif, zéro appel externe.",
  // Scène de démo, hors arborescence SEO publique.
  robots: { index: false, follow: false },
};

export default function AsterionResourcesDemoPage() {
  return <ResourcesDemoClient />;
}
