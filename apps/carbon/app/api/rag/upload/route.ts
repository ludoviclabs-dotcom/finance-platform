import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".xls"];
const ALLOWED_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

function ext(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

function safeBaseName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "doc";
}

export type RagUploadFileResult = {
  status: "ok" | "error";
  filename: string;
  url?: string;
  blobPath?: string;
  mimeType?: string;
  size?: number;
  detail?: string;
};

export async function POST(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!requireRole(payload, ["admin", "analyst"])) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalide" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "Aucun fichier fourni dans le champ 'files'." },
      { status: 400 },
    );
  }

  const results: RagUploadFileResult[] = [];

  for (const file of files) {
    const e = ext(file.name);
    if (!ALLOWED_EXTENSIONS.includes(e)) {
      results.push({
        status: "error",
        filename: file.name,
        detail: `Extension non autorisée : ${e}. Attendu : ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
      continue;
    }
    if (file.size > MAX_SIZE_BYTES) {
      results.push({
        status: "error",
        filename: file.name,
        detail: `Trop volumineux : ${(file.size / 1024 / 1024).toFixed(1)} Mo (max 25 Mo)`,
      });
      continue;
    }
    if (file.type && !ALLOWED_MIMETYPES.has(file.type)) {
      results.push({
        status: "error",
        filename: file.name,
        detail: `Type MIME non autorisé : ${file.type}`,
      });
      continue;
    }

    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const pathname = `workbooks/company-${payload.cid}/docs/${safeBaseName(file.name)}-${ts}${e}`;
      const blob = await put(pathname, file, {
        access: "public",
        allowOverwrite: false,
        addRandomSuffix: true,
      });
      results.push({
        status: "ok",
        filename: file.name,
        url: blob.url,
        blobPath: blob.pathname,
        mimeType: file.type || undefined,
        size: file.size,
      });
    } catch (err) {
      results.push({
        status: "error",
        filename: file.name,
        detail: err instanceof Error ? err.message : "Erreur upload",
      });
    }
  }

  const allOk = results.every((r) => r.status === "ok");
  const anyOk = results.some((r) => r.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "ok" : anyOk ? "partial" : "error",
      files: results,
    },
    { status: allOk ? 200 : anyOk ? 207 : 400 },
  );
}
