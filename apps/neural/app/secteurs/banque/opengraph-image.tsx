import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Agents IA pour la banque";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Secteur · Banque",
    title: "Des agents IA spécialisés pour la banque, déployables sous 90 jours.",
    subtitle:
      "Conformité, risque, communication client, IFRS17, multi-devises — orchestration auditable.",
    badge: "IFRS17 · IAS 21",
    variant: "midnight",
  });
}
