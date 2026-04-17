"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Factory,
  Globe,
  Leaf,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  type Scope3Summary,
  type Supplier,
  type SupplierCreate,
  type SupplierToken,
  createSupplier,
  createSupplierToken,
  deleteSupplier,
  fetchScope3Summary,
  fetchSuppliers,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtGhg(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)} ktCO₂e`;
  return `${v.toFixed(0)} tCO₂e`;
}

function fmtEur(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M€`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)} k€`;
  return `${v.toFixed(0)} €`;
}

function copyToClipboard(text: string, onDone?: () => void) {
  navigator.clipboard.writeText(text).then(() => onDone?.());
}

// ---------------------------------------------------------------------------
// Add Supplier Modal
// ---------------------------------------------------------------------------

const SCOPE3_CATEGORIES = [
  "C1 Biens achetés",
  "C2 Biens d'équipement",
  "C3 Activités liées énergie",
  "C4 Transport amont",
  "C5 Déchets exploitation",
  "C6 Déplacements professionnels",
  "C7 Mobilité domicile-travail",
  "C8 Actifs en leasing amont",
  "C9 Transport aval",
  "C10 Traitement produits vendus",
  "C11 Utilisation produits vendus",
  "C12 Fin de vie produits vendus",
  "C13 Actifs en leasing aval",
  "C14 Franchises",
  "C15 Investissements",
];

interface AddSupplierModalProps {
  onClose: () => void;
  onCreated: (s: Supplier) => void;
}

function AddSupplierModal({ onClose, onCreated }: AddSupplierModalProps) {
  const [form, setForm] = useState<SupplierCreate>({ name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof SupplierCreate, v: string | number | undefined) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supplier = await createSupplier(form);
      onCreated(supplier);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-foreground)]">
            Ajouter un fournisseur
          </h2>
          <button type="button" onClick={onClose} className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
              Raison sociale *
            </label>
            <input
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex : Acier Durable SAS"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Email contact</label>
              <input
                type="email"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={form.contact_email ?? ""}
                onChange={(e) => set("contact_email", e.target.value || undefined)}
                placeholder="contact@fournisseur.fr"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Pays</label>
              <input
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={form.country ?? ""}
                onChange={(e) => set("country", e.target.value || undefined)}
                placeholder="France"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Dépenses annuelles (€)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={form.spend_eur ?? ""}
                onChange={(e) => set("spend_eur", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="1 500 000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">GES estimé (tCO₂e)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={form.ghg_estimate_tco2e ?? ""}
                onChange={(e) => set("ghg_estimate_tco2e", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Catégorie Scope 3</label>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
              value={form.scope3_category ?? ""}
              onChange={(e) => set("scope3_category", e.target.value || undefined)}
            >
              <option value="">Choisir une catégorie</option>
              {SCOPE3_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-[var(--color-danger)]">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-carbon-emerald text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send Questionnaire Modal
// ---------------------------------------------------------------------------

interface SendQuestionnaireModalProps {
  supplier: Supplier;
  onClose: () => void;
}

function SendQuestionnaireModal({ supplier, onClose }: SendQuestionnaireModalProps) {
  const [campaign, setCampaign] = useState(`Campagne ${new Date().getFullYear()}`);
  const [days, setDays] = useState(30);
  const [token, setToken] = useState<SupplierToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const tok = await createSupplierToken(supplier.id, { campaign, expires_days: days });
      setToken(tok);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!token) return;
    copyToClipboard(token.url, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-foreground)]">
            Envoyer un questionnaire
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-[var(--color-foreground-muted)]" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-foreground-muted)] mb-0.5">Fournisseur</p>
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{supplier.name}</p>
          {supplier.contact_email && (
            <p className="text-xs text-carbon-emerald">{supplier.contact_email}</p>
          )}
        </div>

        {!token ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                Nom de la campagne
              </label>
              <input
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
                Validité (jours)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-carbon-emerald text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Générer le lien
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[var(--color-success-bg)] border border-[var(--color-success)]">
              <p className="text-xs font-semibold text-[var(--color-success)] mb-2">
                ✓ Lien généré — à envoyer par email au fournisseur
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={token.url}
                  className="flex-1 text-xs bg-transparent text-[var(--color-foreground)] font-mono truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors"
                >
                  <Link2 className="w-3 h-3" />
                  {copied ? "Copié !" : "Copier"}
                </button>
              </div>
            </div>
            <p className="text-xs text-[var(--color-foreground-muted)]">
              Expire dans {days} jours. Le fournisseur pourra remplir le questionnaire sans avoir besoin d&apos;un compte.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<Scope3Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sendTo, setSendTo] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sup, sum] = await Promise.all([fetchSuppliers(), fetchScope3Summary()]);
      setSuppliers(sup);
      setSummary(sum);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("Supprimer ce fournisseur ?")) return;
    setDeleting(id);
    try {
      await deleteSupplier(id);
      setSuppliers((p) => p.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const top20 = [...suppliers]
    .sort((a, b) => (b.ghg_estimate_tco2e ?? 0) - (a.ghg_estimate_tco2e ?? 0))
    .slice(0, 20);

  const totalGhg = suppliers.reduce((acc, s) => acc + (s.ghg_estimate_tco2e ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Modals */}
      {showAdd && (
        <AddSupplierModal
          onClose={() => setShowAdd(false)}
          onCreated={(s) => {
            setSuppliers((p) => [...p, s]);
            setSummary(null); // refresh summary
          }}
        />
      )}
      {sendTo && (
        <SendQuestionnaireModal
          supplier={sendTo}
          onClose={() => setSendTo(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
            Fournisseurs
          </h1>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Scope 3 — Collecte de données et questionnaires ESG fournisseurs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            data-testid="add-supplier-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* KPI summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Factory className="w-4 h-4 text-carbon-emerald" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">Fournisseurs</span>
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
              {summary.total_suppliers}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="w-4 h-4 text-emerald-500" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">GES total estimé</span>
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
              {fmtGhg(summary.total_ghg_tco2e)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">Avec données GES</span>
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
              {summary.suppliers_with_ghg}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)] mb-2">
              Couverture
            </div>
            <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
              {summary.total_suppliers > 0
                ? `${Math.round((summary.suppliers_with_ghg / summary.total_suppliers) * 100)}%`
                : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !suppliers.length && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
        </div>
      )}

      {/* Top 20 table */}
      {top20.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
              Top 20 fournisseurs — contribution Scope 3
            </h2>
            <span className="text-xs text-[var(--color-foreground-muted)]">
              {fmtGhg(totalGhg)} total
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border)]" data-testid="suppliers-list">
            {top20.map((s, idx) => {
              const pct = totalGhg > 0 && s.ghg_estimate_tco2e
                ? (s.ghg_estimate_tco2e / totalGhg) * 100
                : 0;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-bg)] transition-colors group"
                >
                  {/* Rank */}
                  <span className="w-6 text-xs font-mono text-[var(--color-foreground-muted)] flex-shrink-0">
                    {idx + 1}
                  </span>

                  {/* Name + info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                      {s.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {s.country && (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--color-foreground-muted)]">
                          <MapPin className="w-2.5 h-2.5" />{s.country}
                        </span>
                      )}
                      {s.scope3_category && (
                        <span className="text-[10px] text-[var(--color-foreground-muted)]">
                          {s.scope3_category}
                        </span>
                      )}
                      {s.contact_email && (
                        <span className="flex items-center gap-1 text-[10px] text-carbon-emerald">
                          <Mail className="w-2.5 h-2.5" />{s.contact_email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* GHG bar */}
                  <div className="hidden md:flex flex-col items-end gap-1 w-28 flex-shrink-0">
                    <span className="text-xs font-mono font-semibold text-[var(--color-foreground)]">
                      {fmtGhg(s.ghg_estimate_tco2e)}
                    </span>
                    <div className="w-full h-1.5 rounded-full bg-[var(--color-border)]">
                      <div
                        className="h-full rounded-full bg-carbon-emerald"
                        style={{ width: `${Math.min(pct * 3, 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[var(--color-foreground-muted)]">
                      {pct.toFixed(1)}% du total
                    </span>
                  </div>

                  {/* Spend */}
                  <div className="hidden lg:block w-20 text-right text-xs text-[var(--color-foreground-muted)] flex-shrink-0">
                    {fmtEur(s.spend_eur)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSendTo(s)}
                      title="Envoyer questionnaire"
                      className="p-1.5 rounded-lg text-carbon-emerald hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      title="Supprimer"
                      className="p-1.5 rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                    >
                      {deleting === s.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && suppliers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <Globe className="w-10 h-10 mx-auto text-[var(--color-foreground-muted)] mb-3" />
          <h3 className="font-display text-base font-bold text-[var(--color-foreground)] mb-1">
            Aucun fournisseur
          </h3>
          <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
            Ajoutez vos fournisseurs pour calculer et piloter vos émissions Scope 3.
          </p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4" />
            Ajouter le premier fournisseur
          </button>
        </div>
      )}
    </div>
  );
}
