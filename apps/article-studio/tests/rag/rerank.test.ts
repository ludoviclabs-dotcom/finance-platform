import { describe, expect, it } from "vitest";
import { parseRerankerScores } from "@/lib/rag/rerank";
import { parseExpandedQueries } from "@/lib/rag/query-expansion";

describe("parseRerankerScores", () => {
  it("parses a clean JSON object", () => {
    const out = parseRerankerScores(
      '{"scores":[{"id":"S1","score":0.9},{"id":"S2","score":0.4}]}',
    );
    expect(out).toEqual({ S1: 0.9, S2: 0.4 });
  });

  it("tolerates code fences and leading prose", () => {
    const text = "Voici les scores :\n```json\n" +
      '{"scores":[{"id":"S1","score":0.7}]}\n```\n';
    expect(parseRerankerScores(text)).toEqual({ S1: 0.7 });
  });

  it("returns empty map on malformed JSON", () => {
    expect(parseRerankerScores("not json at all")).toEqual({});
    expect(parseRerankerScores("{ malformed")).toEqual({});
  });

  it("skips entries with wrong types", () => {
    const out = parseRerankerScores(
      '{"scores":[{"id":"S1","score":"high"},{"id":42,"score":0.5},{"id":"S3","score":0.2}]}',
    );
    expect(out).toEqual({ S3: 0.2 });
  });
});

describe("parseExpandedQueries", () => {
  it("parses an array of queries", () => {
    expect(
      parseExpandedQueries('{"queries":["définition","exemples","chiffres"]}'),
    ).toEqual(["définition", "exemples", "chiffres"]);
  });

  it("strips fences", () => {
    const text = "```json\n" + '{"queries":["a","b"]}\n```';
    expect(parseExpandedQueries(text)).toEqual(["a", "b"]);
  });

  it("returns [] on malformed input", () => {
    expect(parseExpandedQueries("nope")).toEqual([]);
    expect(parseExpandedQueries('{"queries":"oops"}')).toEqual([]);
  });
});
