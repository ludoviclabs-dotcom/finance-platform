import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Agents IA pour le SaaS";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Secteur · SaaS",
    title: "SaaS : agents IA pour le support, l'onboarding, la rétention.",
    subtitle:
      "Industrialisation des cas d'usage à fort volume — sans casser la responsabilité humaine.",
    badge: "Support · CX",
    variant: "midnight",
  });
}
