"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import {
  fetchAlertRules,
  createAlertRule,
  patchAlertRule,
  deleteAlertRule,
  evaluateAlerts,
  fetchAlertHistory,
  type AlertRuleOut,
  type AlertRuleCreate,
  type AlertFired,
  type AlertOperator,
  type AlertChannel,
  type AlertDomain,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAIN_LABELS: Record<AlertDomain, string> = {
  carbon: "Carbone",
  vsme: "VSME",
  esg: "ESG",
  finance: "Finance",
};

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: "> supérieur à",
  lt: "< inférieur à",
  gte: "≥ supérieur ou égal à",
  lte: "≤ inférieur ou égal à",
  eq: "= égal à",
};

const FIELD_SUGGESTIONS: Record<AlertDomain, { path: string; label: string }[]> = {
  carbon: [
    { path: "carbon.totalS123Tco2e", label: "Total Scope 1+2+3 (tCO₂e)" },
    { path: "carbon.scope1Tco2e", label: "Scope 1 (tCO₂e)" },
    { path: "carbon.scope2LbTco2e", label: "Scope 2 LB (tCO₂e)" },
    { path: "carbon.scope3Tco2e", label: "Scope 3 (tCO₂e)" },
    { path: "energy.renewableSharePct", label: "ENR (%)" },
  ],
  esg: [
    { path: "scores.scoreGlobal", label: "Score ESG global" },
    { path: "materialite.enjeuxMateriels", label: "Enjeux matériels" },
  ],
  vsme: [
    { path: "completude.scorePct", label: "Score complétude (%)" },
    { path: "completude.indicateursCompletes", label: "Indicateurs complétés" },
  ],
  finance: [
    { path: "financeClimat.expositionTotaleEur", label: "Exposition carbone (€)" },
    { path: "financeClimat.greenCapexPct", label: "Green CapEx (%)" },
    { path: "financeClimat.prixEts", label: "Prix ETS (€/tCO₂e)" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function OperatorBadge({ op }: { op: AlertOperator }) {
  return (
    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-foreground-muted)]">
      {op}
    </span>
  );
}

function DomainBadge({ domain }: { domain: AlertDomain }) {
  const colors: Record<AlertDomain, string> = {
    carbon: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
    esg: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
    vsme: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400",
    finance: "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400",
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[domain]}`}>
      {DOMAIN_LABELS[domain]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit form
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  domain: AlertDomain;
  field_path: string;
  operator: AlertOperator;
  threshold: string;
  channel: AlertChannel;
  destination: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  domain: "carbon",
  field_path: "",
  operator: "gt",
  threshold: "",
  channel: "webhook",
  destination: "",
  is_active: true,
};

function ruleToForm(r: AlertRuleOut): FormState {
  return {
    name: r.name,
    domain: r.domain,
    field_path: r.field_path,
    operator: r.operator,
    threshold: String(r.threshold),
    channel: r.channel,
    destination: r.destination,
    is_active: r.is_active,
  };
}

function AlertForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: FormState;
  onSave: (payload: AlertRuleCreate) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setCheck = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  const suggestions = FIELD_SUGGESTIONS[form.domain] ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.field_path.trim() || !form.threshold || !form.destination.trim()) return;
    onSave({
      name: form.name.trim(),
      domain: form.domain,
      field_path: form.field_path.trim(),
      operator: form.operator,
      threshold: parseFloat(form.threshold),
      channel: form.channel,
      destination: form.destination.trim(),
      is_active: form.is_active,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Nom de la règle <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="Ex. Alerte scope 1 dépassé"
            required
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* Domain */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Domaine</label>
          <select
            value={form.domain}
            onChange={(e) => setForm((prev) => ({ ...prev, domain: e.target.value as AlertDomain, field_path: "" }))}
            title="Domaine"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald transition-colors"
          >
            {(Object.entries(DOMAIN_LABELS) as [AlertDomain, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Field path */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Champ surveillé <span className="text-[var(--color-danger)]">*</span>
          </label>
          <select
            value={form.field_path}
            onChange={set("field_path")}
            title="Champ surveillé"
            required
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald transition-colors"
          >
            <option value="">— Sélectionner un champ —</option>
            {suggestions.map((s) => (
              <option key={s.path} value={s.path}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Operator */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Opérateur</label>
          <select
            value={form.operator}
            onChange={set("operator")}
            title="Opérateur"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald transition-colors"
          >
            {(Object.entries(OPERATOR_LABELS) as [AlertOperator, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Threshold */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Seuil <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="number"
            step="any"
            value={form.threshold}
            onChange={set("threshold")}
            placeholder="Ex. 500"
            required
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* Channel */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">Canal</label>
          <select
            value={form.channel}
            onChange={set("channel")}
            title="Canal de notification"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald transition-colors"
          >
            <option value="webhook">Webhook</option>
            <option value="email">Email</option>
          </select>
        </div>

        {/* Destination */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">
            Destination <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="text"
            value={form.destination}
            onChange={set("destination")}
            placeholder={form.channel === "webhook" ? "https://hooks.example.com/…" : "alert@example.com"}
            required
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder-[var(--color-foreground-subtle)] focus:outline-none focus:border-carbon-emerald transition-colors"
          />
        </div>

        {/* Active */}
        <div className="flex items-center gap-2 pt-5">
          <input
            id="is_active"
            type="checkbox"
            checked={form.is_active}
            onChange={setCheck("is_active")}
            className="w-4 h-4 accent-[#059669] cursor-pointer"
          />
          <label htmlFor="is_active" className="text-sm text-[var(--color-foreground)] cursor-pointer">
            Règle active
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
          Annuler
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Rule row
// ---------------------------------------------------------------------------

function RuleRow({ rule, onEdit, onDelete, onToggle }: {
  rule: AlertRuleOut;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="p-4 flex items-center gap-3 border-b border-[var(--color-border)] last:border-0">
      <button type="button" onClick={onToggle} title={rule.is_active ? "Désactiver" : "Activer"}
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
          rule.is_active ? "bg-carbon-emerald/15" : "bg-[var(--color-border)]"
        }`}>
        {rule.is_active
          ? <Bell className="w-4 h-4 text-carbon-emerald" />
          : <BellOff className="w-4 h-4 text-[var(--color-foreground-muted)]" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{rule.name}</p>
          <DomainBadge domain={rule.domain} />
          {!rule.is_active && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-foreground-muted)]">
              Inactif
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-mono text-[var(--color-foreground-muted)]">{rule.field_path}</span>
          <OperatorBadge op={rule.operator} />
          <span className="text-xs font-semibold text-[var(--color-foreground)]">{rule.threshold}</span>
          <span className="text-xs text-[var(--color-foreground-subtle)]">→ {rule.channel}</span>
        </div>
        {rule.last_fired_at && (
          <p className="text-[10px] text-amber-500 mt-0.5">
            Dernière alerte : {new Date(rule.last_fired_at).toLocaleString("fr-FR")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button type="button" onClick={onEdit} title="Modifier"
          className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-carbon-emerald hover:bg-carbon-emerald/10 transition-colors cursor-pointer">
          <Pencil className="w-4 h-4" />
        </button>
        <button type="button" onClick={onDelete} title="Supprimer"
          className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors cursor-pointer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fired alert item
// ---------------------------------------------------------------------------

function FiredRow({ alert }: { alert: AlertFired }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">{alert.rule_name}</p>
        <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
          <span className="font-mono">{alert.field_path}</span>
          {" "}={" "}<span className="font-semibold">{alert.current_value}</span>
          {" "}<OperatorBadge op={alert.operator} />{" "}seuil {alert.threshold}
        </p>
        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
          {new Date(alert.fired_at).toLocaleString("fr-FR")}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRuleOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<AlertRuleOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AlertRuleOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ evaluated: number; fired: number; alerts: AlertFired[] } | null>(null);

  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [history, setHistory] = useState<AlertFired[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    const ac = new AbortController();
    fetchAlertRules(ac.signal)
      .then(setRules)
      .catch((e) => { if (!ac.signal.aborted) setFetchError(e instanceof Error ? e.message : "Erreur réseau"); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const handleSave = async (payload: AlertRuleCreate) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editRule) {
        const updated = await patchAlertRule(editRule.id, payload);
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createAlertRule(payload);
        setRules((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditRule(null);
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
      await deleteAlertRule(deleteTarget.id);
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* keep modal open */ }
    finally { setDeleting(false); }
  };

  const handleToggle = async (rule: AlertRuleOut) => {
    try {
      const updated = await patchAlertRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch { /* silent fail */ }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setEvalResult(null);
    try {
      const result = await evaluateAlerts();
      setEvalResult(result);
      // reload rules to get updated last_fired_at
      load();
    } catch (e) {
      setEvalResult({ evaluated: 0, fired: 0, alerts: [] });
    } finally {
      setEvaluating(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const h = await fetchAlertHistory(50);
      setHistory(h.alerts);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  };

  const toggleHistory = () => {
    if (!historyExpanded) loadHistory();
    setHistoryExpanded((v) => !v);
  };

  const activeCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-carbon-emerald" />
            Règles d&apos;alerte
          </h1>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Surveillance automatique des KPIs ESG — webhook ou email quand un seuil est franchi.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => { setEditRule(null); setSaveError(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer flex-shrink-0">
            <Plus className="w-4 h-4" /> Nouvelle règle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Règles totales", value: rules.length, color: "text-[var(--color-foreground)]" },
          { label: "Actives", value: activeCount, color: "text-carbon-emerald-light" },
          { label: "Inactives", value: rules.length - activeCount, color: "text-[var(--color-foreground-muted)]" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Evaluate button */}
      <div className="rounded-2xl border border-carbon-emerald/30 bg-gradient-to-br from-carbon-emerald/10 to-cyan-500/5 p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-carbon-emerald/20 flex items-center justify-center flex-shrink-0">
          <Play className={`w-5 h-5 text-carbon-emerald ${evaluating ? "animate-pulse" : ""}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-1">Évaluer les règles maintenant</h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mb-3">
            Compare toutes les règles actives contre les snapshots en cache et liste les alertes déclenchées.
          </p>
          {evalResult && (
            <div className={`mb-3 flex items-center gap-2 text-xs font-semibold ${
              evalResult.fired > 0 ? "text-amber-600" : "text-[var(--color-success)]"
            }`}>
              {evalResult.fired > 0
                ? <><AlertTriangle className="w-4 h-4" /> {evalResult.fired} alerte{evalResult.fired > 1 ? "s" : ""} déclenchée{evalResult.fired > 1 ? "s" : ""} sur {evalResult.evaluated} règle{evalResult.evaluated > 1 ? "s" : ""} évaluée{evalResult.evaluated > 1 ? "s" : ""}</>
                : <><CheckCircle2 className="w-4 h-4" /> Aucune alerte — {evalResult.evaluated} règle{evalResult.evaluated > 1 ? "s" : ""} évaluée{evalResult.evaluated > 1 ? "s" : ""}</>}
            </div>
          )}
          {evalResult && evalResult.fired > 0 && (
            <div className="mb-3 space-y-2">
              {evalResult.alerts.map((a, i) => <FiredRow key={i} alert={a} />)}
            </div>
          )}
          <button type="button" onClick={handleEvaluate} disabled={evaluating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {evaluating ? <><Loader2 className="w-4 h-4 animate-spin" /> Évaluation…</> : <><Play className="w-4 h-4" /> Lancer l&apos;évaluation</>}
          </button>
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              {editRule ? `Modifier — ${editRule.name}` : "Nouvelle règle"}
            </h3>
            <button type="button" title="Fermer" aria-label="Fermer"
              onClick={() => { setShowForm(false); setEditRule(null); setSaveError(null); }}
              className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5">
            <AlertForm
              initial={editRule ? ruleToForm(editRule) : EMPTY_FORM}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditRule(null); setSaveError(null); }}
              saving={saving}
              error={saveError}
            />
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Règles configurées</h3>
          <span className="text-xs text-[var(--color-foreground-muted)]">
            {rules.length} règle{rules.length > 1 ? "s" : ""}
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
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-raised)] flex items-center justify-center">
              <BellOff className="w-6 h-6 text-[var(--color-foreground-muted)]" />
            </div>
            <p className="text-sm text-[var(--color-foreground-muted)]">Aucune règle configurée</p>
            <button type="button" onClick={() => { setEditRule(null); setSaveError(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer">
              <Plus className="w-4 h-4" /> Créer la première règle
            </button>
          </div>
        ) : (
          rules.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              onEdit={() => { setEditRule(r); setSaveError(null); setShowForm(true); }}
              onDelete={() => setDeleteTarget(r)}
              onToggle={() => handleToggle(r)}
            />
          ))
        )}
      </div>

      {/* Alert history */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <button type="button" onClick={toggleHistory}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">Historique des alertes déclenchées</h3>
          {historyExpanded ? <ChevronUp className="w-4 h-4 text-[var(--color-foreground-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-foreground-muted)]" />}
        </button>
        {historyExpanded && (
          <div className="px-5 pb-5">
            {historyLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-foreground-muted)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-[var(--color-foreground-muted)] py-4">
                Aucune alerte déclenchée depuis le démarrage du service.
              </p>
            ) : (
              <div className="space-y-2 pt-2">
                {history.map((a, i) => <FiredRow key={i} alert={a} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 w-80 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-[var(--color-foreground)]">Supprimer la règle</h3>
              <button type="button" title="Fermer" aria-label="Fermer" onClick={() => setDeleteTarget(null)}
                className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
              Supprimer <span className="font-semibold text-[var(--color-foreground)]">{deleteTarget.name}</span> ? Action irréversible.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer">
                Annuler
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
