/**
 * /review — Page de review des datapoints ESRS (Chantier D).
 *
 * Permet aux auditeurs (analyst / admin) de valider, surcharger
 * ou rejeter les valeurs extraites par le copilote IA avant l'export iXBRL.
 *
 * Le composant DatapointReviewPage est un Client Component ("use client") —
 * il est rendu directement, sans wrapper dynamic. Cette page reste un Server
 * Component pour rester compatible Next.js 15 (où dynamic+ssr:false est
 * interdit dans les Server Components).
 */

import { DatapointReviewPage } from "@/components/pages/datapoint-review-page";

export default function ReviewPage() {
  return <DatapointReviewPage />;
}
