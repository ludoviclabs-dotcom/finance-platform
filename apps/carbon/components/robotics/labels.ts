// Libellés et formats d'affichage de /robotics. Séparés du chargeur
// (lib/robotics/dataLoader.ts), qui reste libre de toute présentation.
import type { DataQuality } from "@/lib/crm/dataLoader";
import { countryLabelFr } from "@/lib/iso3166";
import type { Actor, BlocId, Layer, SegmentId, SourceKind } from "@/lib/robotics/dataLoader";

export const BLOC_ORDER: readonly BlocId[] = ["us", "cn", "eu", "as", "other"];

export const BLOC_LABEL: Record<BlocId, string> = {
  us: "États-Unis",
  cn: "Chine",
  eu: "Europe",
  as: "Japon · Corée · Taïwan",
  other: "Autres",
};

// En-têtes de colonne de la matrice : courts pour tenir sur mobile.
export const BLOC_SHORT: Record<BlocId, string> = {
  us: "US",
  cn: "Chine",
  eu: "Europe",
  as: "JP·KR·TW",
  other: "Autres",
};

// Le bloc « Autres » se nomme par les pays de ses acteurs dans la couche
// (Lynas : Australie) plutôt que par un libellé générique.
export function blocDisplayName(bloc: BlocId, layerActors: readonly Actor[]): string {
  if (bloc !== "other") return BLOC_LABEL[bloc];
  const countries = [...new Set(layerActors.filter(a => a.bloc === "other").flatMap(a => a.countries))];
  return countries.length > 0 ? countries.map(countryLabelFr).join(", ") : BLOC_LABEL.other;
}

// Teintes des blocs : jetons --rb-* de la peau Industry (globals.css), qui
// s'inversent en thème sombre. `edge` borde les teintes claires, `ink` écrit
// dessus.
export const BLOC_COLOR: Record<BlocId, { fill: string; edge: string; ink: string }> = {
  us: { fill: "var(--rb-us)", edge: "var(--rb-us-edge)", ink: "var(--rb-us-ink)" },
  cn: { fill: "var(--rb-cn)", edge: "var(--rb-cn-edge)", ink: "var(--rb-cn-ink)" },
  eu: { fill: "var(--rb-eu)", edge: "var(--rb-eu-edge)", ink: "var(--rb-eu-ink)" },
  as: { fill: "var(--rb-as)", edge: "var(--rb-as-edge)", ink: "var(--rb-as-ink)" },
  other: { fill: "var(--rb-other)", edge: "var(--rb-other-edge)", ink: "var(--rb-other-ink)" },
};

/** Hachures d'un bloc qui conteste une couche (le plein est réservé à « domine »). */
export function blocHatch(bloc: BlocId): string {
  return `repeating-linear-gradient(45deg, ${BLOC_COLOR[bloc].edge} 0 2px, transparent 2px 5px)`;
}

// Codes des pastilles de bloc ; « Autres » prend les codes pays de ses acteurs.
const BLOC_CODE: Record<Exclude<BlocId, "other">, string> = { us: "US", cn: "CN", eu: "EU", as: "JP·KR·TW" };

export function blocCode(bloc: BlocId, layerActors: readonly Actor[]): string {
  if (bloc !== "other") return BLOC_CODE[bloc];
  const countries = [...new Set(layerActors.filter(a => a.bloc === "other").flatMap(a => a.countries))];
  return countries.length > 0 ? countries.join("·") : "AUT";
}

// Libellés courts des couches pour les graphiques serrés (pile, flux,
// parcours) ; le nom complet reste dans le panneau de lecture et les fiches.
const LAYER_SHORT: Record<string, string> = {
  "aimants-terres-rares": "Aimants & terres rares",
  "calcul-ia-fonderie": "Calcul IA & fonderie",
  batteries: "Batteries",
  "vision-perception": "Vision 3D & inertie",
  "capteurs-force-tactiles": "Capteurs force & toucher",
  "electronique-puissance": "Électronique de puissance",
  "connectique-faisceaux": "Connectique & faisceaux",
  "moteurs-actionneurs": "Moteurs & actionneurs",
  "reducteurs-vis-roulements": "Réducteurs & vis",
  "mains-prehenseurs": "Mains dextres",
  "modeles-ia-simulation": "Modèles IA & simulation",
  "constructeurs-oem": "Constructeurs",
};

