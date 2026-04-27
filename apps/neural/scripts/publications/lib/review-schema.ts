/**
 * NEURAL — Schema Zod du rapport de review editorial.
 *
 * Le LLM reviewer doit produire un JSON conforme a ce schema.
 * Le script valide cote client (refus + retry 1x si non conforme).
 */

import { z } from "zod";

const score = z.number().min(0).max(100);

const styleAxis = z.object({
  score,
  comments: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});

const factualityAxis = z.object({
  score,
  claimsWithoutSource: z.array(z.string()).default([]),
  weakClaims: z.array(z.string()).default([]),
});

const structureAxis = z.object({
  score,
  sectionsTooShort: z.array(z.string()).default([]),
  hierarchyIssues: z.array(z.string()).default([]),
});

const seoAxis = z.object({
  score,
  missingKeywords: z.array(z.string()).default([]),
  titleIssues: z.array(z.string()).default([]),
});

const redundancyAxis = z.object({
  score,
  repeatedPhrases: z.array(z.string()).default([]),
  echoSections: z.array(z.string()).default([]),
});

const readabilityAxis = z.object({
  score,
  fleschFR: z.number(),
  longSentences: z.array(z.string()).default([]),
});

const biasAxis = z.object({
  score,
  overstatements: z.array(z.string()).default([]),
});

export const reviewReportSchema = z.object({
  overallScore: score,
  axes: z.object({
    style: styleAxis,
    factuality: factualityAxis,
    structure: structureAxis,
    seo: seoAxis,
    redundancy: redundancyAxis,
    readability: readabilityAxis,
    biasAndOverclaim: biasAxis,
  }),
  topPriorityFixes: z.array(z.string()),
});

export type ReviewReport = z.infer<typeof reviewReportSchema>;
