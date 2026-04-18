"use client";
import { useEffect, useState } from "react";

const lines = [
  { who: "claude", t: "Analyse du rapprochement bancaire Q1…" },
  { who: "claude", t: "→ 12 483 écritures parsées · 4 anomalies détectées" },
  { who: "user",   t: "Priorise par impact matériel" },
  { who: "claude", t: "Classement par impact P&L ▾" },
  { who: "out",    t: "ANOM-0412 · Fournisseur DHL · +38 402 € · IFRS 15" },
  { who: "out",    t: "ANOM-0287 · Ecart FX USD/EUR · -12 108 € · IAS 21" },
  { who: "claude", t: "Rapport généré · PDF prêt · CFO notifié" },
] as const;

type LineWho = (typeof lines)[number]["who"];

export function AgentChat() {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setShown((s) => s >= lines.length ? 1 : s + 1), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="nhp-chat">
      <div className="nhp-chat-head">
        <div className="nhp-chat-dot" />
        Agent Compta · Consolidation
        <span className="nhp-chat-tag">claude-sonnet</span>
      </div>
      <div className="nhp-chat-body">
        {(lines.slice(0, shown) as readonly { who: LineWho; t: string }[]).map((l, i) => (
          <div key={i} className={`nhp-chat-line nhp-chat-${l.who}`}>
            {l.who === "claude" && <span className="nhp-chat-badge">AI</span>}
            {l.who === "user"   && <span className="nhp-chat-badge nhp-chat-badge-user">Toi</span>}
            {l.who === "out"    && <span className="nhp-chat-badge nhp-chat-badge-out">→</span>}
            <span>{l.t}</span>
          </div>
        ))}
        {shown < lines.length && (
          <div className="nhp-chat-typing">
            <span/><span/><span/>
          </div>
        )}
      </div>
    </div>
  );
}
