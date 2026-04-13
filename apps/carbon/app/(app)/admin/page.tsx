"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  fetchCompanies,
  fetchUsers,
  createCompany,
  createUser,
  deleteUser,
  deleteCompany,
  type CompanyOut,
  type UserOut,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import { SectionTitle } from "@/components/ui/section-title";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-slate-100 text-slate-600",
  pro: "bg-emerald-50 text-emerald-700",
  enterprise: "bg-violet-50 text-violet-700",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700",
  analyst: "bg-blue-50 text-blue-700",
  viewer: "bg-slate-100 text-slate-600",
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

// ---------------------------------------------------------------------------
// Formulaire création entreprise
// ---------------------------------------------------------------------------
function CreateCompanyForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSlug = (n: string) => n.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createCompany({ name, slug: slug || autoSlug(name), plan });
      setName(""); setSlug(""); setPlan("starter");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 transition cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Nouvelle entreprise
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Nom *</label>
              <input
                required value={name}
                onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Slug *</label>
              <input
                required value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald"
                placeholder="acme-corp"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Plan</label>
            <select
              value={plan} onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald"
            >
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit" disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Créer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] cursor-pointer">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaire création user
// ---------------------------------------------------------------------------
function CreateUserForm({ companies, onCreated }: { companies: CompanyOut[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analyst");
  const [companyId, setCompanyId] = useState<number>(companies[0]?.id ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createUser({ email, password, role, company_id: companyId });
      setEmail(""); setPassword(""); setRole("analyst");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-foreground-muted)] hover:border-carbon-emerald transition cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Nouvel utilisateur
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Email *</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald"
                placeholder="user@company.com" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Mot de passe *</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald"
                placeholder="••••••••" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Entreprise</label>
              <select value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald">
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-foreground-muted)] mb-1">Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] focus:outline-none focus:border-carbon-emerald">
                <option value="admin">Admin</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-emerald text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Créer
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] cursor-pointer">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const { auth } = useAuth();
  const [companies, setCompanies] = useState<CompanyOut[]>([]);
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"companies" | "users">("companies");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, u] = await Promise.all([fetchCompanies(), fetchUsers()]);
      setCompanies(c);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDeleteUser = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showFeedback("Utilisateur supprimé");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Erreur suppression");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCompany = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setUsers((prev) => prev.filter((u) => u.company_id !== id));
      showFeedback("Entreprise supprimée");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Erreur suppression");
    } finally {
      setDeletingId(null);
    }
  };

  // Accès restreint aux admins
  if (auth.status === "authenticated" && auth.role !== "admin") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-[var(--color-danger)] mx-auto mb-3" />
          <h2 className="font-display text-xl font-bold text-[var(--color-foreground)]">Accès refusé</h2>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-1">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div {...pageVariants} className="p-6 space-y-6 max-w-5xl mx-auto">
      <SectionTitle
        title="Administration"
        subtitle="Gestion des entreprises et des utilisateurs — accès admin uniquement"
      />

      {/* Feedback toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-carbon-emerald shadow-lg text-sm font-medium text-[var(--color-foreground)]">
          <CheckCircle2 className="w-4 h-4 text-carbon-emerald" />
          {feedback}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Entreprises", value: companies.length, icon: Building2, color: "text-emerald-500" },
          { label: "Utilisateurs", value: users.length, icon: Users, color: "text-violet-500" },
          { label: "Admins", value: users.filter((u) => u.role === "admin").length, icon: ShieldAlert, color: "text-red-500" },
          { label: "Actifs", value: users.filter((u) => u.is_active).length, icon: CheckCircle2, color: "text-cyan-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-2xl font-display font-bold text-[var(--color-foreground)]">{s.value}</p>
            <p className="text-xs text-[var(--color-foreground-muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(["companies", "users"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === tab
                ? "bg-carbon-emerald text-white"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-carbon-emerald"
            }`}
          >
            {tab === "companies" ? "Entreprises" : "Utilisateurs"}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-danger)]" />
          <span className="text-xs text-[var(--color-danger)]">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" /></div>
      ) : (
        <>
          {/* ── Companies ── */}
          {activeTab === "companies" && (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              <CreateCompanyForm onCreated={load} />
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                {companies.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--color-foreground-muted)]">Aucune entreprise.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Entreprise</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Slug</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Plan</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Users</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Créée</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <motion.tr key={c.id} variants={staggerItem} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{c.name}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground-muted)] font-mono text-xs">{c.slug}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[c.plan] ?? "bg-slate-100 text-slate-600"}`}>
                              {c.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-foreground-muted)]">{c.user_count}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground-subtle)] text-xs">{fmtDate(c.created_at)}</td>
                          <td className="px-4 py-3">
                            {c.id !== 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCompany(c.id)}
                                disabled={deletingId === c.id}
                                className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Users ── */}
          {activeTab === "users" && (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              <CreateUserForm companies={companies} onCreated={load} />
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                {users.length === 0 ? (
                  <div className="p-10 text-center text-sm text-[var(--color-foreground-muted)]">Aucun utilisateur.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Entreprise</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Rôle</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Statut</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-foreground-muted)]">Dernière connexion</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <motion.tr key={u.id} variants={staggerItem} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-raised)] transition-colors">
                          <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{u.email}</td>
                          <td className="px-4 py-3 text-[var(--color-foreground-muted)]">{u.company_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.is_active ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]"}`}>
                              {u.is_active ? "Actif" : "Inactif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--color-foreground-subtle)] text-xs">
                            {u.last_login_at ? fmtDate(u.last_login_at) : "Jamais"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id)}
                              disabled={deletingId === u.id}
                              className="p-1.5 rounded-lg text-[var(--color-foreground-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition cursor-pointer disabled:opacity-50"
                            >
                              {deletingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
