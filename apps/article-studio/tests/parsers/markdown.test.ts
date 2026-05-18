import { describe, expect, it } from "vitest";
import { parseMarkdown } from "@/lib/parsers/markdown";

const FIXTURE = `---
title: "Enjeux de la confidentialité IA"
author: "L. Labs"
date: "2026-04-12"
language: "fr"
tags: ["IA", "vie privée"]
---

# Introduction

Ceci est un paragraphe d'**introduction** avec quelques mots-clés.

## Méthodologie

Une seconde section avec une liste :

- Premier élément.
- Deuxième élément.
- Troisième élément.

### Sous-section

Un autre paragraphe.

\`\`\`ts
const x = 42;
\`\`\`

> Citation marquante de l'auteur.

| Colonne A | Colonne B |
|-----------|-----------|
| 1         | un        |
| 2         | deux      |
`;

describe("parseMarkdown", () => {
  it("extracts frontmatter into top-level fields", async () => {
    const doc = await parseMarkdown(Buffer.from(FIXTURE, "utf8"), "test.md");
    expect(doc.title).toBe("Enjeux de la confidentialité IA");
    expect(doc.author).toBe("L. Labs");
    expect(doc.language).toBe("fr");
    expect(doc.publishedAt).toBeInstanceOf(Date);
    expect(doc.publishedAt?.getUTCFullYear()).toBe(2026);
  });

  it("produces blocks in source order with correct kinds", async () => {
    const doc = await parseMarkdown(Buffer.from(FIXTURE, "utf8"), "test.md");
    const kinds = doc.blocks.map((b) => b.kind);
    expect(kinds[0]).toBe("heading");
    expect(kinds).toContain("paragraph");
    expect(kinds).toContain("list");
    expect(kinds).toContain("list-item");
    expect(kinds).toContain("code");
    expect(kinds).toContain("quote");
    expect(kinds).toContain("table");
  });

  it("preserves heading levels", async () => {
    const doc = await parseMarkdown(Buffer.from(FIXTURE, "utf8"), "test.md");
    const headings = doc.blocks.filter((b) => b.kind === "heading");
    const levels = headings.map((h) => h.level);
    expect(levels).toEqual([1, 2, 3]);
  });

  it("emits one list-item per bullet", async () => {
    const doc = await parseMarkdown(Buffer.from(FIXTURE, "utf8"), "test.md");
    const items = doc.blocks.filter((b) => b.kind === "list-item");
    expect(items.length).toBe(3);
    expect(items[0].text).toBe("Premier élément.");
  });

  it("captures table as a flattened text block with rowsxcols metadata", async () => {
    const doc = await parseMarkdown(Buffer.from(FIXTURE, "utf8"), "test.md");
    const table = doc.blocks.find((b) => b.kind === "table");
    expect(table).toBeDefined();
    expect(table?.metadata?.cols).toBe(2);
    expect(table?.text).toContain("|");
  });

  it("handles markdown without frontmatter", async () => {
    const doc = await parseMarkdown(
      Buffer.from("# Titre\n\nUn paragraphe.\n", "utf8"),
      "no-fm.md",
    );
    expect(doc.title).toBeUndefined();
    expect(doc.blocks.length).toBe(2);
  });
});
