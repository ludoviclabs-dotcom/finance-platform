import { createHash } from "node:crypto";

export type OutilId = "ai-act-classifier" | "roi-calculator" | "maturity-quiz";

export const OUTIL_LABELS: Record<OutilId, string> = {
  "ai-act-classifier": "AI Act Classifier",
  "roi-calculator": "ROI Calculator",
  "maturity-quiz": "Maturity Quiz",
};

export const OUTIL_ROUTES: Record<OutilId, string> = {
  "ai-act-classifier": "/outils/ai-act-classifier",
  "roi-calculator": "/outils/roi",
  "maturity-quiz": "/outils/maturite",
};

export interface SignedReceipt<T> {
  tool: OutilId;
  toolLabel: string;
  payload: T;
  generatedAt: string;
  hash: string;
}

/**
 * Deterministic SHA-256 of (tool, payload, generatedAt). Canonical JSON
 * with sorted keys so the same inputs always produce the same hash.
 */
export function signReceipt<T>(
  tool: OutilId,
  payload: T,
  generatedAt: string = new Date().toISOString(),
): SignedReceipt<T> {
  const canonical = JSON.stringify(
    { tool, payload, generatedAt },
    canonicalReplacer,
  );
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return {
    tool,
    toolLabel: OUTIL_LABELS[tool],
    payload,
    generatedAt,
    hash,
  };
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

export function verifyUrl(hash: string): string {
  return `https://neural-ai.fr/verify/outil/${hash}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}
