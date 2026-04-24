"use client";

import { useState } from "react";

import { ABOUT_COPY } from "./about-data";

export function ProofConsole() {
  const proof = ABOUT_COPY.proof;
  const [agentId, setAgentId] = useState(proof.agents[0].id);
  const agent = proof.agents.find((a) => a.id === agentId) ?? proof.agents[0];
  const demo = proof.demos[agentId as keyof typeof proof.demos];

  return (
    <div className="np-console np-reveal">
      <aside className="np-console-side">
        <div className="np-side-label">{proof.labelAgents}</div>
        {proof.agents.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`np-agent-tab${agentId === a.id ? " np-on" : ""}`}
            onClick={() => setAgentId(a.id)}
            aria-pressed={agentId === a.id}
          >
            <span className="np-g">{a.g}</span>
            <span>
              <div className="np-n">{a.name}</div>
              <div className="np-s">{a.state}</div>
            </span>
          </button>
        ))}
      </aside>

      <div className="np-console-main" key={agentId}>
        <div className="np-console-header">
          <h3>
            {agent.name} <span className="np-it">agent.</span>
          </h3>
          <div className="np-meta">
            <div className="np-live">● {proof.live}</div>
            <div>{demo.meta}</div>
          </div>
        </div>

        <div className="np-console-prompt">{demo.prompt}</div>

        <div className="np-kpis">
          {demo.kpis.map((k, i) => (
            <div key={i} className="np-kpi">
              <div className="np-k">{k.k}</div>
              <div className="np-v">
                {k.v}
                {k.u && <span className="np-u">{k.u}</span>}
              </div>
              <div className="np-d" dangerouslySetInnerHTML={{ __html: k.d }} />
            </div>
          ))}
        </div>

        <div className="np-ladder">
          <div className="np-ladder-title">↳ {proof.ladderTitle}</div>
          {demo.ladder.map((r, i) => (
            <div key={i} className="np-rung">
              <span className="np-stage">{r.s}</span>
              <span className="np-t" dangerouslySetInnerHTML={{ __html: r.t }} />
              <span className={`np-pill np-${r.c}`}>{r.p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
