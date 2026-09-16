/**
 * Tick quotidien : évaluation des règles d'alerte + rappels d'échéance BEGES
 * + relances des campagnes fournisseurs.
 *
 * Déclenché par Vercel Cron (planification « 0 6 * * * », cf. vercel.json).
 * Sur le plan Hobby, Vercel peut invoquer ce cron à n'importe quel moment de
 * l'heure indiquée (entre 06:00 et 06:59 UTC), et la livraison est « best
 * effort » : une exécution peut manquer ou être livrée deux fois — les
 * endpoints appelés sont idempotents au jour le jour. Le plan Hobby limitant
 * aussi la fréquence, ce handler orchestre TOUTES les tâches quotidiennes en
 * séquence, en best-effort (l'échec d'une étape n'empêche pas les suivantes).
 *
 * Sécurisation (modèle officiel Vercel) : Vercel envoie
 *   Authorization: Bearer <CRON_SECRET>
 * Sans CRON_SECRET configuré, ou avec un en-tête différent, la réponse est
 * 401. Aucun repli sur l'en-tête `x-vercel-cron` (falsifiable par n'importe
 * quel client).
 *
 * Les appels au backend portent CRON_SERVICE_TOKEN (même valeur à configurer
 * côté API) — voir require_cron_or_analyst dans apps/api/routers/auth.py.
 *
 * Statut HTTP du tick : 200 uniquement si TOUTES les étapes ont réussi,
 * 502 sinon (détail par étape dans le corps), 500 si l'URL de l'API n'est pas
 * configurée. « Vercel will not retry an invocation if a cron job fails »
 * (doc Vercel) : un statut non-2xx ne provoque donc aucune relance, il rend
 * seulement l'échec visible dans le journal des crons.
 */

import { NextResponse } from "next/server";

import { isAuthorizedCronRequest, resolveCronApiBaseUrl } from "./cron-support";

export const runtime = "nodejs";
// Force l'absence de cache pour que chaque cron tick recalcule.
export const dynamic = "force-dynamic";

/** Délai maximal d'une étape : un backend qui ne répond pas ne bloque pas le tick. */
const STEP_TIMEOUT_MS = 60_000;

interface StepResult {
  status: "ok" | "error";
  message?: string;
  [key: string]: unknown;
}

interface CronResult {
  status: "ok" | "error";
  message?: string;
  evaluated?: number;
  fired?: number;
  alerts?: StepResult;
  begesReminders?: StepResult;
  supplierReminders?: StepResult;
}

const NO_STORE = { "Cache-Control": "no-store" };

/** POST best-effort vers le backend — n'interrompt jamais le tick. */
async function callBackend(
  apiBase: string,
  path: string,
  serviceToken: string | null,
): Promise<StepResult> {
  if (!serviceToken) {
    return {
      status: "error",
      message: `CRON_SERVICE_TOKEN is not configured — ${path} not called (the API would answer 401).`,
    };
  }
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { status: "error", message: `Backend returned ${res.status} on ${path}` };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    // `status` posé en dernier : un champ `status` du backend ne doit pas
    // masquer le résultat réel de l'étape.
    return { ...data, status: "ok" };
  } catch (err) {
    return {
      status: "error",
      message: `${path}: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json<CronResult>(
      { status: "error", message: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const apiBase = resolveCronApiBaseUrl({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    API_BASE_URL: process.env.API_BASE_URL,
  });
  if (!apiBase) {
    const message = "API base URL is not configured (NEXT_PUBLIC_API_BASE_URL / API_BASE_URL).";
    console.error(`[cron/evaluate-alerts] ${message}`);
    return NextResponse.json<CronResult>(
      { status: "error", message },
      { status: 500, headers: NO_STORE },
    );
  }

  const serviceToken = process.env.CRON_SERVICE_TOKEN?.trim() || null;

  // 1. Évaluation des règles d'alerte (toutes organisations via le token de service).
  const alerts = await callBackend(apiBase, "/alerts/evaluate", serviceToken);

  // 2. Rappels d'échéance BEGES (J-180 / J-30 / échéance atteinte) — T7.2.
  const begesReminders = await callBackend(apiBase, "/beges/reminders/run", serviceToken);

  // 3. Relances des campagnes fournisseurs (J-14 / J-7 / deadline) — T7.3.
  const supplierReminders = await callBackend(
    apiBase,
    "/suppliers/campaigns/reminders/run",
    serviceToken,
  );

  const steps = { alerts, begesReminders, supplierReminders };
  const failed = Object.entries(steps).filter(([, step]) => step.status !== "ok");
  const allOk = failed.length === 0;

  if (!allOk) {
    console.error(
      "[cron/evaluate-alerts] failed steps:",
      failed.map(([name, step]) => `${name}: ${step.message ?? "unknown error"}`).join(" | "),
    );
  }

  return NextResponse.json<CronResult>(
    {
      status: allOk ? "ok" : "error",
      message: allOk ? undefined : `${failed.length} step(s) failed: ${failed.map(([n]) => n).join(", ")}`,
      evaluated: typeof alerts.evaluated === "number" ? alerts.evaluated : 0,
      fired: typeof alerts.fired === "number" ? alerts.fired : 0,
      ...steps,
    },
    { status: allOk ? 200 : 502, headers: NO_STORE },
  );
}
