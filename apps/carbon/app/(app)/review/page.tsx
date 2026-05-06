/**
 * /review — Page de review des datapoints ESRS (Chantier D).
 *
 * Permet aux auditeurs (analyst / admin) de valider, surcharger
 * ou rejeter les valeurs extraites par le copilote IA avant l'export iXBRL.
 *
 * Importation dynamique (SSR désactivé) car la page lit le token JWT
 * depuis le state client et effectue des appels fetch côté navigateur.
 */

import dynamic from "next/dynamic";

const DatapointReviewPage = dynamic(
  () =>
    import("@/components/pages/datapoint-review-page").then(
      (mod) => mod.DatapointReviewPage,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-[var(--color-foreground-muted)] text-sm">
        <span className="animate-pulse">Chargement de la revue…</span>
      </div>
    ),
  },
);

export default function ReviewPage() {
  return <DatapointReviewPage />;
}
