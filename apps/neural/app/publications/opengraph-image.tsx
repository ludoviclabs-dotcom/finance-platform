import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "Publications NEURAL — analyses sur l'IA en entreprise";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderNeuralOg({
    eyebrow: "Publications · NEURAL Labs",
    title: "Des analyses pensées pour clarifier les décisions.",
    subtitle:
      "Benchmarks, guides, retours terrain et perspectives sur l'IA en entreprise.",
    badge: "2 publications / mois",
    variant: "cream",
  });
}
