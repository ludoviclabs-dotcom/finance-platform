/**
 * POST /api/contact: formulaire de contact NEURAL.
 *
 * Validation serveur stricte. En production, l'envoi dépend de RESEND_API_KEY.
 */
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  company: z.string().min(1).max(200),
  need: z.string().min(2).max(200),
  context: z.string().min(10).max(4000),
  phone: z.string().max(80).optional().or(z.literal("")),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
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
  const { name, email, company, need, context, phone } = parsed.data;
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() || "contact@neural.fr";
  const toEmail = process.env.CONTACT_TO_EMAIL?.trim() || "ludoviclabs@gmail.com";

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [toEmail],
    replyTo: email,
    subject: `[NEURAL contact] ${company} - ${need}`,
    text: [
      `Nom: ${name}`,
      `Email: ${email}`,
      `Téléphone: ${phone?.trim() || "non renseigné"}`,
      `Société: ${company}`,
      `Besoin: ${need}`,
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
