/**
 * ProvenanceRefs — trace la provenance d'une composante par ses
 * `source_release_id` (Module 2, PR-M2C).
 *
 * « Sourcé-ou-avoué » : une composante sans release est affichée comme telle,
 * jamais masquée. Les IDs de release renvoient au module Source Admin
 * (`/intelligence/sources`) où EvidenceList détaille checksum + date.
 */

import Link from "next/link";

export function ProvenanceRefs({
  releaseIds,
  className = "",
  testId = "provenance-refs",
}: {
  releaseIds: number[];
  className?: string;
  testId?: string;
}) {
  if (!releaseIds || releaseIds.length === 0) {
    return (
      <span
        className={`text-[11px] italic text-[var(--color-muted-foreground)] ${className}`}
        data-testid={`${testId}-none`}
      >
        Aucune source (composante avouée, non sourcée)
      </span>
    );
  }
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 ${className}`}
      data-testid={testId}
    >
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        Provenance
      </span>
      {releaseIds.map((id) => (
        <Link
          key={id}
          href="/intelligence/sources"
          className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] hover:border-emerald-500/50"
          title={`Release #${id} — détail dans Source Admin`}
        >
          release&nbsp;#{id}
        </Link>
      ))}
    </span>
  );
}

export default ProvenanceRefs;
