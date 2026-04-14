import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { checkCopilotRateLimit } from "@/lib/rate-limit";
import { verifyBearerToken } from "@/lib/verify-jwt";

export const maxDuration = 60;

interface DomainSource {
  available: boolean;
  stale?: boolean;
  cachedAt?: string | null;
}

interface CopilotToolsBundle {
  generatedAt?: string;
  carbon?: {
    source?: DomainSource;
    totalS123Tco2e?: number | null;
    scope1Tco2e?: number | null;
    scope2LbTco2e?: number | null;
    scope3Tco2e?: number | null;
    intensityRevenueTco2ePerMEur?: number | null;
    turnoverAlignedPct?: number | null;
    renewableSharePct?: number | null;
    targetReductionS12Pct?: number | null;
    estimatedCbamCostEur?: number | null;
    company?: string | null;
    reportingYear?: unknown;
    [key: string]: unknown;
  };
  vsme?: {
    source?: DomainSource;
    scorePct?: number | null;
    indicateursCompletes?: number | null;
    totalIndicateurs?: number | null;
    statut?: string | null;
    effectifTotal?: number | null;
    ltir?: number | null;
    ecartSalaireHf?: number | null;
    raisonSociale?: string | null;
    [key: string]: unknown;
  };
  esg?: {
    source?: DomainSource;
    scoreGlobal?: number | null;
    scoreE?: number | null;
    scoreS?: number | null;
    scoreG?: number | null;
    statut?: string | null;
    enjeuxMateriels?: number;
    top5Issues?: Array<{ code?: string; label?: string; score?: number }>;
    [key: string]: unknown;
  };
  finance?: {
    source?: DomainSource;
    expositionTotaleEur?: number | null;
    greenCapexPct?: number | null;
    statutAlignementParis?: string | null;
    pai1_totalGes?: number | null;
    [key: string]: unknown;
  };
  alertStatus?: {
    totalActive?: number;
    recentFired?: Array<{ rule_name?: string; domain?: string; fired_at?: string }>;
    domains?: string[];
  };
  dataHealth?: {
    allAvailable?: boolean;
    anyStale?: boolean;
    domains?: Record<string, { available: boolean; stale: boolean }>;
  };
}

// Fallback : snapshots bruts transmis directement par le frontend (legacy)
interface LegacySnapshotContext {
  carbon?: unknown;
  vsme?: unknown;
  esg?: unknown;
  finance?: unknown;
}

