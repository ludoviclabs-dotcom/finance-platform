import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Agents IA pour l'assurance";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Secteur · Assurance",
    title: "Assurance : agents IA pour la souscription, le sinistre et la conformité.",
    subtitle:
      "IFRS17, supply chain, communication régulée — orchestration avec validation humaine et audit trail.",
    badge: "IFRS17 · Solvency",
    variant: "midnight",
  });
}
