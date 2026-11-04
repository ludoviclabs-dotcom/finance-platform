"use client";

/**
 * WiReperes.tsx — chapitre « Repères France » : le contexte national avant le
 * zoom sur la commune pilote, puis deux cas locaux sur la commune 34172.
 *
 * Ce composant ne porte AUCUN chiffre : il ne lit que les repères que
 * `publishableContextFacts()` laisse passer (revue signée, valeur relue dans sa
 * source primaire) et les cas locaux du même document. Un repère absent n'est
 * pas remplacé : son encart disparaît.
 *
 * Ces repères sont un CONTEXTE, jamais des données du pilote BNPE : ils ne se
 * mêlent ni au snapshot public, ni aux observations, ni à un calcul.
 */

import { useState, type ReactNode } from "react";

import type { WiContextFact, WiRestrictionYear } from "@/lib/water-intelligence/context-candidates";
import { WiTabs } from "./WiTabs";

export interface WiReperesProps {
  readonly facts: readonly WiContextFact[];
  /** `null` : le cas n'a pas passé sa propre vérification — rien n'est affiché. */
  readonly restrictions: {
    readonly years: readonly WiRestrictionYear[];
    readonly sourceName: string;
    readonly sourceUrl: string;
    readonly caveat: string;
  } | null;
  /** `null` : même règle que `restrictions`. */
  readonly pfas: {
    readonly analyses: readonly { readonly date: string; readonly value_ug_l: number }[];
    readonly limit: number;
    readonly unit: string;
    readonly parameterLabel: string;
    readonly sourceName: string;
    readonly sourceUrl: string;
    readonly caveat: string;
  } | null;
  readonly scale: readonly { readonly niveau: string; readonly effet: string }[];
}

