/**
 * Design tokens — CarbonCo
 *
 * Source de vérité TypeScript extraite de globals.css.
 * Utiliser ces constantes pour les valeurs inline React et les calculs dynamiques.
 * Pour du CSS statique, préférer les variables CSS var(--color-*).
 *
 * Créé : Phase 0 Sprint 1 (2026-04-15)
 */

// ─── Palette de marque ────────────────────────────────────────────────────

export const brandColors = {
  forest: "#14532D",
  emerald: "#059669",
  emeraldLight: "#34D399",
  emeraldMuted: "#6EE7B7",
  slate: "#0F172A",
  navy: "#1E293B",
  white: "#FFFFFF",
  mist: "#F0FDF4",
} as const;

// ─── Couleurs sémantiques ─────────────────────────────────────────────────

export const statusColors = {
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  infoBorder: "#BFDBFE",
  neutral: "#6B7280",
  neutralBg: "#F9FAFB",
} as const;

// ─── Scope carbone ────────────────────────────────────────────────────────

export const scopeColors = {
  scope1: "#059669",
  scope1Light: "#34D399",
  scope2: "#0891B2",
  scope2Light: "#22D3EE",
  scope3: "#7C3AED",
  scope3Light: "#A78BFA",
} as const;

// ─── Radii ────────────────────────────────────────────────────────────────

export const radii = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  full: "9999px",
} as const;

// ─── Typographie ──────────────────────────────────────────────────────────

export const fontFamilies = {
  sans: "Inter, system-ui, sans-serif",
  display: "'Space Grotesk', Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

// ─── Espacements clés ────────────────────────────────────────────────────

export const spacing = {
  sectionPadding: "3rem",       // py-12
  cardPadding: "1.5rem",        // p-6
  cardPaddingSm: "1rem",        // p-4
  gapGrid: "1rem",              // gap-4
  gapGridLg: "1.5rem",          // gap-6
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────

export const shadows = {
  card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  cardHover: "0 4px 12px rgba(0,0,0,0.08)",
  overlay: "0 20px 60px rgba(0,0,0,0.15)",
} as const;

// ─── Z-index ──────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  raised: 10,
  overlay: 50,
  modal: 100,
  toast: 200,
} as const;
