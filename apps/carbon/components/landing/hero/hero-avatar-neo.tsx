/**
 * Carbon & Co — Néo, l'avatar Carbon&Co (composite V2 retenu)
 * Port fidèle depuis la source Claude Design (« Avatar Neural — Explorations »,
 * carte 2a + support.js — pas le bundle standalone minifié utilisé au premier
 * essai). Visage 1d (expressions) + corps 1a (Sculpt v2) + orbite 1b (énergie).
 *
 * 4 états produit qui cyclent automatiquement (5s/état, comme la source) :
 * repos → analyse → prêt → alerte. Au survol : la carte s'incline vers le
 * curseur, le regard le suit, et 4 annotations produit apparaissent autour
 * de l'avatar. Un clignement des yeux (150 ms toutes les 3.6s) tourne en
 * continu, indépendamment du cycle d'états.
 *
 * Écart assumé : la source pilote l'avatar via une classe de composant
 * (DCLogic) qui mute le DOM impérativement à chaque frame ; ici la même
 * logique est portée en hooks React (refs pour l'orbite — mutation directe du
 * style hors re-render, exactement comme la source — état React pour le
 * reste). Les rayons d'orbite (jusqu'à 232 unités) sont mis à l'échelle au
 * rendu réel via ResizeObserver, la source étant conçue pour une boîte figée
 * à 340×350 px.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import styles from "./hero-avatar-neo.module.css";

type NeoState = "repos" | "analyse" | "pret" | "alerte";

const STATES: NeoState[] = ["repos", "analyse", "pret", "alerte"];

/** accent · couleur de l'iris (pupille) · multiplicateur de vitesse d'orbite — valeurs exactes de support.js */
const STATE_META: Record<NeoState, { accent: string; eye: string; orbitMult: number }> = {
  repos: { accent: "#059669", eye: "#FFFFFF", orbitMult: 1 },
  analyse: { accent: "#7DD9B4", eye: "#EAFFF6", orbitMult: 2.4 },
  pret: { accent: "#059669", eye: "#FFFFFF", orbitMult: 0.65 },
  alerte: { accent: "#E8930C", eye: "#FFE7C2", orbitMult: 1.5 },
};

const CYCLE_MS = 5000; // cycleSec par défaut de la source
const BLINK_INTERVAL_MS = 3600;
const BLINK_DURATION_MS = 150;
const DESIGN_WIDTH = 340; // largeur de référence du SVG source — met à l'échelle l'orbite

/** Orbite 3D (rayon, inclinaison du plan, rotation Z, vitesse de base) — port exact du tableau ORB de support.js. */
const ORB = [
  { R: 210, tilt: 0.14, rot: -0.1, speed: 0.55, size: 26 },
  { R: 185, tilt: 0.79, rot: 0.35, speed: 0.42, size: 18 },
  { R: 232, tilt: 1.26, rot: -0.44, speed: 0.33, size: 14 },
];
const INITIAL_ANGLES = [0.4, 2.5, 4.6];

const ANNOTATIONS: { top: string; left?: string; right?: string; tick?: number; label: string }[] = [
  { top: "0.6%", left: "52.9%", tick: 20, label: "LIAISON TEMPS RÉEL · ZONE UE" },
  { top: "28%", left: "81.2%", tick: 16, label: "NEURAL v2.4 · ESRS NATIVE" },
  { top: "69.7%", right: "22.9%", label: "MOTEUR GES · SCOPES 1–3" },
  { top: "88%", left: "78.2%", tick: 14, label: "FLUX · EFRAG · GHG · ADEME" },
];

function orbitTransform(angle: number, o: (typeof ORB)[number], scale: number) {
  const x = o.R * Math.cos(angle);
  const z = o.R * Math.sin(angle);
  const y = z * Math.sin(o.tilt);
  const zd = z * Math.cos(o.tilt);
  const X = x * Math.cos(o.rot) - y * Math.sin(o.rot);
  const Y = x * Math.sin(o.rot) + y * Math.cos(o.rot);
  const sc = 1 + (zd / o.R) * 0.22;
  return {
    transform: `translate(-50%, -50%) translate(${(X * scale).toFixed(1)}px, ${(Y * scale).toFixed(1)}px) scale(${sc.toFixed(3)})`,
    zIndex: zd > 0 ? 8 : 2,
    opacity: zd > 0 ? 1 : 0.72,
  };
}

