/**
 * DocumentsGrid — documents publics téléchargeables.
 * Placeholders honnêtes : si le document n'est pas encore signé,
 * il est marqué "En préparation" plutôt que de proposer un faux PDF.
 */

import { FileText, Download, Clock } from "lucide-react";

interface PublicDocument {
  id: string;
  title: string;
  description: string;
  status: "available" | "preparing";
  url?: string;
  size?: string;
  format: string;
}

const DOCUMENTS: PublicDocument[] = [
  {
    id: "dpa",
    title: "Data Processing Agreement (DPA)",
    description:
      "Annexe contractuelle RGPD art. 28 — gabarit signable lors de l'engagement client.",
    status: "preparing",
    format: "PDF · v1.0",
  },
  {
    id: "ai-charter",
    title: "Charte IA Responsable",
    description:
      "Engagements de gouvernance, transparence, supervision humaine et limites assumées.",
    status: "preparing",
    format: "PDF · v1.0",
  },
  {
    id: "bcp",
    title: "Plan de Continuité d'Activité (résumé public)",
    description:
      "Stratégie de reprise, RPO/RTO cibles, fréquence des tests de bascule.",
    status: "preparing",
    format: "PDF · résumé public",
  },
  {
    id: "incident-policy",
    title: "Politique de notification d'incident",
    description:
      "Délais de notification (72h pour atteinte aux données), canaux, escalade client.",
    status: "preparing",
    format: "PDF · v1.0",
  },
];

export function DocumentsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DOCUMENTS.map((doc) => (
        <div
          key={doc.id}
          className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/[0.10] text-violet-200">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                doc.status === "available"
                  ? "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300"
                  : "border-amber-400/25 bg-amber-400/[0.10] text-amber-200"
              }`}
            >
              {doc.status === "available" ? (
                <>
                  <Download className="h-3 w-3" aria-hidden="true" />
                  Disponible
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  En préparation
                </>
              )}
            </span>
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-tight text-white">
              {doc.title}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/40">
              {doc.format}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-white/60">{doc.description}</p>
          {doc.status === "available" && doc.url ? (
            <a
              href={doc.url}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-violet-100"
            >
              Télécharger {doc.size ? <span className="text-white/40">({doc.size})</span> : null}
            </a>
          ) : (
            <a
              href="/contact"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-violet-100"
            >
              Demander une copie sur engagement →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
