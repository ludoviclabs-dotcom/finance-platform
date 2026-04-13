/**
 * Tests unitaires pour lib/api.ts
 *
 * On mock fetch pour tester la logique des fetchers sans serveur réel :
 *  - authHeaders bien injectés
 *  - erreurs HTTP bien transformées
 *  - types EsprStatus et ValidationIssue cohérents
 *  - helpers setAuthToken / setOnTokenExpired
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setAuthToken,
  setOnTokenExpired,
  fetchProducts,
  createProduct,
  validateExcel,
  previewExcel,
  type ProductOut,
  type EsprStatus,
  type ExcelValidateResponse,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, status = 200): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// setAuthToken / authHeaders
// ---------------------------------------------------------------------------

describe("setAuthToken", () => {
  it("injects Bearer token in request headers", async () => {
    setAuthToken("test-jwt-token");
    mockFetch([]);

    await fetchProducts();

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-jwt-token");
  });

  it("sends no Authorization header when token is null", async () => {
    setAuthToken(null);
    mockFetch([]);

    await fetchProducts();

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = (init.headers as Record<string, string>) ?? {};
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fetchProducts
// ---------------------------------------------------------------------------

describe("fetchProducts", () => {
  beforeEach(() => setAuthToken(null));

  it("returns product list on 200", async () => {
    const products: ProductOut[] = [
      {
        id: 1,
        company_id: 1,
        name: "T-shirt Bio",
        sku: "SKU-001",
        sector: "Textiles & vêtements",
        pcf_kgco2e: 2.5,
        recyclability_pct: 80,
        lifespan_years: 3,
        supply_chain: null,
        espr_status: "pending",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockFetch(products);

    const result = await fetchProducts();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("T-shirt Bio");
    expect(result[0].espr_status).toBe<EsprStatus>("pending");
  });

  it("throws on 500", async () => {
    mockFetch({ detail: "Server Error" }, 500);
    await expect(fetchProducts()).rejects.toThrow("500");
  });
});

// ---------------------------------------------------------------------------
// createProduct
// ---------------------------------------------------------------------------

describe("createProduct", () => {
  beforeEach(() => setAuthToken("analyst-token"));

  it("sends POST with JSON body", async () => {
    const created: ProductOut = {
      id: 2,
      company_id: 1,
      name: "Batterie Li-Ion",
      sku: null,
      sector: "Batteries & accumulateurs",
      pcf_kgco2e: 12.3,
      recyclability_pct: null,
      lifespan_years: 5,
      supply_chain: null,
      espr_status: "eligible",
      created_at: "2024-06-01T00:00:00Z",
      updated_at: "2024-06-01T00:00:00Z",
    };
    mockFetch(created, 201);

    const result = await createProduct({
      name: "Batterie Li-Ion",
      sector: "Batteries & accumulateurs",
      pcf_kgco2e: 12.3,
      espr_status: "eligible",
    });

    expect(result.id).toBe(2);
    expect(result.espr_status).toBe<EsprStatus>("eligible");

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe("POST");
    const bodyParsed = JSON.parse(call[1].body as string);
    expect(bodyParsed.name).toBe("Batterie Li-Ion");
  });
});

// ---------------------------------------------------------------------------
// 401 retry with onTokenExpired
// ---------------------------------------------------------------------------

describe("setOnTokenExpired retry", () => {
  it("retries with new token after 401", async () => {
    setAuthToken("expired-token");

    const newToken = "refreshed-token";
    const refreshCb = vi.fn().mockResolvedValue(newToken);
    setOnTokenExpired(refreshCb);

    // First call → 401, second call → 200
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });

    const result = await fetchProducts();
    expect(refreshCb).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);

    // Second call should have the new token
    const secondCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    const headers = secondCall[1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${newToken}`);

    // cleanup
    setOnTokenExpired(null);
  });
});

// ---------------------------------------------------------------------------
// validateExcel
// ---------------------------------------------------------------------------

describe("validateExcel", () => {
  it("returns validate response", async () => {
    const mockResponse: ExcelValidateResponse = {
      filename: "test.xlsx",
      domain: "carbon",
      status: "warning",
      issues: [
        { level: "warning", message: "Feuille attendue manquante : 'Taxonomie'", sheet: "Taxonomie" },
      ],
      named_ranges_found: [],
      named_ranges_missing: ["scope1_tco2e"],
      sheets_found: ["Bilan GES", "Energie"],
      sheets_missing: ["Taxonomie"],
    };
    mockFetch(mockResponse);

    const file = new File(["fake content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await validateExcel(file, "carbon");

    expect(result.status).toBe("warning");
    expect(result.sheets_missing).toContain("Taxonomie");
    expect(result.issues[0].level).toBe("warning");
  });
});

// ---------------------------------------------------------------------------
// EsprStatus type guard
// ---------------------------------------------------------------------------

describe("EsprStatus values", () => {
  it("accepts all valid ESPR statuses", () => {
    const validStatuses: EsprStatus[] = ["pending", "eligible", "compliant", "non_compliant"];
    validStatuses.forEach((s) => {
      expect(typeof s).toBe("string");
    });
  });
});
