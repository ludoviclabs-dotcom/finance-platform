import { NextResponse } from "next/server";
import { z } from "zod";
import { buildInviteUrl, signInvite } from "@/lib/invites";
import { ROLES, type Role, can } from "@/lib/roles";
import { getTenantContext } from "@/lib/tenant";

const Body = z.object({
  email: z.email(),
  role: z.enum(ROLES),
});

export async function POST(req: Request) {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!can(ctx.role, "manage:users")) {
    return NextResponse.json(
      { error: "Vous n'avez pas le droit d'inviter des utilisateurs." },
      { status: 403 },
    );
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const token = await signInvite({
    tenantId: ctx.tenantId,
    invitedEmail: parsed.email.toLowerCase(),
    role: parsed.role as Role,
    invitedBy: ctx.userId,
  });

  const url = buildInviteUrl(token);
  // TODO(ludo): brancher l'envoi email (Resend/Postmark) une fois la clé en env.
  return NextResponse.json({ inviteUrl: url, expiresInDays: 7 });
}
