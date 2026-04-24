"use client";

import { useEffect, useMemo, useRef } from "react";

type Vec3 = { x: number; y: number; z: number };
type Node = Vec3 & { id: number; label: string | null };
type Arc = { n1: Node; n2: Node; cp: Vec3; dur: number; delay: number };

const W = 520;
const H = 520;
const CX = W / 2;
const CY = H / 2;
const R = 220;

const NODE_NAMES = [
  "Finance",
  "Luxe",
  "RH",
  "Comptabilité",
  "Supply",
  "Marketing",
  "Com.",
  "SI",
  "Transport",
  "Banque",
  "Aéro",
  "SaaS",
  "Assurance",
  "CFO",
  "Ops",
  "Data",
  "Legal",
  "Risk",
  "CRM",
  "ERP",
  "BI",
  "HRIS",
  "Ads",
  "PMO",
];

function rnd(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function buildOrb() {
  const N = 42;
  const nodes: Node[] = [];
  for (let i = 0; i < N; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    nodes.push({ x, y, z, id: i, label: i < NODE_NAMES.length ? NODE_NAMES[i] : null });
  }

  const latitudes: Vec3[][] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: Vec3[] = [];
    const phi = (lat * Math.PI) / 180;
    for (let lon = 0; lon <= 360; lon += 8) {
      const th = (lon * Math.PI) / 180;
      pts.push({
        x: Math.cos(phi) * Math.cos(th),
        y: Math.sin(phi),
        z: Math.cos(phi) * Math.sin(th),
      });
    }
    latitudes.push(pts);
  }

  const longitudes: Vec3[][] = [];
  for (let lon = 0; lon < 180; lon += 30) {
    const pts: Vec3[] = [];
    const th = (lon * Math.PI) / 180;
    for (let lat = -90; lat <= 90; lat += 8) {
      const phi = (lat * Math.PI) / 180;
      pts.push({
        x: Math.cos(phi) * Math.cos(th),
        y: Math.sin(phi),
        z: Math.cos(phi) * Math.sin(th),
      });
    }
    longitudes.push(pts);
  }

  const arcs: Arc[] = [];
  for (let k = 0; k < 16; k++) {
    const a = Math.floor(rnd(k + 1) * N);
    let b = Math.floor(rnd(k + 100) * N);
    if (b === a) b = (b + 1) % N;
    const n1 = nodes[a];
    const n2 = nodes[b];
    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    const mz = (n1.z + n2.z) / 2;
    const mlen = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    const lift = 1.35;
    const cp: Vec3 = { x: (mx / mlen) * lift, y: (my / mlen) * lift, z: (mz / mlen) * lift };
    arcs.push({ n1, n2, cp, dur: 3 + rnd(k + 500) * 4, delay: rnd(k + 900) * 5 });
  }

  return { nodes, latitudes, longitudes, arcs };
}

function project(p: Vec3) {
  return {
    x: CX + p.x * R,
    y: CY - p.y * R,
    z: p.z,
  };
}

