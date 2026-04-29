import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Agents IA pour le transport";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Secteur · Transport",
    title: "Transport & logistique : agents IA pour la planification et l'exécution.",
    subtitle:
      "Prévision, supply chain, communication client temps réel — orchestration multi-systèmes.",
    badge: "Démo orchestrée",
    variant: "midnight",
  });
}
