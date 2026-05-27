/**
 * NEURAL - AeroRegWatch cron endpoint
 *
 * GET /api/cron/aero-regwatch
 *
 * Déclenché quotidiennement par Vercel Cron (cf. vercel.json) ou
 * manuellement (avec CRON_SECRET en Authorization Bearer). Fetch toutes
 * les sources déclarées dans REGWATCH_SOURCES, calcule leur hash et
 * persiste les changements via Upstash Redis.
 *
 * Réponse 200 toujours quand le run termine, même si certaines sources
 * échouent — pour ne pas empêcher Vercel de retry le cron suivant.
 * Les erreurs individuelles sont remontées dans le body.
 */
import { NextResponse } from "next/server";

import { checkAll } from "@/lib/aero-regwatch/watch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel Cron envoie un header Authorization: Bearer <CRON_SECRET>
  // quand la variable d'env CRON_SECRET est configurée sur le projet.
  // En local ou si CRON_SECRET n'est pas set, on accepte l'appel.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const start = Date.now();
  const outcomes = await checkAll();

  const successes = outcomes.filter((o) => o.ok);
  const failures = outcomes.filter((o) => !o.ok);
  const changed = successes.filter(
    (o) => o.ok && (o.snapshot.status === "changed" || o.snapshot.status === "first_run"),
  );

  return NextResponse.json(
    {
      ok: failures.length === 0,
      runtimeMs: Date.now() - start,
      summary: {
        total: outcomes.length,
        succeeded: successes.length,
        failed: failures.length,
        changedOrFirstRun: changed.length,
      },
      outcomes,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "x-neural-aero-regwatch-changed": String(changed.length),
        "x-neural-aero-regwatch-failed": String(failures.length),
      },
    },
  );
}
