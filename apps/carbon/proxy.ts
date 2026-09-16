import { NextRequest, NextResponse } from "next/server";

import { DEMO_SESSION_COOKIE } from "@/lib/demo/session";

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
 *
 * Branche preview (VERCEL_ENV === "preview") : ouvre la barre d'outils Vercel
 * (commentaires de preview), selon la liste de la doc Vercel « Using a Content
 * Security Policy » (vercel.com/docs/vercel-toolbar/managing-toolbar) :
 * https://vercel.live en script/connect/frame/style/font-src,
 * wss://ws-us3.pusher.com en connect-src, https://assets.vercel.com en
 * font-src (img-src autorise déjà tout https:, data: et blob:).
 *
 * En production le CSP reste byte-identique à l'historique : aucune de ces
 * ouvertures n'y est ajoutée.
 *
 * Durcissement futur (P3) : nonce + 'strict-dynamic' après bascule en rendu
 * dynamique via `export const dynamic = 'force-dynamic'` sur les pages clés.
 */
export function buildCsp(): string {
  const isDev = process.env.NODE_ENV === "development";
  const isPreview = process.env.VERCEL_ENV === "preview";
  const VERCEL_TOOLBAR = "https://vercel.live";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://va.vercel-scripts.com",
    isDev ? "'unsafe-eval'" : null,
    isPreview ? VERCEL_TOOLBAR : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  const styleSrc = ["'self'", "'unsafe-inline'", isPreview ? VERCEL_TOOLBAR : null]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  const fontSrc = [
    "'self'",
    "data:",
    isPreview ? VERCEL_TOOLBAR : null,
    isPreview ? "https://assets.vercel.com" : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  const connectSrc = [
    "'self'",
    "https://*.vercel.app",
    "https://*.vercel.sh",
    "https://ai-gateway.vercel.sh",
    "https://api.anthropic.com",
    // Vercel Analytics & Speed Insights — pixel et data ingestion
    "https://vitals.vercel-insights.com",
    "https://va.vercel-scripts.com",
    // Sentry (report d'erreurs front) — actif uniquement si NEXT_PUBLIC_SENTRY_DSN défini
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://*.ingest.de.sentry.io",
    isDev ? "ws://localhost:*" : null,
    isDev ? "http://localhost:*" : null,
    isPreview ? VERCEL_TOOLBAR : null,
    isPreview ? "wss://ws-us3.pusher.com" : null,
  ]
    .filter((v): v is string => Boolean(v))
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob: https:",
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    // frame-src absent en production (repli sur default-src 'self').
    isPreview ? `frame-src 'self' ${VERCEL_TOOLBAR}` : null,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    // Reporting : legacy report-uri (Chrome, Firefox, Safari ≤15)
    //             + moderne report-to via le group défini dans Report-To header
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ]
    .filter((v): v is string => Boolean(v))
    .join("; ");
}

/**
 * Pages protégées à l'identique uniquement (sans leurs sous-chemins).
 * `/audit` est le journal authentifié ; `/audit/<token>` est le lien PUBLIC
 * remis à un auditeur invité (app/audit/[token], hors groupe `(app)`), qui
 * doit rester accessible même si le navigateur porte une session démo.
 */
const DEMO_PROTECTED_EXACT = ["/audit"];

const DEMO_PROTECTED_PREFIXES = [
  "/actions",
  "/admin",
  "/alerts",
  "/baselines",
  "/beges",
  "/consolidation",
  "/copilot",
  "/crma",
  "/dashboard",
  "/datapoints",
  "/diff",
  "/dpp",
  "/esrs",
  "/fec",
  "/finance",
  "/fournisseurs",
  "/history",
  "/imports",
  "/ingest",
  "/insights",
  "/intelligence",
  "/iro",
  "/materialite",
  "/nature",
  "/pricing",
  "/proof-twin",
  "/qc",
  "/reports",
  "/resources",
  "/review",
  "/revue",
  "/scopes",
  "/securite",
  "/sites-geo",
  "/social",
  "/upload",
  "/vsme",
  "/water/cockpit",
  "/water/decision",
];

function isPathOrChild(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isDemoProtectedPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) {
    // `/api/auth/demo` reste joignable en session démo : c'est lui qui la
    // consulte (GET) et la termine (DELETE — « Quitter la démo » sur /login).
    return pathname !== "/api/auth/demo" && pathname !== "/api/csp-report";
  }
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (DEMO_PROTECTED_EXACT.includes(normalized)) return true;
  return DEMO_PROTECTED_PREFIXES.some((prefix) => isPathOrChild(pathname, prefix));
}

function applySecurityHeaders(response: NextResponse): NextResponse {

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", buildCsp());

  return response;
}

export function proxy(request: NextRequest) {
  const demoSession = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (demoSession && isDemoProtectedPath(request.nextUrl.pathname)) {
    const response = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: "Cette route n'est pas disponible en mode démo.", code: "DEMO_SCOPE" },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        )
      : NextResponse.redirect(new URL("/demo", request.url));
    return applySecurityHeaders(response);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  // Exclut les assets Next et le endpoint de reporting CSP (inutile d'y
  // injecter des headers, et évite de charger le proxy à chaque report).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|api/csp-report).*)"],
};
