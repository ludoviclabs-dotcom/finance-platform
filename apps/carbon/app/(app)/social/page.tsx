"use client";

import { useMemo } from "react";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  BookOpen,
  HeartHandshake,
  Scale,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useVsmeSnapshot } from "@/lib/hooks/use-vsme-snapshot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    if (isFinite(n)) return n;
  }
  return null;
}

function fmt(v: unknown, unit = "", decimals = 1): string {
  const n = toNum(v);
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit ? " " + unit : ""}`;
}

function fmtInt(v: unknown, unit = ""): string {
  const n = toNum(v);
  if (n === null) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")}${unit ? " " + unit : ""}`;
}

function fmtBool(v: unknown): { label: string; ok: boolean | null } {
  if (v === true || v === "true" || v === "oui" || v === "Oui" || v === 1) return { label: "Oui", ok: true };
  if (v === false || v === "false" || v === "non" || v === "Non" || v === 0) return { label: "Non", ok: false };
  if (typeof v === "string" && v.trim()) return { label: v, ok: null };
  return { label: "—", ok: null };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral" | null;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}/15`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        {trend && (
          <TrendIcon
            className={`w-4 h-4 ${
              trend === "up" ? "text-[var(--color-success)]" : trend === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-foreground-muted)]"
            }`}
          />
        )}
      </div>
      <p className="font-display text-2xl font-extrabold text-[var(--color-foreground)]">
        {value}
        {unit && <span className="text-sm font-normal text-[var(--color-foreground-muted)] ml-1">{unit}</span>}
      </p>
      <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[var(--color-foreground-subtle)] mt-0.5">{sub}</p>}
    </div>
  );
}

