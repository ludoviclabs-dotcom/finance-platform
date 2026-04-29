import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Framework multi-secteurs pour agents métier";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "NEURAL · Operator IA",
    title: "Des agents IA spécialisés, déployés et auditables.",
    subtitle:
      "Framework multi-secteurs : 7 branches métier, 6 secteurs, orchestration et trace auditable.",
    badge: "ROI cadré · Audit trail",
    variant: "midnight",
  });
}
