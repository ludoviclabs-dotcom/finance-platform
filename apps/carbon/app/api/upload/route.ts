/**
 * POST /api/upload — archive les classeurs Excel du client dans Vercel Blob.
 *
 * Les pièces client ne doivent jamais être joignables par simple URL : dépôt
 * en `access: "private"` (le store du projet est configuré en Private), et la
 * réponse ne renvoie aucune URL de blob — seulement le chemin de stockage.
 * Une lecture ultérieure passera par une route serveur authentifiée
 * (`get(pathname, { access: "private" })`), jamais par un fetch public.
 *
 * Les échecs de stockage sont journalisés côté serveur (console.error) et
 * traduits en messages présentables (./upload-errors).
 */

import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";

import { describeBlobUploadError, STORAGE_NOT_CONFIGURED_MESSAGE } from "./upload-errors";

// Domain → expected filename pattern
const DOMAIN_FILENAMES: Record<string, string> = {
  carbon: "carbonco_carbon",
  esg: "carbonco_esg",
  finance: "carbonco_finance",
};

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const ALLOWED_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function ext(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export async function POST(req: NextRequest) {
  // Auth check — verify JWT signature, not just header presence
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

  const results: Array<{
    domain: string;
    status: "ok" | "error";
    /** Chemin dans le store privé (jamais d'URL publique). */
    pathname?: string;
    filename?: string;
    detail?: string;
  }> = [];

  // Sans jeton, chaque `put` échouerait avec « Vercel Blob: No token found… » :
  // on journalise une fois et on répond un message présentable.
  const storageConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!storageConfigured) {
    console.error("[api/upload] BLOB_READ_WRITE_TOKEN is not configured — uploads are disabled.");
  }

  for (const domain of Object.keys(DOMAIN_FILENAMES)) {
    const file = formData.get(domain);
    // Domaine non envoyé : l'import partiel est permis (un seul classeur a pu
    // changer), ce n'est pas une erreur à afficher.
    if (file === null) continue;
    if (!(file instanceof File)) {
      results.push({ domain, status: "error", detail: "Fichier invalide" });
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

    // Validate MIME type
    if (file.type && !ALLOWED_MIMETYPES.includes(file.type)) {
      results.push({
        domain,
        status: "error",
        detail: `Type MIME non autorisé : ${file.type}`,
      });
      continue;
    }

    if (!storageConfigured) {
      results.push({ domain, status: "error", detail: STORAGE_NOT_CONFIGURED_MESSAGE });
      continue;
    }

    try {
      // Scoping multi-tenant : chaque company a son propre namespace
      // Horodatage pour éviter les collisions et désactiver l'écrasement silencieux
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const pathname = `workbooks/company-${payload.cid}/${domain}/${DOMAIN_FILENAMES[domain]}-${ts}.xlsx`;
      const blob = await put(pathname, file, {
        access: "private",
        allowOverwrite: false,
        addRandomSuffix: true,
      });
      results.push({ domain, status: "ok", pathname: blob.pathname, filename: file.name });
    } catch (e) {
      console.error(`[api/upload] Blob upload failed for domain "${domain}":`, e);
      results.push({
        domain,
        status: "error",
        detail: describeBlobUploadError(e),
      });
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      { status: "error", files: [], error: "Aucun fichier reçu." },
      { status: 400 },
    );
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
