import type { MetadataRoute } from "next";

import { getAllPublications } from "@/lib/publications";
import { SITE_URL } from "@/lib/site-config";
import { AGENT_ENTRIES, BRANCH_ENTRIES, SECTOR_ENTRIES } from "@/lib/public-catalog";

import recipesData from "@/content/recipes/catalog.json";
import glossaireData from "@/content/glossaire/terms.json";
import changelog from "@/content/changelog.json";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const now = new Date();
  const publications = await getAllPublications();

  const entries: MetadataRoute.Sitemap = [];

  // ── Core pages ────────────────────────────────────────────
  const corePages: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["", "weekly", 1.0],
    ["about", "monthly", 0.5],
    ["contact", "weekly", 0.8],
    ["publications", "weekly", 0.8],
    ["solutions", "weekly", 0.7],
    ["forfaits", "monthly", 0.6],
  ];
  for (const [path, freq, priority] of corePages) {
    entries.push({
      url: `${baseUrl}${path ? `/${path}` : ""}`,
      lastModified: now,
      changeFrequency: freq,
      priority,
    });
  }

  // ── Trust & ops ───────────────────────────────────────────
  const transparencePages: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
    ["trust", "weekly", 0.9],
    ["trust/agent-safety", "weekly", 0.8],
    ["trust/agent-safety/deck", "monthly", 0.5],
    ["status", "daily", 0.7],
    ["roadmap", "weekly", 0.7],
    ["changelog", "weekly", 0.7],
    ["operator-gateway", "weekly", 0.8],
    ["connecteurs", "weekly", 0.7],
    ["docs", "weekly", 0.7],
    ["dev", "weekly", 0.6],
    ["dev/webhooks", "weekly", 0.6],
    ["dev/embed", "monthly", 0.5],
    ["temoignages", "weekly", 0.6],
    ["presse", "monthly", 0.5],
  ];
  for (const [path, freq, priority] of transparencePages) {
    entries.push({
      url: `${baseUrl}/${path}`,
      lastModified: now,
      changeFrequency: freq,
      priority,
    });
  }

  // ── Conformité ────────────────────────────────────────────
  const conformite = ["", "ai-act", "dora", "csrd", "rgpd-agents"];
  for (const slug of conformite) {
    entries.push({
      url: `${baseUrl}/conformite${slug ? `/${slug}` : ""}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: slug ? 0.7 : 0.8,
    });
  }

  // ── Comparateurs ──────────────────────────────────────────
  const contre = ["", "tray-ai", "workato", "n8n", "make"];
  for (const slug of contre) {
    entries.push({
      url: `${baseUrl}/contre${slug ? `/${slug}` : ""}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: slug ? 0.6 : 0.7,
    });
  }

  // ── Outils ────────────────────────────────────────────────
  const outils = [
    "",
    "ai-act-classifier",
    "roi",
    "maturite",
    "operator-score",
    "empreinte-ia",
    "dpia",
  ];
  for (const slug of outils) {
    entries.push({
      url: `${baseUrl}/outils${slug ? `/${slug}` : ""}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // ── Cas-types ────────────────────────────────────────────
  const casTypes = ["", "banque-dora", "luxe-csrd", "aero-easa"];
  for (const slug of casTypes) {
    entries.push({
      url: `${baseUrl}/cas-types${slug ? `/${slug}` : ""}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: slug ? 0.6 : 0.7,
    });
  }

  // ── Sandbox ──────────────────────────────────────────────
  entries.push(
    { url: `${baseUrl}/sandbox`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/sandbox/idp`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  );

  // ── Recipes ──────────────────────────────────────────────
  entries.push({
    url: `${baseUrl}/recipes`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  });
  for (const recipe of recipesData.recipes) {
    entries.push({
      url: `${baseUrl}/recipes/${recipe.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // ── Documentation ────────────────────────────────────────
  const docs = ["getting-started", "agents-architecture", "mcp-protocol", "audit-trail"];
  for (const slug of docs) {
    entries.push({
      url: `${baseUrl}/docs/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // ── Glossaire ────────────────────────────────────────────
  entries.push({
    url: `${baseUrl}/glossaire`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  });
  for (const term of glossaireData.terms) {
    entries.push({
      url: `${baseUrl}/glossaire/${term.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  // ── Catalogue agents ─────────────────────────────────────
  entries.push({
    url: `${baseUrl}/agents`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  });
  for (const agent of AGENT_ENTRIES) {
    entries.push({
      url: `${baseUrl}${agent.href}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: agent.status === "live" ? 0.7 : 0.6,
    });
  }

  // ── Secteurs ─────────────────────────────────────────────
  for (const sector of SECTOR_ENTRIES) {
    if (sector.status === "planned") continue;
    entries.push({
      url: `${baseUrl}${sector.href}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }
  // Sub-pages secteurs (existantes)
  const sectorSubpages = [
    "secteurs/luxe/finance",
    "secteurs/luxe/rh",
    "secteurs/luxe/communication",
    "secteurs/aeronautique/marketing",
    "secteurs/banque/communication",
    "secteurs/banque/marketing",
    "secteurs/banque/communication/dashboard",
    "secteurs/assurance/supply-chain",
    "secteurs/assurance/marketing",
  ];
  for (const path of sectorSubpages) {
    entries.push({
      url: `${baseUrl}/${path}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  // ── Branches solutions ───────────────────────────────────
  for (const branch of BRANCH_ENTRIES) {
    if (branch.status === "planned") continue;
    entries.push({
      url: `${baseUrl}${branch.href}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // ── Publications ─────────────────────────────────────────
  for (const publication of publications) {
    entries.push({
      url: `${baseUrl}/publications/${publication.slug}`,
      lastModified: new Date(`${publication.updatedAt}T12:00:00.000Z`),
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // ── Legal ────────────────────────────────────────────────
  entries.push(
    {
      url: `${baseUrl}/legal`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/confidentialite`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  );

  // Suppress unused warning for changelog import (used for last-modified inference)
  void changelog;

  return entries;
}
