"use client";

/**
 * Fiche IRO — détail d'un Impact, Risque ou Opportunité (PR-10, BETA).
 *
 * Deux panneaux DISTINCTS et TOUJOURS visibles côte à côte — « Matérialité
 * d'impact » et « Matérialité financière » — JAMAIS un score combiné
 * affiché (plan §6/§11). Formulaire de décision humaine (`is_material`,
 * `basis`, `justification` obligatoire) avec historique append-only visible.
 * Actions et correspondances de disclosure. Téléchargement de l'Evidence
 * Pack (ZIP signé).
 *
 * États loading / schema_not_ready / error / ready explicites — motif
 * `/water`, `/nature`.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";

import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import {
  DisclosureMapping,
  FINANCIAL_CHANNEL_LABEL,
  FinancialAssessment,
  IRO_STATUS_LABEL,
  IRO_STATUS_TONE,
  IRO_TYPE_LABEL,
  ImpactAssessment,
  IroAction,
  IroDetail,
  MaterialityDecision,
  ORIGIN_DOMAIN_LABEL,
  SchemaNotReadyError,
  createDisclosureMapping,
  createFinancialAssessment,
  createImpactAssessment,
  createIroAction,
  decideMateriality,
  downloadIroEvidencePack,
  fetchIroDetail,
  formatComponent,
  type DecisionBasis,
  type DisclosureStatus,
  type FinancialChannel,
  type IroActionType,
  type Polarity,
  type TimeHorizon,
} from "@/lib/api/iro";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

export default function IroDetailPage() {
  const params = useParams<{ id: string }>();
  const iroId = Number(params.id);

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<IroDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      setError(null);
      try {
        const d = await fetchIroDetail(iroId, signal);
        setDetail(d);
        setState("ready");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof SchemaNotReadyError) {
          setState("schema_not_ready");
          return;
        }
        setError((e as Error).message);
        setState("error");
      }
    },
    [iroId],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setMessage(null);
      try {
        await fn();
        setMessage(success);
        await load();
      } catch (e) {
        if (e instanceof SchemaNotReadyError) {
          setState("schema_not_ready");
          return;
        }
        setMessage(`Refusé : ${(e as Error).message}`);
      }
    },
    [load],
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link
        href="/iro"
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour au registre IRO
      </Link>

      {state === "loading" && (
        <p data-testid="iro-detail-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement de la fiche IRO…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="iro-detail-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>La migration 040 n&apos;est pas encore appliquée sur cet environnement.</p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="iro-detail-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Fiche IRO indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && detail && (
        <IroDetailContent detail={detail} onMessage={setMessage} runAction={runAction} />
      )}

      {message && (
        <p
          data-testid="iro-action-message"
          className="mt-4 rounded border border-[var(--color-border)] p-3 text-sm text-[var(--color-foreground)]"
        >
          {message}
        </p>
      )}
    </div>
  );
}

function IroDetailContent({
  detail,
  runAction,
}: {
  detail: IroDetail;
  onMessage: (m: string | null) => void;
  runAction: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { iro } = detail;
  const latestImpact = detail.impact_assessments[0] ?? null;
  const latestFinancial = detail.financial_assessments[0] ?? null;

  const downloadPack = async () => {
    try {
      const blob = await downloadIroEvidencePack(iro.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carbonco-iro-${iro.id}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Téléchargement impossible");
    }
  };

  return (
    <div data-testid="iro-detail-content">
      <header className="mb-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{iro.title}</h1>
          <FeatureStatusBadge status="beta" />
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${IRO_STATUS_TONE[iro.status]}`}
            data-testid="iro-status-badge"
          >
            {IRO_STATUS_LABEL[iro.status]}
          </span>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {IRO_TYPE_LABEL[iro.iro_type]}
          {iro.topic_code ? ` · Enjeu ${iro.topic_code}` : ""} · Origine{" "}
          {ORIGIN_DOMAIN_LABEL[iro.origin_domain] ?? iro.origin_domain}
          {iro.origin_reference ? ` (${iro.origin_reference})` : ""}
        </p>
        {iro.description && (
          <p className="mt-2 text-sm text-[var(--color-foreground)]">{iro.description}</p>
        )}
        <button
          type="button"
          onClick={downloadPack}
          className="mt-3 inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          data-testid="iro-evidence-pack-download"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Télécharger l&apos;Evidence Pack (ZIP signé)
        </button>
      </header>

      {/* ---- Les DEUX panneaux de matérialité, TOUJOURS côte à côte, jamais un score combiné ---- */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="iro-materiality-panels">
        <ImpactPanel iroId={iro.id} latest={latestImpact} runAction={runAction} />
        <FinancialPanel iroId={iro.id} latest={latestFinancial} runAction={runAction} />
      </section>

      <DecisionSection
        iroId={iro.id}
        decisions={detail.decisions}
        hasAnyAssessment={detail.impact_assessments.length > 0 || detail.financial_assessments.length > 0}
        runAction={runAction}
      />

      <ActionsSection iroId={iro.id} actions={detail.actions} runAction={runAction} />

      <DisclosureSection iroId={iro.id} mappings={detail.disclosure_mappings} runAction={runAction} />

      <EvidenceSection detail={detail} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau matérialité D'IMPACT
