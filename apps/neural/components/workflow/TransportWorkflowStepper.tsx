'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Agent & Gate metadata ── */

const AGENTS: Record<string, { label: string; color: string; bg: string }> = {
  fleet:  { label: 'FleetAccounting',       color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  tva:    { label: 'TVATransport',          color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' },
  conc:   { label: 'ConcessionAccounting',  color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  orch:   { label: 'Orchestrateur',         color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  hitl:   { label: 'Human-in-the-loop',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

const GATE_META: Record<string, { label: string; color: string; bg: string }> = {
  auto:     { label: 'Automatique',     color: '#4ADE80', bg: 'rgba(74,222,128,0.12)' },
  review:   { label: 'Si seuil franchi', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  required: { label: 'Obligatoire',     color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
};

/* ── Steps data ── */

interface Flux { id: string; l: string }

interface Step {
  id: string;
  title: string;
  agent: string;
  gate: string;
  conf: number | null;
  dur: string;
  desc: string;
  inputs: string[];
  outputs: string[];
  flux: Flux[];
}

const STEPS: Step[] = [
  { id: 'E01', title: 'Déclenchement', agent: 'orch', gate: 'auto', conf: 0.99, dur: '2 min',
    desc: "L'orchestrateur lance la séquence de clôture. Il vérifie que toutes les données du mois sont présentes : factures transport, télématique véhicules, événements comptables.",
    inputs: ['Cron mensuel (1er jour ouvré M+1)', 'ou déclenchement manuel DAF'],
    outputs: ['Signal GO aux 3 agents', 'Contexte de clôture initialisé'], flux: [] },
  { id: 'E02', title: 'Fleet — Amortissements', agent: 'fleet', gate: 'review', conf: 0.94, dur: '8-15 min',
    desc: "FleetAccounting calcule les dotations d'amortissement du mois pour chaque véhicule, met à jour les VNC, et détecte les fins de durée de vie.",
    inputs: ['Fichier immobilisations (80 véhicules)', 'Télématique : km/heures du mois'],
    outputs: ['Plan amortissement actualisé', 'Alertes renouvellement', 'VNC au 31/03/2026'],
    flux: [{ id: 'F09', l: 'Fleet → Concession (données télématiques)' }] },
  { id: 'E03', title: 'Fleet — Cessions', agent: 'fleet', gate: 'review', conf: 0.91, dur: '3-5 min',
    desc: "Traitement des véhicules cédés ou mis au rebut : calcul PV/MV, sortie du registre IAS 16, puis déclenchement automatique du flux F01 vers TVATransport.",
    inputs: ['Événements cession détectés', 'VNC du véhicule (calculée en E02)'],
    outputs: ['Écritures de cession', 'Notification F01 → TVATransport'],
    flux: [{ id: 'F01', l: 'Fleet → TVA (cession véhicule)' }, { id: 'F02', l: 'TVA → Fleet (qualification TVA)' }] },
  { id: 'E04', title: 'TVA — Opérations courantes', agent: 'tva', gate: 'review', conf: 0.92, dur: '10-20 min',
    desc: "TVATransport qualifie la TVA de toutes les factures transport du mois. Pré-remplit la déclaration CA3 avec les 21 cas du référentiel.",
    inputs: ['Factures entrantes/sortantes du mois', 'Référentiel TVA transport (21 cas)', 'Sources RAG : CGI art. 259A, 262-I'],
    outputs: ['CA3 draft pré-remplie', 'Écritures TVA collectée/déductible'],
    flux: [{ id: 'F03', l: 'TVA → Fleet (plafonds fiscaux VP)' }, { id: 'F05', l: 'Fleet → TVA (données TICPE)' }] },
  { id: 'E05', title: 'TVA — Cessions (F02)', agent: 'tva', gate: 'auto', conf: 0.96, dur: '2-5 min',
    desc: "Réception des cessions de Fleet, qualification TVA sur les plus-values (20% sur bien meuble corporel, ou exonération si VP plafonnée).",
    inputs: ['Notification F01 de FleetAccounting', 'Type véhicule, prix cession, VNC'],
    outputs: ['CA3 complétée avec cessions', 'Qualification TVA via F02'],
    flux: [{ id: 'F02', l: 'TVA → Fleet (retour qualification)' }] },
  { id: 'E06', title: 'Concession — Amort. & intérêts', agent: 'conc', gate: 'review', conf: 0.88, dur: '5-12 min',
    desc: "ConcessionAccounting amortit l'actif incorporel, calcule les intérêts sur la créance financière, et actualise les provisions gros entretien.",
    inputs: ['Contrats concession (tramway T3)', 'Barèmes composants de Fleet (F07)', 'Télématique UO (F09)'],
    outputs: ['Écritures IFRIC 12 du mois', 'Tableau amortissement créance actualisé'],
    flux: [{ id: 'F06', l: 'Conc. → Fleet (exclure IAS 16)' }, { id: 'F07', l: 'Fleet → Conc. (barèmes composants)' }, { id: 'F10', l: 'Conc. → TVA (revenu construction)' }] },
  { id: 'E07', title: 'Concession — Provisions', agent: 'conc', gate: 'review', conf: 0.85, dur: '3-8 min',
    desc: "Mise à jour des provisions pour gros entretien et remise en état. Dotation ou reprise selon l'avancement et le taux OAT.",
    inputs: ['Plan gros entretien', 'Taux OAT 10 ans (3.8%)', 'Dépenses réelles du mois'],
    outputs: ['Provisions actualisées', 'Écritures dotation/reprise'],
    flux: [{ id: 'F11', l: 'Conc. → TVA (subventions concédant)' }] },
  { id: 'E08', title: 'Réconciliation automatique', agent: 'orch', gate: 'required', conf: 0.97, dur: '3-5 min',
    desc: "L'orchestrateur compare les outputs des 3 agents : total actifs IAS 16 + IFRIC 12 = bilan, TVA cohérente avec CA, zéro doublons.",
    inputs: ['Outputs Fleet (VNC totale)', 'Outputs TVA (CA3 draft)', 'Outputs Concession (IFRIC 12)'],
    outputs: ['Rapport de réconciliation', 'Liste des écarts détectés', 'Score cohérence global'],
    flux: [{ id: 'F14', l: 'Réconciliation croisée interne' }] },
  { id: 'E09', title: 'Validation DAF (HITL)', agent: 'hitl', gate: 'required', conf: null, dur: '15-45 min',
    desc: "Le DAF reçoit le dashboard consolidé : rapport de réconciliation, escalades des 3 agents, file HITL priorisée. Il valide, corrige, ou escalade.",
    inputs: ['Rapport réconciliation (E08)', 'Escalades agents (score < seuil)', 'File HITL priorisée'],
    outputs: ['Validation signée', 'Corrections (feedback → RAG)', 'Décision finale'],
    flux: [{ id: 'F15', l: 'Orch. → DAF (rapport + escalades)' }] },
  { id: 'E10', title: 'Export ERP', agent: 'orch', gate: 'auto', conf: 0.99, dur: '2 min',
    desc: "Génération du fichier d'écritures OD consolidé (Fleet + TVA + Concession) et export vers l'ERP (SAP FI, Sage, Cegid).",
    inputs: ['Écritures validées par DAF', 'Format ERP cible'],
    outputs: ["42 écritures OD dans l'ERP", 'Confirmation export'],
    flux: [{ id: 'F16', l: 'Orch. → ERP (écritures consolidées)' }] },
  { id: 'E11', title: 'Archivage & audit trail', agent: 'orch', gate: 'auto', conf: 0.99, dur: '1 min',
    desc: "Archivage du cycle complet : inputs, outputs, scores, décisions HITL, rapport de réconciliation. Prêt pour le CAC.",
    inputs: ['Tous outputs E01-E10', 'Logs agents', 'Décisions HITL'],
    outputs: ['Dossier de clôture complet', 'Audit trail immutable'],
    flux: [] },
];

/* ── Sub-components ── */

function AgentTag({ agent }: { agent: string }) {
  const a = AGENTS[agent];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold"
      style={{ background: a.bg, color: a.color }}
    >
      {a.label}
    </span>
  );
}

function GateBadge({ gate }: { gate: string }) {
  const g = GATE_META[gate];
  return (
    <span
      className="inline-block rounded-lg px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: g.bg, color: g.color }}
    >
      {g.label}
    </span>
  );
}

function ConfBar({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs font-semibold text-amber-400">Décision humaine</span>;
  }
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? '#4ADE80' : value >= 0.65 ? '#FBBF24' : '#F87171';
  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 140 }}>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-sm font-bold tabular-nums" style={{ color, minWidth: 36, textAlign: 'right' }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

/* ── Main component ── */

export default function TransportWorkflowStepper() {
  const [cur, setCur] = useState(0);
  const [vis, setVis] = useState<Set<number>>(new Set([0]));
  const cardRef = useRef<HTMLDivElement>(null);
  const s = STEPS[cur];

  useEffect(() => {
    setVis(p => new Set([...p, cur]));
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [cur]);

  const go = (d: number) =>
    setCur(c => {
      const n = c + d;
      return n < 0 ? STEPS.length - 1 : n >= STEPS.length ? 0 : n;
    });

  const agentMeta = AGENTS[s.agent];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-[0.15em]">
          Workflow de clôture
        </span>
        <h2 className="mt-3 font-display font-extrabold text-2xl md:text-3xl tracking-tight text-[var(--color-foreground)]">
          Séquence orchestrée — 11 étapes
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
          De la collecte des données à l&apos;export ERP, chaque agent intervient dans un ordre précis.
          Cliquez sur une étape pour voir ses flux, scores de confiance et gates HITL.
        </p>
      </div>

      {/* Step pills */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {STEPS.map((st, i) => {
          const done = vis.has(i) && i !== cur;
          const act = i === cur;
          const ag = AGENTS[st.agent];
          return (
            <button
              key={st.id}
              onClick={() => setCur(i)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
              style={{
                border: act
                  ? `1.5px solid ${ag.color}`
                  : '1px solid rgba(255,255,255,0.08)',
                background: act ? ag.bg : done ? 'rgba(74,222,128,0.08)' : 'transparent',
                color: act ? ag.color : done ? '#4ADE80' : 'rgba(255,255,255,0.35)',
              }}
            >
              {done && <span className="mr-1">&#10003;</span>}
              {st.id}
            </button>
          );
        })}
      </div>

      {/* Detail card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id}
          ref={cardRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: 'var(--color-surface)',
            border: `1px solid ${agentMeta.bg}`,
            boxShadow: `0 0 40px ${agentMeta.bg}`,
          }}
        >
          {/* Step header */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <span className="text-sm font-bold" style={{ color: agentMeta.color }}>
              {s.id}
            </span>
            <span className="text-lg font-semibold text-[var(--color-foreground)]">{s.title}</span>
            <AgentTag agent={s.agent} />
          </div>

          <p className="text-sm leading-relaxed mb-5 text-[var(--color-foreground-muted)]">{s.desc}</p>

          {/* Inputs / Outputs grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase mb-1.5 text-[var(--color-foreground-subtle)]">
                Inputs
              </p>
              {s.inputs.map((inp, i) => (
                <div
                  key={i}
                  className="text-xs py-1 px-2.5 mb-0.5 leading-relaxed text-[var(--color-foreground-muted)]"
                  style={{ borderLeft: '2.5px solid rgba(167,139,250,0.5)' }}
                >
                  {inp}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-wider uppercase mb-1.5 text-[var(--color-foreground-subtle)]">
                Outputs
              </p>
              {s.outputs.map((out, i) => (
                <div
                  key={i}
                  className="text-xs py-1 px-2.5 mb-0.5 leading-relaxed text-[var(--color-foreground-muted)]"
                  style={{ borderLeft: '2.5px solid rgba(74,222,128,0.5)' }}
                >
                  {out}
                </div>
              ))}
            </div>
          </div>

          {/* Inter-agent flows */}
          {s.flux.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold tracking-wider uppercase mb-1.5 text-[var(--color-foreground-subtle)]">
                Flux inter-agents
              </p>
              <div className="flex flex-wrap gap-1.5">
                {s.flux.map(f => (
                  <span
                    key={f.id}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--color-foreground-muted)',
                    }}
                  >
                    <strong style={{ color: '#60A5FA' }}>{f.id}</strong> — {f.l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer: duration, gate, confidence */}
          <div
            className="flex gap-6 items-center flex-wrap pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-foreground-subtle)]">Durée</span>
              <span className="text-sm font-bold text-[var(--color-foreground)]">{s.dur}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-foreground-subtle)]">Gate HITL</span>
              <GateBadge gate={s.gate} />
            </div>
            <div className="flex-1 flex items-center gap-2" style={{ minWidth: 140 }}>
              <span className="text-xs text-[var(--color-foreground-subtle)]">Confiance</span>
              <ConfBar value={s.conf} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-3 mt-5 items-center">
        <button
          onClick={() => go(-1)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: 'var(--color-foreground-muted)',
          }}
        >
          &#8592; Précédent
        </button>
        <span className="flex-1 text-center text-xs text-[var(--color-foreground-subtle)]">
          {cur + 1} / {STEPS.length}
        </span>
        <button
          onClick={() => go(1)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
          style={{ border: 'none', background: agentMeta.color, color: '#0a0f1e' }}
        >
          {cur === STEPS.length - 1 ? 'Recommencer' : 'Suivant →'}
        </button>
      </div>

      {/* Bottom KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        {[
          { label: 'Durée totale', value: '50-120 min', sub: 'vs. 2-3 jours manuels' },
          { label: 'Automatiques', value: '70%', sub: 'confiance > 0.85' },
          { label: 'Flux inter-agents', value: '16', sub: 'F01 à F16 orchestrés' },
          { label: 'Formules', value: '327', sub: '0 erreur (4 Excel)' },
        ].map(m => (
          <div
            key={m.label}
            className="rounded-xl p-4 text-center"
            style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-[10px] font-bold tracking-wider uppercase mb-1 text-[var(--color-foreground-subtle)]">
              {m.label}
            </p>
            <p className="text-xl font-bold text-[var(--color-foreground)]">{m.value}</p>
            <p className="text-[10px] text-[var(--color-foreground-subtle)]">{m.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
