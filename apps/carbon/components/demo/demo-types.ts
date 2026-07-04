/**
 * Démo cinématique /demo — contrats partagés (types + données).
 *
 * Source de vérité unique pour la timeline, les phases, les moments et toutes
 * les données affichées dans la démo. Tous les composants de components/demo/
 * importent depuis ce fichier pour rester cohérents (même logique que
 * PRODUCT_DEMO_STEPS dans landing-page.tsx).
 *
 * Architecture de la timeline : voir lib/hooks/use-demo-timeline.ts.
 * Le hook est une HORLOGE qui auto-avance de moment en moment selon les durées
 * définies dans demo-tokens.ts (MOMENT_DURATIONS). Les composants sont
 * présentationnels : ils observent `currentMoment` et s'animent en conséquence.
 */

/* ────────────────────────────────────────────────────────────────────────────
   PHASES & MOMENTS
   ──────────────────────────────────────────────────────────────────────────── */

export type DemoPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DemoMoment =
  // Phase 1 — Intro
  | "intro-neural-appear"
  | "intro-prompt-import"
  // Phase 2 — Import Excel
  | "import-file-pick"
  | "import-rows-stream"
  | "import-complete"
  // Phase 3 — Mapping ADEME (+ Feature D puis compteur GES puis Feature A)
  | "mapping-rows-fade"
  | "mapping-factors-attach"
  | "mapping-neural-validation" // → Feature D (CarbonNeuralValidation)
  | "mapping-counter" // → compteur GES 0 → 1 847 tCO₂e
  | "mapping-audit-trace" // → Feature A (CarbonAuditTrace)
  // Phase 4 — Anomalies
  | "anomalies-detected"
  | "anomalies-corrected"
  // Phase 5 — Audit trail
  | "audit-trail-events"
  // Phase 6 — Export (+ Feature B puis Feature C)
  | "export-prepare"
  | "export-checkmarks"
  | "export-proof-chain" // → Feature B (CarbonProofChain)
  | "export-verify-card" // → Feature C (CarbonVerifyCard)
  // Phase 7 — CTA final (terminal)
  | "cta-final";

/** Ordre canonique de déroulement. L'index dans ce tableau = position temporelle. */
export const MOMENT_SEQUENCE: DemoMoment[] = [
  "intro-neural-appear",
  "intro-prompt-import",
  "import-file-pick",
  "import-rows-stream",
  "import-complete",
  "mapping-rows-fade",
  "mapping-factors-attach",
  "mapping-neural-validation",
  "mapping-counter",
  "mapping-audit-trace",
  "anomalies-detected",
  "anomalies-corrected",
  "audit-trail-events",
  "export-prepare",
  "export-checkmarks",
  "export-proof-chain",
  "export-verify-card",
  "cta-final",
];

export const PHASE_OF_MOMENT: Record<DemoMoment, DemoPhase> = {
  "intro-neural-appear": 1,
  "intro-prompt-import": 1,
  "import-file-pick": 2,
  "import-rows-stream": 2,
  "import-complete": 2,
  "mapping-rows-fade": 3,
  "mapping-factors-attach": 3,
  "mapping-neural-validation": 3,
  "mapping-counter": 3,
  "mapping-audit-trace": 3,
  "anomalies-detected": 4,
  "anomalies-corrected": 4,
  "audit-trail-events": 5,
  "export-prepare": 6,
  "export-checkmarks": 6,
  "export-proof-chain": 6,
  "export-verify-card": 6,
  "cta-final": 7,
};

export interface PhaseMeta {
  phase: DemoPhase;
  /** Libellé court pour le phase-indicator (footer). */
  label: string;
  /** Kicker numéroté, façon PRODUCT_DEMO_STEPS. */
  kicker: string;
}

