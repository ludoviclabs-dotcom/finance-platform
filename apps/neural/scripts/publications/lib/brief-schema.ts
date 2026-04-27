/**
 * NEURAL — Schema Zod du brief editorial YAML.
 *
 * Le brief est l'input du generateur d'articles. Il contient tout ce dont
 * Claude a besoin pour produire un MDX conforme : metadonnees (qui finissent
 * en frontmatter), plan, sources, contraintes editoriales.
 *
 * Le frontmatter MDX final est construit cote script a partir du brief
 * (voir mdx-writer.ts) — le LLM ne genere QUE le corps.
 */

import { z } from "zod";

const isoDateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format ISO (2026-04-27)."));

export const briefAuthorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1).optional(),
  bio: z.string().min(1),
  avatar: z.string().min(1).optional(),
});

export const briefSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
  quote: z.string().optional(),
});

export const briefPlanSectionSchema = z.object({
  section: z.string().min(1),
  points: z.array(z.string().min(1)).min(1),
});

export const briefSchema = z.object({
  // Identite
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug : lowercase, chiffres et tirets uniquement."),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  excerpt: z.string().min(1).optional(),

  // Cadrage editorial
  category: z.string().min(1),
  audience: z.string().min(1),
  date: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
  readingTime: z.string().min(1).default("8 min"),
  featured: z.boolean().default(false),

  // Auteur
  author: briefAuthorSchema,

  // Tags & TLDR
  tags: z.array(z.string().min(1)).default([]),
  tldr: z.array(z.string().min(1)).min(2).max(6),

  // Mise en avant visuelle
  coverImage: z.string().min(1).optional(),
  coverAlt: z.string().min(1).optional(),

  // Liens internes
  relatedSlugs: z.array(z.string().min(1)).default([]),

  // SEO
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),

  // Contraintes pour le LLM
  targetWordCount: z.number().int().min(400).max(4000).default(1500),
  styleGuide: z.string().min(1).default("Analytique, source, pragmatique. Pas de jargon vide."),
  constraints: z.array(z.string().min(1)).default([]),

  // Plan + sources
  plan: z.array(briefPlanSectionSchema).min(2),
  sources: z.array(briefSourceSchema).default([]),
});

export type Brief = z.infer<typeof briefSchema>;
export type BriefAuthor = z.infer<typeof briefAuthorSchema>;
export type BriefSource = z.infer<typeof briefSourceSchema>;
export type BriefPlanSection = z.infer<typeof briefPlanSectionSchema>;
