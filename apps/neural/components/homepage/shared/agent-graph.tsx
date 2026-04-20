"use client";
import { useEffect, useState } from "react";

export function AgentGraph() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const nodes = [
    { id: "rh",   x: 20, y: 30, label: "RH" },
    { id: "fin",  x: 80, y: 25, label: "Finance" },
    { id: "mkt",  x: 15, y: 75, label: "Marketing" },
    { id: "si",   x: 85, y: 80, label: "SI" },
    { id: "sup",  x: 50, y: 10, label: "Supply" },
    { id: "comm", x: 50, y: 90, label: "Comms" },
    { id: "cor",  x: 50, y: 50, label: "Orchestrator", core: true },
  ] as const;

  const edges: [string, string][] = [
    ["rh","cor"],["fin","cor"],["mkt","cor"],["si","cor"],["sup","cor"],["comm","cor"],
    ["rh","fin"],["mkt","comm"],["si","sup"],
  ];

  return (
    <svg viewBox="0 0 100 100" className="nhp-agent-graph" preserveAspectRatio="none">
      <defs>
        <radialGradient id="nhp-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.9"/>
          <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {edges.map(([a, b], i) => {
        const n1 = nodes.find(n => n.id === a)!;
        const n2 = nodes.find(n => n.id === b)!;
        return (
          <g key={i}>
            <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="rgba(167,139,250,0.25)" strokeWidth="0.25"/>
            <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#A78BFA" strokeWidth="0.4"
              strokeDasharray="2 8"
              style={{ animation: `nhp-dashFlow 2s linear infinite`, animationDelay: `${i * 0.2}s` }}
            />
          </g>
        );
      })}
      <circle cx="50" cy="50" r="14" fill="url(#nhp-core-glow)" opacity={0.6 + 0.3 * Math.sin(tick)}/>
      {nodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={"core" in n && n.core ? 3 : 1.8} fill={"core" in n && n.core ? "#A78BFA" : "#fff"} stroke="#A78BFA" strokeWidth="0.3"/>
          {"core" in n && n.core
            ? <text x={n.x} y={n.y - 5} fontSize="2.2" textAnchor="middle" fill="rgba(255,255,255,0.9)">{n.label}</text>
            : <text x={n.x} y={n.y - 3} fontSize="2.2" textAnchor="middle" fill="rgba(255,255,255,0.6)">{n.label}</text>
          }
        </g>
      ))}
    </svg>
  );
}
