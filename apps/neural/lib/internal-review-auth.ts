import type { NextRequest } from "next/server";

import { isProductionRuntime, readRequestToken } from "@/lib/security/tokens";

export function getInternalReviewer(req: NextRequest):
  | { ok: true; reviewerId: string; mode: "token" | "dev-header" }
  | { ok: false; error: string; status: number } {
  const configuredToken = process.env.INTERNAL_REVIEW_TOKEN?.trim();
  const reviewerId = req.headers.get("x-reviewer-id")?.trim() || "internal-reviewer";

  if (!configuredToken) {
    if (isProductionRuntime()) {
      return {
        ok: false,
        error: "Route interne verrouillée: INTERNAL_REVIEW_TOKEN doit être configuré en production.",
        status: 401,
      };
    }
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

  const receivedToken = readRequestToken(req, "x-internal-review-token");

  if (receivedToken !== configuredToken) {
    return {
      ok: false,
      error: "Token reviewer interne manquant ou invalide.",
      status: 401,
    };
  }

  return { ok: true, reviewerId, mode: "token" };
}
