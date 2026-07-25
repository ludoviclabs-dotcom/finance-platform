/**
 * WiDataState.tsx — rendu des huit états de donnée (Wave C, blueprint §7).
 *
 * Server Component : aucun hook, aucun gestionnaire d'événement. La décision
 * d'état est prise par le décideur PUR `resolveWiDataState`
 * (`lib/water-intelligence/data-state.ts`) — ce composant ne fait que rendre
 * le résultat, il ne réimplémente aucune priorité.
 *
 * Invariant tenu : la couleur ne porte jamais seule l'information. Chaque état
 * rend un libellé texte, et l'absence porte en plus une texture.
 */

import type { ReactNode } from "react";

import {
  MODIFIER_LABELS,
  type WiDataState as WiDataStateValue,
  type WiDataStateKind,
} from "@/lib/water-intelligence/data-state";

import { WiBadge } from "./WiPrimitives";

const TONE: Record<WiDataStateKind, "demo" | "absent" | "pending" | "alert"> = {
  fixture: "demo",
  error: "alert",
  blocked: "pending",
  absent: "absent",
  loading: "pending",
  nominal: "pending",
};

const ROLE: Partial<Record<WiDataStateKind, "alert" | "status">> = {
  error: "alert",
  loading: "status",
};

/**
 * Rend un état de donnée. Quand `state.rendersValue` est faux, `children`
 * n'est PAS rendu : c'est ce qui garantit qu'aucune valeur ne fuit sous un
 * état bloqué, absent ou fixture.
 */
export function WiDataState({
  state,
  children,
}: {
  state: WiDataStateValue;
  children?: ReactNode;
}) {
  if (state.rendersValue) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem" }}>
        {children}
        <WiModifiers modifiers={state.modifiers} />
      </span>
    );
  }

  const role = ROLE[state.kind];
  return (
    <span
      className={state.kind === "absent" ? "wi-absent-fill" : undefined}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "0.25rem",
        padding: state.kind === "absent" ? "0.5rem 0.625rem" : undefined,
      }}
      {...(role ? { role } : {})}
      {...(state.kind === "loading" ? { "aria-busy": true } : {})}
    >
      <WiBadge tone={TONE[state.kind]} label={state.label} />
      {state.detail ? (
        <span className="wi-muted" style={{ fontSize: "0.8125rem" }}>
          {state.detail}
        </span>
      ) : null}
      <WiModifiers modifiers={state.modifiers} />
    </span>
  );
}

/**
 * Modificateurs cumulables. Rendus en texte à côté de la valeur — une valeur
 * peut être à la fois périmée et partiellement couverte, et les deux mentions
 * s'affichent.
 */
export function WiModifiers({ modifiers }: { modifiers: readonly ("stale" | "partial-coverage")[] }) {
  if (modifiers.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.375rem" }}>
      {modifiers.map((modifier) => (
        <span
          key={modifier}
          className="wi-mono"
          style={{ fontSize: "0.75rem", color: "var(--wi-stress)" }}
        >
          {MODIFIER_LABELS[modifier]}
        </span>
      ))}
    </span>
  );
}
