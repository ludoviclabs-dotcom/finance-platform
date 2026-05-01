import { NextResponse } from "next/server";

/**
 * Webhook Stripe — réception des évènements de paiement.
 *
 * Pour l'instant : récupération de l'évènement, vérification de signature et
 * journalisation côté serveur. La persistance (mise à jour du statut tenant)
 * sera branchée sur la base de données dans une seconde itération — le but de
 * ce premier endpoint est de garantir que Stripe ne reçoive pas de 404 et que
 * les évènements sont validés cryptographiquement.
 *
 * Vérification HMAC-SHA256 manuelle (pas de SDK Stripe) selon le format
 * "v1" de la signature dans l'en-tête `Stripe-Signature`.
 */

import crypto from "node:crypto";

export const runtime = "nodejs";

function verifySignature(body: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    }),
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;
  const payload = `${ts}.${body}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "webhook-not-configured" }, { status: 503 });
  }

  const sigHeader = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  if (!verifySignature(rawBody, sigHeader, secret)) {
    return NextResponse.json({ ok: false, reason: "invalid-signature" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid-json" }, { status: 400 });
  }

  // Évènements ciblés à brancher en base lors de la prochaine itération.
  const handled = new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ]);

  if (event.type && handled.has(event.type)) {
    // TODO(ludo): persister statut + tenant. Pour l'instant on accuse réception.
    console.info(`[stripe-webhook] received ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
