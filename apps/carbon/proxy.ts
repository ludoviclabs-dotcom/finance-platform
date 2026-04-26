import { NextResponse } from "next/server";

// Report-To group pointing to our internal collector endpoint
const REPORT_TO_GROUP = JSON.stringify({
  group: "csp-endpoint",
  max_age: 10886400,
  endpoints: [{ url: "/api/csp-report" }],
});

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Report-To": REPORT_TO_GROUP,
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
 * Branche dev (NODE_ENV === "development") :
 *  - script-src ajoute 'unsafe-eval' : Turbopack HMR et React reconstruisent
 *    les call stacks via eval() (uniquement en dev, jamais en prod).
 *  - connect-src ajoute ws://localhost:* + http://localhost:* pour la
 *    WebSocket de hot-reload Turbopack et les fetchs vers le dev server.
 *  En prod le CSP reste byte-identique à l'historique.
 *
 * Durcissement futur (P3) : nonce + 'strict-dynamic' après bascule en rendu
 * dynamique via `export const dynamic = 'force-dynamic'` sur les pages clés.
 */
function buildCsp(): string {
  const isDev = process.env.NODE_ENV === "development";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://va.vercel-scripts.com",
    isDev ? "'unsafe-eval'" : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  const connectSrc = [
    "'self'",
    "https://*.vercel.app",
    "https://*.vercel.sh",
    "https://ai-gateway.vercel.sh",
    "https://api.anthropic.com",
    isDev ? "ws://localhost:*" : null,
    isDev ? "http://localhost:*" : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    // Reporting : legacy report-uri (Chrome, Firefox, Safari ≤15)
    //             + moderne report-to via le group défini dans Report-To header
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

export function proxy() {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", buildCsp());

  return response;
}

export const config = {
  // Exclut les assets Next et le endpoint de reporting CSP (inutile d'y
  // injecter des headers, et évite de charger le proxy à chaque report).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|api/csp-report).*)"],
};
