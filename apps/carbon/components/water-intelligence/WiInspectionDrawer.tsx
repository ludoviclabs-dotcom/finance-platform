"use client";

/**
 * WiInspectionDrawer.tsx — tiroir d'inspection du module hydrique (WI-V3-04).
 *
 * ## Ce composant REMPLACE `WiProvenanceDrawer`
 *
 * Celui-ci existait depuis la Wave C avec des mécaniques correctes — `Échap`,
 * piège et restitution de focus, aucune récupération de données par lui-même —
 * mais une API soudée à `WaterSourceReference`, et **aucun appelant**. Le
 * Basin Atlas avait besoin du même tiroir pour un sujet différent : un
 * TERRITOIRE, pas une source.
 *
 * Plutôt qu'un troisième tiroir dans le même module, les mécaniques sont
 * conservées à l'identique et le contenu devient générique : une liste de
 * lignes `libellé / valeur`, plus des sections libres. La provenance d'une
 * source se décrit très bien ainsi — le futur Evidence Registry n'aura donc
 * rien à réécrire, seulement des lignes à fournir.
 *
 * ## Ce qui n'a pas changé, et pourquoi
 *
 * Le tiroir ne récupère RIEN : tout arrive en props. C'est ce qui rend
 * structurellement impossible un appel réseau depuis cette surface publique,
 * et ça reste vrai qu'il décrive une source ou un territoire.
 *
 * La palette reste `--wi-*`. Le `SourceDrawer` de `components/intelligence/`
 * code ses couleurs en Tailwind zinc/emerald ; les emprunter casserait le
 * thème et le contraste en mode clair.
 */

import { useCallback, useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export interface WiInspectionRow {
  readonly label: string;
  readonly value: ReactNode;
  /** Rend la valeur en monospace : réservé aux RÉFÉRENCES techniques. */
  readonly mono?: boolean;
}

export interface WiInspectionSection {
  readonly title: string;
  readonly body: ReactNode;
}

export interface WiInspectionDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  /** Surtitre court — nomme la NATURE de ce qui est inspecté. */
  readonly kicker?: string;
  readonly rows: readonly WiInspectionRow[];
  readonly sections?: readonly WiInspectionSection[];
  readonly footer?: ReactNode;
  readonly testId?: string;
}

export function WiInspectionDrawer({
  open,
  onClose,
  title,
  kicker,
  rows,
  sections,
  footer,
  testId,
}: WiInspectionDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      /*
       * Piège de focus. Sans lui, `Tab` sort du tiroir et parcourt la page qui
       * se trouve derrière — visuellement masquée, toujours tabulable : un
       * lecteur au clavier perdrait le fil sans qu'aucun repère ne bouge.
       */
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
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
      // Restitution du focus : jamais perdu sur `document.body`.
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="wi-drawer-layer" data-testid={testId ?? "wi-inspection-drawer"}>
      {/*
        Voile de fermeture. `aria-hidden` : le tiroir porte déjà un bouton
        « Fermer » atteignable au clavier, et annoncer un second contrôle de
        fermeture sans libellé propre n'aiderait personne.
      */}
      <button
        type="button"
        className="wi-drawer-scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
        className="wi-drawer"
      >
        <div className="wi-drawer-head">
          <div>
            {kicker ? <p className="wi-kicker">{kicker}</p> : null}
            <h3 className="wi-h3" id={titleId}>
              {title}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="wi-drawer-close">
            Fermer
          </button>
        </div>

        <dl className="wi-drawer-rows">
          {rows.map((row) => (
            <div key={row.label} className="wi-drawer-row">
              <dt>{row.label}</dt>
              <dd className={row.mono ? "wi-mono" : undefined}>
                {row.value ?? <span className="wi-muted">non communiqué</span>}
              </dd>
            </div>
          ))}
        </dl>

        {sections?.map((section) => (
          <section key={section.title} className="wi-drawer-section">
            <h4 className="wi-h4">{section.title}</h4>
            <div className="wi-muted wi-drawer-section-body">{section.body}</div>
          </section>
        ))}

        {footer ? <div className="wi-drawer-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
