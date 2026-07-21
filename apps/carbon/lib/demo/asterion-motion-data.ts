/**
 * asterion-motion-data.ts — données canoniques du scénario de démonstration
 * « Asterion Motion » (100% FICTIF), consommées par le cockpit /demo/asterion-motion.
 *
 * Ces valeurs reflètent apps/api/demo/scenarios/asterion-motion-v1/*.json (source
 * de vérité backend). Le cockpit les injecte dans les VRAIS composants
 * (ReviewGate, DataStatusBadge, SourceDrawer) — rendu déterministe, hors-ligne,
 * ZÉRO appel réseau, ZÉRO coût. L'IA affichée est « SIMULÉE » (mode demo).
 */

import type { ReviewRunResponse } from "@/lib/api";

export const ASTERION_BADGES = ["IA SIMULÉE", "ZÉRO APPEL EXTERNE", "DÉMONSTRATION FICTIVE"] as const;

export type DemoDataStatus = "verified" | "estimated" | "manual";

export interface DemoMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: DemoDataStatus;
  decimals?: number;
  hint?: string;
}

/** Métriques canoniques du scénario (voir manifest.json). */
export const ASTERION_METRICS: Record<string, DemoMetric> = {
  motors: { key: "motors", label: "Moteurs / an", value: 12000, unit: "", status: "manual" },
  purchases: { key: "purchases", label: "Achats", value: 5.8, unit: "M€", status: "manual", decimals: 1 },
  scope3: { key: "scope3", label: "Scope 3 achats", value: 3480, unit: "tCO₂e", status: "estimated" },
  magnetsShare: { key: "magnetsShare", label: "Part aimants (Scope 3)", value: 61.8, unit: "%", status: "estimated", decimals: 1, hint: "Hotspot n°1" },
  electricity: { key: "electricity", label: "Électricité", value: 8.6, unit: "GWh", status: "manual", decimals: 1 },
  scope2Lb: { key: "scope2Lb", label: "Scope 2 (location-based)", value: 1860, unit: "tCO₂e", status: "estimated" },
  scope2Mb: { key: "scope2Mb", label: "Scope 2 (market-based)", value: 1090, unit: "tCO₂e", status: "estimated" },
  coverage: { key: "coverage", label: "Couverture contractuelle", value: 54, unit: "%", status: "estimated" },
  water: { key: "water", label: "Prélèvement d'eau", value: 72000, unit: "m³", status: "manual" },
  waterConfidence: { key: "waterConfidence", label: "Confiance (stress hydrique)", value: 0.81, unit: "", status: "estimated", decimals: 2, hint: "Risque ≠ confiance" },
  dependency: { key: "dependency", label: "Dépendance terres rares lourdes", value: 92, unit: "%", status: "estimated", hint: "Estimé, non vérifié" },
  exposure: { key: "exposure", label: "Exposition financière indicative", value: 1.4, unit: "M€", status: "estimated", decimals: 1 },
};

/** Étapes FONCTIONNELLES de la revue IA affichées (jamais de chain-of-thought). */
export const ASTERION_AI_TRACE = [
  { id: "select", label: "Sélection des preuves", detail: "Reference pack minimisé, sous RLS du tenant démo." },
  { id: "license", label: "Licence & sensibilité", detail: "2 artefacts exclus : 1 confidentiel, 1 licence sans affichage." },
  { id: "resolve", label: "Résolution des citations", detail: "Chaque citation pointe vers un identifiant interne réel." },
  { id: "entail", label: "Confrontation claims / preuves", detail: "Statut de support calculé déterministiquement." },
  { id: "draft", label: "Génération du brouillon", detail: "Labels DRAFT / SUGGESTION / REVIEW_REQUIRED." },
  { id: "review", label: "Attente de revue humaine", detail: "Accepter / rejeter / modifier + justification." },
] as const;

