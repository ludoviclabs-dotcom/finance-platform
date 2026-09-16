import { get } from "@vercel/blob";

/**
 * Accès aux pièces clientes dans le store Vercel Blob du projet (configuré en
 * PRIVÉ). Toute lecture passe par ici :
 *   - la référence (URL Vercel Blob ou chemin) doit appartenir à l'espace de
 *     l'organisation du jeton (`workbooks/company-<cid>/`) ;
 *   - la lecture utilise le jeton du store (`get(…, { access: "private" })`),
 *     jamais un `fetch` d'URL fournie par le client (SSRF : l'ingestion RAG
 *     téléchargeait n'importe quelle URL reçue dans la requête).
 */

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export class BlobAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404,
  ) {
    super(message);
    this.name = "BlobAccessError";
  }
}

export function tenantPrefix(cid: string | number): string {
  return `workbooks/company-${cid}/`;
}

/**
 * Chemin de stockage d'une référence si — et seulement si — elle appartient à
 * l'organisation `cid`. `null` sinon (autre organisation, autre hôte,
 * traversée de chemin, URL invalide).
 */
export function tenantBlobPath(ref: string, cid: string | number): string | null {
  let pathname = ref.trim();
  if (!pathname) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathname)) {
    let url: URL;
    try {
      url = new URL(pathname);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || !url.hostname.endsWith(BLOB_HOST_SUFFIX)) return null;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return null;
    }
  }
  pathname = pathname.replace(/^\/+/, "");
  if (pathname.split("/").some((segment) => segment === ".." || segment === ".")) return null;
  if (pathname.includes("\\")) return null;
  return pathname.startsWith(tenantPrefix(cid)) ? pathname : null;
}

export interface TenantBlob {
  pathname: string;
  buffer: ArrayBuffer;
  contentType: string;
}

/** Lit une pièce de l'organisation dans le store privé. */
export async function readTenantBlob(ref: string, cid: string | number): Promise<TenantBlob> {
  const pathname = tenantBlobPath(ref, cid);
  if (!pathname) {
    throw new BlobAccessError("Document hors de l'espace de votre organisation.", 403);
  }
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new BlobAccessError("Document introuvable.", 404);
  }
  const buffer = await new Response(result.stream).arrayBuffer();
  return {
    pathname,
    buffer,
    contentType: result.blob.contentType || "application/octet-stream",
  };
}
