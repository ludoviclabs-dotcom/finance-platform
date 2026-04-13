/**
 * Vitest setup — mock fetch globalement pour éviter les vraies requêtes HTTP.
 */
import { beforeEach, vi } from "vitest";

// Mock global fetch
global.fetch = vi.fn();

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
