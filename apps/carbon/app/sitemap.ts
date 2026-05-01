import type { MetadataRoute } from "next";
import { BLOG_ARTICLES } from "@/lib/blog-articles";
import { PRODUCT_MODULES } from "@/lib/product-modules";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://carbonco.fr";
  const now = new Date();

  // —— Pages publiques principales ——
  const corePages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/produit`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/integrations`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${baseUrl}/blog`, changeFrequency: "weekly", priority: 0.85 },
    { url: `${baseUrl}/aide`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/brochure`, changeFrequency: "monthly", priority: 0.75 },
    { url: `${baseUrl}/guide-csrd-2027`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${baseUrl}/dev`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/couverture`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/etat-du-produit`, changeFrequency: "weekly", priority: 0.65 },
    { url: `${baseUrl}/value-mapping-esg`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/login`, changeFrequency: "yearly", priority: 0.4 },
  ];

  // —— Articles de blog ——
  const blogPages: MetadataRoute.Sitemap = BLOG_ARTICLES.map((a) => ({
    url: `${baseUrl}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // —— Pages produit par module ——
  const productPages: MetadataRoute.Sitemap = PRODUCT_MODULES.map((m) => ({
    url: `${baseUrl}/produit/${m.slug}`,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  // —— Pages légales ——
  const legalPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/cgu`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/mentions-legales`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [...corePages, ...blogPages, ...productPages, ...legalPages].map((entry) => ({
    lastModified: now,
    ...entry,
  }));
}
