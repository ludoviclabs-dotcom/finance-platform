import { jwtVerify, SignJWT, type JWTPayload } from "jose";

export interface JwtPayload {
  sub: string;
  role: string;
  cid: number;
  exp: number;
  demo?: boolean;
  scope?: "demo";
}

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