export function layerShort(layer: Pick<Layer, "id" | "name">): string {
  return LAYER_SHORT[layer.id] ?? layer.name;
}

// Étiquette courte d'une institution sur le graphique des projections :
// « Goldman Sachs (révision 2026) » → « GS 2026 ».
const INSTITUTION_SHORT: Record<string, string> = {
  "Morgan Stanley": "MS",
  "Goldman Sachs": "GS",
  "Bank of America": "BofA",
};

export function institutionBase(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

export function institutionShort(name: string): string {
  const base = institutionBase(name);
  const year = /\((?:[^)]*?)(\d{4})\)/.exec(name)?.[1];
  return [INSTITUTION_SHORT[base] ?? base, year].filter(Boolean).join(" ");
}

export const SEGMENT_ORDER: readonly SegmentId[] = ["amont", "milieu", "mecatronique", "aval"];

export const SEGMENT_LABEL: Record<SegmentId, string> = {
  amont: "Amont",
  milieu: "Milieu",
  mecatronique: "Mécatronique",
  aval: "Aval",
};

export const SEGMENT_DESC: Record<SegmentId, string> = {
  amont: "Ressources, énergie & silicium",
  milieu: "Perception & électronique",
  mecatronique: "Le corps : muscles et articulations",
  aval: "Le cerveau logiciel & l'intégration",
};

// Vocabulaire de DataStatusBadge, en étiquettes de la peau Industry : le badge
// d'origine est stylé pour l'ancienne surface sombre de /materials.
export const QUALITY_META: Record<DataQuality, { label: string; className: string; help: string }> = {
  verified: {
    label: "Vérifié",
    className: "ind-tag ind-tag-accent",
    help: "Valeur lue telle quelle dans une source datée.",
  },
  estimated: {
    label: "Estimé",
    className: "ind-tag ind-tag-outline",
    help: "Fourchette de plusieurs sources, estimation d'analyste ou chiffre relayé.",
  },
  manual: {
    label: "Éditorial",
    className: "ind-tag ind-tag-neutral",
    help: "Qualification éditoriale, sans chiffre.",
  },
};

// Trois paliers de poids dans le coût matériel, sur les teintes de palier de la
// peau (--mx-tier-*) : les couleurs du treemap de /materials, pour une autre
// grandeur. Hors du module client du treemap : la légende est rendue serveur.
export type BomWeight = "high" | "mid" | "low";

export const BOM_WEIGHT_META: Record<BomWeight, { colorVar: string; ink: string; label: string }> = {
  high: { colorVar: "var(--mx-tier-high)", ink: "var(--ink-on-high)", label: "≥ 20 % du coût" },
  mid: { colorVar: "var(--mx-tier-mid)", ink: "var(--ink-on-mid)", label: "10–19 %" },
  low: { colorVar: "var(--mx-tier-low)", ink: "var(--ink-on-low)", label: "< 10 %" },
};

export function bomWeight(pct: number): BomWeight {
  if (pct >= 20) return "high";
  if (pct >= 10) return "mid";
  return "low";
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  primary: "Source primaire",
  secondary: "Source secondaire",
  editorial: "Dossier éditorial",
};

// Formatage déterministe par découpe de chaîne (pas de Date() côté client),
// comme la date du snapshot de /materials : AAAA-MM-JJ → JJ.MM.AAAA,
// AAAA-MM → MM.AAAA, tout le reste (« 2025 », « T2 2026 ») tel quel.
export function formatIsoDate(value: string): string {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (full) return `${full[3]}.${full[2]}.${full[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) return `${month[2]}.${month[1]}`;
  return value;
}

// Montant en milliards de dollars, à la française : 7 500 Md$, 6,5 Md$.
export function formatBnUsd(value: number): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md$`;
}
