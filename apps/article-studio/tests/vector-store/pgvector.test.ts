import { describe, expect, it } from "vitest";
import { vectorToLiteral } from "@/lib/vector-store/pgvector";

describe("vectorToLiteral", () => {
  it("formats a numeric array as pgvector literal", () => {
    expect(vectorToLiteral([1, 2, 3])).toBe("[1,2,3]");
  });

  it("handles floats and negatives", () => {
    expect(vectorToLiteral([0.1, -0.25, 1.5])).toBe("[0.1,-0.25,1.5]");
  });

  it("handles empty array", () => {
    expect(vectorToLiteral([])).toBe("[]");
  });

  it("coerces string-like numbers", () => {
    expect(vectorToLiteral([1, 2.5])).toBe("[1,2.5]");
  });
});
