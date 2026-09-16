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
  CONSENT_VALIDITY_MONTHS,
  consentExpiresAt,
  dropWithoutConsent,
  MEASUREMENT_FLAGS,
  openCookiePreferences,
  parseCookieConsent,
  readCookieConsent,
  readCookieConsentRecord,
  redactSensitiveUrl,
  resolveMeasurementFlags,
  saveCookieConsent,
  serializeCookieConsent,
  subscribeCookieConsent,
  type CookieConsent,
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

/** Valeur telle qu'écrite par la bannière, datée de maintenant (par défaut). */
const stored = (choice: CookieConsent, at: number = Date.now()) => serializeCookieConsent(choice, at);
const storedChoice = (raw: string | null | undefined) =>
  raw ? (JSON.parse(raw) as { choice: string }).choice : raw;

const DAY = 24 * 60 * 60 * 1000;

const brokenStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

afterEach(() => {
  vi.useRealTimers();
  // Réinitialise l'éventuel choix « volatil » entre deux tests.
  saveCookieConsent("rejected", memoryStorage());
  window.localStorage.clear();
});

describe("parseCookieConsent — format stocké par la bannière", () => {
  it("reconnaît exactement les trois choix écrits par la bannière", () => {
    expect(parseCookieConsent(stored("accepted"))).toBe("accepted");
    expect(parseCookieConsent(stored("rejected"))).toBe("rejected");
    expect(parseCookieConsent(stored("essential-only"))).toBe("essential-only");
  });

  it("rejette toute autre valeur (absente, altérée, autre type)", () => {
    const now = new Date().toISOString();
    for (const raw of [
      null, undefined, "", "true", "1", '{"analytics":true}', "{", 1, true, {},
      JSON.stringify({ choice: "ACCEPTED", savedAt: now }),
      JSON.stringify({ choice: "accepted" }),
      JSON.stringify({ choice: "accepted", savedAt: "hier" }),
      JSON.stringify({ choice: "accepted", savedAt: 1 }),
    ]) {
      expect(parseCookieConsent(raw), `valeur ${JSON.stringify(raw)}`).toBeNull();
    }
  });

  it("l'ancien format sans date n'est plus un choix valable (bannière reproposée)", () => {
    for (const legacy of ["accepted", "rejected", "essential-only"]) {
      expect(parseCookieConsent(legacy)).toBeNull();
    }
  });
});

