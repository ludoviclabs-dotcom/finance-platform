"use client";

import { useSyncExternalStore } from "react";

import {
  readCookieConsent,
  subscribeCookieConsent,
  type CookieConsent,
} from "./consent-store";

const readOnClient = (): CookieConsent | null => readCookieConsent();
// Côté serveur et pendant l'hydratation, le choix est inconnu : `undefined`
// (distinct de `null` = « aucun choix enregistré »), pour ne rien afficher ni
// charger avant d'avoir lu le stockage du navigateur.
const readOnServer = (): undefined => undefined;

/**
 * Choix de consentement courant, réactif : se met à jour sans rechargement
 * après un clic dans la bannière (même onglet) ou un choix fait ailleurs
 * (événement `storage`).
 */
export function useCookieConsent(): CookieConsent | null | undefined {
  return useSyncExternalStore(subscribeCookieConsent, readOnClient, readOnServer);
}
