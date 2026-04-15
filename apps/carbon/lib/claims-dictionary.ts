/**
 * Lexique safe — CarbonCo v2
 *
 * Règle : utiliser ces constantes partout dans le code UI pour éviter les
 * promesses non opposables. Toute modification doit être validée contre la
 * réalité technique du jour.
 *
 * Créé : Phase 0 Sprint 1 (2026-04-15)
 */

// ─── Couverture produit ────────────────────────────────────────────────────

export const COVERAGE = {
  /** Module principal, couverture approfondie */
  esrs_e1: "Couverture prioritaire ESRS E1 (Changement climatique)",
  /** Référentiels transversaux inclus */
  esrs_1_2: "ESRS 1 & 2 — Exigences générales et informations transversales",
  /** Autres standards : fonctionnellement présents mais pas encore au niveau de E1 */
  esrs_other: "Autres standards ESRS en développement actif — couverture partielle",
  /** GHG Protocol intégré */
  ghg: "Méthodologie GHG Protocol — Scope 1, 2 & 3",
  /** Base officielle ADEME */
  ademe: "Facteurs d'émission Base Empreinte® ADEME intégrés",
} as const;

// ─── Intégrations ──────────────────────────────────────────────────────────

export const INTEGRATIONS = {
  /** Ce qui existe aujourd'hui */
  excel: "Import Excel structuré (modèle téléchargeable)",
  api: "API REST disponible (authentification JWT)",
  /** Ce qui est en roadmap */
  erp_roadmap: "Connecteurs ERP natifs en roadmap (SAP, Oracle, Sage, Cegid)",
} as const;

// ─── Hébergement & sécurité ────────────────────────────────────────────────

export const HOSTING = {
  /** Réalité technique actuelle */
  current: "Infrastructure EU — Vercel (CDN/compute) + Neon PostgreSQL (eu-central-1)",
  /** Chiffrement réel */
  encryption_transit: "Chiffrement TLS 1.3 en transit",
  encryption_rest: "Chiffrement AES-256 au repos (Neon)",
  /** RGPD */
  rgpd: "Conforme RGPD — hébergement EU, traitement prioritaire en zone EU",
  /** Certifications — honest roadmap */
  certs_roadmap: "Certifications en évaluation (SOC2, ISO 27001) — non obtenues à ce jour",
  /** AI Gateway */
  ai_gateway: "Traitement IA via Vercel AI Gateway — traitement prioritaire en EU",
} as const;

// ─── Support ───────────────────────────────────────────────────────────────

export const SUPPORT = {
  /** Réalité : fondateur solo */
  starter: "Support email (lun–ven, 9h–18h)",
  business: "Support email prioritaire (lun–ven, 9h–18h)",
  enterprise: "Onboarding accompagné + support dédié sur devis",
} as const;

// ─── Disponibilité ────────────────────────────────────────────────────────

export const AVAILABILITY = {
  /** Pas de SLA contractuel, pas de monitoring 24/7 */
  honest: "Disponibilité best-effort — monitoring public sur /status",
} as const;

// ─── IA & Copilote ────────────────────────────────────────────────────────

export const AI = {
  /** Ce que fait vraiment NEURAL */
  copilot: "Copilote IA — assistant ESRS avec citations sourcées (ne calcule pas automatiquement)",
  /** Positionnement IA Act */
  eu_ai_act: "Classification EU AI Act en cours d'évaluation — non auditée à ce jour",
} as const;

// ─── Méthodologie ─────────────────────────────────────────────────────────

export const METHODOLOGY = {
  public: "Méthodologie de calcul publique et téléchargeable",
  workbook: "Classeur Excel de calcul open-source disponible sur demande",
} as const;
