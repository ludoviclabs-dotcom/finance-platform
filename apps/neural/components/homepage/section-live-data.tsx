import { LiveKpi } from "./shared/live-kpi";

export function SectionLiveData() {
  return (
    <section className="nhp-live-data section-dark">
      <div className="nhp-container">
        <div className="nhp-ld-grid">
          <div>
            <div className="eyebrow eyebrow-violet">Preuve en temps réel</div>
            <h2 className="h-display h-tight">
              La valeur, mesurée.<br/>
              <span className="muted-dark">Chaque heure, chaque tâche.</span>
            </h2>
            <p className="lead lead-dark">
              Aucune promesse. Un dashboard qui compte les heures économisées, les tâches
              exécutées, le ROI annualisé. Consultable par votre DAF à tout moment.
            </p>
          </div>
          <div className="nhp-ld-kpi">
            <LiveKpi />
          </div>
        </div>
      </div>
    </section>
  );
}
