// @vitest-environment node

/**
 * M-18 / m-19 — /api/upload : pièces client en Blob PRIVÉ, aucune URL
 * publique renvoyée, erreurs de stockage traduites (jamais « Vercel Blob: No
 * token found… » côté navigateur).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const putMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return { ...actual, put: putMock };
});

import { BlobError, BlobStoreSuspendedError } from "@vercel/blob";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/upload/route";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "@/app/api/upload/upload-errors";
import { signJwt } from "@/lib/verify-jwt";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function analystToken(): Promise<string> {
  return signJwt(
    { sub: "analyste@exemple.test", role: "analyst", cid: 7, scope: "access" },
    new Date(Date.now() + 60_000),
  );
}

function workbook(name = "CarbonCo_Carbon.xlsx"): File {
  return new File([new Uint8Array([80, 75, 3, 4])], name, { type: XLSX_TYPE });
}

async function uploadRequest(files: Record<string, File>, token?: string): Promise<NextRequest> {
  const form = new FormData();
  for (const [domain, file] of Object.entries(files)) form.append(domain, file);
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new NextRequest("http://localhost:3003/api/upload", { method: "POST", headers, body: form });
}

let savedBlobToken: string | undefined;

beforeEach(() => {
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  process.env.AUTH_JWT_SECRET = "test-upload-secret-that-is-long-enough";
  savedBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  putMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (savedBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = savedBlobToken;
  vi.restoreAllMocks();
});

describe("POST /api/upload", () => {
  it("401 sans jeton", async () => {
    const res = await POST(await uploadRequest({ carbon: workbook() }));
    expect(res.status).toBe(401);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("dépose en accès privé et ne renvoie aucune URL de blob", async () => {
    putMock.mockResolvedValue({
      url: "https://store.private.blob.vercel-storage.com/workbooks/company-7/carbon/x.xlsx",
      downloadUrl: "https://store.private.blob.vercel-storage.com/x.xlsx?download=1",
      pathname: "workbooks/company-7/carbon/x.xlsx",
      contentType: XLSX_TYPE,
      contentDisposition: 'attachment; filename="x.xlsx"',
      etag: "etag",
    });

    const res = await POST(await uploadRequest({ carbon: workbook() }, await analystToken()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(putMock).toHaveBeenCalledTimes(1);
    const [pathname, , options] = putMock.mock.calls[0];
    expect(pathname).toMatch(/^workbooks\/company-7\/carbon\//);
    expect(options).toMatchObject({ access: "private", allowOverwrite: false, addRandomSuffix: true });
    // Import partiel : seuls les domaines envoyés apparaissent (pas de « Fichier manquant »).
    expect(body).toEqual({
      status: "ok",
      files: [
        {
          domain: "carbon",
          status: "ok",
          pathname: "workbooks/company-7/carbon/x.xlsx",
          filename: "CarbonCo_Carbon.xlsx",
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain("blob.vercel-storage.com");
  });

  it("traduit « No token found » et journalise le détail côté serveur", async () => {
    putMock.mockRejectedValue(
      new BlobError(
        "No token found. Either configure the `BLOB_READ_WRITE_TOKEN` environment variable, or pass a `token` option to your calls.",
      ),
    );

    const res = await POST(await uploadRequest({ carbon: workbook() }, await analystToken()));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.files[0]).toEqual({
      domain: "carbon",
      status: "error",
      detail: STORAGE_NOT_CONFIGURED_MESSAGE,
    });
    expect(JSON.stringify(body)).not.toMatch(/Vercel Blob|BLOB_READ_WRITE_TOKEN/);
    expect(console.error).toHaveBeenCalled();
  });

  it("store suspendu : message présentable", async () => {
    putMock.mockRejectedValue(new BlobStoreSuspendedError());

    const res = await POST(await uploadRequest({ esg: workbook("esg.xlsx") }, await analystToken()));
    const body = await res.json();

    expect(body.files[0].detail).toBe(STORAGE_NOT_CONFIGURED_MESSAGE);
  });

  it("jeton de stockage absent : aucun appel Blob, message présentable", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const res = await POST(
      await uploadRequest({ carbon: workbook(), finance: workbook("fin.xlsx") }, await analystToken()),
    );
    const body = await res.json();

    expect(putMock).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    expect(body.files.map((f: { domain: string }) => f.domain)).toEqual(["carbon", "finance"]);
    for (const file of body.files) expect(file.detail).toBe(STORAGE_NOT_CONFIGURED_MESSAGE);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("BLOB_READ_WRITE_TOKEN is not configured"),
    );
  });

  it("aucun fichier : 400 explicite", async () => {
    const res = await POST(await uploadRequest({}, await analystToken()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", files: [], error: "Aucun fichier reçu." });
  });

  it("extension refusée : message de validation conservé", async () => {
    const res = await POST(
      await uploadRequest({ carbon: new File(["x"], "notes.pdf", { type: "application/pdf" }) }, await analystToken()),
    );
    const body = await res.json();
    expect(body.files[0].detail).toContain("Extension non autorisée");
    expect(putMock).not.toHaveBeenCalled();
  });
});
