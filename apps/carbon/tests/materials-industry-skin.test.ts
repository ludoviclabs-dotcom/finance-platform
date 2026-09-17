/**
 * Peau « Industry » de /materials — gardes de l'incident du 17/09/2026.
 *
 * La PR #185 est partie en production sans aucune règle de la peau : Vercel
 * restaurait le cache disque de build Turbopack, qui ressert une ancienne
 * version de app/globals.css. Page en Inter, radios natives à la place des
 * contrôles segmentés, tableau sans style. Reproduit en local : le build
 * suivant, lui aussi repris du cache, reste faux.
 *
 * Une fois le CSS rétabli, un second défaut apparaissait : les règles de
 * liens de la peau, trop spécifiques, repeignaient le texte des boutons-liens
 * (bouton principal illisible, accent sur accent).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

const GLOBALS_CSS = readFileSync(resolve(__dirname, "../app/globals.css"), "utf-8");

describe("peau Industry de /materials", () => {
  it("le build ne reprend pas le cache disque de Turbopack", () => {
    // À réactiver seulement quand un build repris du cache reflète une
    // modification de globals.css — voir le commentaire de next.config.ts.
    expect(nextConfig.experimental?.turbopackFileSystemCacheForBuild).toBe(false);
  });

  it("les liens de la peau gardent la spécificité d'un simple `a`", () => {
    // Écrits `[data-mx][data-mx-skin="industry"] a`, ils l'emportent sur
    // `.ind-btn-*` : seule la forme `:where(…) a` laisse les boutons-liens
    // porter leurs propres couleurs.
    expect(GLOBALS_CSS).not.toMatch(/\[data-mx-skin="industry"\]\s+a(:hover)?\s*\{/);
    expect(GLOBALS_CSS).toMatch(/:where\(\[data-mx\]\[data-mx-skin="industry"\]\) a \{/);
    expect(GLOBALS_CSS).toMatch(/\[data-mx\] \.ind-btn-primary \{ color: var\(--color-bg\); \}/);
  });
});
