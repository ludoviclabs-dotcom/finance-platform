import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { verifyBearerToken } from "@/lib/verify-jwt";

const Body = z.object({
  plan: z.enum(["starter", "business"]),
  customerEmail: z.email().optional(),
});

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Le paiement en ligne n'est pas encore activé. Contactez contact@carbonco.fr pour souscrire.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const auth = await verifyBearerToken(req.headers.get("authorization"));
  const tenantId = auth?.cid;

  const result = await createCheckoutSession({
    plan: parsed.plan,
    customerEmail: parsed.customerEmail ?? auth?.sub,
    tenantId,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ url: result.url });
}
