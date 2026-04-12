"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  TrendingDown,
  FileCheck,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/* ═══════════════════════════════════════════════════════════ Types ══ */

type Status = "idle" | "uploading" | "success" | "error";

interface RadarPoint {
  chapter: string;
  score: number;
  max: number;
}

interface CyberResult {
  filename: string;
  sheets: string[];
  sheet_count: number;
  maturity_index: number;
  ale: number;
  var95: number;
  ratio_cyber_it: number;
  dora_scores: Record<string, number>;
  radar_data: RadarPoint[];
}

/* ═══════════════════════════════════════════════════════ Helpers ══ */

import { API_BASE_URL } from "@/lib/api-client";

function fmtKE(ke: number): string {
  if (Math.abs(ke) >= 1_000)
    return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M\€";
  return Math.round(ke).toLocaleString("fr-FR") + " K\€";
}

function fmtPct(pct: number, dec = 1): string {
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: dec }) + " %";
}

type BadgeVariant = { cls: string; label: string };

function maturityBadge(score: number): BadgeVariant {
  if (score >= 75) return { cls: "badge badge-success", label: "Conforme" };
  if (score >= 50) return { cls: "badge badge-warning", label: "En vigilance" };
  return { cls: "badge badge-danger", label: "Non conforme" };
}

