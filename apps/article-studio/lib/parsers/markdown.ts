/**
 * Markdown parser — gray-matter (frontmatter) + remark (AST).
 *
 * Walks the MDAST tree and emits ordered Block[] preserving heading levels,
 * paragraphs, lists (flattened to list-item blocks under a list anchor),
 * code blocks, blockquotes, and tables.
 *
 * Frontmatter fields recognized: title, author, date (→ publishedAt), language.
 */

import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent, ListItem, TableRow } from "mdast";
import type { Block, ParsedDoc } from "@/lib/types/source";

function plainText(nodes: readonly PhrasingContent[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if ("value" in n && typeof n.value === "string") return n.value;
      if ("children" in n && Array.isArray(n.children)) {
        return plainText(n.children as PhrasingContent[]);
      }
      return "";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function blocksFromMdast(root: Root): Block[] {
  const blocks: Block[] = [];

  for (const node of root.children as RootContent[]) {
    switch (node.type) {
      case "heading": {
        const text = plainText(node.children as PhrasingContent[]);
        if (text) blocks.push({ kind: "heading", text, level: node.depth });
        break;
      }
      case "paragraph": {
        const text = plainText(node.children as PhrasingContent[]);
        if (text) blocks.push({ kind: "paragraph", text });
        break;
      }
      case "list": {
        blocks.push({
          kind: "list",
          text: "",
          metadata: { ordered: node.ordered ?? false, itemCount: node.children.length },
        });
        for (const item of node.children as ListItem[]) {
          const text = item.children
            .map((c) => {
              if (c.type === "paragraph") return plainText(c.children as PhrasingContent[]);
              return "";
            })
            .filter(Boolean)
            .join(" ");
          if (text) blocks.push({ kind: "list-item", text });
        }
        break;
      }
      case "code": {
        if (node.value) {
          blocks.push({
            kind: "code",
            text: node.value,
            metadata: { lang: node.lang ?? null },
          });
        }
        break;
      }
      case "blockquote": {
        const text = (node.children as RootContent[])
          .map((c) =>
            c.type === "paragraph" ? plainText(c.children as PhrasingContent[]) : "",
          )
          .filter(Boolean)
          .join(" ");
        if (text) blocks.push({ kind: "quote", text });
        break;
      }
      case "table": {
        const rows = (node.children as TableRow[]).map((row) =>
          row.children.map((cell) => plainText(cell.children as PhrasingContent[])),
        );
        const text = rows.map((r) => r.join(" | ")).join("\n");
        if (text) {
          blocks.push({
            kind: "table",
            text,
            metadata: { rows: rows.length, cols: rows[0]?.length ?? 0 },
          });
        }
        break;
      }
      default:
        // Ignore html, thematicBreak, definition, etc. — not informative for RAG.
        break;
    }
  }

  return blocks;
}

export async function parseMarkdown(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDoc> {
  const raw = buffer.toString("utf8");
  const { data: frontmatter, content } = matter(raw);

  const tree = unified().use(remarkParse).use(remarkGfm).parse(content) as Root;
  const blocks = blocksFromMdast(tree);

  const publishedAt =
    typeof frontmatter.date === "string" || frontmatter.date instanceof Date
      ? new Date(frontmatter.date as string)
      : undefined;

  return {
    filename,
    mimeType: "text/markdown",
    language: typeof frontmatter.language === "string" ? frontmatter.language : "fr",
    title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
    author: typeof frontmatter.author === "string" ? frontmatter.author : undefined,
    publishedAt:
      publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
    blocks,
    metadata: { frontmatter },
  };
}