function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const cls =
    highlight === "good"
      ? "text-[var(--color-success)] font-semibold"
      : highlight === "bad"
        ? "text-[var(--color-danger)] font-semibold"
        : "text-[var(--color-foreground)] font-semibold";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-foreground-muted)]">{label}</span>
      <span className={`text-sm ${cls}`}>{value}</span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: unknown }) {
  const { label: valLabel, ok } = fmtBool(value);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-foreground-muted)]">{label}</span>
      <span
        className={`inline-flex items-center gap-1 text-sm font-semibold ${
          ok === true
            ? "text-[var(--color-success)]"
            : ok === false
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-foreground-muted)]"
        }`}
      >
        {ok === true ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : ok === false ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <Info className="w-3.5 h-3.5" />
        )}
        {valLabel}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{title}</h3>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SocialPage() {
  const snap = useVsmeSnapshot();

  const social = useMemo(
    () => (snap.status === "ready" ? snap.data.social : null),
    [snap],
  );
  const profile = useMemo(
    () => (snap.status === "ready" ? snap.data.profile : null),
    [snap],
  );

  const effectifTotal = toNum(social?.effectifTotal ?? profile?.etp);
  const pctCdi = toNum(social?.pctCdi);
  const tauxRotation = toNum(social?.tauxRotation);
  const ltir = toNum(social?.ltir);
  const formationH = toNum(social?.formationHEtp);
  const ecartSalaire = toNum(social?.ecartSalaireHf);
  const pctFemmes = toNum(social?.pctFemmesMgmt);

  if (snap.status === "loading") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-foreground-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
          <span className="text-sm">Chargement des indicateurs sociaux…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-carbon-emerald" />
          Module Social
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Effectifs, parité, sécurité, formation — indicateurs VSME S1–S10 et ESRS S1–S4.
        </p>
      </div>

      {/* Error */}
      {snap.status === "error" && (
        <div className="rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <span className="text-xs text-[var(--color-danger)]">{snap.error}</span>
        </div>
      )}

      {/* Warnings */}
      {snap.status === "ready" && snap.data.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              {snap.data.warnings.length} avertissement{snap.data.warnings.length > 1 ? "s" : ""}
            </span>
          </div>
          {snap.data.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-6">{w}</p>
          ))}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Effectif total"
          value={effectifTotal !== null ? fmtInt(effectifTotal) : "—"}
          icon={Users}
          color="text-carbon-emerald"
          sub={profile?.etp != null ? `${fmt(profile.etp, "ETP")}` : undefined}
        />
        <KpiCard
          label="CDI / Permanents"
          value={pctCdi !== null ? fmt(pctCdi, "%", 1) : "—"}
          icon={HeartHandshake}
          color="text-cyan-500"
          trend={pctCdi !== null ? (pctCdi >= 80 ? "up" : pctCdi >= 60 ? "neutral" : "down") : null}
        />
        <KpiCard
          label="Taux de rotation"
          value={tauxRotation !== null ? fmt(tauxRotation, "%", 1) : "—"}
          icon={TrendingDown}
          color="text-amber-500"
          trend={tauxRotation !== null ? (tauxRotation <= 10 ? "up" : tauxRotation <= 20 ? "neutral" : "down") : null}
          sub="Turnover annuel"
        />
        <KpiCard
          label="LTIR"
          value={ltir !== null ? fmt(ltir, "", 2) : "—"}
          icon={ShieldAlert}
          color="text-violet-500"
          trend={ltir !== null ? (ltir === 0 ? "up" : ltir <= 2 ? "neutral" : "down") : null}
          sub="Taux de fréquence accidents"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Formation / ETP"
          value={formationH !== null ? fmt(formationH, "h", 1) : "—"}
          icon={BookOpen}
          color="text-blue-500"
          sub="Heures de formation par ETP"
        />
        <KpiCard
          label="Écart salarial H/F"
          value={ecartSalaire !== null ? fmt(ecartSalaire, "%", 1) : "—"}
          icon={Scale}
          color="text-pink-500"
          trend={ecartSalaire !== null ? (ecartSalaire <= 5 ? "up" : ecartSalaire <= 10 ? "neutral" : "down") : null}
          sub="Objectif : < 5%"
        />
        <KpiCard
          label="Femmes en management"
          value={pctFemmes !== null ? fmt(pctFemmes, "%", 1) : "—"}
          icon={Users}
          color="text-emerald-500"
          trend={pctFemmes !== null ? (pctFemmes >= 40 ? "up" : pctFemmes >= 30 ? "neutral" : "down") : null}
          sub="Part des postes d'encadrement"
        />
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Effectifs & contrats */}
        <SectionCard title="Effectifs & contrats" icon={Users} color="text-carbon-emerald">
          <DataRow label="Effectif total" value={fmtInt(social?.effectifTotal ?? profile?.etp)} />
          <DataRow label="ETP (équivalent temps plein)" value={fmt(profile?.etp, "ETP")} />
          <DataRow label="Part CDI" value={fmt(social?.pctCdi, "%")} />
          <DataRow label="Taux de rotation" value={fmt(social?.tauxRotation, "%")} />
          <DataRow label="Diversité / inclusion" value={typeof social?.diversite === "string" ? social.diversite : "—"} />
        </SectionCard>

        {/* Sécurité & santé */}
        <SectionCard title="Sécurité & santé au travail" icon={ShieldAlert} color="text-violet-500">
          <DataRow
            label="LTIR (taux fréquence accidents)"
            value={fmt(social?.ltir, "", 2)}
            highlight={ltir !== null ? (ltir === 0 ? "good" : ltir <= 2 ? "neutral" : "bad") : undefined}
          />
          <DataRow label="Heures de formation / ETP" value={fmt(social?.formationHEtp, "h")} />
          <BoolRow label="Dialogue social formalisé" value={social?.dialogueSocial} />
          <BoolRow label="Litiges sociaux en cours" value={social?.litigesSociaux} />
        </SectionCard>

        {/* Parité & diversité */}
        <SectionCard title="Parité & diversité" icon={Scale} color="text-pink-500">
          <DataRow
            label="Écart salarial H/F"
            value={fmt(social?.ecartSalaireHf, "%")}
            highlight={
              ecartSalaire !== null
                ? ecartSalaire <= 5
                  ? "good"
                  : ecartSalaire <= 10
                    ? "neutral"
                    : "bad"
                : undefined
            }
          />
          <DataRow
            label="Femmes en management"
            value={fmt(social?.pctFemmesMgmt, "%")}
            highlight={pctFemmes !== null ? (pctFemmes >= 40 ? "good" : pctFemmes >= 30 ? "neutral" : "bad") : undefined}
          />
          <DataRow label="Diversité" value={typeof social?.diversite === "string" ? social.diversite : "—"} />
        </SectionCard>

        {/* Gouvernance sociale */}
        <SectionCard title="Gouvernance sociale" icon={HeartHandshake} color="text-cyan-500">
          <BoolRow label="Dialogue social formalisé" value={social?.dialogueSocial} />
          <BoolRow label="Litiges sociaux en cours" value={social?.litigesSociaux} />
          <DataRow label="Secteur NAF" value={typeof profile?.secteurNaf === "string" ? profile.secteurNaf : "—"} />
          <DataRow label="Pays de rattachement" value={typeof profile?.pays === "string" ? profile.pays : "—"} />
          <DataRow label="Périmètre de reporting" value={typeof profile?.perimetre === "string" ? profile.perimetre : "—"} />
        </SectionCard>
      </div>

      {/* ESRS S1-S4 mapping */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            Couverture ESRS S1–S4
          </h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
            Standards social applicables selon la double matérialité CSRD
          </p>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {[
            {
              code: "ESRS S1",
              label: "Effectifs propres",
              indicators: ["Effectifs totaux", "CDI / CDD", "Temps partiel", "Rotation", "Accidents"],
              covered: [
                social?.effectifTotal != null,
                social?.pctCdi != null,
                true,
                social?.tauxRotation != null,
                social?.ltir != null,
              ],
            },
            {
              code: "ESRS S2",
              label: "Travailleurs de la chaîne de valeur",
              indicators: ["Conditions de travail fournisseurs", "Dialogue social", "Droits fondamentaux"],
              covered: [false, social?.dialogueSocial != null, false],
            },
            {
              code: "ESRS S3",
              label: "Communautés affectées",
              indicators: ["Impacts locaux", "Engagement communautaire"],
              covered: [false, false],
            },
            {
              code: "ESRS S4",
              label: "Consommateurs & utilisateurs finaux",
              indicators: ["Sécurité produits", "Données personnelles", "Accès équitable"],
              covered: [false, false, false],
            },
          ].map((esrs) => {
            const coveredCount = esrs.covered.filter(Boolean).length;
            const pct = Math.round((coveredCount / esrs.covered.length) * 100);
            return (
              <div key={esrs.code} className="p-4 flex items-start gap-4">
                <div className="flex-shrink-0 w-16 text-center">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-carbon-emerald/10 text-carbon-emerald text-[11px] font-bold">
                    {esrs.code}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-foreground)] mb-1">
                    {esrs.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {esrs.indicators.map((ind, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          esrs.covered[i]
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                            : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
                        }`}
                      >
                        {esrs.covered[i] ? "✓" : "○"} {ind}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className={`text-sm font-bold ${pct === 100 ? "text-[var(--color-success)]" : pct >= 50 ? "text-amber-600" : "text-[var(--color-foreground-muted)]"}`}>
                    {pct}%
                  </p>
                  <p className="text-[10px] text-[var(--color-foreground-subtle)]">couvert</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
