import { NextResponse } from "next/server";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Content Security Policy (enforced).
 *
 * Compromis pragmatique Next.js 16 + App Router :
 *  - script-src garde 'unsafe-inline' car les pages sont statiquement rendues
 *    et Next.js injecte ses scripts hydratation inline au build (le nonce par
 *    requête exigerait de forcer toutes les pages en dynamique).
 *  - style-src garde 'unsafe-inline' pour Tailwind 4 + framer-motion
 *    (inévitable sans refonte CSS-in-JS).
 *  - Le vrai gain sécurité vient de :
 *      • object-src 'none'       — bloque les plugins Flash/Java legacy
 *      • frame-ancestors 'none'  — bloque clickjacking
 *      • base-uri 'self'         — bloque injection de <base>
 *      • form-action 'self'      — bloque exfiltration via formulaires
 *      • connect-src whitelist   — bloque exfiltration AJAX vers domaines arbitraires
 *      • default-src 'self'      — tout le reste par défaut
 *
 * Durcissement futur (P3) : nonce + 'strict-dynamic' après bascule en rendu
 * dynamique via `export const dynamic = 'force-dynamic'` sur les pages clés.
 */
const CSP_ENFORCED = [
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

export function proxy() {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", CSP_ENFORCED);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
