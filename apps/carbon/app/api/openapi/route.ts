import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";

/**
 * GET /api/openapi
 *
 * Sert la spécification OpenAPI 3.1 de l'API publique CarbonCo au format JSON.
 * Construit dynamiquement à partir du tableau ENDPOINTS (lib/openapi.ts) qui
 * sert aussi la page de documentation /dev — source unique de vérité.
 *
 * Caching : public, 5 minutes (CDN edge), revalidation côté serveur sur build.
 */
export const runtime = "edge";

export async function GET() {
  const spec = buildOpenApiSpec();
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
