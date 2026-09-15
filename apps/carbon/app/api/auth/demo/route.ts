import { NextResponse } from "next/server";

import { DEMO } from "@/lib/demo-data";
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_TTL_SECONDS,
  DEMO_SESSION_USER,
} from "@/lib/demo/session";
import { checkDemoRateLimit } from "@/lib/rate-limit";
import { signJwt } from "@/lib/verify-jwt";

export const runtime = "nodejs";

function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",", 1)[0]?.trim();
  return firstForwardedIp || "unknown";
}

function isSecureCookie(): boolean {
  if (process.env.VERCEL === "1") return true;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development") return true;
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") === true;
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkDemoRateLimit(`ip:${getClientIp(request)}`);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Trop de demandes d'accès démo.", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(Math.max(1, rateLimit.retryAfterSeconds)),
          },
        },
      );
    }

    // Garde-fou : cette session ne peut être émise que si le dataset canonique
    // reste explicitement fictif. Aucune table users/companies n'est touchée.
    if (!DEMO.entreprise.fictif) {
      throw new Error("The demo dataset must remain fictitious");
    }

    const expiresAt = new Date(Date.now() + DEMO_SESSION_TTL_SECONDS * 1000);
    const token = await signJwt(
      {
        sub: DEMO_SESSION_USER.email,
        role: DEMO_SESSION_USER.role,
        cid: DEMO_SESSION_USER.companyId,
        demo: true,
        scope: "demo",
      },
      expiresAt,
    );

    const response = NextResponse.json(
      { ok: true, redirect: "/demo" },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set({
      name: DEMO_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json(
      {
        error: "Accès démo indisponible pour le moment.",
        code: "DEMO_SESSION_ERROR",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