/** Preuves exclues du pack (démontre le filtrage licence/sensibilité). */
export const ASTERION_EXCLUDED_EVIDENCE = [
  { marker: "pricing", reason: "sensibilité", label: "Grille tarifaire fournisseur (confidentiel)" },
  { marker: "benchmark", reason: "licence", label: "Benchmark sectoriel (licence sans affichage)" },
] as const;

const NOW = "2026-07-21T12:00:00.000Z";

/**
 * Revue IA canonique (mode demo) — reflète EXACTEMENT ce que produit le provider
 * scenario-aware côté backend + l'entailment déterministe : les 4 cas obligatoires.
 * Injectée telle quelle dans le composant réel <ReviewGate/>.
 */
export const ASTERION_REVIEW: ReviewRunResponse = {
  run: {
    id: 1,
    company_id: 0,
    use_case: "iro_review",
    subject_type: "iro",
    subject_key: "asterion-magnet-dependency",
    provider: "demo",
    model: "demo",
    model_version: "demo-asterion-v1",
    prompt_version: "pr11",
    policy_version: "pol-1",
    input_hash: null,
    status: "succeeded",
    review_status: "needs_review",
    tokens_input: 420,
    tokens_output: 180,
    cost_estimate: 0,
    latency_ms: 0,
    error_code: null,
    created_at: NOW,
    completed_at: NOW,
  },
  claims: [
    {
      id: 1,
      claim_index: 0,
      claim_text: "La dépendance aux terres rares lourdes dépasse **90 %** pour la chaîne aimants du E-Drive X4.",
      structured_payload: { ref_id: "artifact:101" },
      output_label: "REVIEW_REQUIRED",
      support_status: "partially_supported",
      citations: [
        {
          id: 101, resource_type: "artifact", internal_id: 101, source_id: 11,
          release_id: 21, artifact_id: 101, observation_id: null,
          locator: { page_reference: "12", excerpt: "Dépendance estimée à 92 % aux terres rares lourdes — estimation, non vérifiée." },
          data_status: "estimated", sensitivity: "internal", license_ok: true, stale: false,
        },
      ],
    },
    {
      id: 2,
      claim_index: 1,
      claim_text: "Le contenu recyclé des aimants NdFeB est de **80 %** (déclaration fournisseur).",
      structured_payload: { contradiction: true, ref_id: "artifact:102" },
      output_label: "REVIEW_REQUIRED",
      support_status: "contradicted",
      citations: [
        {
          id: 102, resource_type: "artifact", internal_id: 102, source_id: null,
          release_id: null, artifact_id: 102, observation_id: null,
          locator: { page_reference: "4", excerpt: "Audit masse-bilan tiers : contenu recyclé PROUVÉ 35 % (déclaration fournisseur : 80 %)." },
          data_status: "verified", sensitivity: "internal", license_ok: true, stale: false,
        },
      ],
    },
    {
      id: 3,
      claim_index: 2,
      claim_text: "Un fournisseur alternatif d'aimants serait qualifiable en **moins de 90 jours**.",
      structured_payload: {},
      output_label: "SUGGESTION",
      support_status: "unsupported",
      citations: [],
    },
    {
      id: 4,
      claim_index: 3,
      claim_text: "Les aimants représentent **61,8 %** des émissions Scope 3 achats — corroboré par le calcul déterministe.",
      structured_payload: { ref_id: "calc:scope3" },
      output_label: "REVIEW_REQUIRED",
      support_status: "supported",
      citations: [
        {
          id: 103, resource_type: "calc_result", internal_id: 900, source_id: null,
          release_id: null, artifact_id: null, observation_id: null,
          locator: { excerpt: "Scope 3 achats 3 480 tCO₂e — part aimants 2 151 tCO₂e (61,8 %)." },
          data_status: "estimated", sensitivity: "internal", license_ok: true, stale: false,
        },
      ],
    },
  ],
  schema_valid: true,
  citation_resolved: true,
  license_allowed: true,
};
