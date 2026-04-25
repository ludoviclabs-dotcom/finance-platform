import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FileCheck,
  Gavel,
  Radio,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Assurance — Supply Chain & Marketing conformes | NEURAL",
  description:
    "Deux branches NEURAL pour l'assurance : Supply Chain (réseau réparateurs, experts, fraude, Sapin II) et Marketing (DDA, RGPD art. 9, multi-canal, prévention). 8 agents, 9 Excel, 0 autopublication.",
  openGraph: {
    title: "NEURAL — Assurance",
    description:
      "Supply Chain sinistres + Marketing conformité DDA. 8 agents déterministes, 9 workbooks Excel auditables.",
  },
};

const BRANCHES = [
  {
    slug: "supply-chain",
    href: "/secteurs/assurance/supply-chain",
    label: "Supply Chain",
    tagline: "Réseau, experts & conformité sinistres",
    description:
      "Pilotage du réseau de réparateurs, gestion des experts, détection de fraude fournisseur et conformité Sapin II / DORA — sans jamais masquer le libre choix du réparant.",
    agents: [
      { icon: Wrench,      name: "RepairNetworkInsur",  tag: "Réseau réparateurs" },
      { icon: FileCheck,   name: "ExpertMgmtInsur",     tag: "Gestion experts"    },
      { icon: ShieldCheck, name: "FraudDetectSC",       tag: "Fraude fournisseur" },
      { icon: Gavel,       name: "Sapin2Compliance",    tag: "Sapin II / DORA"    },
    ],
    kpis: ["4 agents", "6 workbooks Excel", "10 gates déterministes"],
    accent: "#059669",
    bg: "#061A14",
    cls: "branch-sc",
  },
  {
    slug: "marketing",
    href: "/secteurs/assurance/marketing",
    label: "Marketing",
    tagline: "DDA, RGPD & communications conformes",
    description:
      "Vulgarisation CGV/IPID, audit DDA 12 points, déclinaison multi-canal DSA et détection des patterns claim avoidance + données sensibles RGPD art. 9.",
    agents: [
      { icon: BarChart3,   name: "InsurSimplifier",     tag: "Clarté B1-B2"  },
      { icon: ShieldCheck, name: "DDA_MarketingGuard",  tag: "Audit 12 pts"  },
      { icon: Radio,       name: "MultiChannelInsur",   tag: "4 canaux + DSA"},
      { icon: Sparkles,    name: "PreventionContent",   tag: "ClaimGuard"    },
    ],
    kpis: ["4 agents", "5 workbooks Excel", "12 règles DDA auditées"],
    accent: "#7C3AED",
    bg: "#0e0824",
    cls: "branch-mkt",
  },
] as const;

const SECTOR_STATS = [
  { value: "8",  label: "agents actifs"           },
  { value: "9",  label: "workbooks Excel"          },
  { value: "21", label: "sources réglementaires"   },
  { value: "0",  label: "autopublication"          },
];

export default function AssurancePage() {
  return (
    <main style={{ background: "#0e0824", minHeight: "100vh", color: "#f1f5f9", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        .branch-card { transition: border-color .2s, transform .2s; }
        .branch-sc:hover  { border-color: #059669 !important; transform: translateY(-3px); }
        .branch-mkt:hover { border-color: #7C3AED !important; transform: translateY(-3px); }
      `}</style>

      {/* ── NAV ─────────────────────────────────────── */}
      <nav style={{ borderBottom: "1px solid rgba(124,58,237,.25)", padding: "16px 32px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <Link href="/"         style={{ color: "#94a3b8", textDecoration: "none" }}>NEURAL</Link>
        <span style={{ color: "#475569" }}>/</span>
        <Link href="/secteurs" style={{ color: "#94a3b8", textDecoration: "none" }}>Secteurs</Link>
        <span style={{ color: "#475569" }}>/</span>
        <span style={{ color: "#f1f5f9", fontWeight: 600 }}>Assurance</span>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>

        {/* ── HERO ────────────────────────────────────── */}
        <section style={{ padding: "72px 0 56px" }}>
          <div style={{ display: "inline-block", background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.4)", borderRadius: "20px", padding: "4px 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", color: "#a78bfa", textTransform: "uppercase", marginBottom: "20px" }}>
            Secteur Assurance
          </div>

          <h1 style={{ fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 20px", color: "#fff" }}>
            Assurance.<br />
            <span style={{ color: "#a78bfa" }}>Deux branches, une cohérence.</span>
          </h1>

          <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: "640px", lineHeight: 1.7, margin: "0 0 40px" }}>
            Supply Chain sinistres et Marketing conformité DDA — deux problèmes distincts,
            les mêmes exigences : déterminisme, auditabilité, zéro autopublication.
          </p>

          <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
            {SECTOR_STATS.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BRANCHES ────────────────────────────────── */}
        <section style={{ paddingBottom: "80px" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "32px" }}>
            Branches disponibles
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: "24px" }}>
            {BRANCHES.map((branch) => (
              <Link key={branch.slug} href={branch.href} style={{ textDecoration: "none", display: "block" }}>
                <div
                  className={`branch-card ${branch.cls}`}
                  style={{ background: branch.bg, border: `1px solid ${branch.accent}40`, borderRadius: "16px", padding: "36px" }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: branch.accent, textTransform: "uppercase", marginBottom: "6px" }}>
                        Branche
                      </div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{branch.label}</div>
                      <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>{branch.tagline}</div>
                    </div>
                    <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `${branch.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", color: branch.accent, flexShrink: 0 }}>
                      <ArrowRight size={18} />
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.65, marginBottom: "24px" }}>
                    {branch.description}
                  </p>

                  {/* Agent list */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                    {branch.agents.map((agent) => {
                      const Icon = agent.icon;
                      return (
                        <div key={agent.name} style={{ background: "rgba(255,255,255,.04)", borderRadius: "8px", padding: "10px 12px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: `${branch.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", color: branch.accent, flexShrink: 0 }}>
                            <Icon size={14} />
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.2 }}>{agent.name}</div>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>{agent.tag}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* KPI pills */}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {branch.kpis.map((k) => (
                      <span key={k} style={{ background: `${branch.accent}18`, border: `1px solid ${branch.accent}35`, borderRadius: "20px", padding: "3px 10px", fontSize: "11px", color: branch.accent, fontWeight: 600 }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── FOOTER NAV ──────────────────────────────── */}
        <section style={{ borderTop: "1px solid rgba(124,58,237,.2)", padding: "40px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <Link href="/secteurs" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>
            ← Tous les secteurs
          </Link>
          <Link href="/contact" style={{ background: "#7C3AED", color: "#fff", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
            Demander une démo assurance →
          </Link>
        </section>

      </div>
    </main>
  );
}