function maturityColor(score: number): string {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

function maturityCssColor(score: number): string {
  if (score >= 75) return "var(--color-success)";
  if (score >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

function aleBadge(ale: number): BadgeVariant {
  if (ale < 200) return { cls: "badge badge-success", label: "Gérable" };
  if (ale < 1_000) return { cls: "badge badge-warning", label: "Significatif" };
  return { cls: "badge badge-danger", label: "Critique" };
}

function varBadge(v: number): BadgeVariant {
  if (v < 500) return { cls: "badge badge-success", label: "Acceptable" };
  if (v < 2_000) return { cls: "badge badge-warning", label: "À surveiller" };
  return { cls: "badge badge-danger", label: "Élevé" };
}

function ratioBadge(ratio: number): BadgeVariant {
  if (ratio >= 12) return { cls: "badge badge-success", label: "Adéquat ENISA" };
  if (ratio >= 7) return { cls: "badge badge-warning", label: "Sous-optimal" };
  return { cls: "badge badge-danger", label: "Insuffisant" };
}

/* ═══════════════════════════════════════════════════ Sub-components ══ */

function MaturityGauge({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = maturityCssColor(score);

  return (
    <div className="card-raised p-6 sm:p-8 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="data-label">Indice de maturité DORA</p>
        {(() => {
          const b = maturityBadge(score);
          return <span className={b.cls}>{b.label}</span>;
        })()}
      </div>

      <div className="flex items-end gap-3">
        <span
          className={`tabnum font-bold ${maturityColor(score)}`}
          style={{ fontSize: "var(--text-5xl)", lineHeight: 1 }}
        >
          {Math.round(score)}
        </span>
        <span className="text-sm text-foreground-subtle mb-1">/ 100</span>
      </div>

      {/* Bar gauge */}
      <div className="relative h-3 w-full rounded-full bg-surface-raised overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        <div
          className="absolute top-0 h-full w-px bg-foreground-subtle opacity-40"
          style={{ left: "50%" }}
        />
        <div
          className="absolute top-0 h-full w-px bg-foreground-subtle opacity-40"
          style={{ left: "75%" }}
        />
      </div>
      <div className="flex justify-between text-xs text-foreground-subtle tabnum">
        <span>0</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>

      <p className="text-xs text-foreground-muted leading-relaxed border-t border-border pt-4">
        Moyenne des 6 chapitres DORA ramenée sur 100. Un score inférieur à 50
        expose l&apos;entité à des mesures correctrices lors du prochain cycle de
        supervision ACPR/BCE.
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

function DoraRadar({ data }: { data: RadarPoint[] }) {
  return (
    <div className="card p-6 flex flex-col gap-4">
      <p className="data-label">Radar DORA par chapitre</p>
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis
              dataKey="chapter"
              tick={{ fontSize: 11, fill: "var(--color-foreground-muted)" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 4]}
              tick={{ fontSize: 10, fill: "var(--color-foreground-subtle)" }}
              tickCount={5}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="var(--color-accent)"
              fill="var(--color-accent)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => [`${value as number} / 4`, "Score"]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 border-t border-border pt-4">
        {data.map((d) => (
          <div key={d.chapter} className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground-muted">{d.chapter}</span>
            <span className="tabnum text-xs font-semibold text-foreground">
              {d.score} / 4
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ Page ══ */

export default function GouvernanceCyberPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CyberResult | null>(null);
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

      const res = await fetch(`${API_BASE_URL}/cyber/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `Erreur ${res.status}`);
      }

      const data: CyberResult = await res.json();
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
          <span className="badge badge-neutral">Module 1 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">
        {/* ══ SECTION A — Introduction éditoriale ═══════════════════════ */}
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 1 sur 8</span>
            <h1 className="text-foreground">Gouvernance cyber-financière</h1>
            <p
              className="text-foreground-muted max-w-2xl"
              style={{ fontSize: "var(--text-lg)" }}
            >
              Mesurez votre conformité DORA, quantifiez votre exposition cyber (ALE, VaR)
              et visualisez votre maturité par chapitre en importent votre fichier de
              paramétrage.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Shield,
                  title: "Conformité DORA",
                  detail: "6 chapitres, score sur 100 — gouvernance, incidents, tests, tiers, TIC, reporting.",
                },
                {
                  icon: TrendingDown,
                  title: "Risque financier cyber",
                  detail: "ALE annualisée, VaR 95 %, calcul FAIR PERT sur vos scénarios.",
                },
                {
                  icon: FileCheck,
                  title: "Reporting CSRD / ESRS",
                  detail: "Data points obligatoires et narratif attendu pour E4 / S.",
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
                  title: "Indice de maturité DORA /100",
                  detail:
                    "Moyenne des 6 chapitres DORA. Un score < 50 expose l\’entité à des mesures correctrices de l\’ACPR.",
                },
                {
                  title: "ALE — Annualized Loss Expectancy",
                  detail:
                    "Espérance de perte annuelle agrégée sur les scénarios FAIR PERT déclarés.",
                },
                {
                  title: "VaR 95 % annuelle",
                  detail:
                    "Perte maximale au 95ᵉ percentile sur un an. Sert de base pour la prime d\’assurance cyber.",
                },
                {
                  title: "Ratio Cyber/IT (%)",
                  detail:
                    "L\’ENISA recommande un seuil de 12 % pour les entités financières systémiques.",
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
                      — .xlsx uniquement — onglets attendus : PARAMÈTRES, FAIR PERT, DORA
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
                    {result.sheet_count} onglet{result.sheet_count > 1 ? "s" : ""} détecté{result.sheet_count > 1 ? "s" : ""} :{" "}
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

        {/* ══ SECTION C — Dashboard ══════════════════════════════════════ */}
        {status === "success" && result && (
          <section className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse</p>
              <span className="badge badge-success">Analyse terminée</span>
            </div>

            {/* Maturity gauge */}
            <MaturityGauge score={result.maturity_index} />

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <KpiCard
                label="ALE agrégée"
                value={fmtKE(result.ale)}
                badge={aleBadge(result.ale)}
                sub="espérance annuelle"
              />
              <KpiCard
                label="VaR 95 %"
                value={fmtKE(result.var95)}
                badge={varBadge(result.var95)}
                sub="perte maximale"
              />
              <KpiCard
                label="Ratio Cyber / IT"
                value={fmtPct(result.ratio_cyber_it)}
                badge={ratioBadge(result.ratio_cyber_it)}
                sub="seuil ENISA 12 %"
              />
            </div>

            {/* Radar chart */}
            <DoraRadar data={result.radar_data} />

            {/* Interpretation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                L&apos;indice de maturité de {Math.round(result.maturity_index)}/100 place
                votre organisation en{" "}
                <span className={`font-semibold ${maturityColor(result.maturity_index)}`}>
                  {maturityBadge(result.maturity_index).label.toLowerCase()}
                </span>
                . L&apos;ALE agrégée de {fmtKE(result.ale)} et la VaR 95 % de{" "}
                {fmtKE(result.var95)} doivent être mises en regard de votre couverture
                d&apos;assurance cyber.
                {result.ratio_cyber_it < 12
                  ? ` Le ratio Cyber/IT de ${fmtPct(result.ratio_cyber_it)} est en deçà du seuil ENISA de 12 %.`
                  : ` Le ratio Cyber/IT de ${fmtPct(result.ratio_cyber_it)} est conforme aux recommandations ENISA.`}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ces résultats sont générés à titre indicatif sur la base
                des données extraites de votre fichier. Ils ne constituent pas un avis d&apos;expert
                réglementaire. Consultez votre correspondant DORA et vos commissaires aux comptes.
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
