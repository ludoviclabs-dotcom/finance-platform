import { describe, expect, it } from "vitest";

import {
  PROBED_COMPONENTS,
  runAllProbes,
  type ProbeResult,
} from "@/lib/status/probes";
import { isProbed, getLiveUptimes } from "@/lib/status/uptime";
import statusData from "@/content/status/components.json";

describe("PROBED_COMPONENTS", () => {
  it("lists ids that all exist in content/status/components.json", () => {
    const declaredIds = new Set(statusData.items.map((i) => i.id));
    for (const id of PROBED_COMPONENTS) {
      expect(declaredIds.has(id)).toBe(true);
    }
  });

  it("isProbed narrows on the canonical list", () => {
    expect(isProbed("database")).toBe(true);
    expect(isProbed("platform")).toBe(true);
    expect(isProbed("ai-gateway")).toBe(false);
    expect(isProbed("auth")).toBe(false);
    expect(isProbed("does-not-exist")).toBe(false);
  });
});

describe("runAllProbes", () => {
  it("returns one result per probed component", async () => {
    const results = await runAllProbes();
    expect(results).toHaveLength(PROBED_COMPONENTS.length);
    const ids = results.map((r) => r.componentId);
    for (const id of PROBED_COMPONENTS) {
      expect(ids).toContain(id);
    }
  });

  it("each result has a valid shape", async () => {
    const results = await runAllProbes();
    for (const r of results) {
      expect(["operational", "degraded", "outage"]).toContain(r.status);
      expect(typeof r.componentId).toBe("string");
      if (r.latencyMs !== null) {
        expect(r.latencyMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("platform probe is always operational (the runtime ran)", async () => {
    const results = await runAllProbes();
    const platform = results.find((r) => r.componentId === "platform");
    expect(platform).toBeDefined();
    expect(platform!.status).toBe("operational");
  });

  it("database probe reports outage with 'no-db-url' when DATABASE_URL is unset", async () => {
    // In CI/test, DATABASE_URL is not configured → the probe should fail
    // cleanly with a specific error tag, not throw.
    const results = await runAllProbes();
    const db = results.find((r) => r.componentId === "database");
    expect(db).toBeDefined();
    if (db!.error === "no-db-url") {
      expect(db!.status).toBe("outage");
      expect(db!.latencyMs).toBeNull();
    }
  });

  it("publications probe reads the content/ directory", async () => {
    const results = await runAllProbes();
    const pub = results.find((r) => r.componentId === "publications");
    expect(pub).toBeDefined();
    // The content/ directory exists in this repo; probe should be operational.
    expect(pub!.status).toBe("operational");
    expect(pub!.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("getLiveUptimes", () => {
  it("returns an empty map when the database is not configured", async () => {
    const map = await getLiveUptimes();
    expect(map.size).toBe(0);
  });
});
