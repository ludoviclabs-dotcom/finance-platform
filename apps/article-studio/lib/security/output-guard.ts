/**
 * ARTICLE STUDIO — Output guardrail
 *
 * Light-touch scan of LLM responses for:
 *   • Common French PII (IBAN, CB, NIR, phone) — redacted in place
 *   • System prompt leakage (logged, not redacted)
 *
 * Designed for whole responses (not streaming chunks). Apply to the
 * fully accumulated text before final persistence.
 */

export type OutputGuardResult = {
  filtered: string;
  flagged: boolean;
  redacted: number;
  matches: string[];
};

type PiiRule = {
  label: string;
  pattern: RegExp;
  replacement: string;
};

const PII_RULES: PiiRule[] = [
  {
    label: "IBAN",
    pattern: /\bFR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{3}\b/gi,
    replacement: "[IBAN masqué]",
  },
  {
    label: "IBAN_INTL",
    pattern: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){4,7}\d{1,4}\b/g,
    replacement: "[IBAN masqué]",
  },
  {
    label: "CB",
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,
    replacement: "[CB masquée]",
  },
  {
    label: "NIR",
    pattern: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
    replacement: "[NIR masqué]",
  },
  {
    label: "PHONE",
    pattern: /\b(?:0|\+33\s?|0033\s?)[1-9](?:[\s.\-]?\d{2}){4}\b/g,
    replacement: "[Tél masqué]",
  },
  {
    label: "EMAIL_BULK",
    pattern: /(?:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[\s,;]+){3,}/g,
    replacement: "[Emails masqués]",
  },
];

const LEAK_PATTERNS: RegExp[] = [
  /you\s+are\s+(an?\s+)?(editor|article|writing\s+assistant)/i,
  /my\s+(system\s+)?instructions?\s+(are|say|state|tell\s+me)/i,
  /i\s+(was|am|have\s+been)\s+(told|instructed|programmed)\s+to/i,
  /(initial|original|system)\s+prompt\s*[:=]/i,
];

export function checkOutput(text: string): OutputGuardResult {
  let filtered = text;
  let redacted = 0;
  const matches: string[] = [];

  for (const rule of PII_RULES) {
    const before = filtered;
    filtered = filtered.replace(rule.pattern, rule.replacement);
    if (filtered !== before) {
      redacted++;
      matches.push(rule.label);
    }
  }

  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(text)) {
      matches.push("SYSTEM_LEAK");
      console.warn("[output-guard] Potential system prompt leak detected — review response");
      break;
    }
  }

  return { filtered, flagged: matches.length > 0, redacted, matches };
}
