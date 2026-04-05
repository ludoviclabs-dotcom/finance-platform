'use client';

import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode, { type CustomNodeData } from './CustomNode';
import AnimatedEdge from './AnimatedEdge';
import TalentDetailPanel from './TalentDetailPanel';

// ── Layout constants ──
const COL_W  = 200;   // colonne de base
const ROW_H  = 185;   // espace vertical entre rangées
const START_X = 40;
const DIAGRAM_W = COL_W * 5;  // 5 colonnes = ~1000px

function buildNodes(): Node<CustomNodeData>[] {

  // ──────────────────────────────────────────────────
  // ROW 1 — 6 inputs répartis sur toute la largeur
  // ──────────────────────────────────────────────────
  const row1Y = 0;
  const inputSpacing = (DIAGRAM_W - 160) / 5;   // 5 intervalles pour 6 blocs

  const inputs: Node<CustomNodeData>[] = [
    {
      id: 'SRC_ATS', type: 'custom',
      position: { x: START_X, y: row1Y },
      data: {
        label: 'Talent Pipeline',
        subtitle: 'Candidatures, pipeline\nSourcing artisans rares',
        icon: 'users', accent: '#34D399', animDelay: 0,
      },
    },
    {
      id: 'SRC_ROLES', type: 'custom',
      position: { x: START_X + inputSpacing, y: row1Y },
      data: {
        label: 'Maison Roles Atlas',
        subtitle: 'Métiers rares, compétences\nCriticité & rareté',
        icon: 'shield-check', accent: '#34D399', animDelay: 0.1,
      },
    },
    {
      id: 'SRC_COMP', type: 'custom',
      position: { x: START_X + inputSpacing * 2, y: row1Y },
      data: {
        label: 'Compensation Intelligence',
        subtitle: 'Salaires, bonus\nBenchmark secteur',
        icon: 'coins', accent: '#60A5FA', animDelay: 0.2,
      },
    },
    {
      id: 'SRC_PERF', type: 'custom',
      position: { x: START_X + inputSpacing * 3, y: row1Y },
      data: {
        label: 'Performance & Reviews',
        subtitle: 'Évaluations, potentiel\nManager feedback',
        icon: 'bar-chart', accent: '#FBBF24', animDelay: 0.3,
      },
    },
    {
      id: 'SRC_MOB', type: 'custom',
      position: { x: START_X + inputSpacing * 4, y: row1Y },
      data: {
        label: 'Mobility & Expat Rules',
        subtitle: 'Mobilité, packages\nContraintes pays',
        icon: 'globe', accent: '#60A5FA', animDelay: 0.4,
      },
    },
    {
      id: 'SRC_CULTURE', type: 'custom',
      position: { x: START_X + inputSpacing * 5, y: row1Y },
      data: {
        label: 'House Culture Framework',
        subtitle: 'Valeurs, rituels\nOnboarding culturel',
        icon: 'sparkles', accent: '#A78BFA', animDelay: 0.5,
      },
    },
  ];

  // ──────────────────────────────────────────────────
  // ROW 2 — 3 agents (triangle : gauche, droite, centre-bas)
  //   Artisan Talent (gauche)  |  Comp & Benchmark (droite)
  //              Onboarding Luxe (centre, légèrement en dessous)
  // ──────────────────────────────────────────────────
  const agentCenterX = START_X + DIAGRAM_W / 2 - 130; // centre approximatif

  const row2Y = ROW_H;
  const row2bY = ROW_H * 1.75;   // Onboarding légèrement plus bas pour créer triangle

  const agents: Node<CustomNodeData>[] = [
    // Artisan Talent — milieu gauche
    {
      id: 'TALENT', type: 'custom',
      position: { x: START_X + 30, y: row2Y },
      data: {
        label: 'Artisan Talent',
        subtitle: 'Skill Mapping · Succession\nCritical Roles · Gap Analysis\n38 métiers · 12 postes sensibles',
        icon: 'users', accent: '#34D399', badge: 'GPEC', badgeColor: '#34D399',
        prominent: true, animDelay: 0.65,
      },
    },
    // Comp & Benchmark — milieu droite
    {
      id: 'COMP', type: 'custom',
      position: { x: START_X + DIAGRAM_W - 250, y: row2Y },
      data: {
        label: 'Comp & Benchmark',
        subtitle: 'Benchmark · Equity · Package Sim\n4 329 k€ masse salariale\n0.95 compa-ratio médian',
        icon: 'coins', accent: '#60A5FA', badge: 'COMP', badgeColor: '#60A5FA',
        prominent: true, animDelay: 0.8,
      },
    },
    // Onboarding Luxe — centre en dessous
    {
      id: 'ONBOARD', type: 'custom',
      position: { x: agentCenterX, y: row2bY },
      data: {
        label: 'Onboarding Luxe',
        subtitle: 'Integration · Culture · 90-Day Path\n90 jours suivis · 7 critères\n15+ maisons configurées',
        icon: 'sparkles', accent: '#A78BFA', badge: 'ONBOARD', badgeColor: '#A78BFA',
        prominent: true, animDelay: 0.95,
      },
    },
  ];

  // ──────────────────────────────────────────────────
  // ROW 3 — Orchestrateur central (Maison Talent Core)
  // ──────────────────────────────────────────────────
  const row3Y = ROW_H * 3;
  const orchestrateur: Node<CustomNodeData>[] = [
    {
      id: 'ORCHESTRATOR', type: 'custom',
      position: { x: agentCenterX - 20, y: row3Y },
      data: {
        label: 'Maison Talent Core',
        subtitle: 'Fusion intelligente des signaux RH\nPriorisation · Recommandation salariale\nScénario intégration · Arbitrage multi-critères',
        icon: 'layers', accent: '#A78BFA', badge: 'CORE', badgeColor: '#A78BFA',
        prominent: true, pulsing: true, animDelay: 1.15,
      },
    },
  ];

  // ──────────────────────────────────────────────────
  // ROW 4 — 5 outputs
  // ──────────────────────────────────────────────────
  const row4Y = ROW_H * 4.25;
  const outputSpacing = (DIAGRAM_W - 120) / 4;

  const outputs: Node<CustomNodeData>[] = [
    {
      id: 'OUT_SUCCESSION', type: 'custom',
      position: { x: START_X, y: row4Y },
      data: {
        label: 'Succession Plan',
        subtitle: 'Viviers · Relève\nCriticité · Continuité',
        icon: 'users', accent: '#34D399', badge: 'PLAN', animDelay: 1.35,
      },
    },
    {
      id: 'OUT_PACKAGE', type: 'custom',
      position: { x: START_X + outputSpacing, y: row4Y },
      data: {
        label: 'Offer & Package Sim',
        subtitle: 'Salaire · Variable\nMobilité · Cohérence marché',
        icon: 'coins', accent: '#60A5FA', badge: 'SIM', badgeColor: '#60A5FA', animDelay: 1.5,
      },
    },
    {
      id: 'OUT_JOURNEY', type: 'custom',
      position: { x: START_X + outputSpacing * 2, y: row4Y },
      data: {
        label: 'Onboarding Journey',
        subtitle: 'Roadmap 30/60/90\nIntégration premium',
        icon: 'sparkles', accent: '#A78BFA', badge: 'JOURNEY', badgeColor: '#A78BFA', animDelay: 1.65,
      },
    },
    {
      id: 'OUT_RISK', type: 'custom',
      position: { x: START_X + outputSpacing * 3, y: row4Y },
      data: {
        label: 'Talent Risk Dashboard',
        subtitle: 'Risque départ · Tensions\nFragilité des rôles',
        icon: 'shield-check', accent: '#FBBF24', badge: 'RISK', badgeColor: '#FBBF24', animDelay: 1.8,
      },
    },
    {
      id: 'OUT_REPORT', type: 'custom',
      position: { x: START_X + outputSpacing * 4, y: row4Y },
      data: {
        label: 'HR Executive Report',
        subtitle: 'Synthèse DRH\nDécisionnel direction',
        icon: 'file-text', accent: '#F472B6', badge: 'REPORT', badgeColor: '#F472B6', animDelay: 1.95,
      },
    },
  ];

  return [...inputs, ...agents, ...orchestrateur, ...outputs];
}

