/**
 * POST /api/datapoints/review
 *
 * Workflow review des datapoints ESRS extraits par le copilote.
 * Permet à un auditeur (rôle analyst ou admin) d'accepter, surcharger
 * ou rejeter une valeur extraite.
 *
 * Body : ReviewActionBody
 * Réponse : 200 { datapointId, action, status, value, validatedBy, reviewedAt }
 *
 * Sécurité :
 *   - JWT Bearer token obligatoire (verifyBearerToken)
 *   - Seuls les rôles analyst, admin, auditor, daf peuvent écrire
 *   - Isolation tenant : seul le state du cid JWT est modifié
 *
 * Audit :
 *   - validatedBy (userId) stocké dans ExtractedDatapoint
 *   - reasoning mis à jour avec action + acteur pour traçabilité
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearerToken, requireRole } from "@/lib/verify-jwt";
import { loadState, upsertExtraction } from "@/lib/datapoints/store";
import { findDatapoint, type ExtractedDatapoint } from "@/lib/esrs/schema";

export const runtime = "nodejs";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Schema de la requête
// ---------------------------------------------------------------------------

const ReviewActionSchema = z.object({
  datapointId: z.string().min(1),
  action: z.enum(["accept", "override", "reject"]),
  /** Uniquement pour action "override" : nouvelle valeur à substituer. */
  overrideValue: z.union([z.number(), z.string(), z.boolean(), z.null()]).optional(),
  /** Justification obligatoire pour reject, optionnelle pour accept/override. */
  justification: z.string().max(2000).optional(),
});

type ReviewActionBody = z.infer<typeof ReviewActionSchema>;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Authentification
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Autorisation — seuls analyst et admin peuvent valider/rejeter
  if (!requireRole(payload, ["analyst", "admin", "auditor", "daf"])) {
    return NextResponse.json(
      { error: "Permission insuffisante (analyst ou admin requis)" },
      { status: 403 },
    );
  }

  // 3. Parse du body
  let body: ReviewActionBody;
  try {
    const raw = await req.json();
    body = ReviewActionSchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Corps de requête invalide",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  // 4. Validation sémantique
  if (body.action === "override" && body.overrideValue === undefined) {
    return NextResponse.json(
      { error: "overrideValue est obligatoire pour action=override" },
      { status: 400 },
    );
  }
  if (body.action === "reject" && !body.justification?.trim()) {
    return NextResponse.json(
      { error: "justification est obligatoire pour action=reject" },
      { status: 400 },
    );
  }

  // 5. Vérification que le datapointId est connu dans le référentiel ESRS Set 2
  const definition = findDatapoint(body.datapointId);
  if (!definition) {
    return NextResponse.json(
      { error: `Datapoint inconnu : ${body.datapointId}` },
      { status: 404 },
    );
  }

  // 6. Chargement du state pour ce tenant
  const cid = String(payload.cid);
  const state = await loadState(cid);
  const existing = state.datapoints[body.datapointId];

  if (!existing) {
    return NextResponse.json(
      {
        error: `Datapoint ${body.datapointId} non trouvé dans le state (pas encore extrait)`,
      },
      { status: 404 },
    );
  }

  // 7. Construction du datapoint mis à jour
  const now = new Date().toISOString();
  const actor = payload.sub;

  let updated: ExtractedDatapoint;

  switch (body.action) {
    case "accept":
      updated = {
        ...existing,
        status: "validated",
        validatedBy: actor,
        reasoning: body.justification
          ? `[Accepté ${now} par ${actor}] ${body.justification}`
          : (existing.reasoning ?? `[Accepté ${now} par ${actor}]`),
      };
      break;

    case "override":
      updated = {
        ...existing,
        status: "validated",
        value: body.overrideValue ?? null,
        validatedBy: actor,
        reasoning: `[Override ${now} par ${actor}]${body.justification ? ` ${body.justification}` : " Valeur corrigée manuellement"}`,
      };
      break;

    case "reject":
      updated = {
        ...existing,
        status: "rejected",
        validatedBy: actor,
        reasoning: `[Rejeté ${now} par ${actor}] ${body.justification!}`,
      };
      break;
  }

  // 8. Persistance dans Vercel Blob
  await upsertExtraction(cid, updated);

  // 9. Réponse
  return NextResponse.json({
    datapointId: body.datapointId,
    action: body.action,
    status: updated.status,
    value: updated.value,
    validatedBy: actor,
    reviewedAt: now,
    label: definition.label_fr,
    standard: definition.standard,
  });
}
