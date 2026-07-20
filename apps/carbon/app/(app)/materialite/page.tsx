"use client";

/* ════════════════════════════════════════════════════════════════════════════
   Double matérialité — Cockpit CarbonCo (refonte)
   Matrice IRO draggable avec quadrants nommés + zone matérielle glow ·
   KPIs avec micro-visualisations · panneau Enjeux digitalisé filtrable ·
   narratif ESRS. API : /materialite/presets · /positions · /score.
   ════════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardList, Loader2, RefreshCw, Search } from "lucide-react";

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

import {
  EditModeButton, SaveButton, SectorBar, MatKpiRow, MatrixSection, NarrativePanel, parseNarrative,
  type MatIssue, type PillarMap,
} from "@/components/cockpit/materialite-sections";
import { MaterialiteVersions } from "@/components/cockpit/materialite-versions";

/* ─── Palette piliers (cohérente avec le design cockpit) ──────────────────── */
const PILLARS: PillarMap = {
  E: { label: "Environnement", color: "#34D399" },
  S: { label: "Social",        color: "#60A5FA" },
  G: { label: "Gouvernance",   color: "#A78BFA" },
};

const SECTOR_LABELS: Record<string, string> = {
  tech:        "Technologie",
  industrie:   "Industrie",
  retail:      "Retail",
  services:    "Services",
  finance:     "Finance",
};

const THRESHOLD = 2.5;

/* ─── Enrichissement : la BFF ne renvoie que { code, label, x, y, score, materiel, pillar }.
   On dérive les champs cockpit (esrs, iro, trend, owner) à partir du pilier et du code. */

const ESRS_BY_PREFIX: Record<string, string> = {
  CC: "ESRS E1",
  ER: "ESRS E1",
  CE: "ESRS E5",
  WR: "ESRS E3",
  BD: "ESRS E4",
  WC: "ESRS S1",
  SC: "ESRS S2",
  BC: "ESRS G1",
  DP: "ESRS S4",
};

const OWNER_BY_PILLAR: Record<"E" | "S" | "G", string> = {
  E: "Dir. RSE",
  S: "DRH",
  G: "Direction",
};

function esrsFor(code: string, pillar: "E" | "S" | "G"): string {
  const prefix = code.split("-")[0];
  return ESRS_BY_PREFIX[prefix] ?? `ESRS ${pillar}1`;
}

function iroFor(pillar: "E" | "S" | "G"): Array<"I" | "R" | "O"> {
  if (pillar === "E") return ["R", "I"];
  if (pillar === "S") return ["I"];
  return ["R"];
}

function trendForScore(score: number): "up" | "down" | "flat" {
  if (score >= 4) return "up";
  if (score <= 2) return "down";
  return "flat";
}

function enrich(sc: ScoredIssue): MatIssue {
  return {
    code: sc.code,
    label: sc.label,
    pillar: sc.pillar,
    esrs: esrsFor(sc.code, sc.pillar),
    x: sc.x,
    y: sc.y,
    fin: sc.x,
    imp: sc.y,
    iro: iroFor(sc.pillar),
    trend: trendForScore(sc.score),
    owner: OWNER_BY_PILLAR[sc.pillar],
    score: sc.score,
    materiel: sc.materiel,
  };
}

/* ─── Composant principal ───────────────────────────────────────────────── */

