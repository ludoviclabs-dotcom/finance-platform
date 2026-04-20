import Link from "next/link";

import { FOOTER_LINKS, PUBLIC_STATUS_LABELS } from "@/lib/public-catalog";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-neural-midnight text-gray-400">
      <div className="absolute left-1/2 -top-32 h-64 w-[800px] -translate-x-1/2 rounded-full bg-neural-violet/5 blur-[120px]" />

      <div className="relative mx-auto max-w-[1440px] px-8 py-16 md:px-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-white/80">
                {category}
              </h3>
              <ul className="mt-5 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center justify-between gap-3 text-sm text-gray-500 transition-colors hover:text-white"
                    >
                      <span>{link.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-gray-600">
                        {PUBLIC_STATUS_LABELS[link.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neural-violet shadow-lg shadow-neural-violet/15">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-white">
              NEURAL AI Consulting
            </span>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} NEURAL AI Consulting SAS. Tous droits reserves.
          </p>
        </div>
      </div>
    </footer>
  );
}
