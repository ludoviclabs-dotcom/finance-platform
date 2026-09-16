/**
 * Familles de composants servant de filtre à l'Atlas 3D.
 *
 * Ce module est volontairement séparé de `Atlas3DScene` : `Atlas3D` a besoin
 * des libellés pour dessiner ses pastilles dès le rendu de la page, alors que
 * la scène n'est chargée qu'à l'ouverture de la vue (next/dynamic). Les
 * importer depuis le module de la scène aurait suffi à tirer three.js, d3-geo
 * et la topologie world-atlas dans le graphe statique de /materials, annulant
 * exactement ce que la frontière dynamique cherche à différer.
 *
 * Le filtre porte sur main_uses + category, seuls champs du snapshot qui
 * décrivent la destination industrielle d'une matière.
 */
import type { Material } from "@/lib/crm/dataLoader";

export const FAMILIES = [
  { id: "all", label: "Toutes les matières", re: null as RegExp | null },
  { id: "batt", label: "Batteries", re: /batterie|lithium|cathode|anode|électrolyte|accumulateur/i },
  { id: "mag", label: "Aimants & moteurs", re: /aimant|moteur|ndfeb|turbine|éolien/i },
  { id: "semi", label: "Semi-conducteurs", re: /semi-conduct|gaas|gan|puce|électronique|fibre optique|led|photovolta|optique/i },
  { id: "energy", label: "Énergie & réseaux", re: /nucléaire|réseau|pile|hydrogène|photovolta|éolien|solaire|acier électrique/i },
  { id: "def", label: "Défense & aérospatial", re: /défense|aéro|munition|militaire|satellite|blindage|superalliage|fusée/i },
  { id: "met", label: "Métallurgie & alliages", re: /alliage|acier|aluminium|fonderie|réfractaire|soudure|inox|superalliage/i },
] as const;

export type FamilyId = (typeof FAMILIES)[number]["id"];

export function inFamily(m: Material, familyId: FamilyId): boolean {
  const f = FAMILIES.find(x => x.id === familyId);
  if (!f?.re) return true;
  return m.main_uses.some(u => f.re!.test(u)) || f.re.test(m.category);
}
