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
import LuxeDetailPanel from './LuxeDetailPanel';

// ── Layout ──
const COL_W = 220;
const ROW_H = 180;
const START_X = 60;

function buildNodes(): Node<CustomNodeData>[] {
  // ── Row 1 — Sources de données (4 nodes) ──
  const row1Y = 0;
  const sources: Node<CustomNodeData>[] = [
    {
      id: 'SRC_ERP', type: 'custom', position: { x: START_X, y: row1Y },
      data: {
        label: 'ERP Maison Aurelia',
        subtitle: '7 entités • 6 pays\nSAP S/4HANA',
        icon: 'database', accent: '#A78BFA', animDelay: 0,
      },
    },
    {
      id: 'SRC_FX', type: 'custom', position: { x: START_X + COL_W, y: row1Y },
      data: {
        label: 'Flux & Change',
        subtitle: '7 devises • 12 mois\nEUR/USD/GBP/JPY/CHF/CNY/AED',
        icon: 'coins', accent: '#60A5FA', animDelay: 0.15,
      },
    },
    {
      id: 'SRC_INV', type: 'custom', position: { x: START_X + COL_W * 2, y: row1Y },
      data: {
        label: 'Stocks & Supply',
        subtitle: 'Maroquinerie • Joaillerie\nHorlogerie • Haute Couture',
        icon: 'package', accent: '#34D399', animDelay: 0.3,
      },
    },
    {
      id: 'SRC_JUR', type: 'custom', position: { x: START_X + COL_W * 3, y: row1Y },
      data: {
        label: 'Juridique & Contrats',
        subtitle: 'Périmètre • Licences\nCouvertures IFRS 9',
        icon: 'shield-check', accent: '#FBBF24', animDelay: 0.45,
      },
    },
  ];

  // ── Row 2 — Agent MultiCurrency IAS 21 ──
  const row2Y = ROW_H;
  const multiCurrency: Node<CustomNodeData>[] = [
    {
      id: 'MULTI', type: 'custom', position: { x: START_X + COL_W * 0.5, y: row2Y },
      data: {
        label: 'MultiCurrency IAS 21',
        subtitle: 'Conversion 7 devises → EUR\nÉcarts de conversion OCI\nCouverture IFRS 9 • Impact P&L change',
        icon: 'globe', accent: '#60A5FA', badge: 'IAS 21', badgeColor: '#60A5FA',
        prominent: true, animDelay: 0.65,
      },
    },
  ];

  // ── Row 3 — Agent Inventaire Luxe ──
  const row3Y = ROW_H * 2;
  const inventaire: Node<CustomNodeData>[] = [
    {
      id: 'INVENT', type: 'custom', position: { x: START_X + COL_W * 2, y: row3Y },
      data: {
        label: 'Inventaire Luxe',
        subtitle: 'Valorisation stocks multi-maisons\nTest NRV (IAS 2)\nÉlimination marges intra-groupe',
        icon: 'package', accent: '#34D399', badge: 'IAS 2', badgeColor: '#34D399',
        prominent: true, animDelay: 0.85,
      },
    },
  ];

  // ── Row 4 — Agent Consolidation Groupe ──
  const row4Y = ROW_H * 3;
  const consolidation: Node<CustomNodeData>[] = [
    {
      id: 'CONSO', type: 'custom', position: { x: START_X + COL_W * 1.25, y: row4Y },
      data: {
        label: 'Consolidation Groupe',
        subtitle: 'Goodwill IFRS 3 • Tests IAS 36\nÉliminations interco complètes\nBilan & P&L consolidés • Part groupe/NCI',
        icon: 'layers', accent: '#A78BFA', badge: 'IFRS 10', badgeColor: '#A78BFA',
        prominent: true, pulsing: true, animDelay: 1.05,
      },
    },
  ];

  // ── Row 5 — Outputs ──
  const row5Y = ROW_H * 4;
  const outputs: Node<CustomNodeData>[] = [
    {
      id: 'OUT_REPORT', type: 'custom', position: { x: START_X, y: row5Y },
      data: {
        label: 'Reporting IFRS',
        subtitle: 'Bilan & P&L consolidés\nPiste d\'audit intégrée',
        icon: 'file-text', accent: '#A78BFA', badge: 'AUDIT', animDelay: 1.25,
      },
    },
    {
      id: 'OUT_EXCEL', type: 'custom', position: { x: START_X + COL_W * 1.5, y: row5Y },
      data: {
        label: 'Export Excel & ZIP',
        subtitle: '4 fichiers interconnectés\nPack complet auditeur',
        icon: 'calculator', accent: '#FBBF24', badge: 'EXPORT', badgeColor: '#FBBF24', animDelay: 1.4,
      },
    },
    {
      id: 'OUT_DASH', type: 'custom', position: { x: START_X + COL_W * 3, y: row5Y },
      data: {
        label: 'Dashboard KPIs',
        subtitle: 'CA consolidé • Résultat net\nGoodwill • Stocks • Change',
        icon: 'bar-chart', accent: '#34D399', badge: 'LIVE', badgeColor: '#34D399', animDelay: 1.55,
      },
    },
  ];

  return [...sources, ...multiCurrency, ...inventaire, ...consolidation, ...outputs];
}

