/**
 * nav-config.tsx — source unique de la navigation du cockpit (groupes, entrées,
 * icônes, badges) + logique d'état actif.
 *
 * Extrait de `components/layout/sidebar.tsx` pour être testable sans monter le
 * composant (framer-motion / next/navigation) : `NAV_GROUPS` et
 * `isNavItemActive` sont des données/fonctions pures. La Sidebar les consomme et
 * ne garde que le rendu.
 */

import {
  LayoutDashboard, Target, Scale, Boxes, BookOpen, Sparkles, ListChecks,
  ClipboardCheck, FileBarChart, Factory, Upload, Receipt, FolderInput, Database,
  ShieldCheck, FileText, TrendingDown, CalendarClock, GitCompare, Building2, Bot,
  Inbox, ClipboardList, History, Bell, Settings, CreditCard, FlaskConical,
} from "lucide-react";
import type { Page } from "@/lib/types";

export type NavItem = {
  id: Page;
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: { text: string; color: string };
};

export type NavGroup = { group: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Pilotage",
    items: [
      { id: "dashboard",   href: "/dashboard",   label: "Cockpit",       icon: <LayoutDashboard className="w-5 h-5" /> },
      { id: "scopes",      href: "/scopes",      label: "Scopes 1-2-3",  icon: <Target className="w-5 h-5" /> },
      { id: "materialite", href: "/materialite", label: "Matérialité",   icon: <Scale className="w-5 h-5" /> },
      {
        id: "resources", href: "/resources", label: "Ressources stratégiques", icon: <Boxes className="w-5 h-5" />,
        badge: { text: "BETA", color: "bg-amber-500/15 text-amber-600" },
      },
    ],
  },
  {
    group: "Conformité CSRD",
    items: [
      {
        id: "esrs", href: "/esrs", label: "ESRS / CSRD", icon: <BookOpen className="w-5 h-5" />,
        badge: { text: "3 alertes", color: "bg-red-500/15 text-red-400" },
      },
      {
        id: "vsme", href: "/vsme", label: "VSME", icon: <Sparkles className="w-5 h-5" />,
        badge: { text: "Nouveau", color: "bg-carbon-emerald/15 text-carbon-emerald-light" },
      },
      {
        id: "datapoints", href: "/datapoints", label: "Datapoints CSRD", icon: <ListChecks className="w-5 h-5" />,
        badge: { text: "RAG", color: "bg-carbon-emerald/15 text-carbon-emerald-light" },
      },
      {
        id: "review", href: "/review", label: "Validation CSRD", icon: <ClipboardCheck className="w-5 h-5" />,
        badge: { text: "ESRS", color: "bg-amber-500/15 text-amber-600" },
      },
      {
        id: "reports", href: "/reports", label: "Rapports & iXBRL", icon: <FileBarChart className="w-5 h-5" />,
        badge: { text: "ESEF", color: "bg-amber-500/15 text-amber-600" },
      },
    ],
  },
  {
    group: "Données",
    items: [
      {
        id: "fournisseurs", href: "/fournisseurs", label: "Fournisseurs", icon: <Factory className="w-5 h-5" />,
        badge: { text: "Scope 3", color: "bg-blue-500/15 text-blue-400" },
      },
      { id: "upload",  href: "/upload",  label: "Import Excel",     icon: <Upload className="w-5 h-5" /> },
      { id: "fec",     href: "/fec",     label: "Import FEC",       icon: <Receipt className="w-5 h-5" /> },
      { id: "imports", href: "/imports", label: "Imports fichiers", icon: <FolderInput className="w-5 h-5" /> },
      { id: "ingest",  href: "/ingest",  label: "Synchronisation",  icon: <Database className="w-5 h-5" /> },
      { id: "qc",      href: "/qc",      label: "Contrôles qualité", icon: <ShieldCheck className="w-5 h-5" /> },
    ],
  },
  {
    group: "Restitution & périmètre",
    items: [
      { id: "beges",         href: "/beges",         label: "BEGES (France)",     icon: <FileText className="w-5 h-5" /> },
      { id: "actions",       href: "/actions",       label: "Plan d'action",      icon: <TrendingDown className="w-5 h-5" /> },
      { id: "baselines",     href: "/baselines",     label: "Année de référence", icon: <CalendarClock className="w-5 h-5" /> },
      { id: "diff",          href: "/diff",          label: "Multi-exercices",    icon: <GitCompare className="w-5 h-5" /> },
      { id: "consolidation", href: "/consolidation", label: "Consolidation",      icon: <Building2 className="w-5 h-5" /> },
    ],
  },
  {
    group: "IA & Audit",
    items: [
      {
        id: "copilot", href: "/copilot", label: "Copilote IA", icon: <Bot className="w-5 h-5" />,
        badge: { text: "IA", color: "bg-carbon-emerald/15 text-carbon-emerald-light" },
      },
      {
        id: "revue", href: "/revue", label: "Validation Merkle", icon: <Inbox className="w-5 h-5" />,
        badge: { text: "Phase 3", color: "bg-violet-500/15 text-violet-400" },
      },
      { id: "audit",    href: "/audit",    label: "Journal d'audit", icon: <ClipboardList className="w-5 h-5" /> },
      { id: "history",  href: "/history",  label: "Historique",      icon: <History className="w-5 h-5" /> },
      { id: "alerts",   href: "/alerts",   label: "Alertes",         icon: <Bell className="w-5 h-5" /> },
      { id: "securite", href: "/securite", label: "Sécurité 2FA",    icon: <ShieldCheck className="w-5 h-5" /> },
      { id: "admin",    href: "/admin",    label: "Administration",  icon: <Settings className="w-5 h-5" /> },
      { id: "pricing", href: "/pricing", label: "Offres",           icon: <CreditCard className="w-5 h-5" /> },
    ],
  },
  {
    // Groupe volontairement séparé des modules métier (cf. cc-nav-grp--demo) :
    // points d'entrée vers les cockpits de démonstration 100% fictifs (Asterion).
    group: "Démonstration",
    items: [
      {
        id: "demo-studio", href: "/demo/asterion-motion", label: "Demo Studio",
        icon: <FlaskConical className="w-5 h-5" />,
        badge: { text: "DÉMO", color: "bg-amber-500/15 text-amber-600" },
      },
      {
        id: "demo-resources", href: "/demo/asterion-resources", label: "Démo Ressources",
        icon: <Boxes className="w-5 h-5" />,
        badge: { text: "DÉMO", color: "bg-amber-500/15 text-amber-600" },
      },
    ],
  },
];

/**
 * Entrée active si le chemin courant vaut exactement le href OU en est une
 * sous-route (`/resources` reste actif sur `/resources/exposures`). Fonction
 * pure — testée sans monter la Sidebar.
 */
export function isNavItemActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}