// ---------------------------------------------------------------------------

function ImpactPanel({
  iroId,
  latest,
  runAction,
}: {
  iroId: number;
  latest: ImpactAssessment | null;
  runAction: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [polarity, setPolarity] = useState<Polarity>("negative");
  const [isActual, setIsActual] = useState(false);
  const [scale, setScale] = useState("");
  const [scope, setScope] = useState("");
  const [irremediability, setIrremediability] = useState("");
  const [likelihood, setLikelihood] = useState("");
  const [confidence, setConfidence] = useState("");
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon | "">("");

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const submit = () =>
    runAction(
      () =>
        createImpactAssessment(iroId, {
          polarity,
          is_actual: isActual,
          scale: num(scale),
          scope: num(scope),
          irremediability: num(irremediability),
          likelihood: isActual ? null : num(likelihood),
          confidence: num(confidence),
          time_horizon: timeHorizon || null,
        }),
      "Évaluation d'impact enregistrée.",
    ).then(() => setOpen(false));

  return (
    <div className="rounded-2xl border border-[var(--color-border)] p-4" data-testid="iro-impact-panel">
      <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-foreground)]">
        Matérialité d&apos;impact
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Échelle, étendue, irrémédiabilité et probabilité — QUATRE composantes
        séparées. Jamais un score combiné.
      </p>

      {latest ? (
        <div className="space-y-2 text-sm">
          <ComponentRow label="Échelle" value={latest.scale} />
          <ComponentRow label="Étendue" value={latest.scope} />
          <ComponentRow label="Irrémédiabilité" value={latest.irremediability} />
          <ComponentRow label="Probabilité" value={latest.likelihood} note={latest.is_actual ? "avéré — s.o." : undefined} />
          <ComponentRow label="Confiance" value={latest.confidence} />
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs">
            <span className="text-[var(--color-muted-foreground)]">Lecture indicative (jamais une décision)</span>
            <span
              className={latest.threshold_crossed ? "font-medium text-amber-600 dark:text-amber-400" : "text-[var(--color-muted-foreground)]"}
              data-testid="iro-impact-threshold"
            >
              {latest.threshold_crossed ? "Seuil de sévérité franchi" : "Sous le seuil indicatif"}
            </span>
          </div>
          {latest.rationale && <p className="text-xs text-[var(--color-foreground)]">{latest.rationale}</p>}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="iro-impact-empty">
          Aucune évaluation d&apos;impact enregistrée.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          data-testid="iro-impact-new"
        >
          Nouvelle évaluation d&apos;impact
        </button>
      ) : (
        <form
          className="mt-3 space-y-2 rounded border border-[var(--color-border)] p-3 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          data-testid="iro-impact-form"
        >
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[var(--color-muted-foreground)]">Polarité</span>
              <select value={polarity} onChange={(e) => setPolarity(e.target.value as Polarity)} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1">
                <option value="negative">Négative</option>
                <option value="positive">Positive</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 self-end pb-1.5">
              <input type="checkbox" checked={isActual} onChange={(e) => setIsActual(e.target.checked)} />
              <span>Impact avéré (pas de probabilité)</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <NumberField label="Échelle (0-100)" value={scale} onChange={setScale} />
            <NumberField label="Étendue (0-100)" value={scope} onChange={setScope} />
            <NumberField label="Irrémédiabilité (0-100)" value={irremediability} onChange={setIrremediability} />
            {!isActual && <NumberField label="Probabilité (0-100)" value={likelihood} onChange={setLikelihood} />}
            <NumberField label="Confiance (0-100)" value={confidence} onChange={setConfidence} />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Horizon</span>
            <select value={timeHorizon} onChange={(e) => setTimeHorizon(e.target.value as TimeHorizon | "")} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1">
              <option value="">—</option>
              <option value="short">Court terme</option>
              <option value="medium">Moyen terme</option>
              <option value="long">Long terme</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-carbon-emerald px-3 py-1 font-medium text-white" data-testid="iro-impact-submit">
              Enregistrer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted-foreground)]">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panneau matérialité FINANCIÈRE
// ---------------------------------------------------------------------------

function FinancialPanel({
  iroId,
  latest,
  runAction,
}: {
  iroId: number;
  latest: FinancialAssessment | null;
  runAction: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [likelihood, setLikelihood] = useState("");
  const [magnitude, setMagnitude] = useState("");
  const [confidence, setConfidence] = useState("");
  const [mechanism, setMechanism] = useState("");
  const [channel, setChannel] = useState<FinancialChannel>("cost");
  const [rationale, setRationale] = useState("");

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const submit = () =>
    runAction(
      () =>
        createFinancialAssessment(iroId, {
          likelihood: num(likelihood),
          magnitude: num(magnitude),
          confidence: num(confidence),
          transmission_chain: [{ step: 1, mechanism, channel, rationale }],
        }),
      "Évaluation financière enregistrée.",
    ).then(() => setOpen(false));

  return (
    <div className="rounded-2xl border border-[var(--color-border)] p-4" data-testid="iro-financial-panel">
      <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-foreground)]">
        Matérialité financière
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Probabilité et ampleur — DEUX composantes séparées, jamais multipliées.
        Transmission documentée en chaîne d&apos;étapes, jamais un chiffre unique.
      </p>

      {latest ? (
        <div className="space-y-2 text-sm">
          <ComponentRow label="Probabilité" value={latest.likelihood} />
          <ComponentRow label="Ampleur financière" value={latest.magnitude} />
          <ComponentRow label="Confiance" value={latest.confidence} />
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Chaîne de transmission
            </p>
            <ol className="space-y-1" data-testid="iro-transmission-chain">
              {latest.transmission_chain.map((step) => (
                <li key={step.step} className="rounded border border-[var(--color-border)] p-2 text-xs">
                  <span className="font-medium text-[var(--color-foreground)]">
                    {step.step}. {FINANCIAL_CHANNEL_LABEL[step.channel]}
                  </span>{" "}
                  — {step.mechanism}
                  <p className="text-[var(--color-muted-foreground)]">{step.rationale}</p>
                  {step.estimated_amount_eur !== null && (
                    <p className="text-[var(--color-foreground)]">
                      ≈ {step.estimated_amount_eur.toLocaleString("fr-FR")} €
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs">
            <span className="text-[var(--color-muted-foreground)]">Lecture indicative (jamais une décision)</span>
            <span
              className={latest.threshold_crossed ? "font-medium text-amber-600 dark:text-amber-400" : "text-[var(--color-muted-foreground)]"}
              data-testid="iro-financial-threshold"
            >
              {latest.threshold_crossed ? "Seuil franchi" : "Sous le seuil indicatif"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="iro-financial-empty">
          Aucune évaluation financière enregistrée.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          data-testid="iro-financial-new"
        >
          Nouvelle évaluation financière
        </button>
      ) : (
        <form
          className="mt-3 space-y-2 rounded border border-[var(--color-border)] p-3 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          data-testid="iro-financial-form"
        >
          <div className="flex flex-wrap gap-2">
            <NumberField label="Probabilité (0-100)" value={likelihood} onChange={setLikelihood} />
            <NumberField label="Ampleur (0-100)" value={magnitude} onChange={setMagnitude} />
            <NumberField label="Confiance (0-100)" value={confidence} onChange={setConfidence} />
          </div>
          <p className="font-medium text-[var(--color-foreground)]">Première étape de transmission</p>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Mécanisme</span>
            <input value={mechanism} onChange={(e) => setMechanism(e.target.value)} required className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Canal</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as FinancialChannel)} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1">
              {(Object.keys(FINANCIAL_CHANNEL_LABEL) as FinancialChannel[]).map((c) => (
                <option key={c} value={c}>{FINANCIAL_CHANNEL_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Justification</span>
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} required className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1" rows={2} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-carbon-emerald px-3 py-1 font-medium text-white" data-testid="iro-financial-submit">
              Enregistrer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted-foreground)]">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ComponentRow({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="font-mono text-[var(--color-foreground)]">{note ?? formatComponent(value)}</span>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <input
        type="number" min={0} max={100} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Décision de matérialité — HUMAINE, append-only
// ---------------------------------------------------------------------------

function DecisionSection({
  iroId,
  decisions,
  hasAnyAssessment,
  runAction,
}: {
  iroId: number;
  decisions: MaterialityDecision[];
  hasAnyAssessment: boolean;
  runAction: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [isMaterial, setIsMaterial] = useState(true);
  const [basis, setBasis] = useState<DecisionBasis>("both");
  const [justification, setJustification] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;
    runAction(
      () => decideMateriality(iroId, { is_material: isMaterial, basis, justification: justification.trim() }),
      "Décision de matérialité enregistrée.",
    ).then(() => setJustification(""));
  };

  return (
    <section className="mb-8 rounded-2xl border border-[var(--color-border)] p-4" data-testid="iro-decision-section">
      <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-foreground)]">
        Décision de matérialité
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Une personne identifiée décide, motive sa décision et indique quelle
        dimension a pesé. Jamais un score qui franchit un seuil
        automatiquement. Réservé aux administrateurs. Une redécision crée une
        nouvelle ligne — l&apos;historique reste entièrement visible.
      </p>

      {!hasAnyAssessment && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400" data-testid="iro-decision-gate-warning">
          Aucune évaluation (impact ou financière) n&apos;a encore été
          enregistrée — la décision sera refusée par l&apos;API tant qu&apos;au
          moins une évaluation n&apos;existe pas.
        </p>
      )}

      <form onSubmit={submit} className="mb-4 space-y-2 text-xs" data-testid="iro-decision-form">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={isMaterial} onChange={() => setIsMaterial(true)} />
            Matériel
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!isMaterial} onChange={() => setIsMaterial(false)} />
            Non matériel
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Fondement</span>
            <select value={basis} onChange={(e) => setBasis(e.target.value as DecisionBasis)} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1">
              <option value="impact">Impact</option>
              <option value="financial">Financier</option>
              <option value="both">Les deux</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[var(--color-muted-foreground)]">Justification (obligatoire)</span>
          <textarea
            value={justification} onChange={(e) => setJustification(e.target.value)} required rows={2}
            className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1"
            data-testid="iro-decision-justification"
          />
        </label>
        <button type="submit" className="rounded bg-carbon-emerald px-3 py-1.5 font-medium text-white" data-testid="iro-decision-submit">
          Enregistrer la décision
        </button>
      </form>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        Historique (append-only, {decisions.length})
      </h3>
      {decisions.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]" data-testid="iro-decisions-empty">
          Aucune décision enregistrée.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="iro-decisions-history">
          {decisions.map((d) => (
            <li key={d.id} className="rounded border border-[var(--color-border)] p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`font-semibold ${d.is_material ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-muted-foreground)]"}`}>
                  {d.is_material ? "Matériel" : "Non matériel"}
                </span>
                <span className="text-[var(--color-muted-foreground)]">fondement : {d.basis}</span>
                <span className="text-[var(--color-muted-foreground)]">
                  {new Date(d.decided_at).toLocaleString("fr-FR")}
                </span>
                {d.supersedes_id && (
                  <span className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                    remplace décision #{d.supersedes_id}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[var(--color-foreground)]">{d.justification}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const ACTION_TYPES: IroActionType[] = ["mitigation", "adaptation", "enhancement", "monitoring", "engagement", "other"];

function ActionsSection({
  iroId,
  actions,
  runAction,
}: {
  iroId: number;
  actions: IroAction[];
  runAction: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState<IroActionType>("mitigation");

  const submit = () =>
    runAction(() => createIroAction(iroId, { title, action_type: actionType }), "Action enregistrée.").then(() => {
      setTitle("");
      setOpen(false);
    });

  return (
    <section className="mb-8 rounded-2xl border border-[var(--color-border)] p-4" data-testid="iro-actions-section">
      <h2 className="mb-3 font-display text-lg font-bold text-[var(--color-foreground)]">Actions</h2>
      {actions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="iro-actions-empty">
          Aucune action enregistrée.
        </p>
      ) : (
        <ul className="mb-3 space-y-1 text-sm" data-testid="iro-actions-list">
          {actions.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded border border-[var(--color-border)] p-2">
              <span className="text-[var(--color-foreground)]">{a.title}</span>
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {a.action_type} · {a.status}
                {a.expected_risk_reduction_pct !== null ? ` · intention ${a.expected_risk_reduction_pct}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)]" data-testid="iro-action-new">
          Nouvelle action
        </button>
      ) : (
        <div className="flex flex-wrap items-end gap-2 text-xs" data-testid="iro-action-form">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Titre</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Type</span>
            <select value={actionType} onChange={(e) => setActionType(e.target.value as IroActionType)} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1">
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={submit} disabled={!title.trim()} className="rounded bg-carbon-emerald px-3 py-1 font-medium text-white disabled:opacity-50" data-testid="iro-action-submit">
            Créer
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted-foreground)]">
            Annuler
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Disclosure mappings
// ---------------------------------------------------------------------------

function DisclosureSection({
  iroId,
  mappings,
  runAction,
}: {
  iroId: number;
  mappings: DisclosureMapping[];
  runAction: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [esrsRef, setEsrsRef] = useState("");
  const [status, setStatus] = useState<DisclosureStatus>("draft");

  const submit = () =>
    runAction(
      () => createDisclosureMapping(iroId, { esrs_reference: esrsRef || null, status }),
      "Correspondance de disclosure enregistrée.",
    ).then(() => {
      setEsrsRef("");
      setOpen(false);
    });

  return (
    <section className="mb-8 rounded-2xl border border-[var(--color-border)] p-4" data-testid="iro-disclosure-section">
      <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-foreground)]">
        Correspondances de disclosure
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Table de correspondance — aucune publication automatique.
      </p>
      {mappings.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="iro-disclosure-empty">
          Aucune correspondance enregistrée.
        </p>
      ) : (
        <ul className="mb-3 space-y-1 text-sm" data-testid="iro-disclosure-list">
          {mappings.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded border border-[var(--color-border)] p-2">
              <span className="font-mono text-xs text-[var(--color-foreground)]">{m.esrs_reference ?? "—"}</span>
              <span className="text-xs text-[var(--color-muted-foreground)]">{m.status}</span>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-foreground)]" data-testid="iro-disclosure-new">
          Nouvelle correspondance
        </button>
      ) : (
        <div className="flex flex-wrap items-end gap-2 text-xs" data-testid="iro-disclosure-form">
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Référence (VSME ou ESRS libre)</span>
            <input value={esrsRef} onChange={(e) => setEsrsRef(e.target.value)} placeholder="ex. C1-3 ou ESRS E1-6" className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[var(--color-muted-foreground)]">Statut</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as DisclosureStatus)} className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1">
              <option value="draft">Brouillon</option>
              <option value="mapped">Correspondance établie</option>
              <option value="disclosed">Publié</option>
            </select>
          </label>
          <button type="button" onClick={submit} className="rounded bg-carbon-emerald px-3 py-1 font-medium text-white" data-testid="iro-disclosure-submit">
            Créer
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-[var(--color-muted-foreground)]">
            Annuler
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Preuves complémentaires (claim_link_service, réutilisé tel quel)
// ---------------------------------------------------------------------------

function EvidenceSection({ detail }: { detail: IroDetail }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] p-4" data-testid="iro-evidence-section">
      <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-foreground)]">
        Preuves complémentaires
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Liens vers des pièces (Evidence Kernel) — réutilise le noyau de preuve
        commun, aucune table dédiée à ce module.
      </p>
      {detail.evidence_links.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="iro-evidence-empty">
          Aucune preuve complémentaire liée.
        </p>
      ) : (
        <ul className="space-y-1 text-sm" data-testid="iro-evidence-list">
          {detail.evidence_links.map((link) => (
            <li key={link.id} className="rounded border border-[var(--color-border)] p-2 text-xs">
              <span className="font-medium text-[var(--color-foreground)]">{link.relation_type}</span>{" "}
              — artefact #{link.evidence_artifact_id}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
