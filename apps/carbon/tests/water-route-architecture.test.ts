/**
 * tests/water-route-architecture.test.ts — architecture des routes hydriques
 * (Phase A).
 *
 * Trois routes, trois natures, et c'est le SYSTÈME DE FICHIERS qui les décide :
 *
 * | URL               | fichier                                     | accès   |
 * |-------------------|---------------------------------------------|---------|
 * | `/water`          | `app/water/page.tsx`                        | public  |
 * | `/water/cockpit`  | `app/water/(authenticated)/cockpit/page.tsx`| session |
 * | `/water/decision` | `app/water/(authenticated)/decision/page.tsx`| session |
 *
 * Ce fichier teste ce qu'aucun test de page ne peut tester : la DISPOSITION.
 * Un déplacement de fichier suffit à rendre une page publique authentifiée, ou
 * l'inverse — sans qu'une seule ligne de logique change, et sans qu'aucun test
 * de rendu ne s'en aperçoive.
 *
 * Les assertions portent donc sur des chemins, sur la présence d'un layout au
 * bon endroit, et sur l'unicité de la règle d'accès. Elles échouent le jour où
 * quelqu'un recopie la garde plutôt que de la monter.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

const CARBON_ROOT = resolve(__dirname, "..");
const p = (...parts: string[]) => resolve(CARBON_ROOT, ...parts);
const read = (path: string) => readFileSync(path, "utf-8");

const PUBLIC_PAGE = p("app/water/page.tsx");
const WATER_GROUP = p("app/water/(authenticated)");
const WATER_LAYOUT = join(WATER_GROUP, "layout.tsx");
const WATER_SHELL = join(WATER_GROUP, "water-shell.tsx");
const COCKPIT_PAGE = join(WATER_GROUP, "cockpit/page.tsx");
const DECISION_PAGE = join(WATER_GROUP, "decision/page.tsx");
const AUTH_BOUNDARY = p("components/layout/authenticated-boundary.tsx");
const DASHBOARD_SHELL = p("components/layout/dashboard-shell.tsx");
const APP_LAYOUT = p("app/(app)/layout.tsx");

/** Fichiers source de l'application, hors tests et hors artefacts de build. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const SOURCE_FILES = [p("app"), p("components"), p("lib")].flatMap((dir) => walk(dir));

/* ==================================================== 1 — Disposition */

describe("disposition des fichiers", () => {
  it("sert la vitrine publique depuis app/water/page.tsx", () => {
    expect(existsSync(PUBLIC_PAGE)).toBe(true);
  });

  it("place les deux cockpits sous le groupe (authenticated)", () => {
    expect(existsSync(COCKPIT_PAGE)).toBe(true);
    expect(existsSync(DECISION_PAGE)).toBe(true);
    expect(existsSync(WATER_LAYOUT)).toBe(true);
  });

  it("ne laisse aucune page hydrique aux anciens emplacements", () => {
    /*
      Next.js refuse deux fichiers résolvant vers la même URL, mais accepte
      sans broncher un ancien fichier qui résoudrait vers une URL VOISINE —
      `app/(app)/water/page.tsx` répondrait encore sur `/water` et masquerait
      la vitrine publique. Le seul moyen de l'exclure est de vérifier que le
      fichier n'existe plus.
    */
    expect(existsSync(p("app/water-intelligence"))).toBe(false);
    expect(existsSync(p("app/(app)/water"))).toBe(false);
  });

  it("n’interpose aucun layout entre la vitrine publique et la racine", () => {
    // Un `app/water/layout.tsx` envelopperait la page publique ET les deux
    // cockpits : la première hériterait alors du chrome authentifié.
    expect(existsSync(p("app/water/layout.tsx"))).toBe(false);
  });

  it("garde le groupe (authenticated) sans page à sa racine", () => {
    // Une `page.tsx` posée là répondrait sur `/water` et entrerait en conflit
    // frontal avec la vitrine publique.
    expect(existsSync(join(WATER_GROUP, "page.tsx"))).toBe(false);
  });
});

/* ============================================ 2 — Redirection durable */

describe("redirection de l’ancienne URL publique", () => {
  it("redirige /water-intelligence vers /water, en permanent", async () => {
    const redirects = await nextConfig.redirects!();
    const water = redirects.find((r) => r.source === "/water-intelligence");

    expect(water, "aucune redirection déclarée pour /water-intelligence").toBeTruthy();
    expect(water!.destination).toBe("/water");
    /*
      `permanent: true` produit un 308, qui préserve la méthode HTTP là où un
      301 autorise les intermédiaires à transformer un POST en GET. Une
      redirection temporaire, elle, n'apprendrait rien aux moteurs et laisserait
      l'ancienne URL indexée indéfiniment.
    */
    expect(water!.permanent).toBe(true);
  });

  it("ne redirige pas la nouvelle URL, qui doit répondre elle-même", () => {
    return nextConfig.redirects!().then((redirects) => {
      expect(redirects.find((r) => r.source === "/water")).toBeUndefined();
    });
  });
});

/* ============================================ 3 — Garde non dupliquée */

