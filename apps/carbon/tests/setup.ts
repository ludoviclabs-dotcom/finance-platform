/**
 * Vitest setup — mock fetch globalement pour éviter les vraies requêtes HTTP.
 */
import { beforeEach, vi } from "vitest";

// Mock global fetch
global.fetch = vi.fn();

// next/font est une transformation de build : hors Next, on neutralise les
// variables de police de la peau Industry pour toute page qui les pose
// (/materials, /robotics, /water). Un fichier de test peut toujours redéclarer
// ce mock localement — c'est le même.
vi.mock("@/components/materials/industry/fonts", () => ({ industryFontVars: {} }));

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
