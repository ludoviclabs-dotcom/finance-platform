"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Target, BookOpen, Bot,
  FileBarChart, CreditCard, Leaf, LogOut,
  ChevronLeft, ChevronRight, X, Scale,
  Users, Package, Banknote, Sparkles, ShieldCheck,
} from "lucide-react";
import type { Page } from "@/lib/types";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout?: () => void;
}

const navItems: {
  id: Page;
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: { text: string; color: string };
}[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: "scopes", href: "/scopes", label: "Scopes 1-2-3", icon: <Target className="w-5 h-5" /> },
  { id: "vsme", href: "/vsme", label: "VSME", icon: <Sparkles className="w-5 h-5" />, badge: { text: "Nouveau", color: "bg-carbon-emerald/15 text-carbon-emerald-light" } },
  {
    id: "esrs", href: "/esrs", label: "ESRS / CSRD", icon: <BookOpen className="w-5 h-5" />,
    badge: { text: "3 alertes", color: "bg-red-500/15 text-red-400" },
  },
  { id: "materialite", href: "/materialite", label: "Matérialité", icon: <Scale className="w-5 h-5" /> },
  { id: "qc", href: "/qc", label: "Contrôles qualité", icon: <ShieldCheck className="w-5 h-5" /> },
  { id: "social", href: "/social", label: "Social", icon: <Users className="w-5 h-5" /> },
  { id: "dpp", href: "/dpp", label: "DPP produits", icon: <Package className="w-5 h-5" /> },
  { id: "finance", href: "/finance", label: "Finance / DPP", icon: <Banknote className="w-5 h-5" /> },
  {
    id: "copilot", href: "/copilot", label: "Copilote IA", icon: <Bot className="w-5 h-5" />,
    badge: { text: "IA", color: "bg-carbon-emerald/15 text-carbon-emerald-light" },
  },
  {
    id: "reports", href: "/reports", label: "Rapports", icon: <FileBarChart className="w-5 h-5" />,
    badge: { text: "1 brouillon", color: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]" },
  },
  { id: "pricing", href: "/pricing", label: "Offres", icon: <CreditCard className="w-5 h-5" /> },
];

const ESG_SCORE = 62;

export function Sidebar({ collapsed, onToggle, onLogout }: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const pathname = usePathname();

  const circumference = 2 * Math.PI * 16;
  const dashOffset = circumference - (ESG_SCORE / 100) * circumference;

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-screen border-r border-[var(--color-border)] bg-[var(--color-surface)] z-40 flex flex-col"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-gradient-esg flex items-center justify-center flex-shrink-0">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-display font-bold text-lg text-[var(--color-foreground)]">
              CarbonCo
            </motion.span>
          )}
        </div>

        {/* User card */}
        <div className={`border-b border-[var(--color-border)] ${collapsed ? "px-2 py-3" : "px-4 py-3"}`}>
          {collapsed ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-carbon-emerald/20 flex items-center justify-center">
                <span className="text-xs font-bold text-carbon-emerald-light">ML</span>
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-carbon-emerald/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-carbon-emerald-light">ML</span>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-surface)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">Marie Leclerc</p>
                <p className="text-xs text-[var(--color-foreground-muted)] truncate">Resp. RSE · Acme Corp</p>
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-carbon-emerald/15 text-carbon-emerald-light whitespace-nowrap">
                Business
              </span>
            </motion.div>
          )}
        </div>

        {/* Score ESG */}
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mx-3 mt-3 mb-1 p-3 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">Score ESG</span>
              <span className="text-sm font-extrabold text-carbon-emerald-light">{ESG_SCORE}/100</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-12 h-12 flex-shrink-0 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-border)" strokeWidth="4" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="#059669" strokeWidth="4"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#059669] to-[#0891b2]"
                    style={{ width: `${ESG_SCORE}%`, transition: "width 1s ease" }} />
                </div>
                <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-1">Objectif : 80 · +18 pts</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.id}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-carbon-emerald/15 text-carbon-emerald-light"
                    : "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.badge ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.badge.color}`}>
                        {item.badge.text}
                      </span>
                    ) : active ? (
                      <motion.div layoutId="sidebar-active"
                        className="w-1.5 h-1.5 rounded-full bg-carbon-emerald" />
                    ) : null}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute left-8 top-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 pb-4 space-y-0.5 border-t border-[var(--color-border)] pt-3">
          <button onClick={onToggle} title={collapsed ? "Développer" : "Réduire"}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span className="text-xs">Réduire</span>}
          </button>
          {onLogout && (
            <button onClick={() => setShowLogoutConfirm(true)} title="Déconnexion"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-foreground-muted)] hover:text-red-400 hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
              <LogOut className="w-5 h-5" />
              {!collapsed && <span className="text-xs">Déconnexion</span>}
            </button>
          )}
        </div>
      </motion.aside>

      {/* Modale logout */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", damping: 25 }}
              className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 w-80 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-[var(--color-foreground)]">Déconnexion</h3>
                  <p className="text-sm text-[var(--color-foreground-muted)] mt-1">Votre session sera fermée.</p>
                </div>
                <button onClick={() => setShowLogoutConfirm(false)} className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout?.();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 transition-colors cursor-pointer">
                  Se déconnecter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