export default function MaterialitePage() {
  const [presets, setPresets] = useState<SectorPresetsResponse | null>(null);
  const [sector, setSector] = useState<string>("industrie");
  const [positions, setPositions] = useState<IssuePosition[]>([]);
  const [result, setResult] = useState<MaterialiteScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [tab, setTab] = useState<"matrix" | "narrative">("matrix");
  const [hovered, setHovered] = useState<string | null>(null);

  // Charge les presets et positions sauvegardées
  useEffect(() => {
    Promise.all([fetchMaterialitePresets(), fetchMaterialitePositions()])
      .then(([p, pos]) => {
        setPresets(p);
        if (pos.length > 0) setPositions(pos);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Recalcule à chaque changement (debounce 300 ms)
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => {
      setScoring(true);
      computeMaterialiteScore(positions, sector)
        .then(setResult)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setScoring(false));
    }, 300);
    return () => {
      if (scoreTimer.current) clearTimeout(scoreTimer.current);
    };
  }, [positions, sector, loading]);

  const handleMove = useCallback((code: string, x: number, y: number) => {
    setSaved(false);
    setPositions((prev) => {
      const exists = prev.some((p) => p.code === code);
      const updated: IssuePosition = {
        code,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
      if (exists) return prev.map((p) => (p.code === code ? updated : p));
      return [...prev, updated];
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveMaterialitePositions(positions, sector);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function loadPreset(s: string) {
    setSector(s);
    setPositions([]); // empty → preset server-side
  }

  // ─── Données dérivées ────────────────────────────────────────────────
  const enrichedIssues = useMemo<MatIssue[]>(
    () => (result?.issues ?? []).map(enrich),
    [result?.issues],
  );

  const scoreMoyen = result?.score_moyen ?? 0;

  // ─── Données secteurs : libellés FR + fallback ───────────────────────
  const sectorsForBar = useMemo(
    () => (presets?.sectors ?? ["industrie"]).map((s) => SECTOR_LABELS[s] ?? s),
    [presets?.sectors],
  );
  const sectorLabelToKey = useMemo(() => {
    const out: Record<string, string> = {};
    (presets?.sectors ?? ["industrie"]).forEach((s) => {
      out[SECTOR_LABELS[s] ?? s] = s;
    });
    return out;
  }, [presets?.sectors]);

  const sectorLabel = SECTOR_LABELS[sector] ?? sector;
  const narrativeBlocks = useMemo(
    () => (result?.narrative ? parseNarrative(result.narrative) : []),
    [result?.narrative],
  );

  if (loading) {
    return (
      <div className="cc-app p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--cc-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--cc-em)]" />
          <span className="text-sm">Chargement de la matrice…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-app">
      <div className="px-6 pt-4 pb-6 space-y-4">
        {/* Top bar : titre + freshness + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl leading-tight">Double matérialité</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--cc-subtle)] mt-1">
              <span className="cc-live-dot" />
              <span>
                Matrice IRO · {result ? `${result.total_issues} enjeux · ${result.total_materiel} matériels` : "analyse en continu"}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-[var(--cc-border)] grid place-items-center text-[var(--cc-muted)] hover:text-[var(--cc-fg)] hover:bg-[var(--cc-surface-2)] transition-colors"
              title="Rechercher"
              aria-label="Rechercher"
            >
              <Search className="w-4 h-4" />
            </button>
            {/* PR-10 : lien croisé vers le registre IRO détaillé — la matrice
                2D reste l'outil de visualisation/tri, le registre IRO est la
                couche granulaire et évidencée en-dessous. Pas une fusion de
                pages. */}
            <Link
              href="/iro"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--cc-border)] text-xs font-medium text-[var(--cc-muted)] hover:text-[var(--cc-fg)] hover:bg-[var(--cc-surface-2)] transition-colors"
              title="Registre IRO — impacts, risques et opportunités évidencés"
            >
              <ClipboardList className="w-4 h-4" />
              Registre IRO
            </Link>
            <EditModeButton on={editMode} onToggle={() => setEditMode((v) => !v)} />
            <SaveButton onSave={handleSave} saved={saved} disabled={saving || positions.length === 0} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 text-sm text-[var(--color-danger)]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs underline opacity-70 hover:opacity-100"
            >
              fermer
            </button>
          </div>
        )}

        {/* Sélecteur de secteur */}
        {presets && (
          <SectorBar
            sectors={sectorsForBar}
            sector={sectorLabel}
            setSector={(label) => loadPreset(sectorLabelToKey[label] ?? label)}
          />
        )}

        {/* KPI band refondu */}
        <MatKpiRow issues={enrichedIssues} pillars={PILLARS} scoreMoyen={scoreMoyen} />

        {/* Tabs */}
        <div className="mat-tabs">
          <button
            className={`mat-tab ${tab === "matrix" ? "on" : ""}`}
            onClick={() => setTab("matrix")}
          >
            Matrice 2D
          </button>
          <button
            className={`mat-tab ${tab === "narrative" ? "on" : ""}`}
            onClick={() => setTab("narrative")}
          >
            Narratif ESRS
          </button>
          {scoring && (
            <span className="ml-auto flex items-center gap-1 text-xs text-[var(--cc-muted)] self-center">
              <RefreshCw className="w-3 h-3 animate-spin" /> Recalcul…
            </span>
          )}
        </div>

        {tab === "matrix" ? (
          <MatrixSection
            issues={enrichedIssues}
            pillars={PILLARS}
            hovered={hovered}
            setHovered={setHovered}
            editMode={editMode}
            onMove={handleMove}
            threshold={THRESHOLD}
          />
        ) : result ? (
          <NarrativePanel blocks={narrativeBlocks} sector={sectorLabel} />
        ) : null}

        {/* Versions archivées (T7.4) — figer/exporter l'évaluation de l'exercice */}
        <MaterialiteVersions sector={sector} />

        <div className="text-center text-[11px] text-[var(--cc-subtle)] font-mono py-2">
          Double matérialité ESRS · règle ESRS 1 (impact OU financier ≥ {THRESHOLD}) · données pilotées par /materialite/score
        </div>
      </div>
    </div>
  );
}
