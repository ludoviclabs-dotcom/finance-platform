import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("hash") ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(raw)) {
    return NextResponse.redirect(new URL("/verify/signature?error=format", url.origin));
  }
  return NextResponse.redirect(new URL(`/verify/signature/${raw}`, url.origin));
}
