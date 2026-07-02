"use client";

/**
 * /fournisseurs/campagnes — Campagnes de collecte Scope 3 (T7.3).
 *
 * Workflow côté client : création de campagne (nom, exercice, deadline),
 * import CSV de fournisseurs, invitations tokenisées en masse, suivi des
 * réponses (pending / viewed / completed), relances automatiques (cron
 * quotidien J-14 / J-7 / deadline), et revue OBLIGATOIRE des réponses reçues
 * avant intégration à l'estimation GES fournisseur (pattern gate FEC/imports).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  closeSupplierCampaign,
  createSupplierCampaign,
  fetchCampaignDetail,
  fetchPendingSupplierAnswers,
  fetchSupplierCampaigns,
  importSuppliersCsv,
  inviteCampaignSuppliers,
  reviewSupplierAnswer,
  type SupplierCampaign,
  type SupplierCampaignInvite,
  type SupplierPendingAnswer,
} from "@/lib/api";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";
}

const INVITE_TONE: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-500",
  viewed: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
};

const INVITE_LABEL: Record<string, string> = {
  pending: "En attente",
  viewed: "Consulté",
  completed: "Répondu",
};

function CampaignCard({
  campaign,
  onChanged,
}: {
  campaign: SupplierCampaign;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<SupplierCampaignInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const loadDetail = useCallback(() => {
    fetchCampaignDetail(campaign.id)
      .then((d) => setInvites(d.invites))
      .catch(() => setInvites([]));
  }, [campaign.id]);

  useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  const { stats } = campaign;
  const pct = stats.invited > 0 ? Math.round(stats.response_rate * 100) : 0;

  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setOpen(!open)} className="text-left group">
          <span className="font-bold text-neutral-800 group-hover:text-black">
            {campaign.name}
          </span>
          <span className="ml-2 text-xs text-neutral-400">
            {campaign.exercise_year ? `Exercice ${campaign.exercise_year} · ` : ""}
            {campaign.deadline ? `deadline ${fmtDate(campaign.deadline)}` : "sans deadline"}
            {campaign.status === "closed" ? " · clôturée" : ""}
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-neutral-600">
            {stats.completed}/{stats.invited} réponses ({pct} %)
          </span>
          <div className="w-28 h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          {campaign.status === "active" && (
            <>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await inviteCampaignSuppliers(campaign.id, { all_active: true });
                    onChanged();
                    if (open) loadDetail();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 hover:border-black transition-colors disabled:opacity-40"
                title="Génère un lien pour chaque fournisseur actif pas encore invité"
              >
                Inviter tous les actifs
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await closeSupplierCampaign(campaign.id);
                    onChanged();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-500 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                Clôturer
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-neutral-100 pt-3 space-y-1.5">
          {invites.length === 0 && (
            <p className="text-xs text-neutral-400">
              Aucune invitation — utilisez « Inviter tous les actifs » ou l&apos;envoi individuel
              depuis la liste fournisseurs.
            </p>
          )}
          {invites.map((inv) => (
            <div key={inv.token_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-neutral-800">{inv.supplier_name}</span>
                {inv.contact_email && (
                  <span className="ml-2 text-xs text-neutral-400">{inv.contact_email}</span>
                )}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full ${INVITE_TONE[inv.status]}`}>
                  {INVITE_LABEL[inv.status]}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inv.url);
                      setCopied(inv.token_id);
                      setTimeout(() => setCopied(null), 1500);
                    } catch {
                      /* clipboard indisponible */
                    }
                  }}
                  className="text-xs text-neutral-400 hover:text-black"
                >
                  {copied === inv.token_id ? "Copié ✓" : "Copier le lien"}
                </button>
              </span>
            </div>
          ))}
          <p className="text-xs text-neutral-400 pt-2">
            Relances automatiques : notification in-app à J-14, J-7 et à la deadline — e-mail
            direct aux fournisseurs sans réponse si l&apos;envoi d&apos;e-mails est activé
            (EMAIL_ENABLED).
          </p>
        </div>
      )}
    </div>
  );
}

