"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { NAVIGATION, PUBLIC_STATUS_LABELS } from "@/lib/public-catalog";

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
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neural-violet shadow-lg shadow-neural-violet/20">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">NEURAL</span>
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {NAVIGATION.map((item, index) => {
            const isLast = index === NAVIGATION.length - 1;
            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => "children" in item && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <Link
                  href={item.href}
                  className={
                    isLast
                      ? "ml-2 inline-flex items-center gap-1 rounded-xl bg-neural-violet px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-xl hover:shadow-neural-violet/30"
                      : "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
                  }
                >
                  {item.label}
                  {"children" in item ? <ChevronDown className="h-3.5 w-3.5 opacity-50" /> : null}
                </Link>
                {"children" in item && openDropdown === item.label ? (
                  <div className="absolute left-0 top-full pt-2">
                    <div className="min-w-[280px] rounded-xl border border-white/10 bg-neural-midnight/95 p-2 shadow-xl backdrop-blur-xl">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm text-gray-300 transition-all hover:bg-white/5 hover:pl-5 hover:text-white"
                        >
                          <span>{child.label}</span>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                            {PUBLIC_STATUS_LABELS[child.status]}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-gray-300 hover:text-white lg:hidden"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out lg:hidden"
        style={{
          maxHeight: mobileOpen ? "640px" : "0px",
          opacity: mobileOpen ? 1 : 0,
        }}
      >
        <div className="border-t border-white/10 bg-neural-midnight/95 backdrop-blur-xl">
          <div className="space-y-1 px-6 py-4">
            {NAVIGATION.map((item, index) => {
              const isLast = index === NAVIGATION.length - 1;
              return (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={
                      isLast
                        ? "mt-4 block rounded-xl bg-neural-violet px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-neural-violet/25"
                        : "block rounded-lg px-3 py-2 text-base font-medium text-gray-300 hover:text-white"
                    }
                  >
                    {item.label}
                  </Link>
                  {"children" in item ? (
                    <div className="ml-4 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                        >
                          <span>{child.label}</span>
                          <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                            {PUBLIC_STATUS_LABELS[child.status]}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
