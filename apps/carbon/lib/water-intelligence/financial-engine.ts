/**
 * lib/water-intelligence/financial-engine.ts — miroir TypeScript du contrat du
 * moteur de scénarios financiers hydriques (P15, Wave D).
 *
 * `financial-engine.json` est une COPIE, à l'octet près, du document canonique
 * `docs/carbonco/water-intelligence/contracts/FINANCIAL_ENGINE.json`, émis par
 * `services/water_intelligence/financial_scenarios.py::contract_document`.
 * Même contrainte d'outillage et même garde-fou de parité que les deux autres
 * miroirs de la Wave D.
 *
 * ## Pourquoi ce document ne contient aucun montant
 *
 * Le moteur calcule sur des données d'entreprise (revenu journalier, marge,
 * CAPEX). Ces données n'ont pas leur place sur une surface publique. Publier un
 * montant d'exemple serait pire qu'inutile : un chiffre plausible, même
 * étiqueté « exemple », se lit comme un ordre de grandeur validé.
 *
 * Ce que la page publique montre est donc la **mécanique** : les paramètres
 * exigés, les unités, ce que le moteur refuse de faire, et les normes
 * comptables qu'il signale comme questions à examiner.
 */

import { z } from "zod";

import rawEngine from "./financial-engine.json";

export const WiEngineUnitEnum = z.enum(["day", "ratio", "currency", "currency/day"]);
export type WiEngineUnit = z.infer<typeof WiEngineUnitEnum>;

export const WiEngineParameterSchema = z.object({
  name: z.string().min(1),
  unit: WiEngineUnitEnum,
  required: z.boolean(),
  description: z.string().min(1),
});
export type WiEngineParameter = z.infer<typeof WiEngineParameterSchema>;

export const WiAccountingSignalSchema = z.object({
  reference: z.string().min(1),
  question: z.string().min(1),
});
export type WiAccountingSignal = z.infer<typeof WiAccountingSignalSchema>;

export const WiFinancialEngineSchema = z.object({
  sensitivity_drivers: z.array(z.string().min(1)).min(1),
  money_rounding: z.string().min(1),
  parameters: z.array(WiEngineParameterSchema).min(1),
  accounting_signals: z.array(WiAccountingSignalSchema).min(1),
  refusals: z.array(z.string().min(1)).min(1),
});
export type WiFinancialEngine = z.infer<typeof WiFinancialEngineSchema>;

/** Contrat du moteur, validé au build. */
export const FINANCIAL_ENGINE: WiFinancialEngine =
  WiFinancialEngineSchema.parse(rawEngine);

/** Libellés d'unités — l'unité voyage avec la grandeur, jamais implicite. */
export const UNIT_LABELS: Record<WiEngineUnit, string> = {
  day: "jours",
  ratio: "ratio (0 à 1)",
  currency: "montant",
  "currency/day": "montant par jour",
};

/** Libellés des inducteurs de sensibilité. */
export const DRIVER_LABELS: Record<string, string> = {
  outage_days: "Jours d’arrêt",
  revenue_per_day: "Revenu journalier",
  margin_rate: "Taux de marge",
  discount_rate: "Taux d’actualisation",
};

export function driverLabel(driver: string): string {
  return DRIVER_LABELS[driver] ?? driver;
}
