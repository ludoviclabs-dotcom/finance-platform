/**
 * Navigation — source unique de vérité du site.
 *
 * Remplace l'ancienne constante `NAVIGATION` de `public-catalog.ts`, qui avait
 * dérivé à 9 entrées top-level alors que son commentaire ciblait 5.
 *
 * Règle : 6 entrées top-level, dernière = CTA (bouton primaire dans la navbar).
 * Tous les enfants pointent vers des routes existantes.
 *
 * Cf. `docs/route-audit.md` pour le mapping route → décision.
 */

import { SECTOR_ENTRIES } from "@/lib/public-catalog";
import type { PublicStatus } from "@/lib/public-catalog";

export type NavStatus = PublicStatus | "unknown";

export interface NavChild {
  label: string;
  href: string;
  status: NavStatus;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
  /** Dernier item de la nav = CTA primaire (bouton coloré). */
  primary?: boolean;
}

export const NAV_V2: NavItem[] = [
  {
    label: "Produit",
    href: "/produit",
    children: [
      { label: "Démo live (Luxe Finance)", href: "/secteurs/luxe/finance", status: "live" },
      { label: "Catalogue agents", href: "/agents", status: "live" },
      { label: "Operator Gateway", href: "/operator-gateway", status: "demo" },
      { label: "Connecteurs", href: "/connecteurs", status: "live" },
      { label: "Simulation Studio", href: "/simulation", status: "demo" },
      { label: "Branches métier", href: "/solutions", status: "live" },
    ],
  },
  {
    label: "Preuves",
    href: "/proof",
    children: [
      { label: "Console de preuve", href: "/proof", status: "live" },
      { label: "Dossier de preuve", href: "/dossier", status: "live" },
      { label: "Trust Center", href: "/trust", status: "live" },
      { label: "Status", href: "/status", status: "live" },
      { label: "Roadmap", href: "/roadmap", status: "live" },
      { label: "Conformité", href: "/conformite", status: "live" },
    ],
  },
  {
    label: "Secteurs",
    href: "/secteurs",
    children: SECTOR_ENTRIES.map((entry) => ({
      label: entry.label,
      href: entry.href,
      status: entry.status,
    })),
  },
  {
    label: "Ressources",
    href: "/ressources",
    children: [
      { label: "Documentation", href: "/docs", status: "live" },
      { label: "Publications", href: "/publications", status: "live" },
      { label: "Glossaire IA", href: "/glossaire", status: "live" },
      { label: "Outils gratuits", href: "/outils", status: "live" },
      { label: "Cas-types", href: "/cas-types", status: "live" },
      { label: "Recipes", href: "/recipes", status: "live" },
      { label: "Sandbox", href: "/sandbox", status: "live" },
    ],
  },
  { label: "À propos", href: "/about" },
  { label: "Contact", href: "/contact", primary: true },
];

export const FOOTER_V2 = {
  Produit: [
    { label: "Démo live", href: "/secteurs/luxe/finance", status: "live" as NavStatus },
    { label: "Agent Pack 30j", href: "/forfaits", status: "live" as NavStatus },
    { label: "Operator Gateway", href: "/operator-gateway", status: "demo" as NavStatus },
    { label: "Connecteurs", href: "/connecteurs", status: "live" as NavStatus },
  ],
  Preuves: [
    { label: "Console de preuve", href: "/proof", status: "live" as NavStatus },
    { label: "Dossier de preuve", href: "/dossier", status: "live" as NavStatus },
    { label: "Trust Center", href: "/trust", status: "live" as NavStatus },
    { label: "Status", href: "/status", status: "live" as NavStatus },
    { label: "Roadmap", href: "/roadmap", status: "live" as NavStatus },
    { label: "Changelog", href: "/changelog", status: "live" as NavStatus },
  ],
  Secteurs: SECTOR_ENTRIES.map((entry) => ({
    label: entry.label,
    href: entry.href,
    status: entry.status as NavStatus,
  })),
  Ressources: [
    { label: "Documentation", href: "/docs", status: "live" as NavStatus },
    { label: "Publications", href: "/publications", status: "live" as NavStatus },
    { label: "Glossaire IA", href: "/glossaire", status: "live" as NavStatus },
    { label: "Outils gratuits", href: "/outils", status: "live" as NavStatus },
    { label: "Comparatifs", href: "/contre", status: "live" as NavStatus },
    { label: "Developer", href: "/dev", status: "live" as NavStatus },
  ],
  Entreprise: [
    { label: "À propos", href: "/about", status: "demo" as NavStatus },
    { label: "Témoignages", href: "/temoignages", status: "live" as NavStatus },
    { label: "Presse", href: "/presse", status: "live" as NavStatus },
    { label: "Newsletter", href: "/newsletter", status: "live" as NavStatus },
    { label: "Contact", href: "/contact", status: "live" as NavStatus },
    { label: "Mentions légales", href: "/legal", status: "demo" as NavStatus },
    { label: "Confidentialité", href: "/legal/confidentialite", status: "demo" as NavStatus },
  ],
} as const;

/** Libellés courts utilisés dans navbar/footer (vs libellés longs côté pages preuve). */
export const STATUS_LABELS_SHORT: Record<NavStatus, string> = {
  live: "Live",
  demo: "Démo",
  planned: "Prépa",
  unknown: "—",
};
