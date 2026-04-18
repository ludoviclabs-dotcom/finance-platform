/**
 * GET /api/cron/regulatory-watch
 *
 * Vercel Cron job — runs daily at 07:00 UTC.
 * Scheduled in vercel.ts: { path: "/api/cron/regulatory-watch", schedule: "0 7 * * *" }
 *
 * Security: Vercel sends `Authorization: Bearer <CRON_SECRET>` when the env var
 * is set. Requests without a valid token are rejected with 401.
 *
 * Manual trigger (dev / ops):
 *   curl -X GET https://neural-five.vercel.app/api/cron/regulatory-watch \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextRequest } from "next/server";
import { runRegulatoryWatch } from "@/lib/regulatory";

export const maxDuration = 300; // Vercel max for hobby / Pro — classification can take time

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (token !== cronSecret) {
      return Response.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  // ── Run watch ────────────────────────────────────────────────────────────────
  const startedAt = Date.now();

  try {
    const results = await runRegulatoryWatch(
      3,    // look back 3 days
      false, // skip already-persisted publications
    );

    const totalFetched  = results.reduce((s, r) => s + r.fetched, 0);
    const totalNew      = results.reduce((s, r) => s + r.newAlerts, 0);
    const totalSkipped  = results.reduce((s, r) => s + r.skipped, 0);

    return Response.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      summary: { totalFetched, totalNew, totalSkipped },
      bySource: results,
    });
  } catch (err) {
    console.error("[cron/regulatory-watch] Fatal error:", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
