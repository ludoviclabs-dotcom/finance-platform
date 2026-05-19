/**
 * POST /api/ingest
 *
 * Multipart upload of one or more files. For each file:
 *   1. Detect format from mime/filename
 *   2. Parse → ParsedDoc (blocks + metadata)
 *   3. Compute sha256 of normalized parsed text → dedup key
 *   4. Upsert Source row (status: READY on parse success, FAILED otherwise)
 *
 * Sprint 1: parsing only. Sprint 2 will add chunking + embeddings via waitUntil.
 *
 * Returns: { sources: Source[] }
 *   - 200 with per-file outcome (parsed.failed flag inside each source)
 *   - 400 if no files in body
 *   - 503 if database is not configured
 */

import { NextRequest, NextResponse, after } from "next/server";
import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { withGuardrails } from "@/lib/security";
import {
  parseSource,
  UnsupportedFormatError,
  EmptyDocumentError,
} from "@/lib/parsers";
import { indexSource } from "@/lib/vector-store/pipeline";
import type { ParsedDoc } from "@/lib/types/source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function sha256OfParsed(parsed: ParsedDoc): string {
  const canonical = parsed.blocks
    .map((b) => `${b.kind}|${b.level ?? ""}|${b.text}`)
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function inferMimeFromFile(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function handler(req: NextRequest): Promise<Response> {
  if (!env.database.ready) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL n'est pas configurée. Provisionne une base Neon et copie l'URL dans .env.local.",
      },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body invalide : multipart/form-data attendu." },
      { status: 400 },
    );
  }

  const files = formData.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "Aucun fichier reçu (champ 'file' attendu)." },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_FILE_SIZE) {
        return {
          filename: file.name,
          status: "FAILED" as const,
          errorMessage: `Fichier trop volumineux (${file.size} octets > ${MAX_FILE_SIZE}).`,
        };
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = inferMimeFromFile(file);

      try {
        const parsed = await parseSource({
          buffer,
          filename: file.name,
          mimeType,
        });
        const sha256 = sha256OfParsed(parsed);

        const existing = await db.source.findUnique({ where: { sha256 } });
        if (existing) {
          return {
            id: existing.id,
            filename: existing.filename,
            status: existing.status,
            deduped: true,
          };
        }

        const source = await db.source.create({
          data: {
            filename: parsed.filename,
            mimeType: parsed.mimeType,
            byteSize: buffer.byteLength,
            sha256,
            title: parsed.title,
            author: parsed.author,
            publishedAt: parsed.publishedAt,
            language: parsed.language ?? "fr",
            // Parsed; chunking + embedding runs in background below.
            status: "CHUNKING",
            metadata: {
              blockCount: parsed.blocks.length,
              blocks: parsed.blocks,
              parser: parsed.metadata,
            } as unknown as Prisma.InputJsonValue,
            parsedAt: new Date(),
          },
        });

        // Fire chunking + embedding in the background. The pipeline updates
        // Source.status itself (CHUNKING → EMBEDDING → READY) and persists
        // errorMessage on failure.
        if (env.embeddings.ready) {
          after(
            indexSource(source.id).catch((err) => {
              console.error(
                `[ingest] background indexing failed for ${source.id}:`,
                err instanceof Error ? err.message : err,
              );
            }),
          );
        }

        return {
          id: source.id,
          filename: source.filename,
          status: source.status,
          blockCount: parsed.blocks.length,
          indexingQueued: env.embeddings.ready,
        };
      } catch (err) {
        let errorMessage: string;
        if (err instanceof UnsupportedFormatError) {
          errorMessage = `Format non supporté : ${err.mimeType}.`;
        } else if (err instanceof EmptyDocumentError) {
          errorMessage = `Document vide ou non extractible (PDF scanné ?).`;
        } else if (err instanceof Error) {
          errorMessage = `Erreur de parsing : ${err.message}`;
        } else {
          errorMessage = "Erreur de parsing inconnue.";
        }

        const sha256 = createHash("sha256")
          .update(`fail:${file.name}:${buffer.byteLength}:${Date.now()}`)
          .digest("hex");

        const source = await db.source.create({
          data: {
            filename: file.name,
            mimeType,
            byteSize: buffer.byteLength,
            sha256,
            status: "FAILED",
            errorMessage,
          },
        });

        return {
          id: source.id,
          filename: source.filename,
          status: source.status,
          errorMessage,
        };
      }
    }),
  );

  return NextResponse.json({ sources: results }, { status: 200 });
}

export const POST = withGuardrails(handler);
