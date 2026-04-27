import { NextResponse } from "next/server";

/**
 * POST /api/newsletter/subscribe
 *
 * Endpoint d'inscription newsletter. Posture honnête :
 * - Validation email côté serveur
 * - Pas de stockage immédiat — log côté serveur en attendant l'intégration
 *   Resend / Loops.so officielle (roadmap T3 2026)
 * - Pas de spam, pas de double opt-in artificiel
 *
 * En production : remplacer le log par un appel à Resend audiences
 * ou Loops.so pour persistence.
 */

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

    // Pour l'instant : log serveur (à remplacer par Resend audiences API en prod)
    console.log("[newsletter] Nouvelle inscription :", email);

    return NextResponse.json(
      {
        ok: true,
        message: "Inscription enregistrée.",
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
