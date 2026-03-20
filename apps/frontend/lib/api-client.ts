import type { MAApiInput, MAApiOutput } from "./types/ma";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Generic JSON fetch wrapper.
 * Throws on non-ok responses with the status text.
 */
async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** POST /calculate/ma — run an M&A valuation via the backend. */
export function calculateMA(payload: MAApiInput): Promise<MAApiOutput> {
  return apiFetch<MAApiOutput>("/calculate/ma", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
