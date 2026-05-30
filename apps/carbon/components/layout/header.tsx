"use client";

import { useEffect, useState } from "react";
import { Bell, Search, RefreshCw, Download, X, ChevronRight, LogOut, Menu } from "lucide-react";

import { AuditModeToggle } from "@/components/ui/audit-mode-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  userEmail?: string;
  demoHint?: string;
  onMobileMenuClick?: () => void;
}

const NOTIFICATIONS = [
  { id: 1, type: "alert" as const,   text: "Seuil Scope 3 dépassé de 12 %",         time: "il y a 5 min" },
  { id: 2, type: "ok" as const,      text: "Import ERP SAP terminé — 1 842 lignes", time: "il y a 23 min" },
  { id: 3, type: "info" as const,    text: "Rapport CSRD Q2 disponible",            time: "il y a 2 h" },
];

const PERIODS = ["Ce mois", "Ce trimestre", "Cette année"] as const;
type Period = typeof PERIODS[number];

export function Header({ title, subtitle, onLogout, userEmail, demoHint, onMobileMenuClick }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("Ce mois");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [notifOpen]);

  return (
    <header role="banner">
      {/* Ligne principale : titre + actions */}
      <div className="cc-top">
        {onMobileMenuClick && (
          <button
            type="button"
            onClick={onMobileMenuClick}
            className="lg:hidden cc-icon-btn"
            aria-label="Ouvrir le menu de navigation"
          >
            <Menu className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        <div className="cc-top-l min-w-0">
          <div className="min-w-0">
            <h1 className="cc-top-title truncate">{title}</h1>
            {subtitle && (
              <div className="cc-top-fresh">
                <span className="cc-live-dot" aria-hidden="true" />
                <span className="truncate">
                  {subtitle} · Données au{" "}
                  <strong>{new Date().toLocaleDateString("fr-FR")}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="cc-top-r" role="toolbar" aria-label="Actions du tableau de bord">
          {/* Search (sm+) */}
          <button
            type="button"
            aria-label="Rechercher (Cmd+K)"
            className="cc-search-btn hidden sm:inline-flex"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Rechercher</span>
            <kbd className="cc-kbd hidden md:inline" aria-hidden="true">⌘K</kbd>
          </button>

          {/* Theme */}
          <ThemeToggle />

          {/* Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Actualiser les données"
            aria-busy={refreshing}
            className={`cc-icon-btn hidden md:grid ${refreshing ? "spin" : ""}`}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Export */}
          <button
            type="button"
            aria-label="Exporter le tableau de bord"
            className="cc-icon-btn hidden md:grid"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={`Notifications — ${NOTIFICATIONS.length} non lues`}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              className="cc-icon-btn"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              <span className="cc-notif-c" aria-hidden="true">{NOTIFICATIONS.length}</span>
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                <div role="dialog" aria-label="Notifications" className="cc-dropdown">
                  <div className="cc-dropdown-head">
                    <span className="cc-dropdown-title">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      aria-label="Fermer les notifications"
                      className="cc-icon-btn"
                      style={{ width: 28, height: 28 }}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  {NOTIFICATIONS.map((n) => (
                    <button key={n.id} type="button" className="cc-dropdown-row">
                      <span className={`cc-dropdown-pip ${n.type}`} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="cc-dropdown-txt">{n.text}</p>
                        <p className="cc-dropdown-time">{n.time}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--cc-subtle)] flex-shrink-0 mt-1" aria-hidden="true" />
                    </button>
                  ))}
                  <button type="button" className="cc-dropdown-foot w-full">
                    Voir toutes les notifications
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Audit mode */}
          <AuditModeToggle />

          {/* Avatar + logout */}
          {onLogout ? (
            <div className="flex items-center gap-1.5">
              <div
                title={userEmail}
                className="cc-avatar-pill"
                aria-label={`Connecté en tant que ${userEmail ?? "utilisateur"}`}
              >
                {userEmail ? userEmail[0].toUpperCase() : "U"}
              </div>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="cc-icon-btn"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {demoHint && (
                <span className="hidden lg:block text-[10px] text-[var(--cc-subtle)] font-mono bg-[var(--cc-surface-2)] border border-[var(--cc-border)] rounded px-2 py-1">
                  démo : {demoHint}
                </span>
              )}
              <div className="cc-avatar-pill">?</div>
            </div>
          )}
        </div>
      </div>

      {/* Ligne secondaire : période + échéances */}
      <div className="cc-subtop hidden sm:flex">
        <span className="cc-subtop-l" id="period-label">Période</span>
        <div
          role="radiogroup"
          aria-labelledby="period-label"
          className="cc-seg"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`cc-seg-b ${period === p ? "is-on" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="cc-dl-chips hidden md:flex ml-auto" aria-live="polite">
          <div className="cc-dl-chip warn" title="Rapport ESRS E1">
            <span className="cc-dl-dot" aria-hidden="true" />
            <span>Rapport E1 · 15j</span>
          </div>
          <div className="cc-dl-chip alert" title="Dépôt CSRD (iXBRL)">
            <span className="cc-dl-dot" aria-hidden="true" />
            <span>CSRD · 45j</span>
          </div>
        </div>
      </div>
    </header>
  );
}
