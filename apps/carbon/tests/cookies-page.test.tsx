/**
 * Page /cookies — elle doit décrire ce que le site dépose réellement.
 *
 * Avant (QA 2026-09-16) : la page affirmait « nous n'affichons pas de bandeau
 * cookies » et « aucun stockage navigateur », alors qu'une bannière recueille
 * le consentement et que plusieurs préférences vivent dans localStorage.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CookiesPage from "@/app/cookies/page";
import { COOKIE_CONSENT_STORAGE_KEY, CONSENT_VALIDITY_MONTHS } from "@/components/consent/consent-store";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/session";

const ROOT = join(__dirname, "..");
const html = renderToStaticMarkup(<CookiesPage />);
const text = html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
  });
}

/** Clés `localStorage` déclarées en constante dans le code du front. */
function declaredStorageKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const source = readFileSync(file, "utf-8");
      if (!source.includes("localStorage")) continue;
      for (const match of source.matchAll(/const STORAGE_KEY = "([^"]+)"/g)) {
        keys.set(match[1], relative(ROOT, file));
      }
      // Un composant peut porter plusieurs clés — MxThemeProvider en déclare
      // une par peau dans une table. Sans cette passe, ses clés échappaient au
      // scan et pouvaient atterrir en production sans être déclarées ici.
      for (const table of source.matchAll(/const STORAGE_KEYS\b[^=]*=\s*\{([\s\S]*?)\}/g)) {
        for (const entry of table[1].matchAll(/"([^"]+)"/g)) {
          keys.set(entry[1], relative(ROOT, file));
        }
      }
    }
  }
  return keys;
}

describe("/cookies — fidèle au site", () => {
  it("ne prétend plus qu'il n'y a ni bannière ni stockage navigateur", () => {
    expect(text).not.toMatch(/n'affichons pas de bandeau/i);
    expect(text).not.toMatch(/aucun stockage navigateur/i);
  });

  it("liste les deux cookies déposés", () => {
    expect(text).toContain("cc_refresh");
    expect(text).toContain(DEMO_SESSION_COOKIE);
  });

  it("liste chaque clé de stockage local utilisée par le code", () => {
    const keys = declaredStorageKeys();
    expect(keys.size).toBeGreaterThanOrEqual(5);
    for (const [key, file] of keys) {
      expect(text, `${key} (${file}) absent de /cookies`).toContain(key);
    }
    expect(text).toContain(COOKIE_CONSENT_STORAGE_KEY);
    // Clé composée dans IntelligenceThemeProvider (`carbonco-${scope}-theme`), scope « wi ».
    expect(text).toContain("carbonco-wi-theme");
  });

  it("annonce l'opt-in, la durée de conservation du choix et les références", () => {
    expect(text).toContain("Tout accepter");
    expect(text).toContain("Tout refuser");
    expect(text).toContain(`${CONSENT_VALIDITY_MONTHS} mois`);
    expect(text).toContain("délibération n° 2020-092");
    expect(text).toContain("Article 82 de la loi n° 78-17");
  });

  it("permet de rouvrir la bannière depuis la page", () => {
    expect(html).toMatch(/<button[^>]*>Gérer mes cookies<\/button>/);
  });
});
