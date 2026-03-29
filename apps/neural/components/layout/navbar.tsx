"use client";

import { useState, useEffect } from "react";
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 z-50 w-full transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(10, 22, 40, 0.85)" : "rgba(10, 22, 40, 0.60)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.15)" : "none",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8 md:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neural-violet shadow-lg shadow-neural-violet/20">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            NEURAL
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-0.5 lg:flex">
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
                {item.children && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
              </Link>
              {item.children && openDropdown === item.label && (
                <div className="absolute left-0 top-full pt-2">
                  <div className="min-w-[220px] rounded-xl border border-white/10 bg-neural-midnight/95 p-2 shadow-xl backdrop-blur-xl">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-4 py-2.5 text-sm text-gray-300 transition-all hover:bg-white/5 hover:text-white hover:pl-5"
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
            className="rounded-xl bg-neural-violet px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-xl hover:shadow-neural-violet/30"
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
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out lg:hidden"
        style={{
          maxHeight: mobileOpen ? "500px" : "0px",
          opacity: mobileOpen ? 1 : 0,
        }}
      >
        <div className="border-t border-white/10 bg-neural-midnight/95 backdrop-blur-xl">
          <div className="space-y-1 px-6 py-4">
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
              className="mt-4 block rounded-xl bg-neural-violet px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-neural-violet/25"
            >
              Audit gratuit
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
