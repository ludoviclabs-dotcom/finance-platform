/**
 * NEURAL — Luxe / Communication catalog (Sprint 1)
 *
 * Source de verite pour les 5 agents de la branche LUXE / Communication.
 * Expose :
 *   - types Zod pour chaque table exposee publiquement (brand vocab, claims,
 *     heritage sources, media directory, events, brand rules, hard-fail, etc.)
 *   - parsers safe (zod .safeParse) pour les JSON geles
 *   - derives metier (resolveClaimStatus, resolveHeritageStatus)
 *   - presets pour les composants React (server components)
 *
 * Les JSON sources sont dans content/luxe-comms/*.json, generes par
 * scripts/sync-luxe-comms.ts depuis data/luxe-comms/*.xlsx.
 *
 * IMPORTANT :
 *   - Ce module est server-side (import de .json). Ne pas importer dans un
 *     client component ; utiliser les server components ou une route handler
 *     pour passer les donnees parsees au client.
 *   - Les IDs sont stables cross-workbook (DOC-NNNN, CLM-NNN, SRC-NNN, ...).
 */

import { z } from "zod";

import foundationsJson from "@/content/luxe-comms/foundations.json";
import masterJson from "@/content/luxe-comms/master.json";
import ag001Json from "@/content/luxe-comms/ag001-voiceguard.json";
import ag002Json from "@/content/luxe-comms/ag002-press.json";
import ag003Json from "@/content/luxe-comms/ag003-events.json";
import ag004Json from "@/content/luxe-comms/ag004-heritage.json";
import ag005Json from "@/content/luxe-comms/ag005-greenclaim.json";

// ─── ENUMS ──────────────────────────────────────────────────────────────────

export const BRAND_LANG = ["FR", "EN", "IT", "DE", "JA", "ZH"] as const;
export type BrandLang = (typeof BRAND_LANG)[number];

export const SEVERITY = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Severity = (typeof SEVERITY)[number];

export const TERM_TYPE = ["PREFERRED", "FORBIDDEN", "REVIEW"] as const;
export const WORDING_TYPE = ["ABSOLUTE", "QUALIFIED", "COMPARATIVE"] as const;
export const CLAIM_STATUS = ["VALID", "STALE", "UNVERIFIED", "MISSING"] as const;
export type ClaimStatus = (typeof CLAIM_STATUS)[number];

export const SOURCE_TYPE = ["PRIMARY", "SECONDARY", "TERTIARY"] as const;
export const SOURCE_STATUS = ["ACTIVE", "STALE", "REJECTED"] as const;
export type SourceStatus = (typeof SOURCE_STATUS)[number];

// ─── SCHEMAS ────────────────────────────────────────────────────────────────

const NullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === undefined || v === null ? null : v));
const NullableNumber = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => (v === undefined || v === null ? null : v));
const IsoDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === undefined ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "expected YYYY-MM-DD" });

export const BrandRuleSchema = z.object({
  rule_id: z.string(),
  categorie: z.string(),
  regle: z.string(),
  niveau: z.enum(SEVERITY),
  poids: NullableNumber,
  lang: z.string().nullable(),
  exemple_ok: z.string().nullable(),
  exemple_ko: z.string().nullable(),
});
export type BrandRule = z.infer<typeof BrandRuleSchema>;

export const VocabFrSchema = z.object({
  term_id: z.string(),
  terme: z.string(),
  term_type: z.enum(TERM_TYPE),
  categorie: z.string().nullable(),
  niveau: z.enum(SEVERITY),
  suggestion_remplacement: z.string().nullable(),
  contexte: z.string().nullable(),
  action: z.string().nullable(),
});
export type VocabFr = z.infer<typeof VocabFrSchema>;

export const HeritageSourceSchema = z.object({
  source_id: z.string(),
  titre: z.string(),
  type: z.enum(SOURCE_TYPE),
  annee: NullableNumber,
  auteur: NullableString,
  cote_archive: NullableString,
  manual_override: NullableString,
  review_date: IsoDate,
  citation_format: NullableString,
  usage_count: NullableNumber,
  // statut est une formule Excel non calculee par openpyxl -> recalcule via resolveHeritageStatus()
  statut: NullableString,
});
export type HeritageSource = z.infer<typeof HeritageSourceSchema>;

