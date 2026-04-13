import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Security headers applied to every response. */
const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  // COOP/CORP : isolation cross-origin pour réduire la surface d'attaque
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Content Security Policy (report-only).
 *
 * Mode report-only pour 7-14 jours afin d'identifier les sources légitimes
 * (Vercel Analytics, AI Gateway, etc.) avant de basculer en mode enforced.
 *
 * - 'unsafe-inline' style toléré pour Tailwind/framer-motion (à durcir avec nonce en P2)
 * - 'unsafe-eval' évité — Next.js 16 + Turbopack n'en a pas besoin en prod
 * - connect-src élargi pour le backend FastAPI + AI Gateway Vercel
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.vercel.app https://*.vercel.sh https://ai-gateway.vercel.sh https://api.anthropic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);

  return response;
}

export const config = {
  // Apply to all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
