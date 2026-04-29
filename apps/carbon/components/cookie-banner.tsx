"use client";

/**
 * Cookie banner RGPD — minimaliste, conforme.
 *
 * - Affiché tant que le visiteur n'a ni accepté ni refusé.
 * - Choix persisté dans localStorage sous `carbonco-cookie-consent`
 *   (valeur : "accepted" | "rejected" | "essential-only").
 * - Lien direct vers la politique cookies.
 *
 * Pas de tracker tiers déclenché par défaut tant que pas de "accepted".
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "carbonco-cookie-consent";
type Consent = "accepted" | "rejected" | "essential-only";

function readConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "accepted" || v === "rejected" || v === "essential-only") return v;
    return null;
  } catch {
    return null;
  }
}

function writeConsent(value: Consent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage indisponible (mode privé) — on ignore */
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  const choose = (value: Consent) => () => {
    writeConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Consentement cookies"
      className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-lg z-[150]"
    >
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-2xl p-5 md:p-6">
        <p className="text-sm font-bold text-neutral-900 mb-2">
          Vos préférences cookies
        </p>
        <p className="text-xs text-neutral-600 leading-relaxed mb-4">
          CarbonCo utilise uniquement des cookies essentiels au fonctionnement
          du service (authentification, sécurité). Les cookies de mesure et
          d&apos;analyse ne sont activés qu&apos;avec votre accord. Vous pouvez
          modifier ce choix à tout moment.{" "}
          <a
            href="/cookies"
            className="underline underline-offset-2 text-green-700 hover:text-green-800"
          >
            En savoir plus
          </a>
          .
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={choose("accepted")}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer"
          >
            Tout accepter
          </button>
          <button
            type="button"
            onClick={choose("essential-only")}
            className="px-4 py-2 rounded-lg bg-neutral-100 text-neutral-900 text-sm font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Essentiels uniquement
          </button>
          <button
            type="button"
            onClick={choose("rejected")}
            className="px-4 py-2 rounded-lg text-neutral-600 text-sm font-medium hover:text-neutral-900 transition-colors cursor-pointer"
          >
            Tout refuser
          </button>
        </div>
      </div>
    </div>
  );
}
