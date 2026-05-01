import type { Metadata } from "next";
import { BrochureClient } from "./brochure-client";

export const metadata: Metadata = {
  title: "Brochure CarbonCo — Plateforme ESG & CSRD",
  description:
    "Brochure 8 pages présentant la plateforme CarbonCo : positionnement, fonctionnalités, sécurité, " +
    "tarifs, cas sectoriels, comparatif concurrents et roadmap.",
  alternates: { canonical: "https://carbonco.fr/brochure" },
};

export default function BrochurePage() {
  return <BrochureClient />;
}
