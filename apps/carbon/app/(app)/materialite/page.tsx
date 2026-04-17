"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, RefreshCw, Save, Sparkles, Target, TrendingUp, Shield } from "lucide-react";
import {
  type IssuePosition,
  type MaterialiteScoreResponse,
  type ScoredIssue,
  type SectorPresetsResponse,
  computeMaterialiteScore,
  fetchMaterialitePositions,
  fetchMaterialitePresets,
  saveMaterialitePositions,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_SIZE = 420; // px — square chart
const PADDING = 48;     // px axis padding
const PLOT_SIZE = CHART_SIZE - 2 * PADDING;
const DOMAIN = 5;       // axis 0→5

const PILLAR_COLORS: Record<string, string> = {
  E: "#10b981",
  S: "#3b82f6",
  G: "#8b5cf6",
};

const SECTOR_LABELS: Record<string, string> = {
  tech: "Technologie",
  industrie: "Industrie",
  retail: "Retail",
  services: "Services",
  finance: "Finance",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSvg(val: number): number {
  // 0→PLOT_SIZE, DOMAIN→0 (y is inverted)
  return PADDING + (val / DOMAIN) * PLOT_SIZE;
}

function toSvgY(val: number): number {
  return PADDING + PLOT_SIZE - (val / DOMAIN) * PLOT_SIZE;
}

function fromSvgX(px: number): number {
  return Math.max(0, Math.min(DOMAIN, ((px - PADDING) / PLOT_SIZE) * DOMAIN));
}

function fromSvgY(py: number): number {
  return Math.max(0, Math.min(DOMAIN, ((CHART_SIZE - PADDING - py) / PLOT_SIZE) * DOMAIN));
}

// ---------------------------------------------------------------------------
// DragPoint component
// ---------------------------------------------------------------------------

interface DragPointProps {
  issue: ScoredIssue;
  onMove: (code: string, x: number, y: number) => void;
}

function DragPoint({ issue, onMove }: DragPointProps) {
  const dragging = useRef(false);
  const cx = toSvg(issue.x);
  const cy = toSvgY(issue.y);
  const color = PILLAR_COLORS[issue.pillar] ?? "#94a3b8";

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;

    function onMove2(me: MouseEvent) {
      if (!dragging.current) return;
      const svg = (e.target as SVGElement).closest("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleFactor = CHART_SIZE / rect.width;
      const px = (me.clientX - rect.left) * scaleFactor;
      const py = (me.clientY - rect.top) * scaleFactor;
      onMove(issue.code, fromSvgX(px), fromSvgY(py));
    }

    function onUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove2);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove2);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <g
      className="cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      role="button"
      aria-label={`Enjeu ${issue.code} — glisser pour repositionner`}
      data-testid={`drag-point-${issue.code}`}
    >
      {/* Halo for materiality */}
      {issue.materiel && (
        <circle
          cx={cx}
          cy={cy}
          r={16}
          fill={color}
          opacity={0.15}
        />
      )}
      {/* Main circle */}
      <circle
        cx={cx}
        cy={cy}
        r={9}
        fill={issue.materiel ? color : "transparent"}
        stroke={color}
        strokeWidth={issue.materiel ? 0 : 2}
        opacity={0.85}
      />
      {/* Label */}
      <text
        x={cx + 12}
        y={cy + 4}
        fontSize={9}
        fill="var(--color-foreground-muted)"
        className="select-none pointer-events-none"
      >
        {issue.code}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Matrix SVG
// ---------------------------------------------------------------------------

interface MatrixProps {
  issues: ScoredIssue[];
  onMove: (code: string, x: number, y: number) => void;
  interactive: boolean;
}

function Matrix({ issues, onMove, interactive }: MatrixProps) {
  const gridLines = [1, 2, 2.5, 3, 4];
  const ticks = [0, 1, 2, 3, 4, 5];

  return (
    <svg
      viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      className="w-full h-full"
      style={{ maxHeight: CHART_SIZE }}
    >
      {/* Grid lines */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={toSvg(v)} y1={PADDING}
            x2={toSvg(v)} y2={CHART_SIZE - PADDING}
            stroke="var(--color-border)"
            strokeDasharray={v === 2.5 ? "6 3" : "3 3"}
            strokeWidth={v === 2.5 ? 1.5 : 1}
          />
          <line
            x1={PADDING} y1={toSvgY(v)}
            x2={CHART_SIZE - PADDING} y2={toSvgY(v)}
            stroke="var(--color-border)"
            strokeDasharray={v === 2.5 ? "6 3" : "3 3"}
            strokeWidth={v === 2.5 ? 1.5 : 1}
          />
        </g>
      ))}

      {/* Materiality zone highlight */}
      <rect
        x={toSvg(2.5)} y={PADDING}
        width={PLOT_SIZE / 2} height={PLOT_SIZE / 2}
        fill="#10b981"
        opacity={0.04}
      />

      {/* Axis ticks + labels */}
      {ticks.map((v) => (
        <g key={v}>
          <text x={toSvg(v) - 4} y={CHART_SIZE - PADDING + 16} fontSize={10}
            textAnchor="middle" fill="var(--color-foreground-muted)">{v}</text>
          <text x={PADDING - 10} y={toSvgY(v) + 4} fontSize={10}
            textAnchor="end" fill="var(--color-foreground-muted)">{v}</text>
        </g>
      ))}

      {/* Axis labels */}
      <text
        x={CHART_SIZE / 2} y={CHART_SIZE - 4}
        fontSize={11} textAnchor="middle" fill="var(--color-foreground-muted)"
      >
        Probabilité / Occurrence →
      </text>
      <text
        x={12} y={CHART_SIZE / 2}
        fontSize={11} textAnchor="middle" fill="var(--color-foreground-muted)"
        transform={`rotate(-90 12 ${CHART_SIZE / 2})`}
      >
        Impact →
      </text>

      {/* "Matériel" zone label */}
      <text
        x={toSvg(3.8)} y={PADDING + 14}
        fontSize={9} fill="#10b981" opacity={0.7}
        textAnchor="middle"
      >
        Zone matérielle
      </text>

      {/* Points */}
      {issues.map((issue) => (
        interactive
          ? <DragPoint key={issue.code} issue={issue} onMove={onMove} />
          : <StaticPoint key={issue.code} issue={issue} />
      ))}
    </svg>
  );
}

