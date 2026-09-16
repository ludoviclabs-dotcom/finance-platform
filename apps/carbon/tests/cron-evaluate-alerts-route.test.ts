// @vitest-environment node

/**
 * B-07 — tick cron quotidien (/api/cron/evaluate-alerts).
 *
 * Contrat : 401 sans secret valide (modèle officiel Vercel, plus de repli
 * `x-vercel-cron`), 500 si l'URL de l'API manque, 200 seulement si toutes les
 * étapes réussissent, 502 sinon — Vercel ne relance jamais un cron en échec.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/evaluate-alerts/route";
import {
  isAuthorizedCronRequest,
  resolveCronApiBaseUrl,
} from "@/app/api/cron/evaluate-alerts/cron-support";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

const ENV_KEYS = [
  "CRON_SECRET",
  "CRON_SERVICE_TOKEN",
  "NEXT_PUBLIC_API_BASE_URL",
  "API_BASE_URL",
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function cronRequest(authorization?: string, extraHeaders: Record<string, string> = {}): Request {
  const headers = new Headers(extraHeaders);
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("https://carbon.example/api/cron/evaluate-alerts", { headers });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.CRON_SECRET = "cccccccccccccccccccccccc";
  process.env.CRON_SERVICE_TOKEN = "service-token-abcdef";
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test";
  delete process.env.API_BASE_URL;
  fetchMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe("GET /api/cron/evaluate-alerts — authentification", () => {
  it("401 sans en-tête Authorization", async () => {
    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 avec un secret erroné", async () => {
    const res = await GET(cronRequest("Bearer mauvais-secret"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 quand CRON_SECRET n'est pas configuré, même avec x-vercel-cron", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(cronRequest("Bearer undefined", { "x-vercel-cron": "1" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401 quand CRON_SECRET est vide (« Bearer » seul refusé)", async () => {
    process.env.CRON_SECRET = "   ";
    const res = await GET(cronRequest("Bearer "));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/cron/evaluate-alerts — configuration", () => {
  it("500 JSON quand aucune URL d'API n'est configurée", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.API_BASE_URL;
    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.message).toMatch(/API base URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retire le « \\n » et le « / » final de l'URL de production", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test/\n";
    fetchMock.mockImplementation(async () => jsonResponse({ evaluated: 0, fired: 0 }));

    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));

    expect(res.status).toBe(200);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      "https://api.example.test/alerts/evaluate",
      "https://api.example.test/beges/reminders/run",
      "https://api.example.test/suppliers/campaigns/reminders/run",
    ]);
  });

  it("se rabat sur API_BASE_URL quand NEXT_PUBLIC_API_BASE_URL est absent", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.API_BASE_URL = "https://fallback.example.test";
    fetchMock.mockImplementation(async () => jsonResponse({}));

    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));

    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://fallback.example.test/alerts/evaluate");
  });
});

describe("GET /api/cron/evaluate-alerts — étapes", () => {
  it("200 quand toutes les étapes réussissent, avec le token de service", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ evaluated: 4, fired: 1, alerts: [] }))
      .mockResolvedValueOnce(jsonResponse({ status: "done", sent: 2 }))
      .mockResolvedValueOnce(jsonResponse({ sent: 0 }));

    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      evaluated: 4,
      fired: 1,
      alerts: { status: "ok" },
      // Le `status` renvoyé par le backend ne masque pas le résultat de l'étape.
      begesReminders: { status: "ok", sent: 2 },
      supplierReminders: { status: "ok", sent: 0 },
    });
    for (const [, init] of fetchMock.mock.calls) {
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer service-token-abcdef");
      expect((init as RequestInit).method).toBe("POST");
    }
  });

  it("502 avec le détail quand une étape échoue — les suivantes s'exécutent quand même", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ evaluated: 2, fired: 0 }))
      .mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ sent: 1 }));

    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(body.status).toBe("error");
    expect(body.alerts.status).toBe("ok");
    expect(body.begesReminders).toEqual({
      status: "error",
      message: "Backend returned 500 on /beges/reminders/run",
    });
    expect(body.supplierReminders.status).toBe("ok");
    expect(body.message).toContain("begesReminders");
  });

  it("502 quand le backend est injoignable (erreur réseau)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.alerts).toEqual({ status: "error", message: "/alerts/evaluate: fetch failed" });
  });

  it("502 explicite quand CRON_SERVICE_TOKEN manque (aucun appel non authentifié)", async () => {
    delete process.env.CRON_SERVICE_TOKEN;

    const res = await GET(cronRequest("Bearer cccccccccccccccccccccccc"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.alerts.message).toMatch(/CRON_SERVICE_TOKEN is not configured/);
    expect(body.begesReminders.status).toBe("error");
    expect(body.supplierReminders.status).toBe("error");
  });
});

describe("cron-support", () => {
  it("isAuthorizedCronRequest n'accepte que « Bearer <secret> » exact", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret\n")).toBe(true);
    expect(isAuthorizedCronRequest("bearer s3cret", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer s3cret-plus-long", "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest(null, "s3cret")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
  });

  it("resolveCronApiBaseUrl normalise et priorise NEXT_PUBLIC_API_BASE_URL", () => {
    expect(
      resolveCronApiBaseUrl({
        NEXT_PUBLIC_API_BASE_URL: " https://a.test//\n",
        API_BASE_URL: "https://b.test",
      }),
    ).toBe("https://a.test");
    expect(resolveCronApiBaseUrl({ NEXT_PUBLIC_API_BASE_URL: "\n", API_BASE_URL: "https://b.test/" })).toBe(
      "https://b.test",
    );
    expect(resolveCronApiBaseUrl({})).toBeNull();
  });
});