function fr(value: number, digits?: number): string {
  return value.toLocaleString("fr-FR", digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function SourceLine({ fact }: { fact: WiContextFact }) {
  return (
    <p className="wi-rep-src">
      Source :{" "}
      {fact.primary_source.url ? (
        <a href={fact.primary_source.url} className="wi-link" rel="noopener noreferrer" target="_blank">
          {fact.primary_source.name}
        </a>
      ) : (
        fact.primary_source.name
      )}
      {fact.period ? ` · ${fact.period}` : ""} · {fact.geography.label}
    </p>
  );
}

function FactFigure({ fact, value, unit }: { fact: WiContextFact; value?: string; unit?: string }) {
  const shown = value ?? (typeof fact.value === "number" ? fr(fact.value) : fact.value);
  return (
    <div className="wi-frame wi-rep-fig">
      <div className="wi-rep-fig-value">
        {shown}
        <span className="wi-rep-fig-unit"> {unit ?? fact.unit}</span>
      </div>
      <p className="wi-rep-fig-label">{fact.label}</p>
      {fact.caveat ? <p className="wi-rep-fig-caveat">{fact.caveat}</p> : null}
      <SourceLine fact={fact} />
    </div>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="wi-rep-missing">{children}</p>;
}

/* ------------------------------------------------------------- Quantité */

function QuantitePanel({ get }: { get: (id: string) => WiContextFact | undefined }) {
  const r1 = get("ressource-renouv-1990");
  const r2 = get("ressource-renouv-2002");
  const p = get("prelev-total-2023");
  const bars = [r1, r2, p].filter((f): f is WiContextFact => Boolean(f && typeof f.value === "number"));
  const max = Math.max(...bars.map((b) => b.value as number), 1);
  const explore = [get("explore2-debit-ete-modere"), get("explore2-debit-ete-fort"), get("explore2-qmna")].filter(
    (f): f is WiContextFact => Boolean(f && typeof f.value === "number"),
  );
  const rendement = get("rendement-reseaux");
  const baisse = get("prelev-baisse-2008-2023");

  return (
    <div className="wi-rep-grid">
      <div className="wi-frame wi-rep-chart">
        <h3 className="wi-h4">Ressource renouvelable et prélèvements · Md m³ par an, même échelle</h3>
        {bars.length ? (
          <ul className="wi-rep-bars">
            {bars.map((b, i) => (
              <li key={b.id}>
                <span className="wi-rep-bar-label">
                  {b.label}
                  <span className="wi-rep-bar-period">{b.period}</span>
                </span>
                <span className="wi-rep-bar-track">
                  <span
                    className={`wi-rep-bar-fill ${b.id.startsWith("prelev") ? "wi-hatched" : ""}`}
                    style={{ width: `${(((b.value as number) / max) * 100).toFixed(1)}%`, animationDelay: `${100 + i * 120}ms` }}
                  />
                </span>
                <span className="wi-rep-bar-value">{fr(b.value as number)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Missing>Aucun repère de ressource publiable.</Missing>
        )}
        {r2 ? <SourceLine fact={r2} /> : null}
        {p ? <SourceLine fact={p} /> : null}
      </div>

      <div className="wi-frame wi-rep-chart">
        <h3 className="wi-h4">Débits en fin de siècle · Explore2, médianes</h3>
        {explore.length ? (
          <ul className="wi-rep-diverge">
            {explore.map((f, i) => (
              <li key={f.id}>
                <span className="wi-rep-bar-label">{f.label.replace(", fin de siècle", "")}</span>
                <span className="wi-rep-diverge-track" aria-hidden="true">
                  <span
                    className="wi-rep-diverge-fill"
                    style={{ width: `${Math.min(100, Math.abs(f.value as number) * 1.6).toFixed(1)}%`, animationDelay: `${100 + i * 120}ms` }}
                  />
                </span>
                <span className="wi-rep-bar-value">
                  {fr(f.value as number)} %
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Missing>Aucune projection publiable.</Missing>
        )}
        {explore[0] ? <SourceLine fact={explore[0]} /> : null}
        <p className="wi-rep-note">Débits naturels, hors gestion de l&apos;eau : une projection, pas une prévision.</p>
      </div>

      <div className="wi-rep-figs">
        {baisse ? <FactFigure fact={baisse} value={`${fr(baisse.value as number)}`} unit="%" /> : null}
        {rendement ? <FactFigure fact={rendement} /> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Usages */

const USES = [
  { key: "centrales", label: "Refroidissement des centrales", pr: "refroidissement des centrales", co: "refroidissement des centrales" },
  { key: "agriculture", label: "Agriculture", pr: "agriculture", co: "agriculture" },
  { key: "potable", label: "Eau potable", pr: "eau potable", co: "eau potable" },
  { key: "canaux", label: "Canaux de navigation", pr: "alimentation des canaux", co: null },
  { key: "autres", label: "Autres activités économiques", pr: "autres activités économiques", co: "industrie et autres activités" },
] as const;

function UsagesPanel({ get }: { get: (id: string) => WiContextFact | undefined }) {
  const [mode, setMode] = useState<"pr" | "co">("pr");
  const pr = get("usages-prelevement-2023");
  const co = get("usages-consommation-2023");
  const restitution = get("restitution-2023");
  const conso = get("consommation-2023");
  const saison = get("saisonnalite");
  if (!pr?.breakdown || !co?.breakdown) return <Missing>Répartition des usages non publiable.</Missing>;

  const circumference = 2 * Math.PI * 80;
  const shares = USES.map((u) => {
    const value = mode === "pr" ? pr.breakdown?.[u.pr] : u.co ? co.breakdown?.[u.co] : undefined;
    return typeof value === "number" ? value : 0;
  });
  /* Position de départ de chaque arc : la part cumulée des usages qui le
     précèdent dans l'ordre d'affichage — une position de dessin, pas un total
     présenté au lecteur. */
  const starts: number[] = [];
  for (let i = 0, acc = 0; i < shares.length; i += 1) {
    starts.push(acc);
    acc += shares[i];
  }
  const arcs = USES.map((u, i) => ({
    ...u,
    prValue: pr.breakdown?.[u.pr],
    coValue: u.co ? co.breakdown?.[u.co] : undefined,
    dash: `${Math.max((circumference * shares[i]) / 100 - (shares[i] > 0 ? 2 : 0), 0).toFixed(1)} ${circumference.toFixed(1)}`,
    offset: ((-circumference * starts[i]) / 100).toFixed(1),
  }));
  const total = mode === "pr" ? get("prelev-total-2023") : conso;

  return (
    <div className="wi-rep-grid">
      <div className="wi-frame wi-rep-chart wi-rep-usages">
        <div className="wi-seg" role="group" aria-label="Lecture des usages">
          <button type="button" aria-pressed={mode === "pr"} onClick={() => setMode("pr")}>
            Eau prélevée
          </button>
          <button type="button" aria-pressed={mode === "co"} onClick={() => setMode("co")}>
            Eau consommée
          </button>
        </div>
        <div className="wi-rep-donut-wrap">
          <svg viewBox="0 0 220 220" className="wi-rep-donut" role="img" aria-label={mode === "pr" ? "Répartition des prélèvements 2023 par usage" : "Répartition de la consommation 2023 par usage"}>
            <circle cx="110" cy="110" r="80" className="wi-rep-donut-track" />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="110"
                cy="110"
                r="80"
                transform="rotate(-90 110 110)"
                className={`wi-rep-donut-arc wi-rep-use-${a.key}`}
                style={{ strokeDasharray: a.dash, strokeDashoffset: a.offset }}
              />
            ))}
            {total && typeof total.value === "number" ? (
              <>
                <text x="110" y="106" textAnchor="middle" className="wi-rep-donut-big">
                  {fr(total.value)} Md m³
                </text>
                <text x="110" y="128" textAnchor="middle" className="wi-rep-donut-small">
                  {mode === "pr" ? "prélevés en 2023" : "consommés en 2023"}
                </text>
              </>
            ) : null}
          </svg>
          <table className="wi-rep-table">
            <thead>
              <tr>
                <th scope="col">Usage · 2023</th>
                <th scope="col">Prélevé</th>
                <th scope="col">Consommé</th>
              </tr>
            </thead>
            <tbody>
              {arcs.map((a) => (
                <tr key={a.key}>
                  <th scope="row">
                    <span className={`wi-rep-key wi-rep-use-${a.key}`} aria-hidden="true" />
                    {a.label}
                  </th>
                  <td data-on={mode === "pr" ? "true" : "false"}>{typeof a.prValue === "number" ? `${fr(a.prValue)} %` : "—"}</td>
                  <td data-on={mode === "co" ? "true" : "false"}>{typeof a.coValue === "number" ? `${fr(a.coValue)} %` : "non listé"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceLine fact={mode === "pr" ? pr : co} />
      </div>
      <div className="wi-rep-figs">
        {restitution ? <FactFigure fact={restitution} /> : null}
        {conso ? <FactFigure fact={conso} /> : null}
        {saison ? <FactFigure fact={saison} value={`≈ ${fr(saison.value as number)}`} /> : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Qualité */

function UnitGrid({ share, hatched }: { share: number; hatched?: boolean }) {
  return (
    <span className="wi-rep-units" aria-hidden="true">
      {Array.from({ length: 100 }, (_, i) => (
        <span key={i} className={i < Math.round(share) ? (hatched ? "wi-rep-unit wi-hatched" : "wi-rep-unit wi-rep-unit-on") : "wi-rep-unit"} />
      ))}
    </span>
  );
}

function QualitePanel({ get, pfas }: { get: (id: string) => WiContextFact | undefined; pfas: WiReperesProps["pfas"] }) {
  const surface = get("qualite-surface");
  const captages = get("captages-fermes-1980-2024");
  return (
    <div className="wi-rep-grid">
      {surface && typeof surface.value === "number" ? (
        <div className="wi-frame wi-rep-chart">
          <h3 className="wi-h4">Eaux de surface en bon état écologique</h3>
          <div className="wi-rep-unitrow">
            <UnitGrid share={surface.value} />
            <div>
              <div className="wi-rep-fig-value">{fr(surface.value)} %</div>
              <p className="wi-rep-fig-caveat">{surface.caveat}</p>
            </div>
          </div>
          <SourceLine fact={surface} />
        </div>
      ) : null}
      {pfas ? <PfasChart pfas={pfas} /> : null}
      <div className="wi-rep-figs">{captages ? <FactFigure fact={captages} /> : null}</div>
    </div>
  );
}

function PfasChart({ pfas }: { pfas: NonNullable<WiReperesProps["pfas"]> }) {
  const max = Math.max(pfas.limit, ...pfas.analyses.map((a) => a.value_ug_l));
  return (
      <div className="wi-frame wi-rep-chart">
        <h3 className="wi-h4">Montpellier · PFAS au robinet, contrôle sanitaire</h3>
        <svg viewBox="0 0 420 150" className="wi-rep-pfas" role="img" aria-label={`${pfas.analyses.length} analyses ${pfas.parameterLabel}, toutes comparées à la limite de ${fr(pfas.limit)} ${pfas.unit}`}>
          <line x1="40" x2="410" y1={130 - (pfas.limit / max) * 110} y2={130 - (pfas.limit / max) * 110} className="wi-rep-pfas-limit" />
          <text x="410" y={124 - (pfas.limit / max) * 110} textAnchor="end" className="wi-rep-pfas-limit-label">
            limite {fr(pfas.limit)} {pfas.unit}
          </text>
          <line x1="40" x2="410" y1="130" y2="130" className="wi-rep-pfas-axis" />
          {pfas.analyses.map((a, i) => {
            const x = 50 + (i * 350) / Math.max(pfas.analyses.length - 1, 1);
            const y = 130 - (a.value_ug_l / max) * 110;
            return <circle key={`${a.date}-${i}`} cx={x} cy={y} r={4.5} className="wi-rep-pfas-dot" style={{ animationDelay: `${i * 50}ms` }} />;
          })}
          <text x="40" y="146" className="wi-rep-pfas-axis-label">{pfas.analyses[0]?.date}</text>
          <text x="410" y="146" textAnchor="end" className="wi-rep-pfas-axis-label">{pfas.analyses[pfas.analyses.length - 1]?.date}</text>
        </svg>
        <p className="wi-rep-fig-caveat">{pfas.caveat}</p>
        <p className="wi-rep-src">
          Source :{" "}
          <a href={pfas.sourceUrl} className="wi-link" rel="noopener noreferrer" target="_blank">
            {pfas.sourceName}
          </a>
        </p>
      </div>
  );
}

/* --------------------------------------------------- Risques et coûts */

function RisquesPanel({ get, scale }: { get: (id: string) => WiContextFact | undefined; scale: WiReperesProps["scale"] }) {
  const catnat = get("catnat-cout");
  const prix = get("prix-eau-france");
  const prixRmc = get("prix-eau-rmc");
  const eauxUsees = get("depenses-eaux-usees-2023");
  const parts = catnat?.breakdown ? Object.entries(catnat.breakdown) : [];
  return (
    <div className="wi-rep-grid">
      {catnat && typeof catnat.value === "number" ? (
        <div className="wi-frame wi-rep-chart">
          <h3 className="wi-h4">Indemnisation des catastrophes naturelles</h3>
          <div className="wi-rep-fig-value">
            {fr(catnat.value)} <span className="wi-rep-fig-unit">{catnat.unit}</span>
          </div>
          <div className="wi-rep-stack" aria-hidden="true">
            {parts.map(([label, share], i) => (
              <span key={label} className={`wi-rep-stack-part wi-rep-stack-${i}`} style={{ width: `${share}%` }}>
                {label}
              </span>
            ))}
            <span className="wi-rep-stack-part wi-hatched" style={{ flex: 1 }} />
          </div>
          <ul className="wi-rep-stack-legend">
            {parts.map(([label, share]) => (
              <li key={label}>
                {label} : {fr(share)} %
              </li>
            ))}
          </ul>
          {catnat.caveat ? <p className="wi-rep-fig-caveat">{catnat.caveat}</p> : null}
          <SourceLine fact={catnat} />
        </div>
      ) : null}
      <div className="wi-frame wi-rep-chart">
        <h3 className="wi-h4">Échelle des restrictions d&apos;eau</h3>
        <ol className="wi-rep-ladder">
          {scale.map((step, i) => (
            <li key={step.niveau} data-level={i}>
              <span className="wi-rep-ladder-name">{step.niveau}</span>
              <span className="wi-rep-ladder-effect">{step.effet}</span>
            </li>
          ))}
        </ol>
        <p className="wi-rep-note">Pour un site, chaque marche est une hypothèse du pont financier : jours d&apos;interruption, capacité restante.</p>
      </div>
      <div className="wi-rep-figs">
        {prix ? <FactFigure fact={prix} /> : null}
        {prixRmc ? <FactFigure fact={prixRmc} /> : null}
        {eauxUsees ? <FactFigure fact={eauxUsees} /> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- Montpellier */

function MontpellierPanel({ restrictions }: { restrictions: NonNullable<WiReperesProps["restrictions"]> }) {
  const max = 366;
  return (
    <div className="wi-frame wi-rep-chart">
      <h3 className="wi-h4">Montpellier (34172) · jours sous restriction d&apos;eau, par année</h3>
      <ul className="wi-rep-years">
        {restrictions.years.map((y, i) => {
          const crise = y.days_crise;
          const renforcee = y.days_alerte_renforcee_or_higher - y.days_crise;
          const alerte = y.days_alerte_or_higher - y.days_alerte_renforcee_or_higher;
          const vigilance = y.days_vigilance_or_higher - y.days_alerte_or_higher;
          const partial = y.days_observed < 365;
          return (
            <li key={y.year}>
              <span className="wi-rep-year">
                {y.year}
                {partial ? <span className="wi-rep-bar-period"> partiel</span> : null}
              </span>
              <span className="wi-rep-yearbar" style={{ animationDelay: `${i * 40}ms` }}>
                {[
                  ["crise", crise],
                  ["renforcee", renforcee],
                  ["alerte", alerte],
                  ["vigilance", vigilance],
                ].map(([k, v]) =>
                  (v as number) > 0 ? (
                    <span key={k as string} className={`wi-rep-lvl wi-rep-lvl-${k}`} style={{ width: `${(((v as number) / max) * 100).toFixed(2)}%` }} />
                  ) : null,
                )}
              </span>
              <span className="wi-rep-bar-value" title="Jours au niveau alerte ou plus">
                {y.days_alerte_or_higher} j
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="wi-rep-lvl-legend">
        <li><span className="wi-rep-lvl wi-rep-lvl-crise" aria-hidden="true" />Crise</li>
        <li><span className="wi-rep-lvl wi-rep-lvl-renforcee" aria-hidden="true" />Alerte renforcée</li>
        <li><span className="wi-rep-lvl wi-rep-lvl-alerte" aria-hidden="true" />Alerte</li>
        <li><span className="wi-rep-lvl wi-rep-lvl-vigilance" aria-hidden="true" />Vigilance — une incitation, pas une restriction</li>
      </ul>
      <p className="wi-rep-fig-caveat">
        Le nombre à droite compte les jours de restriction effective, à partir du niveau alerte. {restrictions.caveat}
      </p>
      <p className="wi-rep-src">
        Source :{" "}
        <a href={restrictions.sourceUrl} className="wi-link" rel="noopener noreferrer" target="_blank">
          {restrictions.sourceName}
        </a>
      </p>
    </div>
  );
}

export function WiReperes({ facts, restrictions, pfas, scale }: WiReperesProps) {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const get = (id: string) => byId.get(id);
  return (
    <WiTabs
      label="Thèmes des repères France"
      tabs={[
        { id: "quantite", label: "Quantité", content: <QuantitePanel get={get} /> },
        { id: "usages", label: "Usages", content: <UsagesPanel get={get} /> },
        { id: "qualite", label: "Qualité", content: <QualitePanel get={get} pfas={pfas} /> },
        { id: "risques-couts", label: "Risques et coûts", content: <RisquesPanel get={get} scale={scale} /> },
        ...(restrictions
          ? [{ id: "montpellier", label: "Cas Montpellier", content: <MontpellierPanel restrictions={restrictions} /> }]
          : []),
      ]}
    />
  );
}
