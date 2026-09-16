/**
 * Pavage « squarified treemap » (Bruls, Huizing & van Wijk, 2000).
 *
 * Recharts fournissait le treemap de la version précédente, mais imposait ses
 * tuiles arrondies, son aspectRatio et son propre cycle de rendu. La refonte
 * dessine des rectangles à angles vifs positionnés en absolu : il ne reste
 * qu'à calculer le pavage, d'où cette centaine de lignes plutôt qu'une
 * dépendance de graphes complète.
 *
 * `items` doit être trié par valeur décroissante — l'algorithme suppose cet
 * ordre pour empiler les bandes du plus grand au plus petit.
 */

export interface SquarifyInput {
  value: number;
}

export interface SquarifyTile<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pire rapport d'aspect d'une bande, à minimiser (§ 3 de l'article). */
function worstRatio(areas: number[], side: number): number {
  const sum = areas.reduce((a, b) => a + b, 0);
  if (sum <= 0 || side <= 0) return Infinity;
  let worst = 0;
  for (const area of areas) {
    if (area <= 0) continue;
    const ratio = Math.max((side * side * area) / (sum * sum), (sum * sum) / (side * side * area));
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

export function squarify<T extends SquarifyInput>(
  items: T[],
  x: number,
  y: number,
  w: number,
  h: number
): SquarifyTile<T>[] {
  const out: SquarifyTile<T>[] = [];
  const total = items.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0 || w <= 0 || h <= 0) return out;

  let rest = items.map(d => ({ item: d, area: (d.value / total) * w * h }));
  let rx = x, ry = y, rw = w, rh = h;

  while (rest.length > 0) {
    const side = Math.min(rw, rh);
    const row = [rest[0]];
    let i = 1;
    while (
      i < rest.length &&
      worstRatio([...row, rest[i]].map(d => d.area), side) <= worstRatio(row.map(d => d.area), side)
    ) {
      row.push(rest[i]);
      i++;
    }
    rest = rest.slice(i);

    const rowArea = row.reduce((a, d) => a + d.area, 0);
    if (rw >= rh) {
      // Bande verticale, posée le long du bord gauche du rectangle restant.
      const colW = rowArea / rh;
      let cy = ry;
      for (const d of row) {
        const cellH = d.area / colW;
        out.push({ item: d.item, x: rx, y: cy, w: colW, h: cellH });
        cy += cellH;
      }
      rx += colW;
      rw -= colW;
    } else {
      // Bande horizontale, posée le long du bord haut.
      const rowH = rowArea / rw;
      let cx = rx;
      for (const d of row) {
        const cellW = d.area / rowH;
        out.push({ item: d.item, x: cx, y: ry, w: cellW, h: rowH });
        cx += cellW;
      }
      ry += rowH;
      rh -= rowH;
    }
  }

  return out;
}
