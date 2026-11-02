import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CarbonCo — Plateforme ESG & CSRD",
    short_name: "CarbonCo",
    description:
      "Structurez votre reporting ESRS, centralisez vos données extra-financières " +
      "et générez vos projets de rapport ESG, chaque chiffre relié à sa source. Données stockées en UE.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#059669",
    lang: "fr-FR",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
