import { LiveKpi } from "./shared/live-kpi";

export function SectionLiveData() {
  return (
    <section className="nhp-live-data section-dark">
      <div className="nhp-container">
        <div className="nhp-ld-grid">
          <div>
            <div className="eyebrow eyebrow-violet">Mesurer ce qui se passe</div>
            <h2 className="h-display h-tight">
              La valeur, mesurée.
              <br />
              <span className="muted-dark">Chaque heure, chaque tâche.</span>
            </h2>
            <p className="lead lead-dark">
              Chaque déploiement NEURAL embarque un dashboard DAF : heures économisées,
              tâches exécutées, consolidations livrées. L’aperçu ci-contre illustre le
              rendu visuel attendu avec des données de démonstration, avant cadrage et
              activation des KPI réels.
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
