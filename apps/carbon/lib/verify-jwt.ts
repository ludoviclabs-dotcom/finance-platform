import { jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * Types de jetons signés avec AUTH_JWT_SECRET (partagé avec l'API FastAPI) :
 *   - "access"       : jeton d'accès émis par l'API après authentification complète ;
 *   - "totp_pending" : jeton pré-auth émis AVANT la saisie du code 2FA ;
 *   - "demo"         : cookie de session démo signé par le front.
 * Seul "access" ouvre les routes /api/* protégées (rapport QA 16/09/2026, B-02).
 */
export type JwtScope = "access" | "totp_pending" | "demo";

export interface JwtPayload {
  sub: string;
  role: string;
  cid: number;
  exp: number;
  uid?: number;
  demo?: boolean;
  scope?: JwtScope;
}

const ACCESS_SCOPE: JwtScope = "access";
const VALID_ROLES = new Set(["admin", "analyst", "viewer"]);

const _DEV_SECRET = "dev-secret-change-me-in-production-0123456789abcdef";

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET ?? _DEV_SECRET;
  return new TextEncoder().encode(raw);
}

export async function signJwt(
  payload: Omit<JwtPayload, "exp"> & Pick<JWTPayload, "iat">,
  expiresAt: Date,
): Promise<string> {
  const secret = process.env.AUTH_JWT_SECRET;
  const hostedEnvironment = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  if (!secret && hostedEnvironment) {
    throw new Error("AUTH_JWT_SECRET is required for hosted demo sessions");
  }

  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());
}

/**
 * Vérifie l'en-tête `Authorization: Bearer …` d'une route /api/* : seul un
 * jeton d'ACCÈS est accepté. Le jeton pré-auth 2FA porte aussi sub/role/cid —
 * sans ce contrôle, connaître le mot de passe suffisait à ouvrir ces routes
 * sans le second facteur.
 */
export async function verifyBearerToken(authHeader: string | null): Promise<JwtPayload | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return verifyAccessToken(token);
}

/** Jeton d'accès valide (signature, `exp` présent et non dépassé, scope, claims typés). */
export async function verifyAccessToken(token: string | null): Promise<JwtPayload | null> {
  const payload = await verifyJwtToken(token);
  if (!payload) return null;
  if (payload.scope !== ACCESS_SCOPE) return null;
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (!VALID_ROLES.has(payload.role)) return null;
  if (!Number.isInteger(payload.cid)) return null;
  return payload;
}

/**
 * Vérifie un JWT déjà extrait d'un cookie ou d'un header (signature et `exp`
 * obligatoires). N'impose aucun scope : l'appelant contrôle le type attendu
 * (cf. cookie démo, qui exige `scope === "demo"`).
 */
export async function verifyJwtToken(token: string | null): Promise<JwtPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function requireRole(payload: JwtPayload, allowed: string[]): boolean {
  return allowed.includes(payload.role);
}
