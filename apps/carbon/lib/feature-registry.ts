/**
 * Registre de features — source de vérité UNIQUE des statuts produit.
 *
 * Toutes les surfaces qui affichent un statut (/etat-du-produit, /couverture,
 * /integrations, badges home) DOIVENT lire ce module. Aucun statut ne doit être
 * codé en dur dans un composant (T0.2 du PLAN_ACTION_CARBONCO).
 *
 * Les données vivent dans data/feature-status.json. Modifier un statut là-bas
 * met à jour toutes les pages sans toucher au code des composants.
 */

import registry from "@/data/feature-status.json";

export type FeatureStatus = "live" | "beta" | "planifie";
export type IntegrationStatus = FeatureStatus | "roadmap";
export type IntegrationSection = "disponible" | "imports-fichiers" | "roadmap";

export interface Feature {
  id: string;
  label: string;
  description: string;
  statut: FeatureStatus;
  normes: string[];
  tag?: string;
  preuve?: string;
}

export interface EsrsRow {
  id: string;
  name: string;
  description: string;
  statut: FeatureStatus;
  exports: string[];
  note?: string;
}

export interface Integration {
  id: string;
  name: string;
  category: string;
  section: IntegrationSection;
  statut: IntegrationStatus;
  description: string;
  preuve?: string;
}

const FEATURES = registry.features as Feature[];
const ESRS = registry.esrs as EsrsRow[];
const INTEGRATIONS = registry.integrations as Integration[];

/** Date de dernière mise à jour du registre (ISO `YYYY-MM-DD`). */
export function lastUpdate(): string {
  return registry.derniere_maj;
}

/** Date de dernière mise à jour formatée en français long (ex. « 13 juin 2026 »). */
export function lastUpdateLabel(): string {
  const [y, m, d] = registry.derniere_maj.split("-").map(Number);
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${d} ${mois[m - 1]} ${y}`;
}

/** Toutes les features (ordre du registre). */
export function allFeatures(): Feature[] {
  return FEATURES;
}

/** Features filtrées par statut. */
export function featuresByStatus(statut: FeatureStatus): Feature[] {
  return FEATURES.filter((f) => f.statut === statut);
}

/** Retrouve une feature par id (lève si absente — détecte les ids morts). */
export function getFeature(id: string): Feature {
  const f = FEATURES.find((x) => x.id === id);
  if (!f) throw new Error(`feature-registry: id inconnu « ${id} »`);
  return f;
}

/** Lignes de couverture ESRS (ordre du référentiel). */
export function esrsRows(): EsrsRow[] {
  return ESRS;
}

/** Compte des standards ESRS par statut. */
export function esrsCounts(): Record<FeatureStatus, number> {
  return {
    live: ESRS.filter((r) => r.statut === "live").length,
    beta: ESRS.filter((r) => r.statut === "beta").length,
    planifie: ESRS.filter((r) => r.statut === "planifie").length,
  };
}

/** Intégrations regroupées par section d'affichage (T0.4). */
export function integrationsBySection(): Record<IntegrationSection, Integration[]> {
  return {
    disponible: INTEGRATIONS.filter((i) => i.section === "disponible"),
    "imports-fichiers": INTEGRATIONS.filter((i) => i.section === "imports-fichiers"),
    roadmap: INTEGRATIONS.filter((i) => i.section === "roadmap"),
  };
}

/** Toutes les intégrations. */
export function allIntegrations(): Integration[] {
  return INTEGRATIONS;
}

/** Libellés FR courts des statuts (pour badges/légendes). */
export const STATUS_LABEL: Record<IntegrationStatus, string> = {
  live: "Disponible",
  beta: "Beta",
  planifie: "Planifié",
  roadmap: "Roadmap",
};
