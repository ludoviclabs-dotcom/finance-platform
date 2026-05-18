import { describe, expect, it } from "vitest";
import { envReport, env } from "@/lib/env";

describe("env capability report", () => {
  it("returns a boolean for every declared capability", () => {
    const report = envReport();
    for (const [key, value] of Object.entries(report)) {
      expect(typeof value, `${key} should be boolean`).toBe("boolean");
    }
  });

  it("declares the expected capability groups", () => {
    const report = envReport();
    expect(Object.keys(report)).toEqual(
      expect.arrayContaining([
        "database",
        "redis",
        "ai_gateway",
        "ai_anthropic_direct",
        "embeddings_voyage",
        "embeddings_openai",
        "rerank_cohere",
        "observability",
        "security_input_guard",
        "storage_blob",
        "auth_internal",
      ]),
    );
  });

  it("exposes runtime metadata", () => {
    expect(env.runtime.nodeEnv).toMatch(/development|test|production/);
    expect(typeof env.runtime.isProduction).toBe("boolean");
  });
});
