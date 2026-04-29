import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://carbonco.fr";
  const now = new Date();

  const publicRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/login`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/couverture`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/etat-du-produit`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/value-mapping-esg`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/cgu`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/mentions-legales`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return publicRoutes.map((entry) => ({ ...entry, lastModified: now }));
}
