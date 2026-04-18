/**
 * NEURAL — RegulatoryAlert Prisma store (Sprint 7)
 *
 * CRUD operations for the RegulatoryAlert table.
 * Deduplication is handled at upsert time via the unique externalId constraint.
 */

import { db } from "@/lib/db";
import type { ClassifiedAlert } from "./types";

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Upsert a classified alert.
 * Returns true if a new row was inserted, false if the externalId already existed.
 */
export async function upsertAlert(alert: ClassifiedAlert): Promise<boolean> {
  const existing = await db.regulatoryAlert.findUnique({
    where: { externalId: alert.externalId },
    select: { id: true },
  });

  if (existing) return false;

  await db.regulatoryAlert.create({
    data: {
      source: alert.source,
      externalId: alert.externalId,
      publishedAt: alert.publishedAt,
      title: alert.title,
      url: alert.url,
      impactScore: alert.impactScore,
      affectedAgents: alert.affectedAgents,
      summary: alert.summary,
      fullAnalysis: (alert.fullAnalysis ?? undefined) as
        | import("@prisma/client").Prisma.InputJsonValue
        | undefined,
    },
  });

  return true;
}

/**
 * Upsert a batch of classified alerts.
 * Returns { created, skipped } counts.
 */
export async function upsertAlerts(
  alerts: ClassifiedAlert[],
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const isNew = await upsertAlert(alert);
    if (isNew) created++;
    else skipped++;
  }

  return { created, skipped };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export type AlertFilter = {
  source?: string;
  minImpactScore?: number;
  affectedAgent?: string;
  since?: Date;
  limit?: number;
};

/** List alerts with optional filters. Ordered by publishedAt desc. */
export async function listAlerts(filter: AlertFilter = {}) {
  return db.regulatoryAlert.findMany({
    where: {
      ...(filter.source && { source: filter.source }),
      ...(filter.minImpactScore !== undefined && {
        impactScore: { gte: filter.minImpactScore },
      }),
      ...(filter.affectedAgent && {
        affectedAgents: { has: filter.affectedAgent },
      }),
      ...(filter.since && { publishedAt: { gte: filter.since } }),
    },
    orderBy: [{ impactScore: "desc" }, { publishedAt: "desc" }],
    take: filter.limit ?? 50,
  });
}

/** List high-impact alerts (score > 0.5) from the last N days. */
export async function listHighImpactAlerts(days = 7) {
  return listAlerts({
    minImpactScore: 0.5,
    since: new Date(Date.now() - days * 24 * 60 * 60 * 1_000),
    limit: 20,
  });
}

/** Get a single alert by externalId. */
export async function getAlert(externalId: string) {
  return db.regulatoryAlert.findUnique({ where: { externalId } });
}
