/**
 * NEURAL — Input guardrail (Sprint 1)
 *
 * Two-layer defense against prompt injection and jailbreaks:
 *
 *   1. Pattern matching — synchronous, zero-latency, always active.
 *      Catches well-known injection templates (DAN, ignore-instructions, etc.).
 *
 *   2. Lakera Guard v1 — async API call, activated when LAKERA_API_KEY is set.
 *      Fails OPEN: if the API is unreachable or times-out, the request passes
 *      through with a warning — never block legitimate users due to a 3rd-party
 *      outage.
 *
 * Usage:
 *   const result = await checkInput(userMessage);
 *   if (result.blocked) return NextResponse.json({ error: result.reason }, { status: 400 });
 */

import { env } from "@/lib/env";

// ── Types ────────────────────────────────────────────────────────────────────

export type InputGuardResult = {
  /** Whether the message should be blocked. */
  blocked: boolean;
  /** Human-readable reason, suitable for returning to the caller. */
  reason?: string;
  /** Confidence score returned by the guard provider (0–1). */
  score?: number;
  /** Which layer made the decision. */
  provider: "lakera" | "pattern" | "none";
};

// ── Layer 1 — Pattern matching ───────────────────────────────────────────────

/**
 * Well-known prompt injection / jailbreak patterns.
 * Deliberately conservative — only flag clear attacks, not edge cases.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // "ignore previous / all / above instructions"
  /ignore\s+(previous|all|above|prior|any)\s+(instructions?|prompts?|context|rules?)/i,
  // "forget everything / your instructions"
  /forget\s+(everything|all|previous|your\s+instructions?)/i,
  // DAN / jailbreak personas
  /\b(dan|dude|stan|dev\s*mode|jailbreak|god\s*mode)\s*(mode|activated|enabled|is|:|,)/i,
  /do\s+anything\s+now/i,
  /you\s+have\s+no\s+(restrictions?|limits?|rules?|guidelines?)/i,
  // Raw chat template injections
  /<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]|<\/s>/,
  // "act as an unrestricted / evil / unfiltered AI"
  /act\s+as\s+(an?\s+)?(unrestricted|unfiltered|evil|uncensored|jailbroken|malicious)/i,
  // "pretend you have no instructions"
  /pretend\s+(you\s+)?(have|don.t\s+have)\s+(no\s+)?(instructions?|guidelines?|rules?)/i,
  // "your real/true/actual instructions are"
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

// ── Layer 2 — Lakera Guard ───────────────────────────────────────────────────

type LakeraResponse = {
  model: string;
  results: Array<{
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
    flagged: boolean;
  }>;
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
      // Hard timeout — never let a 3rd-party guard add > 2 s to latency
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
    // Timeout, DNS failure, etc. → fail open
    console.warn(
      "[input-guard] Lakera check failed — passing through:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all input guard layers in order.
 * Returns on the first blocking result; otherwise returns a passing result from
 * the deepest layer that ran.
 */
export async function checkInput(message: string): Promise<InputGuardResult> {
  // Layer 1 — patterns (sync, instant)
  const patternResult = patternCheck(message);
  if (patternResult?.blocked) return patternResult;

  // Layer 2 — Lakera (async, optional)
  const lakeraResult = await lakeraCheck(message);
  if (lakeraResult) return lakeraResult;

  // All clear
  return {
    blocked: false,
    provider: env.security.inputGuardReady ? "lakera" : "none",
  };
}
