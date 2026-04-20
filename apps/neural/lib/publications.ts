import { cache } from "react";
import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { publicationMdxComponents } from "@/components/publications/mdx-components";
import { formatPublicationDate, formatPublicationMonth } from "@/lib/publication-ui";
import {
  publicationFrontmatterSchema,
  type Publication,
  type PublicationHeading,
  type PublicationSummary,
} from "@/lib/publications-contract";
import { SITE_URL } from "@/lib/site-config";

const PUBLICATIONS_DIR = path.join(process.cwd(), "content", "publications");

type PublicationSource = {
  body: string;
  summary: PublicationSummary;
};

function slugifyHeading(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeInlineText(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }

  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => normalizeInlineText(child)).join("");
  }

  return "";
}

function createHeadingPlugin(headings: PublicationHeading[]) {
  return () => (tree: unknown) => {
    const slugCounts = new Map<string, number>();

    function visit(node: unknown) {
      if (!node || typeof node !== "object") {
        return;
      }

      const headingNode = node as {
        children?: unknown[];
        data?: {
          hProperties?: Record<string, unknown>;
          id?: string;
        };
        depth?: number;
        type?: string;
      };

      if (
        headingNode.type === "heading" &&
        (headingNode.depth === 2 || headingNode.depth === 3) &&
        Array.isArray(headingNode.children)
      ) {
        const title = headingNode.children.map((child) => normalizeInlineText(child)).join("").trim();
        const baseSlug = slugifyHeading(title);
        const count = slugCounts.get(baseSlug) ?? 0;
        const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

        slugCounts.set(baseSlug, count + 1);
        headings.push({
          level: headingNode.depth,
          slug,
          title,
        });

        headingNode.data ??= {};
        headingNode.data.id = slug;
        headingNode.data.hProperties ??= {};
        headingNode.data.hProperties.id = slug;
      }

      if (Array.isArray(headingNode.children)) {
        headingNode.children.forEach((child) => visit(child));
      }
    }

    visit(tree);
  };
}

function toSummary(
  frontmatter: ReturnType<typeof publicationFrontmatterSchema.parse>,
): PublicationSummary {
  return {
    ...frontmatter,
    displayDate: formatPublicationDate(frontmatter.date),
    displayMonth: formatPublicationMonth(frontmatter.date),
    displayUpdatedAt: formatPublicationDate(frontmatter.updatedAt),
    url: getPublicationUrl(frontmatter.slug),
  };
}

async function readPublicationFile(fileName: string): Promise<PublicationSource> {
  const filePath = path.join(PUBLICATIONS_DIR, fileName);
  const source = await fs.readFile(filePath, "utf8");
  const { data, content } = matter(source);
  const fileSlug = fileName.replace(/\.mdx$/, "");
  const parsed = publicationFrontmatterSchema.parse({
    ...data,
    slug: typeof data.slug === "string" && data.slug.length > 0 ? data.slug : fileSlug,
  });

  if (parsed.slug !== fileSlug) {
    throw new Error(
      `Publication slug mismatch for "${fileName}". Frontmatter slug "${parsed.slug}" must match the file name.`,
    );
  }

  return {
    body: content,
    summary: toSummary(parsed),
  };
}

const readAllPublicationSources = cache(async (): Promise<PublicationSource[]> => {
  const fileNames = await fs.readdir(PUBLICATIONS_DIR);
  const publications = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".mdx") && !fileName.startsWith("_"))
      .map((fileName) => readPublicationFile(fileName)),
  );

  return publications.sort((left, right) => {
    const leftTimestamp = Date.parse(`${left.summary.date}T12:00:00.000Z`);
    const rightTimestamp = Date.parse(`${right.summary.date}T12:00:00.000Z`);

    return rightTimestamp - leftTimestamp;
  });
});

export async function getAllPublications(): Promise<PublicationSummary[]> {
  const publications = await readAllPublicationSources();
  return publications.map((publication) => publication.summary);
}

export async function getFeaturedPublication(): Promise<PublicationSummary | null> {
  const publications = await getAllPublications();
  return publications.find((publication) => publication.featured) ?? publications[0] ?? null;
}

export async function getRelatedPublications(slugs: string[]): Promise<PublicationSummary[]> {
  if (slugs.length === 0) {
    return [];
  }

  const publications = await getAllPublications();
  const bySlug = new Map(publications.map((publication) => [publication.slug, publication]));

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((publication): publication is PublicationSummary => Boolean(publication));
}

export const getPublicationBySlug = cache(async (slug: string): Promise<Publication | null> => {
  const publications = await readAllPublicationSources();
  const match = publications.find((publication) => publication.summary.slug === slug);

  if (!match) {
    return null;
  }

  const headings: PublicationHeading[] = [];
  const { content } = await compileMDX({
    source: match.body,
    components: publicationMdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, createHeadingPlugin(headings)],
      },
    },
  });

  return {
    ...match.summary,
    content,
    headings,
  };
});

export function getPublicationUrl(slug: string): string {
  return `${SITE_URL}/publications/${slug}`;
}

export function getPublicationImage(coverImage?: string): string {
  if (coverImage) {
    return new URL(coverImage, SITE_URL).toString();
  }

  return `${SITE_URL}/opengraph-image`;
}
