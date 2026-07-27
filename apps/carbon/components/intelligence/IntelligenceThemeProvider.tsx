"use client";

/**
 * IntelligenceThemeProvider — bascule sombre/clair PARTAGÉE par les surfaces
 * publiques d'intelligence (Water, et toute suivante).
 *
 * ## Pourquoi ce provider existe, plutôt qu'une extension de `MxThemeProvider`
 *
 * `/materials` porte déjà exactement ce mécanisme, sous le nom
 * `MxThemeProvider` : même état, même persistance, même attribut posé sur un
 * conteneur. La tentation évidente était de l'étendre.
 *
 * Elle a été écartée. `MxThemeProvider` pose `data-mx` **et** `data-mx-theme`
 * sur son conteneur — deux crochets auxquels toute la feuille de style
 * `/materials` est accrochée. Water en héritant, chaque règle `[data-mx]`
 * s'appliquerait à Water : un couplage que rien n'exprimerait dans le code,
 * et qu'une modification de `/materials` casserait sans le savoir.
 *
 * Ce provider est donc **paramétré par son domaine** : il pose `data-<scope>`
 * et `data-<scope>-theme`, et persiste sous une clé propre. Water et
 * Materials partagent la mécanique ; ils ne partagent aucun sélecteur, aucune
 * variable et aucune clé de stockage.
 *
 * ## Pourquoi il n'y a pas de troisième état
 *
 * Pas de « système ». La feuille de style répond DÉJÀ à
 * `prefers-color-scheme` tant qu'aucun attribut n'est posé : c'est ce qui rend
 * la page correcte avant hydratation et sans JavaScript. Un troisième état
 * dupliquerait cette logique en JS, et les deux divergeraient.
 *
 * Conséquence assumée : le premier rendu suit la préférence système, et
 * l'attribut n'apparaît qu'après hydratation si un choix a été mémorisé. C'est
 * un changement de thème visible, pas un écart d'hydratation — l'attribut est
 * posé dans un effet, jamais pendant le rendu.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type IntelligenceTheme = "sombre" | "clair";

interface IntelligenceThemeContextValue {
  /** `null` tant qu'aucun choix explicite n'a été mémorisé — la préférence
   *  système décide alors, et l'UI doit le dire plutôt que d'annoncer un
   *  thème que l'utilisateur n'a pas choisi. */
  theme: IntelligenceTheme | null;
  setTheme: (next: IntelligenceTheme) => void;
  toggle: () => void;
}

const IntelligenceThemeContext =
  createContext<IntelligenceThemeContextValue | null>(null);

export function useIntelligenceTheme(): IntelligenceThemeContextValue {
  const context = useContext(IntelligenceThemeContext);
  if (!context) {
    throw new Error(
      "useIntelligenceTheme doit être utilisé sous IntelligenceThemeProvider",
    );
  }
  return context;
}

export interface IntelligenceThemeProviderProps {
  children: ReactNode;
  /**
   * Préfixe des attributs et de la clé de stockage. `"wi"` produit
   * `data-wi` / `data-wi-theme` et la clé `carbonco-wi-theme`.
   */
  scope: string;
  /** Classe appliquée au conteneur, si la surface en a besoin. */
  className?: string;
}

export function IntelligenceThemeProvider({
  children,
  scope,
  className,
}: IntelligenceThemeProviderProps) {
  const storageKey = `carbonco-${scope}-theme`;
  const [theme, setThemeState] = useState<IntelligenceTheme | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "sombre" || stored === "clair") setThemeState(stored);
    } catch {
      /* localStorage indisponible (navigation privée, politique de site) —
         la préférence système continue de décider. */
    }
  }, [storageKey]);

  const value = useMemo<IntelligenceThemeContextValue>(() => {
    const setTheme = (next: IntelligenceTheme) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        /* ignorer — le choix vaut alors pour la session en cours */
      }
    };
    return {
      theme,
      setTheme,
      /* Depuis « aucun choix », basculer va vers le clair : le thème par
         défaut de cette surface est le sombre, et l'utilisateur qui actionne
         la bascule demande l'autre. */
      toggle: () => setTheme(theme === "clair" ? "sombre" : "clair"),
    };
  }, [theme, storageKey]);

  return (
    <IntelligenceThemeContext.Provider value={value}>
      <div
        {...{ [`data-${scope}`]: "" }}
        {...(theme ? { [`data-${scope}-theme`]: theme } : {})}
        className={className}
      >
        {children}
      </div>
    </IntelligenceThemeContext.Provider>
  );
}

/** Bascule accessible. Le libellé nomme la CIBLE, jamais l'état courant. */
export function IntelligenceThemeToggle({
  className,
}: {
  className?: string;
}) {
  const { theme, toggle } = useIntelligenceTheme();
  const goingToLight = theme !== "clair";

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ?? "wi-tab"}
      data-testid="wi-theme-toggle"
      /* `aria-label` explicite : « Thème clair » seul se lirait comme un état,
         pas comme une action. */
      aria-label={
        goingToLight ? "Basculer vers le thème clair" : "Basculer vers le thème sombre"
      }
    >
      {goingToLight ? "Thème clair" : "Thème sombre"}
    </button>
  );
}
