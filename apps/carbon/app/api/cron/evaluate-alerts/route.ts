/**
 * Tick quotidien : évaluation des règles d'alerte + rappels d'échéance BEGES
 * + relances des campagnes fournisseurs.
 *
 * Appelé par Vercel Cron à 06:00 UTC chaque jour (cf. vercel.json). Le plan
 * Vercel Hobby limite le nombre de crons : ce route handler orchestre donc
 * TOUTES les tâches quotidiennes en séquence, en best-effort (l'échec d'une
 * étape n'empêche pas les suivantes).
 *
 * Sécurisation : Vercel Cron envoie automatiquement l'en-tête
 *   Authorization: Bearer <CRON_SECRET>
 * Si la variable d'environnement CRON_SECRET est définie, on vérifie qu'elle
 * correspond. Sinon (mode dev / non configuré) on refuse les appels publics
 * via une vérification d'en-tête `x-vercel-cron`.
 *
 * Les appels au backend portent CRON_SERVICE_TOKEN (même valeur à configurer
 * côté API) — voir require_cron_or_analyst dans apps/api/routers/auth.py.
 *
 * Dans tous les cas, on renvoie un statut JSON pour le monitoring Vercel.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Force l'absence de cache pour que chaque cron tick recalcule.
export const dynamic = "force-dynamic";

interface StepResult {
  status: "ok" | "skipped" | "error";
  message?: string;
  [key: string]: unknown;
}

interface CronResult {
  status: "ok" | "skipped" | "error";
  evaluated?: number;
  fired?: number;
  message?: string;
  begesReminders?: StepResult;
  supplierReminders?: StepResult;
}

/** POST best-effort vers le backend — n'interrompt jamais le tick. */
async function callBackend(apiBase: string, path: string): Promise<StepResult> {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CRON_SERVICE_TOKEN
          ? { Authorization: `Bearer ${process.env.CRON_SERVICE_TOKEN}` }
          : {}),
      },
    });
    if (!res.ok) {
      return { status: "error", message: `Backend returned ${res.status} on ${path}` };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: "ok", ...data };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
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

  // 1. Évaluation des règles d'alerte (comportement historique).
  const alerts = await callBackend(apiBase, "/alerts/evaluate");

  // 2. Rappels d'échéance BEGES (J-180 / J-30 / échéance atteinte) — T7.2.
  const begesReminders = await callBackend(apiBase, "/beges/reminders/run");

  // 3. Relances des campagnes fournisseurs (J-14 / J-7 / deadline) — T7.3.
  const supplierReminders = await callBackend(apiBase, "/suppliers/campaigns/reminders/run");

  const overall: CronResult = {
    status: alerts.status === "ok" ? "ok" : alerts.status,
    evaluated: typeof alerts.evaluated === "number" ? alerts.evaluated : 0,
    fired: typeof alerts.fired === "number" ? alerts.fired : 0,
    message: alerts.message,
    begesReminders,
    supplierReminders,
  };

  // Le tick reste 200 même si une étape échoue : le détail par étape suffit au
  // monitoring, et un 5xx ferait re-tenter Vercel inutilement.
  return NextResponse.json<CronResult>(overall);
}
