/**
 * POST /api/datapoints/load-demo
 *
 * Charge un jeu de 30 datapoints ESRS Set 2 réalistes dans le state du tenant
 * courant pour permettre à un prospect de découvrir l'app sans uploader ses
 * propres documents.
 *
 * Sécurité :
 *   - JWT Bearer token obligatoire
 *   - Roles autorisés : analyst, admin, auditor, daf
 *   - Refuse si state non vide (409 Conflict) — protège contre l'écrasement
 *     accidentel de données réelles
 *
 * Réponse :
 *   200 { loaded: number, message: string }
 *   409 { error: "non_empty_state", current_count: number }
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifyBearerToken, requireRole } from "@/lib/verify-jwt";
import { loadState, saveState } from "@/lib/datapoints/store";
import { DEMO_DATAPOINTS, DEMO_DATAPOINT_COUNT } from "@/lib/datapoints/demo-state";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 1. Auth
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Role check
  if (!requireRole(payload, ["analyst", "admin", "auditor", "daf"])) {
    return NextResponse.json(
      { error: "Permission insuffisante (analyst, admin, auditor ou daf requis)" },
      { status: 403 },
    );
  }

  // 3. Vérifier state vide pour sécurité (ne pas écraser de vraies données)
  const cid = String(payload.cid);
  const current = await loadState(cid);
  const currentCount = Object.keys(current.datapoints).length;

  // Permet de forcer le rechargement avec ?force=true
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  if (currentCount > 0 && !force) {
    return NextResponse.json(
      {
        error: "non_empty_state",
        message: `Le state contient déjà ${currentCount} datapoint(s). Ajoutez ?force=true pour écraser.`,
        current_count: currentCount,
      },
      { status: 409 },
    );
  }

  // 4. Écriture du state démo
  await saveState({
    cid,
    updatedAt: new Date().toISOString(),
    datapoints: { ...DEMO_DATAPOINTS },
  });

  // 5. Réponse
  return NextResponse.json({
    loaded: DEMO_DATAPOINT_COUNT,
    message: `${DEMO_DATAPOINT_COUNT} datapoints démo chargés (E1, E2, E3, E5, S1, S2, G1).`,
    standards: ["E1", "E2", "E3", "E5", "S1", "S2", "G1"],
  });
}

/**
 * GET /api/datapoints/load-demo
 *
 * Healthcheck — retourne le nombre de datapoints démo disponibles.
 */
export async function GET() {
  return NextResponse.json({
    available: DEMO_DATAPOINT_COUNT,
    standards: ["E1", "E2", "E3", "E5", "S1", "S2", "G1"],
  });
}
