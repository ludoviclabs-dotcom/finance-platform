"use client";

/**
 * Thème Sombre/Clair scopé à /materials — indépendant du data-theme global du
 * site (theme-toggle.tsx, utilisé par le header marketing que cette page ne
 * rend pas) et du système .cc-* du cockpit authentifié. Persisté sous sa
 * propre clé localStorage (une par peau) pour ne jamais interférer avec le
 * choix global.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type MxTheme = "sombre" | "clair";
/** Peau visuelle du sous-arbre. "industry" = système filaire de /materials
 *  refondue (jetons sous [data-mx-skin="industry"] dans globals.css). */
export type MxSkin = "mx" | "industry";
/**
 * Une clé par peau, et c'est délibéré. L'ancienne page était sombre par
 * défaut et écrivait son choix sous `carbonco-materials-theme` ; la refonte
 * est claire d'abord. Réutiliser la même clé ferait rouvrir la refonte en
 * sombre à tout visiteur déjà venu — l'inverse de ce que la maquette montre.
 * Le prototype Claude Design prend la même précaution.
 */
const STORAGE_KEYS: Record<MxSkin, string> = {
  mx: "carbonco-materials-theme",
  industry: "carbonco-materials-refonte-theme",
};

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

export function MxThemeProvider({
  children,
  skin = "mx",
  defaultTheme = skin === "industry" ? "clair" : "sombre",
}: {
  children: ReactNode;
  skin?: MxSkin;
  /** La peau Industry est pensée clair d'abord ; la peau historique, sombre. */
  defaultTheme?: MxTheme;
}) {
  const [theme, setThemeState] = useState<MxTheme>(defaultTheme);
  const storageKey = STORAGE_KEYS[skin];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "sombre" || stored === "clair") setThemeState(stored);
    } catch {
      /* localStorage indisponible (navigation privée, etc.) — garde le défaut */
    }
  }, [storageKey]);

  const setTheme = (next: MxTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      /* ignorer */
    }
  };

  return (
    <MxThemeContext.Provider value={{ theme, setTheme }}>
      <div data-mx data-mx-skin={skin} data-mx-theme={theme}>
        {children}
      </div>
    </MxThemeContext.Provider>
  );
}
