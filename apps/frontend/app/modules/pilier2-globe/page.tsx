"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  Calculator,
  ShieldCheck,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ArrowDown,
  ArrowUp,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════ Types ══ */

type Status = "idle" | "uploading" | "success" | "error";

interface JurisdictionRow {
  pays: string;
  revenu_globe: number;
  is_paye: number;
  etr: number;
  seuil: number;
  top_up: number;
  conforme: boolean;
}

interface Pilier2Result {
  filename: string;
  sheets: string[];
  sheet_count: number;
  source_sheet: string;
  top_up_total: number;
  nb_jurisdictions: number;
  nb_sous_seuil: number;
  etr_moyen: number;
  juridictions: JurisdictionRow[];
}

/* ═══════════════════════════════════════════════════════ Helpers ══ */

import { API_BASE_URL } from "@/lib/api-client";

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1_000)
    return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M\€";
  return Math.round(ke).toLocaleString("fr-FR") + " K\€";
}

function fmtPct(pct: number, dec = 1): string {
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: dec }) + " %";
}

type BadgeVariant = { cls: string; label: string };

function etrMoyenBadge(etr: number): BadgeVariant {
  if (etr >= 15) return { cls: "badge badge-success", label: "Conforme GloBE" };
  if (etr >= 10) return { cls: "badge badge-warning", label: "Sous seuil GloBE" };
  return { cls: "badge badge-danger", label: "ETR critique" };
}

function topUpBadge(topUp: number): BadgeVariant {
  if (topUp === 0) return { cls: "badge badge-success", label: "Aucun" };
  if (topUp < 5_000) return { cls: "badge badge-warning", label: "Modéré" };
  return { cls: "badge badge-danger", label: "Significatif" };
}

function sousSeuilBadge(nb: number, total: number): BadgeVariant {
  if (nb === 0) return { cls: "badge badge-success", label: `0 / ${total}` };
  if (nb <= 2) return { cls: "badge badge-warning", label: `${nb} / ${total}` };
  return { cls: "badge badge-danger", label: `${nb} / ${total}` };
}

/* ═══════════════════════════════════════════════════ Sub-components ══ */

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

