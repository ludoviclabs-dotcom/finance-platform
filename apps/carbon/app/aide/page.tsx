import type { Metadata } from "next";
import { AideClient } from "./aide-client";

export const metadata: Metadata = {
  title: "Centre d'aide — CarbonCo",
  description:
    "Réponses aux questions courantes sur CarbonCo : démarrage, CSRD, sécurité, données, facturation, intégrations.",
  alternates: { canonical: "https://carbonco.fr/aide" },
};

export default function AidePage() {
  return <AideClient />;
}
