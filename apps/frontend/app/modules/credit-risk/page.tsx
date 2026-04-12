"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart2,
  AlertTriangle as AlertTriangleIcon,
  TrendingDown,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

/* ═══════════════════════════════════════════════════════════ Types ══ */

type Status = "idle" | "uploading" | "success" | "error";

interface StageBreakdown {
  name: string;
  ead: number;
  ecl: number;
  pct: number;
  coverage: number;
  color: string;
}

interface CreditRiskResult {
  filename: string;
  sheets: string[];
  sheet_count: number;
  encours_total: number;
  ecl_total: number;
  ecl_s1: number;
  ecl_s2: number;
  ecl_s3: number;
  rwa: number;
  cet1_capital: number;
  cet1_ratio: number;
  cet1_pro_forma: number;
  output_floor: number;
  stages: StageBreakdown[];
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

function eclBadge(ecl: number, encours: number): BadgeVariant {
  const ratio = encours > 0 ? ecl / encours : 0;
  if (ratio < 0.01) return { cls: "badge badge-success", label: "< 1 % EAD" };
  if (ratio < 0.03) return { cls: "badge badge-warning", label: "1\–3 % EAD" };
  return { cls: "badge badge-danger", label: "> 3 % EAD" };
}

function cet1Badge(cet1: number): BadgeVariant {
  if (cet1 > 13) return { cls: "badge badge-success", label: "Bien capitalisé" };
  if (cet1 > 10.5) return { cls: "badge badge-warning", label: "Adéquat" };
  return { cls: "badge badge-danger", label: "Sous buffer SREP" };
}

function cet1Color(cet1: number): string {
  if (cet1 > 13) return "text-success";
  if (cet1 > 10.5) return "text-warning";
  return "text-danger";
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

function StageBarChart({ stages }: { stages: StageBreakdown[] }) {
  return (
    <div className="card p-6 flex flex-col gap-4">
      <p className="data-label">Répartition des encours par Stage IFRS 9</p>
      <div className="w-full" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stages}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "var(--color-foreground-muted)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-foreground-subtle)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1_000 ? `${(v / 1_000).toFixed(0)}M` : `${v}K`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                fmtKE(value as number),
                (name as string) === "ead" ? "EAD" : "ECL",
              ]}
            />
            <Bar dataKey="ead" name="EAD" radius={[4, 4, 0, 0]} barSize={36}>
              {stages.map((s, i) => (
                <Cell key={i} fill={s.color} fillOpacity={0.3} />
              ))}
            </Bar>
            <Bar dataKey="ecl" name="ECL" radius={[4, 4, 0, 0]} barSize={36}>
              {stages.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stage detail rows */}
      <div className="flex flex-col divide-y divide-border">
        {stages.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-sm font-medium text-foreground w-24">
              {s.name}
            </span>
            <div className="flex gap-6 ml-auto text-right">
              <div className="flex flex-col">
                <span className="text-xs text-foreground-subtle">EAD</span>
                <span className="tabnum text-sm text-foreground">
                  {fmtKE(s.ead)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-foreground-subtle">ECL</span>
                <span className="tabnum text-sm font-semibold" style={{ color: s.color }}>
                  {fmtKE(s.ecl)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-foreground-subtle">%&nbsp;Encours</span>
                <span className="tabnum text-sm text-foreground">
                  {fmtPct(s.pct)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-foreground-subtle">Couverture</span>
                <span className="tabnum text-sm text-foreground">
                  {fmtPct(s.coverage)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StagePieChart({ stages }: { stages: StageBreakdown[] }) {
  const pieData = stages.map((s) => ({
    name: s.name,
    value: s.ead,
    color: s.color,
  }));

  return (
    <div className="card p-6 flex flex-col gap-4">
      <p className="data-label">Allocation du portefeuille</p>
      <div className="w-full" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              strokeWidth={2}
              stroke="var(--color-surface)"
            >
              {pieData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => [fmtKE(value as number), "EAD"]}
            />
            <Legend
              formatter={(value: string) => (
                <span className="text-xs text-foreground-muted">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ Page ══ */

export default function CreditRiskPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CreditRiskResult | null>(null);
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

      const res = await fetch(`${API_BASE_URL}/creditrisk/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `Erreur ${res.status}`);
      }

      const data: CreditRiskResult = await res.json();
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
          <span className="badge badge-neutral">Module 4 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">
        {/* ══ SECTION A — Introduction éditoriale ═══════════════════════ */}
        <section className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 4 sur 8</span>
            <h1 className="text-foreground">
              Crédit Risk Bancaire — IFRS 9 / Bâle IV
            </h1>
            <p
              className="text-foreground-muted max-w-2xl"
              style={{ fontSize: "var(--text-lg)" }}
            >
              Calculez l&apos;ECL par stage IFRS 9, les RWA Bâle IV et le ratio CET1
              pro forma en importent votre fichier de portefeuille crédit.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: BarChart2,
                  title: "ECL IFRS 9 par stage",
                  detail:
                    "Stage 1 (12 mois), Stage 2 (lifetime), Stage 3 (en défaut). Allocation et taux de couverture.",
                },
                {
                  icon: AlertTriangleIcon,
                  title: "RWA & CET1 Bâle IV",
                  detail:
                    "Actifs pondérés par le risque. Impact CET1 pro forma après provisionnement complet IFRS 9.",
                },
                {
                  icon: TrendingDown,
                  title: "Output Floor 72,5 %",
                  detail:
                    "Plancher Bâle IV sur les RWA : les modèles internes ne peuvent réduire les RWA en deçà de 72,5 % de l\’approche standard.",
                },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="card p-5 flex flex-col gap-3">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      {title}
                    </p>
                    <p className="text-xs text-foreground-muted leading-relaxed">
                      {detail}
                    </p>
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
                  title: "ECL — Expected Credit Loss (IFRS 9)",
                  detail:
                    "Perte attendue sur créances. Stage 1 : PD 12 mois × LGD × EAD. Stage 2 : PD lifetime. Stage 3 : LGD × EAD.",
                },
                {
                  title: "RWA — Risk-Weighted Assets (Bâle IV)",
                  detail:
                    "Base de calcul des fonds propres. Output floor à 72,5 % de l\’approche standard à partir de 2028.",
                },
                {
                  title: "Ratio CET1 pro forma",
                  detail:
                    "CET1 après déduction de l\’ECL. Seuil SREP typique entre 10,5 % et 12,5 %.",
                },
              ].map(({ title, detail }) => (
                <li key={title} className="flex gap-3 items-start">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-[7px]" />
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      {title}
                    </span>
                    <span className="text-sm text-foreground-muted">
                      {" "}
                      — {detail}
                    </span>
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
                      — .xlsx uniquement — onglets : 1-Portefeuille, 2-ECL IFRS 9, 4-CET1 Bâle IV
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
                    {result.sheet_count} onglet{result.sheet_count > 1 ? "s" : ""} détecté{result.sheet_count > 1 ? "s" : ""}
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
                label="Encours Total"
                value={fmtKE(result.encours_total)}
                badge={{ cls: "badge badge-neutral", label: "Portefeuille" }}
              />
              <KpiCard
                label="Provision ECL Totale"
                value={fmtKE(result.ecl_total)}
                badge={eclBadge(result.ecl_total, result.encours_total)}
                sub={`${fmtPct(result.encours_total > 0 ? (result.ecl_total / result.encours_total) * 100 : 0)} de l\’EAD`}
              />
              <KpiCard
                label="RWA Bâle IV"
                value={fmtKE(result.rwa)}
                badge={{ cls: "badge badge-neutral", label: `Floor ${result.output_floor} %` }}
                sub="output floor"
              />
              <div className="card p-5 flex flex-col gap-3">
                <span className="data-label">CET1 Pro Forma</span>
                <span
                  className={`kpi-value tabnum ${cet1Color(result.cet1_pro_forma)}`}
                  style={{ fontSize: "var(--text-2xl)" }}
                >
                  {fmtPct(result.cet1_pro_forma)}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cet1Badge(result.cet1_pro_forma).cls}>
                    {cet1Badge(result.cet1_pro_forma).label}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    vs {fmtPct(result.cet1_ratio)} reporté
                  </span>
                </div>
              </div>
            </div>

            {/* Charts side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StageBarChart stages={result.stages} />
              <StagePieChart stages={result.stages} />
            </div>

            {/* Interpretation */}
            <div className="card p-6 flex flex-col gap-3">
              <p className="data-label">Interprétation</p>
              <p className="text-sm text-foreground-muted leading-relaxed">
                L&apos;ECL total IFRS 9 de{" "}
                <span className="font-semibold text-foreground">
                  {fmtKE(result.ecl_total)}
                </span>{" "}
                représente{" "}
                {fmtPct(
                  result.encours_total > 0
                    ? (result.ecl_total / result.encours_total) * 100
                    : 0,
                )}{" "}
                de l&apos;encours total. Après provisionnement complet, le ratio CET1
                pro forma s&apos;établit à{" "}
                <span className={`font-semibold ${cet1Color(result.cet1_pro_forma)}`}>
                  {fmtPct(result.cet1_pro_forma)}
                </span>{" "}
                {result.cet1_pro_forma > 10.5
                  ? "au-dessus du seuil SREP de 10,5 %."
                  : "— attention, en dessous du seuil SREP de 10,5 %. Un renforcement des fonds propres est recommandé."}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ce module utilise les données extraites de votre fichier Excel. L&apos;output floor
                Bâle IV de {result.output_floor} % sera pleinement appliqué à partir de
                2028. Consultez votre risk management pour tout calcul réglementaire officiel.
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
