export function AvatarStage() {
  return (
    <div className="np-avatar-stage">
      <svg
        className="np-avatar-svg"
        viewBox="0 0 320 380"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="np-bod" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2A1B4A" />
            <stop offset="1" stopColor="#120826" />
          </linearGradient>
          <linearGradient id="np-head" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2F1E52" />
            <stop offset="1" stopColor="#160A2C" />
          </linearGradient>
          <radialGradient id="np-eye" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#EDE9FE" />
            <stop offset=".5" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#5B21B6" />
          </radialGradient>
          <linearGradient id="np-screen" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#1E1040" />
            <stop offset="1" stopColor="#0E0622" />
          </linearGradient>
          <radialGradient id="np-planet" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#DDD6FE" />
            <stop offset=".6" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#6D28D9" />
          </radialGradient>
        </defs>
        <line x1="160" y1="12" x2="160" y2="48" stroke="#3A2466" strokeWidth="2" />
        <circle className="np-antenna-dot" cx="160" cy="10" r="6" fill="#34D399" />
        <rect
          x="70"
          y="44"
          width="180"
          height="130"
          rx="40"
          fill="url(#np-head)"
          stroke="#3A2466"
          strokeWidth="1.5"
        />
        <rect x="50" y="90" width="22" height="40" rx="8" fill="#1B0E2E" />
        <rect x="248" y="90" width="22" height="40" rx="8" fill="#1B0E2E" />
        <rect x="92" y="88" width="136" height="48" rx="24" fill="#0A0616" />
        <rect x="100" y="94" width="120" height="36" rx="18" fill="url(#np-eye)" opacity=".9" />
        <g className="np-eye-glow">
          <circle cx="130" cy="112" r="5" fill="#F6F2FF" />
          <circle cx="190" cy="112" r="5" fill="#F6F2FF" />
        </g>
        <circle cx="96" cy="156" r="2.5" fill="#34D399" opacity=".8" />
        <circle cx="224" cy="156" r="2.5" fill="#A78BFA" opacity=".8" />
        <rect x="140" y="172" width="40" height="14" rx="4" fill="#1B0E2E" />
        <rect
          x="50"
          y="186"
          width="220"
          height="180"
          rx="36"
          fill="url(#np-bod)"
          stroke="#3A2466"
          strokeWidth="1.5"
        />
        <g opacity=".18" stroke="#A78BFA" strokeWidth=".5">
          <line x1="80" y1="210" x2="240" y2="210" />
          <line x1="80" y1="240" x2="240" y2="240" />
          <line x1="80" y1="270" x2="240" y2="270" />
          <line x1="80" y1="300" x2="240" y2="300" />
          <line x1="80" y1="330" x2="240" y2="330" />
          <line x1="100" y1="196" x2="100" y2="356" />
          <line x1="130" y1="196" x2="130" y2="356" />
          <line x1="160" y1="196" x2="160" y2="356" />
          <line x1="190" y1="196" x2="190" y2="356" />
          <line x1="220" y1="196" x2="220" y2="356" />
        </g>
        <rect x="26" y="216" width="24" height="90" rx="10" fill="#1B0E2E" />
        <rect x="270" y="216" width="24" height="90" rx="10" fill="#1B0E2E" />
        <circle cx="38" cy="320" r="6" fill="#34D399" opacity=".9" />
        <circle cx="282" cy="320" r="6" fill="#A78BFA" opacity=".9" />
        <rect
          x="100"
          y="210"
          width="120"
          height="140"
          rx="16"
          fill="url(#np-screen)"
          stroke="#3A2466"
          strokeWidth="1"
        />
        <rect x="112" y="222" width="70" height="4" rx="2" fill="#A78BFA" opacity=".6" />
        <rect x="112" y="232" width="50" height="4" rx="2" fill="#A78BFA" opacity=".35" />
        <g transform="translate(160 285)">
          <g className="np-orbit">
            <ellipse
              cx="0"
              cy="0"
              rx="40"
              ry="14"
              fill="none"
              stroke="#A78BFA"
              strokeWidth="1"
              opacity=".6"
            />
            <circle cx="40" cy="0" r="2.5" fill="#F6F2FF" />
          </g>
          <circle cx="0" cy="0" r="14" fill="url(#np-planet)" />
        </g>
        <rect
          className="np-scan"
          x="104"
          y="246"
          width="112"
          height="2"
          rx="1"
          fill="#A78BFA"
          opacity=".6"
        />
        <circle cx="116" cy="338" r="3" fill="#34D399" />
        <rect x="124" y="335" width="18" height="6" rx="2" fill="#A78BFA" opacity=".6" />
        <rect x="146" y="335" width="10" height="6" rx="2" fill="#A78BFA" opacity=".3" />
        <circle className="np-spark" cx="40" cy="100" r="2" fill="#A78BFA" />
        <circle className="np-spark np-s2" cx="280" cy="160" r="1.8" fill="#C4B5FD" />
        <circle className="np-spark np-s3" cx="50" cy="280" r="1.6" fill="#A78BFA" />
        <circle className="np-spark np-s4" cx="290" cy="60" r="2" fill="#C4B5FD" />
      </svg>
    </div>
  );
}
