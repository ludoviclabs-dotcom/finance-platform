// Agrégation des poids d'approvisionnement par pays producteur, partagée entre
// la grille/fiches et la carte D3 (topojson-client + world-atlas). Le mapping
// FR → codes ISO 3166-1 couvre les 38 pays présents dans le snapshot CRM :
// `iso2` (alpha-2) reste disponible pour un usage futur, `isoNumeric` (le code
// numérique 3 chiffres, zero-paddé) est celui utilisé pour joindre les features
// topojson de world-atlas (leur `id` est le code numérique ISO 3166-1).
import type { Material } from "./dataLoader";

export interface CountryCodes {
  iso2: string;
  isoNumeric: string;
}

export const COUNTRY_CODES: Record<string, CountryCodes> = {
  "Afrique du Sud": { iso2: "ZA", isoNumeric: "710" },
  "Algérie":        { iso2: "DZ", isoNumeric: "012" },
  "Australie":      { iso2: "AU", isoNumeric: "036" },
  "Belgique":       { iso2: "BE", isoNumeric: "056" },
  "Brésil":         { iso2: "BR", isoNumeric: "076" },
  "Canada":         { iso2: "CA", isoNumeric: "124" },
  "Chili":          { iso2: "CL", isoNumeric: "152" },
  "Chine":          { iso2: "CN", isoNumeric: "156" },
  "Corée du Sud":   { iso2: "KR", isoNumeric: "410" },
  "Espagne":        { iso2: "ES", isoNumeric: "724" },
  "Etats-Unis":     { iso2: "US", isoNumeric: "840" },
  "France":         { iso2: "FR", isoNumeric: "250" },
  "Gabon":          { iso2: "GA", isoNumeric: "266" },
  "Guinée":         { iso2: "GN", isoNumeric: "324" },
  "Inde":           { iso2: "IN", isoNumeric: "356" },
  "Indonésie":      { iso2: "ID", isoNumeric: "360" },
  "Italie":         { iso2: "IT", isoNumeric: "380" },
  "Japon":          { iso2: "JP", isoNumeric: "392" },
  "Kazakhstan":     { iso2: "KZ", isoNumeric: "398" },
  "Laos":           { iso2: "LA", isoNumeric: "418" },
  "Madagascar":     { iso2: "MG", isoNumeric: "450" },
  "Maroc":          { iso2: "MA", isoNumeric: "504" },
  "Mexique":        { iso2: "MX", isoNumeric: "484" },
  "Mongolie":       { iso2: "MN", isoNumeric: "496" },
  "Mozambique":     { iso2: "MZ", isoNumeric: "508" },
  "Myanmar":        { iso2: "MM", isoNumeric: "104" },
  "Norvège":        { iso2: "NO", isoNumeric: "578" },
  "Philippines":    { iso2: "PH", isoNumeric: "608" },
  "Pérou":          { iso2: "PE", isoNumeric: "604" },
  "Qatar":          { iso2: "QA", isoNumeric: "634" },
  "RD Congo":       { iso2: "CD", isoNumeric: "180" },
  "Russie":         { iso2: "RU", isoNumeric: "643" },
  "Rwanda":         { iso2: "RW", isoNumeric: "646" },
  "Tadjikistan":    { iso2: "TJ", isoNumeric: "762" },
  "Turquie":        { iso2: "TR", isoNumeric: "792" },
  "Ukraine":        { iso2: "UA", isoNumeric: "804" },
  "Vietnam":        { iso2: "VN", isoNumeric: "704" },
  "Zimbabwe":       { iso2: "ZW", isoNumeric: "716" },
};

export interface CountryWeight {
  country: string;
  iso2: string | null;
  isoNumeric: string | null;
  total: number;
  materials: { id: string; name_fr: string; share_pct: number }[];
}

export function computeCountryWeights(materials: Material[]): CountryWeight[] {
  const byCountry = new Map<string, CountryWeight>();
  for (const m of materials) {
    for (const p of m.top_producers) {
      const codes = COUNTRY_CODES[p.country];
      const entry = byCountry.get(p.country) ?? {
        country: p.country,
        iso2: codes?.iso2 ?? null,
        isoNumeric: codes?.isoNumeric ?? null,
        total: 0,
        materials: [],
      };
      entry.total += p.share_pct;
      entry.materials.push({ id: m.id, name_fr: m.name_fr, share_pct: p.share_pct });
      byCountry.set(p.country, entry);
    }
  }
  const list = [...byCountry.values()];
  list.forEach(c => c.materials.sort((a, b) => b.share_pct - a.share_pct));
  return list.sort((a, b) => b.total - a.total);
}
