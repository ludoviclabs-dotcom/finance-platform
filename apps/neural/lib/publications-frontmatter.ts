import { cache } from "react";
import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { formatPublicationDate, formatPublicationMonth } from "@/lib/publication-ui";
import {
  publicationFrontmatterSchema,
  type PublicationSummary,
} from "@/lib/publications-contract";
import { SITE_URL } from "@/lib/site-config";

const PUBLICATIONS_DIR = path.join(process.cwd(), "content", "publications");

function buildSummary(slug: string, raw: Record<string, unknown>): PublicationSummary {
  const parsed = publicationFrontmatterSchema.parse({
    ...raw,
    slug: typeof raw.slug === "string" && raw.slug.length > 0 ? raw.slug : slug,
  });

  return {
    ...parsed,
    displayDate: formatPublicationDate(parsed.date),
    displayMonth: formatPublicationMonth(parsed.date),
    displayUpdatedAt: formatPublicationDate(parsed.updatedAt),
    url: `${SITE_URL}/publications/${parsed.slug}`,
  };
}

export const readPublicationFrontmatter = cache(async (slug: string): Promise<PublicationSummary | null> => {
  const fileName = `${slug}.mdx`;
  const filePath = path.join(PUBLICATIONS_DIR, fileName);

  try {
    const source = await fs.readFile(filePath, "utf8");
    const { data } = matter(source);
    return buildSummary(slug, data);
  } catch {
    return null;
  }
});
