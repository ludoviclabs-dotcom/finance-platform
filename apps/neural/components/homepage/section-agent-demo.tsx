import { AgentChat } from "./shared/agent-chat";

export function SectionAgentDemo() {
  return (
    <section className="nhp-agent-demo section-dark">
      <div className="nhp-container">
        <div className="nhp-agent-grid">
          <div>
            <div className="eyebrow eyebrow-violet">Un agent au travail</div>
            <h2 className="h-display h-tight">
              Ce n&apos;est pas un chatbot.<br/>
              <span className="muted-dark">C&apos;est un opérateur.</span>
            </h2>
            <p className="lead lead-dark">
              Chaque agent Claude est connecté à vos systèmes, reçoit vos requêtes métier,
              exécute dans vos outils, et rend compte. Aucun prompt à écrire — vos équipes
              parlent en français, l&apos;agent agit.
            </p>
            <ul className="nhp-agent-list">
              <li>
                <div className="nhp-adl-k">01</div>
                <div><strong>Reçoit</strong> une requête métier en langage naturel</div>
              </li>
              <li>
                <div className="nhp-adl-k">02</div>
                <div><strong>Agit</strong> dans votre ERP, CRM, ou data warehouse</div>
              </li>
              <li>
                <div className="nhp-adl-k">03</div>
                <div><strong>Rend compte</strong> avec une trace auditable et un KPI</div>
              </li>
            </ul>
          </div>
          <div>
            <AgentChat />
            <div className="nhp-ad-flags">
              <span className="nhp-ad-flag"><span className="nhp-dot nhp-dot-green"/> Audit trail</span>
              <span className="nhp-ad-flag"><span className="nhp-dot nhp-dot-violet"/> SOC 2 Type II</span>
              <span className="nhp-ad-flag"><span className="nhp-dot nhp-dot-white"/> GDPR</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
