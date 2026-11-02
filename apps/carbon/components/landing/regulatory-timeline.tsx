"use client";

/**
 * RegulatoryTimeline — contexte réglementaire de l'accueil (T8.2 §4 du
 * PLAN_ACTION_CSRD_2026-11).
 *
 * Remplace le paragraphe « La pression change de canal », qui datait d'avant
 * l'adoption de la norme volontaire et des ESRS 2026. Deux blocs :
 *   1. une frise des textes 2026-2028, avec un repère « aujourd'hui » ;
 *   2. trois canaux de pression (CSRD, norme volontaire, BEGES).
 *
 * Les statuts (« en vigueur », « dans N jours ») sont calculés à partir de la
 * date du jour APRÈS montage : le rendu serveur utilise la date d'état du droit,
 * ce qui évite tout écart d'hydratation. Une échéance de transposition passée
 * n'est jamais présentée comme une transposition faite.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

/** Date à laquelle les textes ci-dessous ont été vérifiés (dossier de maîtrise). */
export const STATE_OF_LAW = "2026-11-02";
const STATE_OF_LAW_LABEL = "2 novembre 2026";

type MilestoneKind = "vigueur" | "application" | "echeance" | "publication";

interface Milestone {
  date: string;
  display: string;
  title: string;
  reference: string;
  detail: string;
  kind: MilestoneKind;
}

export const MILESTONES: Milestone[] = [
  {
    date: "2026-03-18",
    display: "18 mars 2026",
    title: "Omnibus I en vigueur",
    reference: "Directive (UE) 2026/470",
    detail: "CSRD réservée aux entreprises de plus de 1 000 salariés et de 450 M€ de CA.",
    kind: "vigueur",
  },
  {
    date: "2026-09-24",
    display: "24 sept. 2026",
    title: "Norme volontaire en vigueur",
    reference: "Règl. délégué (UE) 2026/1560",
    detail: "L'ex-VSME devient la référence des PME et ETI de la chaîne de valeur.",
    kind: "vigueur",
  },
  {
    date: "2026-11-10",
    display: "10 nov. 2026",
    title: "ESRS 2026 en vigueur",
    reference: "Règl. délégué (UE) 2026/1563",
    detail: "Environ 61 % de points de données obligatoires en moins.",
    kind: "vigueur",
  },
  {
    date: "2027-01-01",
    display: "Exercice 2027",
    title: "ESRS 2026 obligatoires",
    reference: "Plafond chaîne de valeur",
    detail: "Un groupe CSRD ne peut plus exiger d'un fournisseur protégé plus que la norme volontaire.",
    kind: "application",
  },
  {
    date: "2027-03-19",
    display: "19 mars 2027",
    title: "Transposition française",
    reference: "Projet de loi DDADUE 2026",
    detail: "Date limite pour intégrer l'Omnibus au Code de commerce. Texte en cours d'examen.",
    kind: "echeance",
  },
  {
    date: "2028-01-01",
    display: "2028",
    title: "Premiers rapports vague 2",
    reference: "Exercice 2027",
    detail: "Publication des rapports des grandes entreprises restées dans le champ.",
    kind: "publication",
  },
];

const DAY_MS = 86_400_000;

function parseDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function milestoneStatus(m: Milestone, todayIso: string): { label: string; reached: boolean } {
  const days = Math.round((parseDay(m.date) - parseDay(todayIso)) / DAY_MS);
  const reached = days <= 0;
  if (m.kind === "echeance") {
    return reached
      ? { label: "Échéance passée", reached: true }
      : { label: days <= 60 ? `Dans ${days} jours` : "À venir", reached: false };
  }
  if (reached) {
    const label = m.kind === "vigueur" ? "En vigueur" : m.kind === "application" ? "Applicable" : "En cours";
    return { label, reached: true };
  }
  return { label: days <= 60 ? `Dans ${days} jours` : "À venir", reached: false };
}

/** Position du repère « aujourd'hui » sur la frise, en fraction de 0 à 1 (interpolation entre jalons). */
export function todayPosition(todayIso: string): number {
  const t = parseDay(todayIso);
  const points = MILESTONES.map((m) => parseDay(m.date));
  const last = points.length - 1;
  if (t <= points[0]) return 0;
  if (t >= points[last]) return 1;
  for (let i = 0; i < last; i++) {
    if (t >= points[i] && t < points[i + 1]) {
      const local = (t - points[i]) / (points[i + 1] - points[i]);
      return (i + local) / last;
    }
  }
  return 1;
}