function buildEdges(): Edge[] {
  const green  = { color: 'rgba(52, 211, 153, 0.45)' };
  const blue   = { color: 'rgba(96, 165, 250, 0.45)' };
  const violet = { color: 'rgba(167, 139, 250, 0.45)' };
  const yellow = { color: 'rgba(251, 191, 36, 0.45)' };
  const pink   = { color: 'rgba(244, 114, 182, 0.45)' };

  const greenGlow  = { color: 'rgba(52, 211, 153, 0.7)',  glowing: true };
  const blueGlow   = { color: 'rgba(96, 165, 250, 0.7)',  glowing: true };
  const violetGlow = { color: 'rgba(167, 139, 250, 0.7)', glowing: true };

  return [
    // ── Inputs → Artisan Talent (vert)
    { id: 'e-ATS-TALENT',   source: 'SRC_ATS',     target: 'TALENT',       type: 'animated', data: green },
    { id: 'e-ROLES-TALENT', source: 'SRC_ROLES',   target: 'TALENT',       type: 'animated', data: green },
    { id: 'e-PERF-TALENT',  source: 'SRC_PERF',    target: 'TALENT',       type: 'animated', data: yellow },

    // ── Inputs → Comp & Benchmark (bleu)
    { id: 'e-COMP-COMP',    source: 'SRC_COMP',    target: 'COMP',         type: 'animated', data: blue },
    { id: 'e-MOB-COMP',     source: 'SRC_MOB',     target: 'COMP',         type: 'animated', data: blue },
    { id: 'e-PERF-COMP',    source: 'SRC_PERF',    target: 'COMP',         type: 'animated', data: yellow },

    // ── Inputs → Onboarding Luxe (violet)
    { id: 'e-CULTURE-ONBOARD', source: 'SRC_CULTURE', target: 'ONBOARD',   type: 'animated', data: violet },
    { id: 'e-ATS-ONBOARD',     source: 'SRC_ATS',     target: 'ONBOARD',   type: 'animated', data: green },
    { id: 'e-PERF-ONBOARD',    source: 'SRC_PERF',    target: 'ONBOARD',   type: 'animated', data: yellow },

    // ── Agents → Maison Talent Core
    { id: 'e-TALENT-ORCH',  source: 'TALENT',       target: 'ORCHESTRATOR', type: 'animated', data: greenGlow,  label: 'Talent signals' },
    { id: 'e-COMP-ORCH',    source: 'COMP',         target: 'ORCHESTRATOR', type: 'animated', data: blueGlow,   label: 'Comp data' },
    { id: 'e-ONBOARD-ORCH', source: 'ONBOARD',      target: 'ORCHESTRATOR', type: 'animated', data: violetGlow, label: 'Integration data' },

    // ── Maison Talent Core → Outputs
    { id: 'e-ORCH-SUCC',    source: 'ORCHESTRATOR', target: 'OUT_SUCCESSION', type: 'animated', data: greenGlow },
    { id: 'e-ORCH-PKG',     source: 'ORCHESTRATOR', target: 'OUT_PACKAGE',    type: 'animated', data: blueGlow },
    { id: 'e-ORCH-JOURNEY', source: 'ORCHESTRATOR', target: 'OUT_JOURNEY',    type: 'animated', data: violetGlow },
    { id: 'e-ORCH-RISK',    source: 'ORCHESTRATOR', target: 'OUT_RISK',       type: 'animated', data: yellow },
    { id: 'e-ORCH-REPORT',  source: 'ORCHESTRATOR', target: 'OUT_REPORT',     type: 'animated', data: pink },
  ];
}

