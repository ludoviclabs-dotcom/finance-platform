"use client";

import Link from "next/link";
import { useState } from "react";
import type { Actor, Chokepoint, Layer, SegmentId, Signal } from "@/lib/robotics/dataLoader";
import { Frame } from "@/components/materials/industry/Frame";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { QualityTag } from "./KeyFigure";
import { SEGMENT_LABEL, SEGMENT_ORDER, formatIsoDate } from "./labels";
import { PanelKicker, SectionHeading, useInView } from "./viz";

const pad = (n: number) => String(n).padStart(2, "0");
const DAY = 86_400_000;
const utc = (iso: string) => {
  const [y, m = 1, d = 1] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);
// Une échéance à moins d'un mois s'annonce en compte à rebours.
const SOON_DAYS = 30;
// En-têtes de la bande des couches : 42px pour trois carrés.
const SEGMENT_ABBR: Record<SegmentId, string> = { amont: "Amont", milieu: "Milieu", mecatronique: "Méca", aval: "Aval" };

interface Item {
  chokepoint: Chokepoint;
  ci: number;
  index: number;
  signal: Signal;
}

const smallCaps: React.CSSProperties = {
  fontSize: 11,
  lineHeight: "14px",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--ink-70)",
};

const ICON = (d: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/**
 * Les goulots d'étranglement en couloirs : les couches qu'ils touchent, puis
 * leurs signaux sur une frise datée, avec les échéances de revérification.
 *
 * `today` et `dueKeys` (« idGoulot:indexSignal ») sont calculés par la page au
 * rendu serveur, jamais à l'hydratation : un signal dont l'échéance est
 * atteinte est marqué « à revérifier » plutôt que présenté comme actuel.
 */
export default function ChokepointTimeline({
  chokepoints,
  layers,
  actors,
  today,
  dueKeys,
  revealDelay,
}: {
  chokepoints: Chokepoint[];
  /** Couches dans l'ordre de lecture (layersInReadingOrder). */
  layers: Pick<Layer, "id" | "name" | "order" | "segment">[];
  actors: Pick<Actor, "id" | "name">[];
  /** Date du rendu serveur, AAAA-MM-JJ. */
  today: string;
  dueKeys: string[];
  revealDelay?: number;
}) {
  const [frameRef, inView] = useInView<HTMLElement>();
  const due = new Set(dueKeys);
  const actorName = new Map(actors.map(a => [a.id, a.name]));

  const items: Item[] = chokepoints
    .flatMap((chokepoint, ci) => chokepoint.signals.map((signal, index) => ({ chokepoint, ci, index, signal })))
    .sort((a, b) => a.signal.date.localeCompare(b.signal.date));
  const keyOf = (it: Item) => `${it.chokepoint.id}:${it.index}`;
  const isDue = (it: Item) => due.has(keyOf(it));
  const withReview = items.filter(it => it.signal.review_by);
  const upcoming = withReview
    .filter(it => !isDue(it))
    .sort((a, b) => a.signal.review_by!.localeCompare(b.signal.review_by!));
  const overdue = withReview.filter(isDue);
  // Ouvre sur le signal le plus pressant : à revérifier, sinon la prochaine échéance.
  const urgent = overdue.at(-1) ?? upcoming[0] ?? items.at(-1) ?? null;

  const [sel, setSel] = useState<string | null>(urgent ? keyOf(urgent) : chokepoints[0] ? `lane:${chokepoints[0].id}` : null);
  const selItem = items.find(it => keyOf(it) === sel) ?? null;
  const selLane = sel?.startsWith("lane:") ? chokepoints.find(c => c.id === sel.slice(5)) ?? null : selItem?.chokepoint ?? null;
  const step = (dir: 1 | -1) => {
    if (items.length === 0) return;
    const at = selItem ? items.indexOf(selItem) : dir > 0 ? -1 : items.length;
    setSel(keyOf(items[(at + dir + items.length) % items.length]));
  };

  // Frise : de l'année précédant aujourd'hui à cinq mois après la dernière
  // échéance ; un signal plus ancien est épinglé au bord gauche avec son année.
  const todayYear = Number(today.slice(0, 4));
  const start = `${todayYear - 1}-01-01`;
  const lastDate = [today, ...withReview.map(it => it.signal.review_by!), ...items.map(it => it.signal.date)].sort().at(-1)!;
  const endDate = new Date(utc(lastDate) + 150 * DAY);
  const end = `${endDate.getUTCFullYear()}-${pad(endDate.getUTCMonth() + 1)}-01`;
  const pct = (iso: string) => ((utc(iso) - utc(start)) / (utc(end) - utc(start))) * 100;
  const years = Array.from({ length: Number(end.slice(0, 4)) - todayYear + 2 }, (_, i) => `${todayYear - 1 + i}-01-01`).filter(d => d <= end);
  const todayPct = pct(today);

  const segments = SEGMENT_ORDER.map(segment => ({ segment, layers: layers.filter(l => l.segment === segment) })).filter(s => s.layers.length > 0);
  const SQ = 12;
  const segWidth = (n: number) => n * SQ + (n - 1) * 3;

  const headline = overdue.length
    ? { strong: "À revérifier", text: `${overdue.length} signal${overdue.length > 1 ? "s" : ""} arrivé${overdue.length > 1 ? "s" : ""} à échéance` }
    : upcoming[0]
      ? { strong: `J-${daysBetween(today, upcoming[0].signal.review_by!)}`, text: `échéance du ${formatIsoDate(upcoming[0].signal.review_by!)} · ${upcoming[0].chokepoint.title}` }
      : null;

  const reviewLabel = (it: Item) => {
    const r = it.signal.review_by;
    if (!r) return null;
    if (isDue(it)) return `À revérifier depuis le ${formatIsoDate(r)}`;
    const left = daysBetween(today, r);
    return `Échéance ${formatIsoDate(r)} · dans ${left} j`;
  };

  const LANE_H = 80;
  const lanes = chokepoints.map((c, ci) => {
    const mine = items.filter(it => it.chokepoint.id === c.id);
    return (
      <div key={c.id} className="flex rb-fade" style={{ height: LANE_H, borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", animationDelay: `${0.1 + ci * 0.08}s` }}>
        <button
          type="button"
          className="rb-hit flex flex-col justify-center"
          aria-pressed={sel === `lane:${c.id}`}
          onClick={() => setSel(`lane:${c.id}`)}
          style={{ flex: "0 0 220px", gap: 2, padding: "0 12px 0 10px", boxSizing: "border-box" }}
        >
          <span className="flex items-baseline" style={{ gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>{pad(ci + 1)}</span>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, lineHeight: "18px", letterSpacing: ".02em", textTransform: "uppercase" }}>{c.title}</span>
          </span>
          <span style={{ paddingLeft: 26, fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>
            {c.actor_ids.length} acteurs · {mine.length ? `${mine.length} signal${mine.length > 1 ? "s" : ""}` : "aucun signal"}
          </span>
        </button>
        <div className="flex items-center" style={{ flex: "0 0 auto", marginLeft: 20, gap: 10 }}>
          {segments.map(s => (
            <span key={s.segment} className="flex" style={{ gap: 3 }}>
              {s.layers.map(l => {
                const hit = c.layer_ids.includes(l.id);
                return (
                  <i
                    key={l.id}
                    className="rb-pop"
                    title={`${pad(l.order)} · ${l.name}`}
                    style={{
                      display: "block",
                      width: SQ,
                      height: SQ,
                      boxSizing: "border-box",
                      background: hit ? "var(--mx-tier-high)" : "transparent",
                      border: `1px solid ${hit ? "var(--mx-tier-high)" : "color-mix(in srgb, var(--color-text) 22%, transparent)"}`,
                      animationDelay: `${0.3 + ci * 0.08 + l.order * 0.02}s`,
                    }}
                  />
                );
              })}
            </span>
          ))}
          <span className="sr-only">Couches touchées : {c.layer_ids.map(id => layers.find(l => l.id === id)?.name ?? id).join(", ")}</span>
        </div>
        <div style={{ position: "relative", flex: "1 1 400px", marginLeft: 20, height: LANE_H }}>
          <i style={{ position: "absolute", left: 0, right: 0, top: 40, height: 1, background: mine.length ? "color-mix(in srgb, var(--color-text) 30%, transparent)" : "color-mix(in srgb, var(--color-text) 12%, transparent)" }} />
          <i className="rb-grow" style={{ position: "absolute", left: `${todayPct}%`, top: 0, width: 1.5, height: LANE_H, background: "var(--color-accent-700)", transformOrigin: "top", animationDelay: ".5s" }} />
          {mine
            .filter(it => it.signal.review_by)
            .map(it => {
              const r = it.signal.review_by!;
              const from = Math.max(0, pct(it.signal.date));
              const to = pct(r);
              const left = daysBetween(today, r);
              const overdueFlag = isDue(it);
              const soon = !overdueFlag && left <= SOON_DAYS;
              const strong = overdueFlag || soon;
              return (
                <span key={`flag-${keyOf(it)}`}>
                  <i style={{ position: "absolute", left: `${from}%`, width: `${to - from}%`, top: 39, height: 3, background: "repeating-linear-gradient(90deg, var(--color-accent) 0 5px, transparent 5px 9px)" }} />
                  <i style={{ position: "absolute", left: `${to}%`, top: 20, width: 1, height: 20, background: "var(--color-text)" }} />
                  <i
                    style={{
                      position: "absolute",
                      left: `calc(${to}% - 5px)`,
                      top: 35,
                      width: 10,
                      height: 10,
                      boxSizing: "border-box",
                      transform: "rotate(45deg)",
                      background: strong ? "var(--color-text)" : "var(--color-bg)",
                      border: "1.5px solid var(--color-text)",
                    }}
                  />
                  {strong && (
                    <i className="rb-ping" style={{ position: "absolute", left: `calc(${to}% - 6px)`, top: 34, width: 12, height: 12, boxSizing: "border-box", borderRadius: "50%", border: "1.5px solid var(--color-text)" }} />
                  )}
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      // À gauche du drapeau, l'étiquette laisse passer la ligne « aujourd'hui ».
                      left: soon ? `calc(${to}% - 12px)` : `calc(${to}% + 6px)`,
                      transform: soon ? "translateX(-100%)" : undefined,
                      fontSize: 11,
                      lineHeight: "14px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      color: strong ? "var(--color-text)" : "var(--color-accent-700)",
                      fontFeatureSettings: "'tnum' 1",
                    }}
                  >
                    {overdueFlag ? "À revérifier" : soon ? `Échéance J-${left}` : formatIsoDate(r)}
                  </span>
                </span>
              );
            })}
          {mine.map(it => {
            const raw = pct(it.signal.date);
            const early = raw < 0;
            const label = `${formatIsoDate(it.signal.date)} — ${it.signal.text}`;
            return (
              <span key={keyOf(it)}>
                <button
                  type="button"
                  className="rb-dot rb-pop"
                  aria-pressed={sel === keyOf(it)}
                  aria-label={label}
                  title={label}
                  onClick={() => setSel(keyOf(it))}
                  style={{ position: "absolute", top: 28, left: `calc(${early ? 0 : raw}% - ${early ? 6 : 12}px)`, width: 24, height: 24, animationDelay: `${0.6 + items.indexOf(it) * 0.08}s` }}
                >
                  <i style={{ background: it.signal.provenance.data_quality === "verified" ? "var(--color-accent-700)" : "var(--color-bg)", border: "2px solid var(--color-accent-700)" }} />
                </button>
                {early && (
                  <span style={{ position: "absolute", left: 0, top: 56, fontSize: 11, lineHeight: "14px", color: "var(--ink-70)" }}>
                    ‹ {it.signal.date.slice(0, 4)}
                  </span>
                )}
              </span>
            );
          })}
          {mine.length === 0 && (
            <span style={{ position: "absolute", left: 0, top: 46, fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>Aucun signal daté et sourcé retenu à ce jour.</span>
          )}
        </div>
      </div>
    );
  });

  // ── Bandeau de lecture ─────────────────────────────────────────────────
  const lane = selLane;
  const reading = lane && (
    <div className="flex flex-wrap" style={{ gap: "20px 32px", paddingTop: 22 }} aria-live="polite">
      <div style={{ flex: "1 1 200px", maxWidth: 240 }}>
        <PanelKicker>{selItem ? `${pad(selItem.ci + 1)} · signal daté` : `Goulot ${pad(chokepoints.indexOf(lane) + 1)} / ${pad(chokepoints.length)}`}</PanelKicker>
        <span style={{ display: "block", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 40, lineHeight: "40px", fontFeatureSettings: "'tnum' 1" }}>
          {selItem ? formatIsoDate(selItem.signal.date) : `${lane.signals.length} signal${lane.signals.length > 1 ? "s" : ""}`}
        </span>
        {selItem && (
          <span className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
            <QualityTag quality={selItem.signal.provenance.data_quality} />
            {reviewLabel(selItem) && (
              <span className={isDue(selItem) || daysBetween(today, selItem.signal.review_by!) <= SOON_DAYS ? "ind-tag ind-tag-neutral" : "ind-tag ind-tag-outline"} style={{ fontWeight: 600 }}>
                {reviewLabel(selItem)}
              </span>
            )}
          </span>
        )}
        {items.length > 0 && (
          <span className="flex items-center" style={{ gap: 4, marginTop: 14 }}>
            <button type="button" className="rb-ib" onClick={() => step(-1)} aria-label="Signal précédent">
              {ICON("m15 18-6-6 6-6")}
            </button>
            <button type="button" className="rb-ib" onClick={() => step(1)} aria-label="Signal suivant">
              {ICON("m9 18 6-6-6-6")}
            </button>
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
              {selItem ? `${items.indexOf(selItem) + 1} / ${items.length}` : `${items.length} signaux`}
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0" style={{ flex: "999 1 320px" }}>
        <PanelKicker>{lane.title}</PanelKicker>
        <p style={{ margin: 0, fontSize: 18, lineHeight: "27px", maxWidth: "60ch" }}>{selItem ? selItem.signal.text : lane.issue}</p>
        {!selItem && lane.signals.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>Choisir un point de la frise pour lire le signal.</p>
        )}
      </div>
      <div className="min-w-0" style={{ flex: "1 1 280px", borderLeft: "1px solid var(--color-divider)", paddingLeft: 24 }}>
        <PanelKicker>{selItem ? "Le goulot" : "Couches touchées"}</PanelKicker>
        {selItem && <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: "20px", color: "var(--ink-78)" }}>{lane.issue}</p>}
        <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 8 }}>
          {lane.layer_ids.map(id => {
            const l = layers.find(x => x.id === id);
            return (
              <Link key={id} href={`/robotics/${id}`} className="ind-tag ind-tag-neutral">
                {l ? `${pad(l.order)} · ${l.name}` : id}
              </Link>
            );
          })}
        </div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>{lane.actor_ids.map(id => actorName.get(id) ?? id).join(", ")}</p>
      </div>
    </div>
  );

  return (
    <Section id="goulots" revealDelay={revealDelay}>
      <SectionKicker>06 · Goulots d’étranglement</SectionKicker>
      <SectionHeading
        title="Là où la chaîne peut casser"
        lead="Les points de contrôle, les couches qu’ils touchent et leurs signaux datés. Un signal arrivé à échéance passe « à revérifier » au lieu d’être présenté comme actuel."
        aside={
          headline && (
            <div className="flex items-center" style={{ gap: 12, padding: "10px 14px", border: "1px solid var(--color-accent)", maxWidth: 420 }}>
              <span aria-hidden="true" style={{ position: "relative", display: "inline-block", flex: "0 0 auto", width: 10, height: 10 }}>
                <i style={{ position: "absolute", inset: 0, background: "var(--color-text)", transform: "rotate(45deg)" }} />
              </span>
              <span style={{ fontSize: 14, lineHeight: "20px" }}>
                <b style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 600 }}>{headline.strong}</b> · {headline.text}
              </span>
            </div>
          )
        }
      />
      <Frame ref={frameRef} className={inView ? "rb-play" : undefined} style={{ padding: 24 }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 858 }}>
            <div className="flex items-end" style={{ height: 52, borderBottom: "1px solid var(--color-divider)" }}>
              <span style={{ ...smallCaps, flex: "0 0 220px", padding: "0 0 10px 10px", boxSizing: "border-box" }}>Goulot</span>
              <span className="flex" style={{ flex: "0 0 auto", marginLeft: 20, gap: 10, paddingBottom: 10 }}>
                {segments.map(s => (
                  <span key={s.segment} style={{ ...smallCaps, fontSize: 9, letterSpacing: ".04em", width: segWidth(s.layers.length), overflow: "hidden", whiteSpace: "nowrap" }} title={SEGMENT_LABEL[s.segment]}>
                    {SEGMENT_ABBR[s.segment]}
                  </span>
                ))}
              </span>
              <div style={{ position: "relative", flex: "1 1 400px", marginLeft: 20, height: 52 }}>
                {years.map(y => (
                  <span key={y} style={{ ...smallCaps, position: "absolute", left: `${pct(y)}%`, bottom: 10, paddingLeft: 6, borderLeft: "1px solid color-mix(in srgb, var(--color-text) 30%, transparent)" }}>
                    {y.slice(0, 4)}
                  </span>
                ))}
                <span style={{ position: "absolute", left: `${todayPct}%`, top: 2, transform: "translateX(-50%)", fontSize: 11, lineHeight: "14px", fontWeight: 600, color: "var(--color-accent-700)", whiteSpace: "nowrap" }}>
                  Aujourd’hui · {formatIsoDate(today)}
                </span>
              </div>
            </div>
            {lanes}
          </div>
        </div>
        {reading}
      </Frame>
    </Section>
  );
}
