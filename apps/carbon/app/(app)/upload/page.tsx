"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  ChevronRight,
  Leaf,
  Scale,
  Banknote,
} from "lucide-react";
import { triggerIngest } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DomainKey = "carbon" | "esg" | "finance";

interface DomainFile {
  file: File | null;
  status: "idle" | "ok" | "error";
  detail?: string;
  url?: string;
}

interface UploadResult {
  status: "ok" | "partial" | "error";
  files: Array<{
    domain: string;
    status: "ok" | "error";
    url?: string;
    filename?: string;
    detail?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DOMAINS: {
  key: DomainKey;
  label: string;
  description: string;
  hint: string;
  Icon: React.ElementType;
  color: string;
}[] = [
  {
    key: "carbon",
    label: "Workbook Carbone",
    description: "Bilan GES Scope 1-2-3, énergie, Taxonomie, CBAM, SBTi",
    hint: "CarbonCo_Carbon_*.xlsx",
    Icon: Leaf,
    color: "text-emerald-500",
  },
  {
    key: "esg",
    label: "Workbook ESG",
    description: "VSME, double matérialité, scores E-S-G, contrôles qualité",
    hint: "CarbonCo_ESG_*.xlsx",
    Icon: Scale,
    color: "text-amber-500",
  },
  {
    key: "finance",
    label: "Workbook Finance",
    description: "Finance Climat, SFDR PAI, benchmark sectoriel",
    hint: "CarbonCo_Finance_*.xlsx",
    Icon: Banknote,
    color: "text-violet-500",
  },
];

const STEPS = ["Sélection", "Vérification", "Résultat"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Try localStorage key used by use-auth hook
  return localStorage.getItem("cc_token") ?? sessionStorage.getItem("cc_token");
}

// ---------------------------------------------------------------------------
// Drop zone for a single domain
// ---------------------------------------------------------------------------

function DomainDropZone({
  domain,
  state,
  onChange,
}: {
  domain: (typeof DOMAINS)[number];
  state: DomainFile;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const Icon = domain.Icon;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onChange(f);
    },
    [onChange],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative rounded-xl border-2 border-dashed p-5 cursor-pointer transition-all ${
        dragging
          ? "border-carbon-emerald bg-carbon-emerald/5"
          : state.file
            ? "border-[var(--color-border)] bg-[var(--color-surface)]"
            : "border-[var(--color-border)] hover:border-carbon-emerald/40 hover:bg-[var(--color-surface-raised)]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${domain.color}/10`}>
          <Icon className={`w-5 h-5 ${domain.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{domain.label}</p>
          <p className="text-xs text-[var(--color-foreground-muted)]">{domain.description}</p>
          <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-0.5 font-mono">{domain.hint}</p>
        </div>
        {state.file ? (
          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-semibold text-[var(--color-foreground)] truncate max-w-[120px]">
              {state.file.name}
            </p>
            <p className="text-[10px] text-[var(--color-foreground-muted)]">
              {formatSize(state.file.size)}
            </p>
          </div>
        ) : (
          <div className="flex-shrink-0">
            <Upload className="w-4 h-4 text-[var(--color-foreground-muted)]" />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UploadPage() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [files, setFiles] = useState<Record<DomainKey, DomainFile>>({
    carbon: { file: null, status: "idle" },
    esg: { file: null, status: "idle" },
    finance: { file: null, status: "idle" },
  });

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [ingesting, setIngesting] = useState(false);
  const [ingestDone, setIngestDone] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const selectedCount = Object.values(files).filter((f) => f.file !== null).length;
  const canProceed = selectedCount > 0;

  const handleFileChange = (domain: DomainKey, file: File | null) => {
    setFiles((prev) => ({ ...prev, [domain]: { file, status: "idle" } }));
  };

  // Step 0 → 1 : validation visuelle
  const handleReview = () => setStep(1);

  // Step 1 → upload
  const handleUpload = async () => {
    setUploading(true);
    setUploadError(null);

    const token = getAuthToken();
    const fd = new FormData();
    for (const d of DOMAINS) {
      if (files[d.key].file) fd.append(d.key, files[d.key].file!);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data: UploadResult = await res.json();
      setUploadResult(data);

      // Update per-domain status
      setFiles((prev) => {
        const next = { ...prev };
        for (const r of data.files) {
          const k = r.domain as DomainKey;
          if (next[k]) {
            next[k] = { ...next[k], status: r.status, detail: r.detail, url: r.url };
          }
        }
        return next;
      });

      setStep(2);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  // Step 2 : trigger re-ingest
  const handleIngest = async () => {
    setIngesting(true);
    setIngestError(null);
    try {
      await triggerIngest();
      setIngestDone(true);
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "Erreur inattendue");
    } finally {
      setIngesting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFiles({ carbon: { file: null, status: "idle" }, esg: { file: null, status: "idle" }, finance: { file: null, status: "idle" } });
    setUploadResult(null);
    setUploadError(null);
    setIngestDone(false);
    setIngestError(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <Upload className="w-6 h-6 text-carbon-emerald" />
          Import des workbooks Excel
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Uploadez vos 3 classeurs Excel maîtres pour mettre à jour tous les snapshots.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                i === step
                  ? "bg-carbon-emerald text-white"
                  : i < step
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
              }`}
            >
              {i < step ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-[var(--color-foreground-subtle)]" />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 0 : Sélection ── */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-foreground-muted)]">
            Glissez-déposez ou cliquez pour sélectionner chaque workbook. Vous pouvez n&apos;en
            uploader qu&apos;un seul si seul un domaine a changé.
          </p>
          {DOMAINS.map((d) => (
            <DomainDropZone
              key={d.key}
              domain={d}
              state={files[d.key]}
              onChange={(f) => handleFileChange(d.key, f)}
            />
          ))}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-[var(--color-foreground-muted)]">
              {selectedCount} fichier{selectedCount > 1 ? "s" : ""} sélectionné{selectedCount > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={handleReview}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Vérifier <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1 : Vérification ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
                Récapitulatif avant envoi
              </h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {DOMAINS.map((d) => {
                const f = files[d.key];
                const Icon = d.Icon;
                return (
                  <div key={d.key} className="p-4 flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${d.color} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">{d.label}</p>
                      {f.file ? (
                        <p className="text-xs text-[var(--color-foreground-muted)]">
                          {f.file.name} · {formatSize(f.file.size)}
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--color-foreground-subtle)] italic">
                          Non sélectionné — domaine ignoré
                        </p>
                      )}
                    </div>
                    {f.file ? (
                      <FileSpreadsheet className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] text-[var(--color-foreground-subtle)]">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Upload en cours…</>
              ) : (
                <><Upload className="w-4 h-4" /> Envoyer {selectedCount} fichier{selectedCount > 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 : Résultat ── */}
      {step === 2 && uploadResult && (
        <div className="space-y-4">
          {/* Upload results */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
                Résultats de l&apos;upload
              </h3>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  uploadResult.status === "ok"
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    : uploadResult.status === "partial"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                }`}
              >
                {uploadResult.status === "ok" ? "Complet" : uploadResult.status === "partial" ? "Partiel" : "Échec"}
              </span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {uploadResult.files.map((r) => {
                const domain = DOMAINS.find((d) => d.key === r.domain);
                const DIcon = domain?.Icon ?? FileSpreadsheet;
                return (
                  <div key={r.domain} className="p-4 flex items-center gap-3">
                    <DIcon className={`w-4 h-4 ${domain?.color ?? "text-[var(--color-foreground-muted)]"} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">
                        {domain?.label ?? r.domain}
                      </p>
                      {r.detail && (
                        <p className="text-xs text-[var(--color-danger)]">{r.detail}</p>
                      )}
                      {r.url && (
                        <p className="text-[10px] text-[var(--color-foreground-subtle)] font-mono truncate">{r.url}</p>
                      )}
                    </div>
                    {r.status === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Re-ingest trigger */}
          {uploadResult.status !== "error" && (
            <div className="rounded-2xl border border-carbon-emerald/30 bg-gradient-to-br from-carbon-emerald/10 to-cyan-500/5 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-carbon-emerald/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw className={`w-5 h-5 text-carbon-emerald ${ingesting ? "animate-spin" : ""}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-1">
                  Recalculer les snapshots
                </h3>
                <p className="text-xs text-[var(--color-foreground-muted)] mb-3">
                  Les fichiers ont été uploadés. Déclenchez maintenant le recalcul pour mettre à
                  jour tous les indicateurs du tableau de bord.
                </p>
                {ingestError && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-danger)]">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {ingestError}
                  </div>
                )}
                {ingestDone ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-success)] font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Snapshots recalculés avec succès
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleIngest}
                    disabled={ingesting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {ingesting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Recalcul en cours…</>
                    ) : (
                      <><RefreshCw className="w-4 h-4" /> Resynchroniser maintenant</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