export const PHASE_META: Record<DemoPhase, PhaseMeta> = {
  1: { phase: 1, label: "Intro", kicker: "00 / Départ" },
  2: { phase: 2, label: "Import", kicker: "01 / Collecte" },
  3: { phase: 3, label: "Calcul", kicker: "02 / Calcul" },
  4: { phase: 4, label: "Contrôle", kicker: "03 / Contrôle" },
  5: { phase: 5, label: "Preuve", kicker: "04 / Preuve" },
  6: { phase: 6, label: "Export", kicker: "05 / Livraison" },
  7: { phase: 7, label: "Essai", kicker: "06 / Suite" },
};

export const TOTAL_PHASES = 7 as const;

/* ── Helpers de comparaison de moments ──────────────────────────────────────── */

export function momentIndex(moment: DemoMoment): number {
  return MOMENT_SEQUENCE.indexOf(moment);
}

export function phaseOfMoment(moment: DemoMoment): DemoPhase {
  return PHASE_OF_MOMENT[moment];
}

/** Vrai si `current` est exactement `target`. */
export function isMoment(current: DemoMoment, target: DemoMoment): boolean {
  return current === target;
}

/** Vrai si `current` est à `target` ou après (dans l'ordre de la séquence). */
export function isMomentAtOrAfter(current: DemoMoment, target: DemoMoment): boolean {
  return momentIndex(current) >= momentIndex(target);
}

/** Vrai si `current` est dans la fenêtre [from, to] (bornes incluses). */
export function isMomentBetween(
  current: DemoMoment,
  from: DemoMoment,
  to: DemoMoment,
): boolean {
  const i = momentIndex(current);
  return i >= momentIndex(from) && i <= momentIndex(to);
}

/* ────────────────────────────────────────────────────────────────────────────
   TONALITÉS (badges) — alignées sur DEMO_TONE_CLASSES de landing-page.tsx
   ──────────────────────────────────────────────────────────────────────────── */

export type DemoTone = "green" | "cyan" | "amber" | "neutral";

export const DEMO_TONE_CLASSES: Record<DemoTone, string> = {
  green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  neutral: "border-white/15 bg-white/[0.08] text-white/70",
};

/* ────────────────────────────────────────────────────────────────────────────
   DONNÉES DE LA DÉMO (copie figée — un auditeur fictif mais crédible)
   ──────────────────────────────────────────────────────────────────────────── */

export const DEMO_FILE = "factures_energie_2025.xlsx";

/** Cible du compteur GES (tCO₂e). */
export const DEMO_GES_TARGET = 1847;
export const DEMO_GES_UNIT = "tCO₂e";

/** Facteur d'émission mis en avant (Feature D — moment NEURAL). */
export const DEMO_FACTOR = {
  name: "Gaz naturel réseau",
  source: "Base Empreinte® ADEME",
  reference: "version 2024 · §GN-R",
  value: "0,2270 kgCO₂e/kWh",
} as const;

/** Hash SHA-256 fictif (64 hex) — utilisé par Feature C et la page /demo/verify/[hash]. */
export const DEMO_HASH_FULL =
  "9f23a1b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f80912a3b4c5d6e7f";
/** Préfixe court affiché avant expansion (Feature C). */
export const DEMO_HASH_SHORT = "9f23a1b2";

/* ── Phase 2 — lignes d'import ──────────────────────────────────────────────── */

export interface DemoRow {
  label: string;
  value: string;
  tone: DemoTone;
}

export const IMPORT_ROWS: DemoRow[] = [
  { label: "14 feuilles reconnues", value: "OK", tone: "green" },
  { label: "Énergie · transport · achats", value: "3 sources", tone: "cyan" },
  { label: "Champs obligatoires", value: "96 %", tone: "neutral" },
  { label: "847 lignes normalisées", value: "prêt", tone: "green" },
];

/* ── Phase 3 — lignes de mapping ADEME ──────────────────────────────────────── */

export const MAPPING_ROWS: DemoRow[] = [
  { label: "Électricité France", value: "ADEME", tone: "green" },
  { label: "Gaz naturel réseau", value: "fact_id lié", tone: "cyan" },
  { label: "Transport amont", value: "à valider", tone: "amber" },
];

/* ── Phase 1 — aperçu du pipeline (chips reliés de l'intro) ──────────────────── */

export type PipelineIcon = "sheet" | "calculator" | "shield" | "link" | "file";

