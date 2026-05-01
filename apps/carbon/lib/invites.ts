/**
 * Invitations utilisateurs.
 *
 * Stratégie sans DB pour cette première version : un token JWT signé contient
 * (tenantId, role, email invité, expiration). Le destinataire reçoit un lien
 * /invite/<token> qui, une fois cliqué, déclenche la création de compte côté
 * backend. La signature HMAC garantit que personne ne peut forger un token.
 *
 * Une fois la table `invites` ajoutée à la base, on remplacera la consommation
 * du token par un check en DB (`status = pending`, expiration, single-use).
 */

import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

const _DEV_SECRET = "dev-invite-secret-change-me-0123456789abcdef";

function getSecret(): Uint8Array {
  const raw = process.env.INVITE_JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? _DEV_SECRET;
  return new TextEncoder().encode(raw);
}

export interface InvitePayload {
  tenantId: number;
  invitedEmail: string;
  role: Role;
  invitedBy: string;
  exp: number;
}

export async function signInvite(
  payload: Omit<InvitePayload, "exp">,
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return new SignJWT({ ...payload, exp })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecret());
}

export async function verifyInvite(token: string): Promise<InvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload as unknown as InvitePayload;
  } catch {
    return null;
  }
}

/** URL absolue d'une invitation prête à envoyer par email. */
export function buildInviteUrl(token: string, base?: string): string {
  const root = base ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonco.fr";
  return `${root}/invite/${encodeURIComponent(token)}`;
}