describe("durée de validité — 6 mois (recommandation CNIL n° 2020-092)", () => {
  const savedAt = Date.UTC(2026, 8, 16, 10, 0, 0); // 16 septembre 2026, 10:00 UTC

  it("vaut 6 mois calendaires, pour le consentement comme pour le refus", () => {
    expect(CONSENT_VALIDITY_MONTHS).toBe(6);
    const expiresAt = Date.UTC(2027, 2, 16, 10, 0, 0); // 16 mars 2027
    for (const choice of ["accepted", "rejected", "essential-only"] as const) {
      expect(parseCookieConsent(stored(choice, savedAt), expiresAt - 1)).toBe(choice);
      expect(parseCookieConsent(stored(choice, savedAt), expiresAt)).toBeNull();
    }
  });

  it("ramène l'échéance au dernier jour du mois quand le jour n'existe pas", () => {
    expect(consentExpiresAt(new Date(Date.UTC(2026, 7, 31))).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(consentExpiresAt(new Date(Date.UTC(2027, 7, 31))).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(consentExpiresAt(new Date(Date.UTC(2026, 11, 31))).toISOString()).toBe("2027-06-30T00:00:00.000Z");
  });

  it("refuse un choix daté dans le futur (au-delà d'un jour de décalage d'horloge)", () => {
    expect(parseCookieConsent(stored("accepted", savedAt + 2 * DAY), savedAt)).toBeNull();
    expect(parseCookieConsent(stored("accepted", savedAt + DAY / 2), savedAt)).toBe("accepted");
  });

  it("expose la date de fin de validité du choix lu", () => {
    const storage = memoryStorage({ [COOKIE_CONSENT_STORAGE_KEY]: stored("rejected", savedAt) });
    const record = readCookieConsentRecord(storage, savedAt + DAY);
    expect(record?.choice).toBe("rejected");
    expect(record?.expiresAt.toISOString()).toBe("2027-03-16T10:00:00.000Z");
    expect(readCookieConsent(storage, Date.UTC(2027, 2, 17))).toBeNull();
  });
});

describe("redactSensitiveUrl — aucun jeton vers la mesure d'audience", () => {
  it("masque le jeton des liens fournisseur et des partages d'audit", () => {
    expect(redactSensitiveUrl("https://carbonco.fr/q/abc123secret")).toBe("https://carbonco.fr/q/[token]");
    expect(redactSensitiveUrl("https://carbonco.fr/audit/tok-42/export?x=1")).toBe(
      "https://carbonco.fr/audit/[token]/export?x=1",
    );
    expect(redactSensitiveUrl("/q/abc123secret")).toBe("/q/[token]");
  });

  it("retire les paramètres token et code, garde le reste", () => {
    expect(redactSensitiveUrl("https://carbonco.fr/login?token=s3cr3t&next=%2Fdashboard")).toBe(
      "https://carbonco.fr/login?next=%2Fdashboard",
    );
    expect(redactSensitiveUrl("/verify/abc?code=123456")).toBe("/verify/abc");
  });

  it("laisse intactes les autres URL", () => {
    expect(redactSensitiveUrl("https://carbonco.fr/tarifs")).toBe("https://carbonco.fr/tarifs");
    expect(redactSensitiveUrl("https://carbonco.fr/q")).toBe("https://carbonco.fr/q");
    expect(redactSensitiveUrl("/produit/carbon")).toBe("/produit/carbon");
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
    const storage = memoryStorage({ [COOKIE_CONSENT_STORAGE_KEY]: stored("essential-only") });
    expect(COOKIE_CONSENT_STORAGE_KEY).toBe("carbonco-cookie-consent");
    expect(readCookieConsent(storage)).toBe("essential-only");
    expect(storage.getItem).toHaveBeenCalledWith("carbonco-cookie-consent");
  });

  it("traite un stockage illisible comme « aucun choix »", () => {
    expect(readCookieConsent(brokenStorage)).toBeNull();
    expect(readCookieConsent(null)).toBeNull();
  });

  it("écrit le choix daté et prévient la page sans rechargement", () => {
    const storage = memoryStorage();
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);
    saveCookieConsent("accepted", storage, Date.UTC(2026, 8, 16));
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    expect(JSON.parse(storage.data.get(COOKIE_CONSENT_STORAGE_KEY) ?? "null")).toEqual({
      choice: "accepted",
      savedAt: "2026-09-16T00:00:00.000Z",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("accepted");
  });

  it("si le stockage échoue, le dernier choix vaut pour la page (y compris un retrait)", () => {
    const stale = memoryStorage({ [COOKIE_CONSENT_STORAGE_KEY]: stored("accepted") });
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
    window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_STORAGE_KEY, newValue: stored("rejected") }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("prévient l'abonné quand le choix courant expire (onglet resté ouvert)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2027, 2, 15, 10, 0, 0));
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted", Date.UTC(2026, 8, 16, 10, 0, 0)));
    const onChange = vi.fn();
    const unsubscribe = subscribeCookieConsent(onChange);
    expect(readCookieConsent()).toBe("accepted");

    vi.advanceTimersByTime(DAY - 1);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(readCookieConsent()).toBeNull();
    unsubscribe();
  });

  it("réarme sans notifier quand l'échéance dépasse la limite d'un minuteur", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 8, 16, 10, 0, 0));
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("rejected"));
    const onChange = vi.fn();
    const unsubscribe = subscribeCookieConsent(onChange);
    vi.advanceTimersByTime(30 * DAY);
    expect(onChange).not.toHaveBeenCalled();
    unsubscribe();
    vi.advanceTimersByTime(200 * DAY);
    expect(onChange).not.toHaveBeenCalled();
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

  it("le filtre beforeSend écarte tout envoi après un retrait ou une expiration", () => {
    const event = { type: "pageview", url: "https://example.test/" };
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted"));
    expect(dropWithoutConsent(event)).toEqual(event);
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("rejected"));
    expect(dropWithoutConsent(event)).toBeNull();
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted", Date.now() - 200 * DAY));
    expect(dropWithoutConsent(event)).toBeNull();
  });

  it("le filtre beforeSend masque les jetons présents dans l'URL", () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted"));
    const event = { type: "vital" as const, url: "https://example.test/q/jeton-fournisseur", route: "/q/[token]" };
    expect(dropWithoutConsent(event)).toEqual({ ...event, url: "https://example.test/q/[token]" });
    expect(event.url).toBe("https://example.test/q/jeton-fournisseur");
  });
});

const ALL_ON = { analytics: true, speedInsights: true };

describe("ConsentedAnalytics", () => {
  it("n'injecte rien au rendu serveur, quel que soit l'environnement", () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted"));
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

    expect(storedChoice(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))).toBe("rejected");
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
    expect(storedChoice(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))).toBe("essential-only");
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
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted"));
    const m = await mount(<ConsentedAnalytics flags={{ analytics: true, speedInsights: false }} />);
    expect(m.container.querySelectorAll('[data-testid="vercel-analytics"]').length).toBe(1);
    expect(m.container.querySelectorAll('[data-testid="speed-insights"]').length).toBe(0);
    await unmount(m);
  });

  it("la bannière se rouvre, affiche le choix courant et permet le retrait", async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted"));
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
    expect(m.container.textContent).toMatch(
      /Choix actuel : mesure d'audience acceptée, valable jusqu'au \d{1,2} \S+ \d{4}\./,
    );
    expect(document.activeElement).toBe(banner(m.container));

    await act(async () => button(m.container, "Tout refuser").click());
    expect(banner(m.container)).toBeNull();
    expect(trackers(m.container)).toBe(0);
    await unmount(m);
  });

  it("un choix expiré fait revenir la bannière et coupe la mesure", async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted", Date.now() - 190 * DAY));
    const m = await mount(
      <>
        <CookieBanner />
        <ConsentedAnalytics flags={ALL_ON} />
      </>,
    );
    expect(banner(m.container)).not.toBeNull();
    expect(m.container.textContent).not.toContain("Choix actuel");
    expect(trackers(m.container)).toBe(0);
    await unmount(m);
  });

  it("suit un retrait fait dans un autre onglet", async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("accepted"));
    const m = await mount(<ConsentedAnalytics flags={ALL_ON} />);
    expect(trackers(m.container)).toBe(2);
    await act(async () => {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, stored("rejected"));
      window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_CONSENT_STORAGE_KEY }));
    });
    expect(trackers(m.container)).toBe(0);
    await unmount(m);
  });
});
