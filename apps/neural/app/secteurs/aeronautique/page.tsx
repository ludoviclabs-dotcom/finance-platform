import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Clock,
  Leaf,
  Plane,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Aéronautique — Marketing & Communications | NEURAL",
  description:
    "Deux branches NEURAL pour l'aéronautique : Marketing (4 agents : ITAR/EAR, salons 2026, anti-greenwashing) et Communications & Affaires publiques (corporate, briefs presse CEO, gov relations). 4 agents, 5 workbooks Excel, 0 autopublication.",
  openGraph: {
    title: "NEURAL — Aéronautique",
    description:
      "Marketing B2B technique + Communications corporate. Agents déterministes, workbooks Excel auditables.",
  },
};

const BRANCHES = [
  {
    slug: "marketing",
    href: "/secteurs/aeronautique/marketing",
    label: "Marketing",
    tagline: "B2B technique, salons 2026 & conformité",
    description:
      "Audit qualité contenus B2B (white papers, fiches techniques, RFP), conformité ITAR/EAR/sanctions, packs salons 2026 (Farnborough, ILA, Eurosatory, MEBAA), anti-greenwashing SAF/H2/eVTOL.",
    agents: [
      { icon: Plane,        name: "AeroTechContent",          tag: "Qualité contenus B2B" },
      { icon: ShieldAlert,  name: "DefenseCommsGuard",        tag: "ITAR/EAR/sanctions"   },
      { icon: Sparkles,     name: "AeroEventAI",              tag: "Salons 2026"          },
      { icon: Leaf,         name: "AeroSustainabilityComms",  tag: "Anti-greenwashing"    },
    ],
    kpis: ["4 agents", "5 workbooks Excel", "44 règles encodées"],
    accent: "#7C3AED",
    bg: "#0e0824",
    cls: "branch-mkt",
    status: "ACTIVE" as const,
  },
  {
    slug: "communications",
    href: "#",
    label: "Communications & Affaires publiques",
    tagline: "Corporate, presse CEO, gov relations",
    description:
      "Briefs presse CEO, communications programme, relations gouvernementales, communications ESG corporate. 4 agents en cours de finalisation : AeroDefenseCommsGuard, ProgramCommsAero, GovRelationsAero, GreenAeroComms.",
    agents: [
      { icon: Briefcase,    name: "AeroDefenseCommsGuard",  tag: "Corporate defense"    },
      { icon: Briefcase,    name: "ProgramCommsAero",       tag: "Communications programme" },
      { icon: Briefcase,    name: "GovRelationsAero",       tag: "Gov relations"        },
      { icon: Briefcase,    name: "GreenAeroComms",         tag: "ESG corporate"        },
    ],
    kpis: ["6 workbooks générés", "Foundations + Master", "À venir Q2-Q3 2026"],
    accent: "#0891B2",
    bg: "#0a1f24",
    cls: "branch-comms",
    status: "COMING" as const,
  },
] as const;

const SECTOR_STATS = [
  { value: "4",  label: "agents marketing actifs"  },
  { value: "5",  label: "workbooks Excel livrés"   },
  { value: "12", label: "sources réglementaires"   },
  { value: "0",  label: "autopublication"          },
];

export default function AeronautiquePage() {
  return (
    <main style={{ background: "#0e0824", minHeight: "100vh", color: "#f1f5f9", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        .branch-card { transition: border-color .2s, transform .2s; }
        .branch-mkt:hover    { border-color: #7C3AED !important; transform: translateY(-3px); }
        .branch-comms:hover  { border-color: #0891B2 !important; transform: translateY(-3px); }
      `}</style>

      {/* ── NAV ─────────────────────────────────────── */}
      <nav style={{ borderBottom: "1px solid rgba(124,58,237,.25)", padding: "16px 32px", display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <Link href="/"         style={{ color: "#94a3b8", textDecoration: "none" }}>NEURAL</Link>
        <span style={{ color: "#475569" }}>/</span>
        <Link href="/secteurs" style={{ color: "#94a3b8", textDecoration: "none" }}>Secteurs</Link>
        <span style={{ color: "#475569" }}>/</span>
        <span style={{ color: "#f1f5f9", fontWeight: 600 }}>Aéronautique</span>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>

        {/* ── HERO ────────────────────────────────────── */}
        <section style={{ padding: "72px 0 56px" }}>
          <div style={{ display: "inline-block", background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.4)", borderRadius: "20px", padding: "4px 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", color: "#a78bfa", textTransform: "uppercase", marginBottom: "20px" }}>
            Secteur Aéronautique
          </div>

          <h1 style={{ fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 20px", color: "#fff" }}>
            Aéronautique.<br />
            <span style={{ color: "#a78bfa" }}>Marketing B2B et corporate, deux exigences.</span>
          </h1>

          <p style={{ fontSize: "1.1rem", color: "#94a3b8", maxWidth: "640px", lineHeight: 1.7, margin: "0 0 40px" }}>
            Marketing technique B2B (white papers, RFP DGA/NATO, salons 2026, anti-greenwashing)
            et Communications & Affaires publiques (corporate, gov relations) — deux branches
            distinctes, mêmes exigences : déterminisme, auditabilité, zéro autopublication.
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
            {BRANCHES.map((branch) => {
              const isActive = branch.status === "ACTIVE";
              const Wrapper = ({ children }: { children: React.ReactNode }) =>
                isActive ? (
                  <Link href={branch.href} style={{ textDecoration: "none", display: "block" }}>
                    {children}
                  </Link>
                ) : (
                  <div style={{ display: "block", opacity: 0.85 }}>{children}</div>
                );
              return (
                <Wrapper key={branch.slug}>
                  <div
                    className={`branch-card ${branch.cls}`}
                    style={{ background: branch.bg, border: `1px solid ${branch.accent}40`, borderRadius: "16px", padding: "36px", cursor: isActive ? "pointer" : "default" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: branch.accent, textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                          Branche
                          {!isActive && (
                            <span style={{ background: `${branch.accent}30`, color: branch.accent, padding: "2px 8px", borderRadius: "10px", fontSize: "9px" }}>
                              <Clock size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                              à venir
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{branch.label}</div>
                        <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>{branch.tagline}</div>
                      </div>
                      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `${branch.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", color: branch.accent, flexShrink: 0 }}>
                        {isActive ? <ArrowRight size={18} /> : <Clock size={18} />}
                      </div>
                    </div>

                    <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: 1.65, marginBottom: "24px" }}>
                      {branch.description}
                    </p>

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

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {branch.kpis.map((k) => (
                        <span key={k} style={{ background: `${branch.accent}18`, border: `1px solid ${branch.accent}35`, borderRadius: "20px", padding: "3px 10px", fontSize: "11px", color: branch.accent, fontWeight: 600 }}>
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </section>

        {/* ── FOOTER NAV ──────────────────────────────── */}
        <section style={{ borderTop: "1px solid rgba(124,58,237,.2)", padding: "40px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <Link href="/secteurs" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>
            ← Tous les secteurs
          </Link>
          <Link href="/contact" style={{ background: "#7C3AED", color: "#fff", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: 700, textDecoration: "none" }}>
            Demander une démo aéro →
          </Link>
        </section>

      </div>
    </main>
  );
}
