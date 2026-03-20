"use client";

import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";

const CATEGORIES = ["Comptabilité", "Fiscalité", "Finance", "RH", "Autres"] as const;

function DropdownItem({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const hide = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors rounded-md hover:bg-white/5"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-40 rounded-lg border border-border bg-surface shadow-md overflow-hidden z-50">
          <a
            href="#"
            className="block px-4 py-2.5 text-sm text-foreground-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            Simulateur
          </a>
          <div className="border-t border-border" />
          <a
            href="#"
            className="block px-4 py-2.5 text-sm text-foreground-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            Actualités
          </a>
        </div>
      )}
    </div>
  );
}

export function NavDropdowns() {
  return (
    <nav className="hidden md:flex items-center gap-1">
      {CATEGORIES.map((label) => (
        <DropdownItem key={label} label={label} />
      ))}
    </nav>
  );
}
