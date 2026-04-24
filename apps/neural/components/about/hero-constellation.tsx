type HeadSize = "sm" | "md" | "lg" | "xl";
type ConstNode = {
  id: string;
  xPct: number;
  yPct: number;
  label: string;
  size: HeadSize;
  hub?: boolean;
};

const CONST_NODES: ConstNode[] = [
  { id: "n1", xPct: 8, yPct: 22, label: "Finance", size: "lg" },
  { id: "n2", xPct: 14, yPct: 64, label: "Luxe", size: "md" },
  { id: "n3", xPct: 32, yPct: 18, label: "Supply", size: "sm" },
  { id: "n4", xPct: 38, yPct: 78, label: "Comptabilité", size: "md" },
  { id: "n5", xPct: 54, yPct: 8, label: "RH", size: "sm" },
  { id: "n6", xPct: 58, yPct: 88, label: "Marketing", size: "sm" },
  { id: "n7", xPct: 48, yPct: 46, label: "Truth layer", size: "xl", hub: true },
];

const MAIN_XY = { xPct: 82, yPct: 50 };

const CONST_CONNS: [string, string][] = [
  ["n1", "n7"],
  ["n2", "n7"],
  ["n3", "n7"],
  ["n4", "n7"],
  ["n5", "n7"],
  ["n6", "n7"],
  ["n7", "M"],
  ["n1", "n3"],
  ["n2", "n4"],
  ["n3", "n5"],
  ["n4", "n6"],
  ["n5", "M"],
  ["n6", "M"],
  ["n1", "M"],
  ["n2", "M"],
];

function ptOf(id: string) {
  if (id === "M") return MAIN_XY;
  return CONST_NODES.find((n) => n.id === id);
}

function HeadSvg({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 80 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`np-hg-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2F1E52" />
          <stop offset="1" stopColor="#160A2C" />
        </linearGradient>
        <radialGradient id={`np-hv-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#EDE9FE" />
          <stop offset=".5" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#5B21B6" />
        </radialGradient>
      </defs>
      <line x1="40" y1="2" x2="40" y2="10" stroke="#3A2466" strokeWidth="1.4" />
      <circle className="np-c-head-ant" cx="40" cy="2.5" r="2" fill="#34D399" />
      <rect
        x="10"
        y="10"
        width="60"
        height="46"
        rx="14"
        fill={`url(#np-hg-${id})`}
        stroke="#3A2466"
        strokeWidth="1"
      />
      <rect x="3" y="26" width="7" height="14" rx="3" fill="#1B0E2E" />
      <rect x="70" y="26" width="7" height="14" rx="3" fill="#1B0E2E" />
      <rect x="18" y="22" width="44" height="20" rx="10" fill="#0A0616" />
      <rect x="22" y="25" width="36" height="14" rx="7" fill={`url(#np-hv-${id})`} opacity=".95" />
      <g className="np-c-head-eyes">
        <circle cx="32" cy="32" r="2" fill="#F6F2FF" />
        <circle cx="48" cy="32" r="2" fill="#F6F2FF" />
      </g>
      <circle cx="20" cy="50" r="1.4" fill="#34D399" opacity=".8" />
      <circle cx="60" cy="50" r="1.4" fill="#A78BFA" opacity=".8" />
    </svg>
  );
}

export function HeroConstellation() {
  return (
    <div className="np-constellation" aria-hidden="true">
      <svg preserveAspectRatio="none">
        <defs>
          <radialGradient id="np-nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#F6F2FF" stopOpacity="1" />
            <stop offset=".4" stopColor="#C4B5FD" stopOpacity=".8" />
            <stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
          </radialGradient>
        </defs>

        {CONST_CONNS.map(([a, b], i) => {
          const A = ptOf(a);
          const B = ptOf(b);
          if (!A || !B) return null;
          return (
            <line
              key={`bl${i}`}
              className="np-conn-line"
              x1={`${A.xPct}%`}
              y1={`${A.yPct}%`}
              x2={`${B.xPct}%`}
              y2={`${B.yPct}%`}
            />
          );
        })}
        {CONST_CONNS.map(([a, b], i) => {
          const A = ptOf(a);
          const B = ptOf(b);
          if (!A || !B) return null;
          return (
            <line
              key={`fl${i}`}
              className={`np-conn-flow np-f${(i % 6) + 1}`}
              x1={`${A.xPct}%`}
              y1={`${A.yPct}%`}
              x2={`${B.xPct}%`}
              y2={`${B.yPct}%`}
            />
          );
        })}
      </svg>

      {CONST_NODES.map((n, i) => (
        <div
          key={n.id}
          className={`np-c-head np-c-${n.size}${n.hub ? " np-hub" : ""}`}
          style={{
            left: `${n.xPct}%`,
            top: `${n.yPct}%`,
            animationDelay: `${i * 0.35}s`,
          }}
        >
          <HeadSvg id={n.id} />
          <div className="np-c-head-label">{n.label}</div>
        </div>
      ))}
    </div>
  );
}
