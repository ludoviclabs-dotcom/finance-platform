/**
 * EvidenceList — liste les releases d'une source avec leur statut + checksum
 * tronqué (PR-04). Sert de « preuve » minimale : chaque valeur affichée dérive
 * d'une release datée + checksum, jamais d'un fichier anonyme.
 */

import type { Release, ReleaseStatus } from "@/lib/api/intelligence";

const STATUS_LABEL: Record<ReleaseStatus, { label: string; cls: string }> = {
  detected: { label: "Détectée", cls: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30" },
  quarantined: { label: "Quarantaine", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  validated: { label: "Validée", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  published: { label: "Publiée", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  superseded: { label: "Remplacée", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  blocked_license: { label: "Bloquée (licence)", cls: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

interface Props {
  releases: Release[];
  emptyLabel?: string;
}

export function EvidenceList({ releases, emptyLabel = "Aucune release enregistrée." }: Props) {
  if (releases.length === 0) {
    return <p className="text-sm text-zinc-500" data-testid="evidence-list-empty">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto" data-testid="evidence-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-4 font-semibold">Release</th>
            <th className="py-2 pr-4 font-semibold">Statut</th>
            <th className="py-2 pr-4 font-semibold">Checksum</th>
            <th className="py-2 pr-4 font-semibold">Publiée</th>
          </tr>
        </thead>
        <tbody>
          {releases.map((r) => {
            const s = STATUS_LABEL[r.status];
            return (
              <tr key={r.id} className="border-b border-zinc-900">
                <td className="py-2 pr-4 font-medium text-zinc-200">{r.release_key}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-[11px] text-zinc-500" title={r.checksum_sha256}>
                  {r.checksum_sha256.slice(0, 12)}…
                </td>
                <td className="py-2 pr-4 text-zinc-400">{fmtDate(r.published_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default EvidenceList;
