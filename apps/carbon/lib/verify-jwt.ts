import { jwtVerify } from "jose";

export interface JwtPayload {
  sub: string;
  role: string;
  cid: number;
  exp: number;
}

const _DEV_SECRET = "dev-secret-change-me-in-production-0123456789abcdef";

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET ?? _DEV_SECRET;
  return new TextEncoder().encode(raw);
}

export async function verifyBearerToken(authHeader: string | null): Promise<JwtPayload | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function requireRole(payload: JwtPayload, allowed: string[]): boolean {
  return allowed.includes(payload.role);
}
