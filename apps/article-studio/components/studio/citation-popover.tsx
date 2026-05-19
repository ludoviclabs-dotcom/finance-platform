"use client";

import { useEffect, useRef } from "react";
import type { Citation } from "./article-editor";

interface Props {
  citation: Citation | null;
  anchor: { x: number; y: number };
  onClose: () => void;
}

export function CitationPopover({ citation, anchor, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Outside click + Escape closes the popover. We attach listeners at the
  // document level so anything outside the popover element dismisses it.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!citation) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-label="Citation manquante"
        className="fixed z-50 max-w-sm rounded border border-white/10 bg-black/95 px-3 py-2 text-xs text-[color:var(--muted)] shadow-lg"
        style={{ top: anchor.y, left: anchor.x }}
      >
        Citation inconnue — regénère l'article pour rafraîchir le registre.
      </div>
    );
  }

  const refLine = [
    citation.heading,
    citation.pageNumber ? `p. ${citation.pageNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Source de la citation ${citation.id}`}
      className="fixed z-50 max-w-md rounded border border-white/10 bg-black/95 p-3 text-sm shadow-xl"
      style={{ top: anchor.y, left: anchor.x }}
    >
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs text-emerald-300">{citation.id}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-xs text-[color:var(--muted)] hover:text-white"
        >
          ✕
        </button>
      </header>
      <p className="font-medium">{citation.sourceTitle || citation.sourceFilename}</p>
      {citation.sourceAuthor && (
        <p className="text-xs text-[color:var(--muted)]">{citation.sourceAuthor}</p>
      )}
      {refLine && <p className="mt-0.5 text-xs text-[color:var(--muted)]">{refLine}</p>}
      {citation.quote && (
        <blockquote className="mt-2 border-l-2 border-emerald-400/40 pl-3 text-xs italic text-[color:var(--muted)]">
          {citation.quote.length > 320
            ? `${citation.quote.slice(0, 320).trimEnd()}…`
            : citation.quote}
        </blockquote>
      )}
    </div>
  );
}
