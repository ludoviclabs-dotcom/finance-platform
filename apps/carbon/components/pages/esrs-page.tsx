"use client";

/* ════════════════════════════════════════════════════════════════════════════
   ESRS / CSRD — Cockpit CarbonCo (refonte)
   Hero : jauge de conformité 270° + radar de couverture + barres par pilier ·
   Priorités : 3 normes qui bloquent l'objectif · Liste groupée par pilier ·
   Live data via useEsgSnapshot avec fallback démo.
   ════════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { esrsStandards } from "@/lib/data";
import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";
import type { MaterialiteIssue } from "@/lib/api";

import {
  EsrsHero, EsrsPriorities, StandardsList,
  type EsrsStandard, type EsrsTotals, type EsrsPillarMap, type EsrsPillar, type EsrsPillarSummary,
  type EsrsStatusKey, type EsrsMaterialIssue,
} from "@/components/cockpit/esrs-sections";

/* ─── Palette piliers ESRS (cohérente avec le design cockpit) ─────────────── */
const PILLARS: EsrsPillarMap = {
  E:   { label: "Environnement", color: "#34D399" },
  S:   { label: "Social",        color: "#60A5FA" },
  G:   { label: "Gouvernance",   color: "#A78BFA" },
  GEN: { label: "Général",       color: "#22D3EE" },
};

/* ─── Métadonnées par norme : description, action, pilote ────────────────── */
const STANDARD_META: Record<string, {
  code: string;
  name: string;
  pillar: EsrsPillar;
  desc: string;
  owner: string;
  action: string;
}> = {
  "ESRS E1": { code: "E1", name: "Changement climatique",      pillar: "E",   desc: "Atténuation, adaptation au changement climatique, énergie.", owner: "Dir. RSE",  action: "Finaliser le plan de transition climat (E1-1)." },
  "ESRS E2": { code: "E2", name: "Pollution",                  pillar: "E",   desc: "Pollution de l'air, de l'eau, des sols, substances préoccupantes.", owner: "Dir. Ops", action: "Compléter l'inventaire des substances préoccupantes." },
  "ESRS E3": { code: "E3", name: "Eau & ressources marines",   pillar: "E",   desc: "Consommation d'eau, rejets, écosystèmes marins.", owner: "Dir. Ops", action: "Mesurer la consommation d'eau sur 3 sites manquants." },
  "ESRS E4": { code: "E4", name: "Biodiversité",               pillar: "E",   desc: "Impacts, dépendances, zones sensibles à la biodiversité.", owner: "Dir. RSE", action: "Cartographier les zones sensibles proches des sites." },
  "ESRS E5": { code: "E5", name: "Économie circulaire",        pillar: "E",   desc: "Flux de ressources, déchets, recyclage et réemploi.", owner: "Dir. Ops", action: "Tracer les flux de déchets par catégorie." },
  "ESRS S1": { code: "S1", name: "Effectifs propres",          pillar: "S",   desc: "Conditions de travail, égalité, santé & sécurité.", owner: "DRH", action: "Vérifier les indicateurs d'égalité salariale." },
  "ESRS S2": { code: "S2", name: "Travailleurs chaîne de valeur", pillar: "S", desc: "Conditions de travail, droits humains, travail forcé.", owner: "Achats", action: "Lancer le questionnaire fournisseurs droits humains." },
  "ESRS S3": { code: "S3", name: "Communautés affectées",      pillar: "S",   desc: "Droits des communautés, impact territorial.", owner: "Dir. RSE", action: "Démarrer la consultation des parties prenantes." },
  "ESRS S4": { code: "S4", name: "Consommateurs & clients",    pillar: "S",   desc: "Sécurité produits, vie privée, inclusion.", owner: "DSI", action: "Collecter les données satisfaction & vie privée." },
  "ESRS G1": { code: "G1", name: "Conduite des affaires",      pillar: "G",   desc: "Éthique, anti-corruption, lobbying, paiements.", owner: "Direction", action: "Documenter la politique anti-corruption." },
  "ESRS 1":  { code: "1",  name: "Exigences générales",        pillar: "GEN", desc: "Principes, périmètre, double matérialité.", owner: "Dir. RSE", action: "Valider le périmètre de consolidation." },
  "ESRS 2":  { code: "2",  name: "Informations générales",     pillar: "GEN", desc: "Stratégie, gouvernance, gestion des impacts (IRO).", owner: "Dir. RSE", action: "Compléter la description de la gouvernance ESG." },
};

