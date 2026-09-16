/**
 * Consentement cookies & mesure d'audience (QA 2026-09-16, M-10 / m-08).
 *
 * Après « Tout refuser », Vercel Analytics et Speed Insights restaient chargés :
 * le choix stocké par la bannière n'était lu nulle part. Ces tests fixent le
 * contrat du module partagé : format lu, opt-in strict, refus par défaut,
 * diffusion du changement sans rechargement, drapeaux d'environnement.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

// Les SDK Vercel sont remplacés par des marqueurs : on vérifie QUAND ils sont
// montés, pas ce qu'ils injectent.
vi.mock("@vercel/analytics/next", async () => {
  const { createElement } = await import("react");
  return {
    Analytics: (props: { beforeSend?: unknown }) =>
      createElement("i", { "data-testid": "vercel-analytics", "data-filtered": typeof props.beforeSend }),
  };
});
vi.mock("@vercel/speed-insights/next", async () => {
  const { createElement } = await import("react");
  return {
    SpeedInsights: (props: { beforeSend?: unknown }) =>
      createElement("i", { "data-testid": "speed-insights", "data-filtered": typeof props.beforeSend }),
  };
});

import { CookieBanner, COOKIE_BANNER_OFFSET_VAR } from "@/components/cookie-banner";
import {
  allowsAudienceMeasurement,
  canSendAudienceEvent,
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_PREFERENCES_OPEN_EVENT,
  dropWithoutConsent,
  MEASUREMENT_FLAGS,
  openCookiePreferences,
  parseCookieConsent,
  readCookieConsent,
  resolveMeasurementFlags,
  saveCookieConsent,
  subscribeCookieConsent,
} from "@/components/consent/consent-store";
import { ConsentedAnalytics } from "@/components/consent/consented-analytics";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    data,
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

afterEach(() => {
  // Réinitialise l'éventuel choix « volatil » entre deux tests.
  saveCookieConsent("rejected", memoryStorage());
  window.localStorage.clear();
});

describe("parseCookieConsent — format stocké par la bannière", () => {
  it("reconnaît exactement les trois valeurs écrites par la bannière", () => {
    expect(parseCookieConsent("accepted")).toBe("accepted");
    expect(parseCookieConsent("rejected")).toBe("rejected");
    expect(parseCookieConsent("essential-only")).toBe("essential-only");
  });

  it("rejette toute autre valeur (absente, altérée, autre type)", () => {
    for (const raw of [null, undefined, "", "ACCEPTED", " accepted", "true", "1", '{"analytics":true}', 1, true, {}]) {
      expect(parseCookieConsent(raw), `valeur ${JSON.stringify(raw)}`).toBeNull();
    }
  });
});

describe("allowsAudienceMeasurement — opt-in strict", () => {
  it("n'autorise la mesure qu'après « Tout accepter »", () => {
    expect(allowsAudienceMeasurement("accepted")).toBe(true);
    expect(allowsAudienceMeasurement("rejected")).toBe(false);
    expect(allowsAudienceMeasurement("essential-only")).toBe(false);
  });

  it("refuse par défaut quand aucun choix n'est connu", () => {
    expect(allowsAudienceMeasurement(null)).toBe(false);
    expect(allowsAudienceMeasurement(undefined)).toBe(false);
  });
});

describe("lecture / écriture du choix", () => {
  it("lit la clé historique de la bannière", () => {
    const storage = memoryStorage({ [COOKIE_CONSENT_STORAGE_KEY]: "essential-only" });
    expect(COOKIE_CONSENT_STORAGE_KEY).toBe("carbonco-cookie-consent");
    expect(readCookieConsent(storage)).toBe("essential-only");
    expect(storage.getItem).toHaveBeenCalledWith("carbonco-cookie-consent");
  });

  it("traite un stockage illisible comme « aucun choix »", () => {
    expect(readCookieConsent(brokenStorage)).toBeNull();
    expect(readCookieConsent(null)).toBeNull();
  });

  it("écrit la valeur brute et prévient la page sans rechargement", () => {
    const storage = memoryStorage();
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);
    saveCookieConsent("accepted", storage);
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    expect(storage.data.get(COOKIE_CONSENT_STORAGE_KEY)).toBe("accepted");
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("accepted");
  });

  it("si le stockage échoue, le dernier choix vaut pour la page (y compris un retrait)", () => {
    const stale = memoryStorage({ [COOKIE_CONSENT_STORAGE_KEY]: "accepted" });
    saveCookieConsent("rejected", brokenStorage);
    // Le « rejected » de la page prime sur l'« accepted » resté en stockage.
    expect(readCookieConsent(stale)).toBe("rejected");
  });
});

describe("subscribeCookieConsent — réactivité", () => {
  it("notifie après un choix dans l'onglet puis se désabonne proprement", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeCookieConsent(onChange);
    saveCookieConsent("accepted", memoryStorage());
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    saveCookieConsent("rejected", memoryStorage());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("suit les changements faits dans un autre onglet, et ignore les autres clés", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeCookieConsent(onChange);
    window.dispatchEvent(new StorageEvent("storage", { key: "carbonco-theme", newValue: "dark" }));
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_STORAGE_KEY, newValue: "rejected" }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("openCookiePreferences émet l'événement de réouverture de la bannière", () => {
    const listener = vi.fn();
    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, listener);
    openCookiePreferences();
    window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("drapeaux d'environnement (QA m-08 : 404 sur /_vercel/insights/script.js)", () => {
  it("n'active chaque outil que sur la valeur exacte \"1\"", () => {
    expect(resolveMeasurementFlags({})).toEqual({ analytics: false, speedInsights: false });
    expect(
      resolveMeasurementFlags({
        NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS: "true",
        NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS: "0",
      }),
    ).toEqual({ analytics: false, speedInsights: false });
    expect(resolveMeasurementFlags({ NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS: "1" })).toEqual({
      analytics: true,
      speedInsights: false,
    });
    expect(resolveMeasurementFlags({ NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS: "1" })).toEqual({
      analytics: false,
      speedInsights: true,
    });
  });

  it("n'émet un événement qu'avec le drapeau ET l'opt-in", () => {
    const on = { analytics: true, speedInsights: false };
    const off = { analytics: false, speedInsights: false };
    expect(canSendAudienceEvent(on, "accepted")).toBe(true);
    expect(canSendAudienceEvent(on, "rejected")).toBe(false);
    expect(canSendAudienceEvent(on, null)).toBe(false);
    expect(canSendAudienceEvent(off, "accepted")).toBe(false);
  });

  it("le filtre beforeSend écarte tout envoi après un retrait", () => {
    const event = { type: "pageview", url: "https://example.test/" };
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    expect(dropWithoutConsent(event)).toBe(event);
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "rejected");
    expect(dropWithoutConsent(event)).toBeNull();
  });
});

const ALL_ON = { analytics: true, speedInsights: true };

describe("ConsentedAnalytics", () => {
  it("n'injecte rien au rendu serveur, quel que soit l'environnement", () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    expect(renderToStaticMarkup(<ConsentedAnalytics flags={ALL_ON} />)).toBe("");
  });

  it("est désactivé sans drapeau explicite (environnement de test)", () => {
    expect(MEASUREMENT_FLAGS).toEqual({ analytics: false, speedInsights: false });
  });
});

/* ── Parcours monté (jsdom) ─────────────────────────────────────────────── */