describe("garde d’authentification", () => {
  const LOGIN_REDIRECT = "/login?next=";

  it("n’existe qu’en un seul exemplaire dans tout le code source", () => {
    const owners = SOURCE_FILES.filter((file) => read(file).includes(LOGIN_REDIRECT));
    expect(
      owners.map((f) => f.replace(CARBON_ROOT, "").replace(/\\/g, "/")),
    ).toEqual(["/components/layout/authenticated-boundary.tsx"]);
  });

  it("est montée par les DEUX shells authentifiés", () => {
    expect(read(APP_LAYOUT)).toContain("AuthenticatedBoundary");
    expect(read(WATER_LAYOUT)).toContain("AuthenticatedBoundary");
  });

  it("empêche structurellement un shell de rendre sans session", () => {
    /*
      `children` est une FONCTION, appelée seulement après la vérification. Un
      shell ne PEUT pas rendre quoi que ce soit sans passer par elle : c'est ce
      qui remplace le `if (!authenticated) return null` que chaque layout aurait
      dû recopier — et qu'un jour l'un d'eux aurait oublié.
    */
    const boundary = read(AUTH_BOUNDARY);
    expect(boundary).toContain("children: (session: AuthenticatedSession) => ReactNode");
    expect(boundary).toContain("if (!ready || auth.status !== \"authenticated\") return null;");
  });

  it("n’est réimplémentée dans aucune page hydrique", () => {
    for (const page of [COCKPIT_PAGE, DECISION_PAGE]) {
      const source = read(page);
      expect(source, `garde locale dans ${page}`).not.toMatch(
        /useAuth\b|getAuthToken|router\.replace\(["'`]\/login/,
      );
    }
  });
});

/* ================================== 4 — Le shell hydrique n’est pas le dashboard */

describe("shell hydrique dédié", () => {
  const shell = read(WATER_SHELL);

  /**
   * Cibles écrites dans le shell, sous leurs deux formes : l'attribut JSX
   * littéral (`href="…"`) et l'entrée de la table des sections (`href: "…"`).
   * Ne chercher que la première laisserait passer toute la navigation, qui est
   * rendue par une boucle sur la table.
   */
  const shellHrefs = [...shell.matchAll(/href[:=]\s*["']([^"']+)["']/g)].map((m) => m[1]);

  it("n’embarque ni la barre latérale ni la navigation du dashboard", () => {
    expect(shell).not.toContain("Sidebar");
    expect(shell).not.toContain("NAV_GROUPS");
    expect(shell).not.toContain("nav-config");
  });

  it("porte le titre de premier niveau", () => {
    expect(shell).toContain("<h1");
  });

  it("retire les titres hydriques de la table du dashboard", () => {
    /*
      On cherche une CLÉ de la table, pas une occurrence de texte : le fichier
      explique en commentaire pourquoi les deux entrées en sont sorties, et une
      recherche naïve trouverait cette explication.
    */
    const keys = [...read(DASHBOARD_SHELL).matchAll(/^\s*"(\/[^"]*)":/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((k) => k.startsWith("/water"))).toEqual([]);
  });

  it("expose les deux surfaces authentifiées et la vitrine publique", () => {
    expect(shellHrefs).toContain("/water/cockpit");
    expect(shellHrefs).toContain("/water/decision");
    expect(shellHrefs).toContain("/water");
    // Et la sortie vers le dashboard général, qu'il ne remplace pas.
    expect(shellHrefs).toContain("/dashboard");
  });

  it("ne compose aucune URL portant un paramètre ou un champ tenant", () => {
    expect(shellHrefs.length).toBeGreaterThan(0);
    for (const href of shellHrefs) {
      expect(href, `URL paramétrée dans le shell : ${href}`).not.toMatch(
        /\?|company_id|tenant_id|site_id|user_id/,
      );
    }
  });

  it("n’affiche aucun identifiant d’entreprise", () => {
    expect(shell).not.toContain("companyId");
    expect(shell).not.toContain("company_id");
  });
});

/* ==================================== 5 — Aucun lien resté sur l’ancienne URL */

describe("liens", () => {
  it("ne laisse aucun href vers /water-intelligence dans le code source", () => {
    /*
      La redirection rattrape un visiteur qui arrive de l'extérieur ; elle ne
      justifie pas de laisser des liens INTERNES sur l'ancienne URL, qui
      coûteraient un aller-retour réseau à chaque clic et vieilliraient sans
      qu'on s'en aperçoive.
    */
    const offenders = SOURCE_FILES.filter((file) =>
      /href[:=]\s*["'`]\/water-intelligence/.test(read(file)),
    );
    expect(offenders.map((f) => f.replace(CARBON_ROOT, ""))).toEqual([]);
  });

  it("ne laisse aucun href vers l’ancien chemin du cockpit", () => {
    // `href="/water"` reste légitime : c'est la vitrine publique. Ce qui ne
    // l'est plus, c'est de le présenter comme le cockpit — vérifié page par
    // page dans les suites dédiées.
    const offenders = SOURCE_FILES.filter((file) =>
      /href[:=]\s*["'`]\/water\/decision\/[^"'`]/.test(read(file)),
    );
    expect(offenders.map((f) => f.replace(CARBON_ROOT, ""))).toEqual([]);
  });
});
