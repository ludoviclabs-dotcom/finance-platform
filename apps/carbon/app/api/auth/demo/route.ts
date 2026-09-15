import { NextResponse } from "next/server";

import { DEMO } from "@/lib/demo-data";
import {
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_TTL_SECONDS,
  DEMO_SESSION_USER,
} from "@/lib/demo/session";
import { checkDemoRateLimit } from "@/lib/rate-limit";
import { signJwt, verifyJwtToken } from "@/lib/verify-jwt";

export const runtime = "nodejs";

function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",", 1)[0]?.trim();
  return firstForwardedIp || "unknown";
}

function getCookieValue(request: Request, name: string): string | null {
  const prefix = `${name}=`;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

function isSecureCookie(): boolean {
  if (process.env.VERCEL === "1") return true;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development") return true;
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") === true;
}

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

export async function GET(request: Request) {
  const payload = await verifyJwtToken(getCookieValue(request, DEMO_SESSION_COOKIE));
  const isValidDemoSession =
    payload?.demo === true &&
    payload.scope === "demo" &&
    payload.sub === DEMO_SESSION_USER.email &&
    payload.cid === DEMO_SESSION_USER.companyId;

  if (!isValidDemoSession) {
    return NextResponse.json(
      { error: "Session démo absente ou expirée.", code: "DEMO_SESSION_REQUIRED" },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      isDemo: true,
      user: {
        email: DEMO_SESSION_USER.email,
        role: DEMO_SESSION_USER.role,
        company_id: DEMO_SESSION_USER.companyId,
        is_demo: true,
      },
    },
    { headers: noStoreHeaders() },
  );
}

/** Supprime la session démo avant un login réel ou lors d'une déconnexion. */
export function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
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
      { headers: noStoreHeaders() },
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
      { status: 500, headers: noStoreHeaders() },
    );
  }
}
