"use client";

/**
 * WiCompass.tsx — la boussole de l'eau : les huit facettes du risque hydrique,
 * tenues séparées, lues une à une.
 *
 * Une figure de LECTURE, pas un indice : les huit segments ont la même taille
 * (aucun poids, aucun score), et leur texture dit l'état de publication —
 * plein (publié), hachuré (différé), clair (qualitatif), pointillé (non
 * instrumenté). Le contenu vient de `PULSE_FACETS`, jamais d'un texte recopié.
 */

import { useState } from "react";

import {
  EVIDENCE_LABELS,
  PULSE_FACETS,
  type PulseFacet,
} from "@/lib/water-intelligence/editorial-matrices";
import { WiStatusChip } from "./WiPrimitives";

/** Où lire chaque facette plus loin dans la page. */
const FACET_TARGET: Record<string, { readonly href: string; readonly label: string }> = {
  disponibilite: { href: "#cycle", label: "Voir le cycle de l'eau" },
  prelevements: { href: "#carte", label: "Voir les volumes déclarés" },
  qualite: { href: "#sources", label: "Voir pourquoi la source attend" },
  secheresse: { href: "#cycle", label: "Voir le cycle de l'eau" },
  inondation: { href: "#reperes", label: "Voir les repères France" },
  dependances: { href: "#secteurs", label: "Voir la matrice des secteurs" },
  reglementation: { href: "#finance", label: "Voir la passerelle financière" },
  adaptation: { href: "#secteurs", label: "Voir les innovations" },
};

const CX = 240;
const CY = 220;
const R_OUT = 122;
const R_IN = 70;

function point(radius: number, angle: number): string {
  const t = (angle * Math.PI) / 180;
  return `${(CX + radius * Math.cos(t)).toFixed(1)} ${(CY + radius * Math.sin(t)).toFixed(1)}`;
}

function arc(index: number): { d: string; mid: number } {
  const a0 = -90 + index * 45 - 22.5 + 1.6;
  const a1 = a0 + 45 - 3.2;
  const d = `M ${point(R_OUT, a0)} A ${R_OUT} ${R_OUT} 0 0 1 ${point(R_OUT, a1)} L ${point(R_IN, a1)} A ${R_IN} ${R_IN} 0 0 0 ${point(R_IN, a0)} Z`;
  return { d, mid: (a0 + a1) / 2 };
}

export function WiCompass() {
  const [picked, setPicked] = useState<string>(
    PULSE_FACETS.find((f) => f.publicationState === "published")?.id ?? PULSE_FACETS[0].id,
  );
  const index = Math.max(0, PULSE_FACETS.findIndex((f) => f.id === picked));
  const facet: PulseFacet = PULSE_FACETS[index];
  const target = FACET_TARGET[facet.id];
  const number = String(index + 1).padStart(2, "0");

  return (
    <div className="wi-compass">
      <div className="wi-frame wi-compass-figure wi-gridpaper">
        <div className="wi-compass-stage">
          <svg viewBox="0 0 480 440" className="wi-compass-svg" aria-hidden="true">
            <defs>
              <pattern id="wiCompassHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" className="wi-compass-hatchline" />
              </pattern>
            </defs>
            <circle cx={CX} cy={CY} r={150} className="wi-compass-orbit" />
            <circle cx={CX} cy={CY} r={58} className="wi-compass-core" />
            {PULSE_FACETS.map((f, i) => {
              const { d, mid } = arc(i);
              const on = f.id === picked;
              const t = (mid * Math.PI) / 180;
              const shift = on ? `translate(${(8 * Math.cos(t)).toFixed(1)}px, ${(8 * Math.sin(t)).toFixed(1)}px)` : undefined;
              return (
                <path
                  key={f.id}
                  d={d}
                  className={`wi-compass-seg wi-compass-seg-${f.publicationState}`}
                  data-on={on ? "true" : "false"}
                  style={{ transform: shift, animationDelay: `${120 + i * 70}ms` }}
                  onClick={() => setPicked(f.id)}
                />
              );
            })}
            <text x={CX} y={CY - 10} textAnchor="middle" className="wi-compass-num">
              {number} / 08
            </text>
            <text x={CX} y={CY + 16} textAnchor="middle" className="wi-compass-label">
              {facet.label}
            </text>
          </svg>
          {PULSE_FACETS.map((f, i) => {
            const { mid } = arc(i);
            const t = (mid * Math.PI) / 180;
            const lx = CX + 182 * Math.cos(t);
            const ly = CY + 182 * Math.sin(t);
            const on = f.id === picked;
            return (
              <button
                key={f.id}
                type="button"
                className="wi-compass-chip"
                aria-pressed={on}
                onClick={() => setPicked(f.id)}
                style={{ left: `${(((lx - 56) / 480) * 100).toFixed(2)}%`, top: `${(((ly - 18) / 440) * 100).toFixed(2)}%` }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <ul className="wi-compass-legend" aria-label="Légende des états">
          <li><span className="wi-compass-key wi-compass-key-published" aria-hidden="true" />Publié</li>
          <li><span className="wi-compass-key wi-compass-key-deferred" aria-hidden="true" />Différé</li>
          <li><span className="wi-compass-key wi-compass-key-qualitative" aria-hidden="true" />Qualitatif</li>
          <li><span className="wi-compass-key wi-compass-key-not_instrumented" aria-hidden="true" />Non instrumenté</li>
        </ul>
      </div>

      <article className="wi-frame wi-compass-panel" aria-live="polite" key={facet.id}>
        <p className="wi-kicker">Lecture · facette {number}</p>
        <div className="wi-compass-panel-head">
          <h3 className="wi-h3 wi-compass-title">{facet.label}</h3>
          <WiStatusChip state={facet.publicationState} testId={`wi-pulse-state-${facet.id}`} />
        </div>
        <p className="wi-compass-question">{facet.question}</p>
        <p className="wi-muted">{facet.body}</p>
        <dl className="wi-compass-facts">
          <div>
            <dt>Publié aujourd&apos;hui</dt>
            <dd>{facet.published}</dd>
          </div>
          <div>
            <dt>Niveau de preuve</dt>
            <dd>{EVIDENCE_LABELS[facet.evidenceLevel]}</dd>
          </div>
        </dl>
        {target ? (
          <a href={target.href} className="wi-link wi-compass-go">
            {target.label} →
          </a>
        ) : null}
      </article>
    </div>
  );
}
