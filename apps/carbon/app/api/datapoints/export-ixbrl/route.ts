/**
 * POST /api/datapoints/export-ixbrl
 *
 * Génère un document iXBRL ESEF conforme EFRAG taxonomie 2024-12-04 à partir
 * des datapoints validés (ou extraits si allowDraft=true) du tenant courant.
 *
 * Body :
 *   {
 *     entity: { identifier: string, scheme?: string, name: string },
 *     period: { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" },
 *     allowDraft?: boolean,    // si true, inclut aussi statut "extracted" (non validés)
 *     reportId?: string,       // identifiant logique du rapport (default = tenant + period.endDate)
 *   }
 *
 * Réponse 200 :
 *   Content-Type : application/xhtml+xml
 *   Content-Disposition : attachment; filename="rapport-csrd-{cid}-{endDate}.xhtml"
 *   X-Facts-Tagged : nombre de faits réellement taggés
 *   X-Warnings : nombre d'alertes builder
 *   Body : XHTML iXBRL valide
 *
 * Sécurité :
 *   - JWT Bearer + role analyst|admin|auditor|daf
 *   - Isolation tenant : seuls les datapoints du cid JWT sont exportés
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearerToken, requireRole } from "@/lib/verify-jwt";
import { loadState } from "@/lib/datapoints/store";
import { buildIxbrl, type IxbrlFact } from "@/lib/ixbrl/builder";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Schema body
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ExportBodySchema = z.object({
  entity: z.object({
    identifier: z.string().min(1).max(64),
    scheme: z.string().url().optional(),
    name: z.string().min(1).max(256),
  }),
  period: z.object({
    startDate: z.string().regex(ISO_DATE_RE, "startDate doit être au format YYYY-MM-DD"),
    endDate: z.string().regex(ISO_DATE_RE, "endDate doit être au format YYYY-MM-DD"),
  }),
  allowDraft: z.boolean().optional().default(false),
  reportId: z.string().optional(),
});

const DEFAULT_LEI_SCHEME = "http://standards.iso.org/iso/17442";

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Auth
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!requireRole(payload, ["analyst", "admin", "auditor", "daf"])) {
    return NextResponse.json(
      { error: "Permission insuffisante (analyst, admin, auditor ou daf requis)" },
      { status: 403 },
    );
  }

  // 2. Body
  let body: z.infer<typeof ExportBodySchema>;
  try {
    const raw = await req.json();
    body = ExportBodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Corps de requête invalide",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  // 3. Cohérence dates
  if (body.period.startDate > body.period.endDate) {
    return NextResponse.json(
      { error: "startDate doit être antérieure à endDate" },
      { status: 400 },
    );
  }

  // 4. Charger le state du tenant
  const cid = String(payload.cid);
  const state = await loadState(cid);

  // 5. Filtrer les datapoints à exporter
  const acceptedStatuses = body.allowDraft
    ? new Set(["validated", "extracted"])
    : new Set(["validated"]);

  const facts: IxbrlFact[] = [];
  for (const [datapointId, extraction] of Object.entries(state.datapoints)) {
    if (!acceptedStatuses.has(extraction.status)) continue;
    if (extraction.value === null || extraction.value === undefined) continue;
    facts.push({
      datapointId,
      value: extraction.value,
    });
  }

  if (facts.length === 0) {
    return NextResponse.json(
      {
        error: "no_facts_to_export",
        message: body.allowDraft
          ? "Aucun datapoint extrait ou validé à exporter."
          : "Aucun datapoint validé. Validez au moins un datapoint dans /review ou activez allowDraft.",
      },
      { status: 422 },
    );
  }

  // 6. Construire le document iXBRL
  const result = buildIxbrl({
    reportId: body.reportId ?? `${cid}-${body.period.endDate}`,
    entity: {
      identifier: body.entity.identifier,
      scheme: body.entity.scheme ?? DEFAULT_LEI_SCHEME,
      name: body.entity.name,
    },
    period: body.period,
    facts,
    humanReadableTitle: `Rapport CSRD ${body.entity.name} ${body.period.startDate} → ${body.period.endDate}`,
  });

  // 7. Réponse — fichier téléchargeable
  const filename = `rapport-csrd-${cid}-${body.period.endDate}${body.allowDraft ? "-DRAFT" : ""}.xhtml`;
  return new NextResponse(result.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xhtml+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Facts-Tagged": String(result.factsTagged),
      "X-Facts-Skipped": String(result.factsSkipped),
      "X-Warnings": String(result.warnings.length),
      "Cache-Control": "no-store",
    },
  });
}

/**
 * GET /api/datapoints/export-ixbrl
 *
 * Healthcheck — retourne le nombre de datapoints exportables (validated)
 * et exportables-en-draft (validated + extracted) pour le tenant.
 */
export async function GET(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const cid = String(payload.cid);
  const state = await loadState(cid);

  let validated = 0;
  let extracted = 0;
  let rejected = 0;
  for (const e of Object.values(state.datapoints)) {
    if (e.value === null || e.value === undefined) continue;
    if (e.status === "validated") validated++;
    else if (e.status === "extracted") extracted++;
    else if (e.status === "rejected") rejected++;
  }

  return NextResponse.json({
    exportable_validated: validated,
    exportable_draft: validated + extracted,
    rejected,
    can_export: validated > 0,
    can_export_draft: validated + extracted > 0,
  });
}
