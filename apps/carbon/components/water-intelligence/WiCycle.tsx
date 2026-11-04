"use client";

/**
 * WiCycle.tsx — coupe pédagogique du cycle de l'eau, en six étapes, chacune
 * reliée à la source officielle qui la mesure et à son état RÉEL de
 * publication.
 *
 * Remplace le bloc 3D (`WiBassin3D`, conservé dans le dépôt avec ses tests) :
 * une coupe 2D se lit au premier regard et dit ce que chaque source mesure.
 *
 * - Illustration, pas topographie : aucune géométrie ne décrit le bassin réel
 *   de la commune publiée — le bandeau le dit.
 * - L'état de chaque source vient de `source-status.json` (libellé backend),
 *   jamais d'un texte recopié ici.
 * - Le repère France de chaque étape ne s'affiche que s'il est publiable
 *   (revue signée, valeur relue à la source).
 * - Aucune animation perpétuelle : chaque mouvement joue un nombre FINI de
 *   fois quand on choisit une étape ; la lecture automatique est une action
 *   explicite du lecteur.
 */

import { useEffect, useState } from "react";

import type { WiContextFact } from "@/lib/water-intelligence/context-candidates";

export interface WiCycleSource {
  readonly code: string;
  readonly label: string;
  readonly stateLabel: string;
  readonly publishable: boolean;
}

interface Step {
  readonly n: number;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly body: string;
  readonly sources: readonly string[];
  readonly factIds: readonly string[];
  readonly key: string;
}

const STEPS: readonly Step[] = [
  {
    n: 1, title: "Précipitations", x: 19.5, y: 7,
    body: "La pluie recharge le système. Une année sèche est un écart à la normale : elle ne dit pas, seule, si le bassin est structurellement tendu.",
    sources: ["COPERNICUS_EDO"], factIds: ["ressource-renouv-2002"],
    key: "conjoncturel (une année) et structurel (un bassin) sont deux lectures différentes.",
  },
  {
    n: 2, title: "Ruissellement et débits", x: 41, y: 41,
    body: "L'eau qui ne s'infiltre pas rejoint les cours d'eau. Le débit dit ce que la rivière porte, à un point et à un instant.",
    sources: ["HUBEAU_HYDROMETRIE"], factIds: ["explore2-debit-ete-fort"],
    key: "un débit est une mesure au point, pas un état du bassin entier.",
  },
  {
    n: 3, title: "Infiltration et nappe", x: 30, y: 84,
    body: "Une part s'infiltre et recharge la nappe, lentement : des mois, parfois des années. C'est la réserve qui amortit les sécheresses.",
    sources: ["HUBEAU_ADES"], factIds: ["explore2-qmna"],
    key: "la nappe réagit avec retard : une pluie d'hiver se lit en été.",
  },
  {
    n: 4, title: "Prélèvement", x: 59, y: 71,
    body: "Le forage soutire un volume à la ressource. C'est ce volume que la redevance fait déclarer, ouvrage par ouvrage, année par année.",
    sources: ["HUBEAU_BNPE_PRELEVEMENTS"], factIds: ["prelev-total-2023"],
    key: "un volume non déclaré n'est pas un volume nul.",
  },
  {
    n: 5, title: "Usage et consommation", x: 74, y: 30,
    body: "Une partie de l'eau prélevée est restituée ; l'autre est consommée — évaporée ou incorporée. Le stress d'un bassin compare ces usages à la ressource renouvelable.",
    sources: ["EEA_WEI_PLUS", "WRI_AQUEDUCT"], factIds: ["restitution-2023"],
    key: "prélever n'est pas consommer : seule la part non restituée manque au bassin.",
  },
  {
    n: 6, title: "Rejet et qualité", x: 86, y: 70,
    body: "L'eau restituée retourne au milieu avec une charge. La qualité se juge paramètre par paramètre, pour un usage donné — jamais en bloc.",
    sources: ["HUBEAU_QUALITE_SURFACE"], factIds: ["qualite-surface"],
    key: "il n'existe pas de « bonne eau » en général, seulement une eau apte à un usage.",
  },
];

function fr(value: number): string {
  return value.toLocaleString("fr-FR");
}

