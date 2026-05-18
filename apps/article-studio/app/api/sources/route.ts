/**
 * GET /api/sources
 *
 * Returns the source library. Compact shape — metadata.blocks is stripped
 * to keep the response small. Use /api/sources/[id] for full block data.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.database.ready) {
    return NextResponse.json({ sources: [], dbReady: false }, { status: 200 });
  }

  const sources = await db.source.findMany({
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      status: true,
      errorMessage: true,
      title: true,
      author: true,
      publishedAt: true,
      language: true,
      uploadedAt: true,
      parsedAt: true,
    },
  });

  return NextResponse.json({ sources, dbReady: true });
}
