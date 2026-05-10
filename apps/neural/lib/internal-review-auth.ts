import type { NextRequest } from "next/server";

export function getInternalReviewer(req: NextRequest):
  | { ok: true; reviewerId: string; mode: "token" | "dev-header" }
  | { ok: false; error: string; status: number } {
  const configuredToken = process.env.INTERNAL_REVIEW_TOKEN?.trim();
  const reviewerId = req.headers.get("x-reviewer-id")?.trim() || "internal-reviewer";

  if (!configuredToken) {
    if (!req.headers.get("x-reviewer-id")) {
      return {
        ok: false,
        error:
          "Reviewer non authentifié. Configurez INTERNAL_REVIEW_TOKEN en production ou x-reviewer-id en local.",
        status: 401,
      };
    }
    return { ok: true, reviewerId, mode: "dev-header" };
  }

  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerToken = req.headers.get("x-internal-review-token")?.trim();
  const receivedToken = bearer || headerToken;

  if (receivedToken !== configuredToken) {
    return {
      ok: false,
      error: "Token reviewer interne manquant ou invalide.",
      status: 401,
    };
  }

  return { ok: true, reviewerId, mode: "token" };
}
