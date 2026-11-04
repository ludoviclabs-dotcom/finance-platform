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
 * Pas de « système » PORTÉ ICI. En l'absence d'attribut, c'est la feuille de
 * style du domaine — pas ce composant — qui décide du rendu : ce composant ne
 * sait pas, et n'a pas besoin de savoir, ce que cette absence signifie
 * visuellement. Un troisième état explicite dupliquerait cette décision en JS,
 * et les deux divergeraient tôt ou tard.
 *
 * Ce que « l'absence d'attribut » rend concrètement dépend donc du domaine :
 * `/materials` (`MxThemeProvider`, non dérivé de ce composant) répond à
 * `prefers-color-scheme` ; Water, depuis sa refonte Industry, rend
 * systématiquement son CLAIR par défaut, qu'importe le système — un choix de
 * produit, pas une limite de ce provider. C'est toujours la feuille de style
 * qui tranche le rendu ; `defaultTheme` ne pose rien sur le DOM, il dit
 * seulement au bouton de bascule dans quel sens aller depuis « aucun choix ».
 *
 * Conséquence assumée : le premier rendu suit le comportement par défaut de la
 * feuille de style du domaine, et l'attribut n'apparaît qu'après hydratation si
 * un choix a été mémorisé. C'est un changement de thème visible, pas un écart
 * d'hydratation — l'attribut est posé dans un effet, jamais pendant le rendu.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type IntelligenceTheme = "sombre" | "clair";

interface IntelligenceThemeContextValue {
  /** `null` tant qu'aucun choix explicite n'a été mémorisé — la préférence
   *  système décide alors, et l'UI doit le dire plutôt que d'annoncer un
   *  thème que l'utilisateur n'a pas choisi. */
  theme: IntelligenceTheme | null;
  /** Thème réellement affiché : le choix mémorisé, sinon le défaut du domaine. */
  effectiveTheme: IntelligenceTheme;
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
  /** Thème que la feuille de style du domaine sert sans attribut (défaut : sombre). */
  defaultTheme?: IntelligenceTheme;
  /** Style du conteneur — par exemple les familles de police du domaine. */
  style?: CSSProperties;
}

export function IntelligenceThemeProvider({
  children,
  scope,
  className,
  defaultTheme = "sombre",
  style,
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
    const effectiveTheme: IntelligenceTheme = theme ?? defaultTheme;
    return {
      theme,
      effectiveTheme,
      setTheme,
      /* Depuis « aucun choix », basculer va vers l'AUTRE thème que le défaut
         du domaine : l'utilisateur qui actionne la bascule demande un
         changement visible. */
      toggle: () => setTheme(effectiveTheme === "clair" ? "sombre" : "clair"),
    };
  }, [theme, storageKey, defaultTheme]);

  return (
    <IntelligenceThemeContext.Provider value={value}>
      <div
        {...{ [`data-${scope}`]: "" }}
        {...(theme ? { [`data-${scope}-theme`]: theme } : {})}
        className={className}
        style={style}
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
  const { effectiveTheme, toggle } = useIntelligenceTheme();
  const goingToLight = effectiveTheme !== "clair";

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
