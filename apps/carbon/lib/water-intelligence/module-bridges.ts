/**
 * lib/water-intelligence/module-bridges.ts — miroir TypeScript de la carte des
 * ponts entre Water Intelligence et les modules CarbonCo (P14, Wave D).
 *
 * `module-bridges.json` est une COPIE, à l'octet près, du document canonique
 * `docs/carbonco/water-intelligence/contracts/MODULE_BRIDGES.json`, émis par
 * `services/water_intelligence/module_bridges.py`. Même contrainte d'outillage
 * et même garde-fou de parité que `regulatory-registry.ts` et
 * `fixture-manifest.ts`.
 *
 * ## Pourquoi les liens de la page publique viennent d'ici
 *
 * Un lien écrit à la main dans le JSX peut, un jour, recevoir un paramètre :
 * `/water?site=12345`. Ce jour-là, un identifiant de site d'entreprise voyage
 * dans une surface publique, dans l'historique du navigateur et dans les
 * journaux d'accès. Le registre backend refuse à la construction toute cible
 * portant un paramètre ou un nom de champ tenant ; en tirant les liens d'ici,
 * la page publique hérite de ce refus au lieu de le réimplémenter.
 *
 * Le document ne contient que les ponts PUBLICS : un pont interne au cockpit
 * n'est jamais exporté vers le front public.
 */

import { z } from "zod";

import rawBridges from "./module-bridges.json";

export const WiBridgeDirectionEnum = z.enum([
  "public_to_cockpit",
  "public_to_public",
  "cockpit_internal",
]);
export type WiBridgeDirection = z.infer<typeof WiBridgeDirectionEnum>;

export const WiModuleBridgeSchema = z.object({
  bridge_id: z.string().min(1),
  target_path: z.string().min(1).startsWith("/"),
  label: z.string().min(1),
  water_signal: z.string().min(1),
  direction: WiBridgeDirectionEnum,
  reads: z.string().min(1),
  requires_authentication: z.boolean(),
  carries_tenant_context: z.literal(false),
});
export type WiModuleBridge = z.infer<typeof WiModuleBridgeSchema>;

export const WiModuleBridgeDocumentSchema = z.object({
  bridge_count: z.number().int().min(0),
  bridges: z.array(WiModuleBridgeSchema),
});
export type WiModuleBridgeDocument = z.infer<typeof WiModuleBridgeDocumentSchema>;

/**
 * Ponts publics, validés au build.
 *
 * `carries_tenant_context` est typé `z.literal(false)` : un document qui
 * exporterait un pont porteur de contexte tenant casserait le build, ce qui
 * est exactement le comportement voulu.
 */
export const MODULE_BRIDGES: WiModuleBridgeDocument =
  WiModuleBridgeDocumentSchema.parse(rawBridges);

/** Accent visuel par pont — la couleur ne porte jamais seule le sens. */
export const BRIDGE_ACCENTS: Record<string, "water" | "data" | "compliance" | "adapt"> = {
  water_cockpit: "water",
  sites_geo: "water",
  resources_exposures: "data",
  materials_public: "data",
  iro_register: "compliance",
  materialite: "compliance",
  energy_scope2: "adapt",
  procurement_scope3: "adapt",
  actions: "adapt",
};

export function bridgeAccent(bridgeId: string): "water" | "data" | "compliance" | "adapt" {
  return BRIDGE_ACCENTS[bridgeId] ?? "water";
}
