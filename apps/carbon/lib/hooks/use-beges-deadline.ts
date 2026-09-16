"use client";

/**
 * useBegesDeadline — échéance de renouvellement BEGES de l'organisation
 * (GET /beges/filings), ou `null` tant qu'elle est inconnue ou indisponible :
 * l'appelant masque alors son indicateur.
 *
 * L'en-tête et le tableau de bord lisent la même donnée : la réponse est
 * partagée pendant 30 s pour ne pas doubler l'appel au montage.
 */

import { useEffect, useState } from "react";

import { fetchBegesFilings, type BegesFilingsResponse } from "@/lib/api";
import { describeBegesDeadline, type BegesDeadline } from "@/lib/beges-deadline";

const SHARE_WINDOW_MS = 30_000;

let shared: Promise<BegesFilingsResponse> | null = null;

function loadFilings(): Promise<BegesFilingsResponse> {
  if (!shared) {
    const request = fetchBegesFilings();
    shared = request;
    const release = () => {
      setTimeout(() => {
        if (shared === request) shared = null;
      }, SHARE_WINDOW_MS);
    };
    // Un échec est oublié immédiatement : le montage suivant réessaie.
    request.then(release, () => {
      if (shared === request) shared = null;
    });
  }
  return shared;
}

export function useBegesDeadline(enabled = true): BegesDeadline | null {
  const [deadline, setDeadline] = useState<BegesDeadline | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadFilings()
      .then((resp) => {
        if (active) setDeadline(describeBegesDeadline(resp));
      })
      .catch(() => {
        // Échéance inconnue (pas de dépôt, droits, réseau) : indicateur masqué.
        if (active) setDeadline(null);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return deadline;
}
