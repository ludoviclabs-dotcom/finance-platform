/**
 * Endpoint d'inscription newsletter — fail-soft.
 *
 * Comportement :
 *   - valide l'email côté serveur (regex simple + filtre jetables courants)
 *   - si NEWSLETTER_WEBHOOK_URL est configuré → POST l'email vers ce webhook
 *     (compatible Zapier, Make, n8n, formulaire Brevo/Mailchimp en mode webhook)
 *   - sinon → log côté serveur uniquement (utile pour le dev local)
 *
 * On choisit délibérément de ne pas dépendre d'un SDK fournisseur (Resend,
 * Mailchimp, ConvertKit) pour rester provider-agnostic. L'utilisateur final
 * branche sa propre tuyauterie via la variable d'environnement.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "trashmail.com",
  "yopmail.com",
  "tempmail.org",
]);

function isValidEmail(email: string): boolean {
  if (!EMAIL_REGEX.test(email)) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return false;
  return true;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body as { email?: unknown })?.email;
  const source = (body as { source?: unknown })?.source ?? "landing";

  if (typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Adresse email invalide." },
      { status: 422 }
    );
  }

  const webhook = process.env.NEWSLETTER_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source,
          timestamp: new Date().toISOString(),
          userAgent: req.headers.get("user-agent") ?? "",
        }),
      });
      if (!res.ok) {
        console.error("[newsletter] webhook returned", res.status);
        // On ne renvoie pas l'erreur au client : l'inscription reste valide
        // côté UX, on a juste perdu la transmission downstream.
      }
    } catch (err) {
      console.error("[newsletter] webhook failed", err);
    }
  } else {
    // Mode dev / non configuré : on log et on retourne OK.
    console.info(`[newsletter] subscription received (no webhook): ${email}`);
  }

  return NextResponse.json({
    ok: true,
    message: "Inscription enregistrée. À très vite.",
  });
}
