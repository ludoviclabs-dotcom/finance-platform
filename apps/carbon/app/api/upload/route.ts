import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

// Domain → expected filename pattern
const DOMAIN_FILENAMES: Record<string, string> = {
  carbon: "carbonco_carbon",
  esg: "carbonco_esg",
  finance: "carbonco_finance",
};

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function ext(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export async function POST(req: NextRequest) {
  // Auth check — read JWT from Authorization header
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData invalide" }, { status: 400 });
  }

  const results: Array<{
    domain: string;
    status: "ok" | "error";
    url?: string;
    filename?: string;
    detail?: string;
  }> = [];

  for (const domain of Object.keys(DOMAIN_FILENAMES)) {
    const file = formData.get(domain);
    if (!file || !(file instanceof File)) {
      results.push({ domain, status: "error", detail: "Fichier manquant" });
      continue;
    }

    // Validate extension
    if (!ALLOWED_EXTENSIONS.includes(ext(file.name))) {
      results.push({
        domain,
        status: "error",
        detail: `Extension non autorisée : ${ext(file.name)}. Attendu : .xlsx ou .xls`,
      });
      continue;
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      results.push({
        domain,
        status: "error",
        detail: `Fichier trop volumineux : ${(file.size / 1024 / 1024).toFixed(1)} Mo (max 10 Mo)`,
      });
      continue;
    }

    try {
      const pathname = `workbooks/${domain}/${DOMAIN_FILENAMES[domain]}.xlsx`;
      const blob = await put(pathname, file, {
        access: "public",
        allowOverwrite: true,
      });
      results.push({ domain, status: "ok", url: blob.url, filename: file.name });
    } catch (e) {
      results.push({
        domain,
        status: "error",
        detail: e instanceof Error ? e.message : "Erreur upload",
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
