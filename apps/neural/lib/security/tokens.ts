import type { NextRequest } from "next/server";

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function readRequestToken(req: Request | NextRequest, headerName?: string): string {
  const auth = req.headers.get("authorization")?.trim();
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerToken = headerName ? req.headers.get(headerName)?.trim() ?? "" : "";
  return bearer || headerToken;
}

export function requireConfiguredToken(
  req: Request | NextRequest,
  options: {
    envKey: string;
    headerName?: string;
    allowDevWithoutToken?: boolean;
    missingMessage?: string;
    invalidMessage?: string;
  },
):
  | { ok: true; mode: "token" | "dev-bypass" }
  | { ok: false; status: 401; error: string } {
  const configuredToken = process.env[options.envKey]?.trim();

  if (!configuredToken) {
    if (options.allowDevWithoutToken && !isProductionRuntime()) {
      return { ok: true, mode: "dev-bypass" };
    }
    return {
      ok: false,
      status: 401,
      error:
        options.missingMessage ??
        `Configuration de sécurité manquante: ${options.envKey}.`,
    };
  }

  const receivedToken = readRequestToken(req, options.headerName);
  if (receivedToken !== configuredToken) {
    return {
      ok: false,
      status: 401,
      error: options.invalidMessage ?? "Token manquant ou invalide.",
    };
  }

  return { ok: true, mode: "token" };
}
