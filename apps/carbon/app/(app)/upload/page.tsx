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
  Eye,
  ShieldCheck,
  Info,
} from "lucide-react";
import {
  triggerIngest,
  previewExcel,
  validateExcel,
  type ExcelPreviewResponse,
  type ExcelValidateResponse,
  type ValidationIssue,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DomainKey = "carbon" | "esg" | "finance";

interface DomainFile {
  file: File | null;
  status: "idle" | "ok" | "error";
  detail?: string;
  url?: string;
  preview?: ExcelPreviewResponse;
  validation?: ExcelValidateResponse;
  previewing?: boolean;
  validating?: boolean;
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

// 5 steps: 0=Sélection 1=Prévisualisation 2=Validation 3=Upload 4=Résultat
const STEPS = ["Sélection", "Aperçu", "Validation", "Envoi", "Résultat"] as const;

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
  return localStorage.getItem("cc_token") ?? sessionStorage.getItem("cc_token");
}

// ---------------------------------------------------------------------------
// Issue badge
// ---------------------------------------------------------------------------

function IssueBadge({ issue }: { issue: ValidationIssue }) {
  const cfg =
    issue.level === "error"
      ? { bg: "bg-[var(--color-danger-bg)]", text: "text-[var(--color-danger)]", Icon: XCircle }
      : issue.level === "warning"
        ? { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", Icon: AlertTriangle }
        : { bg: "bg-[var(--color-surface-raised)]", text: "text-[var(--color-foreground-muted)]", Icon: Info };
  const { bg, text, Icon } = cfg;
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${text}`}>{issue.message}</p>
        {(issue.sheet || issue.field) && (
          <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-0.5">
            {issue.sheet && <span>Feuille : <span className="font-mono">{issue.sheet}</span></span>}
            {issue.sheet && issue.field && " · "}
            {issue.field && <span>Champ : <span className="font-mono">{issue.field}</span></span>}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop zone
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
        aria-label={`Sélectionner ${domain.label}`}
        title={`Sélectionner ${domain.label}`}
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
// Preview panel for one file
// ---------------------------------------------------------------------------

function PreviewPanel({ state, domain }: { state: DomainFile; domain: (typeof DOMAINS)[number] }) {
  const pr = state.preview;
  if (state.previewing) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-[var(--color-foreground-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
      </div>
    );
  }
  if (!pr) return null;

  return (
    <div className="space-y-2">
      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-[var(--color-foreground-muted)]">
          <span className="font-semibold">{pr.sheet_count}</span> feuille{pr.sheet_count > 1 ? "s" : ""}
        </span>
        <span className="text-xs text-[var(--color-foreground-muted)]">
          <span className="font-semibold">{pr.named_ranges.length}</span> plage{pr.named_ranges.length > 1 ? "s" : ""} nommée{pr.named_ranges.length > 1 ? "s" : ""}
        </span>
        {pr.detected_domain && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-carbon-emerald/15 text-carbon-emerald-light font-semibold">
            Domaine détecté : {pr.detected_domain}
          </span>
        )}
      </div>

      {/* Sheet list */}
      <div className="space-y-2">
        {pr.sheets.map((sheet) => (
          <div key={sheet.name} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
            <div className="px-3 py-2 bg-[var(--color-surface-raised)] flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-foreground)]">{sheet.name}</span>
              <span className="text-[10px] text-[var(--color-foreground-muted)]">
                {sheet.row_count ?? "?"} lignes · {sheet.col_count ?? "?"} col.
              </span>
            </div>
            {sheet.headers.length > 0 && (
              <div className="p-2 overflow-x-auto">
                <table className="text-[10px] text-[var(--color-foreground-muted)] w-full">
                  <thead>
                    <tr>
                      {sheet.headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="text-left px-1.5 py-1 font-semibold truncate max-w-[100px]">
                          {h || <span className="text-[var(--color-foreground-subtle)] italic">vide</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.sample_rows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-[var(--color-surface)]" : ""}>
                        {(row as unknown[]).slice(0, 6).map((cell, ci) => (
                          <td key={ci} className="px-1.5 py-1 truncate max-w-[100px]">
                            {cell !== null && cell !== undefined ? String(cell) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation panel for one file
// ---------------------------------------------------------------------------

function ValidationPanel({ state }: { state: DomainFile }) {
  const val = state.validation;
  if (state.validating) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-[var(--color-foreground-muted)]">
        <Loader2 className="w-4 h-4 animate-spin" /> Validation en cours…
      </div>
    );
  }
  if (!val) return null;

  const statusCfg = {
    ok: { bg: "bg-[var(--color-success-bg)]", text: "text-[var(--color-success)]", label: "Valide" },
    warning: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", label: "Avertissements" },
    error: { bg: "bg-[var(--color-danger-bg)]", text: "text-[var(--color-danger)]", label: "Erreurs bloquantes" },
  }[val.status];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
          {statusCfg.label}
        </span>
        {val.sheets_found.length > 0 && (
          <span className="text-[10px] text-[var(--color-foreground-muted)]">
            {val.sheets_found.length} feuilles trouvées
          </span>
        )}
        {val.named_ranges_found.length > 0 && (
          <span className="text-[10px] text-[var(--color-foreground-muted)]">
            {val.named_ranges_found.length} plages nommées
          </span>
        )}
      </div>

      {val.issues.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-success)]">
          <CheckCircle2 className="w-4 h-4" />
          Aucun problème détecté
        </div>
      ) : (
        <div className="space-y-1.5">
          {val.issues.map((issue, i) => (
            <IssueBadge key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UploadPage() {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
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

  const selectedFiles = DOMAINS.filter((d) => files[d.key].file !== null);
  const selectedCount = selectedFiles.length;
  const canProceed = selectedCount > 0;

  // Has blocking errors in any validated file
  const hasBlockingErrors = selectedFiles.some(
    (d) => files[d.key].validation?.status === "error",
  );

  const handleFileChange = (domain: DomainKey, file: File | null) => {
    setFiles((prev) => ({ ...prev, [domain]: { file, status: "idle" } }));
  };

  // Step 0 → 1 : launch preview for selected files
  const handleGoPreview = async () => {
    // Mark as previewing
    setFiles((prev) => {
      const next = { ...prev };
      for (const d of DOMAINS) {
        if (prev[d.key].file) next[d.key] = { ...prev[d.key], previewing: true };
      }
      return next;
    });
    setStep(1);

    // Fetch previews in parallel
    await Promise.all(
      DOMAINS.filter((d) => files[d.key].file).map(async (d) => {
        try {
          const pr = await previewExcel(files[d.key].file!, d.key);
          setFiles((prev) => ({ ...prev, [d.key]: { ...prev[d.key], previewing: false, preview: pr } }));
        } catch {
          setFiles((prev) => ({ ...prev, [d.key]: { ...prev[d.key], previewing: false } }));
        }
      }),
    );
  };

  // Step 1 → 2 : launch validation for selected files
  const handleGoValidate = async () => {
    setFiles((prev) => {
      const next = { ...prev };
      for (const d of DOMAINS) {
        if (prev[d.key].file) next[d.key] = { ...prev[d.key], validating: true };
      }
      return next;
    });
    setStep(2);

    await Promise.all(
      DOMAINS.filter((d) => files[d.key].file).map(async (d) => {
        try {
          const val = await validateExcel(files[d.key].file!, d.key);
          setFiles((prev) => ({ ...prev, [d.key]: { ...prev[d.key], validating: false, validation: val } }));
        } catch {
          setFiles((prev) => ({ ...prev, [d.key]: { ...prev[d.key], validating: false } }));
        }
      }),
    );
  };

  // Step 2 → 3 → 4 : upload
  const handleUpload = async () => {
    setStep(3);
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

      setStep(4);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  // Step 4 : trigger re-ingest
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
          Uploadez vos classeurs Excel maîtres — l&apos;assistant vérifie la structure avant l&apos;envoi.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 flex-wrap">
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
            importer qu&apos;un seul si seul un domaine a changé.
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
              onClick={handleGoPreview}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Prévisualiser <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1 : Prévisualisation ── */}
      {step === 1 && (
        <div className="space-y-4">
          {selectedFiles.map((d) => {
            const state = files[d.key];
            const Icon = d.Icon;
            return (
              <div key={d.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${d.color}`} />
                  <h3 className="text-sm font-semibold text-[var(--color-foreground)] flex-1">{d.label}</h3>
                  <span className="text-xs text-[var(--color-foreground-muted)]">{state.file?.name}</span>
                </div>
                <div className="p-4">
                  <PreviewPanel state={state} domain={d} />
                </div>
              </div>
            );
          })}

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
              onClick={handleGoValidate}
              disabled={selectedFiles.some((d) => files[d.key].previewing)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" /> Valider la structure
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 : Validation ── */}
      {step === 2 && (
        <div className="space-y-4">
          {selectedFiles.map((d) => {
            const state = files[d.key];
            const Icon = d.Icon;
            return (
              <div key={d.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${d.color}`} />
                  <h3 className="text-sm font-semibold text-[var(--color-foreground)] flex-1">{d.label}</h3>
                  {state.validation && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      state.validation.status === "ok"
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                        : state.validation.status === "warning"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                    }`}>
                      {state.validation.status === "ok" ? "OK" : state.validation.status === "warning" ? "Warnings" : "Erreurs"}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <ValidationPanel state={state} />
                </div>
              </div>
            );
          })}

          {hasBlockingErrors && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Des erreurs bloquantes ont été détectées. Corrigez les fichiers Excel avant de continuer.
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={hasBlockingErrors || selectedFiles.some((d) => files[d.key].validating)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Envoyer {selectedCount} fichier{selectedCount > 1 ? "s" : ""}
              {!hasBlockingErrors && selectedFiles.some((d) => files[d.key].validation?.status === "warning") && (
                <span className="ml-1 text-xs opacity-75">(avec warnings)</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 : Upload en cours ── */}
      {step === 3 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-carbon-emerald/15 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-carbon-emerald animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">Upload en cours…</p>
            <p className="text-xs text-[var(--color-foreground-muted)] mt-1">
              Envoi de {selectedCount} fichier{selectedCount > 1 ? "s" : ""} vers Vercel Blob
            </p>
          </div>
          {uploadError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}
        </div>
      )}

      {/* ── Step 4 : Résultat ── */}
      {step === 4 && uploadResult && (
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
                  Les fichiers ont été uploadés. Déclenchez le recalcul pour mettre à jour tous les indicateurs.
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
