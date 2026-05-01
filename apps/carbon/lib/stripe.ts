/**
 * Stripe — helpers serveur pour Checkout, portail client et webhooks.
 *
 * Conception "fail-soft" :
 *   - Si la clé STRIPE_SECRET_KEY n'est pas définie, le helper renvoie null
 *     plutôt que de planter au boot. Ça permet de déployer l'UI Pricing sans
 *     bloquer la build, et de basculer Stripe en deuxième temps en ajoutant
 *     la clé dans les variables d'environnement Vercel.
 *
 * Variables d'environnement attendues :
 *   - STRIPE_SECRET_KEY            (sk_test_… ou sk_live_…)
 *   - STRIPE_WEBHOOK_SECRET        (whsec_…)
 *   - STRIPE_PRICE_STARTER         (price_… 490 €/mois)
 *   - STRIPE_PRICE_BUSINESS        (price_… 1 290 €/mois)
 *   - NEXT_PUBLIC_APP_URL          (https://carbonco.fr)
 */

export type StripePlanId = "starter" | "business";

export interface StripeCheckoutParams {
  plan: StripePlanId;
  customerEmail?: string;
  tenantId?: number;
}

export const STRIPE_PRICE_MAP: Record<StripePlanId, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Construit l'URL d'une session Stripe Checkout via l'API REST de Stripe sans
 * le SDK officiel. Cela évite d'imposer la dépendance `stripe` dans le bundle
 * tant que la fonctionnalité n'est pas activée. Une fois l'usage stabilisé,
 * on pourra basculer sur `import Stripe from "stripe"`.
 */
export async function createCheckoutSession(
  params: StripeCheckoutParams,
): Promise<{ url: string } | { error: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return { error: "Stripe n'est pas configuré sur cette instance." };
  }
  const priceId = STRIPE_PRICE_MAP[params.plan];
  if (!priceId) {
    return { error: `Aucun price Stripe configuré pour le plan ${params.plan}.` };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonco.fr";
  const body = new URLSearchParams();
  body.append("mode", "subscription");
  body.append("success_url", `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  body.append("cancel_url", `${appUrl}/#pricing`);
  body.append("line_items[0][price]", priceId);
  body.append("line_items[0][quantity]", "1");
  body.append("allow_promotion_codes", "true");
  body.append("billing_address_collection", "required");
  if (params.customerEmail) body.append("customer_email", params.customerEmail);
  if (params.tenantId !== undefined) {
    body.append("client_reference_id", String(params.tenantId));
    body.append("metadata[tenantId]", String(params.tenantId));
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    return { error: `Stripe API HTTP ${response.status}` };
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) return { error: "Stripe n'a pas renvoyé d'URL de session." };
  return { url: data.url };
}

export async function createBillingPortalSession(
  customerId: string,
): Promise<{ url: string } | { error: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { error: "Stripe n'est pas configuré sur cette instance." };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonco.fr";

  const body = new URLSearchParams();
  body.append("customer", customerId);
  body.append("return_url", `${appUrl}/dashboard`);

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!response.ok) return { error: `Stripe API HTTP ${response.status}` };
  const data = (await response.json()) as { url?: string };
  if (!data.url) return { error: "Stripe n'a pas renvoyé d'URL de portail." };
  return { url: data.url };
}
