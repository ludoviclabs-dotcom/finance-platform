import { describe, expect, it } from "vitest";

import { isDemoProtectedPath } from "@/proxy";

describe("proxy — périmètre de session démo", () => {
  it("protège les pages métier et les APIs sous cookie démo", () => {
    expect(isDemoProtectedPath("/dashboard")).toBe(true);
    expect(isDemoProtectedPath("/resources/assessments")).toBe(true);
    expect(isDemoProtectedPath("/api/upload")).toBe(true);
  });

  it("laisse disponibles la démo publique et son endpoint d'émission", () => {
    expect(isDemoProtectedPath("/demo")).toBe(false);
    expect(isDemoProtectedPath("/demo/asterion-motion")).toBe(false);
    expect(isDemoProtectedPath("/api/auth/demo")).toBe(false);
  });
});
