/**
 * NEURAL Android SVG — from Claude Design (assets/android-placeholder.svg)
 * viewBox 560×680 — palette violet/#10B981/#60A5FA
 * Animations added: antenna pulse, glow-core pulse, orbital ring rotation, particles float.
 */
export function AndroidSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 560 680"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id="nd-halo" cx="50%" cy="45%" r="55%">
          <stop offset="0%"   stopColor="#A78BFA" stopOpacity="0.65" />
          <stop offset="45%"  stopColor="#7C3AED" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#0A1628"  stopOpacity="0"   />
        </radialGradient>

        <linearGradient id="nd-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#2A3759" />
          <stop offset="50%"  stopColor="#1A2744" />
          <stop offset="100%" stopColor="#080F1F" />
        </linearGradient>

        <linearGradient id="nd-chromeHL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0"    />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"    />
        </linearGradient>

        <linearGradient id="nd-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#7C3AED" />
          <stop offset="40%"  stopColor="#A78BFA" />
          <stop offset="75%"  stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        <linearGradient id="nd-visorInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"    />
        </linearGradient>

        <radialGradient id="nd-coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#EDE4FF" stopOpacity="1"   />
          <stop offset="40%"  stopColor="#A78BFA" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"   />
        </radialGradient>

        <filter id="nd-glow1" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="nd-softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>

        <pattern id="nd-circuit" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 L8 10 L10 12 L10 20 M10 0 L10 8 L12 10 L20 10"
            stroke="#A78BFA" strokeWidth="0.4" fill="none" opacity="0.35" />
          <circle cx="10" cy="10" r="0.8" fill="#A78BFA" opacity="0.5" />
        </pattern>
      </defs>

      {/* ── Halo ─────────────────────────────────────────────── */}
      <ellipse cx="280" cy="340" rx="280" ry="360" fill="url(#nd-halo)">
        <animate attributeName="rx" values="280;295;280" dur="5s" repeatCount="indefinite" />
        <animate attributeName="ry" values="360;378;360" dur="5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.8;1" dur="5s" repeatCount="indefinite" />
      </ellipse>

      {/* ── Orbit rings (body ground level) ──────────────────── */}
      <g opacity="0.35">
        <ellipse cx="280" cy="380" rx="250" ry="60"
          stroke="#A78BFA" strokeWidth="0.8" fill="none" strokeDasharray="2 6">
          <animateTransform attributeName="transform" type="rotate"
            from="0 280 380" to="360 280 380" dur="12s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="280" cy="380" rx="200" ry="48"
          stroke="#A78BFA" strokeWidth="0.6" fill="none">
          <animateTransform attributeName="transform" type="rotate"
            from="360 280 380" to="0 280 380" dur="8s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* ── Main body ─────────────────────────────────────────── */}
      <path d="M115 330 Q115 278 178 270 L382 270 Q445 278 445 330 L445 572 Q445 610 405 616 L155 616 Q115 610 115 572 Z"
        fill="url(#nd-chrome)" stroke="#A78BFA" strokeOpacity="0.45" strokeWidth="1.2" />

      {/* body grid lines */}
      <g stroke="#A78BFA" strokeOpacity="0.35" strokeWidth="0.8" fill="none">
        <path d="M115 350 L445 350" />
        <path d="M160 270 L160 616" />
        <path d="M400 270 L400 616" />
      </g>

      {/* body top chrome highlight */}
      <path d="M160 275 L400 275 L400 290 L160 290 Z" fill="url(#nd-chromeHL)" />

      {/* circuit overlays on body sides */}
      <rect x="125" y="360" width="80"  height="200" rx="10" fill="url(#nd-circuit)" opacity="0.5" />
      <rect x="355" y="360" width="80"  height="200" rx="10" fill="url(#nd-circuit)" opacity="0.5" />

      {/* ── Chest display panel ───────────────────────────────── */}
      <rect x="210" y="338" width="140" height="220" rx="18"
        fill="#050A14" stroke="#7C3AED" strokeOpacity="0.7" strokeWidth="1.2" />
      <rect x="218" y="346" width="124" height="204" rx="14"
        fill="none" stroke="#A78BFA" strokeOpacity="0.25" strokeWidth="0.5" />

      {/* data bars */}
      <rect x="228" y="358" width="104" height="3" rx="1.5" fill="#7C3AED"  opacity="0.8" />
      <rect x="228" y="368" width="74"  height="3" rx="1.5" fill="#A78BFA"  opacity="0.7" />
      <rect x="228" y="378" width="90"  height="3" rx="1.5" fill="#10B981"  opacity="0.7" />
      <rect x="228" y="388" width="60"  height="3" rx="1.5" fill="#60A5FA"  opacity="0.55" />

      {/* glow core */}
      <circle cx="280" cy="460" r="52"  fill="url(#nd-coreGlow)" filter="url(#nd-glow1)">
        <animate attributeName="r" values="52;58;52" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.75;1" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="280" cy="460" r="34"  fill="#7C3AED" opacity="0.22" />
      <circle cx="280" cy="460" r="24"  fill="#A78BFA" opacity="0.45" />
      <circle cx="280" cy="460" r="12"  fill="#EDE4FF" />

      {/* ── Orbital rings around core — visibly rotating ───────── */}
      {/* Ring 1: wide ellipse, slow counter-clockwise, violet dashed */}
      <ellipse cx="280" cy="460" rx="64" ry="22"
        stroke="#A78BFA" strokeWidth="1" fill="none" opacity="0.75"
        strokeDasharray="5 4">
        <animateTransform attributeName="transform" type="rotate"
          from="0 280 460" to="-360 280 460" dur="9s" repeatCount="indefinite" />
      </ellipse>

      {/* Ring 2: narrower ellipse, fast clockwise, tilted, solid violet */}
      <ellipse cx="280" cy="460" rx="58" ry="18"
        stroke="#C4B5FD" strokeWidth="1.2" fill="none" opacity="0.85">
        <animateTransform attributeName="transform" type="rotate"
          from="35 280 460" to="395 280 460" dur="5s" repeatCount="indefinite" />
      </ellipse>

      {/* Orbiting dot on ring 1 */}
      <circle r="3" fill="#EDE4FF" opacity="0.95">
        <animateMotion dur="9s" repeatCount="indefinite"
          path="M 344 460 A 64 22 0 1 0 216 460 A 64 22 0 1 0 344 460" />
      </circle>
      {/* Orbiting dot on ring 2 (opposite direction via reversed path) */}
      <circle r="2.4" fill="#10B981" opacity="0.9">
        <animateMotion dur="5s" repeatCount="indefinite" rotate="auto"
          path="M 222 460 A 58 18 0 1 1 338 460 A 58 18 0 1 1 222 460" />
      </circle>

      {/* Pulse ring — expands/fades */}
      <circle cx="280" cy="460" r="36" stroke="#A78BFA" strokeWidth="0.7" fill="none" opacity="0.6">
        <animate attributeName="r" values="36;54;36" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* status bars at bottom of panel */}
      <g opacity="0.75">
        <rect x="228" y="522" width="28" height="10" rx="2" fill="#7C3AED" opacity="0.6" />
        <rect x="262" y="522" width="20" height="10" rx="2" fill="#10B981" opacity="0.6" />
        <rect x="288" y="522" width="44" height="10" rx="2" fill="#A78BFA" opacity="0.45" />
        <text x="232" y="530" fontFamily="monospace" fontSize="6" fill="#ffffff" opacity="0.9">168</text>
        <text x="266" y="530" fontFamily="monospace" fontSize="6" fill="#ffffff" opacity="0.9">OK</text>
      </g>

      {/* ── Arms ──────────────────────────────────────────────── */}
      <rect x="85"  y="345" width="36" height="200" rx="18"
        fill="url(#nd-chrome)" stroke="#A78BFA" strokeOpacity="0.3" />
      <rect x="439" y="345" width="36" height="200" rx="18"
        fill="url(#nd-chrome)" stroke="#A78BFA" strokeOpacity="0.3" />
      <circle cx="103" cy="400" r="3" fill="#A78BFA" opacity="0.9">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="457" cy="400" r="3" fill="#10B981" opacity="0.9">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" begin="0.5s" repeatCount="indefinite" />
      </circle>
      <rect x="92"  y="430" width="22" height="2" rx="1" fill="#A78BFA" opacity="0.5" />
      <rect x="446" y="430" width="22" height="2" rx="1" fill="#A78BFA" opacity="0.5" />

      {/* ── Neck ─────────────────────────────────────────────── */}
      <rect x="250" y="232" width="60" height="42" rx="10" fill="#141E36" />
      <rect x="254" y="236" width="52" height="6"  rx="3"  fill="#A78BFA" opacity="0.4" />

      {/* ── Head ──────────────────────────────────────────────── */}
      <rect x="165" y="82" width="230" height="190" rx="56"
        fill="url(#nd-chrome)" stroke="#A78BFA" strokeOpacity="0.45" strokeWidth="1.4" />

      {/* head divider line */}
      <path d="M165 175 L395 175" stroke="#A78BFA" strokeOpacity="0.25" strokeWidth="0.6" />

      {/* ear panels */}
      <rect x="158" y="155" width="10" height="46" rx="4" fill="#0B1322" stroke="#A78BFA" strokeOpacity="0.4" />
      <rect x="392" y="155" width="10" height="46" rx="4" fill="#0B1322" stroke="#A78BFA" strokeOpacity="0.4" />
      <circle cx="163" cy="165" r="1.8" fill="#10B981" />
      <circle cx="397" cy="165" r="1.8" fill="#10B981" />

      {/* ── Visor glow bloom ──────────────────────────────────── */}
      <rect x="188" y="128" width="184" height="78" rx="39"
        fill="url(#nd-visor)" opacity="0.45" filter="url(#nd-glow1)" />

      {/* ── Visor main ────────────────────────────────────────── */}
      <rect x="192" y="132" width="176" height="70" rx="35" fill="url(#nd-visor)" />
      <rect x="192" y="132" width="176" height="70" rx="35" fill="url(#nd-visorInner)" />

      {/* visor HUD lines */}
      <g opacity="0.4">
        <path d="M200 167 L360 167" stroke="#ffffff" strokeWidth="0.4" />
        <path d="M200 177 L360 177" stroke="#ffffff" strokeWidth="0.3" />
        <path d="M280 135 L280 200" stroke="#ffffff" strokeWidth="0.3" />
      </g>

      {/* ── Eyes ──────────────────────────────────────────────── */}
      <g filter="url(#nd-softGlow)">
        <circle cx="238" cy="167" r="7" fill="#ffffff" />
        <circle cx="322" cy="167" r="7" fill="#ffffff" />
      </g>
      <circle cx="238" cy="167" r="3.2" fill="#7C3AED" />
      <circle cx="322" cy="167" r="3.2" fill="#7C3AED" />
      <circle cx="238" cy="167" r="9"   stroke="#A78BFA" strokeWidth="0.5" fill="none" opacity="0.7">
        <animate attributeName="r"       values="9;13;9"   dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="322" cy="167" r="9"   stroke="#A78BFA" strokeWidth="0.5" fill="none" opacity="0.7">
        <animate attributeName="r"       values="9;13;9"   dur="3s" begin="0.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="3s" begin="0.4s" repeatCount="indefinite" />
      </circle>

      {/* ── Antenna ───────────────────────────────────────────── */}
      <line x1="280" y1="82" x2="280" y2="48" stroke="#A78BFA" strokeWidth="1.6" />
      <circle cx="280" cy="44" r="7" fill="#10B981">
        <animate attributeName="r"       values="6;9;6"     dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;1;0.8" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="280" cy="44" r="13" stroke="#10B981" strokeWidth="0.5" fill="none" opacity="0.6">
        <animate attributeName="r"             values="10;22;10" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="1.8s" repeatCount="indefinite" />
      </circle>

      {/* ── Data particles ────────────────────────────────────── */}
      <circle cx="90"  cy="220" r="2"   fill="#A78BFA">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="cy"      values="220;214;220" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="470" cy="260" r="2"   fill="#10B981">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2.8s" begin="0.3s" repeatCount="indefinite" />
        <animate attributeName="cy"      values="260;254;260" dur="2.8s" begin="0.3s" repeatCount="indefinite" />
      </circle>
      <circle cx="60"  cy="500" r="1.6" fill="#A78BFA">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="510" cy="480" r="1.6" fill="#A78BFA">
        <animate attributeName="opacity" values="0.3;0.9;0.3" dur="3.5s" begin="0.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="520" cy="140" r="1.4" fill="#60A5FA">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="40"  cy="360" r="1.4" fill="#60A5FA">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3.8s" begin="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
