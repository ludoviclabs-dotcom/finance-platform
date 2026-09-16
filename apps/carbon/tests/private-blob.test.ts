// @vitest-environment node
import { describe, expect, it } from "vitest";

import { tenantBlobPath } from "@/lib/blob/private-blob";

const HOST = "https://abc123.private.blob.vercel-storage.com";

describe("tenantBlobPath — une pièce n'est lisible que par son organisation", () => {
  it("accepte un chemin ou une URL du store dans l'espace de l'organisation", () => {
    expect(tenantBlobPath("workbooks/company-7/docs/rapport.pdf", 7)).toBe(
      "workbooks/company-7/docs/rapport.pdf",
    );
    expect(tenantBlobPath(`${HOST}/workbooks/company-7/docs/rapport-x1.pdf`, "7")).toBe(
      "workbooks/company-7/docs/rapport-x1.pdf",
    );
  });

  it("refuse l'espace d'une autre organisation", () => {
    expect(tenantBlobPath("workbooks/company-8/docs/rapport.pdf", 7)).toBeNull();
    expect(tenantBlobPath("workbooks/company-70/docs/rapport.pdf", 7)).toBeNull();
  });

  it("refuse toute URL qui n'est pas celle du store Vercel Blob (SSRF)", () => {
    for (const ref of [
      "http://169.254.169.254/latest/meta-data/",
      "https://evil.example/workbooks/company-7/x.pdf",
      "http://abc123.private.blob.vercel-storage.com/workbooks/company-7/x.pdf",
      "https://blob.vercel-storage.com.evil.test/workbooks/company-7/x.pdf",
      "file:///etc/passwd",
      "javascript:alert(1)",
    ]) {
      expect(tenantBlobPath(ref, 7)).toBeNull();
    }
  });

  it("refuse la traversée de chemin", () => {
    expect(tenantBlobPath("workbooks/company-7/../company-8/x.pdf", 7)).toBeNull();
    expect(tenantBlobPath(`${HOST}/workbooks/company-7/%2e%2e/company-8/x.pdf`, 7)).toBeNull();
    expect(tenantBlobPath(String.raw`workbooks\company-7\x.pdf`, 7)).toBeNull();
    expect(tenantBlobPath("", 7)).toBeNull();
  });
});