function fmtNum(v: number | null | undefined, unit = ""): string {
  if (v == null) return "—";
  const formatted = v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function buildSystemPrompt(tools: CopilotToolsBundle | null, legacy: LegacySnapshotContext | null): string {
  const parts: string[] = [
    "Tu es CarbonCo Copilot, un assistant expert en reporting ESG, CSRD, VSME, Taxonomie UE, CBAM, SBTi et bilan carbone.",
    "Tu t'adresses à un responsable RSE / CFO francophone. Réponds toujours en français, de manière concise, structurée, factuelle.",
    "",
    "RÈGLES ABSOLUES :",
    "1. Utilise EXCLUSIVEMENT les données fournies ci-dessous. Ne jamais inventer ni estimer de valeurs.",
    "2. Si une donnée est absente (null ou —), dis-le explicitement.",
    '3. Cite systématiquement tes sources : "d\'après le snapshot Carbone", "selon la matérialité ESG", etc.',
    "4. Structure avec du markdown : listes à puces, gras, sous-titres.",
    "5. Si la question sort du périmètre ESG/Finance/Carbone, redirige poliment.",
    "",
    "=== DONNÉES EN TEMPS RÉEL ===",
  ];

  if (tools) {
    // Mode enrichi avec outils typés
    const { carbon, vsme, esg, finance, alertStatus, dataHealth } = tools;

    parts.push("", "## Santé des données");
    if (dataHealth) {
      parts.push(
        `- Toutes disponibles : ${dataHealth.allAvailable ? "Oui" : "Non"}`,
        `- Données périmées : ${dataHealth.anyStale ? "Oui — vérifier la fraîcheur" : "Non"}`,
      );
    }

    parts.push("", "## Indicateurs Carbone");
    if (carbon?.source?.available) {
      parts.push(
        `- Scope 1 : ${fmtNum(carbon.scope1Tco2e, "tCO₂e")}`,
        `- Scope 2 (LB) : ${fmtNum(carbon.scope2LbTco2e, "tCO₂e")}`,
        `- Scope 3 : ${fmtNum(carbon.scope3Tco2e, "tCO₂e")}`,
        `- Total S1+S2+S3 : **${fmtNum(carbon.totalS123Tco2e, "tCO₂e")}**`,
        `- Intensité carbone / CA : ${fmtNum(carbon.intensityRevenueTco2ePerMEur, "tCO₂e/M€")}`,
        `- CA aligné Taxonomie : ${fmtNum(carbon.turnoverAlignedPct, "%")}`,
        `- Part ENR : ${fmtNum(carbon.renewableSharePct, "%")}`,
        `- Objectif SBTi S1+S2 : ${fmtNum(carbon.targetReductionS12Pct, "%")}`,
        `- Coût CBAM estimé : ${fmtNum(carbon.estimatedCbamCostEur, "€")}`,
        `- Entreprise : ${carbon.company ?? "—"} · Année : ${carbon.reportingYear ?? "—"}`,
      );
    } else {
      parts.push("_Snapshot carbone non disponible_");
    }

    parts.push("", "## Indicateurs VSME");
    if (vsme?.source?.available) {
      parts.push(
        `- Raison sociale : ${vsme.raisonSociale ?? "—"}`,
        `- Score de complétude : ${fmtNum(vsme.scorePct, "%")} (${vsme.indicateursCompletes ?? 0}/${vsme.totalIndicateurs ?? 0} indicateurs · Statut : ${vsme.statut ?? "—"})`,
        `- Effectif total : ${fmtNum(vsme.effectifTotal, "pers.")}`,
        `- LTIR (accidents) : ${fmtNum(vsme.ltir)}`,
        `- Écart salarial H/F : ${fmtNum(vsme.ecartSalaireHf, "%")}`,
      );
    } else {
      parts.push("_Snapshot VSME non disponible_");
    }

    parts.push("", "## Scores ESG & Matérialité");
    if (esg?.source?.available) {
      parts.push(
        `- Score global : **${fmtNum(esg.scoreGlobal, "/100")}** · Statut : ${esg.statut ?? "—"}`,
        `- Environnement : ${fmtNum(esg.scoreE, "/100")} · Social : ${fmtNum(esg.scoreS, "/100")} · Gouvernance : ${fmtNum(esg.scoreG, "/100")}`,
        `- Enjeux matériels : ${esg.enjeuxMateriels ?? 0}`,
      );
      if (esg.top5Issues?.length) {
        parts.push("- Top 5 enjeux :");
        esg.top5Issues.forEach((i) => {
          parts.push(`  - ${i.code} — ${i.label} (score : ${fmtNum(i.score)})`);
        });
      }
    } else {
      parts.push("_Snapshot ESG non disponible_");
    }

    parts.push("", "## Finance Climat & SFDR");
    if (finance?.source?.available) {
      parts.push(
        `- Exposition carbone totale : ${fmtNum(finance.expositionTotaleEur, "€")}`,
        `- Green CapEx : ${fmtNum(finance.greenCapexPct, "%")}`,
        `- Statut alignement Paris : ${finance.statutAlignementParis ?? "—"}`,
        `- PAI 1 — Total GES : ${fmtNum(finance.pai1_totalGes, "tCO₂e")}`,
      );
    } else {
      parts.push("_Snapshot Finance non disponible_");
    }

    if (alertStatus) {
      parts.push("", "## Alertes actives");
      parts.push(`- Règles actives : ${alertStatus.totalActive ?? 0}`);
      if (alertStatus.recentFired?.length) {
        parts.push("- Dernières alertes déclenchées :");
        alertStatus.recentFired.slice(0, 3).forEach((a) => {
          parts.push(`  - ${a.rule_name ?? "?"} [${a.domain ?? "?"}] — ${a.fired_at ?? "?"}`);
        });
      }
    }
  } else if (legacy) {
    // Mode legacy : dump JSON brut des snapshots
    const domains: Array<[string, unknown]> = [
      ["Carbone", legacy.carbon],
      ["VSME", legacy.vsme],
      ["ESG / Matérialité", legacy.esg],
      ["Finance", legacy.finance],
    ];
    for (const [label, data] of domains) {
      if (data) {
        parts.push("", `## Snapshot ${label}`, "```json", JSON.stringify(data, null, 2), "```");
      } else {
        parts.push("", `## Snapshot ${label}`, "_Non disponible_");
      }
    }
  } else {
    parts.push("", "_Aucune donnée disponible. Déclenchez un ingest depuis le Centre de données._");
  }

  return parts.join("\n");
}

export async function POST(req: Request) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const identifier = `u:${payload.sub}`;
  const rl = await checkCopilotRateLimit(identifier);
  if (!rl.success) {
    return new Response(
      JSON.stringify({
        error: "rate_limited",
        message: "Trop de requêtes. Réessayez dans quelques instants.",
        retryAfterSeconds: rl.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(rl.retryAfterSeconds),
          "x-ratelimit-limit": String(rl.limit),
          "x-ratelimit-remaining": String(rl.remaining),
          "x-ratelimit-reset": String(rl.reset),
        },
      },
    );
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    tools?: CopilotToolsBundle;
    snapshots?: LegacySnapshotContext;
  };

  const { messages, tools, snapshots } = body;

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: buildSystemPrompt(tools ?? null, snapshots ?? null),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
