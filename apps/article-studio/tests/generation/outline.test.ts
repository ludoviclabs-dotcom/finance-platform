import { describe, expect, it } from "vitest";
import { parseOutline } from "@/lib/generation/outline";

describe("parseOutline", () => {
  const validJson = `{
    "title": "L'AI Act expliqué aux fondateurs",
    "metaDescription": "Ce que change le règlement européen pour vos produits.",
    "sections": [
      { "id": "intro", "title": "Introduction", "summary": "Pourquoi maintenant.", "sourceRefs": ["S1"] },
      { "id": "obligations", "title": "Obligations", "summary": "Documentation et audits.", "sourceRefs": ["S2","S3"] }
    ]
  }`;

  it("parses a clean JSON outline", () => {
    const out = parseOutline(validJson);
    expect(out.title).toMatch(/AI Act/);
    expect(out.sections).toHaveLength(2);
    expect(out.sections[0].sourceRefs).toEqual(["S1"]);
  });

  it("strips code fences", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const out = parseOutline(wrapped);
    expect(out.sections).toHaveLength(2);
  });

  it("strips leading prose", () => {
    const text = "Voici le plan :\n" + validJson;
    expect(parseOutline(text).sections).toHaveLength(2);
  });

  it("throws on missing JSON block", () => {
    expect(() => parseOutline("aucun JSON ici")).toThrow(/no JSON block/);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseOutline("{ pas du JSON valide")).toThrow(/invalid JSON|no JSON block/);
  });

  it("throws when schema is violated", () => {
    const wrong = `{"title":"X","sections":[{"id":1,"title":"a","summary":"b"}]}`;
    expect(() => parseOutline(wrong)).toThrow(/schema/);
  });

  it("defaults sourceRefs to [] when absent", () => {
    const noRefs = `{"title":"T","sections":[{"id":"s1","title":"A","summary":"B"}]}`;
    const out = parseOutline(noRefs);
    expect(out.sections[0].sourceRefs).toEqual([]);
  });
});
