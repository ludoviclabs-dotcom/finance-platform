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
  current: "Traitement et stockage en UE — fonctions Vercel à Francfort (fra1) + Neon PostgreSQL (eu-central-1) ; modèles d'IA hébergés aux États-Unis",
  /** Chiffrement réel */
  encryption_transit: "Chiffrement TLS 1.3 en transit",
  encryption_rest: "Chiffrement AES-256 au repos (Neon)",
  /** RGPD */
  rgpd: "RGPD — sous-traitants publiés avec leur région et leurs transferts hors UE",
  /** Certifications — honest roadmap */
  certs_roadmap: "Certifications planifiées (SOC 2, ISO 27001) — aucun auditeur mandaté, non obtenues à ce jour",
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

// ─── Audit trail / preuve auditable ───────────────────────────────────────
// Phase 5.0 — Truth alignment : ces constantes remplacent toute formulation
// "garantie", "conforme à", "100% compliant" qui n'est pas opposable.

export const PROOF = {
  /** Chaîne d'empreintes SHA-256 (Phase 1.B) : rend une modification détectable, ne l'empêche pas */
  hash_chain: "Audit trail append-only · empreinte SHA-256 chaînée · modification détectable",
  /** Export ZIP avec manifeste d'empreintes (aucune signature cryptographique à ce jour) */
  export_pack: "Rapports PDF + Evidence Pack (manifeste et empreintes SHA-256)",
  /** Ce que l'empreinte prouve — et ce qu'elle ne prouve pas */
  integrity_scope:
    "L'empreinte prouve l'intégrité et l'ordre depuis la capture ; l'exactitude et l'exhaustivité se vérifient par rapprochement",
  /** Rôle du produit face au vérificateur */
  verifier: "Dossier de preuves conçu pour faciliter les travaux d'un CAC ou d'un OTI inscrit à la H2A",
  /** Vérification publique sans compte */
  verify_public: "Vérifiable publiquement via /verify/{hash} — sans aucun outil tiers",
  /** Provenance par fact_id */
  provenance: "Traçabilité par fact_id — chaque KPI relié à sa source primaire",
} as const;

// ─── Avertissements regulatoires ──────────────────────────────────────────

export const DISCLAIMERS = {
  ai_act_august_2026:
    "Le règlement (UE) 2024/1689 (AI Act), modifié par le règlement (UE) 2026/1744, s'applique de façon générale depuis le 2 août 2026 ; l'article 50(2) s'impose au 2 décembre 2026 aux systèmes déjà sur le marché.",
  csrd_omnibus:
    "Périmètre CSRD réécrit par la directive (UE) 2026/470 du 24 février 2026 (Omnibus I), en vigueur le 18 mars 2026 — transposition française en cours.",
  vsme_recommended:
    "Norme volontaire (ex-VSME) adoptée par le règlement délégué (UE) 2026/1560, en vigueur depuis le 24 septembre 2026.",
  esrs_2026:
    "ESRS 2026 : règlement délégué (UE) 2026/1563, en vigueur le 10 novembre 2026, obligatoire pour les exercices ouverts à compter du 1er janvier 2027.",
  ixbrl:
    "Export iXBRL en bêta (taxonomie EFRAG 2024) : aucun dépôt balisé de l'état de durabilité n'est exigé à ce jour (directive (UE) 2026/470).",
} as const;

// ─── Réductions chiffrées ─────────────────────────────────────────────────
// PAS DE % EN DUR sans étude pilote signée. Toujours qualifier "estimé/variable".

export const SAVINGS = {
  reporting_time: "Réduction du temps de reporting estimée — résultats variables selon taille",
  collection_time: "Collecte assistée par copilote NEURAL — gain dépendant du périmètre",
} as const;