function StaticPoint({ issue }: { issue: ScoredIssue }) {
  const cx = toSvg(issue.x);
  const cy = toSvgY(issue.y);
  const color = PILLAR_COLORS[issue.pillar] ?? "#94a3b8";
  return (
    <g>
      <circle cx={cx} cy={cy} r={8}
        fill={issue.materiel ? color : "transparent"}
        stroke={color} strokeWidth={issue.materiel ? 0 : 2}
        opacity={0.85}
      />
      <text x={cx + 11} y={cy + 4} fontSize={9}
        fill="var(--color-foreground-muted)" className="select-none">{issue.code}</text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Narrative panel
// ---------------------------------------------------------------------------

function NarrativePanel({ narrative }: { narrative: string }) {
  // Render simple markdown: **bold**, ## headers, bullet lists, ---
  const lines = narrative.split("\n");
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--color-foreground)]">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="font-display text-base font-bold text-[var(--color-foreground)] mt-4 mb-1">
              {line.slice(3)}
            </h3>
          );
        }
        if (line === "---") {
          return <hr key={i} className="border-[var(--color-border)] my-3" />;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="text-sm text-[var(--color-foreground-muted)] pl-3 border-l-2 border-carbon-emerald my-1">
              {renderInline(line.slice(2))}
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-2" />;
        return (
          <p key={i} className="text-sm text-[var(--color-foreground)] leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  // Replace **bold** with <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-[var(--color-foreground)]">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MaterialitePage() {
  const [presets, setPresets] = useState<SectorPresetsResponse | null>(null);
  const [sector, setSector] = useState<string>("industrie");
  const [positions, setPositions] = useState<IssuePosition[]>([]);
  const [result, setResult] = useState<MaterialiteScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(true);
  const [activeTab, setActiveTab] = useState<"matrix" | "narrative">("matrix");

  // Load presets + saved positions on mount
  useEffect(() => {
    Promise.all([fetchMaterialitePresets(), fetchMaterialitePositions()])
      .then(([p, pos]) => {
        setPresets(p);
        if (pos.length > 0) {
          setPositions(pos);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Auto-score whenever positions or sector changes
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => {
      setScoring(true);
      computeMaterialiteScore(positions, sector)
        .then(setResult)
        .catch((e) => setError(e.message))
        .finally(() => setScoring(false));
    }, 300);
    return () => { if (scoreTimer.current) clearTimeout(scoreTimer.current); };
  }, [positions, sector, loading]);

  const handleMove = useCallback((code: string, x: number, y: number) => {
    setPositions((prev) => {
      const exists = prev.some((p) => p.code === code);
      const updated: IssuePosition = { code, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      if (exists) return prev.map((p) => p.code === code ? updated : p);
      return [...prev, updated];
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveMaterialitePositions(positions, sector);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function loadPreset(s: string) {
    setSector(s);
    setPositions([]); // empty → will use preset server-side
  }

  // Merge: use computed result issues for rendering (contains scores)
  const displayIssues: ScoredIssue[] = result?.issues ?? [];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-foreground-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
          <span className="text-sm">Chargement de la matrice…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
            Double matérialité
          </h1>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Matrice IRO interactive — glissez les enjeux pour les repositionner
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setInteractive((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              interactive
                ? "bg-carbon-emerald/10 border-carbon-emerald text-carbon-emerald"
                : "border-[var(--color-border)] text-[var(--color-foreground-muted)]"
            }`}
          >
            {interactive ? "Mode édition" : "Mode lecture"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || positions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-carbon-emerald text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-bg)] text-sm text-[var(--color-danger)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Sector presets */}
      {presets && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">
            Secteur :
          </span>
          {presets.sectors.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => loadPreset(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                sector === s
                  ? "bg-carbon-emerald text-white shadow-sm"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {SECTOR_LABELS[s] ?? s}
            </button>
          ))}
          {positions.length > 0 && (
            <button
              type="button"
              onClick={() => setPositions([])}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)]"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* KPI cards */}
      {result && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-carbon-emerald" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">Enjeux évalués</span>
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
              {result.total_issues}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">Matériels</span>
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-success)]">
              {result.total_materiel}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">Score moyen</span>
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
              {result.score_moyen.toFixed(1)}<span className="text-base font-normal text-[var(--color-foreground-muted)]">/5</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-violet-500" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">E / S / G</span>
            </div>
            <div className="flex items-baseline gap-2 font-display font-extrabold">
              <span className="text-2xl text-emerald-500">
                {result.issues.filter((i) => i.materiel && i.pillar === "E").length}
              </span>
              <span className="text-2xl text-blue-500">
                {result.issues.filter((i) => i.materiel && i.pillar === "S").length}
              </span>
              <span className="text-2xl text-violet-500">
                {result.issues.filter((i) => i.materiel && i.pillar === "G").length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {(["matrix", "narrative"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-carbon-emerald text-carbon-emerald"
                : "border-transparent text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {tab === "matrix" ? "Matrice 2D" : "Narratif ESRS"}
          </button>
        ))}
        {scoring && (
          <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-foreground-muted)]">
            <RefreshCw className="w-3 h-3 animate-spin" /> Recalcul…
          </span>
        )}
      </div>

      {activeTab === "matrix" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
                Matrice impact × probabilité
              </h2>
              <div className="flex items-center gap-3 text-xs text-[var(--color-foreground-muted)]">
                {Object.entries(PILLAR_COLORS).map(([p, c]) => (
                  <span key={p} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                    {p === "E" ? "Environnement" : p === "S" ? "Social" : "Gouvernance"}
                  </span>
                ))}
              </div>
            </div>
            {interactive && (
              <p className="text-xs text-[var(--color-foreground-muted)] mb-3 flex items-center gap-1">
                <span className="font-medium">Astuce :</span> glissez les points pour repositionner les enjeux
              </p>
            )}
            <div className="w-full" style={{ aspectRatio: "1 / 1", maxWidth: CHART_SIZE }}>
              <Matrix
                issues={displayIssues}
                onMove={handleMove}
                interactive={interactive}
              />
            </div>
          </div>

          {/* Issue list */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-display text-sm font-bold text-[var(--color-foreground)] mb-3">
              Enjeux ({displayIssues.length})
            </h2>
            <div className="space-y-1.5 overflow-y-auto max-h-80">
              {displayIssues.map((issue) => (
                <div
                  key={issue.code}
                  className="flex items-center gap-2 py-1.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PILLAR_COLORS[issue.pillar] ?? "#94a3b8" }}
                  />
                  <span className="font-mono text-xs text-carbon-emerald font-bold w-10 flex-shrink-0">
                    {issue.code}
                  </span>
                  <span className="text-xs text-[var(--color-foreground)] flex-1 truncate">
                    {issue.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                      issue.materiel
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                        : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
                    }`}
                  >
                    {issue.score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "narrative" && result && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
                Narratif double matérialité
              </h2>
            </div>
            <span className="text-xs text-[var(--color-foreground-muted)]">
              Secteur : {SECTOR_LABELS[sector] ?? sector}
            </span>
          </div>
          <NarrativePanel narrative={result.narrative} />
        </div>
      )}
    </div>
  );
}
