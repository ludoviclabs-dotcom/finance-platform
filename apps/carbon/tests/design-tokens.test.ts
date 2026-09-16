/**
 * Jetons de design — toute variable `--color-*` référencée doit être définie
 * (QA 2026-09-16, M-17).
 *
 * `--color-primary` était employé dans ~80 classes sans exister : une variable
 * CSS inconnue rend la déclaration invalide, le fond devient transparent et le
 * bouton « Accéder au mapping complet » s'affichait blanc sur blanc. Ce test
 * parcourt le code et échoue dès qu'une référence `var(--color-…)` n'a aucune
 * déclaration correspondante.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, relative, resolve } from "path";

const ROOT = resolve(__dirname, "..");
const SCANNED_DIRS = ["app", "components", "lib"];
const SKIPPED_DIRS = new Set(["node_modules", ".next"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name)) continue;
    const child = join(dir, entry.name);
    if (entry.isDirectory()) walk(child, out);
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(child);
  }
  return out;
}

const FILES = SCANNED_DIRS.flatMap((d) => walk(join(ROOT, d)));
const GLOBALS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

/**
 * Déclarations `--color-x:` des feuilles CSS uniquement. Une surcharge posée en
 * `style={{ "--color-x": … }}` ne vaut que pour son sous-arbre (ex. la surface
 * sombre de la démo) : elle ne rend pas le jeton disponible ailleurs.
 */
function declaredTokens(): Set<string> {
  const declared = new Set<string>();
  for (const file of FILES.filter((f) => f.endsWith(".css"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:^|[\s{;])(--color-[a-z0-9-]+)\s*:/gim)) {
      declared.add(m[1]);
    }
  }
  return declared;
}

/** Palette par défaut de Tailwind v4 (`--color-emerald-500`…), émise à la demande. */
const TAILWIND_PALETTE = /^--color-(?:[a-z]+-(?:50|[1-9]00|950)|black|white)$/;

describe("jetons de couleur", () => {
  it("chaque var(--color-…) référencée possède une déclaration", () => {
    const declared = declaredTokens();
    const missing = new Map<string, string[]>();
    for (const file of FILES) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/var\(\s*(--color-[a-z0-9-]+)/gi)) {
        const token = m[1];
        if (declared.has(token) || TAILWIND_PALETTE.test(token)) continue;
        const where = missing.get(token) ?? [];
        where.push(relative(ROOT, file));
        missing.set(token, where);
      }
    }
    const report = [...missing].map(
      ([token, files]) => `${token} ← ${[...new Set(files)].slice(0, 3).join(", ")}`,
    );
    expect(report, "jetons référencés mais jamais définis").toEqual([]);
  });

  it("--color-primary et son texte associé sont définis pour le clair ET le sombre", () => {
    const rootBlock = GLOBALS.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const darkBlock = GLOBALS.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    for (const token of ["--color-primary", "--color-primary-foreground"]) {
      expect(rootBlock, `${token} absent de :root`).toMatch(new RegExp(`${token}\\s*:`));
      expect(darkBlock, `${token} absent du thème sombre`).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it("aucun bouton à fond primaire n'impose du texte blanc (illisible en sombre)", () => {
    const offenders = FILES.filter((file) =>
      /bg-\[var\(--color-primary\)\]\s+text-white/.test(readFileSync(file, "utf8")),
    ).map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
