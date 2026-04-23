import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileWarning,
  Gauge,
  Inbox,
  Landmark,
  Leaf,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { RegBankCommsLive } from "@/components/bank-comms/RegBankCommsLive";
import { BankCrisisLive } from "@/components/bank-comms/BankCrisisLive";
import { EsgBankCommsLive } from "@/components/bank-comms/EsgBankCommsLive";
import { ClientBankCommsLive } from "@/components/bank-comms/ClientBankCommsLive";
import {
  BANK_COMMS_GATES,
  BANK_COMMS_RISKS,
  BANK_COMMS_SOURCES,
  BANK_COMMS_WORKFLOW,
  getPublicAgents,
  getTransverseServices,
} from "@/lib/data/bank-comms-catalog";

export const metadata: Metadata = {
  title: "Banque / Communication — 4 agents déterministes en démo | NEURAL",
  description:
    "Communications bancaires régulées, crise, ESG et clients sensibles. 16 gates serveur, scénarios pré-chargés, packs exportables avec hash SHA-256. Aucune autopublication, chaque sortie est défendable.",
  openGraph: {
    title: "NEURAL — Banque / Communication",
    description:
      "RegBankComms, BankCrisisComms, ESGBankComms, ClientBankComms. 16 gates déterministes, 10 sources ACPR/AMF/EBA/ECB/ESMA/IFRS.",
  },
};

const AGENT_ICON: Record<string, typeof ShieldCheck> = {
  "reg-bank-comms": Landmark,
  "bank-crisis-comms": ShieldAlert,
  "esg-bank-comms": Leaf,
  "client-bank-comms": Mail,
  "reg-watch-bank": FileWarning,
  "bank-evidence-guard": ShieldCheck,
};

const AGENT_TAGLINE: Record<string, string> = {
  "reg-bank-comms":
    "Résultats financiers, gouvernance, notices supervision. Bloque chiffres non validés, info privilégiée non publique, termes absolus.",
  "bank-crisis-comms":
    "Cyber, fuite, rumeur liquidité, sanction, outage. Holding statement obligatoire, cause racine interdite tant que non confirmée, SLA par sévérité.",
  "esg-bank-comms":
    "SFDR, taxonomie, Green Claims Directive. Matche claim library, vérifie preuve ACTIVE, rend verdict juridiction FR/EU.",
  "client-bank-comms":
    "Hausse tarifs, fermeture agence, incident, alerte fraude. Mentions légales obligatoires, limite de canal, ton non promotionnel, Flesch FR par segment.",
};