export const MediaEntrySchema = z.object({
  media_id: z.string(),
  nom_media: z.string(),
  type: z.string(),
  vertical: z.string(),
  pays: z.string(),
  lang: z.string(),
  angle_editorial: z.string(),
  embargo_accepted: z.string(),
  relation_status: z.string(),
  priorite: z.string(),
});
export type MediaEntry = z.infer<typeof MediaEntrySchema>;

export const ClaimRegistrySchema = z.object({
  claim_id: z.string(),
  claim: z.string(),
  categorie: z.string(),
  wording_type: z.enum(WORDING_TYPE),
  evidence_title: NullableString,
  evidence_source: NullableString,
  juridiction: z.string(),
  evidence_date: IsoDate,
  evidence_expiry: IsoDate,
  owner: NullableString,
  manual_override: NullableString,
  // status = formule Excel non calculee -> recalcule par resolveClaimStatus()
  status: NullableString,
});
export type ClaimRegistry = z.infer<typeof ClaimRegistrySchema>;

export const EventCalendarSchema = z.object({
  event_id: z.string(),
  nom: z.string(),
  type: z.string(),
  date_debut: IsoDate,
  date_fin: IsoDate,
  lieu: z.string(),
  audience: z.string(),
  vip_level: z.enum(["HIGH", "MEDIUM", "LOW"]),
  claims_expected: z.string(),
  heritage_angle: z.string(),
  // sensibilite_score = formule Excel -> recalcule si besoin cote JS
  sensibilite_score: NullableNumber,
  statut: z.string(),
});
export type EventCalendar = z.infer<typeof EventCalendarSchema>;

export const HardFailRuleSchema = z.object({
  hf_id: z.string(),
  pattern: z.string(),
  type: z.enum(["LITERAL", "REGEX"]),
  lang: z.string(),
  categorie: z.string(),
  note: z.string().nullable(),
});
export type HardFailRule = z.infer<typeof HardFailRuleSchema>;

export const MediaMatrixSchema = z.object({
  media_type: z.string(),
  angle: z.string(),
  format_target: z.string(),
  length_words: NullableNumber,
  quote_ceo: z.string(),
  visuals_required: z.string(),
  embargo_recommand: z.string(),
});
export type MediaMatrix = z.infer<typeof MediaMatrixSchema>;

export const ClaimLibrarySchema = z.object({
  lib_id: z.string(),
  pattern: z.string(),
  categorie: z.string(),
  wording_type: z.enum(WORDING_TYPE),
  autorisation: z.enum(["AUTORISE", "AUTORISE_SI_PROUVE", "REVIEW", "INTERDIT"]),
  evidence_required: z.string(),
  juridictions_ok: z.string().nullable(),
  note: z.string().nullable(),
});
export type ClaimLibrary = z.infer<typeof ClaimLibrarySchema>;

export const JurisdictionMatrixSchema = z.object({
  lib_id: z.string(),
  claim_pattern: z.string(),
  eu: z.string().nullable(),
  fr: z.string().nullable(),
  uk: z.string().nullable(),
  us: z.string().nullable(),
  ch: z.string().nullable(),
});
export type JurisdictionMatrix = z.infer<typeof JurisdictionMatrixSchema>;

export const ApprovedFactSchema = z.object({
  fact_id: z.string(),
  fait: z.string(),
  annee: NullableNumber,
  source_1: NullableString,
  source_2: NullableString,
  source_3: NullableString,
  statut: NullableString,
  source_check: NullableString,
});
export type ApprovedFact = z.infer<typeof ApprovedFactSchema>;

export const NarrativeBlockSchema = z.object({
  block_id: z.string(),
  theme: z.string(),
  titre: z.string(),
  texte: z.string(),
  sources: z.string(),
  source_status: z.string(),
  usability: NullableString, // formule Excel
  usage_count: NullableNumber,
});
export type NarrativeBlock = z.infer<typeof NarrativeBlockSchema>;

// ─── SAFE PARSING (throws un erreur explicite en build si schema drift) ──────

