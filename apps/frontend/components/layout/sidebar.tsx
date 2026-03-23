"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Globe,
  BarChart2,
  AlertTriangle,
  TrendingUp,
  Layers,
  Target,
  Wallet,
  Menu,
  X,
  Building2,
} from "lucide-react";

// ─── Navigation map ───────────────────────────────────────────────────────────

const MODULES = [
  { href: "/modules/gouvernance-cyber",  label: "Gouvernance Cyber",  icon: Shield,        num: "01" },
  { href: "/modules/pilier2-globe",      label: "Pilier 2 GloBE",     icon: Globe,         num: "02" },
  { href: "/modules/analyse-entreprise", label: "Analyse Entreprise", icon: BarChart2,     num: "03" },
  { href: "/modules/credit-risk",        label: "Crédit Risk",        icon: AlertTriangle, num: "04" },
  { href: "/modules/ma-simulator",       label: "M&A Simulator",      icon: TrendingUp,    num: "05" },
  { href: "/modules/ifrs-consolidation", label: "IFRS Consolidation", icon: Layers,        num: "06" },
  { href: "/modules/defense-drones",     label: "Défense & Drones",   icon: Target,        num: "07" },
  { href: "/modules/patrimoine-pl",      label: "Patrimoine PL",      icon: Wallet,        num: "08" },
] as const;

// ─── NavLink ─────────────────────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon: Icon,
  num,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  num?: string;
  pathname: string;
  onClick?: () => void;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${
        active
          ? "bg-teal-500/10 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {/* Active left bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-r" />
      )}

      <Icon
        className={`w-4 h-4 flex-shrink-0 transition-colors ${
          active
            ? "text-teal-400"
            : "text-zinc-500 group-hover:text-zinc-300"
        }`}
      />

      <span className="flex-1 truncate font-medium">{label}</span>

      {num && (
        <span
          className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${
            active ? "text-teal-500/60" : "text-zinc-600"
          }`}
        >
          {num}
        </span>
      )}
    </Link>
  );
}

// ─── SidebarContent (shared between desktop and mobile overlay) ───────────────

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.07]">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-teal-400 font-bold text-[11px] tracking-tight">FP</span>
          </div>
          <span className="font-bold text-sm text-white tracking-tight truncate">
            FinancePlatform
          </span>
        </Link>

        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
            aria-label="Fermer la navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {/* Dashboard */}
        <NavLink
          href="/dashboard"
          label="Dashboard"
          icon={LayoutDashboard}
          pathname={pathname}
          onClick={onClose}
        />

        {/* Modules section */}
        <div className="pt-4 pb-1.5 px-2">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
            Modules
          </p>
        </div>

        {MODULES.map((m) => (
          <NavLink
            key={m.href}
            href={m.href}
            label={m.label}
            icon={m.icon}
            num={m.num}
            pathname={pathname}
            onClick={onClose}
          />
        ))}

        {/* Architecture overview */}
        <div className="pt-4 pb-1.5 px-2">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
            Vue d&apos;ensemble
          </p>
        </div>
        <NavLink
          href="/architecture"
          label="Architecture"
          icon={Building2}
          pathname={pathname}
          onClick={onClose}
        />
      </nav>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-white/[0.07]">
        <p className="text-[10px] text-zinc-600 tabular-nums">
          v1.0 &nbsp;·&nbsp; 8 modules
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar (exported) ───────────────────────────────────────────────────────

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-zinc-900/95 backdrop-blur-md border-b border-white/[0.07] flex items-center gap-3 px-4">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Ouvrir la navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <span className="text-teal-400 font-bold text-[10px]">FP</span>
          </div>
          <span className="font-bold text-sm text-white">FinancePlatform</span>
        </Link>
      </header>

      {/* ── Mobile backdrop ───────────────────────────────────────────────── */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar panel ─────────────────────────────────────────────────── */}
      {/*   Mobile: fixed overlay, slides in from left                        */}
      {/*   Desktop (lg+): static column in the flex layout                   */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50
          w-64 bg-zinc-900 border-r border-white/[0.07]
          flex flex-col
          transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:static lg:translate-x-0 lg:flex lg:h-auto lg:z-auto
        `}
      >
        <SidebarContent onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}
