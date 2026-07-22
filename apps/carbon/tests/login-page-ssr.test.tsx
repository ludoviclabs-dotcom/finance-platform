/**
 * login-page-ssr.test.tsx — garantit que /login reste rendu côté serveur.
 *
 * Régression P2 (revue Codex, PR #134) : useSearchParams() dans LoginClient,
 * sous <Suspense fallback={null}>, optait tout le sous-arbre client en rendu
 * différé (CSR bailout) — le HTML initial ne contenait qu'une limite
 * Suspense VIDE jusqu'à l'hydratation JS, cassant le contrat SSR historique
 * du formulaire de connexion.
 *
 * Correctif : `next` est lu et validé côté Server Component (page.tsx),
 * jamais via useSearchParams() dans LoginClient — qui reçoit `safeNext` en
 * prop déjà sécurisée (getSafeInternalRedirect).
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
}));

import LoginPage from "@/app/login/page";
import { LoginClient } from "@/app/login/login-client";

/**
 * Retire les commentaires `/* *\/` et `// ` avant toute vérification : ces
 * fichiers documentent délibérément, en prose, CE QUI a été retiré et
 * pourquoi (ex. « n'appelle jamais useSearchParams() ») — un `.toContain`
 * ou une regex naïve s'y romprait en confondant documentation et code réel.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const APP_LOGIN_DIR = resolve(__dirname, "../app/login");
const pageSource = stripComments(readFileSync(resolve(APP_LOGIN_DIR, "page.tsx"), "utf-8"));
const clientSource = stripComments(
  readFileSync(resolve(APP_LOGIN_DIR, "login-client.tsx"), "utf-8"),
);

const IMPORTS_SUSPENSE = /\bimport\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*["']react["']/;
const RENDERS_SUSPENSE_JSX = /<Suspense[\s>]/;
const IMPORTS_USE_SEARCH_PARAMS =
  /\bimport\s*\{[^}]*\buseSearchParams\b[^}]*\}\s*from\s*["']next\/navigation["']/;
const CALLS_USE_SEARCH_PARAMS = /\buseSearchParams\s*\(/;
const IMPORTS_SAFE_REDIRECT = /\bimport\s*\{[^}]*\bgetSafeInternalRedirect\b[^}]*\}\s*from/;

describe("Garde structurelle — pas de CSR bailout sur /login", () => {
  it("page.tsx ne pose plus de Suspense autour du formulaire", () => {
    expect(pageSource).not.toMatch(IMPORTS_SUSPENSE);
    expect(pageSource).not.toMatch(RENDERS_SUSPENSE_JSX);
  });

  it("LoginClient n'appelle jamais useSearchParams", () => {
    expect(clientSource).not.toMatch(IMPORTS_USE_SEARCH_PARAMS);
    expect(clientSource).not.toMatch(CALLS_USE_SEARCH_PARAMS);
  });

  it("page.tsx lit searchParams côté serveur et valide via getSafeInternalRedirect (source unique)", () => {
    expect(pageSource).toMatch(/searchParams/);
    expect(pageSource).toMatch(IMPORTS_SAFE_REDIRECT);
    // LoginClient ne doit pas dupliquer la logique de validation (pas de 2e import).
    expect(clientSource).not.toMatch(IMPORTS_SAFE_REDIRECT);
  });
});

describe("LoginPage (Server Component) — safeNext calculé et transmis", () => {
  async function renderPage(nextParam?: string | string[]) {
    return LoginPage({
      searchParams: Promise.resolve(nextParam === undefined ? {} : { next: nextParam }),
    });
  }

  it("sans next → safeNext = /dashboard (fallback historique)", async () => {
    const el = await renderPage();
    expect(el.props.safeNext).toBe("/dashboard");
  });

  it("next=/resources → safeNext transmis tel quel", async () => {
    const el = await renderPage("/resources");
    expect(el.props.safeNext).toBe("/resources");
  });

  it("next externe (https://evil.example) → /dashboard", async () => {
    const el = await renderPage("https://evil.example");
    expect(el.props.safeNext).toBe("/dashboard");
  });

  it("next protocol-relative (//evil.example) → /dashboard", async () => {
    const el = await renderPage("//evil.example");
    expect(el.props.safeNext).toBe("/dashboard");
  });

  it("next sous forme de tableau (valeur ambiguë ?next=a&next=b) → /dashboard", async () => {
    const el = await renderPage(["/resources", "/autre"]);
    expect(el.props.safeNext).toBe("/dashboard");
  });
});

describe("LoginClient — formulaire présent au premier rendu (aucune attente async)", () => {
  it("rend les champs de connexion sans dépendre de l'hydratation", () => {
    const html = renderToStaticMarkup(<LoginClient safeNext="/dashboard" />);
    expect(html).toContain('id="login-email"');
    expect(html).toContain('id="login-password"');
    expect(html).toMatch(/<button[^>]*type="submit"/);
  });

  it("safeNext=/resources : bannière contextuelle déjà présente au premier rendu", () => {
    const html = renderToStaticMarkup(<LoginClient safeNext="/resources" />);
    expect(html).toContain('data-testid="login-demo-context"');
    expect(html).toContain("Ouvrir le cockpit de démonstration");
  });

  it("safeNext=/dashboard : pas de bannière contextuelle (comportement historique)", () => {
    const html = renderToStaticMarkup(<LoginClient safeNext="/dashboard" />);
    expect(html).not.toContain('data-testid="login-demo-context"');
  });
});
