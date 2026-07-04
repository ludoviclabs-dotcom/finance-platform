// Agrégation des poids d'approvisionnement par pays producteur, partagée entre
// la carte SVG statique et la choroplèthe Mapbox. Le mapping FR → ISO 3166-1
// alpha-2 couvre les 38 pays présents dans le snapshot CRM (tileset Mapbox
// `country-boundaries-v1`, propriété `iso_3166_1`).
import type { Material } from "./dataLoader";

export const COUNTRY_ISO2: Record<string, string> = {
  "Afrique du Sud": "ZA",
  "Algérie": "DZ",
  "Australie": "AU",
  "Belgique": "BE",
  "Brésil": "BR",
  "Canada": "CA",
  "Chili": "CL",
  "Chine": "CN",
  "Corée du Sud": "KR",
  "Espagne": "ES",
  "Etats-Unis": "US",
  "France": "FR",
  "Gabon": "GA",
  "Guinée": "GN",
  "Inde": "IN",
  "Indonésie": "ID",
  "Italie": "IT",
  "Japon": "JP",
  "Kazakhstan": "KZ",
  "Laos": "LA",
  "Madagascar": "MG",
  "Maroc": "MA",
  "Mexique": "MX",
  "Mongolie": "MN",
  "Mozambique": "MZ",
  "Myanmar": "MM",
  "Norvège": "NO",
  "Philippines": "PH",
  "Pérou": "PE",
  "Qatar": "QA",
  "RD Congo": "CD",
  "Russie": "RU",
  "Rwanda": "RW",
  "Tadjikistan": "TJ",
  "Turquie": "TR",
  "Ukraine": "UA",
  "Vietnam": "VN",
  "Zimbabwe": "ZW",
};

export interface CountryWeight {
  country: string;
  iso2: string | null;
  total: number;
  materials: { id: string; name_fr: string; share_pct: number }[];
}

export function computeCountryWeights(materials: Material[]): CountryWeight[] {
  const byCountry = new Map<string, CountryWeight>();
  for (const m of materials) {
    for (const p of m.top_producers) {
      const entry = byCountry.get(p.country) ?? {
        country: p.country,
        iso2: COUNTRY_ISO2[p.country] ?? null,
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
