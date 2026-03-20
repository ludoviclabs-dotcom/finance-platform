"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  Building2,
  Target,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BarChart3,
  X,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════ Types ══ */

type Status = "idle" | "uploading" | "success" | "error";

interface AnalysisResult {
  filename: string;
  sheets: string[];
  sheet_count: number;
  source_sheet: string;
  z_score: number;
  croissance_ca: number;
  marge_ebe: number;
  ratio_endettement: number;
  tresorerie_nette: number;
  roe: number;
  bfr_jours: number;
}

/* Convenience accessors — keep JSX readable with camelCase names */
function zScore(r: AnalysisResult): number { return r.z_score; }
function croissanceCA(r: AnalysisResult): number { return r.croissance_ca; }
function margeEBE(r: AnalysisResult): number { return r.marge_ebe; }
function ratioEndettement(r: AnalysisResult): number { return r.ratio_endettement; }
function tresorerieNette(r: AnalysisResult): number { return r.tresorerie_nette; }
function roeVal(r: AnalysisResult): number { return r.roe; }
function bfrJours(r: AnalysisResult): number { return r.bfr_jours; }

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/* ═══════════════════════════════════════════════════════ Helpers ══ */

function fmtPct(pct: number, dec = 1): string {
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: dec }) + " %";
}

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1_000)
    return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M\u20AC";
  return Math.round(ke).toLocaleString("fr-FR") + " K\u20AC";
}

type BadgeVariant = { cls: string; label: string };

function zScoreBadge(z: number): BadgeVariant {
  if (z > 2.99) return { cls: "badge badge-success", label: "Zone s\u00FBre" };
  if (z > 1.81) return { cls: "badge badge-warning", label: "Zone grise" };
  return { cls: "badge badge-danger", label: "Zone de d\u00E9tresse" };
}

function zScoreColor(z: number): string {
  if (z > 2.99) return "text-success";
  if (z > 1.81) return "text-warning";
  return "text-danger";
}

function kpiBadge(value: number, thresholds: [number, number]): BadgeVariant {
  const [warn, good] = thresholds;
  if (value >= good) return { cls: "badge badge-success", label: "Bon" };
  if (value >= warn) return { cls: "badge badge-warning", label: "Mod\u00E9r\u00E9" };
  return { cls: "badge badge-danger", label: "Attention" };
}

function endettementBadge(ratio: number): BadgeVariant {
  if (ratio < 50) return { cls: "badge badge-success", label: "Faible" };
  if (ratio < 100) return { cls: "badge badge-warning", label: "Mod\u00E9r\u00E9" };
  return { cls: "badge badge-danger", label: "\u00C9lev\u00E9" };
}

/* ═══════════════════════════════════════════════════ Sub-components ══ */

