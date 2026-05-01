import { NextResponse } from "next/server";
import { z } from "zod";
import { createBillingPortalSession, isStripeConfigured } from "@/lib/stripe";
import { verifyBearerToken } from "@/lib/verify-jwt";

const Body = z.object({
  customerId: z.string().min(3),
});

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const auth = await verifyBearerToken(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const result = await createBillingPortalSession(parsed.customerId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ url: result.url });
}