export interface PipelineStep {
  id: string;
  label: string;
  icon: PipelineIcon;
}

/** Les 5 maillons « cellule source → preuve » annoncés dès l'ouverture. */
export const PIPELINE_STEPS: PipelineStep[] = [
  { id: "sheet", label: "Tableur", icon: "sheet" },
  { id: "calc", label: "Calcul", icon: "calculator" },
  { id: "control", label: "Contrôle", icon: "shield" },
  { id: "proof", label: "Preuve", icon: "link" },
  { id: "export", label: "Export", icon: "file" },
];

/* ── Phase 2 — tableur source (grille réaliste qui se remplit) ───────────────── */

export interface SheetRow {
  date: string;
  poste: string;
  quantite: string;
  unite: string;
  source: string;
}

/** En-têtes de colonnes du tableur source affiché en Phase 2. */
export const SHEET_COLUMNS = [
  "Date",
  "Poste",
  "Quantité",
  "Unité",
  "Source",
] as const;

/** Lignes du tableur source (factures énergie/transport/achats — fictives). */
export const SHEET_ROWS: SheetRow[] = [
  { date: "31/01/25", poste: "Électricité — site Lyon", quantite: "142 800", unite: "kWh", source: "EDF" },
  { date: "28/02/25", poste: "Gaz naturel réseau", quantite: "38 400", unite: "kWh", source: "Engie" },
  { date: "15/03/25", poste: "Transport amont", quantite: "12 540", unite: "km", source: "DHL" },
  { date: "31/03/25", poste: "Électricité — site Paris", quantite: "98 200", unite: "kWh", source: "EDF" },
  { date: "30/04/25", poste: "Achats — acier", quantite: "24", unite: "t", source: "Fourn. A" },
];

/** Onglets de feuilles du classeur (le dernier agrège le reste). */
export const SHEET_TABS = ["Énergie", "Transport", "Achats", "Déchets", "+10"] as const;

/* ── Phase 3 — répartition par scope GHG Protocol (somme = DEMO_GES_TARGET) ──── */

export type ScopeColorKey = "scope1" | "scope2" | "scope3";

export interface ScopeSlice {
  id: string;
  label: string;
  sublabel: string;
  /** Valeur en tCO₂e — la somme des trois vaut DEMO_GES_TARGET (1 847). */
  value: number;
  colorKey: ScopeColorKey;
}

export const SCOPE_BREAKDOWN: ScopeSlice[] = [
  { id: "s1", label: "Scope 1", sublabel: "Combustion directe", value: 612, colorKey: "scope1" },
  { id: "s2", label: "Scope 2", sublabel: "Électricité achetée", value: 285, colorKey: "scope2" },
  { id: "s3", label: "Scope 3", sublabel: "Chaîne de valeur", value: 950, colorKey: "scope3" },
];

/* ── Feature A — blocs de traçabilité (remontée auditeur) ────────────────────── */

export type AuditTraceIcon =
  | "table"
  | "database"
  | "calculator"
  | "file-check"
  | "shield-check"
  | "file-text";

export interface AuditTraceBlock {
  id: string;
  label: string;
  detail: string;
  icon: AuditTraceIcon;
}

export const AUDIT_TRACE_BLOCKS: AuditTraceBlock[] = [
  {
    id: "cell",
    label: "Cellule source",
    detail: `${DEMO_FILE} · ligne 247 · col. G`,
    icon: "table",
  },
  {
    id: "factor",
    label: "Facteur ADEME",
    detail: "Gaz naturel · 0,2270 kgCO₂e/kWh · ADEME 2024",
    icon: "database",
  },
  {
    id: "formula",
    label: "Formule appliquée",
    detail: "847 lignes × facteur versionné = 1 847,3 tCO₂e",
    icon: "calculator",
  },
  {
    id: "datapoint",
    label: "Datapoint ESRS E1",
    detail: "E1-6 · Émissions GES brutes Scope 1 & 2 · §39",
    icon: "file-check",
  },
  {
    id: "hash",
    label: "Hash SHA-256",
    detail: "a3f8c2d1e9b047… · Intégrité vérifiée",
    icon: "shield-check",
  },
  {
    id: "report",
    label: "Rapport PDF",
    detail: "ESRS E1 · Page 14 · §GES brutes · Ligne 3",
    icon: "file-text",
  },
];

