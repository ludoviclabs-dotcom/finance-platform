"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Search, RefreshCw, Download, X, ChevronRight, LogOut, Menu } from "lucide-react";

import { AuditModeToggle } from "@/components/ui/audit-mode-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { fetchNotifications, type AlertNotification } from "@/lib/api";
import { useBegesDeadline } from "@/lib/hooks/use-beges-deadline";
import { formatRelativeTimeFr } from "@/lib/relative-time";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  userEmail?: string;
  demoHint?: string;
  onMobileMenuClick?: () => void;
}

const PERIODS = ["Ce mois", "Ce trimestre", "Cette année"] as const;
type Period = typeof PERIODS[number];

/** Nombre de notifications listées dans le menu déroulant. */
const NOTIFICATION_PREVIEW = 5;

type NotificationsState =
  | { status: "loading" }
  | { status: "ready"; unread: number; items: AlertNotification[] }
  | { status: "error" };

/**
 * Centre de notifications de l'en-tête : notifications réelles de
 * l'organisation (GET /alerts/notifications), plus aucune notification de
 * démonstration affichée à un compte réel.
 */
function useHeaderNotifications(enabled: boolean) {
  const [state, setState] = useState<NotificationsState>({ status: "loading" });

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetchNotifications(false, signal);
      if (signal?.aborted) return;
      setState({
        status: "ready",
        unread: res.unread,
        items: res.notifications.slice(0, NOTIFICATION_PREVIEW),
      });
    } catch {
      if (!signal?.aborted) setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  return { state, reload: load };
}

export function Header({ title, subtitle, onLogout, userEmail, demoHint, onMobileMenuClick }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("Ce mois");
  const [refreshing, setRefreshing] = useState(false);
  // En-tête authentifié (onLogout fourni) : données de l'organisation.
  const signedIn = Boolean(onLogout);
  const { state: notifications, reload: reloadNotifications } = useHeaderNotifications(signedIn);
  const begesDeadline = useBegesDeadline(signedIn);

  const unread = notifications.status === "ready" ? notifications.unread : 0;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const toggleNotifications = () => {
    // Rafraîchit la liste à l'ouverture (nouvelles alertes depuis le montage).
    if (!notifOpen && signedIn) void reloadNotifications();
    setNotifOpen(!notifOpen);
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
                  {subtitle} · Consulté le{" "}
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
              onClick={toggleNotifications}
              aria-label={
                unread > 0 ? `Notifications — ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"
              }
              aria-expanded={notifOpen}
              aria-haspopup="true"
              className="cc-icon-btn"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unread > 0 && (
                <span className="cc-notif-c" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
              )}
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
                  {notifications.status === "loading" && (
                    <p className="cc-dropdown-row cc-dropdown-time">Chargement…</p>
                  )}
                  {notifications.status === "error" && (
                    <p className="cc-dropdown-row cc-dropdown-time">
                      Notifications indisponibles pour le moment.
                    </p>
                  )}
                  {notifications.status === "ready" && notifications.items.length === 0 && (
                    <p className="cc-dropdown-row cc-dropdown-time">Aucune notification.</p>
                  )}
                  {notifications.status === "ready" &&
                    notifications.items.map((n) => (
                      <Link
                        key={n.id}
                        href="/alerts"
                        onClick={() => setNotifOpen(false)}
                        className="cc-dropdown-row"
                      >
                        <span className={`cc-dropdown-pip ${n.read_at ? "info" : "alert"}`} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="cc-dropdown-txt">{n.title}</p>
                          <p className="cc-dropdown-time">
                            {formatRelativeTimeFr(n.fired_at) ?? ""}
                            {n.read_at ? "" : " · non lue"}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--cc-subtle)] flex-shrink-0 mt-1" aria-hidden="true" />
                      </Link>
                    ))}
                  <Link
                    href="/alerts"
                    onClick={() => setNotifOpen(false)}
                    className="cc-dropdown-foot w-full block text-center"
                  >
                    Voir toutes les notifications
                  </Link>
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

      {/* Ligne secondaire : période + échéance réelle (BEGES) si connue */}
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
        {begesDeadline && (
          <div className="cc-dl-chips hidden md:flex ml-auto" aria-live="polite">
            <Link
              href="/beges"
              className={`cc-dl-chip ${begesDeadline.level}`}
              title={begesDeadline.title}
              aria-label={begesDeadline.title}
            >
              <span className="cc-dl-dot" aria-hidden="true" />
              <span>{begesDeadline.chipText}</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