export function HeroAvatarNeo() {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<NeoState>("repos");
  const [hover, setHover] = useState(false);
  const [blink, setBlink] = useState(false);
  const [pointer, setPointer] = useState({ mx: 0, my: 0 }); // -1..1, position curseur normalisée

  const stateRef = useRef(state);
  stateRef.current = state;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const particleRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const scaleRef = useRef(1);
  const angleRef = useRef([...INITIAL_ANGLES]);

  // Cycle des 4 états.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      setState((s) => STATES[(STATES.indexOf(s) + 1) % STATES.length]);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  // Clignement — minuteur indépendant du cycle d'états.
  useEffect(() => {
    if (prefersReducedMotion) return;
    let hideTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setBlink(true);
      hideTimer = setTimeout(() => setBlink(false), BLINK_DURATION_MS);
    }, BLINK_INTERVAL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(hideTimer);
    };
  }, [prefersReducedMotion]);

  // Échelle réelle de la boîte (340px de référence) — l'orbite en dépend à chaque frame.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    scaleRef.current = el.getBoundingClientRect().width / DESIGN_WIDTH;
    const ro = new ResizeObserver(([entry]) => {
      scaleRef.current = entry.contentRect.width / DESIGN_WIDTH;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Orbite — mutation directe du style hors re-render React, comme la source (perf : 60 fps sans setState).
  useEffect(() => {
    if (prefersReducedMotion) {
      ORB.forEach((o, k) => {
        const el = particleRefs[k].current;
        if (!el) return;
        const t = orbitTransform(angleRef.current[k], o, scaleRef.current || 1);
        el.style.transform = t.transform;
        el.style.opacity = String(t.opacity);
        el.style.zIndex = String(t.zIndex);
      });
      return;
    }
    let raf: number;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const mult = STATE_META[stateRef.current].orbitMult;
      const scale = scaleRef.current || 1;
      ORB.forEach((o, k) => {
        angleRef.current[k] += dt * o.speed * mult;
        const el = particleRefs[k].current;
        if (!el) return;
        const t = orbitTransform(angleRef.current[k], o, scale);
        el.style.transform = t.transform;
        el.style.opacity = String(t.opacity);
        el.style.zIndex = String(t.zIndex);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  const meta = STATE_META[state];
  const pupilShown = state !== "pret";
  const pupilRy = blink ? 1 : 8; // ouvert = 8 (rond) ; un clignement de 150 ms le ramène à 1
  const isAnalyse = state === "analyse";
  const isPret = state === "pret";
  const isAlerte = state === "alerte";
  const animClass = (cls: string) => (prefersReducedMotion ? "" : cls);

  const activeHover = hover && !prefersReducedMotion;
  const tilt = activeHover
    ? `rotateY(${(pointer.mx * 10).toFixed(1)}deg) rotateX(${(-pointer.my * 8).toFixed(1)}deg)`
    : "rotateY(0deg) rotateX(0deg)";
  const eyeDX = activeHover ? +(pointer.mx * 8).toFixed(1) : 0;
  const eyeDY = activeHover ? +(pointer.my * 5).toFixed(1) : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPointer({
      mx: ((e.clientX - r.left) / r.width - 0.5) * 2,
      my: ((e.clientY - r.top) / r.height - 0.5) * 2,
    });
  };
  const handleMouseLeave = () => {
    setHover(false);
    setPointer({ mx: 0, my: 0 });
  };

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ perspective: 1100 }}>
      <div
        ref={wrapperRef}
        className="relative w-full max-w-full max-h-full aspect-[340/350]"
        onMouseEnter={() => setHover(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div style={{ transform: tilt, transition: "transform 0.25s ease-out", transformStyle: "preserve-3d", width: "100%", height: "100%", position: "relative" }}>
          <div className={`${animClass(styles.floaty)} w-full h-full relative`}>
            <svg
              viewBox="0 0 340 350"
              className="relative z-[5] w-full h-full"
              aria-label="Néo — assistant Carbon&Co"
            >
              <defs>
                <linearGradient id="neoVisor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#232B29" />
                  <stop offset="0.6" stopColor="#101815" />
                  <stop offset="1" stopColor="#0A100E" />
                </linearGradient>
                <radialGradient id="neoEye">
                  <stop offset="0" stopColor="#FFFFFF" />
                  <stop offset="0.3" stopColor="#059669" />
                  <stop offset="1" stopColor="#059669" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="neoHalo">
                  <stop offset="0" stopColor="#059669" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#059669" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="neoBodyG" x1="0.3" y1="0" x2="0.7" y2="1">
                  <stop offset="0" stopColor="#2A2F2C" />
                  <stop offset="1" stopColor="#101614" />
                </linearGradient>
              </defs>

              <ellipse cx="170" cy="172" rx="165" ry="160" fill="url(#neoHalo)" />
              <ellipse cx="170" cy="338" rx="105" ry="10" fill="#000000" opacity="0.16" />

              {/* Antenne */}
              <line x1="170" y1="20" x2="170" y2="46" stroke="#1A1F1D" strokeWidth="3" strokeLinecap="round" />
              <circle cx="170" cy="14" r="6.5" fill={meta.accent} className={animClass(styles.antennaLed)} />

              {/* Oreilles */}
              <rect x="28" y="88" width="18" height="56" rx="9" fill="#1A1F1D" />
              <rect x="294" y="88" width="18" height="56" rx="9" fill="#1A1F1D" />
              <circle cx="37" cy="116" r="2.2" fill={meta.accent} />
              <circle cx="303" cy="116" r="2.2" fill={meta.accent} />

              {/* Tête / visière */}
              <rect x="50" y="50" width="240" height="132" rx="64" fill="#050807" />
              <rect x="56" y="56" width="228" height="120" rx="58" fill="url(#neoVisor)" />
              <rect x="64" y="63" width="212" height="18" rx="9" fill="#FFFFFF" opacity="0.07" />

              {/* Bouche */}
              <path
                d="M 76 166 C 112 178, 228 178, 264 166"
                stroke={meta.accent}
                strokeWidth="1.4"
                fill="none"
                opacity="0.4"
                style={{ transition: "stroke 0.5s" }}
              />

              {/* Yeux + expressions — le groupe entier suit le curseur au survol (regard) */}
              <g transform={`translate(${eyeDX} ${eyeDY})`}>
                <circle cx="135" cy="114" r="20" fill="url(#neoEye)" />
                <circle cx="205" cy="114" r="20" fill="url(#neoEye)" />

                {/* Pupille — masquée seulement en "prêt" (remplacée par le sourire) */}
                <g opacity={pupilShown ? 1 : 0}>
                  <ellipse cx="135" cy="114" rx="8" ry={pupilRy} fill={meta.eye} />
                  <ellipse cx="205" cy="114" rx="8" ry={pupilRy} fill={meta.eye} />
                </g>

                {/* Sourcils souriants (prêt) */}
                <g opacity={isPret ? 1 : 0} stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none">
                  <path d="M 118 120 Q 135 100 152 120" />
                  <path d="M 188 120 Q 205 100 222 120" />
                </g>

                {/* Sourcils alerte (obliques, ambre) */}
                <g opacity={isAlerte ? 1 : 0} stroke="#FFB35C" strokeWidth="3.5" strokeLinecap="round">
                  <line x1="121" y1="90" x2="147" y2="97" />
                  <line x1="219" y1="90" x2="193" y2="97" />
                </g>
              </g>

              {/* Scan (analyse) */}
              <rect
                x="78" y="108" width="30" height="4" rx="2" fill="#EAFFF6"
                opacity={isAnalyse ? 1 : 0}
                className={animClass(styles.scanBar)}
              />

              {/* Barres d'activité (analyse) */}
              <g opacity={isAnalyse ? 1 : 0} style={{ transition: "opacity 0.4s" }}>
                {[142, 150, 158, 166, 174, 182].map((x, i) => (
                  <rect
                    key={x}
                    x={x} y="142" width="4" height="15" rx="2" fill={meta.accent}
                    className={animClass(styles.waveBar)}
                    style={{ animationDelay: prefersReducedMotion ? undefined : `${i * 0.12}s` }}
                  />
                ))}
              </g>

              {/* Cou */}
              <rect x="150" y="180" width="40" height="18" rx="8" fill="#101614" />

              {/* Corps */}
              <rect x="56" y="214" width="26" height="88" rx="13" fill="url(#neoBodyG)" />
              <rect x="258" y="214" width="26" height="88" rx="13" fill="url(#neoBodyG)" />
              <circle cx="69" cy="262" r="2.5" fill={meta.accent} opacity="0.7" />
              <circle cx="271" cy="262" r="2.5" fill={meta.accent} opacity="0.7" />
              <rect x="85" y="196" width="170" height="118" rx="38" fill="url(#neoBodyG)" />
              <path d="M 102 208 C 132 198, 208 198, 238 208" stroke="#3E4A47" strokeWidth="1.2" fill="none" opacity="0.8" />

              {/* Cœur / réacteur */}
              <circle cx="170" cy="254" r="21" fill="#0A0E0D" />
              <circle
                cx="170" cy="254" r="13.5" fill={meta.accent} opacity="0.9"
                className={animClass(styles.core)}
                style={{ transition: "fill 0.5s" }}
              />
              <circle cx="170" cy="254" r="19.5" fill="none" stroke={meta.accent} strokeWidth="1" opacity="0.5" />

              {/* Socle */}
              <rect x="152" y="298" width="36" height="3" rx="1.5" fill="#0A0E0D" />
            </svg>

            {/* Orbite — 3 particules d'énergie, plan 3D incliné + rotation Z (support.js).
                transform initial = orbitTransform() à l'angle de départ, posé en JSX : le
                premier paint est déjà correctement centré, avant même le premier tick rAF
                (qui ne tourne pas tant que l'onglet n'a pas le focus/la visibilité). */}
            <div
              ref={particleRefs[0]}
              className="absolute pointer-events-none rounded-full"
              style={{
                left: "50%", top: "54.86%", width: `${(26 / DESIGN_WIDTH) * 100}%`, aspectRatio: "1 / 1",
                background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${meta.accent} 45%, #14532D 88%)`,
                boxShadow: "0 0 18px 2px rgba(5,150,105,.45)",
                willChange: "transform",
                ...orbitTransform(INITIAL_ANGLES[0], ORB[0], 1),
              }}
            />
            <div
              ref={particleRefs[1]}
              className="absolute pointer-events-none rounded-full"
              style={{
                left: "50%", top: "54.86%", width: `${(18 / DESIGN_WIDTH) * 100}%`, aspectRatio: "1 / 1",
                background: "radial-gradient(circle at 35% 30%, #FFFFFF 0%, #7DD9B4 45%, #14532D 90%)",
                boxShadow: "0 0 14px 2px rgba(125,217,180,.5)",
                willChange: "transform",
                ...orbitTransform(INITIAL_ANGLES[1], ORB[1], 1),
              }}
            />
            <div
              ref={particleRefs[2]}
              className="absolute pointer-events-none rounded-full"
              style={{
                left: "50%", top: "54.86%", width: `${(14 / DESIGN_WIDTH) * 100}%`, aspectRatio: "1 / 1",
                background: `radial-gradient(circle at 35% 30%, #FFFFFF 0%, ${meta.accent} 45%, #14532D 90%)`,
                boxShadow: "0 0 12px 2px rgba(5,150,105,.5)",
                willChange: "transform",
                ...orbitTransform(INITIAL_ANGLES[2], ORB[2], 1),
              }}
            />

            {/* Annotations produit — révélées au survol */}
            {ANNOTATIONS.map((a, i) => (
              <div
                key={a.label}
                className="absolute z-10 flex items-center gap-1.5 pointer-events-none transition-opacity duration-300"
                style={{ top: a.top, left: a.left, right: a.right, opacity: hover ? 1 : 0, transitionDelay: `${i * 60}ms` }}
              >
                {a.tick != null && <div style={{ width: a.tick, height: 1, background: "#8FA598" }} />}
                <div className="whitespace-nowrap rounded-lg border border-neutral-200 bg-white/90 px-2.5 py-1 font-mono text-[9.5px] tracking-wide text-slate-700 shadow-sm backdrop-blur">
                  {a.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
