import { CoverageGrid } from "@/components/coverage/coverage-grid";

export function SectionCoverageExplorer() {
  return (
    <section className="nhp-branches">
      <div className="nhp-container">
        <div className="nhp-section-head">
          <div className="eyebrow eyebrow-violet">Couverture</div>
          <h2 className="h-display h-tight">
            Une matrice unique, lue depuis la source de vérité.
          </h2>
          <p className="lead">
            Fini les représentations divergentes : la couverture publique est désormais générée
            depuis le registre d&apos;agents. Cliquez une cellule pour ouvrir la page secteur,
            filtrez par statut pour isoler ce qui est déjà testable.
          </p>
        </div>

        <div className="mt-10">
          <CoverageGrid />
        </div>
      </div>
    </section>
  );
}
