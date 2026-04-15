"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Recycle,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  fetchProducts,
  createProduct,
  patchProduct,
  deleteProduct,
  type ProductOut,
  type ProductCreate,
  type EsprStatus,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ESPR_LABELS: Record<EsprStatus, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-[var(--color-border)] text-[var(--color-foreground-muted)]" },
  eligible: { label: "Éligible", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" },
  compliant: { label: "Conforme", color: "bg-[var(--color-success-bg)] text-[var(--color-success)]" },
  non_compliant: { label: "Non conforme", color: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]" },
};

const SECTORS = [
  "Textiles & vêtements",
  "Batteries & accumulateurs",
  "Électronique & informatique",
  "Meubles & ameublement",
  "Acier & aluminium",
  "Produits chimiques",
  "Plastiques",
  "Construction & BTP",
  "Autre",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function EsprBadge({ status }: { status: EsprStatus }) {
  const cfg = ESPR_LABELS[status] ?? ESPR_LABELS.pending;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit form
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  sku: string;
  sector: string;
  pcf_kgco2e: string;
  recyclability_pct: string;
  lifespan_years: string;
  espr_status: EsprStatus;
}

const EMPTY_FORM: FormState = {
  name: "",
  sku: "",
  sector: "",
  pcf_kgco2e: "",
  recyclability_pct: "",
  lifespan_years: "",
  espr_status: "pending",
};

function productToForm(p: ProductOut): FormState {
  return {
    name: p.name,
    sku: p.sku ?? "",
    sector: p.sector ?? "",
    pcf_kgco2e: p.pcf_kgco2e !== null ? String(p.pcf_kgco2e) : "",
    recyclability_pct: p.recyclability_pct !== null ? String(p.recyclability_pct) : "",
    lifespan_years: p.lifespan_years !== null ? String(p.lifespan_years) : "",
    espr_status: p.espr_status,
  };
}

function formToPayload(f: FormState): ProductCreate {
  return {
    name: f.name.trim(),
    sku: f.sku.trim() || undefined,
    sector: f.sector.trim() || undefined,
    pcf_kgco2e: f.pcf_kgco2e !== "" ? parseFloat(f.pcf_kgco2e) : undefined,
    recyclability_pct: f.recyclability_pct !== "" ? parseFloat(f.recyclability_pct) : undefined,
    lifespan_years: f.lifespan_years !== "" ? parseFloat(f.lifespan_years) : undefined,
    espr_status: f.espr_status,
  };
}

function ProductForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: FormState;
  onSave: (payload: ProductCreate) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(formToPayload(form));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Nom du produit <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="Ex. T-shirt Coton Bio 200g"
            required
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* SKU */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={set("sku")}
            placeholder="REF-001"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* Sector */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Secteur ESPR</label>
          <select
            value={form.sector}
            onChange={set("sector")}
            title="Secteur ESPR"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald transition-colors"
          >
            <option value="">— Sélectionner —</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* PCF */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            PCF <span className="font-normal">(kg CO₂e)</span>
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.pcf_kgco2e}
            onChange={set("pcf_kgco2e")}
            placeholder="0.000"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* Recyclability */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Recyclabilité <span className="font-normal">(%)</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.recyclability_pct}
            onChange={set("recyclability_pct")}
            placeholder="0"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* Lifespan */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Durée de vie <span className="font-normal">(années)</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={form.lifespan_years}
            onChange={set("lifespan_years")}
            placeholder="0"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* ESPR status */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Statut ESPR</label>
          <select
            value={form.espr_status}
            onChange={set("espr_status")}
            title="Statut ESPR"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald transition-colors"
          >
            {(Object.entries(ESPR_LABELS) as [EsprStatus, { label: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Product row
// ---------------------------------------------------------------------------

function ProductRow({
  product,
  onEdit,
  onDelete,
}: {
  product: ProductOut;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-carbon-emerald/10 flex items-center justify-center flex-shrink-0">
          <Package className="w-4 h-4 text-carbon-emerald" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{product.name}</p>
            {product.sku && (
              <span className="text-[10px] font-mono text-[var(--color-foreground-muted)] bg-[var(--color-border)] px-1.5 py-0.5 rounded">
                {product.sku}
              </span>
            )}
            <EsprBadge status={product.espr_status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {product.sector && (
              <span className="text-xs text-[var(--color-foreground-muted)]">{product.sector}</span>
            )}
            {product.pcf_kgco2e !== null && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-foreground-muted)]">
                <Zap className="w-3 h-3 text-amber-500" />
                {product.pcf_kgco2e} kg CO₂e
              </span>
            )}
            {product.recyclability_pct !== null && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-foreground-muted)]">
                <Recycle className="w-3 h-3 text-emerald-500" />
                {product.recyclability_pct}%
              </span>
            )}
            {product.lifespan_years !== null && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-foreground-muted)]">
                <Clock className="w-3 h-3 text-cyan-500" />
                {product.lifespan_years} ans
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            title={expanded ? "Réduire" : "Détails"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-carbon-emerald hover:bg-carbon-emerald/10 transition-colors cursor-pointer"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors cursor-pointer"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "PCF", value: product.pcf_kgco2e !== null ? `${product.pcf_kgco2e} kg CO₂e` : "—" },
            { label: "Recyclabilité", value: product.recyclability_pct !== null ? `${product.recyclability_pct}%` : "—" },
            { label: "Durée de vie", value: product.lifespan_years !== null ? `${product.lifespan_years} ans` : "—" },
            { label: "Secteur", value: product.sector ?? "—" },
          ].map((kv) => (
            <div key={kv.label} className="rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] p-3">
              <p className="text-[10px] text-[var(--color-foreground-muted)] uppercase tracking-wide mb-0.5">{kv.label}</p>
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{kv.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirm modal
// ---------------------------------------------------------------------------

function DeleteConfirm({
  product,
  onConfirm,
  onCancel,
  deleting,
}: {
  product: ProductOut;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}>
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-[var(--color-foreground)]">Supprimer le produit</h3>
          <button type="button" title="Fermer" aria-label="Fermer" onClick={onCancel} className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
          Supprimer <span className="font-semibold text-[var(--color-foreground)]">{product.name}</span> ? Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DppPage() {
  const [products, setProducts] = useState<ProductOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ProductOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    const ac = new AbortController();
    fetchProducts(ac.signal)
      .then(setProducts)
      .catch((e) => {
        if (!ac.signal.aborted) setFetchError(e instanceof Error ? e.message : "Erreur réseau");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const handleSave = async (payload: ProductCreate) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editProduct) {
        const updated = await patchProduct(editProduct.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createProduct(payload);
        setProducts((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditProduct(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // keep modal open on error
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditProduct(null);
    setSaveError(null);
    setShowForm(true);
  };

  const openEdit = (p: ProductOut) => {
    setEditProduct(p);
    setSaveError(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditProduct(null);
    setSaveError(null);
  };

  // Stats
  const compliant = products.filter((p) => p.espr_status === "compliant").length;
  const nonCompliant = products.filter((p) => p.espr_status === "non_compliant").length;
  const avgPcf =
    products.filter((p) => p.pcf_kgco2e !== null).length > 0
      ? products.reduce((s, p) => s + (p.pcf_kgco2e ?? 0), 0) /
        products.filter((p) => p.pcf_kgco2e !== null).length
      : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-carbon-emerald" />
            Digital Product Passport
          </h1>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Fiches produits DPP/ESPR — PCF, recyclabilité, durée de vie, conformité.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Nouveau produit
          </button>
        )}
      </div>

      {/* ESPR info banner */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Le règlement ESPR entre en vigueur progressivement à partir de 2026 (textiles, batteries, électronique en priorité). Renseignez dès maintenant vos fiches produits pour anticiper l&apos;obligation DPP 2027.
        </p>
      </div>

      {/* Stats */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Produits", value: products.length, icon: Package, color: "text-carbon-emerald" },
            { label: "Conformes ESPR", value: compliant, icon: CheckCircle2, color: "text-[var(--color-success)]" },
            { label: "Non conformes", value: nonCompliant, icon: AlertTriangle, color: "text-[var(--color-danger)]" },
            {
              label: "PCF moyen",
              value: avgPcf !== null ? `${avgPcf.toFixed(1)} kg` : "—",
              icon: Zap,
              color: "text-amber-500",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-[var(--color-foreground-muted)]">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-[var(--color-foreground)]">{stat.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              {editProduct ? `Modifier — ${editProduct.name}` : "Nouveau produit"}
            </h3>
            <button type="button" title="Fermer" aria-label="Fermer" onClick={cancelForm} className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">
            <ProductForm
              initial={editProduct ? productToForm(editProduct) : EMPTY_FORM}
              onSave={handleSave}
              onCancel={cancelForm}
              saving={saving}
              error={saveError}
            />
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Catalogue produits</h3>
          <span className="text-xs text-[var(--color-foreground-muted)]">
            {products.length} produit{products.length > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-[var(--color-foreground-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : fetchError ? (
          <div className="flex items-center gap-2 p-5 text-xs text-[var(--color-danger)]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {fetchError}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-raised)] flex items-center justify-center">
              <Package className="w-6 h-6 text-[var(--color-foreground-muted)]" />
            </div>
            <p className="text-sm text-[var(--color-foreground-muted)]">Aucun produit enregistré</p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Créer le premier produit
            </button>
          </div>
        ) : (
          <div>
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirm
          product={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
