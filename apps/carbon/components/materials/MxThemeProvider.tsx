"use client";

/**
 * Thème Sombre/Clair scopé à /materials — indépendant du data-theme global du
 * site (theme-toggle.tsx, utilisé par le header marketing que cette page ne
 * rend pas) et du système .cc-* du cockpit authentifié. Persisté sous sa
 * propre clé localStorage pour ne jamais interférer avec le choix global.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type MxTheme = "sombre" | "clair";
const STORAGE_KEY = "carbonco-materials-theme";

interface MxThemeContextValue {
  theme: MxTheme;
  setTheme: (next: MxTheme) => void;
}

const MxThemeContext = createContext<MxThemeContextValue | null>(null);

export function useMxTheme(): MxThemeContextValue {
  const ctx = useContext(MxThemeContext);
  if (!ctx) throw new Error("useMxTheme doit être utilisé sous MxThemeProvider");
  return ctx;
}

export function MxThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MxTheme>("sombre");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "sombre" || stored === "clair") setThemeState(stored);
    } catch {
      /* localStorage indisponible (navigation privée, etc.) — reste en sombre */
    }
  }, []);

  const setTheme = (next: MxTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignorer */
    }
  };

  return (
    <MxThemeContext.Provider value={{ theme, setTheme }}>
      <div data-mx data-mx-theme={theme}>
        {children}
      </div>
    </MxThemeContext.Provider>
  );
}
