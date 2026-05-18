/**
 * ARTICLE STUDIO — Input guardrail
 *
 * Two-layer defense against prompt injection on user briefs / queries:
 *   1. Pattern matching (sync, always active)
 *   2. Lakera Guard v1 (async, activated when LAKERA_API_KEY is set)
 *
 * Fails OPEN if Lakera is unreachable.
 */

import { env } from "@/lib/env";

export type InputGuardResult = {
  blocked: boolean;
  reason?: string;
  score?: number;
  provider: "lakera" | "pattern" | "none";
};

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|above|prior|any)\s+(instructions?|prompts?|context|rules?)/i,
  /forget\s+(everything|all|previous|your\s+instructions?)/i,
  /\b(dan|dude|stan|dev\s*mode|jailbreak|god\s*mode)\s*(mode|activated|enabled|is|:|,)/i,
  /do\s+anything\s+now/i,
  /you\s+have\s+no\s+(restrictions?|limits?|rules?|guidelines?)/i,
  /<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]|<\/s>/,
  /act\s+as\s+(an?\s+)?(unrestricted|unfiltered|evil|uncensored|jailbroken|malicious)/i,
  /pretend\s+(you\s+)?(have|don.t\s+have)\s+(no\s+)?(instructions?|guidelines?|rules?)/i,
  /your\s+(real|true|actual|original|hidden)\s+instructions?\s+(are|say|state|tell)/i,
];

function patternCheck(message: string): InputGuardResult | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason: "Contenu non autorisé détecté.",
        provider: "pattern",
      };
    }
  }
  return null;
}

type LakeraResponse = {
  results: Array<{ category_scores: Record<string, number>; flagged: boolean }>;
  flagged: boolean;
};

async function lakeraCheck(message: string): Promise<InputGuardResult | null> {
  if (!env.security.inputGuardReady || !env.security.lakeraKey) return null;

  try {
    const res = await fetch("https://api.lakera.ai/v1/prompt_injection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.security.lakeraKey}`,
      },
      body: JSON.stringify({ input: message }),
      signal: AbortSignal.timeout(2_000),
    });

    if (!res.ok) {
      console.warn(`[input-guard] Lakera returned ${res.status} — passing through`);
      return null;
    }

    const data = (await res.json()) as LakeraResponse;
    const score = data.results[0]?.category_scores?.["prompt_injection"] ?? 0;

    if (data.flagged) {
      return {
        blocked: true,
        reason: "Requête bloquée par le système de sécurité.",
        score,
        provider: "lakera",
      };
    }

    return { blocked: false, score, provider: "lakera" };
  } catch (err) {
    console.warn(
      "[input-guard] Lakera check failed — passing through:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function checkInput(message: string): Promise<InputGuardResult> {
  const patternResult = patternCheck(message);
  if (patternResult?.blocked) return patternResult;

  const lakeraResult = await lakeraCheck(message);
  if (lakeraResult) return lakeraResult;

  return {
    blocked: false,
    provider: env.security.inputGuardReady ? "lakera" : "none",
  };
}
