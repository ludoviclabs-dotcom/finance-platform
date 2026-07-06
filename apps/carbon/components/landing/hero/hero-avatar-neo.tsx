/**
 * Carbon & Co — Néo, l'avatar Carbon&Co (composite V2 retenu)
 * Port fidèle de « Avatar Neural — Explorations » : visage 1d (expressions),
 * corps 1a (Sculpt v2), orbite 1b (énergie) — traverse 4 états produit qui
 * cyclent automatiquement (repos → analyse → prêt → alerte), et révèle des
 * annotations produit au survol.
 *
 * Écarts assumés par rapport à la source (bundle figé, page de démo) :
 *  - l'orbite y est pilotée par une boucle JS (position/échelle calculées par
 *    trame) ; ici elle est portée en orbites circulaires SVG déclaratives
 *    (durées/rayons différents par particule) — même intention visuelle
 *    (« l'énergie en orbite »), sans dépendre d'un rAF.
 *  - le cadencement du cycle d'états n'est pas récupérable du bundle minifié ;
 *    3.2s par état est un choix raisonnable, pas une valeur mesurée.
 */

"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import styles from "./hero-avatar-neo.module.css";

type NeoState = "repos" | "analyse" | "pret" | "alerte";

const STATES: NeoState[] = ["repos", "analyse", "pret", "alerte"];
const ACCENT: Record<NeoState, string> = {
  repos: "#059669",
  analyse: "#7DD9B4",
  pret: "#059669",
  alerte: "#E8930C",
};
const CYCLE_MS = 3200;

const ORBIT_PARTICLES = [
  { radius: 92, size: 26, duration: "9s", delay: "0s" },
  { radius: 70, size: 18, duration: "7s", delay: "-2.3s" },
  { radius: 54, size: 14, duration: "5.5s", delay: "-4.1s" },
];

const ANNOTATIONS: { top: string; left?: string; right?: string; tick?: number; label: string }[] = [
  { top: "0.6%", left: "52.9%", tick: 20, label: "LIAISON TEMPS RÉEL · ZONE UE" },
  { top: "28%", left: "81.2%", tick: 16, label: "NEURAL v2.4 · ESRS NATIVE" },
  { top: "69.7%", right: "22.9%", label: "MOTEUR GES · SCOPES 1–3" },
  { top: "88%", left: "78.2%", tick: 14, label: "FLUX · EFRAG · GHG · ADEME" },
];

export function HeroAvatarNeo() {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<NeoState>("repos");
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => {
      setState((s) => STATES[(STATES.indexOf(s) + 1) % STATES.length]);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  const accent = ACCENT[state];
  const eyesFlat = state !== "pret";
  const isAnalyse = state === "analyse";
  const isPret = state === "pret";
  const isAlerte = state === "alerte";
  // Animations SVG figées sur la valeur finale plutôt que jouées en boucle.
  const animClass = (cls: string) => (prefersReducedMotion ? "" : cls);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="relative w-full max-w-full max-h-full aspect-[340/350]"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
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
          <circle cx="170" cy="14" r="6.5" fill={accent} className={animClass(styles.antennaLed)} style={{ transition: "fill 0.5s" }} />

          {/* Oreilles */}
          <rect x="28" y="88" width="18" height="56" rx="9" fill="#1A1F1D" />
          <rect x="294" y="88" width="18" height="56" rx="9" fill="#1A1F1D" />
          <circle cx="37" cy="116" r="2.2" fill={accent} style={{ transition: "fill 0.5s" }} />
          <circle cx="303" cy="116" r="2.2" fill={accent} style={{ transition: "fill 0.5s" }} />

          {/* Tête / visière */}
          <rect x="50" y="50" width="240" height="132" rx="64" fill="#050807" />
          <rect x="56" y="56" width="228" height="120" rx="58" fill="url(#neoVisor)" />
          <rect x="64" y="63" width="212" height="18" rx="9" fill="#FFFFFF" opacity="0.07" />

          {/* Bouche */}
          <path
            d="M 76 166 C 112 178, 228 178, 264 166"
            stroke={accent}
            strokeWidth="1.4"
            fill="none"
            opacity="0.4"
            style={{ transition: "stroke 0.5s" }}
          />

          {/* Yeux + expressions */}
          <g>
            <circle cx="135" cy="114" r="20" fill="url(#neoEye)" />
            <circle cx="205" cy="114" r="20" fill="url(#neoEye)" />

            {/* Paupières basses (repos / analyse / alerte) */}
            <g opacity={eyesFlat ? 1 : 0} style={{ transition: "opacity 0.4s" }}>
              <ellipse cx="135" cy="114" rx="8" ry="1" fill="#FFFFFF" />
              <ellipse cx="205" cy="114" rx="8" ry="1" fill="#FFFFFF" />
            </g>

            {/* Sourcils souriants (prêt) */}
            <g opacity={isPret ? 1 : 0} stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" style={{ transition: "opacity 0.4s" }}>
              <path d="M 118 120 Q 135 100 152 120" />
              <path d="M 188 120 Q 205 100 222 120" />
            </g>

            {/* Sourcils alerte (obliques, ambre) */}
            <g opacity={isAlerte ? 1 : 0} stroke="#FFB35C" strokeWidth="3.5" strokeLinecap="round" style={{ transition: "opacity 0.4s" }}>
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
                x={x} y="142" width="4" height="15" rx="2" fill="#059669"
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
          <circle cx="69" cy="262" r="2.5" fill={accent} opacity="0.7" style={{ transition: "fill 0.5s" }} />
          <circle cx="271" cy="262" r="2.5" fill={accent} opacity="0.7" style={{ transition: "fill 0.5s" }} />
          <rect x="85" y="196" width="170" height="118" rx="38" fill="url(#neoBodyG)" />
          <path d="M 102 208 C 132 198, 208 198, 238 208" stroke="#3E4A47" strokeWidth="1.2" fill="none" opacity="0.8" />

          {/* Cœur / réacteur */}
          <circle cx="170" cy="254" r="21" fill="#0A0E0D" />
          <circle
            cx="170" cy="254" r="13.5" fill={accent} opacity="0.9"
            className={animClass(styles.core)}
            style={{ transition: "fill 0.5s" }}
          />
          <circle cx="170" cy="254" r="19.5" fill="none" stroke={accent} strokeWidth="1" opacity="0.5" style={{ transition: "stroke 0.5s" }} />

          {/* Socle */}
          <rect x="152" y="298" width="36" height="3" rx="1.5" fill="#0A0E0D" />
        </svg>

        {/* Orbite — énergie en rotation autour de Néo (1b) */}
        <svg viewBox="0 0 340 350" className="absolute inset-0 z-[8] w-full h-full pointer-events-none" aria-hidden>
          <defs>
            <radialGradient id="neoOrbitBead" cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="0.45" stopColor="#7DD9B4" />
              <stop offset="1" stopColor="#14532D" />
            </radialGradient>
          </defs>
          {ORBIT_PARTICLES.map((p, i) => (
            <g
              key={i}
              className={animClass(styles.orbitGroup)}
              style={{ animationDuration: p.duration, animationDelay: prefersReducedMotion ? undefined : p.delay }}
            >
              <circle
                cx={170 + p.radius}
                cy="192"
                r={p.size / 2}
                fill="url(#neoOrbitBead)"
                style={{ filter: "drop-shadow(0 0 6px rgba(5,150,105,0.5))" }}
              />
            </g>
          ))}
        </svg>

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
  );
}
