/**
 * POST /api/contact — formulaire de contact NEURAL.
 *
 * Sprint P0 — remplace l'ancien mailto: client par un vrai submit serveur.
 *
 * - Validation Zod stricte (taille, présence des 4 champs).
 * - Envoi via Resend SDK.
 * - Dégrade en 503 si RESEND_API_KEY n'est pas provisionnée (la UI affiche
 *   un fallback "Écrivez à ludoviclabs@gmail.com").
 * - L'adresse destinataire est uniquement côté serveur (pas d'exposition bundle).
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const ContactSchema = z.object({
  name:    z.string().min(2).max(120),
  company: z.string().min(1).max(200),
  need:    z.string().min(2).max(200),
  context: z.string().min(10).max(4000),
});

export const runtime = "nodejs"; // Fluid Compute — Resend SDK requires Node.

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "email_not_configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const resend = new Resend(apiKey);
  const { name, company, need, context } = parsed.data;

  const { error } = await resend.emails.send({
    from:    process.env.CONTACT_FROM_EMAIL ?? "contact@neural.fr",
    to:      [process.env.CONTACT_TO_EMAIL  ?? "ludoviclabs@gmail.com"],
    subject: `[NEURAL contact] ${company} — ${need}`,
    text: [
      `Nom:     ${name}`,
      `Société: ${company}`,
      `Besoin:  ${need}`,
      "",
      "Contexte:",
      context,
      "",
      "---",
      "Reçu via /api/contact (NEURAL)",
    ].join("\n"),
  });

  if (error) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
