import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Agents IA pour l'aéronautique";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Secteur · Aéronautique",
    title: "Aéronautique : agents IA pour la maintenance, la conformité, la documentation.",
    subtitle:
      "Cycles longs, contraintes réglementaires, traçabilité — orchestration avec audit trail intégré.",
    badge: "EASA · Documentation",
    variant: "midnight",
  });
}
