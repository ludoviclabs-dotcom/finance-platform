/**
 * Raccourcis clavier de l'aperçu dashboard de la homepage
 * (premium-dashboard-mockup.tsx) — logique pure, testée.
 *
 * QA 2026-09-16, m-11 : un écouteur global sur `window` faisait changer
 * d'écran l'aperçu quand on utilisait ← / → dans le <select> du calculateur
 * ROI. Désormais l'écouteur est posé sur l'aperçu lui-même (il ne réagit que
 * s'il a le focus) et ce garde écarte en plus :
 *   - les frappes destinées à un champ éditable (input, select, textarea,
 *     contenteditable) ;
 *   - les combinaisons avec Ctrl, Alt ou Meta (raccourcis navigateur/OS) ;
 *   - Maj + flèche (extension de sélection) — Maj reste permis pour les
 *     chiffres, indispensable sur un clavier AZERTY ;
 *   - la composition IME et les événements déjà traités.
 */

export interface ShortcutKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
}

export type MockupShortcut =
  | { type: "reset" }
  | { type: "step"; direction: 1 | -1 }
  | { type: "jump"; index: number };

const EDITABLE_SELECTOR = 'input, select, textarea, [contenteditable]:not([contenteditable="false"])';

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const el = target as HTMLElement;
  return el.isContentEditable === true || el.closest(EDITABLE_SELECTOR) !== null;
}

/** Action à exécuter pour cette frappe, ou `null` si l'aperçu doit l'ignorer. */
export function resolveMockupShortcut(event: ShortcutKeyEvent, hotspotCount: number): MockupShortcut | null {
  if (event.defaultPrevented || event.isComposing) return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (isEditableTarget(event.target)) return null;

  switch (event.key) {
    case "Escape":
      return { type: "reset" };
    case "ArrowRight":
    case "ArrowLeft":
      if (event.shiftKey) return null;
      return { type: "step", direction: event.key === "ArrowRight" ? 1 : -1 };
    default: {
      if (!/^[1-9]$/.test(event.key)) return null;
      const index = Number(event.key) - 1;
      return index < hotspotCount ? { type: "jump", index } : null;
    }
  }
}

/** Index suivant/précédent, en boucle ; depuis « aucun », → vise le premier et ← le dernier. */
export function nextHotspotIndex(current: number, direction: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return direction > 0 ? 0 : count - 1;
  return (current + direction + count) % count;
}
