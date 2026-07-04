// Feature flag Mapbox — la carte interactive ne s'active que si le token public
// est présent au build (NEXT_PUBLIC_* est inliné côté client par Next.js).
// Sans token : /materials garde la carte SVG statique (GlobalMap), zéro régression.
// Mise en place du token : docs/carbonco/MAPBOX_SETUP.md
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function isMapboxEnabled(): boolean {
  return MAPBOX_TOKEN.startsWith("pk.");
}
