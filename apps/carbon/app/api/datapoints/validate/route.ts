/**
 * POST /api/datapoints/validate
 *
 * Exécute le validateur ESRS Set 2 sur l'état datapoints du tenant courant
 * et retourne un rapport audit-grade :
 *  - findings (errors, warnings, infos)
 *  - score audit 0-100
 *  - complétude obligatoire %
 *
 * Pas de side-effect : pure lecture + calcul. Idempotent. Rejouable à volonté
 * (ex: avant chaque freeze de rapport, ou en preview en temps réel UI).
 *
 * Body optionnel :
 *   {
 *     standards?: string[];     // filtre les findings par standard (ex: ["E1","E5"])
 *     severities?: Severity[];  // filtre par sévérité
 *   }
 *
 * Réponse :
 *   { report: ValidationReport }
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/verify-jwt";
import { loadState } from "@/lib/datapoints/store";
import { runValidation, type Severity } from "@/lib/datapoints/validator";
import { RULES_SET2 } from "@/lib/datapoints/rules-set2";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ValidateBody {
  standards?: string[];
  severities?: Severity[];
}

const VALID_STANDARDS = new Set([
  "E1", "E2", "E3", "E4", "E5", "S1", "S2", "S3", "S4", "G1",
]);
const VALID_SEVERITIES: Severity[] = ["error", "warning", "info"];

export async function POST(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: ValidateBody = {};
  try {
    if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
      body = (await req.json()) as ValidateBody;
    }
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const standardsFilter = Array.isArray(body.standards)
    ? body.standards.filter((s): s is string => typeof s === "string" && VALID_STANDARDS.has(s))
    : null;
  const severityFilter = Array.isArray(body.severities)
    ? (body.severities.filter(
        (s): s is Severity =>
          typeof s === "string" && (VALID_SEVERITIES as string[]).includes(s),
      ) as Severity[])
    : null;

  const state = await loadState(String(payload.cid));

  // Filtrage des règles par standard si demandé
  const rules = standardsFilter
    ? RULES_SET2.filter(
        (r) => !r.standards || r.standards.some((s) => standardsFilter.includes(s)),
      )
    : RULES_SET2;

  const report = runValidation(state, rules);

  // Filtrage final par sévérité si demandé
  const findings = severityFilter
    ? report.findings.filter((f) => severityFilter.includes(f.severity))
    : report.findings;

  return NextResponse.json({
    report: {
      ...report,
      findings,
      counts: {
        error: findings.filter((f) => f.severity === "error").length,
        warning: findings.filter((f) => f.severity === "warning").length,
        info: findings.filter((f) => f.severity === "info").length,
      },
    },
  });
}

/**
 * GET /api/datapoints/validate — version pratique pour healthcheck/dev.
 * Retourne juste le score audit + counts, sans les findings détaillés.
 */
export async function GET(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const state = await loadState(String(payload.cid));
  const report = runValidation(state, RULES_SET2);
  return NextResponse.json({
    cid: report.cid,
    auditScore: report.auditScore,
    mandatoryFilledPct: report.mandatoryFilledPct,
    counts: report.counts,
    totalDatapoints: report.totalDatapoints,
    filledDatapoints: report.filledDatapoints,
    generatedAt: report.generatedAt,
  });
}
