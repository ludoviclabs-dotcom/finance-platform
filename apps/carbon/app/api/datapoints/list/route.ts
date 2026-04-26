import { type NextRequest, NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/verify-jwt";
import { ESRS_SET2 } from "@/lib/esrs/schema";
import { loadState } from "@/lib/datapoints/store";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const state = await loadState(String(payload.cid));
  return NextResponse.json({
    version: ESRS_SET2.version,
    definitions: ESRS_SET2.datapoints,
    state,
  });
}
