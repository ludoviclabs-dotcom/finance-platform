/**
 * `getDemoSessionRequest` — une session démo absente (401) doit libérer le
 * corps de la réponse. Sans cela, Chromium considère la requête comme toujours
 * en cours : chaque page publique qui monte `useAuth` garde une connexion
 * ouverte, et les E2E qui attendent `networkidle` (13-demo, 01-auth) expirent.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { getDemoSessionRequest } from "@/lib/api";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

afterEach(() => {
  fetchMock.mockReset();
});

describe("getDemoSessionRequest", () => {
  it("401 → null, et le corps non lu est annulé", async () => {
    const response = new Response(JSON.stringify({ code: "DEMO_SESSION_REQUIRED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    const cancel = vi.spyOn(response.body!, "cancel");
    fetchMock.mockResolvedValueOnce(response);

    await expect(getDemoSessionRequest()).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("200 → état de la session démo", async () => {
    const payload = {
      ok: true,
      isDemo: true,
      user: { email: "demo@example.com", role: "viewer", company_id: 0, is_demo: true },
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getDemoSessionRequest()).resolves.toEqual(payload);
  });
});
