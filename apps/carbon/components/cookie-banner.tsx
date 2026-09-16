"use client";

/**
 * Cookie banner RGPD — minimaliste, conforme.
 *
 * - Affiché tant que le visiteur n'a ni accepté ni refusé.
 * - Choix persisté dans localStorage sous `carbonco-cookie-consent`
 *   (valeur : "accepted" | "rejected" | "essential-only") — format et lecture
 *   centralisés dans components/consent/consent-store.ts.
 * - Seul « Tout accepter » active la mesure d'audience (ConsentedAnalytics),
 *   sans rechargement ; « Tout refuser » est présenté au même niveau.
 * - Réouvrable à tout moment (événement `carbonco:cookie-preferences-open`,
 *   déclenché par le lien « Gérer mes cookies »).
 * - Tant qu'il est affiché, sa hauteur est publiée dans la variable CSS
 *   `--cookie-banner-offset` : les pages réservent cet espace en bas pour que
 *   la bannière ne masque ni CTA ni dernier lien (QA 2026-09-16, m-06).
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { X } from "lucide-react";

import {
  COOKIE_PREFERENCES_OPEN_EVENT,
  saveCookieConsent,
  type CookieConsent,
} from "@/components/consent/consent-store";
import { useCookieConsent } from "@/components/consent/use-cookie-consent";

export const COOKIE_BANNER_OFFSET_VAR = "--cookie-banner-offset";

const CURRENT_CHOICE_LABEL: Record<CookieConsent, string> = {
  accepted: "mesure d'audience acceptée",
  "essential-only": "cookies essentiels uniquement",
  rejected: "tout refusé",
};

/** Publie l'espace occupé par la bannière (hauteur + marge basse) sur <html>. */
function useReservedBottomSpace(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const root = document.documentElement;
    const update = () => {
      const bottom = parseFloat(window.getComputedStyle(el).bottom) || 0;
      root.style.setProperty(COOKIE_BANNER_OFFSET_VAR, `${Math.ceil(el.offsetHeight + bottom)}px`);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty(COOKIE_BANNER_OFFSET_VAR);
    };
  }, [ref, active]);
}

const BUTTON = "px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer";

export function CookieBanner() {
  const consent = useCookieConsent();
  const [reopened, setReopened] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setReopened(true);
    window.addEventListener(COOKIE_PREFERENCES_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COOKIE_PREFERENCES_OPEN_EVENT, onOpen);
  }, []);

  // `undefined` = stockage pas encore lu (rendu serveur, hydratation) : on
  // n'affiche rien pour éviter un flash chez qui a déjà choisi.
  const visible = consent === null || (reopened && consent !== undefined);

  useReservedBottomSpace(regionRef, visible);

  useEffect(() => {
    // Réouverture volontaire : le focus suit, pour les usagers du clavier.
    if (reopened) regionRef.current?.focus();
  }, [reopened]);

  if (!visible) return null;

  const choose = (value: CookieConsent) => () => {
    saveCookieConsent(value);
    setReopened(false);
  };

  return (
    <div
      ref={regionRef}
      role="region"
      aria-label="Consentement cookies"
      tabIndex={-1}
      className="fixed bottom-[calc(1rem_+_env(safe-area-inset-bottom,0px))] left-4 right-4 md:left-6 md:right-auto md:max-w-lg z-[150]"
    >
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-2xl p-4 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-sm font-bold text-neutral-900">Vos préférences cookies</p>
          {consent && (
            <button
              type="button"
              onClick={() => setReopened(false)}
              aria-label="Fermer sans modifier mon choix"
              className="-m-1 p-1 rounded-md text-neutral-500 hover:text-neutral-900 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-600 leading-relaxed mb-3 md:mb-4">
          CarbonCo dépose uniquement les cookies essentiels au fonctionnement du
          service (authentification, sécurité). La mesure d&apos;audience (Vercel
          Web Analytics, Speed Insights) n&apos;est activée qu&apos;avec votre
          accord. Vous pouvez modifier ce choix à tout moment.{" "}
          <a
            href="/cookies"
            className="underline underline-offset-2 text-green-700 hover:text-green-800"
          >
            En savoir plus
          </a>
          .
        </p>
        {consent && (
          <p className="text-xs text-neutral-500 mb-3" data-testid="cookie-current-choice">
            Choix actuel : {CURRENT_CHOICE_LABEL[consent]}.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <button
            type="button"
            onClick={choose("accepted")}
            className={`${BUTTON} bg-green-700 text-white hover:bg-green-800`}
          >
            Tout accepter
          </button>
          <button
            type="button"
            onClick={choose("rejected")}
            className={`${BUTTON} bg-neutral-800 text-white hover:bg-neutral-900`}
          >
            Tout refuser
          </button>
          <button
            type="button"
            onClick={choose("essential-only")}
            className={`${BUTTON} col-span-2 bg-neutral-100 text-neutral-900 hover:bg-neutral-200`}
          >
            Essentiels uniquement
          </button>
        </div>
      </div>
    </div>
  );
}
