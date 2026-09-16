"use client";

/**
 * /beges — Bilan GES réglementaire France (BEGES v5, T4.2 + T7.2). Éligibilité,
 * ventilation 6 catégories / 22 postes (total BEGES = total GHG), export ZIP
 * (PDF + Excel auditable), checklist de dépôt ADEME, suivi des dépôts déclarés
 * et échéance de renouvellement (+4 ans, rappels in-app J-180 / J-30 / échéance).
 *
 * Éligibilité : statut, libellé, base légale et notes proviennent de l'API
 * (normalisés par lib/beges-eligibility). Un statut « indetermine » (effectif
 * non renseigné) n'est jamais présenté comme une démarche volontaire.
 */

import { useCallback, useEffect, useState } from "react";

import {
  deleteBegesFiling,
  downloadBegesReport,
  fetchBegesFilings,
  fetchBegesStatus,
  friendlyApiErrorMessage,
  recordBegesFiling,
  type BegesEligibility,
  type BegesEligibilityStatus,
  type BegesFilingsResponse,
  type BegesStatus,
} from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

function fmtDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
}

const ELIG_TONE: Record<BegesEligibilityStatus, string> = {
  obligatoire: "bg-amber-50 border-amber-200 text-amber-800",
  obligatoire_outre_mer: "bg-amber-50 border-amber-200 text-amber-800",
  sous_seuil: "bg-emerald-50 border-emerald-200 text-emerald-700",
  indetermine: "bg-neutral-50 border-neutral-200 text-neutral-700",
};

const ELIG_STATUS_LABEL: Record<BegesEligibilityStatus, string> = {
  obligatoire: "Obligatoire",
  obligatoire_outre_mer: "Obligatoire (outre-mer)",
  sous_seuil: "Sous les seuils",
  indetermine: "Indéterminée",
};

