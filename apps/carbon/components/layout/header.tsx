"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Search, RefreshCw, Download, X, ChevronRight, Sun, Moon } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const NOTIFICATIONS = [
  { id: 1, type: "alert", text: "Seuil Scope 3 dépassé de 12%", time: "il y a 5 min", color: "text-orange-400" },
  { id: 2, type: "success", text: "Import ERP SAP terminé — 1 842 lignes", time: "il y a 23 min", color: "text-green-400" },
  { id: 3, type: "info", text: "Rapport CSRD Q2 disponible", time: "il y a 2h", color: "text-blue-400" },
];

const PERIODS = ["Ce mois", "Ce trimestre", "Cette année"] as const;

export function Header({ title, subtitle }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [period, setPeriod] = useState<typeof PERIODS[number]>("Ce mois");
  const [refreshing, setRefreshing] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    const next = isDark ? "light" : "dark";
    html.setAttribute("data-theme", next);
    setIsDark(!isDark);
  }, [isDark]);

  // Close notif dropdown on ESC
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [notifOpen]);

  const iconBtnClass =
    "w-9 h-9 rounded-lg border border-[var(--color-border)] flex items-center justify-center " +
    "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] " +
    "hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60";

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]" role="banner">
      {/* Main row */}
      <div className="h-16 flex items-center justify-between px-6 gap-4">
        {/* Title + freshness */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg text-[var(--color-foreground)] leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-[var(--color-foreground-muted)]">{subtitle}</p>}
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--color-foreground-subtle)] whitespace-nowrap" aria-live="polite">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" aria-hidden="true" />
            <span>Données au {new Date().toLocaleDateString("fr-FR")} · il y a 12 min</span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0" role="toolbar" aria-label="Actions du tableau de bord">
          {/* Search */}
          <button
            aria-label="Rechercher (Cmd+K)"
            className={
              "flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--color-border)] " +
              "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] " +
              "hover:bg-[var(--color-surface-raised)] transition-colors text-xs font-medium cursor-pointer " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
            }
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden md:block">Rechercher</span>
            <kbd className="hidden md:block bg-[var(--color-background)] border border-[var(--color-border)] rounded px-1 text-[10px] text-[var(--color-foreground-subtle)]" aria-hidden="true">⌘K</kbd>
          </button>

          {/* Dark/Light toggle */}
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
            aria-pressed={!isDark}
            className={iconBtnClass}
          >
            {isDark
              ? <Sun className="w-4 h-4" aria-hidden="true" />
              : <Moon className="w-4 h-4" aria-hidden="true" />
            }
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            aria-label="Actualiser les données"
            aria-busy={refreshing}
            className={iconBtnClass}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>

          {/* Export */}
          <button
            aria-label="Exporter le tableau de bord"
            className={iconBtnClass}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label={`Notifications — ${NOTIFICATIONS.length} non lues`}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              className={`relative ${iconBtnClass}`}
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-carbon-emerald text-[10px] text-white font-bold flex items-center justify-center"
                aria-hidden="true"
              >
                {NOTIFICATIONS.length}
              </span>
            </button>

            {/* Dropdown notifications */}
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 top-11 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl z-40"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <span className="text-sm font-semibold text-[var(--color-foreground)]">Notifications</span>
                    <button
                      onClick={() => setNotifOpen(false)}
                      aria-label="Fermer les notifications"
                      className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60 rounded"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="divide-y divide-[var(--color-border)]" role="list">
                    {NOTIFICATIONS.map((n) => (
                      <li key={n.id}>
                        <button className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:bg-[var(--color-surface-raised)]">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.color.replace("text-", "bg-")}`} aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-foreground)]">{n.text}</p>
                            <p className="text-xs text-[var(--color-foreground-muted)]">{n.time}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--color-foreground-subtle)] flex-shrink-0 mt-0.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="px-4 py-2.5 border-t border-[var(--color-border)]">
                    <button className="text-xs text-carbon-emerald-light hover:underline cursor-pointer w-full text-center focus-visible:outline-none focus-visible:underline">
                      Voir toutes les notifications
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Avatar */}
          <button
            aria-label="Paramètres du compte"
            className="w-9 h-9 rounded-full bg-carbon-emerald/20 flex items-center justify-center text-carbon-emerald-light font-bold text-xs cursor-pointer hover:ring-2 hover:ring-carbon-emerald/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
          >
            ML
          </button>
        </div>
      </div>

      {/* Period selector row */}
      <div className="px-6 pb-3 flex items-center gap-3">
        <span className="text-xs text-[var(--color-foreground-muted)]" id="period-label">Période :</span>
        <div
          role="radiogroup"
          aria-labelledby="period-label"
          className="flex items-center gap-1 bg-[var(--color-background)] rounded-lg p-0.5 border border-[var(--color-border)]"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60 ${
                period === p
                  ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
                  : "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {/* Échéances */}
        <div className="hidden md:flex items-center gap-2 ml-auto text-xs text-[var(--color-foreground-muted)]" aria-live="polite">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" aria-hidden="true" />
          <span>Rapport E1 dans <strong className="text-orange-400">15 jours</strong></span>
          <span className="text-[var(--color-border)]" aria-hidden="true">·</span>
          <span>CSRD filing dans <strong className="text-red-400">45 jours</strong></span>
        </div>
      </div>
    </header>
  );
}