function polyline(pts: Vec3[]) {
  return pts
    .map(project)
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

export function BgOrb() {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const orb = useMemo(() => buildOrb(), []);

  useEffect(() => {
    let tx = 0;
    let ty = 0;
    let rx = 0;
    let ry = 0;
    let cx = 0;
    let cy = 0;
    let crx = 0;
    let cry = 0;
    let scrollY = window.scrollY;
    let raf = 0;

    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      crx += (rx - crx) * 0.06;
      cry += (ry - cry) * 0.06;
      const parallax = scrollY * 0.18;
      const node = innerRef.current;
      if (node) {
        node.style.transform =
          `translate(calc(-50% + ${cx.toFixed(2)}px), calc(-50% + ${(cy - parallax).toFixed(2)}px)) ` +
          `perspective(1400px) rotateX(${crx.toFixed(2)}deg) rotateY(${cry.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = (e.clientY / h) * 2 - 1;
      tx = nx * 40;
      ty = ny * 30;
      ry = nx * 8;
      rx = -ny * 6;
    };

    const onScroll = () => {
      scrollY = window.scrollY;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="np-bg-orb" aria-hidden="true">
      <div className="np-bg-orb-inner" ref={innerRef}>
        <svg
          className="np-orb-svg"
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="np-orbGlow" cx="55%" cy="40%" r="60%">
              <stop offset="0" stopColor="#4C2C8A" stopOpacity="0.95" />
              <stop offset=".55" stopColor="#1F1040" stopOpacity="0.95" />
              <stop offset="1" stopColor="#0B0522" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="np-orbRim" cx="50%" cy="50%" r="50%">
              <stop offset=".85" stopColor="#A78BFA" stopOpacity="0" />
              <stop offset=".97" stopColor="#A78BFA" stopOpacity=".5" />
              <stop offset="1" stopColor="#A78BFA" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="np-orbHL" cx="30%" cy="25%" r="30%">
              <stop offset="0" stopColor="#E9D5FF" stopOpacity=".35" />
              <stop offset="1" stopColor="#E9D5FF" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="np-arcGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#C4B5FD" stopOpacity="0" />
              <stop offset=".5" stopColor="#F6F2FF" stopOpacity="1" />
              <stop offset="1" stopColor="#A78BFA" stopOpacity="0" />
            </linearGradient>
          </defs>

          <circle cx={CX} cy={CY} r={R} fill="url(#np-orbGlow)" />
          <circle cx={CX} cy={CY} r={R} fill="url(#np-orbHL)" />

          <g className="np-orb-rotate" style={{ transformOrigin: `${CX}px ${CY}px` }}>
            {orb.latitudes.map((pts, i) => (
              <polyline
                key={`lat${i}`}
                points={polyline(pts)}
                fill="none"
                stroke="#A78BFA"
                strokeWidth=".6"
                opacity=".22"
              />
            ))}
            {orb.longitudes.map((pts, i) => (
              <polyline
                key={`lon${i}`}
                points={polyline(pts)}
                fill="none"
                stroke="#A78BFA"
                strokeWidth=".6"
                opacity=".18"
              />
            ))}

            {orb.nodes.map((n, i) => {
              const p = project(n);
              const front = n.z > -0.1;
              const op = Math.max(0.2, (n.z + 1) / 2);
              const r = 1.6 + 2.4 * op;
              return (
                <g key={`n${i}`} className={`np-orb-node np-n${(i % 8) + 1}`}>
                  <circle cx={p.x} cy={p.y} r={r + 3} fill="#A78BFA" opacity={op * 0.25} />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={front ? "#F6F2FF" : "#A78BFA"}
                    opacity={op}
                  />
                </g>
              );
            })}

            {orb.arcs.map((a, i) => {
              const p1 = project(a.n1);
              const p2 = project(a.n2);
              const cp = project(a.cp);
              const d = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cp.x.toFixed(1)} ${cp.y.toFixed(
                1,
              )} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
              const dx1 = cp.x - p1.x;
              const dy1 = cp.y - p1.y;
              const dx2 = p2.x - cp.x;
              const dy2 = p2.y - cp.y;
              const len = Math.hypot(dx1, dy1) + Math.hypot(dx2, dy2);
              const avgZ = (a.n1.z + a.n2.z) / 2;
              const opacity = Math.max(0.15, (avgZ + 1) / 2);
              return (
                <g key={`a${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth=".8"
                    opacity={opacity * 0.25}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="url(#np-arcGrad)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className="np-arc"
                    style={
                      {
                        "--len": len,
                        "--dur": `${a.dur.toFixed(2)}s`,
                        animationDelay: `${a.delay.toFixed(2)}s`,
                        opacity,
                      } as React.CSSProperties
                    }
                  />
                </g>
              );
            })}
          </g>

          <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#np-orbRim)" strokeWidth="2" />
          <circle
            className="np-orb-core"
            cx={CX}
            cy={CY}
            r="24"
            fill="#C4B5FD"
            opacity=".35"
            filter="blur(12px)"
          />
          <circle cx={CX} cy={CY} r="5" fill="#F6F2FF" />
        </svg>
      </div>
    </div>
  );
}
