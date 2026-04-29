import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "NEURAL — Agents IA pour le luxe";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Secteur · Luxe",
    title: "Maisons de luxe : IA spécialisée, ESG, traçabilité, voix de marque.",
    subtitle:
      "Inventaire augmenté, recrutement, comm institutionnelle — agents qui respectent la voix de la maison.",
    badge: "ESG · Traçabilité",
    variant: "midnight",
  });
}
