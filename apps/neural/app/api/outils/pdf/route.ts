import { NextResponse } from "next/server";
import { z } from "zod";

import { buildOutilsPdf } from "@/lib/outils/pdf-builder";
import { buildAiActPdfInput } from "@/lib/outils/adapters/ai-act-classifier";
import { buildRoiPdfInput } from "@/lib/outils/adapters/roi-calculator";
import { buildMaturityPdfInput } from "@/lib/outils/adapters/maturity-quiz";
import { type OutilId } from "@/lib/outils/sign";

export const runtime = "nodejs";

const aiActRequestSchema = z.object({
  tool: z.literal("ai-act-classifier"),
  answers: z.record(z.string(), z.string()),
});

const roiRequestSchema = z.object({
  tool: z.literal("roi-calculator"),
  inputs: z.object({
    sector: z.string().min(1),
    branches: z.array(z.string().min(1)).min(1).max(7),
    users: z.number().int().positive().max(1_000_000),
    frequency: z.string().min(1),
  }),
});

const maturityRequestSchema = z.object({
  tool: z.literal("maturity-quiz"),
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
  answerIds: z.record(z.string(), z.string()).optional(),
});

const requestSchema = z.discriminatedUnion("tool", [
  aiActRequestSchema,
  roiRequestSchema,
  maturityRequestSchema,
]);

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
      return {
        bytes,
        hash: receipt.hash,
        filename: `neural-ai-act-classifier-${receipt.hash.slice(0, 8)}.pdf`,
      };
    }
    case "roi-calculator": {
      const { input, receipt } = buildRoiPdfInput(req.inputs);
      const bytes = await buildOutilsPdf(input);
      return {
        bytes,
        hash: receipt.hash,
        filename: `neural-roi-calculator-${receipt.hash.slice(0, 8)}.pdf`,
      };
    }
    case "maturity-quiz": {
      const { input, receipt } = buildMaturityPdfInput(req.answers, req.answerIds ?? {});
      const bytes = await buildOutilsPdf(input);
      return {
        bytes,
        hash: receipt.hash,
        filename: `neural-maturity-quiz-${receipt.hash.slice(0, 8)}.pdf`,
      };
    }
  }
}
