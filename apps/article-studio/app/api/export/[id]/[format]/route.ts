/**
 * GET /api/export/[id]/[format]
 *
 * Streams the article in the requested format with a download-friendly
 * Content-Disposition header. Supported formats are listed in EXPORT_FORMATS.
 */

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { exportArticle, EXPORT_FORMATS, type ExportFormat } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; format: string }> },
): Promise<Response> {
  const { id, format } = await ctx.params;

  if (!env.database.ready) {
    return NextResponse.json({ error: "DATABASE_URL absent." }, { status: 503 });
  }

  if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
    return NextResponse.json(
      { error: `Format inconnu: ${format}. Attendu: ${EXPORT_FORMATS.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const result = await exportArticle(id, format as ExportFormat);
    const body =
      typeof result.body === "string" ? result.body : new Uint8Array(result.body);
    return new Response(body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("introuvable") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
