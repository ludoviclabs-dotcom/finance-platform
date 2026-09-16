/**
 * GET /api/blob/source?ref=<URL Vercel Blob ou chemin> — consultation d'une
 * pièce source (citation RAG, document ingéré) du store PRIVÉ.
 *
 * Un lien direct vers un blob privé n'est pas lisible par le navigateur : la
 * pièce est servie ici, après vérification du jeton d'accès et de
 * l'appartenance de la pièce à l'organisation du jeton. Seul le PDF est
 * affiché en ligne (bac à sable CSP) ; tout autre type est téléchargé, pour
 * qu'aucun contenu déposé ne s'exécute sur l'origine de l'application.
 */

import { type NextRequest, NextResponse } from "next/server";

import { BlobAccessError, readTenantBlob } from "@/lib/blob/private-blob";
import { verifyBearerToken } from "@/lib/verify-jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_TYPES = new Set(["application/pdf"]);

function downloadName(pathname: string): string {
  const base = pathname.split("/").pop() ?? "document";
  return base.replace(/[^\w.-]+/g, "_").slice(0, 120) || "document";
}

export async function GET(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  try {
    const blob = await readTenantBlob(ref, payload.cid);
    const inline = INLINE_TYPES.has(blob.contentType);
    return new NextResponse(blob.buffer, {
      headers: {
        "Content-Type": inline ? blob.contentType : "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${downloadName(blob.pathname)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (err) {
    if (err instanceof BlobAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/blob/source] lecture impossible :", err);
    return NextResponse.json(
      { error: "Document momentanément indisponible. Réessayez dans quelques instants." },
      { status: 502 },
    );
  }
}
