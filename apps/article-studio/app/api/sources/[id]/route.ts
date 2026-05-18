/**
 * GET /api/sources/[id]   → full source with parsed blocks
 * DELETE /api/sources/[id] → remove source (cascades chunks/citations)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!env.database.ready) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const source = await db.source.findUnique({ where: { id } });

  if (!source) {
    return NextResponse.json({ error: "Source introuvable." }, { status: 404 });
  }

  return NextResponse.json({ source });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!env.database.ready) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  try {
    await db.source.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Source introuvable." }, { status: 404 });
  }
}
