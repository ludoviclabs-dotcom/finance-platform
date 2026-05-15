import { NextResponse, type NextRequest } from "next/server";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/**
 * Hostnames that should be transparently mapped onto the /docs subtree of
 * the canonical site, so docs.neural-ai.fr/getting-started serves the same
 * content as neural-ai.fr/docs/getting-started. Configure the matching DNS
 * + Vercel project domain to actually receive traffic.
 */
const DOCS_HOSTS = new Set(["docs.neural-ai.fr", "docs.neural-ai.com"]);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase().split(":")[0];

  // Docs subdomain rewrite: docs.neural-ai.fr/foo -> /docs/foo (server-side).
  // Idempotent: paths that already start with /docs are passed through.
  if (DOCS_HOSTS.has(host) && !request.nextUrl.pathname.startsWith("/docs")) {
    const url = request.nextUrl.clone();
    url.pathname = url.pathname === "/" ? "/docs" : `/docs${url.pathname}`;
    const response = NextResponse.rewrite(url);
    applySecurityHeaders(response);
    response.headers.set("X-Docs-Subdomain", "1");
    return response;
  }

  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
