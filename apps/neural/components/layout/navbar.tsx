"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";

const navigation = [
  {
    label: "Solutions",
    href: "/solutions",
    children: [
      { label: "Systèmes d'Information", href: "/solutions/si" },
      { label: "Ressources Humaines", href: "/solutions/rh" },
      { label: "Marketing", href: "/solutions/marketing" },
      { label: "Communication", href: "/solutions/communication" },
      { label: "Comptabilité", href: "/solutions/comptabilite" },
      { label: "Finance", href: "/solutions/finance" },
      { label: "Supply Chain", href: "/solutions/supply-chain" },
    ],
  },
  {
    label: "Secteurs",
    href: "/secteurs",
    children: [
      { label: "Transport", href: "/secteurs/transport" },
      { label: "Luxe", href: "/secteurs/luxe" },
      { label: "Aéronautique", href: "/secteurs/aeronautique" },
      { label: "SaaS", href: "/secteurs/saas" },
      { label: "Banque", href: "/secteurs/banque" },
      { label: "Assurance", href: "/secteurs/assurance" },
    ],
  },
  { label: "Forfaits", href: "/forfaits" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Research", href: "/research" },
  { label: "Ressources", href: "/resources" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-neural-midnight/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neural-violet">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="font-display text-lg font-bold text-white">
            NEURAL
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 lg:flex">
          {navigation.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() =>
                item.children && setOpenDropdown(item.label)
              }
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
              >
                {item.label}
                {item.children && <ChevronDown className="h-3.5 w-3.5" />}
              </Link>
              {item.children && openDropdown === item.label && (
                <div className="absolute left-0 top-full pt-2">
                  <div className="rounded-xl border border-white/10 bg-neural-midnight/95 p-2 shadow-lg backdrop-blur-xl">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/contact"
            className="rounded-lg bg-neural-violet px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neural-violet-dark"
          >
            Audit gratuit
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-gray-300 hover:text-white lg:hidden"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-neural-midnight/95 backdrop-blur-xl lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {navigation.map((item) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-base font-medium text-gray-300 hover:text-white"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="ml-4 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="mt-4 block rounded-lg bg-neural-violet px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Audit gratuit
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
