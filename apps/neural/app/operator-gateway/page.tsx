import Link from "next/link";
import { Network, ArrowRight, Zap, ShieldCheck, ScrollText, Coins } from "lucide-react";

import demoState from "@/content/operator-gateway/demo-state.json";
import { McpServersList } from "@/components/operator-gateway/mcp-servers-list";
import { AuditTrailStream } from "@/components/operator-gateway/audit-trail-stream";
import { CostDashboard } from "@/components/operator-gateway/cost-dashboard";
import { PolicyEngineList } from "@/components/operator-gateway/policy-engine-list";

export const metadata = {
  title: "Operator Gateway — NEURAL",
  description:
    "La couche d'orchestration des agents IA NEURAL : MCP servers gouvernés, audit trail signé, policies enforced, cost tracking par agent. Différenciant face aux iPaaS génériques.",
};

export default function OperatorGatewayPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              <Network className="h-3.5 w-3.5" />
              Operator Gateway
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/[0.10] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Demo · données mock réalistes
            </span>
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            La couche d&apos;orchestration agents
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Centralise les MCP servers, journalise chaque décision agent avec hash signé, applique
            les policies réglementaires (AI Act, RGPD, MAR) et trace le coût/usage par agent et
            par tenant. C&apos;est la brique qui fait la différence face aux iPaaS génériques.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-5">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Agents actifs</p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums">
                {demoState.globalStats.agentsActifs}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Décisions 24h</p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums">
                {new Intl.NumberFormat("fr-FR").format(demoState.globalStats.decisions24h)}
              </p>
            </div>
            <div className="rounded-[20px] border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
                Audit trail
              </p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-emerald-200">
                {demoState.globalStats.auditTrailIntegrity}
              </p>
              <p className="mt-1 text-[10px] text-white/45">Intégrité signée</p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Policies</p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums">
                {demoState.globalStats.policiesEnforced}
              </p>
            </div>
            <div className="rounded-[20px] border border-amber-400/25 bg-amber-400/[0.06] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">
                Bloqués 24h
              </p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-amber-200">
                {demoState.globalStats.incidentsBlocked24h}
              </p>
              <p className="mt-1 text-[10px] text-white/45">Policy enforcement</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MCP Servers ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                <Zap className="h-3 w-3" />
                MCP Servers
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Serveurs MCP enregistrés
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Chaque MCP server est versionné, RBAC-enforced, rate-limited. Pas d&apos;accès
                direct des agents aux outils — tout passe par la gateway.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <McpServersList servers={demoState.mcpServers} />
          </div>
        </div>
      </section>

      {/* ── Audit Trail ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <ScrollText className="h-3 w-3" />
                Audit Trail
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Journal des décisions agent
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Chaque décision est journalisée avec prompt hash signé, version, modèle, latence,
                coût et signataire. Cliquez pour déplier les métadonnées complètes.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <AuditTrailStream entries={demoState.auditTrail} />
          </div>
        </div>
      </section>

      {/* ── Policy Engine ────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <ShieldCheck className="h-3 w-3" />
                Policy Engine
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Policies enforced
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Règles déterministes appliquées avant et après chaque décision agent. Override
                LLM systématique sur les hard-fails sectoriels et réglementaires.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <PolicyEngineList policies={demoState.policies} />
          </div>
        </div>
      </section>

      {/* ── Cost Dashboard ───────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                <Coins className="h-3 w-3" />
                Cost &amp; Usage
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Coût par agent
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Tracking transparent : coût par agent, par décision, par tenant. Plafond
                configurable, alertes à 80% et 110% du cap.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <CostDashboard
              monthlyTotal={demoState.costBreakdown.monthlyTotal}
              currency={demoState.costBreakdown.currency}
              month={demoState.costBreakdown.month}
              byAgent={demoState.costBreakdown.byAgent}
            />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  L&apos;Operator Gateway en runtime public
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Cette page utilise des données mock pour montrer la mécanique. La version
                  runtime publique est sur la roadmap T3 2026 — voir l&apos;item « Operator
                  Gateway MVP » sur la roadmap.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/roadmap"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
                >
                  Voir la roadmap <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact?source=operator-gateway"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  Démo personnalisée
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