function parseList<T>(
  label: string,
  schema: z.ZodSchema<T>,
  raw: unknown
): T[] {
  if (!Array.isArray(raw)) {
    throw new Error(`[luxe-comms-catalog] ${label} n'est pas un tableau`);
  }
  const out: T[] = [];
  const failures: string[] = [];
  raw.forEach((row, idx) => {
    const r = schema.safeParse(row);
    if (r.success) out.push(r.data);
    else failures.push(`  row ${idx}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`);
  });
  if (failures.length > 0) {
    // Build-time warning plutot que throw, pour ne pas casser le build si un
    // champ optionnel derive. A promouvoir en throw en CI strict.
    console.warn(`[luxe-comms-catalog] ${label} — ${failures.length} ligne(s) rejetee(s):\n${failures.join("\n")}`);
  }
  return out;
}

// ─── CATALOG EXPORTS (parsed, ready to use) ──────────────────────────────────

export const BRAND_RULES: BrandRule[] = parseList(
  "BRAND_RULES",
  BrandRuleSchema,
  (foundationsJson as any).data["2_BRAND_CHARTER"]
);

export const VOCAB_FR: VocabFr[] = parseList(
  "VOCAB_FR",
  VocabFrSchema,
  (foundationsJson as any).data["3_BRAND_VOCAB_FR"]
);

export const HERITAGE_SOURCES: HeritageSource[] = parseList(
  "HERITAGE_SOURCES",
  HeritageSourceSchema,
  (foundationsJson as any).data["5_HERITAGE_SOURCEBOOK"]
);

export const MEDIA_DIRECTORY: MediaEntry[] = parseList(
  "MEDIA_DIRECTORY",
  MediaEntrySchema,
  (foundationsJson as any).data["6_MEDIA_DIRECTORY"]
);

export const CLAIMS_REGISTRY: ClaimRegistry[] = parseList(
  "CLAIMS_REGISTRY",
  ClaimRegistrySchema,
  (foundationsJson as any).data["7_CLAIMS_EVIDENCE_REGISTRY"]
);

export const EVENTS_CALENDAR: EventCalendar[] = parseList(
  "EVENTS_CALENDAR",
  EventCalendarSchema,
  (foundationsJson as any).data["8_EVENTS_CALENDAR"]
);

export const HARD_FAIL_RULES: HardFailRule[] = parseList(
  "HARD_FAIL_RULES",
  HardFailRuleSchema,
  (ag001Json as any).data["4_HARD_FAIL_RULES"]
);

export const MEDIA_MATRIX: MediaMatrix[] = parseList(
  "MEDIA_MATRIX",
  MediaMatrixSchema,
  (ag002Json as any).data["3_MEDIA_MATRIX"]
);

export const CLAIM_LIBRARY: ClaimLibrary[] = parseList(
  "CLAIM_LIBRARY",
  ClaimLibrarySchema,
  (ag005Json as any).data["3_CLAIM_LIBRARY"]
);

export const JURISDICTION_MATRIX: JurisdictionMatrix[] = parseList(
  "JURISDICTION_MATRIX",
  JurisdictionMatrixSchema,
  (ag005Json as any).data["10_JURIDICTION_MATRIX"]
);

export const APPROVED_FACTS: ApprovedFact[] = parseList(
  "APPROVED_FACTS",
  ApprovedFactSchema,
  (ag004Json as any).data["4_APPROVED_FACTS"]
);

export const NARRATIVE_BLOCKS: NarrativeBlock[] = parseList(
  "NARRATIVE_BLOCKS",
  NarrativeBlockSchema,
  (ag004Json as any).data["5_NARRATIVE_BLOCKS"]
);

// ─── DERIVED (recalcule les statuts formules Excel cote JS) ──────────────────

/**
 * Recalcule le STATUS d'un claim (l'Excel le calculait par formule).
 * MANUAL_OVERRIDE prioritaire sur la derivation, sinon :
 *  - pas d'evidence_title => MISSING
 *  - evidence_expiry < today => STALE
 *  - sinon VALID
 */
export function resolveClaimStatus(c: ClaimRegistry, now: Date = new Date()): ClaimStatus {
  if (c.manual_override && (c.manual_override as string).trim() !== "") {
    return (c.manual_override as ClaimStatus) ?? "UNVERIFIED";
  }
  if (!c.evidence_title || c.evidence_title === "-") return "MISSING";
  if (!c.evidence_expiry) return "VALID";
  const expiry = new Date(c.evidence_expiry);
  if (isNaN(expiry.getTime())) return "VALID";
  return expiry.getTime() < now.getTime() ? "STALE" : "VALID";
}