export default function BankCommsPage() {
  const publicAgents = getPublicAgents();
  const services = getTransverseServices();

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0A1628] text-white">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5 px-6 pb-14 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent" />
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-violet-500/15 blur-[120px]" />

        <div className="relative mx-auto max-w-[1280px]">
          <Link
            href="/secteurs"
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Tous les secteurs
          </Link>

          <div className="flex flex-wrap items-start gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-violet-400/30 bg-violet-400/10">
              <Building2 className="h-7 w-7 text-violet-200" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                  4 agents en démo live
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-mono text-white/60">
                  FR · UE
                </span>
              </div>
              <h1 className="mt-3 font-display text-5xl font-extrabold tracking-[-0.04em] md:text-6xl">
                Banque <span className="text-white/40">/</span> Communication
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/70">
                Communications bancaires régulées, crise, ESG, clients sensibles.
                16 gates déterministes exécutées côté serveur avant tout appel
                LLM. Pack défendable signé SHA-256 à chaque run.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-4">
            {[
              { k: "4", l: "agents publics" },
              { k: "16", l: "gates serveur" },
              { k: "19", l: "scénarios testset" },
              { k: `${BANK_COMMS_SOURCES.length}`, l: "sources ACTIVE" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="font-display text-4xl font-bold text-white">{s.k}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-white/50">
                  {s.l}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/secteurs/banque/communication/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
            >
              <Gauge className="h-4 w-4" />
              Dashboard opérationnel
            </Link>
            <Link
              href="/secteurs/banque/communication/inbox"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <Inbox className="h-4 w-4" />
              Inbox HITL
            </Link>
          </div>
        </div>
      </section>

      {/* MODÈLE TARIFAIRE */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
                Modèle pilote
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Pas de forfait public. Pilote privé cadré.
              </h2>
              <p className="mt-4 text-white/65">
                Chaque déploiement banque s&apos;exécute en tenant isolé : Postgres
                dédié, SSO, journalisation restreinte, coordination directe
                avec DirCom, Juridique et Compliance. Les chiffres
                ci-dessous sont indicatifs — un scope précis émerge du
                premier atelier.
              </p>
              <Link
                href="/contact?subject=Banque%20/%20Communication%20-%20pilote"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-white/90"
              >
                Cadrer un pilote
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3">
              {[
                { l: "Setup pilote", v: "25 – 60 k€" },
                { l: "Wedge opérationnel", v: "3 – 8 k€/mois" },
                { l: "Domaine complet", v: "80 – 180 k€/an" },
                { l: "Groupe multi-pays", v: "200 – 600 k€/an" },
              ].map((r) => (
                <div
                  key={r.l}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <span className="text-sm text-white/70">{r.l}</span>
                  <span className="font-mono text-sm font-semibold text-white">
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DÉMO AG-B001 */}
      <section className="border-b border-white/5 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Démo live — AG-B001"
            title="RegBankComms."
            lead="Vérifier un communiqué de résultats, une annonce de gouvernance ou une notice de supervision. Gates : info privilégiée, chiffres validated, sources ACTIVE, termes restreints."
          />
          <div className="mt-8">
            <RegBankCommsLive />
          </div>
        </div>
      </section>

      {/* DÉMO AG-B002 */}
      <section className="border-b border-white/5 bg-rose-500/[0.03] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Démo live — AG-B002"
            title="BankCrisisComms."
            lead="Assembler un message de crise en quelques minutes sans sortir du protocole. Cause racine bloquée tant que non confirmée, message issu de la bibliothèque approuvée, SLA par sévérité."
          />
          <div className="mt-8">
            <BankCrisisLive />
          </div>
        </div>
      </section>

      {/* DÉMO AG-B003 */}
      <section className="border-b border-white/5 bg-emerald-500/[0.03] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Démo live — AG-B003"
            title="ESGBankComms."
            lead="Anti-greenwashing. Claim library 10 patterns, preuves avec expiry, matrice juridiction FR/EU, reformulation qualifiée sourcée."
          />
          <div className="mt-8">
            <EsgBankCommsLive />
          </div>
        </div>
      </section>

      {/* DÉMO AG-B004 */}
      <section className="border-b border-white/5 bg-blue-500/[0.03] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Démo live — AG-B004"
            title="ClientBankComms."
            lead="Hausse tarifs, fermeture agence, incident, fraude. Mentions légales obligatoires selon use case, char_limit du canal, ton non-promotionnel, lisibilité Flesch FR par segment."
          />
          <div className="mt-8">
            <ClientBankCommsLive />
          </div>
        </div>
      </section>

      {/* SOURCES */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Registre fermé"
            title={`${BANK_COMMS_SOURCES.length} sources réglementaires.`}
            lead="Aucune sortie agent n'est acceptée sans un mapping vers une de ces sources. Review toutes les 90 à 365 jours selon criticité (policy FRESH-STRICT / STANDARD / CLIENT)."
          />
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Autorité</th>
                  <th className="px-4 py-3 font-semibold">Titre</th>
                  <th className="px-4 py-3 font-semibold">Juri.</th>
                  <th className="px-4 py-3 font-semibold">Review</th>
                </tr>
              </thead>
              <tbody>
                {BANK_COMMS_SOURCES.map((s) => (
                  <tr key={s.source_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-xs text-white/50">
                      {s.source_id}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {s.autorite}
                    </td>
                    <td className="px-4 py-3 text-white/70">{s.titre}</td>
                    <td className="px-4 py-3 text-white/60">{s.juridiction}</td>
                    <td className="px-4 py-3 text-xs text-white/50">
                      {s.review_date ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Les 4 agents publics"
            title="Scope explicite par agent."
            lead="Chaque agent a 4 gates serveur propres. Le LLM ne peut jamais contredire la décision déterministe : il enrichit la reformulation et le commentaire reviewer, rien d'autre."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {publicAgents.map((a) => {
              const Icon = AGENT_ICON[a.slug] ?? Landmark;
              return (
                <Link
                  key={a.agent_id}
                  href={`/agents/${a.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                        <Icon className="h-5 w-5 text-violet-200" />
                      </div>
                      <div>
                        <p className="font-mono text-[11px] text-white/50">
                          {a.agent_id}
                        </p>
                        <h3 className="text-lg font-semibold text-white">
                          {a.name}
                        </h3>
                      </div>
                    </div>
                    <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                      {a.status === "demo" ? "Démo" : a.priority}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-white/65">
                    {AGENT_TAGLINE[a.slug] ?? a.owner}
                  </p>
                  <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-200 opacity-0 transition-opacity group-hover:opacity-100">
                    Ouvrir la fiche agent <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* SERVICES TRANSVERSES */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="2 services transverses"
            title="Consommés par les 4 agents."
            lead="RegWatchBank alimente la veille réglementaire. BankEvidenceGuard résout les sources admissibles avant génération — résolveur 100 % déterministe, sans LLM."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {services.map((s) => {
              const Icon = AGENT_ICON[s.slug] ?? ShieldCheck;
              return (
                <Link
                  key={s.agent_id}
                  href={`/agents/${s.slug}`}
                  className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 transition-colors hover:border-white/30 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Icon className="h-5 w-5 text-white/70" />
                    </div>
                    <div>
                      <p className="font-mono text-[11px] text-white/50">
                        {s.agent_id} · service
                      </p>
                      <h3 className="text-lg font-semibold text-white">{s.name}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-white/60">Owner : {s.owner}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* WORKFLOW + GATES + RISQUES */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              Workflow runtime
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Du brief à l&apos;export défendable.
            </h2>
            <ol className="mt-6 space-y-2">
              {BANK_COMMS_WORKFLOW.map((step) => (
                <li
                  key={step.step}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <span className="font-mono text-sm font-semibold text-violet-200">
                    0{step.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {step.stage}
                    </p>
                    <p className="mt-0.5 text-xs text-white/60">
                      {step.owner} — {step.outcome}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
              Gates MVP
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              Calculées serveur, jamais par le LLM.
            </h2>
            <ul className="mt-6 space-y-2">
              {BANK_COMMS_GATES.map((g) => (
                <li
                  key={g.gate_id}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] text-white/50">
                      {g.gate_id}
                    </p>
                    {g.blocking ? (
                      <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-200">
                        bloquant
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/40">info</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-medium text-white">{g.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* RISQUES */}
      <section className="border-b border-white/5 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <Header
            eyebrow="Risques tracés"
            title="Score impact × probabilité."
            lead="Chaque risque métier identifié par le blueprint est listé ici avec sa mitigation active. Mise à jour à chaque sprint."
          />
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Risque</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {BANK_COMMS_RISKS.map((r) => (
                  <tr key={r.risk_id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono text-xs text-white/50">
                      {r.risk_id}
                    </td>
                    <td className="px-4 py-3 text-white">{r.label}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.score >= 12
                            ? "rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs font-semibold text-red-200"
                            : r.score >= 8
                              ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-200"
                              : "rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60"
                        }
                      >
                        {r.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">
                      {r.mitigation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FOOTER CTAs */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-3">
          <Link
            href="/secteurs/luxe/communication"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Voir Luxe / Communication
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Modèle trust-first
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Header({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-white/70">{lead}</p>
    </div>
  );
}
