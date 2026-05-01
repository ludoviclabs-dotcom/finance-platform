/**
 * Évaluation automatique quotidienne des règles d'alerte.
 *
 * Appelé par Vercel Cron à 06:00 UTC chaque jour (cf. vercel.json).
 *
 * Sécurisation : Vercel Cron envoie automatiquement l'en-tête
 *   Authorization: Bearer <CRON_SECRET>
 * Si la variable d'environnement CRON_SECRET est définie, on vérifie qu'elle
 * correspond. Sinon (mode dev / non configuré) on refuse les appels publics
 * via une vérification d'en-tête `x-vercel-cron`.
 *
 * Dans tous les cas, on renvoie un statut JSON pour le monitoring Vercel.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Force l'absence de cache pour que chaque cron tick recalcule.
export const dynamic = "force-dynamic";

interface CronResult {
  status: "ok" | "skipped" | "error";
  evaluated?: number;
  fired?: number;
  message?: string;
}

export async function GET(req: Request) {
  // Vérification d'authentification cron.
  const authHeader = req.headers.get("authorization");
  const cronHeader = req.headers.get("x-vercel-cron");
  const expected = process.env.CRON_SECRET;

  if (expected) {
    if (authHeader !== `Bearer ${expected}`) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }
  } else {
    // Pas de secret configuré : seul Vercel Cron (qui pose `x-vercel-cron: 1`)
    // peut déclencher cet endpoint en production.
    if (process.env.NODE_ENV === "production" && !cronHeader) {
      return NextResponse.json(
        { status: "error", message: "Forbidden — CRON_SECRET not configured" },
        { status: 403 }
      );
    }
  }

  // Appel au backend d'évaluation. Le backend FastAPI expose POST /alerts/evaluate
  // (cf. lib/api.ts → evaluateAlerts). On utilise un appel HTTP direct ici car
  // ce route handler tourne en edge/node sans contexte utilisateur.
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!apiBase) {
    return NextResponse.json<CronResult>(
      {
        status: "skipped",
        message: "API_BASE not configured — cron evaluation skipped.",
      },
      { status: 200 }
    );
  }

  try {
    const res = await fetch(`${apiBase}/alerts/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Service-to-service token (à configurer côté API si nécessaire).
        ...(process.env.CRON_SERVICE_TOKEN
          ? { Authorization: `Bearer ${process.env.CRON_SERVICE_TOKEN}` }
          : {}),
      },
      // Pas de body : l'API évalue toutes les règles actives tous tenants confondus
      // ou applique son propre filtrage selon le token.
    });

    if (!res.ok) {
      return NextResponse.json<CronResult>(
        {
          status: "error",
          message: `Backend returned ${res.status}`,
        },
        { status: 502 }
      );
    }

    const data = (await res.json().catch(() => ({}))) as {
      evaluated?: number;
      fired?: number;
    };

    return NextResponse.json<CronResult>({
      status: "ok",
      evaluated: data.evaluated ?? 0,
      fired: data.fired ?? 0,
    });
  } catch (err) {
    return NextResponse.json<CronResult>(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
