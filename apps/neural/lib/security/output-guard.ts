/**
 * NEURAL — Output guardrail (Sprint 1)
 *
 * Scans LLM responses for:
 *   • French financial PII (IBAN, CB, NIR/sécu, SIREN, phone)
 *   • System prompt leakage (model revealing its instructions)
 *   • Bulk email list exposure
 *
 * Applies redaction in-place and returns a flagged flag for logging / alerting.
 * Designed to be called on complete text responses. For streaming use cases,
 * apply to the fully accumulated string before flushing to the client (Sprint 3).
 *
 * Usage:
 *   const { filtered, flagged, redacted } = checkOutput(rawText);
 *   if (flagged) logSecurityEvent("output_guard", { redacted });
 *   return filtered;
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type OutputGuardResult = {
  /** Text after redaction (may equal the original if nothing was found). */
  filtered: string;
  /** True if any PII or leak pattern was detected. */
  flagged: boolean;
  /** Count of PII items redacted. */
  redacted: number;
  /** Labels of the patterns that matched. */
  matches: string[];
};

// ── PII patterns ─────────────────────────────────────────────────────────────

type PiiRule = {
  label: string;
  pattern: RegExp;
  replacement: string;
};

const PII_RULES: PiiRule[] = [
  // IBAN France (FR + 25 chars)
  {
    label: "IBAN",
    pattern: /\bFR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{3}\b/gi,
    replacement: "[IBAN masqué]",
  },
  // Generic IBAN (other countries that may appear in FR financial docs)
  {
    label: "IBAN_INTL",
    pattern: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){4,7}\d{1,4}\b/g,
    replacement: "[IBAN masqué]",
  },
  // Carte bancaire (PAN — 16 chiffres groupés)
  {
    label: "CB",
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    replacement: "[CB masquée]",
  },
  // NIR / Numéro de sécurité sociale
  {
    label: "NIR",
    pattern: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
    replacement: "[NIR masqué]",
  },
  // SIREN (9 chiffres) / SIRET (14 chiffres)
  {
    label: "SIREN",
    pattern: /\b\d{3}\s?\d{3}\s?\d{3}(?:\s?\d{5})?\b/g,
    replacement: "[SIREN masqué]",
  },
  // Téléphone France (06, 07, +33…)
  {
    label: "PHONE",
    pattern: /\b(?:0|\+33\s?|0033\s?)[1-9](?:[\s.\-]?\d{2}){4}\b/g,
    replacement: "[Tél masqué]",
  },
  // Email — only flag if 3+ appear (single address in context is often legitimate)
  {
    label: "EMAIL_BULK",
    pattern: /(?:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[\s,;]+){3,}/g,
    replacement: "[Emails masqués]",
  },
];

// ── System prompt leak patterns ───────────────────────────────────────────────

const LEAK_PATTERNS: RegExp[] = [
  /you\s+are\s+(neural|an?\s+ai\s+consultant)/i,
  /my\s+(system\s+)?instructions?\s+(are|say|state|tell\s+me)/i,
  /i\s+(was|am|have\s+been)\s+(told|instructed|programmed|trained)\s+to/i,
  /(initial|original|system)\s+prompt\s*[:=]/i,
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Redacts PII from `text` and detects system-prompt leakage.
 * Always returns a result — never throws.
 */
export function checkOutput(text: string): OutputGuardResult {
  let filtered = text;
  let redacted = 0;
  const matches: string[] = [];

  // Redact PII
  for (const rule of PII_RULES) {
    const before = filtered;
    filtered = filtered.replace(rule.pattern, rule.replacement);
    if (filtered !== before) {
      redacted++;
      matches.push(rule.label);
    }
  }

  // Detect system prompt leakage (log but do not redact — the full response
  // should be reviewed; automated redaction here risks garbling the answer)
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) {
      matches.push("SYSTEM_LEAK");
      console.warn("[output-guard] Potential system prompt leak detected — review response");
      break;
    }
  }

  return {
    filtered,
    flagged: matches.length > 0,
    redacted,
    matches,
  };
}
