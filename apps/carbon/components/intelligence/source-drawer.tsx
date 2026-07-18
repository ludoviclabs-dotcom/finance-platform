"use client";

/**
 * SourceDrawer — panneau de provenance d'une source (PR-04).
 *
 * Contrôlé (`open`/`onClose`), présentationnel : reçoit la provenance déjà
 * résolue (locale OU issue de l'API) et l'affiche — code source, éditeur,
 * release datée, checksum tronqué, fraîcheur, licence. Ne fetch rien lui-même,
 * pour rester utilisable sur `/materials` (données locales, fallback préservé)
 * comme sur la page Source Admin (données API).
 */

import { useEffect } from "react";
import { DataStatusBadge, type DataStatus } from "@/components/ui/data-status-badge";
import { LicenseWarning } from "./license-warning";
import { StalenessWarning } from "./staleness-warning";

export interface SourceProvenance {
  title: string;
  code: string;
  publisher?: string | null;
  releaseKey?: string | null;
  badgeStatus: DataStatus;
  badgeLabel?: string;
  isStale: boolean;
  ageDays?: number | null;
  lastReleaseAt?: string | null;
  attribution?: string | null;
  checksum?: string | null;
  license?: {
    ok: boolean;
    allowDisplay?: boolean;
    allowDerivedUse?: boolean;
    reasons?: string[];
    warnings?: string[];
  } | null;
}

interface Props extends SourceProvenance {
  open: boolean;
  onClose: () => void;
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-zinc-800/60">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={`text-sm text-zinc-200 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}

export function SourceDrawer({
  open,
  onClose,
  title,
  code,
  publisher,
  releaseKey,
  badgeStatus,
  badgeLabel,
  isStale,
  ageDays = null,
  lastReleaseAt = null,
  attribution,
  checksum,
  license,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Provenance : ${title}`}
      data-testid="source-drawer"
    >
      <button
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer le panneau de provenance"
        onClick={onClose}
      />
      <aside className="relative w-full max-w-md h-full overflow-y-auto bg-zinc-950 border-l border-zinc-800 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Provenance</p>
            <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition text-xl leading-none"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="mb-3">
          <DataStatusBadge status={badgeStatus} label={badgeLabel} size="sm" />
        </div>

        <StalenessWarning isStale={isStale} ageDays={ageDays} lastReleaseAt={lastReleaseAt} className="mb-3" />

        <div className="space-y-0">
          <Row label="Code source" value={code} />
          {publisher && <Row label="Éditeur" value={publisher} />}
          {releaseKey && <Row label="Release" value={releaseKey} />}
          {checksum && <Row label="Checksum SHA-256" value={`${checksum.slice(0, 24)}…`} mono />}
          {attribution && <Row label="Attribution" value={attribution} />}
        </div>

        {license && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Licence</p>
            <LicenseWarning
              licenseOk={license.ok}
              allowDisplay={license.allowDisplay}
              allowDerivedUse={license.allowDerivedUse}
              reasons={license.reasons}
              warnings={license.warnings}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

export default SourceDrawer;
