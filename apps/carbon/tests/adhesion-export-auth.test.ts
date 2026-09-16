/**
 * Contrat 1 — les exports du mapping stratégique sont tenant-scoped : la page
 * ne doit plus exposer de lien <a href> direct vers l'API (parti sans jeton,
 * donc 401). Le téléchargement authentifié est couvert dans api-contract.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../components/pages/adhesion-volontaire-page.tsx"),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("AdhesionVolontairePage — exports", () => {
  it("n'utilise plus de lien direct vers l'API", () => {
    expect(source).not.toMatch(/href=\{`\$\{API_BASE_URL\}/);
    expect(source).not.toContain("API_BASE_URL");
  });

  it("passe par le téléchargement authentifié", () => {
    expect(source).toContain("downloadStrategicMappingExport");
  });
});