function ZScoreGauge({ score }: { score: number }) {
  /* Position on a 0-5 scale, clamped */
  const pct = Math.min(Math.max(score / 5, 0), 1) * 100;
  const color = score > 2.99 ? "var(--color-success)" : score > 1.81 ? "var(--color-warning)" : "var(--color-danger)";

  return (
    <div className="card-raised p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="data-label">Z-Score Altman</p>
        {(() => {
          const b = zScoreBadge(score);
          return <span className={b.cls}>{b.label}</span>;
        })()}
      </div>

      <div className="flex items-end gap-3">
        <span
          className={`tabnum font-bold ${zScoreColor(score)}`}
          style={{ fontSize: "var(--text-5xl)", lineHeight: 1 }}
        >
          {score.toFixed(2)}
        </span>
        <span className="text-sm text-foreground-subtle mb-1">/ 5.00</span>
      </div>

      {/* Bar gauge */}
      <div className="relative h-3 w-full rounded-full bg-surface-raised overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {/* Threshold markers */}
        <div
          className="absolute top-0 h-full w-px bg-foreground-subtle opacity-40"
          style={{ left: `${(1.81 / 5) * 100}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-foreground-subtle opacity-40"
          style={{ left: `${(2.99 / 5) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-foreground-subtle tabnum">
        <span>0</span>
        <span>1.81</span>
        <span>2.99</span>
        <span>5.00</span>
      </div>

      <p className="text-xs text-foreground-muted leading-relaxed border-t border-border pt-4">
        Le Z-Score Altman Z&apos;&apos; mesure le risque de d\u00E9faillance \u00E0 2 ans pour les
        entreprises non cot\u00E9es. Un score entre 1,81 et 2,99 requiert une surveillance accrue.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  badge,
  sub,
}: {
  label: string;
  value: string;
  badge: BadgeVariant;
  sub?: string;
}) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <span className="data-label">{label}</span>
      <span className="kpi-value tabnum" style={{ fontSize: "var(--text-2xl)" }}>
        {value}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={badge.cls}>{badge.label}</span>
        {sub && <span className="text-xs text-foreground-subtle">{sub}</span>}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ Page ══ */

export default function AnalyseEntreprisePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File handling ───────────────────────────────────────────── */

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setStatus("error");
      setErrorMsg("Format non support\u00E9. Veuillez importer un fichier Excel (.xlsx).");
      return;
    }

    setSelectedFile(file);
    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/entreprise/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `Erreur ${res.status}`);
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue lors de l\u2019analyse.",
      );
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setSelectedFile(null);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col min-h-svh bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="badge badge-neutral">Module 3 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">
        {/* ══ SECTION A — Introduction \u00E9ditoriale ═══════════════════════ */}
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 3 sur 8</span>
            <h1 className="text-foreground">Analyse Financi\u00E8re d&apos;Entreprise</h1>
            <p
              className="text-foreground-muted max-w-2xl"
              style={{ fontSize: "var(--text-lg)" }}
            >
              \u00C9valuez la sant\u00E9 financi\u00E8re et calculez le Z-Score d&apos;Altman en
              important votre balance g\u00E9n\u00E9rale.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: TrendingUp,
                  title: "Performance op\u00E9rationnelle",
                  detail:
                    "Marges EBITDA, EBIT et nette \u2014 \u00E9volution et benchmark sectoriel pour \u00E9valuer l\u2019efficacit\u00E9 op\u00E9rationnelle.",
                },
                {
                  icon: Building2,
                  title: "Structure financi\u00E8re",
                  detail:
                    "Gearing, dette nette/EBITDA, BFR en jours \u2014 solidit\u00E9 du bilan et capacit\u00E9 de remboursement.",
                },
                {
                  icon: Target,
                  title: "Scoring & cr\u00E9ation de valeur",
                  detail:
                    "Z-Score Altman Z\u2019\u2019 (solvabilit\u00E9), ROE (rentabilit\u00E9 fonds propres) et EVA (valeur \u00E9conomique ajout\u00E9e).",
                },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="card p-5 flex flex-col gap-3">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-xs text-foreground-muted leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ SECTION B — Upload Excel ═══════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <p className="data-label">Importer votre fichier</p>

          <div className="card-raised p-6 sm:p-8 flex flex-col gap-6">
            {/* Drop zone — hidden when uploading or success */}
            {(status === "idle" || status === "error") && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-10 sm:p-14 cursor-pointer transition-colors ${
                    dragActive
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-border-strong hover:bg-surface-raised/50"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={onFileChange}
                    className="hidden"
                  />
                  <div className="h-12 w-12 rounded-full bg-surface-raised flex items-center justify-center">
                    <Upload className="h-6 w-6 text-accent" />
                  </div>
                  <div className="text-center flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">
                      Glissez-d\u00E9posez votre fichier Excel ici
                    </p>
                    <p className="text-xs text-foreground-subtle">
                      ou{" "}
                      <span className="text-accent font-medium underline underline-offset-2">
                        parcourez vos fichiers
                      </span>{" "}
                      \u2014 .xlsx uniquement
                    </p>
                  </div>
                </div>

                {/* Error message */}
                {status === "error" && (
                  <div className="flex items-center gap-3 rounded-md bg-danger-bg border border-danger/20 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                    <p className="text-sm text-danger">{errorMsg}</p>
                    <button
                      type="button"
                      onClick={reset}
                      className="ml-auto text-danger/60 hover:text-danger transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Uploading state */}
            {status === "uploading" && (
              <div className="flex flex-col items-center gap-5 py-10">
                <Loader2 className="h-10 w-10 text-accent animate-spin" />
                <div className="text-center flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Analyse en cours\u2026
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1 -mt-px" />
                    {selectedFile?.name}
                  </p>
                </div>
                {/* Progress bar */}
                <div className="w-48 h-1.5 rounded-full bg-surface-raised overflow-hidden">
                  <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            )}

            {/* Success confirmation */}
            {status === "success" && result && (
              <div className="flex items-center gap-4 rounded-md bg-success-bg border border-success/20 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {result.filename}
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    {result.sheet_count} onglet{result.sheets.length > 1 ? "s" : ""} d\u00E9tect\u00E9{result.sheets.length > 1 ? "s" : ""} :{" "}
                    {result.sheets.join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-foreground-subtle hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Remplacer
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ══ SECTION C — Dashboard de r\u00E9sultats ════════════════════════ */}
        {status === "success" && result && (
          <section className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <p className="data-label">R\u00E9sultats de l&apos;analyse</p>
              <span className="badge badge-success">Analyse termin\u00E9e</span>
            </div>

            {/* Z-Score gauge — prominent */}
            <ZScoreGauge score={zScore(result)} />

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                label="Croissance CA"
                value={fmtPct(croissanceCA(result))}
                badge={kpiBadge(croissanceCA(result), [3, 5])}
                sub="variation N/N-1"
              />
              <KpiCard
                label="Marge EBE"
                value={fmtPct(margeEBE(result))}
                badge={kpiBadge(margeEBE(result), [8, 12])}
                sub="EBE / CA"
              />
              <KpiCard
                label="Ratio d'endettement"
                value={fmtPct(ratioEndettement(result), 0)}
                badge={endettementBadge(ratioEndettement(result))}
                sub="dettes / CP"
              />
              <KpiCard
                label="ROE"
                value={fmtPct(roeVal(result))}
                badge={kpiBadge(roeVal(result), [8, 15])}
                sub="r\u00E9sultat / CP"
              />
            </div>

            {/* Ratios compl\u00E9mentaires */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Ratios compl\u00E9mentaires</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                {[
                  { label: "Tr\u00E9sorerie nette", value: fmtKE(tresorerieNette(result)) },
                  { label: "BFR en jours", value: `${bfrJours(result)} j` },
                  { label: "Marge EBE", value: fmtPct(margeEBE(result)) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="data-label">{label}</span>
                    <span className="tabnum text-base font-semibold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Placeholder graphique */}
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="data-label">\u00C9volution de la tr\u00E9sorerie</p>
                <span className="badge badge-neutral">Bient\u00F4t disponible</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-3 py-12 rounded-lg border border-dashed border-border bg-surface-raised/30">
                <BarChart3 className="h-10 w-10 text-foreground-subtle opacity-40" />
                <p className="text-sm text-foreground-subtle">
                  Le graphique d&apos;\u00E9volution sera disponible apr\u00E8s connexion \u00E0 l&apos;API.
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interpr\u00E9tation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                Le Z-Score de {zScore(result).toFixed(2)} place l&apos;entreprise en{" "}
                <span className={`font-semibold ${zScoreColor(zScore(result))}`}>
                  {zScoreBadge(zScore(result)).label.toLowerCase()}
                </span>
                . La marge EBE de {fmtPct(margeEBE(result))} et un ratio d&apos;endettement
                de {fmtPct(ratioEndettement(result), 0)} sugg\u00E8rent une structure financi\u00E8re
                qui n\u00E9cessite une surveillance active. Le ROE de {fmtPct(roeVal(result))} reste
                {roeVal(result) >= 8 ? " satisfaisant" : " en de\u00E7\u00E0 du co\u00FBt des fonds propres"}.
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Le Z-Score Altman est un mod\u00E8le statistique de pr\u00E9diction \u2014 il ne se
                substitue pas \u00E0 une analyse de cr\u00E9dit compl\u00E8te. Les r\u00E9sultats
                d\u00E9pendent de la qualit\u00E9 des donn\u00E9es extraites de votre fichier
                Excel (onglet : {result.source_sheet}).
              </p>
            </div>

            {/* Reset */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={reset}
                className="text-sm text-foreground-subtle hover:text-foreground-muted transition-colors underline underline-offset-4"
              >
                R\u00E9initialiser l&apos;analyse
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
