"use client";

/**
 * ExportPackageCard — bouton pour générer un package ZIP auditable + liste des packages existants.
 *
 * À inclure dans /revue ou /reports. Rôle analyst+ requis côté API.
 */

import { CheckCircle2, Copy, Download, Loader2, Package, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  downloadExportPackage,
  fetchExportPackages,
  type ExportPackageListItem,
} from "@/lib/api";

type Domain = "consolidated" | "carbon" | "esg" | "finance";

export function ExportPackageCard() {
  const [packages, setPackages] = useState<ExportPackageListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedHash, setLastGeneratedHash] = useState<string | null>(null);
  const [domain, setDomain] = useState<Domain>("consolidated");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchExportPackages({ limit: 10 });
      setPackages(res.items);
    } catch {
      // silencieux (la liste peut être vide ou DB absente)
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleExport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { blob, filename, packageHash } = await downloadExportPackage(domain, true);
      // Trigger download navigateur
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setLastGeneratedHash(packageHash);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de génération");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="export-package-card"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--color-foreground)] flex items-center gap-2">
            <Package className="w-5 h-5 text-carbon-emerald" aria-hidden />
            Export auditable
          </h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
            Génère un ZIP signé (manifest SHA-256) contenant l&apos;historique
            vérifiable de vos KPIs, prêt à partager avec un auditeur.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
          Domaine :
        </label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value as Domain)}
          className="px-2 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-foreground)]"
          data-testid="export-domain-select"
        >
          <option value="consolidated">Consolidé (tous)</option>
          <option value="carbon">Carbon uniquement</option>
          <option value="esg">ESG uniquement</option>
          <option value="finance">Finance uniquement</option>
        </select>

        <button
          onClick={handleExport}
          disabled={generating}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-carbon-emerald text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          data-testid="generate-export-button"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <Download className="w-4 h-4" aria-hidden />
          )}
          <span>{generating ? "Génération…" : "Générer le package"}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 mb-4 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {lastGeneratedHash && (
        <div
          className="rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/5 p-3 mb-4"
          data-testid="last-generated"
        >
          <div className="flex items-center gap-2 text-sm text-[var(--color-success)] font-medium">
            <CheckCircle2 className="w-4 h-4" aria-hidden />
            Package téléchargé
          </div>
          <HashLine hash={lastGeneratedHash} />
        </div>
      )}

      {/* Historical packages */}
      <div className="pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]">
            Packages générés ({packages.length})
          </h4>
          <button
            onClick={refresh}
            className="text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
            data-testid="refresh-packages"
          >
            {loadingList ? "…" : "↻"}
          </button>
        </div>

        {packages.length === 0 ? (
          <p className="text-xs text-[var(--color-foreground-subtle)] italic" data-testid="export-empty">
            Aucun package généré — cliquez sur « Générer le package » pour créer le premier.
          </p>
        ) : (
          <ul className="space-y-2">
            {packages.map((pkg) => (
              <li
                key={pkg.id}
                className="text-xs p-2 rounded-md bg-[var(--color-surface-muted)] flex items-start gap-2"
                data-testid={`export-row-${pkg.id}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-carbon-emerald flex-shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-[var(--color-foreground-muted)]">
                      {new Date(pkg.generated_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-[10px] text-[var(--color-foreground-subtle)]">
                      {pkg.domain} · {(pkg.size_bytes / 1024).toFixed(1)} Ko ·{" "}
                      {pkg.event_count} events
                    </span>
                  </div>
                  <HashLine hash={pkg.package_hash} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HashLine({ hash, compact = false }: { hash: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const short = compact ? `${hash.slice(0, 12)}…${hash.slice(-6)}` : hash;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silencieux
    }
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "mt-0.5" : "mt-2"}`}>
      <code
        className={`font-mono ${
          compact ? "text-[10px]" : "text-xs"
        } bg-[var(--color-surface)] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-foreground-muted)] truncate`}
      >
        {short}
      </code>
      <button
        onClick={copy}
        className="text-[10px] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] inline-flex items-center gap-1"
        title={`Copier ${hash}`}
      >
        {copied ? (
          <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" aria-hidden />
        ) : (
          <Copy className="w-3 h-3" aria-hidden />
        )}
      </button>
    </div>
  );
}
