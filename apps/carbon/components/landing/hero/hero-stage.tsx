/**
 * Carbon & Co — Hero stage (cadre éditorial + avatar Sculpt + chips flottants)
 * Port du design Anthropic (Hero Refonte.html).
 */

"use client";

import { HeroAvatarSculpt } from "./hero-avatar-sculpt";
import styles from "./hero-stage.module.css";

const ACCENT = {
  c: "#059669",
  deep: "#14532D",
  soft: "#E7F4EE",
};

function Bracket({ rotation = 0, position }: { rotation?: number; position: string }) {
  return (
    <svg
      className={`absolute ${position}`}
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path d="M1 8 V1 H8" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  );
}

function NeuralBadge() {
  return (
    <div className={`${styles.chipLine} rounded-2xl pl-3 pr-4 py-2.5 flex items-center gap-3 shadow-[0_10px_30px_-12px_rgba(20,30,25,.25)]`}>
      <div
        className="relative w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: ACCENT.soft }}
      >
        <span className={`absolute inset-0 rounded-full ${styles.pulseDot}`} style={{ background: ACCENT.c, opacity: 0.18 }} />
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke={ACCENT.c} strokeWidth="2.2">
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[12px] font-bold tracking-tight text-[#0F172A]">NEURAL Actif</div>
        <div className={`text-[10.5px] ${styles.fontMono} text-neutral-500`}>v2.4 · ESRS native</div>
      </div>
    </div>
  );
}

function CoverageBadge() {
  return (
    <div className={`${styles.chipLine} rounded-2xl px-4 py-3 shadow-[0_10px_30px_-12px_rgba(20,30,25,.22)]`}>
      <div className="flex items-center justify-between gap-6 mb-1.5">
        <div className="font-display font-bold text-[19px] text-[#0F172A]">ESRS&nbsp;E1</div>
        <div className={`${styles.fontMono} text-[10.5px] text-neutral-500`}>
          67<span className="text-neutral-400">/100</span>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-semibold mb-2">Couverture climat</div>
      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: "67%", background: "linear-gradient(90deg, #14532D, #059669)" }} />
      </div>
    </div>
  );
}

function ReportPill() {
  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-[0_14px_30px_-10px_rgba(5,80,40,.45)] flex items-center gap-2.5"
      style={{ background: ACCENT.deep, color: "#fff" }}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
      <div className="leading-tight">
        <div className="text-[12px] font-bold">Rapport E1 généré</div>
        <div className={`text-[10.5px] ${styles.fontMono} opacity-80`}>il y a 3 minutes</div>
      </div>
    </div>
  );
}

function MethodChip() {
  return (
    <div className={`${styles.chipLine} rounded-xl px-3 py-2 flex items-center gap-2 shadow-[0_8px_20px_-10px_rgba(20,30,25,.2)]`}>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <div className={`${styles.fontMono} text-[10.5px] tracking-wide text-neutral-700`}>EFRAG · GHG · ADEME</div>
    </div>
  );
}

export function HeroStage() {
  return (
    <div className={styles.stageWrap}>
      {/* Editorial brackets */}
      <Bracket position="-top-3 -left-3" />
      <Bracket position="-top-3 -right-3" rotation={90} />
      <Bracket position="-bottom-3 -left-3" rotation={-90} />
      <Bracket position="-bottom-3 -right-3" rotation={180} />

      {/* Top label rule */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT.c }} />
          <div className={`${styles.fontMono} text-[10.5px] tracking-[0.22em] uppercase text-neutral-600`}>
            Neural · Assistant ESG
          </div>
        </div>
        <div className={`${styles.fontMono} text-[10.5px] tracking-[0.18em] text-neutral-400`}>PLATE 01 / 04</div>
      </div>

      {/* The card */}
      <div className={styles.stageCard}>
        {/* Corner ticks */}
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute top-3 left-6 right-6 h-1.5 ${styles.ticks} opacity-50`} />
          <div className={`absolute bottom-3 left-6 right-6 h-1.5 ${styles.ticks} opacity-40`} />
        </div>

        {/* Soft accent halo behind subject */}
        <div className={`absolute inset-x-10 top-12 bottom-16 pointer-events-none ${styles.accentHalo}`} />

        {/* Plinth shadow */}
        <div className={`absolute left-1/2 -translate-x-1/2 bottom-[14%] w-[55%] h-6 ${styles.plinthShadow}`} />

        {/* Subject */}
        <div className={`relative aspect-[5/6] w-full p-6 ${styles.grain}`}>
          <div className="absolute inset-0 flex items-end justify-center">
            <div className={`${styles.floaty} w-[88%] h-full`}>
              <HeroAvatarSculpt />
            </div>
          </div>

          {/* Museum tag */}
          <div className="absolute left-5 bottom-5 right-5 flex items-end justify-between">
            <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2 border border-[#E5E2D9]">
              <div className={`${styles.fontMono} text-[9.5px] tracking-[0.25em] uppercase text-neutral-500`}>Édition</div>
              <div className="font-display font-semibold text-[13px] text-neutral-900">Neural · Carbon&amp;Co</div>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-lg px-3 py-2 border border-[#E5E2D9] text-right">
              <div className={`${styles.fontMono} text-[9.5px] tracking-[0.25em] uppercase text-neutral-500`}>
                Dernière analyse
              </div>
              <div className={`${styles.fontMono} text-[11px] text-neutral-800`}>14:32 · UTC+1</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className={`${styles.fontMono} text-[10.5px] tracking-[0.18em] text-neutral-400`}>
          RÉF · NRL-SCULPT-EME
        </div>
        <div className={`${styles.fontMono} text-[10.5px] tracking-[0.18em] text-neutral-400`}>EU · VERCEL/NEON</div>
      </div>

      {/* Floating chips */}
      <div className={`absolute -top-1 -left-6 lg:-left-12 ${styles.floaty2} z-20`}>
        <NeuralBadge />
      </div>
      <div className={`absolute top-1/3 -right-6 lg:-right-10 ${styles.floaty3} z-20`}>
        <ReportPill />
      </div>
      <div className={`absolute -bottom-2 -left-2 lg:-left-10 ${styles.floaty} z-20`}>
        <CoverageBadge />
      </div>
      <div className={`absolute -bottom-6 right-8 ${styles.floaty2} z-20`}>
        <MethodChip />
      </div>
    </div>
  );
}
