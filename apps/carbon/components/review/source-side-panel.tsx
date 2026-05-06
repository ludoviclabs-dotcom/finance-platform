"use client";

/**
 * SourceSidePanel — panneau latéral affichant les citations sources
 * d'un datapoint ESRS extrait.
 *
 * S'ouvre en glissant depuis la droite. Affiche pour chaque citation :
 *   - Nom du fichier (PDF, Excel, Word)
 *   - Page (PDF) ou feuille (Excel) d'origine
 *   - Extrait textuel mis en contexte
 *   - Lien vers le blob (ouverture dans un onglet)
 *
 * Usage :
 *   <SourceSidePanel
 *     datapointId="E1-6_scope1_gross"
 *     label="Émissions brutes scope 1"
 *     sources={[...]}
 *     onClose={() => setOpen(null)}
 *   />
 */

import {
  ExternalLink,
  FileText,
  TableProperties,
  X,
} from "lucide-react";
import type { SourceCitation } from "@/lib/esrs/schema";

interface SourceSidePanelProps {
  datapointId: string;
  label: string;
  standard: string;
  sources: SourceCitation[];
  onClose: () => void;
}

function fileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return <TableProperties className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden />;
  }
  return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" aria-hidden />;
}

function locationLabel(citation: SourceCitation): string {
  if (citation.page) return `Page ${citation.page}`;
  if (citation.sheet) return `Feuille « ${citation.sheet} »`;
  return "";
}

export function SourceSidePanel({
  datapointId,
  label,
  standard,
  sources,
  onClose,
}: SourceSidePanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        role="complementary"
        aria-label={`Citations sources — ${label}`}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-foreground-muted)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded">
                {standard}
              </span>
            </div>
            <h2 className="font-display font-bold text-sm text-[var(--color-foreground)] leading-snug">
              {label}
            </h2>
            <p className="text-[10px] text-[var(--color-foreground-muted)] font-mono mt-0.5 truncate">
              {datapointId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground-muted)]"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sources.length === 0 ? (
            <div className="text-center py-10 text-[var(--color-foreground-muted)] text-sm">
              Aucune source disponible pour ce datapoint.
            </div>
          ) : (
            sources.map((citation, index) => (
              <CitationCard key={index} citation={citation} index={index} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <p className="text-[10px] text-[var(--color-foreground-muted)] text-center">
            {sources.length} source{sources.length !== 1 ? "s" : ""} · extraites par copilote IA
          </p>
        </div>
      </aside>
    </>
  );
}

function CitationCard({
  citation,
  index,
}: {
  citation: SourceCitation;
  index: number;
}) {
  const loc = locationLabel(citation);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] overflow-hidden">
      {/* Citation header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <span className="text-[10px] font-bold text-[var(--color-foreground-muted)] tabular-nums w-4 text-center">
          {index + 1}
        </span>
        {fileIcon(citation.filename)}
        <span className="text-xs font-medium text-[var(--color-foreground)] truncate flex-1">
          {citation.filename}
        </span>
        {loc && (
          <span className="text-[10px] font-semibold text-[var(--color-foreground-muted)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded flex-shrink-0">
            {loc}
          </span>
        )}
        <a
          href={citation.blobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-[var(--color-foreground-muted)] hover:text-carbon-emerald transition-colors"
          title="Ouvrir le document source"
          aria-label={`Ouvrir ${citation.filename}`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Snippet */}
      <blockquote className="px-3 py-2.5">
        <p className="text-xs text-[var(--color-foreground)] leading-relaxed italic line-clamp-6">
          &ldquo;{citation.snippet}&rdquo;
        </p>
      </blockquote>
    </div>
  );
}
