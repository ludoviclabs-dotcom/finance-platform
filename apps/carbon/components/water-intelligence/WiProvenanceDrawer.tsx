"use client";

/**
 * WiProvenanceDrawer.tsx — tiroir de provenance (Wave C, C09).
 *
 * Îlot client justifié : modal, `Échap`, piège et restitution de focus.
 *
 * Reprend la FORME du `SourceDrawer` existant (`components/intelligence/`) —
 * `role="dialog"`, `aria-modal`, fermeture au clavier, et surtout le principe
 * « ne récupère rien lui-même » : la provenance arrive entièrement en props,
 * ce qui rend structurellement impossible tout appel réseau depuis ce
 * composant. Ce qui n'est PAS repris : sa palette Tailwind codée en dur, qui
 * casserait le thème `--wi-*` et le contraste en mode clair.
 */

import { useCallback, useEffect, useRef } from "react";

import type { WaterSourceReference } from "@/lib/water-intelligence/contracts";

export interface WiProvenanceDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly source: WaterSourceReference | null;
  /** Exclusion éventuelle : ce qui est écarté et pourquoi. */
  readonly exclusionDetail?: string | null;
  readonly coverageLabel?: string | null;
}

export function WiProvenanceDrawer({
  open,
  onClose,
  source,
  exclusionDetail,
  coverageLabel,
}: WiProvenanceDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      // Restitution du focus : jamais perdu sur document.body.
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open || !source) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Provenance de la donnée"
      ref={panelRef}
      tabIndex={-1}
      className="wi-card"
      style={{
        position: "fixed",
        insetInlineEnd: 0,
        insetBlockStart: 0,
        blockSize: "100%",
        inlineSize: "min(24rem, 100%)",
        overflowY: "auto",
        zIndex: 50,
        borderRadius: "0.75rem 0 0 0.75rem",
        boxShadow: "var(--wi-shadow-panel)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem" }}>
        <h3 className="wi-h3">Provenance</h3>
        <button type="button" onClick={onClose} className="wi-nav-link">
          Fermer
        </button>
      </div>

      <dl style={{ margin: "1rem 0 0", display: "grid", gap: "0.625rem" }}>
        <WiProvenanceRow label="Source" value={source.source_code} mono />
        <WiProvenanceRow label="Release" value={source.release_key} mono />
        <WiProvenanceRow label="Empreinte" value={`${source.checksum_sha256.slice(0, 12)}…`} mono />
        <WiProvenanceRow label="Publiée le" value={source.published_at ?? null} />
        <WiProvenanceRow label="Récupérée le" value={source.retrieved_at} />
        <WiProvenanceRow
          label="Période observée"
          value={
            source.observed_period_start && source.observed_period_end
              ? `${source.observed_period_start} → ${source.observed_period_end}`
              : null
          }
        />
        <WiProvenanceRow label="Méthode" value={source.methodology_version} mono />
        <WiProvenanceRow label="Couverture" value={coverageLabel ?? null} />
        <WiProvenanceRow
          label="Affichage"
          value={source.license.allow_display ? "autorisé" : "interdit"}
        />
        <WiProvenanceRow
          label="Usage dérivé"
          value={source.license.allow_derived_use ? "autorisé" : "interdit"}
        />
        <WiProvenanceRow label="Attribution" value={source.attribution ?? null} />
      </dl>

      {source.license.reasons.length > 0 ? (
        <section style={{ marginTop: "1rem" }}>
          <h4 className="wi-h4">Décision de licence</h4>
          <ul className="wi-muted" style={{ paddingLeft: "1.1rem", fontSize: "0.8125rem" }}>
            {source.license.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {source.warnings.length > 0 ? (
        <section style={{ marginTop: "1rem" }}>
          <h4 className="wi-h4">Avertissements</h4>
          <ul className="wi-muted" style={{ paddingLeft: "1.1rem", fontSize: "0.8125rem" }}>
            {source.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {exclusionDetail ? (
        <section style={{ marginTop: "1rem" }}>
          <h4 className="wi-h4">Exclusion</h4>
          <p className="wi-muted" style={{ fontSize: "0.8125rem" }}>
            {exclusionDetail}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function WiProvenanceRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="wi-muted" style={{ fontSize: "0.75rem" }}>
        {label}
      </dt>
      <dd
        className={mono ? "wi-mono" : undefined}
        style={{ margin: "0.125rem 0 0", fontSize: "0.875rem" }}
      >
        {value ?? <span className="wi-muted">non communiqué</span>}
      </dd>
    </div>
  );
}
