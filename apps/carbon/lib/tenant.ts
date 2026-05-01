/**
 * Multi-tenant — extraction du tenant courant depuis les requêtes.
 *
 * L'auth JWT existante porte déjà `cid` (company id) dans le payload. Ce
 * helper centralise la lecture pour que toutes les API protégées appliquent
 * la même logique d'isolation : `getTenantOrThrow(req)` retourne le tenantId
 * et garantit qu'aucun appel non authentifié ne franchit la frontière.
 */

import { verifyBearerToken, type JwtPayload } from "./verify-jwt";

export interface TenantContext {
  tenantId: number;
  userId: string;
  role: string;
  payload: JwtPayload;
}

export async function getTenantContext(req: Request): Promise<TenantContext | null> {
  const auth = await verifyBearerToken(req.headers.get("authorization"));
  if (!auth) return null;
  return {
    tenantId: auth.cid,
    userId: auth.sub,
    role: auth.role,
    payload: auth,
  };
}

export async function getTenantOrThrow(req: Request): Promise<TenantContext> {
  const ctx = await getTenantContext(req);
  if (!ctx) throw new Error("Authentication required");
  return ctx;
}

/** Filtre toute donnée sortante pour ne garder que celles du tenant courant. */
export function filterByTenant<T extends { tenantId: number }>(
  rows: readonly T[],
  tenantId: number,
): T[] {
  return rows.filter((row) => row.tenantId === tenantId);
}