const DEFAULT_DP: Record<string, { dp: number; done: number }> = {
  "ESRS E1": { dp: 48, done: 41 },
  "ESRS E2": { dp: 32, done: 23 },
  "ESRS E3": { dp: 28, done: 17 },
  "ESRS E4": { dp: 36, done: 16 },
  "ESRS E5": { dp: 24, done: 13 },
  "ESRS S1": { dp: 52, done: 47 },
  "ESRS S2": { dp: 30, done: 12 },
  "ESRS S3": { dp: 22, done: 7  },
  "ESRS S4": { dp: 20, done: 7  },
  "ESRS G1": { dp: 26, done: 20 },
  "ESRS 1":  { dp: 18, done: 17 },
  "ESRS 2":  { dp: 42, done: 37 },
};

const TARGET = 80;

function classifyStatus(progress: number): EsrsStatusKey {
  if (progress >= 80) return "compliant";
  if (progress >= 40) return "in_progress";
  return "not_started";
}

function normalizeNorme(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  const match = trimmed.match(/(E1|E2|E3|E4|E5|S1|S2|S3|S4|G1)/);
  if (match) return `ESRS ${match[1]}`;
  if (trimmed.includes("ESRS 1") || trimmed === "ESRS1") return "ESRS 1";
  if (trimmed.includes("ESRS 2") || trimmed === "ESRS2") return "ESRS 2";
  return null;
}

/* ─── Composant principal ───────────────────────────────────────────────── */

