/**
 * CSP — aiguillage Mapbox du proxy (proxy.ts::buildCsp).
 *
 * Le contrat testé :
 *  1. Sans NEXT_PUBLIC_MAPBOX_TOKEN, le CSP ne contient AUCUN domaine Mapbox
 *     ni worker-src/child-src — strictement identique à l'historique.
 *  2. Avec un token public `pk.`, les directives requises par mapbox-gl
 *     s'ouvrent : connect-src api/tiles/events + worker-src/child-src blob:.
 *  3. Un token invalide (secret `sk.` ou garbage) N'ouvre RIEN : le critère
 *     est le même que lib/mapbox.ts::isMapboxEnabled.
 *  4. L'ouverture Mapbox ne touche à rien d'autre : les directives hors
 *     Mapbox sont identiques avec et sans token.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildCsp } from "../proxy";

const ENV_KEY = "NEXT_PUBLIC_MAPBOX_TOKEN";
const MAPBOX_CONNECT = [
  "https://api.mapbox.com",
  "https://*.tiles.mapbox.com",
  "https://events.mapbox.com",
];

let savedToken: string | undefined;

beforeEach(() => {
  savedToken = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});

afterEach(() => {
  if (savedToken === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedToken;
});

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split("; ").map(d => {
      const [name, ...rest] = d.split(" ");
      return [name, rest.join(" ")] as const;
    })
  );
}

describe("CSP — sans token Mapbox (baseline)", () => {
  it("ne référence aucun domaine Mapbox", () => {
    expect(buildCsp()).not.toMatch(/mapbox/i);
  });

  it("n'émet ni worker-src ni child-src (fallback default-src 'self')", () => {
    const d = directives(buildCsp());
    expect(d.has("worker-src")).toBe(false);
    expect(d.has("child-src")).toBe(false);
  });

  it("conserve les directives de durcissement historiques", () => {
    const d = directives(buildCsp());
    expect(d.get("default-src")).toBe("'self'");
    expect(d.get("frame-ancestors")).toBe("'none'");
    expect(d.get("object-src")).toBe("'none'");
    expect(d.get("base-uri")).toBe("'self'");
    expect(d.get("form-action")).toBe("'self'");
  });
});

describe("CSP — avec token public pk. (Mapbox activé)", () => {
  beforeEach(() => {
    process.env[ENV_KEY] = "pk.test-token-not-real";
  });

  it("ouvre connect-src vers api/tiles/events Mapbox", () => {
    const connect = directives(buildCsp()).get("connect-src") ?? "";
    for (const domain of MAPBOX_CONNECT) expect(connect).toContain(domain);
  });

  it("autorise le web worker blob: de mapbox-gl (worker-src + child-src)", () => {
    const d = directives(buildCsp());
    expect(d.get("worker-src")).toBe("'self' blob:");
    expect(d.get("child-src")).toBe("'self' blob:");
  });

  it("ne modifie aucune directive hors Mapbox", () => {
    const withToken = directives(buildCsp());
    delete process.env[ENV_KEY];
    const baseline = directives(buildCsp());

    for (const [name, value] of baseline) {
      if (name === "connect-src") {
        // connect-src = baseline + les 3 domaines Mapbox, rien d'autre
        const extras = (withToken.get(name) ?? "")
          .split(" ")
          .filter(src => !value.split(" ").includes(src));
        expect(extras.sort()).toEqual([...MAPBOX_CONNECT].sort());
      } else {
        expect(withToken.get(name)).toBe(value);
      }
    }
  });
});

describe("CSP — token invalide (même critère que isMapboxEnabled)", () => {
  it.each(["sk.secret-token", "garbage", ""])("'%s' n'ouvre rien", token => {
    process.env[ENV_KEY] = token;
    const csp = buildCsp();
    expect(csp).not.toMatch(/mapbox/i);
    expect(directives(csp).has("worker-src")).toBe(false);
  });
});
