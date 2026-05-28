import type { Metadata } from "next";
import { AideClient } from "./aide-client";
import { JsonLd } from "@/components/seo/json-ld";
import { FAQ_ENTRIES } from "@/lib/faq-entries";

export const metadata: Metadata = {
  title: "Centre d'aide — CarbonCo",
  description:
    "Réponses aux questions courantes sur CarbonCo : démarrage, CSRD, sécurité, données, facturation, intégrations.",
  alternates: { canonical: "https://carbonco.fr/aide" },
};

// FAQPage schema — Rich Results Google.
// Réf : https://developers.google.com/search/docs/appearance/structured-data/faqpage
const FAQ_SCHEMA = {
  "@context": "https://schema.org" as const,
  "@type": "FAQPage" as const,
  mainEntity: FAQ_ENTRIES.map((entry) => ({
    "@type": "Question",
    name: entry.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: entry.answer,
    },
  })),
};

export default function AidePage() {
  return (
    <>
      <JsonLd data={FAQ_SCHEMA} />
      <AideClient />
    </>
  );
}
