/**
 * lib/api.ts — erreurs typées et contrats API (QA : m-13, m-20, contrat 1-8).
 *
 * - ApiError (status, code, detail) avec un message rétrocompatible ;
 * - snapshot absent (`no_snapshot`) reconnu comme état vide ;
 * - URL de base normalisée (le « \n » de production) ;
 * - téléchargement authentifié (exports tenant-scoped) ;
 * - connexion : messages présentables sur panne réseau, 429, 5xx et délai ;
 * - désactivation 2FA : code obligatoire, pas de rejeu d'un 401 « code invalide ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  NO_SNAPSHOT_CODE,
  SERVICE_UNAVAILABLE_MESSAGE,
  downloadAuthenticatedFile,
  downloadStrategicMappingExport,
  fetchBegesStatus,
  fetchCarbonSnapshot,
  fetchQuestionnaire,
  friendlyApiErrorMessage,
  isNoSnapshotError,
  loginRequest,
  parseApiErrorPayload,
  setAuthToken,
  setOnTokenExpired,
  totpDisableRequest,
  verifyTotpRequest,
} from "@/lib/api";
import { normalizeApiBaseUrl } from "@/lib/api-base-url";

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  setAuthToken("jeton-test");
  setOnTokenExpired(null);
});

afterEach(() => {
  setAuthToken(null);
  setOnTokenExpired(null);
  vi.useRealTimers();
});

describe("normalizeApiBaseUrl (m-13)", () => {
  it("retire blancs et « / » finaux", () => {
    expect(normalizeApiBaseUrl("https://api.example.test\n")).toBe("https://api.example.test");
    expect(normalizeApiBaseUrl("  https://api.example.test//  ")).toBe("https://api.example.test");
    expect(normalizeApiBaseUrl("https://api.example.test/v1/")).toBe("https://api.example.test/v1");
  });

  it("valeur vide ou absente → null", () => {
    expect(normalizeApiBaseUrl("")).toBeNull();
    expect(normalizeApiBaseUrl(" \n")).toBeNull();
    expect(normalizeApiBaseUrl("/")).toBeNull();
    expect(normalizeApiBaseUrl(undefined)).toBeNull();
    expect(normalizeApiBaseUrl(null)).toBeNull();
  });
});

describe("ApiError & snapshots absents", () => {
  it("404 no_snapshot → ApiError au message rétrocompatible, reconnu comme état vide", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { detail: { error: NO_SNAPSHOT_CODE, message: "Aucun snapshot carbone importé." } },
        404,
      ),
    );

    const err = await fetchCarbonSnapshot().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect((err as ApiError).message).toBe("API 404 on /carbon/snapshot");
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).code).toBe("no_snapshot");
    expect((err as ApiError).detail).toBe("Aucun snapshot carbone importé.");
    expect(isNoSnapshotError(err)).toBe(true);
  });

  it("un 404 ordinaire n'est pas un état vide", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Not Found" }, 404));
    const err = await fetchCarbonSnapshot().catch((e: unknown) => e);
    expect(isNoSnapshotError(err)).toBe(false);
    expect((err as ApiError).detail).toBe("Not Found");
  });

  it("corps non JSON : seul le statut est conservé", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));
    const err = (await fetchCarbonSnapshot().catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.code).toBeNull();
    expect(err.detail).toBeNull();
  });

  it("parseApiErrorPayload gère les formes FastAPI et Next", () => {
    expect(parseApiErrorPayload({ detail: [{ msg: "field required" }] })).toEqual({ code: null, detail: null });
    expect(parseApiErrorPayload({ error: "Mode démo", code: "DEMO_SCOPE" })).toEqual({
      code: "DEMO_SCOPE",
      detail: "Mode démo",
    });
    expect(parseApiErrorPayload("texte")).toEqual({ code: null, detail: null });
  });
});

describe("friendlyApiErrorMessage", () => {
  it("jamais de message technique brut", () => {
    expect(friendlyApiErrorMessage(new ApiError(500, "/x"))).toBe(SERVICE_UNAVAILABLE_MESSAGE);
    expect(friendlyApiErrorMessage(new TypeError("Failed to fetch"))).toBe(SERVICE_UNAVAILABLE_MESSAGE);
    expect(friendlyApiErrorMessage(new DOMException("t", "TimeoutError"))).toBe(SERVICE_UNAVAILABLE_MESSAGE);
    expect(friendlyApiErrorMessage(new ApiError(401, "/x"))).toMatch(/session a expiré/);
    expect(friendlyApiErrorMessage(new ApiError(429, "/x"))).toMatch(/Trop de requêtes/);
    expect(friendlyApiErrorMessage(new Error("API 418 on /x"), {}, "Repli")).toBe("Repli");
  });

  it("surcharge par statut", () => {
    expect(friendlyApiErrorMessage(new ApiError(403, "/x"), { 403: "Réservé" })).toBe("Réservé");
  });
});

describe("downloadAuthenticatedFile (contrat 1)", () => {
  it("télécharge avec le jeton, via une URL objet révoquée ensuite", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked: string[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this.download);
      });
    fetchMock.mockResolvedValueOnce(new Response(new Blob(["xlsx"]), { status: 200 }));

    await downloadStrategicMappingExport("xlsx", {
      segment: "pme",
      persona: "daf",
      horizon: "court_terme",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(
      /\/strategic-mapping\/adhesion-volontaire\/export\.xlsx\?segment=pme&persona=daf&horizon=court_terme$/,
    );
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer jeton-test" });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clicked).toEqual(["value-mapping-esg-pme-daf.xlsx"]);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    clickSpy.mockRestore();
  });

  it("401 non récupérable → ApiError, aucun téléchargement", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Token manquant" }, 401));

    await expect(downloadAuthenticatedFile("/export.pdf", "x.pdf")).rejects.toMatchObject({
      status: 401,
    });
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe("loginRequest / verifyTotpRequest (m-20)", () => {
  it("API injoignable (TypeError) → message d'indisponibilité", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(loginRequest("a@b.fr", "x")).rejects.toThrow(SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("401 → identifiants incorrects", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Email ou mot de passe incorrect." }, 401));
    await expect(loginRequest("a@b.fr", "x")).rejects.toThrow("Email ou mot de passe incorrect.");
  });

  it("429 → message explicite de limitation", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Too Many Requests" }, 429));
    await expect(loginRequest("a@b.fr", "x")).rejects.toThrow(/Trop de tentatives/);
  });

  it("5xx → message d'indisponibilité, sans « API 5xx »", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 503 }));
    const err = (await loginRequest("a@b.fr", "x").catch((e: unknown) => e)) as Error;
    expect(err.message).toBe(SERVICE_UNAVAILABLE_MESSAGE);
    expect(err.message).not.toMatch(/API \d+/);
  });

  it("réponse 200 non JSON → indisponibilité", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    await expect(loginRequest("a@b.fr", "x")).rejects.toThrow(SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("délai dépassé (15 s) → indisponibilité au lieu d'une attente infinie", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    const pending = loginRequest("a@b.fr", "x").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(((await pending) as Error).message).toBe(SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("annulation voulue par l'appelant : propagée telle quelle", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    );
    const pending = loginRequest("a@b.fr", "x", controller.signal).catch((e: unknown) => e);
    controller.abort();
    expect(((await pending) as Error).name).toBe("AbortError");
  });

  it("vérification 2FA : panne réseau → indisponibilité", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("NetworkError when attempting to fetch resource."));
    await expect(verifyTotpRequest("pre", "123456")).rejects.toThrow(SERVICE_UNAVAILABLE_MESSAGE);
  });
});

describe("totpDisableRequest (contrat 3)", () => {
  it("envoie le code dans un corps JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await totpDisableRequest("123456");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/totp\/disable$/);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ code: "123456" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer jeton-test",
      "Content-Type": "application/json",
    });
  });

  it("401 « code invalide » : ni rotation ni second essai", async () => {
    const rotate = vi.fn().mockResolvedValue("nouveau-jeton");
    setOnTokenExpired(rotate);
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "Code de vérification invalide." }, 401));

    await expect(totpDisableRequest("000000")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rotate).not.toHaveBeenCalled();
  });

  it("401 jeton expiré : rotation puis un seul nouvel essai", async () => {
    const rotate = vi.fn().mockResolvedValue("nouveau-jeton");
    setOnTokenExpired(rotate);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: "Token invalide ou expiré" }, 401))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await totpDisableRequest("123456");

    expect(rotate).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer nouveau-jeton",
    });
  });

  it("422 / 429 / 409 remontés en ApiError typées", async () => {
    for (const status of [422, 429, 409]) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "x" }, status));
      await expect(totpDisableRequest("1")).rejects.toMatchObject({ status });
    }
  });
});

describe("contrats divers", () => {
  it("fetchBegesStatus normalise l'éligibilité historique", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        breakdown: { standard: "BEGES v5", total: 0, categories: [] },
        eligibility: { status: "volontaire", label: "Démarche volontaire (sous les seuils réglementaires)" },
        scope_totals: { S1: 0, S2: 0, S3: {} },
      }),
    );
    const status = await fetchBegesStatus();
    expect(status.eligibility.status).toBe("sous_seuil");
    expect(status.eligibility.notes).toEqual([]);
  });

  it("fetchQuestionnaire encode le jeton dans l'URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await fetchQuestionnaire("a/b?c");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/suppliers\/public\/q\/a%2Fb%3Fc$/);
  });
});
