import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Sécurité des agents IA";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Trust · Agent Safety",
    title: "La preuve, pas la promesse : sécurité des agents IA en production.",
    subtitle:
      "Validation humaine, audit trail, garde-fous métier, isolation des données — chaque action est traçable.",
    badge: "Audit trail · Validation humaine",
    variant: "midnight",
  });
}
