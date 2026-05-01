"use client";

/**
 * Toggle Dark/Light/System pour CarbonCo.
 *
 * Respecte la convention `<html data-theme="dark">` déjà gérée par globals.css.
 * Le choix utilisateur est persisté dans `localStorage` sous `carbonco-theme`.
 * À la 1re charge, on lit la pref OS (prefers-color-scheme) si rien n'est
 * stocké. Pour éviter le flash d'arrière-plan blanc, le `theme-init.ts`
 * (script inline du layout) applique le thème avant la première peinture.
 */

import { useEffect, useState } from "react";
import { Moon, Sun, Laptop } from "lucide-react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "carbonco-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
}

interface ThemeButtonProps {
  value: Theme;
  current: Theme;
  label: string;
  icon: React.ReactNode;
  onSelect: (next: Theme) => void;
}

function ThemeButton({ value, current, label, icon, onSelect }: ThemeButtonProps) {
  const active = current === value;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={() => onSelect(value)}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
        active
          ? "bg-green-600 text-white"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      }`}
    >
      {icon}
    </button>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored ?? "system";
      setTheme(initial);
      applyTheme(initial);
    } catch {
      applyTheme("system");
    }
  }, []);

  // Réagir aux changements de pref OS quand on est en "system".
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const choose = (next: Theme) => {
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignorer */
    }
    applyTheme(next);
  };

  return (
    <div
      role="group"
      aria-label="Choix de thème"
      className={`inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 ${className}`}
    >
      <ThemeButton value="light"  current={theme} onSelect={choose} label="Thème clair"   icon={<Sun className="w-4 h-4" />} />
      <ThemeButton value="dark"   current={theme} onSelect={choose} label="Thème sombre"  icon={<Moon className="w-4 h-4" />} />
      <ThemeButton value="system" current={theme} onSelect={choose} label="Thème système" icon={<Laptop className="w-4 h-4" />} />
    </div>
  );
}

/** Script à injecter dans <head> pour appliquer le thème avant peinture. */
export const THEME_INIT_SCRIPT = `
(function(){try{var t=localStorage.getItem("carbonco-theme")||"system";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):t;document.documentElement.setAttribute("data-theme",r)}catch(e){}})();
`.trim();