function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2 nov. 2026 » — formatage manuel pour un rendu identique serveur et client. */
function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`;
}

const CHANNELS = [
  {
    tag: "CSRD",
    tone: "emerald",
    who: "Plus de 1 000 salariés et plus de 450 M€ de CA",
    what:
      "Rapport de durabilité selon les ESRS 2026, certifié par un commissaire aux comptes ou un OTI inscrit à la H2A. Exercice 2027, publié en 2028.",
    carbonco: "Datapoints ESRS, calcul GHG Protocol, dossier de preuves pour le vérificateur",
  },
  {
    tag: "Norme volontaire",
    tone: "cyan",
    who: "1 000 salariés ou moins, fournisseur d'un groupe soumis",
    what:
      "Vos clients vous interrogent au format de la norme volontaire. Pour leur rapport CSRD, ils ne peuvent exiger que ses points « nécessaires », à partir de l'exercice 2027.",
    carbonco: "Rapport norme volontaire et questionnaires fournisseurs",
  },
  {
    tag: "BEGES",
    tone: "amber",
    who: "Plus de 500 salariés en France",
    what:
      "Bilan GES tous les quatre ans. Les entreprises qui sortent de la CSRD perdent la dispense de la loi n° 2025-391 : leur bilan redevient dû.",
    carbonco: "Export BEGES selon la méthode v5 (6 catégories, 22 postes)",
  },
] as const;

const TONES: Record<(typeof CHANNELS)[number]["tone"], { chip: string; bar: string; dot: string }> = {
  emerald: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "from-emerald-500 to-emerald-300", dot: "bg-emerald-500" },
  cyan: { chip: "bg-cyan-50 text-cyan-700 border-cyan-200", bar: "from-cyan-500 to-cyan-300", dot: "bg-cyan-500" },
  amber: { chip: "bg-amber-50 text-amber-800 border-amber-200", bar: "from-amber-500 to-amber-300", dot: "bg-amber-500" },
};

export function RegulatoryTimeline() {
  const reduce = useReducedMotion();
  const [today, setToday] = useState(STATE_OF_LAW);
  useEffect(() => {
    setToday(todayIsoUtc());
  }, []);

  const position = todayPosition(today);
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <div>
      {/* ── Frise ─────────────────────────────────────────────── */}
      <div className="relative bg-white rounded-3xl border border-neutral-200/80 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_60px_-30px_rgba(5,150,105,0.25)] px-6 md:px-10 pt-10 pb-8 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ backgroundImage: "radial-gradient(circle at 12% 0%, rgba(16,185,129,0.07), transparent 45%), radial-gradient(circle at 95% 100%, rgba(8,145,178,0.06), transparent 40%)" }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3 mb-10">
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-neutral-500">
            Textes publiés au JOUE · 2026 → 2028
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <span className="relative flex h-2 w-2">
              {!reduce && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            État du droit vérifié au {STATE_OF_LAW_LABEL}
          </span>
        </div>

        {/* Desktop : frise horizontale */}
        <div className="relative hidden md:block">
          <div className="absolute left-[8.33%] right-[8.33%] top-[46px] h-[3px] rounded-full bg-neutral-200" aria-hidden />
          <motion.div
            className="absolute left-[8.33%] top-[46px] h-[3px] rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 origin-left"
            style={{ width: `calc(${position} * (100% - 16.66%))` }}
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 1.4, ease }}
            aria-hidden
          />
          {/* Repère « aujourd'hui » : pastille au-dessus de la rangée des dates, trait jusqu'à la frise. */}
          <motion.div
            className="absolute inset-y-0 -translate-x-1/2 pointer-events-none"
            style={{ left: `calc(8.33% + ${position} * (100% - 16.66%))` }}
            initial={reduce ? false : { opacity: 0, y: -6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reduce ? 0 : 1.3, duration: 0.5 }}
            aria-hidden
          >
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              Aujourd&apos;hui · {formatShortDate(today)}
            </span>
            <span className="absolute top-[26px] left-1/2 -translate-x-1/2 h-[42px] w-[2px] rounded-full bg-neutral-900/80" />
          </motion.div>

          <ol className="relative grid grid-cols-6">
            {MILESTONES.map((m, i) => {
              const status = milestoneStatus(m, today);
              return (
                <motion.li
                  key={m.date}
                  className="flex flex-col items-center text-center px-2"
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: reduce ? 0 : 0.15 + i * 0.12, duration: 0.55, ease }}
                >
                  <span className="text-xs font-mono font-semibold text-neutral-500 h-5">{m.display}</span>
                  <span className="relative mt-4 mb-6 flex h-6 w-6 items-center justify-center">
                    {status.reached && !reduce && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-emerald-400/30"
                        initial={{ scale: 0.6, opacity: 0 }}
                        whileInView={{ scale: 1.6, opacity: [0, 0.8, 0] }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + i * 0.12, duration: 1.2 }}
                      />
                    )}
                    <span
                      className={`relative h-4 w-4 rounded-full border-[3px] ${
                        status.reached ? "bg-emerald-500 border-white shadow-[0_0_0_2px_rgba(16,185,129,0.9)]" : "bg-white border-neutral-300"
                      }`}
                    />
                  </span>
                  <span
                    className={`mb-2 inline-block text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                      status.reached ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {status.label}
                  </span>
                  <span className="text-sm font-bold text-black leading-snug">{m.title}</span>
                  <span className="mt-1 text-[11px] font-mono text-emerald-800/80">{m.reference}</span>
                  <span className="mt-2 text-xs text-neutral-500 leading-relaxed">{m.detail}</span>
                </motion.li>
              );
            })}
          </ol>
        </div>

        {/* Mobile : frise verticale */}
        <ol className="relative md:hidden border-l-2 border-neutral-200 ml-2 space-y-7">
          {MILESTONES.map((m, i) => {
            const status = milestoneStatus(m, today);
            return (
              <motion.li
                key={m.date}
                className="relative pl-6"
                initial={reduce ? false : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: reduce ? 0 : i * 0.06, duration: 0.45, ease }}
              >
                <span
                  className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-[3px] ${
                    status.reached ? "bg-emerald-500 border-white shadow-[0_0_0_2px_rgba(16,185,129,0.9)]" : "bg-white border-neutral-300"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-neutral-500">{m.display}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                      status.reached ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="mt-1 text-sm font-bold text-black">{m.title}</div>
                <div className="text-[11px] font-mono text-emerald-800/80">{m.reference}</div>
                <div className="mt-1 text-xs text-neutral-500 leading-relaxed">{m.detail}</div>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {/* ── Trois canaux ──────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-5 mt-8">
        {CHANNELS.map((c, i) => {
          const tone = TONES[c.tone];
          return (
            <motion.article
              key={c.tag}
              className="group relative bg-white rounded-2xl border border-neutral-200 p-6 overflow-hidden transition-shadow duration-300 hover:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.25)]"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: reduce ? 0 : 0.1 + i * 0.12, duration: 0.55, ease }}
            >
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.bar} origin-left transition-transform duration-500 scale-x-50 group-hover:scale-x-100`} aria-hidden />
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider border rounded-full px-2.5 py-1 ${tone.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {c.tag}
              </span>
              <h3 className="mt-4 text-base font-bold text-black leading-snug">{c.who}</h3>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{c.what}</p>
              <div className="mt-5 pt-4 border-t border-dashed border-neutral-200 text-xs text-neutral-500">
                <span className="font-semibold text-neutral-800">CarbonCo prépare : </span>
                {c.carbonco}
              </div>
            </motion.article>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-neutral-400 text-center max-w-3xl mx-auto leading-relaxed">
        Sources : directive (UE) 2026/470, règlements délégués (UE) 2026/1560 et 2026/1563, loi n° 2025-391 du 30 avril 2025,
        article L.229-25 du Code de l&apos;environnement. En France, la transposition de l&apos;Omnibus est en cours :
        tant que la loi n&apos;est pas promulguée, le droit applicable reste celui de l&apos;ordonnance de 2023.{" "}
        <Link href="/guide-csrd-vsme-2026" className="underline hover:text-neutral-600">
          Lire le guide 2026
        </Link>
      </p>
    </div>
  );
}
