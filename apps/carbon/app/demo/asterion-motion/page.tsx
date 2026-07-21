import type { Metadata } from "next";

import { DemoShell } from "@/components/demo/asterion/demo-shell";

// Cockpit de démonstration produit « Asterion Motion » — route sœur de la démo
// cinématique /demo (qu'elle ne remplace pas). Hérite du layout plein écran
// sombre de app/demo/layout.tsx.
export const metadata: Metadata = {
  title: "Démo Asterion Motion — revue ESG augmentée | CarbonCo",
  description:
    "Parcours guidé 100% fictif : Scope 3, CRMA, Scope 2, eau/nature, IRO et revue IA citée sous contrôle humain. IA simulée, zéro appel externe.",
  robots: { index: false, follow: false },
};

export default function AsterionMotionDemoPage() {
  return <DemoShell />;
}
