import { describe, expect, it } from "vitest";
import {
  findInfographicCandidates,
  parseChartSpec,
} from "@/lib/infographics/extractor";

describe("findInfographicCandidates", () => {
  it("flags a paragraph dense in numbers and units", () => {
    const md =
      "L'adoption progresse : 35 % en 2023, 52 % en 2024, 68 % en 2025, et l'investissement passe à 1.2 Mds €.";
    const candidates = findInfographicCandidates(md);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].excerpt).toContain("35");
  });

  it("flags markdown tables", () => {
    const md = [
      "| Acteur | Part de marché |",
      "|--------|---------------|",
      "| A      | 40 %          |",
      "| B      | 30 %          |",
    ].join("\n");
    const candidates = findInfographicCandidates(md);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores prose without dense data", () => {
    const md = "Un paragraphe d'opinion sans chiffres ni comparaisons.";
    expect(findInfographicCandidates(md)).toEqual([]);
  });

  it("ignores fenced code blocks", () => {
    const md = "```ts\nconst pct = [10, 20, 30, 40];\n```";
    expect(findInfographicCandidates(md)).toEqual([]);
  });

  it("collects citation IDs from candidate paragraphs", () => {
    const md =
      "Selon les rapports [S1] et [S3], les coûts ont chuté de 30 %, 45 %, 60 % en trois ans.";
    const candidates = findInfographicCandidates(md);
    expect(candidates[0].citationIds).toEqual(["S1", "S3"]);
  });
});

describe("parseChartSpec", () => {
  it("returns null when the model declines", () => {
    expect(parseChartSpec("null")).toBe(null);
    expect(parseChartSpec("```\nnull\n```")).toBe(null);
  });

  it("parses a bar spec", () => {
    const text =
      '{"kind":"bar","title":"Part de marché","categories":["A","B"],"datasets":[{"label":"2024","values":[40,30]}]}';
    const spec = parseChartSpec(text);
    expect(spec?.kind).toBe("bar");
  });

  it("parses a stat spec", () => {
    const text = '{"kind":"stat","title":"Adoption","value":"68 %","caption":"en 2025"}';
    const spec = parseChartSpec(text);
    expect(spec?.kind).toBe("stat");
  });

  it("returns null on schema violation", () => {
    const text = '{"kind":"bar","title":"","categories":[],"datasets":[]}';
    expect(parseChartSpec(text)).toBe(null);
  });

  it("returns null on malformed JSON", () => {
    expect(parseChartSpec("not json")).toBe(null);
    expect(parseChartSpec("{ malformed")).toBe(null);
  });
});