interface Mounted {
  container: HTMLElement;
  root: Root;
}

async function mount(node: React.ReactElement): Promise<Mounted> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

async function unmount({ container, root }: Mounted) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

function button(scope: ParentNode, label: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!found) throw new Error(`Bouton introuvable : ${label}`);
  return found;
}

const trackers = (scope: ParentNode) =>
  scope.querySelectorAll('[data-testid="vercel-analytics"], [data-testid="speed-insights"]').length;
const banner = (scope: ParentNode) => scope.querySelector('[aria-label="Consentement cookies"]');
const offset = () => document.documentElement.style.getPropertyValue(COOKIE_BANNER_OFFSET_VAR);

describe("bannière + mesure d'audience — sans rechargement", () => {
  it("rien n'est chargé par défaut ; « Tout refuser » ne charge rien", async () => {
    const m = await mount(
      <>
        <CookieBanner />
        <ConsentedAnalytics flags={ALL_ON} />
      </>,
    );
    expect(banner(m.container)).not.toBeNull();
    expect(trackers(m.container)).toBe(0);
    expect(offset()).not.toBe("");

    await act(async () => button(m.container, "Tout refuser").click());

    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe("rejected");
    expect(banner(m.container)).toBeNull();
    expect(trackers(m.container)).toBe(0);
    expect(offset()).toBe("");
    await unmount(m);
  });

  it("« Essentiels uniquement » ne charge rien non plus", async () => {
    const m = await mount(
      <>
        <CookieBanner />
        <ConsentedAnalytics flags={ALL_ON} />
      </>,
    );
    await act(async () => button(m.container, "Essentiels uniquement").click());
    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe("essential-only");
    expect(trackers(m.container)).toBe(0);
    await unmount(m);
  });

  it("« Tout accepter » charge les deux outils, avec le filtre beforeSend", async () => {
    const m = await mount(
      <>
        <CookieBanner />
        <ConsentedAnalytics flags={ALL_ON} />
      </>,
    );
    await act(async () => button(m.container, "Tout accepter").click());
    expect(trackers(m.container)).toBe(2);
    for (const el of m.container.querySelectorAll("[data-filtered]")) {
      expect(el.getAttribute("data-filtered")).toBe("function");
    }
    await unmount(m);
  });

  it("un drapeau absent garde l'outil éteint même après acceptation", async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    const m = await mount(<ConsentedAnalytics flags={{ analytics: true, speedInsights: false }} />);
    expect(m.container.querySelectorAll('[data-testid="vercel-analytics"]').length).toBe(1);
    expect(m.container.querySelectorAll('[data-testid="speed-insights"]').length).toBe(0);
    await unmount(m);
  });

  it("la bannière se rouvre, affiche le choix courant et permet le retrait", async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    const m = await mount(
      <>
        <CookieBanner />
        <ConsentedAnalytics flags={ALL_ON} />
      </>,
    );
    expect(banner(m.container)).toBeNull();
    expect(trackers(m.container)).toBe(2);

    await act(async () => openCookiePreferences());
    expect(banner(m.container)).not.toBeNull();
    expect(m.container.textContent).toContain("Choix actuel : mesure d'audience acceptée.");
    expect(document.activeElement).toBe(banner(m.container));

    await act(async () => button(m.container, "Tout refuser").click());
    expect(banner(m.container)).toBeNull();
    expect(trackers(m.container)).toBe(0);
    await unmount(m);
  });

  it("suit un retrait fait dans un autre onglet", async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    const m = await mount(<ConsentedAnalytics flags={ALL_ON} />);
    expect(trackers(m.container)).toBe(2);
    await act(async () => {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "rejected");
      window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_STORAGE_KEY }));
    });
    expect(trackers(m.container)).toBe(0);
    await unmount(m);
  });
});