/**
 * Recalcule le STATUT d'une source patrimoniale.
 *   MANUAL_OVERRIDE prioritaire, sinon REVIEW_DATE < today => STALE, sinon ACTIVE.
 */
export function resolveHeritageStatus(s: HeritageSource, now: Date = new Date()): SourceStatus {
  if (s.manual_override && (s.manual_override as string).trim() !== "") {
    return (s.manual_override as SourceStatus) ?? "REJECTED";
  }
  if (!s.review_date) return "ACTIVE";
  const d = new Date(s.review_date);
  if (isNaN(d.getTime())) return "ACTIVE";
  return d.getTime() < now.getTime() ? "STALE" : "ACTIVE";
}

// ─── HELPERS METIER ──────────────────────────────────────────────────────────

export function countByTermType(): Record<string, number> {
  return VOCAB_FR.reduce(
    (acc, v) => ({ ...acc, [v.term_type]: (acc[v.term_type] ?? 0) + 1 }),
    {} as Record<string, number>
  );
}

export function countClaimsByStatus(now: Date = new Date()): Record<ClaimStatus, number> {
  const init: Record<ClaimStatus, number> = { VALID: 0, STALE: 0, UNVERIFIED: 0, MISSING: 0 };
  return CLAIMS_REGISTRY.reduce((acc, c) => {
    const s = resolveClaimStatus(c, now);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, init);
}

export function countSourcesByType(): Record<string, number> {
  return HERITAGE_SOURCES.reduce(
    (acc, s) => ({ ...acc, [s.type]: (acc[s.type] ?? 0) + 1 }),
    {} as Record<string, number>
  );
}

export function countMediaByPriority(): Record<string, number> {
  return MEDIA_DIRECTORY.reduce(
    (acc, m) => ({ ...acc, [m.priorite]: (acc[m.priorite] ?? 0) + 1 }),
    {} as Record<string, number>
  );
}

// ─── PUBLIC SUMMARY (pour hero, proof-rail, sector page) ─────────────────────

export const LUXE_COMMS_SUMMARY = {
  brandRulesCount: BRAND_RULES.length,
  criticalRulesCount: BRAND_RULES.filter((r) => r.niveau === "CRITICAL").length,
  vocabFrCount: VOCAB_FR.length,
  forbiddenTermsCount: VOCAB_FR.filter((v) => v.term_type === "FORBIDDEN").length,
  heritageSourcesCount: HERITAGE_SOURCES.length,
  primarySourcesCount: HERITAGE_SOURCES.filter((s) => s.type === "PRIMARY").length,
  mediaDirectoryCount: MEDIA_DIRECTORY.length,
  p1MediaCount: MEDIA_DIRECTORY.filter((m) => m.priorite === "P1").length,
  claimsTotal: CLAIMS_REGISTRY.length,
  eventsCount: EVENTS_CALENDAR.length,
  hardFailRulesCount: HARD_FAIL_RULES.length,
  juridictionsCovered: JURISDICTION_MATRIX.length > 0 ? 5 : 0, // EU, FR, UK, US, CH
  jurisdictionsCount: JURISDICTION_MATRIX.length,
  workbookVersion: (masterJson as any)._meta.generatedAt,
} as const;

// ─── 5 AGENTS — expose comme liste structuree ──────────────────────────────────

export const LUXE_COMMS_AGENTS = [
  {
    slug: "maison-voice-guard",
    id: "AG-001",
    name: "MaisonVoiceGuard",
    tagline: "Le gardien du verbe de votre maison",
    mission:
      "Scorer chaque communication sur la conformite a la charte (vocabulaire, ton, hard-fail). Refus automatique si score insuffisant.",
    primaryGate: "BRAND" as const,
    inputMain: "Texte (FR ou EN) + contexte + langue",
    outputMain: "Score /100 + decision APPROVE/REWORK/REJECT + feedback",
    demoEndpoint: "/api/demo/voice-score",
    iconName: "ShieldCheck",
  },
  {
    slug: "luxe-press-agent",
    id: "AG-002",
    name: "LuxePressAgent",
    tagline: "Rediger dans le registre du luxe, outlet par outlet",
    mission:
      "Redige communiques dans le registre du luxe. Adapte presse lifestyle (Vogue, HB) vs. business (FT, BoF).",
    primaryGate: "BRAND" as const,
    inputMain: "Brief + angle + media cibles",
    outputMain: "Communique finalise + dossier presse",
    demoEndpoint: "/api/demo/press-angle",
    iconName: "Newspaper",
  },
  {
    slug: "luxe-event-comms",
    id: "AG-003",
    name: "LuxeEventComms",
    tagline: "Pack evenementiel multi-format, gate brand + heritage",
    mission:
      "Pack complet pour defiles, lancements, expositions — invitations, scripts, social live, captions.",
    primaryGate: "EVENT" as const,
    inputMain: "Brief evenement + type + audience",
    outputMain: "Pack multi-format pret a diffuser",
    demoEndpoint: "/api/demo/event-pack",
    iconName: "Sparkles",
  },
  {
    slug: "heritage-comms",
    id: "AG-004",
    name: "HeritageComms",
    tagline: "Zero citation sans source active",
    mission:
      "Sourcing patrimonial. Aucune sortie sans source cataloguee + citation formatee.",
    primaryGate: "HERITAGE" as const,
    inputMain: "Query heritage + contexte",
    outputMain: "Narrative blocks + citations sourcees",
    demoEndpoint: "/api/demo/heritage-quote",
    iconName: "Landmark",
  },
  {
    slug: "green-claim-checker",
    id: "AG-005",
    name: "GreenClaimChecker",
    tagline: "Zero greenwashing, multi-juridiction",
    mission:
      "Verifie chaque affirmation RSE contre preuves reelles et reglements (EU Green Claims, Loi Climat FR, CMA UK, FTC US).",
    primaryGate: "CLAIM" as const,
    inputMain: "Claim + wording type + juridiction cible",
    outputMain: "Decision PASS/BLOCK + risk level + evidence",
    demoEndpoint: "/api/demo/claim-check",
    iconName: "Leaf",
  },
] as const;

export type LuxeCommsAgentSlug = (typeof LUXE_COMMS_AGENTS)[number]["slug"];

export function getLuxeCommsAgent(slug: LuxeCommsAgentSlug) {
  return LUXE_COMMS_AGENTS.find((a) => a.slug === slug);
}

// ─── RUNTIME LOG CONTRACT (stored as AgentRun.trace JSON) ────────────────────
//
// Convention Sprint 1 : pas de table Prisma dediee. Les runs des 5 agents Luxe
// Comms sont stockes dans AgentRun (cf. prisma/schema.prisma) avec ce shape
// canonique dans le champ trace : permet l'agregation par docId parent, le
// tracking des gates declenches et l'ecran d'audit des rejections.
//
// Si la volumetrie le justifie en v2, promouvoir en model dedie LuxeCommRun.

export type LuxeCommRunTrace = {
  /** Doc parent unifie end-to-end (e.g. "DOC-0001"). */
  docIdParent: string;
  /** Gate triggered : BRAND | CLAIM | HERITAGE | EVENT | CRISIS. */
  gateTriggered: "BRAND" | "CLAIM" | "HERITAGE" | "EVENT" | "CRISIS" | null;
  /** Score brand si AG-001, null sinon. */
  score: number | null;
  /** Nombre de hard-fail detectes (AG-001). */
  hardFailCount: number | null;
  /** Risk level si AG-005. */
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
  /** Decision finale : APPROVE / REWORK / REJECT / PASS / BLOCK / PASS_WITH_REVIEW. */
  decision: string;
  /** Langue du contenu. */
  lang: BrandLang;
  /** SLA cible en heures (depend du CRISIS_MODE_ON). */
  slaTargetH: number;
  /** SLA respecte ? */
  slaMet: boolean;
  /** Feedback structure retourne au client. */
  feedback: string[];
  /** Prompt version utilisee (e.g. "v1.0.0") pour reproductibilite. */
  promptVersion: string;
  /** Data version du workbook source. */
  dataVersion: string;
};