const nodeTypes: NodeTypes = { custom: CustomNode };
const edgeTypes: EdgeTypes = { animated: AnimatedEdge };

function DiagramInner() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const nodes = useMemo(() => buildNodes(), []);
  const edges = useMemo(() => buildEdges(), []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  return (
    <div className="w-full">
      {/* ── Header ── */}
      <div className="text-center mb-6">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: '#34D399' }}
        >
          Architecture RH
        </span>
        <h2 className="mt-2 font-display font-extrabold text-3xl md:text-4xl tracking-tight text-white">
          Neural Talent Hub — Secteur Luxe
        </h2>
        <p className="mt-2 text-sm" style={{ color: '#94A3B8' }}>
          3 agents RH interconnectés : Talent Mapping — Compensation — Onboarding
        </p>
        {/* Legend */}
        <div
          className="mt-4 flex flex-wrap items-center justify-center gap-5 text-[11px]"
          style={{ color: '#94A3B8' }}
        >
          {[
            { color: '#34D399', label: 'Succession | Métiers rares' },
            { color: '#60A5FA', label: 'Équité salariale | Mobilité internationale' },
            { color: '#A78BFA', label: 'Culture maison | Intégration' },
            { color: '#FBBF24', label: 'Performance | Risque talent' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-2">
              <span className="w-3 h-0.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Diagram ── */}
      <div
        className="w-full rounded-2xl border overflow-hidden"
        style={{
          height: 920,
          background: '#0A1628',
          borderColor: 'rgba(52, 211, 153, 0.12)',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.35}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background color="#1E3050" gap={20} size={1} />
          <Controls
            position="bottom-left"
            style={{
              background: 'rgba(17, 29, 53, 0.9)',
              border: 'none',
              borderRadius: 8,
            }}
          />
          <MiniMap
            position="bottom-right"
            nodeColor={(n) => {
              const accent = (n.data as CustomNodeData)?.accent;
              return accent || '#34D399';
            }}
            maskColor="rgba(10, 22, 40, 0.85)"
            style={{
              background: '#111D35',
              borderRadius: 8,
              border: '1px solid rgba(52, 211, 153, 0.15)',
            }}
            className="hidden lg:block"
          />
        </ReactFlow>
      </div>

      {/* ── Footer stats ── */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
        {[
          { icon: '🎨', text: '30+ métiers artisanaux' },
          { icon: '🌍', text: '7 pays couverts' },
          { icon: '💼', text: '3 agents RH interconnectés' },
          { icon: '🏛️', text: '15+ maisons configurées' },
          { icon: '⚡', text: 'Temps réel' },
        ].map((stat) => (
          <span
            key={stat.text}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
            style={{
              background: 'rgba(17, 29, 53, 0.6)',
              border: '1px solid rgba(52, 211, 153, 0.15)',
              color: '#B0BEC5',
            }}
          >
            <span>{stat.icon}</span>
            {stat.text}
          </span>
        ))}
      </div>

      {/* ── Detail panel ── */}
      <TalentDetailPanel
        nodeId={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  );
}

export default function TalentWorkflowDiagram() {
  return (
    <ReactFlowProvider>
      <DiagramInner />
    </ReactFlowProvider>
  );
}