function JurisdictionTable({ rows }: { rows: JurisdictionRow[] }) {
  return (
    <div className="card p-6 flex flex-col gap-4">
      <p className="data-label">Détail par juridiction</p>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-foreground-subtle font-medium text-xs uppercase tracking-wider">
                Pays
              </th>
              <th className="text-right py-2 px-4 text-foreground-subtle font-medium text-xs uppercase tracking-wider">
                Revenu GloBE
              </th>
              <th className="text-right py-2 px-4 text-foreground-subtle font-medium text-xs uppercase tracking-wider">
                IS payé
              </th>
              <th className="text-right py-2 px-4 text-foreground-subtle font-medium text-xs uppercase tracking-wider">
                ETR
              </th>
              <th className="text-right py-2 px-4 text-foreground-subtle font-medium text-xs uppercase tracking-wider">
                Seuil
              </th>
              <th className="text-right py-2 pl-4 text-foreground-subtle font-medium text-xs uppercase tracking-wider">
                Top-up Tax
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr
                key={j.pays}
                className="border-b border-border last:border-0 hover:bg-surface-raised/50 transition-colors"
              >
                <td className="py-3 pr-4 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        j.conforme ? "bg-success" : "bg-danger"
                      }`}
                    />
                    {j.pays}
                  </div>
                </td>
                <td className="py-3 px-4 text-right tabnum text-foreground-muted">
                  {fmtKE(j.revenu_globe)}
                </td>
                <td className="py-3 px-4 text-right tabnum text-foreground-muted">
                  {fmtKE(j.is_paye)}
                </td>
                <td className="py-3 px-4 text-right tabnum">
                  <span
                    className={`font-semibold ${
                      j.conforme ? "text-success" : "text-danger"
                    }`}
                  >
                    {fmtPct(j.etr)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right tabnum text-foreground-subtle">
                  {fmtPct(j.seuil)}
                </td>
                <td className="py-3 pl-4 text-right tabnum">
                  {j.top_up > 0 ? (
                    <span className="text-danger font-semibold flex items-center justify-end gap-1">
                      <ArrowUp className="h-3 w-3" />
                      {fmtKE(j.top_up)}
                    </span>
                  ) : (
                    <span className="text-success flex items-center justify-end gap-1">
                      <ArrowDown className="h-3 w-3" />
                      0
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((j) => (
          <div
            key={j.pays}
            className={`rounded-lg border p-4 flex flex-col gap-2 ${
              j.conforme ? "border-border" : "border-danger/30 bg-danger-bg/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{j.pays}</span>
              <span
                className={`font-semibold tabnum text-sm ${
                  j.conforme ? "text-success" : "text-danger"
                }`}
              >
                ETR {fmtPct(j.etr)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>Revenu GloBE : {fmtKE(j.revenu_globe)}</span>
              <span>IS : {fmtKE(j.is_paye)}</span>
            </div>
            {j.top_up > 0 && (
              <div className="text-xs text-danger font-semibold tabnum">
                Top-up : {fmtKE(j.top_up)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ Page ══ */

export default function Pilier2GlobePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Pilier2Result | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File handling ───────────────────────────────────────────── */

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      setStatus("error");
      setErrorMsg("Format non supporté. Veuillez importer un fichier Excel (.xlsx).");
      return;
    }

    setSelectedFile(file);
    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/pilier2/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `Erreur ${res.status}`);
      }

      const data: Pilier2Result = await res.json();
      setResult(data);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue lors de l\’analyse.",
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
          <span className="badge badge-neutral">Module 2 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">
        {/* ══ SECTION A — Introduction éditoriale ═══════════════════════ */}
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 2 sur 8</span>
            <h1 className="text-foreground">Fiscalité Pilier 2 GloBE</h1>
            <p
              className="text-foreground-muted max-w-2xl"
              style={{ fontSize: "var(--text-lg)" }}
            >
              Calculez l&apos;ETR par juridiction, estimez le top-up tax IIR et identifiez les
              pays sous le seuil minimum de 15 % en importent votre fichier de données
              fiscales.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Globe,
                  title: "Calcul ETR GloBE",
                  detail:
                    "Taux effectif d\’imposition par juridiction selon les règles OCDE — IS qualifié / revenu GloBE qualifié.",
                },
                {
                  icon: Calculator,
                  title: "Top-up Tax IIR / QDMTT",
                  detail:
                    "Impôt complémentaire si ETR < 15 %. Collecté par l\’UPE (IIR) ou localement (QDMTT).",
                },
                {
                  icon: ShieldCheck,
                  title: "Safe Harbours",
                  detail:
                    "De minimis, ETR simplifié (TSH) et UTPR safe harbour — exclusions du calcul complémentaire.",
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

          <div className="flex flex-col gap-4">
            <p className="data-label">Indicateurs clés à surveiller</p>
            <ul className="flex flex-col gap-3">
              {[
                {
                  title: "ETR GloBE par juridiction",
                  detail:
                    "Rapport IS qualifié / revenu GloBE. Si ETR < 15 %, un impôt complémentaire est dû sauf safe harbour applicable.",
                },
                {
                  title: "Top-up Tax estimé (IIR)",
                  detail:
                    "Impôt complémentaire : (15 % \− ETR) × revenu GloBE. Peut être neutralisé par un QDMTT local.",
                },
                {
                  title: "Exemption de minimis",
                  detail:
                    "Juridiction exclue si CA < 10 M\€ et revenu GloBE < 1 M\€ (art. 5.6 OCDE GloBE Model Rules).",
                },
                {
                  title: "QDMTT — Domestic Top-up Tax",
                  detail:
                    "Impôt national de complément permettant à la juridiction sous seuil de capter l\’impôt localement.",
                },
              ].map(({ title, detail }) => (
                <li key={title} className="flex gap-3 items-start">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-[7px]" />
                  <div>
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                    <span className="text-sm text-foreground-muted"> — {detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ══ SECTION B — Upload Excel ═══════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <p className="data-label">Importer votre fichier</p>

          <div className="card-raised p-6 sm:p-8 flex flex-col gap-6">
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
                      Glissez-déposez votre fichier Excel ici
                    </p>
                    <p className="text-xs text-foreground-subtle">
                      ou{" "}
                      <span className="text-accent font-medium underline underline-offset-2">
                        parcourez vos fichiers
                      </span>{" "}
                      — .xlsx uniquement — onglets attendus : 4-ETR Juridictionnel, 6-Top-up Tax
                    </p>
                  </div>
                </div>

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

            {status === "uploading" && (
              <div className="flex flex-col items-center gap-5 py-10">
                <Loader2 className="h-10 w-10 text-accent animate-spin" />
                <div className="text-center flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Analyse en cours…
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1 -mt-px" />
                    {selectedFile?.name}
                  </p>
                </div>
                <div className="w-48 h-1.5 rounded-full bg-surface-raised overflow-hidden">
                  <div className="h-full bg-accent rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            )}

            {status === "success" && result && (
              <div className="flex items-center gap-4 rounded-md bg-success-bg border border-success/20 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {result.filename}
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    {result.sheet_count} onglet{result.sheet_count > 1 ? "s" : ""} —{" "}
                    {result.nb_jurisdictions} juridiction{result.nb_jurisdictions > 1 ? "s" : ""} détectée{result.nb_jurisdictions > 1 ? "s" : ""}
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

        {/* ══ SECTION C — Dashboard ══════════════════════════════════════ */}
        {status === "success" && result && (
          <section className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse</p>
              <span className="badge badge-success">Analyse terminée</span>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard
                label="Top-up Tax Total"
                value={fmtKE(result.top_up_total)}
                badge={topUpBadge(result.top_up_total)}
                sub="IIR estimé"
              />
              <KpiCard
                label="ETR moyen pondéré"
                value={fmtPct(result.etr_moyen)}
                badge={etrMoyenBadge(result.etr_moyen)}
                sub="toutes juridictions"
              />
              <KpiCard
                label="Juridictions < 15 %"
                value={String(result.nb_sous_seuil)}
                badge={sousSeuilBadge(result.nb_sous_seuil, result.nb_jurisdictions)}
                sub="sous seuil GloBE"
              />
              <KpiCard
                label="Juridictions analysées"
                value={String(result.nb_jurisdictions)}
                badge={{ cls: "badge badge-neutral", label: "Total" }}
                sub={`source : ${result.source_sheet}`}
              />
            </div>

            {/* Jurisdiction table */}
            <JurisdictionTable rows={result.juridictions} />

            {/* Interpretation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {result.nb_sous_seuil === 0 ? (
                  <>
                    L&apos;ETR moyen pondéré de {fmtPct(result.etr_moyen)} est
                    supérieur au taux minimum global de 15 %. Aucun impôt
                    complémentaire IIR n&apos;est estimé sur les{" "}
                    {result.nb_jurisdictions} juridictions analysées.
                  </>
                ) : (
                  <>
                    {result.nb_sous_seuil} juridiction{result.nb_sous_seuil > 1 ? "s" : ""}{" "}
                    présente{result.nb_sous_seuil > 1 ? "nt" : ""} un ETR inférieur
                    à 15 %, générant un impôt complémentaire IIR
                    estimé à{" "}
                    <span className="font-semibold text-danger">
                      {fmtKE(result.top_up_total)}
                    </span>
                    . L&apos;adoption d&apos;un QDMTT dans les juridictions concernées
                    permettrait de capter l&apos;impôt localement.
                  </>
                )}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ces résultats sont générés à titre indicatif sur la base
                des données extraites de votre fichier et des règles GloBE OCDE 2024.
                Ils ne constituent pas un avis fiscal. Consultez votre directeur fiscal pour toute
                décision de provisionnement Pilier 2.
              </p>
            </div>

            {/* Reset */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={reset}
                className="text-sm text-foreground-subtle hover:text-foreground-muted transition-colors underline underline-offset-4"
              >
                Réinitialiser l&apos;analyse
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
