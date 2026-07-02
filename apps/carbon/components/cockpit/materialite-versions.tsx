"use client";

/**
 * Panneau « Versions archivées » de la double matérialité (T7.4).
 *
 * Les auditeurs attendent une évaluation de matérialité révisée annuellement
 * et ARCHIVÉE : ce panneau permet de figer l'évaluation courante en version
 * immuable (positions + scoring snapshotés côté API) et d'exporter chaque
 * version en ZIP auditable (PDF + manifest vérifiable sur /verify).
 */

import { useCallback, useEffect, useState } from "react";
import { Archive, Download, Loader2 } from "lucide-react";

import {
  createMaterialiteAssessment,
  downloadMaterialiteAssessment,
  fetchMaterialiteAssessments,
  type MaterialiteAssessment,
} from "@/lib/api";

export function MaterialiteVersions({ sector }: { sector: string }) {
  const [versions, setVersions] = useState<MaterialiteAssessment[]>([]);
  const [freezing, setFreezing] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  const reload = useCallback(() => {
    fetchMaterialiteAssessments()
      .then(setVersions)
      .catch(() => setVersions([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const freeze = async () => {
    setFreezing(true);
    try {
      await createMaterialiteAssessment({
        label: `Évaluation ${new Date().getFullYear()}`,
        sector,
      });
      reload();
    } catch {
      /* le bandeau d'erreur global de la page couvre les échecs répétés */
    } finally {
      setFreezing(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--cc-border)] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div>
          <p className="text-sm font-semibold text-[var(--cc-fg)]">Versions archivées</p>
          <p className="text-xs text-[var(--cc-subtle)]">
            Figez l&apos;évaluation pour l&apos;exercice (immuable) — export PDF auditable,
            vérifiable sur /verify. Révision annuelle attendue par les auditeurs.
          </p>
        </div>
        <button
          type="button"
          onClick={freeze}
          disabled={freezing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--cc-border)] text-sm text-[var(--cc-fg)] hover:bg-[var(--cc-surface-2)] transition-colors disabled:opacity-40"
        >
          {freezing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
          Figer l&apos;évaluation courante
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="text-xs text-[var(--cc-muted)]">Aucune version archivée pour le moment.</p>
      ) : (
        <div className="space-y-1.5">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 text-sm border-b border-[var(--cc-border)] last:border-0 pb-1.5"
            >
              <span className="min-w-0">
                <span className="font-medium text-[var(--cc-fg)]">{v.label}</span>
                <span className="ml-2 text-xs text-[var(--cc-subtle)]">
                  {new Date(v.created_at).toLocaleDateString("fr-FR")} ·{" "}
                  {v.total_materiel}/{v.total_issues} matériels · seuil {v.threshold}
                </span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  setDownloading(v.id);
                  try {
                    await downloadMaterialiteAssessment(v.id);
                  } catch {
                    /* silencieux — bouton réactivable */
                  } finally {
                    setDownloading(null);
                  }
                }}
                disabled={downloading === v.id}
                className="flex items-center gap-1.5 text-xs text-[var(--cc-muted)] hover:text-[var(--cc-fg)] disabled:opacity-40 shrink-0"
              >
                {downloading === v.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Export auditable
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
