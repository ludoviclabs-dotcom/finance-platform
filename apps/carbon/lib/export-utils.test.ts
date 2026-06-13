/**
 * export-utils.test.ts — T1.5 : neutralisation injection de formule (exports CSV/XLSX).
 */

import { describe, it, expect } from "vitest";
import { sanitizeCell, rowsToCsv } from "./export-utils";

describe("sanitizeCell — injection de formule", () => {
  it("préfixe les chaînes dangereuses", () => {
    expect(sanitizeCell("=HYPERLINK(\"http://evil\")")).toBe("'=HYPERLINK(\"http://evil\")");
    expect(sanitizeCell("+1")).toBe("'+1");
    expect(sanitizeCell("-2")).toBe("'-2");
    expect(sanitizeCell("@cmd")).toBe("'@cmd");
  });

  it("laisse les valeurs sûres intactes", () => {
    expect(sanitizeCell("ESRS E1")).toBe("ESRS E1");
    expect(sanitizeCell("a=b")).toBe("a=b");
    expect(sanitizeCell(123)).toBe(123);
    expect(sanitizeCell(null)).toBe(null);
  });
});

describe("rowsToCsv — neutralise les formules", () => {
  it("préfixe une cellule =formule dans le CSV", () => {
    const csv = rowsToCsv([{ nom: "=1+1", valeur: 10 }]);
    expect(csv).toContain("'=1+1");
    expect(csv).not.toMatch(/(^|;)=1\+1/);
  });
});
