import { NextResponse } from "next/server";

/**
 * CSP violation reporting endpoint.
 *
 * Accepte deux formats :
 *   - `application/csp-report`       (legacy report-uri)
 *   - `application/reports+json`     (moderne report-to, array de reports)
 *
 * Rate limiting local : un client malicieux ne doit pas pouvoir saturer
 * nos logs Vercel en spammant ce endpoint. On accepte au plus 30 rapports
 * par minute et par IP, au-delà on drop silencieusement (204).
 *
 * Format de log : ligne JSON structurée, consommable par Sentry (P3-3).
 */

interface LegacyCspReport {
  "csp-report"?: {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: string;
    "blocked-uri"?: string;
    "status-code"?: number;
    "script-sample"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
  };
}

interface ModernCspReport {
  type?: string;
  url?: string;
  user_agent?: string;
  body?: {
    documentURL?: string;
    referrer?: string;
    blockedURL?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    sourceFile?: string;
    sample?: string;
    disposition?: string;
    statusCode?: number;
    lineNumber?: number;
    columnNumber?: number;
  };
}

// ---------------------------------------------------------------------------
// Rate limit local (token bucket simple, par IP, mémoire instance)
// ---------------------------------------------------------------------------
const IP_BUCKETS = new Map<string, { tokens: number; last: number }>();
const MAX_REPORTS_PER_MINUTE = 30;
const REFILL_RATE = MAX_REPORTS_PER_MINUTE / 60; // tokens/seconde
const MAX_BUCKETS = 5_000;

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}

function allow(ip: string): boolean {
  const now = Date.now() / 1000;
  const b = IP_BUCKETS.get(ip);
  if (!b) {
    if (IP_BUCKETS.size >= MAX_BUCKETS) {
      // GC basique : purge la moitié la plus ancienne
      const entries = [...IP_BUCKETS.entries()].sort((a, b) => a[1].last - b[1].last);
      for (let i = 0; i < entries.length / 2; i++) IP_BUCKETS.delete(entries[i][0]);
    }
    IP_BUCKETS.set(ip, { tokens: MAX_REPORTS_PER_MINUTE - 1, last: now });
    return true;
  }
  const elapsed = now - b.last;
  b.tokens = Math.min(MAX_REPORTS_PER_MINUTE, b.tokens + elapsed * REFILL_RATE);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

function normalizeReport(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;

  // Format legacy : { "csp-report": {...} }
  if ("csp-report" in raw) {
    const r = (raw as LegacyCspReport)["csp-report"];
    if (!r) return null;
    return {
      documentUri: r["document-uri"],
      blockedUri: r["blocked-uri"],
      violatedDirective: r["violated-directive"] ?? r["effective-directive"],
      sourceFile: r["source-file"],
      lineNumber: r["line-number"],
      columnNumber: r["column-number"],
      sample: r["script-sample"],
      disposition: r.disposition,
      format: "legacy",
    };
  }

  // Format moderne : { type, body: {...} }
  const m = raw as ModernCspReport;
  if (m.body) {
    return {
      documentUri: m.body.documentURL,
      blockedUri: m.body.blockedURL,
      violatedDirective: m.body.effectiveDirective,
      sourceFile: m.body.sourceFile,
      lineNumber: m.body.lineNumber,
      columnNumber: m.body.columnNumber,
      sample: m.body.sample,
      disposition: m.body.disposition,
      format: "modern",
    };
  }

  return null;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  if (!allow(ip)) {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Le format moderne envoie un array de reports, le legacy un objet seul
  const items = Array.isArray(payload) ? payload : [payload];

  for (const item of items) {
    const report = normalizeReport(item);
    if (!report) continue;

    // Log structuré JSON — ingéré tel quel par Vercel Logs et plus tard Sentry
    console.warn(
      JSON.stringify({
        event: "csp_violation",
        timestamp: new Date().toISOString(),
        ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
        ...report,
      }),
    );
  }

  return new NextResponse(null, { status: 204 });
}

// GET pour permettre un healthcheck manuel du endpoint
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "csp-report" });
}
