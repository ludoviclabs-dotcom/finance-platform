import type { ReactNode } from "react";

import { z } from "zod";

const isoDateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date like 2026-04-20."));

export const publicationAuthorSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1).optional(),
  bio: z.string().min(1),
  avatar: z.string().min(1).optional(),
});

export const publicationFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  excerpt: z.string().min(1),
  category: z.string().min(1),
  audience: z.string().min(1),
  date: isoDateSchema,
  updatedAt: isoDateSchema,
  readingTime: z.string().min(1),
  featured: z.boolean().default(false),
  author: publicationAuthorSchema,
  tags: z.array(z.string()).default([]),
  coverImage: z.string().min(1).optional(),
  coverAlt: z.string().min(1).optional(),
  tldr: z.array(z.string()).default([]),
  relatedSlugs: z.array(z.string()).default([]),
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
});

export type PublicationAuthor = z.infer<typeof publicationAuthorSchema>;
export type PublicationFrontmatter = z.infer<typeof publicationFrontmatterSchema>;

export interface PublicationHeading {
  level: 2 | 3;
  slug: string;
  title: string;
}

export interface PublicationSummary extends PublicationFrontmatter {
  displayDate: string;
  displayMonth: string;
  displayUpdatedAt: string;
  url: string;
}

export interface Publication extends PublicationSummary {
  content: ReactNode;
  headings: PublicationHeading[];
}
