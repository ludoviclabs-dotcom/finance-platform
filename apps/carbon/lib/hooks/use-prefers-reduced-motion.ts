"use client";

import { useSyncExternalStore } from "react";

/**
 * `prefers-reduced-motion`, sans écart d'hydratation.
 *
 * `useReducedMotion` de framer-motion lit la préférence dès le premier rendu
 * client, alors que le serveur rend sans elle. Un composant prérendu qui s'en
 * sert pour son état initial (compteur à 0 ou à sa valeur finale) produit
 * alors un HTML différent de celui du serveur : erreur React #418 chez tout
 * visiteur qui a activé « réduire les animations ».
 *
 * Ici, l'hydratation reprend la valeur du serveur (`false`), puis React
 * rerend aussitôt avec la vraie préférence, et suit ses changements.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const readOnClient = () => window.matchMedia(QUERY).matches;
const readOnServer = () => false;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readOnClient, readOnServer);
}