export function WiCycle({ sources, facts }: { sources: readonly WiCycleSource[]; facts: readonly WiContextFact[] }) {
  const [step, setStep] = useState(4);
  const [auto, setAuto] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      setStep((s) => (s % STEPS.length) + 1);
      setRound((r) => r + 1);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [auto]);

  const choose = (n: number) => {
    setAuto(false);
    setStep(n);
    setRound((r) => r + 1);
  };

  const current = STEPS[step - 1];
  const measured = current.sources
    .map((code) => sources.find((s) => s.code === code))
    .filter((s): s is WiCycleSource => Boolean(s));
  const fact = current.factIds.map((id) => facts.find((f) => f.id === id)).find(Boolean);
  const publishedSteps = STEPS.filter((s) => s.sources.some((code) => sources.find((x) => x.code === code)?.publishable)).length;
  const dim = (n: number) => (n === step ? 1 : 0.28);

  return (
    <div className="wi-cycle">
      <figure className="wi-frame wi-cycle-figure">
        <p className="wi-cycle-banner">
          <span className="wi-hatched wi-cycle-banner-key" aria-hidden="true" />
          <strong>Coupe pédagogique</strong> — illustrative, non topographique. Aucune géométrie ne décrit le bassin réel de la commune publiée.
        </p>
        <div className="wi-cycle-stage wi-gridpaper" data-round={round}>
          <svg viewBox="0 0 760 430" className="wi-cycle-svg" aria-hidden="true" key={round}>
            <rect x="0" y="372" width="760" height="58" className="wi-cy-rock" />
            <rect x="0" y="312" width="760" height="60" className="wi-cy-aquifer" />
            <rect x="0" y="278" width="760" height="34" className="wi-cy-soil" />
            <path d="M0 278 L0 230 L70 190 L150 120 L210 150 L250 132 L330 210 L400 246 L580 248 L598 270 L668 270 L684 248 L760 248 L760 278 Z" className="wi-cy-land" />
            <path d="M598 252 L668 252 L664 268 L602 268 Z" className="wi-cy-river" />
            <line x1="0" y1="312" x2="760" y2="312" className="wi-cy-table" />
            <text x="12" y="300" className="wi-cy-label">ZONE NON SATURÉE</text>
            <text x="12" y="332" className="wi-cy-label wi-cy-label-strong">NAPPE</text>
            <text x="12" y="392" className="wi-cy-label">SOCLE</text>

            <g style={{ opacity: dim(1) }} className="wi-cy-group">
              <g className="wi-cy-cloud">
                <circle cx="120" cy="54" r="20" />
                <circle cx="146" cy="44" r="25" />
                <circle cx="174" cy="56" r="18" />
                <rect x="104" y="56" width="86" height="18" className="wi-cy-cloud-fill" />
                <line x1="102" y1="74" x2="192" y2="74" />
              </g>
              {[114, 132, 150, 168, 186].map((x, i) => (
                <line key={x} x1={x} y1="86" x2={x - 4} y2="98" className={step === 1 ? "wi-cy-rain" : "wi-cy-rain-still"} style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </g>
            <g style={{ opacity: dim(2) }} className="wi-cy-group">
              <path d="M214 156 Q 300 196 340 222 T 600 258" className={`wi-cy-flow ${step === 2 ? "wi-cy-flow-on" : ""}`} />
              <path d="M604 260 L 664 260" className={`wi-cy-flow wi-cy-flow-dark ${step === 2 ? "wi-cy-flow-on" : ""}`} />
            </g>
            <g style={{ opacity: dim(3) }} className="wi-cy-group">
              {[262, 300, 338].map((x) => (
                <path key={x} d={`M${x} ${x === 262 ? 170 : x === 300 ? 196 : 226} L${x} 330`} className={`wi-cy-seep ${step === 3 ? "wi-cy-flow-on" : ""}`} />
              ))}
              <path d="M40 345 L740 345" className={`wi-cy-seep ${step === 3 ? "wi-cy-flow-on" : ""}`} />
              <path d="M40 360 L740 360" className={`wi-cy-seep ${step === 3 ? "wi-cy-flow-on" : ""}`} />
            </g>
            <g style={{ opacity: dim(4) }} className="wi-cy-group">
              <rect x="444" y="246" width="8" height="112" className="wi-cy-pipe" />
              <path d="M448 356 L448 236" className={`wi-cy-flow ${step === 4 ? "wi-cy-flow-on" : ""}`} />
              <rect x="436" y="226" width="24" height="20" className="wi-cy-pipe" />
              <path d="M460 236 L490 236" className={`wi-cy-flow ${step === 4 ? "wi-cy-flow-on" : ""}`} />
            </g>
            <g style={{ opacity: dim(5) }} className="wi-cy-group">
              <rect x="490" y="196" width="78" height="52" className="wi-cy-pipe" />
              <path d="M490 196 L510 180 L530 196 L550 180 L568 196" className="wi-cy-outline" />
              <rect x="548" y="150" width="10" height="34" className="wi-cy-pipe" />
              <path d="M553 146 C 546 130, 562 118, 553 100" className={`wi-cy-vapor ${step === 5 ? "wi-cy-flow-on" : ""}`} />
              <path d="M520 194 C 514 178, 528 166, 520 150" className={`wi-cy-vapor ${step === 5 ? "wi-cy-flow-on" : ""}`} />
              <text x="529" y="228" textAnchor="middle" className="wi-cy-label">SITE</text>
            </g>
            <g style={{ opacity: dim(6) }} className="wi-cy-group">
              <path d="M568 238 L612 238 L612 252" className="wi-cy-outlet" />
              <path d="M568 238 L612 238 L612 256" className={`wi-cy-flow wi-cy-flow-light ${step === 6 ? "wi-cy-flow-on" : ""}`} />
            </g>
          </svg>
          {STEPS.map((s) => (
            <button
              key={s.n}
              type="button"
              className="wi-cycle-hot"
              aria-pressed={s.n === step}
              aria-label={`Étape ${s.n} : ${s.title}`}
              onClick={() => choose(s.n)}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              {s.n}
            </button>
          ))}
        </div>
        <div className="wi-cycle-controls">
          <button type="button" className="wi-btn" onClick={() => choose(step === 1 ? STEPS.length : step - 1)}>
            ← Étape précédente
          </button>
          <span className="wi-cycle-track" aria-hidden="true">
            {STEPS.map((s) => (
              <span key={s.n} data-on={s.n <= step ? "true" : "false"} />
            ))}
          </span>
          <button type="button" className="wi-btn" onClick={() => choose((step % STEPS.length) + 1)}>
            Étape suivante →
          </button>
          <button type="button" className="wi-btn wi-btn-ghost" aria-pressed={auto} onClick={() => setAuto((a) => !a)}>
            {auto ? "Arrêter la lecture" : "Lecture automatique"}
          </button>
        </div>
      </figure>

      <article className="wi-frame wi-cycle-panel">
        <div aria-live="polite" key={step} className="wi-cycle-read">
          <p className="wi-kicker">Étape {step} / {STEPS.length}</p>
          <h3 className="wi-h3 wi-cycle-title">{current.title}</h3>
          <p>{current.body}</p>
          <div className="wi-cycle-measure">
            <p className="wi-cycle-measure-k">Mesuré par</p>
            {measured.map((s) => (
              <p key={s.code} className="wi-cycle-src">
                <strong>{s.label}</strong>
                <span className={s.publishable ? "wi-cycle-state wi-cycle-state-on" : "wi-cycle-state wi-hatched"}>{s.stateLabel}</span>
              </p>
            ))}
          </div>
          {fact && typeof fact.value === "number" ? (
            <p className="wi-cycle-ctx">
              <span className="wi-cycle-measure-k">Repère France — contexte, hors pilote</span>
              {fact.label} : <strong>{fr(fact.value)} {fact.unit}</strong>
              {fact.period ? ` (${fact.period})` : ""}. Source : {fact.primary_source.name}.
            </p>
          ) : null}
          <p className="wi-cycle-key">
            <strong>Retenez — </strong>
            {current.key}
          </p>
        </div>
        <ol className="wi-cycle-list">
          {STEPS.map((s) => {
            const published = s.sources.some((code) => sources.find((x) => x.code === code)?.publishable);
            return (
              <li key={s.n}>
                <button type="button" aria-current={s.n === step ? "step" : undefined} onClick={() => choose(s.n)}>
                  <span className="wi-cycle-list-n">{s.n}</span>
                  <span className="wi-cycle-list-t">{s.title}</span>
                  <span className={published ? "wi-cycle-mk wi-cycle-mk-on" : "wi-cycle-mk wi-hatched"} aria-hidden="true" />
                  <span className="wi-cycle-list-s">{published ? "Publié" : "En attente"}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="wi-cycle-sum">
          Sur six étapes du cycle, {publishedSteps === 1 ? "une seule" : publishedSteps} est mesurée par une valeur publiée.
        </p>
      </article>
    </div>
  );
}
