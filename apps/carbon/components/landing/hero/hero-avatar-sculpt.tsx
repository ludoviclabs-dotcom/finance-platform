/**
 * Carbon & Co — Hero avatar (Sculpt direction)
 * Port direct du SVG du design Anthropic (Hero Refonte.html).
 * Friendly robot palette émeraude/graphite : casque arrondi, visière pill avec yeux glow,
 * antenne, écran ESRS sur le torse, plinth grid + halo ambiant.
 */

const ACCENT = {
  c: "#059669",
  deep: "#14532D",
  soft: "#E7F4EE",
};

export function HeroAvatarSculpt() {
  const a = ACCENT;
  return (
    <svg viewBox="0 0 520 620" className="w-full h-full" aria-label="Neural — assistant CarbonCo">
      <defs>
        <linearGradient id="rbBody" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#2A2F2C" />
          <stop offset="0.55" stopColor="#1E2422" />
          <stop offset="1" stopColor="#101614" />
        </linearGradient>
        <linearGradient id="rbBodySide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0B0F0E" />
          <stop offset="1" stopColor="#1E2422" />
        </linearGradient>
        <linearGradient id="rbHead" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#33393A" />
          <stop offset="0.6" stopColor="#22282A" />
          <stop offset="1" stopColor="#141A1B" />
        </linearGradient>
        <linearGradient id="rbVisor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0B1715" />
          <stop offset="0.45" stopColor={a.deep} />
          <stop offset="0.7" stopColor={a.c} />
          <stop offset="1" stopColor="#7DD9B4" />
        </linearGradient>
        <radialGradient id="rbEye" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor={a.c} />
          <stop offset="1" stopColor={a.c} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rbHalo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={a.c} stopOpacity="0.28" />
          <stop offset="0.55" stopColor={a.c} stopOpacity="0.08" />
          <stop offset="1" stopColor={a.c} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rbScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E1614" />
          <stop offset="1" stopColor="#0A100E" />
        </linearGradient>
        <radialGradient id="rbBead" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.4" stopColor={a.c} />
          <stop offset="1" stopColor={a.c} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient halo */}
      <ellipse cx="260" cy="320" rx="240" ry="260" fill="url(#rbHalo)" />

      {/* Plinth grid */}
      <g opacity="0.18" stroke={a.c} strokeWidth="0.8" fill="none">
        {[470, 500, 530, 560, 590].map((y, i) => (
          <line key={`h${i}`} x1={120 - i * 14} y1={y} x2={400 + i * 14} y2={y} />
        ))}
        {[-3, -2, -1, 0, 1, 2, 3].map((i) => {
          const x = 260 + i * 40;
          return <line key={`v${i}`} x1={x} y1={470} x2={260 + i * 78} y2={590} />;
        })}
      </g>

      {/* Stars */}
      <g fill={a.c}>
        <circle cx="110" cy="180" r="1.6" opacity="0.6" />
        <circle cx="430" cy="220" r="1.4" opacity="0.5" />
        <circle cx="80" cy="380" r="1.6" opacity="0.55" />
        <circle cx="445" cy="400" r="1.4" opacity="0.5" />
        <circle cx="160" cy="120" r="1.2" opacity="0.5" />
        <circle cx="395" cy="120" r="1.2" opacity="0.45" />
      </g>

      {/* Antenna */}
      <line x1="260" y1="76" x2="260" y2="120" stroke="#1A1F1D" strokeWidth="3" strokeLinecap="round" />
      <circle cx="260" cy="74" r="9" fill="url(#rbBead)" />
      <circle cx="260" cy="74" r="4" fill={a.c} />

      {/* Head / helmet */}
      <g>
        <ellipse cx="260" cy="262" rx="118" ry="14" fill="#000" opacity="0.35" />
        <path
          d="M 168 130 C 168 110, 188 100, 218 96 C 240 93, 280 93, 302 96 C 332 100, 352 110, 352 130 L 352 224 C 352 252, 332 268, 302 270 C 280 272, 240 272, 218 270 C 188 268, 168 252, 168 224 Z"
          fill="url(#rbHead)"
        />
        <path
          d="M 168 130 C 168 110, 188 100, 218 96 C 240 93, 280 93, 302 96"
          stroke="#5A6A66"
          strokeWidth="1.2"
          fill="none"
          opacity="0.7"
        />
        <path d="M 178 248 C 218 258, 302 258, 342 248" stroke="#0A0E0D" strokeWidth="2" fill="none" />

        {/* Side caps */}
        <rect x="156" y="178" width="18" height="34" rx="6" fill="#1A1F1D" />
        <rect x="346" y="178" width="18" height="34" rx="6" fill="#1A1F1D" />
        <circle cx="165" cy="195" r="2" fill={a.c} opacity="0.85" />
        <circle cx="355" cy="195" r="2" fill={a.c} opacity="0.85" />

        {/* Visor */}
        <g>
          <rect x="186" y="158" width="148" height="58" rx="29" fill="#050807" />
          <rect x="190" y="160" width="140" height="54" rx="27" fill="url(#rbVisor)" />
          <rect x="194" y="163" width="132" height="14" rx="7" fill="#FFFFFF" opacity="0.10" />
          <circle cx="226" cy="187" r="14" fill="url(#rbEye)" />
          <circle cx="226" cy="187" r="4" fill="#FFFFFF" />
          <circle cx="294" cy="187" r="14" fill="url(#rbEye)" />
          <circle cx="294" cy="187" r="4" fill="#FFFFFF" />
          <line x1="200" y1="187" x2="320" y2="187" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.18" />
        </g>

        {/* Status leds */}
        <g>
          <circle cx="220" cy="120" r="1.6" fill={a.c} opacity="0.85" />
          <circle cx="232" cy="118" r="1.6" fill="#7DD9B4" opacity="0.7" />
          <circle cx="288" cy="118" r="1.6" fill="#7DD9B4" opacity="0.7" />
          <circle cx="300" cy="120" r="1.6" fill={a.c} opacity="0.85" />
        </g>
      </g>

      {/* Body */}
      <g>
        <path
          d="M 122 320 C 122 300, 138 286, 162 282 L 358 282 C 382 286, 398 300, 398 320 L 398 500 C 398 520, 380 530, 358 532 L 162 532 C 140 530, 122 520, 122 500 Z"
          fill="url(#rbBodySide)"
        />
        <path
          d="M 134 322 C 134 302, 150 290, 174 286 L 346 286 C 370 290, 386 302, 386 322 L 386 498 C 386 518, 370 526, 346 528 L 174 528 C 152 526, 134 518, 134 498 Z"
          fill="url(#rbBody)"
        />
        <path
          d="M 134 322 C 134 302, 150 290, 174 286"
          stroke="#3E4A47"
          strokeWidth="1.2"
          fill="none"
          opacity="0.85"
        />
        <line x1="134" y1="360" x2="386" y2="360" stroke="#0B0F0E" strokeWidth="1" opacity="0.7" />

        {/* Arms */}
        <rect x="92" y="328" width="46" height="178" rx="22" fill="url(#rbBodySide)" />
        <rect x="382" y="328" width="46" height="178" rx="22" fill="url(#rbBodySide)" />
        <rect x="98" y="332" width="36" height="170" rx="18" fill="url(#rbBody)" />
        <rect x="386" y="332" width="36" height="170" rx="18" fill="url(#rbBody)" />
        <circle cx="116" cy="430" r="3" fill={a.c} opacity="0.65" />
        <circle cx="404" cy="430" r="3" fill={a.c} opacity="0.65" />

        {/* Body grid texture */}
        <g opacity="0.16" stroke={a.c} strokeWidth="0.6" fill="none">
          {[348, 372, 396, 420, 444, 468, 492].map((y, i) => (
            <line key={`by${i}`} x1="148" y1={y} x2="372" y2={y} />
          ))}
          {[170, 200, 230, 260, 290, 320, 350].map((x, i) => (
            <line key={`bx${i}`} x1={x} y1="340" x2={x} y2="500" />
          ))}
        </g>

        {/* Chest screen */}
        <g>
          <rect x="208" y="354" width="104" height="158" rx="14" fill="#0A0E0D" />
          <rect x="214" y="360" width="92" height="146" rx="10" fill="url(#rbScreen)" />
          <rect
            x="214"
            y="360"
            width="92"
            height="146"
            rx="10"
            fill="none"
            stroke={a.c}
            strokeWidth="1"
            opacity="0.45"
          />

          {/* Status row */}
          <rect x="222" y="368" width="14" height="3" rx="1.5" fill={a.c} />
          <rect x="240" y="368" width="22" height="3" rx="1.5" fill="#7DD9B4" opacity="0.7" />
          <rect x="266" y="368" width="10" height="3" rx="1.5" fill="#7DD9B4" opacity="0.5" />
          <rect x="222" y="378" width="60" height="2" rx="1" fill="#3F5A45" opacity="0.7" />
          <rect x="222" y="384" width="42" height="2" rx="1" fill="#3F5A45" opacity="0.55" />

          {/* Orbit motif */}
          <g transform="translate(260 432)">
            <ellipse cx="0" cy="0" rx="34" ry="14" fill="none" stroke={a.c} strokeWidth="1" opacity="0.85" />
            <ellipse
              cx="0"
              cy="0"
              rx="34"
              ry="14"
              fill="none"
              stroke="#7DD9B4"
              strokeWidth="0.8"
              opacity="0.55"
              transform="rotate(60)"
            />
            <ellipse
              cx="0"
              cy="0"
              rx="34"
              ry="14"
              fill="none"
              stroke={a.c}
              strokeWidth="0.8"
              strokeDasharray="2 3"
              opacity="0.6"
              transform="rotate(120)"
            />
            <circle r="6" fill="#FFFFFF" />
            <circle r="6" fill={a.c} opacity="0.6" />
            <circle cx="33" cy="-4" r="2" fill={a.c} />
            <circle cx="-22" cy="11" r="1.6" fill="#7DD9B4" />
          </g>

          {/* Chip badges E1 / S1 / G1 */}
          <g transform="translate(222 482)">
            <rect x="0" y="0" width="22" height="10" rx="2" fill={a.c} opacity="0.85" />
            <text
              x="11"
              y="7.4"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="6"
              fill="#0A100E"
              fontWeight="700"
            >
              E1
            </text>
            <rect x="26" y="0" width="22" height="10" rx="2" fill="#1F2A26" stroke={a.c} strokeWidth="0.6" />
            <text
              x="37"
              y="7.4"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="6"
              fill={a.c}
              fontWeight="700"
            >
              S1
            </text>
            <rect
              x="52"
              y="0"
              width="22"
              height="10"
              rx="2"
              fill="#1F2A26"
              stroke={a.c}
              strokeWidth="0.6"
              opacity="0.6"
            />
            <text
              x="63"
              y="7.4"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize="6"
              fill={a.c}
              fontWeight="700"
              opacity="0.7"
            >
              G1
            </text>
          </g>
        </g>

        {/* Lower panel detail */}
        <rect x="240" y="516" width="40" height="3" rx="1.5" fill="#0A0E0D" />
      </g>
    </svg>
  );
}
