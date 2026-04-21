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
              Un agent couvre une tâche.<br/>
              <span className="accent-violet">Plusieurs agents coordonnés couvrent un processus.</span>
            </h2>
            <p className="lead">
              Chaque agent reste spécialisé sur un périmètre clair. Un orchestrateur commun
              passe le contexte d&apos;un agent à l&apos;autre, conserve la trace des décisions et
              s&apos;arrête quand un jalon critique demande une validation humaine.
            </p>
            <div className="nhp-orch-facts">
              <div>
                <div className="nhp-of-k">42</div>
                <div className="nhp-of-l">combinaisons secteur × branche</div>
              </div>
              <div>
                <div className="nhp-of-k">1</div>
                <div className="nhp-of-l">orchestrateur commun</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
