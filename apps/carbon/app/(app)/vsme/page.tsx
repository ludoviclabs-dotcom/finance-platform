"use client";

import { useVsmeSnapshot } from "@/lib/hooks/use-vsme-snapshot";
import {
  Leaf,
  Users,
  Shield,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("fr-FR") : "—";
  return String(v);
}

function fmtPct(v: unknown): string {
  if (v === null || v === undefined || typeof v !== "number" || !Number.isFinite(v))
    return "—";
  return `${v.toFixed(1)} %`;
}

function fmtNum(v: unknown, unit = "", decimals = 1): string {
  if (v === null || v === undefined || typeof v !== "number" || !Number.isFinite(v))
    return "—";
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: decimals })}${unit ? " " + unit : ""}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
        {label}
      </h2>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const missing = value === "—";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-foreground-muted)]">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          missing ? "text-[var(--color-foreground-subtle)]" : "text-[var(--color-foreground)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatutBadge({ statut }: { statut: string }) {
  const lower = statut.toLowerCase();
  if (lower === "complet") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-success-bg)] text-[var(--color-success)]">
        <CheckCircle className="w-3 h-3" /> Complet
      </span>
    );
  }
  if (lower.includes("partiel")) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
        <Clock className="w-3 h-3" /> Partiel
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
      <XCircle className="w-3 h-3" /> Incomplet
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VsmePage() {
  const snap = useVsmeSnapshot();

  // Loading
  if (snap.status === "loading") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-foreground-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
          <span className="text-sm">Chargement des indicateurs VSME…</span>
        </div>
      </div>
    );
  }

  // Error
  if (snap.status === "error") {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--color-danger)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-danger)] mb-1">
              Impossible de charger le snapshot VSME
            </p>
            <p className="text-xs text-[var(--color-foreground-muted)]">{snap.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { completude, profile, environnement, social, gouvernance, warnings } = snap.data;
  const scorePct = Number.isFinite(completude.scorePct) ? completude.scorePct : 0;

  return (
    <div className="p-6 space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
          VSME — Standard volontaire PME
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Indicateurs EFRAG VSME (BP, E, S, G) synchronisés via les plages CC_* du workbook ESG.
        </p>
      </div>

      {/* ── Completude banner ── */}
      <Card>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-[var(--color-foreground-muted)] uppercase tracking-wide font-semibold mb-1">
              Complétude globale
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-[var(--color-foreground)]">
                {scorePct.toFixed(0)}%
              </span>
              <span className="text-sm text-[var(--color-foreground-muted)]">
                {completude.indicateursCompletes} / {completude.totalIndicateurs} indicateurs
              </span>
            </div>
          </div>
          <StatutBadge statut={completude.statut} />
        </div>
        {/* Progress bar */}
        <div className="w-full h-2.5 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-carbon-emerald to-carbon-emerald-light transition-all duration-700"
            style={{ width: `${Math.min(scorePct, 100)}%` }}
          />
        </div>
      </Card>

      {/* ── Warnings ── */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1.5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              {warnings.length} avertissement{warnings.length > 1 ? "s" : ""}
            </span>
          </div>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-6">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* ── 4 sections grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Section A — Profil */}
        <Card>
          <SectionTitle
            icon={Leaf}
            label="A — Profil de l'entreprise"
            color="bg-green-50 text-green-600"
          />
          <Row label="Raison sociale" value={fmt(profile.raisonSociale)} />
          <Row label="Secteur NAF" value={fmt(profile.secteurNaf)} />
          <Row label="Effectif (ETP)" value={fmtNum(profile.etp, "ETP", 0)} />
          <Row label="CA net" value={fmtNum(profile.caNet, "k€", 0)} />
          <Row label="Année de reporting" value={fmt(profile.anneeReporting)} />
          <Row label="Pays" value={fmt(profile.pays)} />
          <Row label="Périmètre de consolidation" value={fmt(profile.perimetre)} />
        </Card>

        {/* Section B — Environnement */}
        <Card>
          <SectionTitle
            icon={Leaf}
            label="B — Environnement"
            color="bg-emerald-50 text-emerald-600"
          />
          <Row label="Scope 1" value={fmtNum(environnement.scope1Tco2e, "tCO₂e")} />
          <Row label="Scope 2 (LB)" value={fmtNum(environnement.scope2LbTco2e, "tCO₂e")} />
          <Row label="Scope 2 (MB)" value={fmtNum(environnement.scope2MbTco2e, "tCO₂e")} />
          <Row label="Scope 3" value={fmtNum(environnement.scope3Tco2e, "tCO₂e")} />
          <Row label="Total GES" value={fmtNum(environnement.totalGesTco2e, "tCO₂e")} />
          <Row label="Intensité CA" value={fmtNum(environnement.intensiteCaGes, "tCO₂e/k€")} />
          <Row label="Énergie totale" value={fmtNum(environnement.energieMwh, "MWh")} />
          <Row label="Part ENR" value={fmtPct(environnement.partEnrPct)} />
          <Row label="Consommation eau" value={fmtNum(environnement.eauM3, "m³", 0)} />
          <Row label="Déchets" value={fmtNum(environnement.dechetsTonnes, "t", 1)} />
          <Row label="Taux valorisation déchets" value={fmtPct(environnement.valorisationDechetsPct)} />
          <Row label="Plan de réduction GES" value={fmt(environnement.planReductionGes)} />
        </Card>

        {/* Section C — Social */}
        <Card>
          <SectionTitle
            icon={Users}
            label="C — Social"
            color="bg-blue-50 text-blue-600"
          />
          <Row label="Effectif total" value={fmtNum(social.effectifTotal, "pers.", 0)} />
          <Row label="Part CDI" value={fmtPct(social.pctCdi)} />
          <Row label="Taux de rotation" value={fmtPct(social.tauxRotation)} />
          <Row label="LTIR (accidents)" value={fmtNum(social.ltir, "", 2)} />
          <Row label="Formation (h/ETP)" value={fmtNum(social.formationHEtp, "h")} />
          <Row label="Écart salarial H/F" value={fmtPct(social.ecartSalaireHf)} />
          <Row label="Femmes en management" value={fmtPct(social.pctFemmesMgmt)} />
          <Row label="Diversité" value={fmt(social.diversite)} />
          <Row label="Dialogue social" value={fmt(social.dialogueSocial)} />
          <Row label="Litiges sociaux" value={fmt(social.litigesSociaux)} />
        </Card>

        {/* Section D — Gouvernance */}
        <Card>
          <SectionTitle
            icon={Shield}
            label="D — Gouvernance"
            color="bg-violet-50 text-violet-600"
          />
          <Row label="Anti-corruption" value={fmt(gouvernance.antiCorruption)} />
          <Row label="Formation éthique" value={fmt(gouvernance.formationEthique)} />
          <Row label="Dispositif whistleblowing" value={fmt(gouvernance.whistleblowing)} />
          <Row label="CA indépendants" value={fmtPct(gouvernance.pctCaIndependants)} />
          <Row label="Protection des données" value={fmt(gouvernance.protectionDonnees)} />
        </Card>
      </div>
    </div>
  );
}
