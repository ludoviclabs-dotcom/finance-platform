/**
 * Recherche du référentiel /materials (MaterialsGrid) — fonctions pures.
 *
 * QA 2026-09-16, m-12 : « cobalt » entouré d'espaces ne trouvait rien, et la
 * recherche était sensible aux accents (« beryllium » ≠ « Béryllium »).
 * La requête comme les textes comparés sont normalisés : espaces réduits,
 * casse ignorée, diacritiques retirés (décomposition NFD puis suppression des
 * marques combinantes U+0300–U+036F).
 */

import type { Material } from "@/lib/crm/dataLoader";

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Texte comparable : minuscules, sans accents, espaces uniques, sans bords. */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Requête telle qu'on la réaffiche à l'utilisateur (casse et accents conservés). */
export function displaySearchQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

type Searchable = Pick<Material, "name_fr" | "main_uses">;

/** Vrai si le nom ou un usage contient la requête ; une requête vide accepte tout. */
export function materialMatchesQuery(material: Searchable, query: string): boolean {
  const q = normalizeSearchText(query);
  if (q === "") return true;
  return [material.name_fr, ...material.main_uses].some((text) => normalizeSearchText(text).includes(q));
}

export function filterMaterialsByQuery<T extends Searchable>(materials: readonly T[], query: string): T[] {
  return materials.filter((m) => materialMatchesQuery(m, query));
}
