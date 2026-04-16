"use client";

/**
 * useAuditMode — contexte React pour activer le mode "Vue OTI" persistant.
 *
 * Quand activé, l'UI affiche :
 *   - les badges de statut (Live/Beta/Planifié) sur chaque KPI
 *   - les hashs courts à côté des valeurs
 *   - un bandeau global "Mode audit activé"
 *
 * Persistance : localStorage key `carbon:audit-mode` (lu au montage).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "carbon:audit-mode";

interface AuditModeContextValue {
  enabled: boolean;
  toggle: () => void;
  set: (v: boolean) => void;
}

const AuditModeContext = createContext<AuditModeContextValue | null>(null);

export function AuditModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  // Hydrate depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setEnabled(true);
    } catch {
      // SSR ou localStorage indisponible — on garde false
    }
  }, []);

  const persist = useCallback((v: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // silencieux
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  const set = useCallback(
    (v: boolean) => {
      setEnabled(v);
      persist(v);
    },
    [persist],
  );

  return (
    <AuditModeContext.Provider value={{ enabled, toggle, set }}>
      {children}
    </AuditModeContext.Provider>
  );
}

export function useAuditMode(): AuditModeContextValue {
  const ctx = useContext(AuditModeContext);
  if (!ctx) {
    // Fallback safe : si pas de provider, audit mode désactivé. Utile pour SSR ou tests.
    return {
      enabled: false,
      toggle: () => {
        /* noop */
      },
      set: () => {
        /* noop */
      },
    };
  }
  return ctx;
}
