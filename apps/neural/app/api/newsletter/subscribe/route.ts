import { NextResponse } from "next/server";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.email !== "string") {
      return NextResponse.json(
        { ok: false, message: "Email requis." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RX.test(email) || email.length > 320) {
      return NextResponse.json(
        { ok: false, message: "Adresse email invalide." },
        { status: 400 },
      );
    }

    const domain = email.split("@")[1] ?? "unknown";
    console.info("[newsletter] Préinscription non persistée reçue.", { domain });

    return NextResponse.json(
      {
        ok: true,
        message:
          "Préinscription reçue. La liste automatisée n'est pas encore branchée; aucune promesse d'opt-in durable n'est faite.",
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "Erreur serveur." },
      { status: 500 },
    );
  }
}