/* ── Phase 4 — anomalies ────────────────────────────────────────────────────── */

export interface AnomalyRow {
  id: string;
  label: string;
  /** Badge avant correction. */
  before: { value: string; tone: DemoTone };
  /** Badge après correction. */
  after: { value: string; tone: DemoTone };
  /** Si true, cette ligne est celle qui est corrigée en direct. */
  corrected: boolean;
}

export const ANOMALY_ROWS: AnomalyRow[] = [
  {
    id: "units",
    label: "Transport amont · unités mixtes",
    before: { value: "5 lignes", tone: "amber" },
    after: { value: "normalisé", tone: "green" },
    corrected: true,
  },
  {
    id: "dup",
    label: "Doublon fournisseur",
    before: { value: "2 cas", tone: "amber" },
    after: { value: "fusionné", tone: "green" },
    corrected: true,
  },
  {
    id: "period",
    label: "Période manquante",
    before: { value: "à compléter", tone: "neutral" },
    after: { value: "complété", tone: "green" },
    corrected: true,
  },
];

/* ── Phase 5 — journal d'audit (chaîne d'événements signés) ──────────────────── */

export interface AuditEvent {
  id: string;
  time: string;
  label: string;
  hash: string;
}

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: "import", time: "14:30:02", label: "Import signé", hash: "a3f8c2d1…" },
  { id: "calc", time: "14:30:48", label: "Calcul GES appliqué", hash: "c2d1e9b0…" },
  { id: "qc", time: "14:31:15", label: "Contrôle qualité validé", hash: "e9b047ac…" },
  { id: "human", time: "14:31:53", label: "Validation auditeur", hash: "47ac9f23…" },
];

/* ── Phase 6 — formats d'export ─────────────────────────────────────────────── */

export interface ExportFormat {
  id: string;
  label: string;
  ext: string;
  detail: string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: "pdf", label: "Rapport ESRS", ext: "PDF", detail: "Synthèse E1 · 14 pages" },
  { id: "xbrl", label: "Document ESEF", ext: "iXBRL", detail: "Taxonomie EFRAG 2024 · beta" },
  { id: "zip", label: "Evidence Pack", ext: "ZIP", detail: "Sources + manifest signé" },
];

/* ── Feature B — chaîne de preuve (5 blocs signés) ──────────────────────────── */

export interface ProofBlock {
  id: string;
  label: string;
  timestamp: string;
  miniHash: string;
}

export const PROOF_BLOCKS: ProofBlock[] = [
  { id: "import", label: "Import", timestamp: "14:30:02", miniHash: "a3f8…" },
  { id: "calc", label: "Calcul", timestamp: "14:30:48", miniHash: "c2d1…" },
  { id: "control", label: "Contrôle", timestamp: "14:31:15", miniHash: "e9b0…" },
  { id: "report", label: "Rapport", timestamp: "14:31:53", miniHash: "47ac…" },
  { id: "evidence", label: "Evidence Pack", timestamp: "14:32:10", miniHash: "9f23…" },
];

/* ── Feature C — vérification publique ──────────────────────────────────────── */

export const VERIFY_CHECKS: string[] = [
  "Rapport vérifié",
  "Source intacte",
  "Méthode conservée (GHG Protocol + ADEME)",
  "Aucun outil propriétaire requis",
];

/** Métadonnées affichées par la page /demo/verify/[hash] (fausse vérif, sans API). */
export const VERIFY_META = {
  company: "Société Démo · Carbon&Co",
  domain: "demo.carbonco.fr",
  filename: "evidence-pack-demo.zip",
  generatedAt: "14 juin 2026 · 14:32 UTC+1",
  eventCount: 847,
  frozenCount: 127,
  sizeLabel: "2,4 Mo",
} as const;
