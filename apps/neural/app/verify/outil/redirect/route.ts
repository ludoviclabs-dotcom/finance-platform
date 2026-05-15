import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Tiny GET handler used as a form action: takes ?hash=... and redirects to
 * /verify/outil/{hash}. Lets the index page submit without client JS.
 */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("hash") ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(raw)) {
    return NextResponse.redirect(new URL("/verify/outil?error=format", url.origin));
  }
  return NextResponse.redirect(new URL(`/verify/outil/${raw}`, url.origin));
}
