"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, LogOut, ChevronLeft, ChevronRight, X } from "lucide-react";
import { NAV_GROUPS, isNavItemActive } from "@/lib/nav-config";
import { useAuthState } from "@/lib/hooks/auth-context";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  analyst: "Analyste",
  viewer: "Lecteur",
};

export function Sidebar({
  collapsed,
  onToggle,
  onLogout,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const pathname = usePathname();

  // Carte utilisateur : le compte réellement connecté (plus de persona fictif
  // « Marie Leclerc · Exemplia Industrie » affiché à tous les utilisateurs).
  const auth = useAuthState();
  const userEmail = auth.status === "authenticated" ? auth.email : null;
  const userLabel = userEmail ?? "Compte CarbonCo";
  const roleLabel =
    auth.status === "authenticated" ? ROLE_LABELS[auth.role] ?? auth.role : "Session";
  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : "?";

  // Sur mobile on ignore le collapsed (toujours affiché en pleine largeur drawer)
  const effectiveCollapsed = collapsed;

  return (
    <>
      {/* Backdrop mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: effectiveCollapsed ? 72 : 256 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed left-0 top-0 h-screen border-r border-[var(--color-border)] bg-[var(--color-surface)] z-50 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
        aria-label="Navigation principale"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-lg bg-gradient-esg flex items-center justify-center flex-shrink-0">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="font-display font-bold text-lg text-[var(--color-foreground)] flex-1 flex items-center gap-2 min-w-0">
              CarbonCo
              <span className="cc-logo-tag">cockpit</span>
            </motion.span>
          )}
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
              aria-label="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User card */}
        <div className={`border-b border-[var(--color-border)] ${collapsed ? "px-2 py-3" : "px-4 py-3"}`}>
          {collapsed ? (
            <div className="flex justify-center" title={userLabel}>
              <div className="w-8 h-8 rounded-full bg-carbon-emerald/20 flex items-center justify-center">
                <span className="text-xs font-bold text-carbon-emerald-light">{initials}</span>
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-carbon-emerald/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-carbon-emerald-light">{initials}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-foreground)] truncate" title={userLabel}>
                  {userLabel}
                </p>
                <p className="text-xs text-[var(--color-foreground-muted)] truncate">{roleLabel}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Score ESG : aucune valeur codée en dur — le score réel (dérivé de la
            matrice de matérialité) est consultable sur le tableau de bord et /esrs. */}
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mx-3 mt-3 mb-1 p-3 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">Score ESG</span>
              <span className="text-sm font-extrabold text-[var(--color-foreground-muted)]">—/100</span>
            </div>
            <Link
              href="/esrs"
              onClick={() => onMobileClose?.()}
              className="text-[10px] text-[var(--color-foreground-subtle)] underline hover:text-[var(--color-foreground)]"
            >
              Voir la conformité ESRS
            </Link>
          </motion.div>
        )}

        {/* Nav — groupée par catégorie (Pilotage / Conformité / Données / IA & Audit) */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {NAV_GROUPS.map((grp) => (
            <div
              key={grp.group}
              className={`cc-nav-grp ${grp.group === "Démonstration" ? "cc-nav-grp--demo" : ""}`}
            >
              {!collapsed && <div className="cc-nav-grp-t">{grp.group}</div>}
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href, item.exact);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => onMobileClose?.()}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
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
              </div>
            </div>
          ))}
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
