"use client";

import { openCookiePreferences } from "./consent-store";

/**
 * Rouvre la bannière cookies : le consentement doit pouvoir être retiré aussi
 * simplement qu'il a été donné.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      Gérer mes cookies
    </button>
  );
}
