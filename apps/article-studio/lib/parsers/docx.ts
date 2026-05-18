/**
 * DOCX parser — mammoth → HTML → rehype AST → Block[].
 *
 * mammoth converts a .docx file to clean semantic HTML preserving h1/h2/h3,
 * p, ul/ol/li, table, blockquote. We then walk the HAST tree to emit
 * ordered blocks.
 */

import mammoth from "mammoth";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import type { Element, Root, RootContent, Text } from "hast";
import type { Block, ParsedDoc } from "@/lib/types/source";

function nodeText(node: RootContent | Element): string {
  if (node.type === "text") return (node as Text).value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((c) => nodeText(c as RootContent)).join("");
  }
  return "";
}

function blocksFromHast(root: Root): Block[] {
  const blocks: Block[] = [];

  function walk(node: Element) {
    const tag = node.tagName.toLowerCase();
    const text = nodeText(node).replace(/\s+/g, " ").trim();

    if (/^h[1-6]$/.test(tag)) {
      if (text) {
        blocks.push({
          kind: "heading",
          text,
          level: parseInt(tag.slice(1), 10),
        });
      }
      return;
    }

    if (tag === "p") {
      if (text) blocks.push({ kind: "paragraph", text });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = (node.children as RootContent[]).filter(
        (c): c is Element => c.type === "element" && (c as Element).tagName.toLowerCase() === "li",
      );
      blocks.push({
        kind: "list",
        text: "",
        metadata: { ordered: tag === "ol", itemCount: items.length },
      });
      for (const li of items) {
        const t = nodeText(li).replace(/\s+/g, " ").trim();
        if (t) blocks.push({ kind: "list-item", text: t });
      }
      return;
    }

    if (tag === "blockquote") {
      if (text) blocks.push({ kind: "quote", text });
      return;
    }

    if (tag === "table") {
      const rows: string[][] = [];
      const trs = (node.children as RootContent[]).filter(
        (c): c is Element => c.type === "element",
      );
      for (const child of trs) {
        if (child.tagName.toLowerCase() === "tbody" || child.tagName.toLowerCase() === "thead") {
          for (const row of (child.children as RootContent[]).filter(
            (c): c is Element =>
              c.type === "element" && (c as Element).tagName.toLowerCase() === "tr",
          )) {
            rows.push(
              (row.children as RootContent[])
                .filter(
                  (c): c is Element =>
                    c.type === "element" &&
                    /^(td|th)$/.test((c as Element).tagName.toLowerCase()),
                )
                .map((cell) => nodeText(cell).replace(/\s+/g, " ").trim()),
            );
          }
        } else if (child.tagName.toLowerCase() === "tr") {
          rows.push(
            (child.children as RootContent[])
              .filter(
                (c): c is Element =>
                  c.type === "element" &&
                  /^(td|th)$/.test((c as Element).tagName.toLowerCase()),
              )
              .map((cell) => nodeText(cell).replace(/\s+/g, " ").trim()),
          );
        }
      }
      const flat = rows.map((r) => r.join(" | ")).join("\n");
      if (flat) {
        blocks.push({
          kind: "table",
          text: flat,
          metadata: { rows: rows.length, cols: rows[0]?.length ?? 0 },
        });
      }
      return;
    }

    // Recurse into containers we don't handle directly (body, div, etc.)
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child.type === "element") walk(child as Element);
      }
    }
  }

  for (const child of root.children) {
    if (child.type === "element") walk(child as Element);
  }

  return blocks;
}

export async function parseDocx(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDoc> {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer });
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html) as Root;
  const blocks = blocksFromHast(tree);

  // Mammoth surfaces warnings (unrecognized styles, dropped content). Keep them
  // in metadata for debug surface — never throw.
  const warnings = messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  return {
    filename,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    language: "fr",
    blocks,
    metadata: {
      mammothWarnings: warnings,
      htmlByteSize: html.length,
    },
  };
}
