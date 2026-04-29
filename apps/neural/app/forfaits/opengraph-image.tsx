import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Forfaits & tarification";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Forfaits NEURAL",
    title: "5 forfaits, du Starter à l'Enterprise — ROI cadré contractuellement.",
    subtitle:
      "AI Essentials, AI Accelerator, AI Transformation, AI at Scale, AI High Value — du PoC encadré au déploiement multi-pays.",
    badge: "Du Starter à l'Enterprise",
    variant: "cream",
  });
}
