import { AgentGraph } from "./shared/agent-graph";
import { AndroidVisual } from "./shared/android-visual";

export function SectionOrchestration() {
  return (
    <section className="nhp-orch">
      <div className="nhp-container">
        <div className="nhp-orch-grid">
          <div className="nhp-orch-visual">
            <div className="nhp-orch-graph-wrap">
              <AgentGraph />
              <div className="nhp-orch-legend">
                <div><span className="nhp-dot nhp-dot-violet"/> 7 branches métier</div>
                <div><span className="nhp-dot nhp-dot-green"/> 6 secteurs</div>
                <div><span className="nhp-dot nhp-dot-white"/> agents par branche</div>
              </div>
            </div>
            <div className="nhp-orch-android">
              <AndroidVisual size={180} glow={true} />
            </div>
          </div>
          <div>
            <div className="eyebrow">L&apos;orchestration</div>
            <h2 className="h-display h-tight">
              Un agent seul résout une tâche.<br/>
              <span className="accent-violet">Orchestrés, ils résolvent votre entreprise.</span>
            </h2>
            <p className="lead">
              L&apos;agent Finance parle à l&apos;agent Compta, qui notifie l&apos;agent SI, qui déclenche
              l&apos;agent Supply. L&apos;orchestrateur Claude maintient la cohérence de bout en bout.
            </p>
            <div className="nhp-orch-facts">
              <div>
                <div className="nhp-of-k">42</div>
                <div className="nhp-of-l">combinaisons secteur × branche</div>
              </div>
              <div>
                <div className="nhp-of-k">1</div>
                <div className="nhp-of-l">orchestrateur Claude unique</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
