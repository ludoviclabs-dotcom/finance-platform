/**
 * NEURAL - Aéro RegWatch sources
 *
 * Registre des sources réglementaires aéro/défense surveillées par le service
 * AeroRegWatch_Marketing (AM-SR001). Chaque source expose un endpoint public
 * versionné dont on peut calculer un hash SHA-256 stable et détecter les
 * changements jour à jour.
 *
 * MVP : OFAC SDN List uniquement (XML public, mis à jour quotidiennement
 * par le US Treasury). À enrichir par BIS Entity List, EU OFSI, EUR-Lex AI
 * Act, ASD Charter dans des sprints ultérieurs.
 */

export type RegWatchSource = {
  id: string;
  name: string;
  authority: string;
  domain: string;
  url: string;
  description: string;
  /** Impact métier si la source change. Affiché sur la page publique. */
  impactIfChanged: string;
};

export const REGWATCH_SOURCES: readonly RegWatchSource[] = [
  {
    id: "ofac-sdn",
    name: "OFAC SDN List",
    authority: "US Treasury",
    domain: "Sanctions",
    url: "https://www.treasury.gov/ofac/downloads/sdn.xml",
    description:
      "Specially Designated Nationals List — registre consolidé des entités/personnes sanctionnées par les États-Unis. Mise à jour quotidienne par l'OFAC.",
    impactIfChanged:
      "Toute communication marketing B2B aéro/défense impliquant une contrepartie nouvellement listée devient bloquée par DefenseCommsGuard. Audit des leads en cours requis.",
  },
] as const;

export function getSource(id: string): RegWatchSource | undefined {
  return REGWATCH_SOURCES.find((s) => s.id === id);
}