function PendingAnswersSection() {
  const [answers, setAnswers] = useState<SupplierPendingAnswer[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const reload = useCallback(() => {
    fetchPendingSupplierAnswers()
      .then(setAnswers)
      .catch(() => setAnswers([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (answers.length === 0) return null;

  const act = async (id: number, action: "accept" | "flag") => {
    setBusy(id);
    try {
      await reviewSupplierAnswer(id, { action, apply_to_supplier: action === "accept" });
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-700 mb-1">
        Réponses à valider ({answers.length})
      </h2>
      <p className="text-xs text-neutral-500 mb-4">
        Rien n&apos;alimente votre Scope 3 sans validation : accepter met à jour l&apos;estimation
        GES du fournisseur, signaler la conserve pour correction.
      </p>
      <div className="space-y-3">
        {answers.map((a) => (
          <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-neutral-800">
                  {a.supplier_name}
                  <span className="ml-2 text-xs font-normal text-neutral-400">
                    reçue le {fmtDate(a.submitted_at)}
                    {a.reporting_year ? ` · année ${a.reporting_year}` : ""}
                    {a.methodology ? ` · ${a.methodology}` : ""}
                  </span>
                </p>
                <p className="text-sm text-neutral-600 mt-1 tabular-nums">
                  Total : {a.ghg_total_tco2e ?? "—"} tCO2e
                  {" · "}S1 : {a.ghg_scope1 ?? "—"} · S2 : {a.ghg_scope2 ?? "—"} · S3 :{" "}
                  {a.ghg_scope3 ?? "—"}
                </p>
                {a.anomalies.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {a.anomalies.map((an) => (
                      <li key={an} className="text-xs text-amber-700">
                        ⚠ {an}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={busy === a.id}
                  onClick={() => act(a.id, "accept")}
                  className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40"
                >
                  Accepter
                </button>
                <button
                  disabled={busy === a.id}
                  onClick={() => act(a.id, "flag")}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-600 hover:border-amber-400 hover:text-amber-700 transition-colors disabled:opacity-40"
                >
                  Signaler
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CampagnesPage() {
  const [campaigns, setCampaigns] = useState<SupplierCampaign[] | null>(null);
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  const reload = useCallback(() => {
    fetchSupplierCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createSupplierCampaign({
        name: name.trim(),
        exercise_year: Number(year) || null,
        deadline: deadline || null,
      });
      setName("");
      setDeadline("");
      reload();
    } finally {
      setCreating(false);
    }
  };

  const runCsvImport = async () => {
    if (!csvText.trim()) return;
    setCsvBusy(true);
    setCsvResult(null);
    try {
      const res = await importSuppliersCsv(csvText);
      if (res) {
        const issues = res.issues.length ? ` — ${res.issues.length} anomalie(s) : ${res.issues.slice(0, 3).join(" ")}` : "";
        setCsvResult(`${res.created} fournisseur(s) créé(s), ${res.skipped} doublon(s) ignoré(s)${issues}`);
        setCsvText("");
      }
    } catch {
      setCsvResult("Import impossible — vérifiez le format (colonne « nom » obligatoire).");
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Campagnes de collecte</h1>
          <p className="text-sm text-neutral-500">
            Invitations fournisseurs par lien sécurisé, suivi des réponses, relances et revue
            avant intégration.{" "}
            <Link href="/fournisseurs" className="underline hover:text-black">
              ← Liste des fournisseurs
            </Link>
          </p>
        </div>
        <button
          onClick={() => setCsvOpen(!csvOpen)}
          className="shrink-0 px-4 py-2 rounded-full border border-neutral-200 text-sm font-semibold hover:border-black transition-colors"
        >
          Importer des fournisseurs (CSV)
        </button>
      </div>

      {csvOpen && (
        <div className="rounded-2xl border border-neutral-200 p-5 mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-2">
            Import CSV
          </h2>
          <p className="text-xs text-neutral-400 mb-3">
            Colonnes reconnues : <code>nom</code> (obligatoire), <code>email</code>,{" "}
            <code>contact</code>, <code>pays</code>, <code>secteur</code>, <code>catégorie</code>,{" "}
            <code>dépenses</code>, <code>ges</code>. Séparateur virgule ou point-virgule. Les
            doublons (même nom) sont ignorés.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={"nom,email,catégorie\nAciers Réunis,contact@aciers.fr,C1 Biens achetés"}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-mono text-neutral-800"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={runCsvImport}
              disabled={csvBusy || !csvText.trim()}
              className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-40"
            >
              {csvBusy ? "Import…" : "Importer"}
            </button>
            {csvResult && <p className="text-xs text-neutral-500">{csvResult}</p>}
          </div>
        </div>
      )}

      <PendingAnswersSection />

      <div className="rounded-2xl border border-neutral-200 p-5 mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">
          Nouvelle campagne
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-neutral-500 grow">
            Nom
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Collecte fournisseurs 2026"
              className="block mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Exercice
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2000}
              max={2100}
              className="block mt-1 w-24 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
            />
          </label>
          <label className="text-xs text-neutral-500">
            Deadline
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="block mt-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
            />
          </label>
          <button
            onClick={create}
            disabled={creating || !name.trim()}
            className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold hover:scale-105 transition-transform disabled:opacity-40"
          >
            {creating ? "Création…" : "Créer la campagne"}
          </button>
        </div>
      </div>

      {campaigns === null ? (
        <p className="text-sm text-neutral-400">Chargement…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Aucune campagne pour le moment — créez la première ci-dessus.
        </p>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
