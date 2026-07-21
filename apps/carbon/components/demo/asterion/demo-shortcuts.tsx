"use client";

/**
 * DemoShortcuts — raccourcis clavier du cockpit + aide (?). Installe un listener
 * global (ignore la saisie dans un champ). Rendu accessible (aria).
 *
 *   →, Espace : étape suivante    ←  : étape précédente
 *   R : recommencer               Esc : fermer l'aide
 *   ? : afficher/masquer l'aide
 */

import { useCallback, useEffect, useState } from "react";
import { Keyboard } from "lucide-react";

interface Props {
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
}

const SHORTCUTS = [
  { keys: "→ / Espace", label: "Étape suivante" },
  { keys: "←", label: "Étape précédente" },
  { keys: "R", label: "Recommencer" },
  { keys: "?", label: "Afficher cette aide" },
  { keys: "Échap", label: "Fermer l'aide" },
];

export function DemoShortcuts({ onNext, onPrev, onReset }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onPrev();
          break;
        case "r":
        case "R":
          onReset();
          break;
        case "?":
          setHelpOpen((v) => !v);
          break;
        case "Escape":
          setHelpOpen(false);
          break;
      }
    },
    [onNext, onPrev, onReset],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  return (
    <>
      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/5"
        aria-expanded={helpOpen}
        data-testid="demo-shortcuts-toggle"
      >
        <Keyboard className="h-3.5 w-3.5" aria-hidden />
        Raccourcis
      </button>

      {helpOpen && (
        <div
          role="dialog"
          aria-label="Raccourcis clavier"
          data-testid="demo-shortcuts-help"
          className="absolute right-0 top-9 z-20 w-64 rounded-xl border border-white/15 bg-[#0d1110] p-3 shadow-xl"
        >
          <ul className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between text-xs text-white/70">
                <span>{s.label}</span>
                <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
                  {s.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