export function ESRSPage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const esgSnap = useEsgSnapshot();
  const isLive = esgSnap.status === "ready";
  const esgError = esgSnap.status === "error" ? esgSnap.error : null;

  // ── Standards (live ou démo) ────────────────────────────────────────
  const standards: EsrsStandard[] = useMemo(() => {
    if (esgSnap.status === "ready") {
      const issues = esgSnap.data.materialite.issues ?? [];
      const buckets = new Map<string, MaterialiteIssue[]>();
      for (const issue of issues) {
        const normId = normalizeNorme(issue.normeEsrs);
        if (!normId) continue;
        const existing = buckets.get(normId);
        if (existing) existing.push(issue);
        else buckets.set(normId, [issue]);
      }
      const numOrNull = (v: unknown): number | null =>
        typeof v === "number" && Number.isFinite(v) ? v : null;
      return Object.entries(STANDARD_META).map(([id, meta]) => {
        const bucket = buckets.get(id) ?? [];
        const total = bucket.length;
        const materiels = bucket.filter((i) => i.materiel === true).length;
        const scored = bucket
          .map((i) => numOrNull(i.scoreImpactTotal) ?? numOrNull(i.scoreImpact))
          .filter((v): v is number => v !== null);
        let progress = 0;
        if (scored.length > 0) {
          const avg = scored.reduce((s, v) => s + v, 0) / scored.length;
          progress = Math.min(100, Math.round((avg / 5) * 100));
        } else if (total > 0) {
          progress = Math.round((materiels / total) * 100);
        }
        const dpFallback = DEFAULT_DP[id] ?? { dp: total || 0, done: materiels };
        return {
          id,
          code: meta.code,
          name: meta.name,
          pillar: meta.pillar,
          progress,
          dp: dpFallback.dp,
          done: dpFallback.done,
          missing: Math.max(0, dpFallback.dp - dpFallback.done),
          status: classifyStatus(progress),
          desc: meta.desc,
          owner: meta.owner,
          action: meta.action,
          materialIssues: bucket
            .filter((i) => i.materiel === true)
            .slice(0, 6)
            .map<EsrsMaterialIssue>((i) => ({
              code: i.code,
              label: i.label ?? i.code,
              score: numOrNull(i.scoreImpactTotal) ?? numOrNull(i.scoreImpact) ?? 0,
            })),
        };
      });
    }
    // Fallback démo
    return esrsStandards.map<EsrsStandard>((s) => {
      const meta = STANDARD_META[s.id] ?? {
        code: s.id.replace("ESRS ", ""),
        name: s.name,
        pillar: "GEN" as EsrsPillar,
        desc: s.description,
        owner: "—",
        action: "—",
      };
      const dp = DEFAULT_DP[s.id] ?? { dp: s.dataPoints, done: s.completedPoints };
      return {
        id: s.id,
        code: meta.code,
        name: meta.name,
        pillar: meta.pillar,
        progress: s.progress,
        dp: dp.dp,
        done: dp.done,
        missing: Math.max(0, dp.dp - dp.done),
        status: classifyStatus(s.progress),
        desc: meta.desc,
        owner: meta.owner,
        action: meta.action,
        materialIssues: [],
      };
    });
  }, [esgSnap]);

  // ── Totaux & résumé par pilier ──────────────────────────────────────
  const totals: EsrsTotals = useMemo(() => {
    const n = standards.length;
    return {
      avg: n > 0 ? Math.round(standards.reduce((a, s) => a + s.progress, 0) / n) : 0,
      compliant: standards.filter((s) => s.status === "compliant").length,
      inProgress: standards.filter((s) => s.status === "in_progress").length,
      notStarted: standards.filter((s) => s.status === "not_started").length,
      dpDone: standards.reduce((a, s) => a + s.done, 0),
      dpTotal: standards.reduce((a, s) => a + s.dp, 0),
      target: TARGET,
    };
  }, [standards]);

  const pillarSummary: EsrsPillarSummary[] = useMemo(() => {
    return (Object.keys(PILLARS) as EsrsPillar[]).map((p) => {
      const items = standards.filter((s) => s.pillar === p);
      const avg = items.length > 0
        ? Math.round(items.reduce((a, s) => a + s.progress, 0) / items.length)
        : 0;
      return { pillar: p, label: PILLARS[p].label, color: PILLARS[p].color, count: items.length, avg };
    });
  }, [standards]);

  return (
    <div className="cc-app">
      <div className="px-6 pt-4 pb-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl leading-tight">ESRS / CSRD</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--cc-subtle)] mt-1">
              <span className="cc-live-dot" />
              <span>
                Conformité réglementaire · {standards.length} norme{standards.length > 1 ? "s" : ""}{" "}
                · {totals.avg}% global
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="cc-dl-chip warn" title="Rapport ESRS E1">
              <span className="cc-dl-dot" />
              <span className="cc-dl-days">E1 · 15j</span>
            </div>
            <div className="cc-dl-chip alert" title="Dépôt CSRD">
              <span className="cc-dl-dot" />
              <span className="cc-dl-days">CSRD · 45j</span>
            </div>
          </div>
        </div>

        {/* Banners */}
        {isLive && (
          <div className="flex items-center gap-2 text-xs text-[var(--cc-muted)]">
            <span className="cc-live-dot" />
            <span>Données live — dérivées de la matrice de matérialité ESG</span>
          </div>
        )}
        {esgError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">
              <span className="font-semibold">Snapshot ESG indisponible.</span>{" "}
              Affichage des données de démonstration. <span className="opacity-70">({esgError})</span>
            </div>
          </div>
        )}
        {!isLive && !esgError && esgSnap.status !== "loading" && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Info className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs flex-1">
              <strong>Données de démonstration</strong> — les taux de progression affichés sont fictifs.
              Complétez votre{" "}
              <a href="/materialite" className="underline font-semibold hover:text-blue-900">
                matrice de matérialité
              </a>{" "}
              pour voir votre conformité ESRS réelle.
            </p>
          </div>
        )}

        {/* Hero conformité */}
        <EsrsHero
          standards={standards}
          totals={totals}
          pillars={PILLARS}
          pillarSummary={pillarSummary}
          hovered={hovered}
          setHovered={setHovered}
        />

        {/* Priorités de conformité */}
        <EsrsPriorities
          standards={standards}
          pillars={PILLARS}
          onOpen={setExpanded}
        />

        {/* Liste des normes groupée par pilier */}
        <StandardsList
          standards={standards}
          pillars={PILLARS}
          hovered={hovered}
          setHovered={setHovered}
          expanded={expanded}
          setExpanded={setExpanded}
        />

        <div className="text-center text-[11px] text-[var(--cc-subtle)] font-mono py-2">
          Conformité ESRS dérivée de la matrice de matérialité · objectif {TARGET}%
        </div>
      </div>
    </div>
  );
}
