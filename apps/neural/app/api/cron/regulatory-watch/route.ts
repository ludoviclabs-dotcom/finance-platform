/**
 * GET /api/cron/regulatory-watch
 *
 * Vercel Cron job: runs daily at 07:00 UTC.
 * Security: requires Authorization: Bearer <CRON_SECRET> in production.
 */

import { NextRequest } from "next/server";

import { runRegulatoryWatch } from "@/lib/regulatory";
import { requireConfiguredToken } from "@/lib/security/tokens";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = requireConfiguredToken(req, {
    envKey: "CRON_SECRET",
    allowDevWithoutToken: true,
    missingMessage: "CRON_SECRET doit être configuré pour exécuter cette tâche.",
    invalidMessage: "Token cron manquant ou invalide.",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const startedAt = Date.now();

  try {
    const results = await runRegulatoryWatch(3, false);

    const totalFetched = results.reduce((s, r) => s + r.fetched, 0);
    const totalNew = results.reduce((s, r) => s + r.newAlerts, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

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
