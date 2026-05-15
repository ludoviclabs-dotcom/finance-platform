import { NextResponse } from "next/server";
import { z } from "zod";

import { buildOutilsPdf } from "@/lib/outils/pdf-builder";
import { buildAiActPdfInput } from "@/lib/outils/adapters/ai-act-classifier";
import { type OutilId } from "@/lib/outils/sign";

export const runtime = "nodejs";

const aiActRequestSchema = z.object({
  tool: z.literal("ai-act-classifier"),
  answers: z.record(z.string(), z.string()),
});

const requestSchema = aiActRequestSchema; // extended in follow-up commits

type ToolRequest = z.infer<typeof requestSchema>;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { tool } = parsed.data;
  const { bytes, hash, filename } = await renderToolPdf(parsed.data);

  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Tool-Id": tool satisfies OutilId,
      "X-Receipt-Hash": hash,
    },
  });
}

async function renderToolPdf(
  req: ToolRequest,
): Promise<{ bytes: Uint8Array; hash: string; filename: string }> {
  switch (req.tool) {
    case "ai-act-classifier": {
      const { input, receipt } = buildAiActPdfInput(req.answers);
      const bytes = await buildOutilsPdf(input);
      const filename = `neural-ai-act-classifier-${receipt.hash.slice(0, 8)}.pdf`;
      return { bytes, hash: receipt.hash, filename };
    }
  }
}