function buildEdges(): Edge[] {
  const violet  = { color: 'rgba(167, 139, 250, 0.5)' };
  const blue    = { color: 'rgba(96, 165, 250, 0.5)' };
  const green   = { color: 'rgba(52, 211, 153, 0.5)' };
  const yellow  = { color: 'rgba(251, 191, 36, 0.5)' };
  const violetGlow = { color: 'rgba(167, 139, 250, 0.7)', glowing: true };
  const blueGlow   = { color: 'rgba(96, 165, 250, 0.7)', glowing: true };
  const greenGlow  = { color: 'rgba(52, 211, 153, 0.7)', glowing: true };

  return [
    // Sources → MultiCurrency
    { id: 'e-ERP-MULTI',  source: 'SRC_ERP', target: 'MULTI', type: 'animated', data: violet },
    { id: 'e-FX-MULTI',   source: 'SRC_FX',  target: 'MULTI', type: 'animated', data: blue },
    { id: 'e-JUR-MULTI',  source: 'SRC_JUR', target: 'MULTI', type: 'animated', data: yellow },

    // Sources → Inventaire
    { id: 'e-INV-INVENT', source: 'SRC_INV', target: 'INVENT', type: 'animated', data: green },
    { id: 'e-ERP-INVENT', source: 'SRC_ERP', target: 'INVENT', type: 'animated', data: violet },

    // MultiCurrency → Inventaire (taux de change)
    { id: 'e-MULTI-INVENT', source: 'MULTI', target: 'INVENT', type: 'animated', data: blueGlow, label: 'Taux FX' },

    // MultiCurrency → Consolidation (écarts conversion + impact P&L)
    { id: 'e-MULTI-CONSO', source: 'MULTI', target: 'CONSO', type: 'animated', data: blueGlow, label: 'OCI + P&L FX' },

    // Inventaire → Consolidation (stocks valorisés + marges internes)
    { id: 'e-INVENT-CONSO', source: 'INVENT', target: 'CONSO', type: 'animated', data: greenGlow, label: 'Stocks + marges' },

    // Sources → Consolidation
    { id: 'e-JUR-CONSO', source: 'SRC_JUR', target: 'CONSO', type: 'animated', data: yellow },

    // Consolidation → Outputs
    { id: 'e-CONSO-REPORT', source: 'CONSO', target: 'OUT_REPORT', type: 'animated', data: violetGlow },
    { id: 'e-CONSO-EXCEL',  source: 'CONSO', target: 'OUT_EXCEL',  type: 'animated', data: violetGlow },
    { id: 'e-CONSO-DASH',   source: 'CONSO', target: 'OUT_DASH',   type: 'animated', data: violetGlow },
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
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#A78BFA' }}>
          Architecture
        </span>
        <h2 className="mt-2 font-display font-extrabold text-3xl md:text-4xl tracking-tight text-white">
          Neural Data Hub — Secteur Luxe
        </h2>
        <p className="mt-2 text-sm" style={{ color: '#94A3B8' }}>
          3 agents IFRS interconnectés : MultiCurrency → Inventaire → Consolidation — flux temps réel
        </p>
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-[11px]" style={{ color: '#94A3B8' }}>
          <span className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full" style={{ background: '#A78BFA' }} />
            Consolidation (IFRS 10)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full" style={{ background: '#60A5FA' }} />
            MultiCurrency (IAS 21)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full" style={{ background: '#34D399' }} />
            Inventaire (IAS 2)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full" style={{ background: '#FBBF24' }} />
            Juridique & Export
          </span>
        </div>
      </div>

      {/* Diagram */}
      <div
        className="w-full rounded-2xl border overflow-hidden"
        style={{
          height: 860,
          background: '#0A1628',
          borderColor: 'rgba(167, 139, 250, 0.15)',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background
            color="#1E3050"
            gap={20}
            size={1}
          />
          <Controls
            position="bottom-left"
            style={{ background: 'rgba(17, 29, 53, 0.9)', border: 'none', borderRadius: 8 }}
          />
          <MiniMap
            position="bottom-right"
            nodeColor={() => '#A78BFA'}
            maskColor="rgba(10, 22, 40, 0.85)"
            style={{ background: '#111D35', borderRadius: 8, border: '1px solid rgba(167, 139, 250, 0.2)' }}
            className="hidden lg:block"
          />
        </ReactFlow>
      </div>

      {/* Footer stats */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
        {[
          { icon: '👜', text: '7 entités • 6 pays' },
          { icon: '💱', text: '7 devises synchronisées' },
          { icon: '📊', text: '8 normes IFRS couvertes' },
          { icon: '⚡', text: '3 agents interconnectés' },
        ].map((stat) => (
          <span
            key={stat.text}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
            style={{
              background: 'rgba(17, 29, 53, 0.6)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
              color: '#B0BEC5',
            }}
          >
            <span>{stat.icon}</span>
            {stat.text}
          </span>
        ))}
      </div>

      {/* Detail panel */}
      <LuxeDetailPanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

export default function LuxeWorkflowDiagram() {
  return (
    <ReactFlowProvider>
      <DiagramInner />
    </ReactFlowProvider>
  );
}
