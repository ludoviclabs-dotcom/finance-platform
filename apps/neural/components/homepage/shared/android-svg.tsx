/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * NEURAL Android SVG — version futuriste
 * Palette: midnight #0A1628 · navy #111D35 · violet #7C3AED · violet-light #A78BFA
 * Features: HUD visor, glowing reticle eyes, pulsing antenna, orbital reactor,
 *           circuit traces on arms, data particles, chrome armour highlights.
 */
export function AndroidSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 380 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* ── Gradients ──────────────────────────────────────────── */}
        <radialGradient id="a-halo" cx="50%" cy="55%" r="50%">
          <stop offset="0%"   stopColor="#7C3AED" stopOpacity="0.30" />
          <stop offset="50%"  stopColor="#4C1D95" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"    />
        </radialGradient>

        <linearGradient id="a-body" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%"   stopColor="#1A2744" />
          <stop offset="60%"  stopColor="#111D35" />
          <stop offset="100%" stopColor="#0A1628" />
        </linearGradient>

        <linearGradient id="a-chrome" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1E3050" />
          <stop offset="40%"  stopColor="#2D4266" />
          <stop offset="60%"  stopColor="#1E3050" />
          <stop offset="100%" stopColor="#0A1628" />
        </linearGradient>

        <linearGradient id="a-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#3730A3" />
          <stop offset="40%"  stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>

        <linearGradient id="a-visor-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"    />
        </linearGradient>

        <radialGradient id="a-reactor" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#E9D5FF" />
          <stop offset="35%"  stopColor="#A78BFA" />
          <stop offset="70%"  stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.5" />
        </radialGradient>

        <radialGradient id="a-eye" cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#E9D5FF" />
          <stop offset="50%"  stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#4C1D95" />
        </radialGradient>

        <radialGradient id="a-shoulder-l" cx="30%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#2D4266" />
          <stop offset="100%" stopColor="#0F1C36" />
        </radialGradient>
        <radialGradient id="a-shoulder-r" cx="70%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#2D4266" />
          <stop offset="100%" stopColor="#0F1C36" />
        </radialGradient>

        {/* ── Glow filters ───────────────────────────────────────── */}
        <filter id="a-glow-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="a-glow-hard" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="a-glow-xs" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── Background halo ──────────────────────────────────────── */}
      <ellipse cx="190" cy="300" rx="180" ry="230" fill="url(#a-halo)" />

      {/* ════════════════════════════════════════════════════════════
          ARMS
          ════════════════════════════════════════════════════════════ */}

      {/* LEFT ARM */}
      <rect x="22" y="198" width="62" height="140" rx="14" fill="url(#a-body)" stroke="#1E3050" strokeWidth="1.2" />
      {/* left arm chrome edge */}
      <rect x="22" y="198" width="8"  height="140" rx="8"  fill="url(#a-chrome)" opacity="0.5" />
      {/* circuit traces */}
      <polyline points="42,220 62,220 62,240 48,240" stroke="#7C3AED" strokeWidth="0.8" fill="none" strokeOpacity="0.5" />
      <line x1="42" y1="256" x2="74" y2="256" stroke="#A78BFA" strokeWidth="0.7" strokeOpacity="0.4" />
      <line x1="42" y1="272" x2="66" y2="272" stroke="#7C3AED" strokeWidth="0.7" strokeOpacity="0.45" />
      <circle cx="42" cy="220" r="2.5" fill="#A78BFA" filter="url(#a-glow-xs)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="74" cy="256" r="2" fill="#7C3AED" fillOpacity="0.7">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.1s" repeatCount="indefinite" />
      </circle>
      {/* left cuff */}
      <rect x="26" y="326" width="54" height="16" rx="8" fill="#1A2744" stroke="#2D4266" strokeWidth="1" />
      <line x1="36" y1="334" x2="68" y2="334" stroke="#7C3AED" strokeWidth="0.6" strokeOpacity="0.5" />

      {/* RIGHT ARM */}
      <rect x="296" y="198" width="62" height="140" rx="14" fill="url(#a-body)" stroke="#1E3050" strokeWidth="1.2" />
      {/* right arm chrome edge */}
      <rect x="350" y="198" width="8" height="140" rx="8" fill="url(#a-chrome)" opacity="0.5" />
      {/* circuit traces */}
      <polyline points="338,220 318,220 318,240 332,240" stroke="#7C3AED" strokeWidth="0.8" fill="none" strokeOpacity="0.5" />
      <line x1="306" y1="256" x2="338" y2="256" stroke="#A78BFA" strokeWidth="0.7" strokeOpacity="0.4" />
      <line x1="314" y1="272" x2="338" y2="272" stroke="#7C3AED" strokeWidth="0.7" strokeOpacity="0.45" />
      <circle cx="338" cy="220" r="2.5" fill="#A78BFA" filter="url(#a-glow-xs)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" begin="0.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="306" cy="256" r="2" fill="#7C3AED" fillOpacity="0.7">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.1s" begin="0.8s" repeatCount="indefinite" />
      </circle>
      {/* right cuff */}
      <rect x="300" y="326" width="54" height="16" rx="8" fill="#1A2744" stroke="#2D4266" strokeWidth="1" />
      <line x1="312" y1="334" x2="344" y2="334" stroke="#7C3AED" strokeWidth="0.6" strokeOpacity="0.5" />

      {/* ════════════════════════════════════════════════════════════
          TORSO
          ════════════════════════════════════════════════════════════ */}
      <rect x="84" y="182" width="212" height="210" rx="22" fill="url(#a-body)" stroke="#1E3050" strokeWidth="1.5" />

      {/* shoulder/collar band */}
      <rect x="84" y="182" width="212" height="38" rx="18" fill="url(#a-chrome)" opacity="0.7" />

      {/* left shoulder dome */}
      <ellipse cx="100" cy="198" rx="26" ry="18" fill="url(#a-shoulder-l)" stroke="#2D4266" strokeWidth="1" />
      {/* right shoulder dome */}
      <ellipse cx="280" cy="198" rx="26" ry="18" fill="url(#a-shoulder-r)" stroke="#2D4266" strokeWidth="1" />

      {/* side panel details – left */}
      <rect x="100" y="236" width="32" height="5" rx="2.5" fill="#1E3050" />
      <rect x="100" y="247" width="22" height="5" rx="2.5" fill="#1E3050" />
      <rect x="100" y="258" width="28" height="5" rx="2.5" fill="#1E3050" />
      <circle cx="106" cy="238" r="2" fill="#7C3AED" fillOpacity="0.5" />

      {/* side panel details – right */}
      <rect x="248" y="236" width="32" height="5" rx="2.5" fill="#1E3050" />
      <rect x="258" y="247" width="22" height="5" rx="2.5" fill="#1E3050" />
      <rect x="252" y="258" width="28" height="5" rx="2.5" fill="#1E3050" />
      <circle cx="274" cy="238" r="2" fill="#7C3AED" fillOpacity="0.5" />

      {/* ── Chest reactor ──────────────────────────────────── */}
      {/* outer glow */}
      <circle cx="190" cy="308" r="52" fill="#4C1D95" fillOpacity="0.15" />

      {/* orbital ring 1 — slow CCW */}
      <ellipse cx="190" cy="308" rx="70" ry="28" stroke="#7C3AED" strokeWidth="1.2" strokeOpacity="0.35"
        fill="none" strokeDasharray="6 4">
        <animateTransform attributeName="transform" type="rotate"
          from="0 190 308" to="-360 190 308" dur="10s" repeatCount="indefinite" />
      </ellipse>

      {/* orbital ring 2 — faster CW, tilted */}
      <ellipse cx="190" cy="308" rx="54" ry="22" stroke="#A78BFA" strokeWidth="1.5" strokeOpacity="0.55"
        fill="none" transform="rotate(55,190,308)">
        <animateTransform attributeName="transform" type="rotate"
          from="55 190 308" to="415 190 308" dur="6s" repeatCount="indefinite" />
      </ellipse>

      {/* orbital dot 1 */}
      <circle cx="190" cy="280" r="3.5" fill="#A78BFA" filter="url(#a-glow-xs)">
        <animateTransform attributeName="transform" type="rotate"
          from="0 190 308" to="360 190 308" dur="6s" repeatCount="indefinite" />
      </circle>
      {/* orbital dot 2 */}
      <circle cx="190" cy="336" r="2.5" fill="#7C3AED">
        <animateTransform attributeName="transform" type="rotate"
          from="180 190 308" to="540 190 308" dur="6s" repeatCount="indefinite" />
      </circle>

      {/* reactor core bg */}
      <circle cx="190" cy="308" r="36" fill="#1A1033" />
      {/* reactor glow ring */}
      <circle cx="190" cy="308" r="36" stroke="#7C3AED" strokeWidth="2" fill="none"
        strokeOpacity="0.7" filter="url(#a-glow-soft)" />
      {/* reactor orb */}
      <circle cx="190" cy="308" r="26" fill="url(#a-reactor)" filter="url(#a-glow-hard)" />
      {/* reactor bright center */}
      <circle cx="190" cy="308" r="11" fill="#F5F3FF" fillOpacity="0.95" />
      {/* reactor pulse ring */}
      <circle cx="190" cy="308" r="26" fill="none" stroke="#E9D5FF" strokeWidth="1.5" strokeOpacity="0">
        <animate attributeName="r"             values="26;42;26" dur="3s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
      </circle>

      {/* lower torso */}
      <rect x="118" y="362" width="144" height="30" rx="14" fill="#0D1A30" stroke="#1E3050" strokeWidth="1" />
      <line x1="136" y1="377" x2="244" y2="377" stroke="#1E3050" strokeWidth="1" />

      {/* ════════════════════════════════════════════════════════════
          NECK
          ════════════════════════════════════════════════════════════ */}
      <rect x="164" y="156" width="52" height="30" rx="8" fill="#111D35" stroke="#1E3050" strokeWidth="1.2" />
      <rect x="172" y="161" width="36" height="7" rx="3.5" fill="#1E3050" />
      <rect x="172" y="173" width="36" height="7" rx="3.5" fill="#1E3050" />

      {/* ════════════════════════════════════════════════════════════
          HEAD
          ════════════════════════════════════════════════════════════ */}
      <rect x="98" y="42" width="184" height="120" rx="20" fill="url(#a-body)" stroke="#1E3050" strokeWidth="1.5" />
      {/* head chrome top edge */}
      <rect x="98" y="42" width="184" height="16" rx="16" fill="url(#a-chrome)" opacity="0.8" />
      {/* head chrome bottom edge */}
      <rect x="98" y="146" width="184" height="16" rx="16" fill="url(#a-chrome)" opacity="0.5" />
      {/* head side highlights */}
      <rect x="98" y="58" width="6" height="88" rx="3" fill="#2D4266" opacity="0.6" />
      <rect x="276" y="58" width="6" height="88" rx="3" fill="#2D4266" opacity="0.6" />

      {/* ── Antenna ───────────────────────────────────────── */}
      <line x1="190" y1="42" x2="190" y2="14" stroke="#2D4266" strokeWidth="2.5" strokeLinecap="round" />
      {/* antenna base ring */}
      <circle cx="190" cy="42" r="4" fill="#1A2744" stroke="#2D4266" strokeWidth="1" />
      {/* antenna tip */}
      <circle cx="190" cy="11" r="5.5" fill="#A78BFA" filter="url(#a-glow-soft)">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="r"       values="4.5;6.5;4.5" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* antenna wave ring 1 */}
      <circle cx="190" cy="11" r="10" fill="none" stroke="#7C3AED" strokeWidth="1.2" strokeOpacity="0">
        <animate attributeName="r"             values="7;20;7"   dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* antenna wave ring 2 — offset */}
      <circle cx="190" cy="11" r="14" fill="none" stroke="#A78BFA" strokeWidth="0.8" strokeOpacity="0">
        <animate attributeName="r"             values="7;28;7"   dur="1.8s" begin="0.4s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="1.8s" begin="0.4s" repeatCount="indefinite" />
      </circle>

      {/* ── HUD Visor ─────────────────────────────────────── */}
      <rect x="116" y="62" width="148" height="82" rx="12" fill="url(#a-visor)" />
      {/* visor shine */}
      <rect x="116" y="62" width="148" height="30" rx="10" fill="url(#a-visor-shine)" />
      {/* visor border */}
      <rect x="116" y="62" width="148" height="82" rx="12" stroke="#4C1D95" strokeWidth="1" fill="none" />

      {/* HUD grid — horizontals */}
      <line x1="116" y1="84"  x2="264" y2="84"  stroke="#6D28D9" strokeWidth="0.5" strokeOpacity="0.35" />
      <line x1="116" y1="103" x2="264" y2="103" stroke="#6D28D9" strokeWidth="0.5" strokeOpacity="0.35" />
      <line x1="116" y1="122" x2="264" y2="122" stroke="#6D28D9" strokeWidth="0.5" strokeOpacity="0.35" />
      {/* HUD grid — verticals */}
      <line x1="153" y1="62" x2="153" y2="144" stroke="#6D28D9" strokeWidth="0.5" strokeOpacity="0.35" />
      <line x1="190" y1="62" x2="190" y2="144" stroke="#6D28D9" strokeWidth="0.5" strokeOpacity="0.35" />
      <line x1="227" y1="62" x2="227" y2="144" stroke="#6D28D9" strokeWidth="0.5" strokeOpacity="0.35" />

      {/* ── LEFT EYE ──────────────────────────────────────── */}
      <circle cx="155" cy="103" r="18" fill="#0D0A20" />
      <circle cx="155" cy="103" r="12" fill="#1E1B4B" />
      <circle cx="155" cy="103" r="7"  fill="url(#a-eye)" filter="url(#a-glow-soft)" />
      <circle cx="155" cy="103" r="3.5" fill="#F5F3FF" />
      {/* reticle cross */}
      <line x1="132" y1="103" x2="145" y2="103" stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      <line x1="165" y1="103" x2="178" y2="103" stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      <line x1="155" y1="80"  x2="155" y2="93"  stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      <line x1="155" y1="113" x2="155" y2="126" stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      {/* corner brackets */}
      <path d="M136 84 L136 92 L144 92" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      <path d="M174 84 L174 92 L166 92" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      <path d="M136 122 L136 114 L144 114" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      <path d="M174 122 L174 114 L166 114" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      {/* eye pulse */}
      <circle cx="155" cy="103" r="16" fill="none" stroke="#7C3AED" strokeWidth="0.8" strokeOpacity="0">
        <animate attributeName="r"             values="16;22;16" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="3.2s" repeatCount="indefinite" />
      </circle>

      {/* ── RIGHT EYE ─────────────────────────────────────── */}
      <circle cx="225" cy="103" r="18" fill="#0D0A20" />
      <circle cx="225" cy="103" r="12" fill="#1E1B4B" />
      <circle cx="225" cy="103" r="7"  fill="url(#a-eye)" filter="url(#a-glow-soft)" />
      <circle cx="225" cy="103" r="3.5" fill="#F5F3FF" />
      {/* reticle cross */}
      <line x1="202" y1="103" x2="215" y2="103" stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      <line x1="235" y1="103" x2="248" y2="103" stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      <line x1="225" y1="80"  x2="225" y2="93"  stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      <line x1="225" y1="113" x2="225" y2="126" stroke="#C4B5FD" strokeWidth="0.9" strokeOpacity="0.75" />
      {/* corner brackets */}
      <path d="M206 84 L206 92 L214 92" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      <path d="M244 84 L244 92 L236 92" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      <path d="M206 122 L206 114 L214 114" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      <path d="M244 122 L244 114 L236 114" stroke="#A78BFA" strokeWidth="0.9" fill="none" strokeOpacity="0.55" />
      {/* eye pulse */}
      <circle cx="225" cy="103" r="16" fill="none" stroke="#7C3AED" strokeWidth="0.8" strokeOpacity="0">
        <animate attributeName="r"             values="16;22;16" dur="3.2s" begin="0.6s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="3.2s" begin="0.6s" repeatCount="indefinite" />
      </circle>

      {/* ════════════════════════════════════════════════════════════
          DATA PARTICLES
          ════════════════════════════════════════════════════════════ */}
      {/* left field */}
      <circle cx="52"  cy="210" r="2.5" fill="#A78BFA" fillOpacity="0.7">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.0s" repeatCount="indefinite" />
        <animate attributeName="cy"      values="210;204;210" dur="3.0s" repeatCount="indefinite" />
      </circle>
      <circle cx="36"  cy="290" r="2"   fill="#7C3AED" fillOpacity="0.5">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="4.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="62"  cy="360" r="3"   fill="#A78BFA" fillOpacity="0.4">
        <animate attributeName="opacity" values="0.15;0.6;0.15" dur="3.7s" repeatCount="indefinite" />
        <animate attributeName="cy"      values="360;354;360" dur="3.7s" repeatCount="indefinite" />
      </circle>
      {/* right field */}
      <circle cx="328" cy="240" r="3"   fill="#A78BFA" fillOpacity="0.65">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="cy"      values="240;234;240" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="344" cy="320" r="2"   fill="#7C3AED" fillOpacity="0.5">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="350" cy="170" r="1.8" fill="#C4B5FD" fillOpacity="0.6">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2.2s" repeatCount="indefinite" />
      </circle>
      {/* top center */}
      <circle cx="140" cy="22" r="2"   fill="#A78BFA" fillOpacity="0.5">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="242" cy="18" r="1.5" fill="#7C3AED" fillOpacity="0.45">
        <animate attributeName="opacity" values="0.1;0.5;0.1" dur="4.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