function EligibilityCard({ eligibility }: { eligibility: BegesEligibility }) {
  return (
    <div
      className={`rounded-2xl border p-4 mb-8 text-sm ${ELIG_TONE[eligibility.status]}`}
      data-testid="beges-eligibility"
      data-status={eligibility.status}
    >
      <p>
        <strong>Éligibilité : {ELIG_STATUS_LABEL[eligibility.status]}</strong>
        {" — "}
        {eligibility.label}
      </p>
      {(eligibility.periodicityYears !== null || eligibility.legalBasis) && (
        <p className="mt-1 text-xs opacity-80">
          {eligibility.periodicityYears !== null &&
            `Périodicité : tous les ${eligibility.periodicityYears} ans`}
          {eligibility.periodicityYears !== null && eligibility.legalBasis && " · "}
          {eligibility.legalBasis && `Base légale : ${eligibility.legalBasis}`}
        </p>
      )}
      {eligibility.status === "indetermine" && (
        <p className="mt-2 text-xs">
          L&apos;effectif de votre organisation n&apos;est pas connu : renseignez-le pour déterminer si
          le bilan est obligatoire.
        </p>
      )}
      {eligibility.notes.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs list-disc list-inside opacity-90">
          {eligibility.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SCHEDULE_TONE: Record<string, string> = {
  aucun_bilan: "bg-neutral-50 border-neutral-200 text-neutral-600",
  a_jour: "bg-emerald-50 border-emerald-200 text-emerald-700",
  echeance_proche: "bg-amber-50 border-amber-200 text-amber-800",
  en_retard: "bg-red-50 border-red-200 text-red-700",
};

function FilingsSection() {
  const [data, setData] = useState<BegesFilingsResponse | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [filedAt, setFiledAt] = useState("");
  const [ademeRef, setAdemeRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetchBegesFilings()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const submit = async () => {
    const y = Number(year);
    if (!filedAt || !Number.isInteger(y) || y < 2000 || y > 2100) {
      setFormError("Renseignez une année de référence valide et la date de dépôt.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await recordBegesFiling({
        exercise_year: y,
        filed_at: filedAt,
        ademe_ref: ademeRef.trim() || null,
      });
      setAdemeRef("");
      setFiledAt("");
      reload();
    } catch (err) {
      setFormError(
        friendlyApiErrorMessage(
          err,
          { 403: "La déclaration d'un dépôt est réservée aux rôles analyste et administrateur." },
          "Enregistrement impossible — réessayez.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 p-5 mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">
        Suivi des dépôts &amp; échéance de renouvellement
      </h2>

      <div className={`rounded-xl border p-4 mb-4 text-sm ${SCHEDULE_TONE[data.status] ?? SCHEDULE_TONE.aucun_bilan}`}>
        <strong>
          {data.status === "en_retard"
            ? "Échéance dépassée : "
            : data.status === "echeance_proche"
              ? "Échéance proche : "
              : data.status === "a_jour"
                ? "À jour : "
                : ""}
        </strong>
        {data.label}
        {data.status !== "aucun_bilan" && (
          <span className="block mt-1 text-xs opacity-80">
            Rappels automatiques dans le centre de notifications à J-180, J-30 et à l&apos;échéance.
          </span>
        )}
      </div>

      {data.filings.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {data.filings.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between text-sm border-b border-neutral-100 pb-1.5"
            >
              <span>
                <span className="font-semibold text-neutral-800">Exercice {f.exercise_year}</span>
                <span className="text-neutral-500">
                  {" "}— déposé le {fmtDate(f.filed_at)}
                  {f.ademe_ref ? ` · réf. ADEME ${f.ademe_ref}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 tabular-nums">
                  prochain : {fmtDate(f.next_due_at)}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await deleteBegesFiling(f.id);
                      reload();
                    } catch {
                      /* suppression réservée aux admins — silencieux */
                    }
                  }}
                  className="text-xs text-neutral-300 hover:text-red-500"
                  title="Supprimer (admin)"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-500">
          Année de référence
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min={2000}
            max={2100}
            className="block mt-1 w-28 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Date de dépôt ADEME
          <input
            type="date"
            value={filedAt}
            onChange={(e) => setFiledAt(e.target.value)}
            className="block mt-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
          />
        </label>
        <label className="text-xs text-neutral-500">
          Référence de dépôt (optionnel)
          <input
            type="text"
            value={ademeRef}
            onChange={(e) => setAdemeRef(e.target.value)}
            placeholder="ex. n° de dossier"
            className="block mt-1 w-44 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
          />
        </label>
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Déclarer ce dépôt"}
        </button>
      </div>
      {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
      <p className="mt-3 text-xs text-neutral-400">
        Le dépôt s&apos;effectue manuellement sur bilans-ges.ademe.fr (pas d&apos;API publique de
        dépôt) — déclarez-le ici pour activer le calcul d&apos;échéance (+4 ans) et les rappels.
      </p>
    </div>
  );
}

export default function BegesPage() {
  const [data, setData] = useState<BegesStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchBegesStatus(ctrl.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(friendlyApiErrorMessage(err, {}, "Réessayez dans quelques instants."));
      });
    return () => ctrl.abort();
  }, []);

  if (error) {
    return (
      <div role="alert" className="p-8 text-sm text-red-600">
        Impossible de charger le bilan BEGES. {error}
      </div>
    );
  }
  if (!data) return <div className="p-8 text-sm text-neutral-400">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Bilan GES réglementaire (BEGES v5)</h1>
          <p className="text-sm text-neutral-500">
            {data.breakdown.standard} · Total {fmt(data.breakdown.total)} tCO2e
          </p>
        </div>
        <div className="shrink-0 text-right">
          <button
            onClick={async () => {
              setBusy(true);
              setExportError(null);
              try {
                await downloadBegesReport();
              } catch (err) {
                setExportError(
                  friendlyApiErrorMessage(
                    err,
                    { 403: "L'export est réservé aux rôles analyste et administrateur." },
                    "Export impossible pour le moment. Réessayez.",
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-40"
          >
            {busy ? "Génération…" : "Exporter (PDF + Excel)"}
          </button>
          {exportError && (
            <p role="alert" className="mt-2 max-w-xs text-xs text-red-600">
              {exportError}
            </p>
          )}
        </div>
      </div>

      <EligibilityCard eligibility={data.eligibility} />

      <FilingsSection />

      <div className="space-y-4 mb-8">
        {data.breakdown.categories.map((cat) => (
          <div key={cat.code} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-neutral-800">
                Catégorie {cat.code} — {cat.label}
              </span>
              <span className="text-sm tabular-nums font-semibold">{fmt(cat.total)} tCO2e</span>
            </div>
            <div className="space-y-0.5">
              {cat.postes.map((p) => (
                <div key={p.code} className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    <span className="font-mono text-neutral-400 mr-2">{p.code}</span>
                    {p.label}
                  </span>
                  <span className="tabular-nums">{fmt(p.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">Dépôt sur bilans-ges.ademe.fr</h2>
        <ol className="text-sm text-neutral-600 space-y-1.5 list-decimal list-inside">
          <li>Créez ou connectez-vous à votre compte sur bilans-ges.ademe.fr.</li>
          <li>Renseignez le périmètre organisationnel et l'année de reporting.</li>
          <li>Reportez les 6 catégories / 22 postes de l'export Excel ci-dessus.</li>
          <li>Joignez la note méthodologique (incluse dans le PDF exporté).</li>
          <li>Soumettez le bilan pour publication.</li>
        </ol>
        <a
          href="https://bilans-ges.ademe.fr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs underline text-neutral-500 hover:text-black"
        >
          bilans-ges.ademe.fr →
        </a>
      </div>
    </div>
  );
}
