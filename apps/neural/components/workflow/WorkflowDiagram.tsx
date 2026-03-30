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
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode, { type CustomNodeData } from './CustomNode';
import AnimatedEdge from './AnimatedEdge';
import DetailPanel from './DetailPanel';

// ── Node positions ──
const COL_W = 200;
const ROW_H = 160;
const START_X = 80;

function buildNodes(): Node<CustomNodeData>[] {
  // Row 1 — Sources (5 nodes)
  const row1Y = 0;
  const sources: Node<CustomNodeData>[] = [
    {
      id: 'S1', type: 'custom', position: { x: START_X, y: row1Y },
      data: { label: 'ERP / SAP', subtitle: 'Connecteur API natif', icon: 'database', accent: '#3498DB', animDelay: 0 },
    },
    {
      id: 'S2', type: 'custom', position: { x: START_X + COL_W, y: row1Y },
      data: { label: 'SIRH', subtitle: 'Données sociales S1-S4', icon: 'users', accent: '#3498DB', animDelay: 0.15 },
    },
    {
      id: 'S3', type: 'custom', position: { x: START_X + COL_W * 2, y: row1Y },
      data: { label: 'Comptabilité', subtitle: 'Données financières', icon: 'calculator', accent: '#3498DB', animDelay: 0.3 },
    },
    {
      id: 'S4', type: 'custom', position: { x: START_X + COL_W * 3, y: row1Y },
      data: { label: 'Achats / Supply', subtitle: 'Scope 3 fournisseurs', icon: 'package', accent: '#3498DB', animDelay: 0.45 },
    },
    {
      id: 'S5', type: 'custom', position: { x: START_X + COL_W * 4, y: row1Y },
      data: { label: 'Documents', subtitle: 'OCR + LLM extraction', icon: 'file', accent: '#E67E22', animDelay: 0.6 },
    },
  ];

  // Row 2 — Collecte (1 centered wide node)
  const row2Y = ROW_H;
  const collecte: Node<CustomNodeData>[] = [
    {
      id: 'C1', type: 'custom', position: { x: START_X + COL_W * 1.5, y: row2Y },
      data: {
        label: 'Collecte & Structuration',
        subtitle: 'Score qualité • Audit Trail automatique • Déduplication',
        icon: 'layers', accent: '#2ECC71', badge: 'AUTO', prominent: true, animDelay: 0.8,
      },
    },
  ];

  // Row 3 — Processing (3 nodes)
  const row3Y = ROW_H * 2;
  const processing: Node<CustomNodeData>[] = [
    {
      id: 'P1', type: 'custom', position: { x: START_X + COL_W * 0.5, y: row3Y },
      data: {
        label: 'Conformité ESRS', subtitle: '12 normes E1-E5, S1-S4, G1\nMapping Omnibus + VSME',
        icon: 'shield-check', accent: '#2ECC71', badge: 'NATIF', animDelay: 1.0,
      },
    },
    {
      id: 'P2', type: 'custom', position: { x: START_X + COL_W * 2, y: row3Y },
      data: {
        label: 'Bilan Carbone', subtitle: 'Scopes 1, 2, 3\nBase ADEME • Ecoinvent',
        icon: 'leaf', accent: '#2ECC71', badge: 'AUTO', animDelay: 1.15,
      },
    },
    {
      id: 'P3', type: 'custom', position: { x: START_X + COL_W * 3.5, y: row3Y },
      data: {
        label: 'Taxonomie & CBAM', subtitle: '6 objectifs EU\nCertificats CBAM',
        icon: 'globe', accent: '#3498DB', badge: 'CONFORME', animDelay: 1.3,
      },
    },
  ];

  // Row 4 — AI Engine
  const row4Y = ROW_H * 3;
  const ai: Node<CustomNodeData>[] = [
    {
      id: 'AI', type: 'custom', position: { x: START_X + COL_W * 1.5, y: row4Y },
      data: {
        label: 'Copilote IA CarbonCo',
        subtitle: 'RAG Engine • 5 agents LLM sectoriels\nAnti-greenwashing • EU AI Act compliant',
        icon: 'sparkles', accent: '#2ECC71', badge: 'IA', badgeColor: '#2ECC71',
        prominent: true, pulsing: true, animDelay: 1.5,
      },
    },
  ];

  // Row 5 — Outputs
  const row5Y = ROW_H * 4;
  const outputs: Node<CustomNodeData>[] = [
    {
      id: 'O1', type: 'custom', position: { x: START_X + COL_W, y: row5Y },
      data: {
        label: 'Reporting ESG', subtitle: 'ESRS / ISSB natif\nExport PDF • Word • Structuré',
        icon: 'file-text', accent: '#2ECC71', badge: 'AUDIT-READY', animDelay: 1.7,
      },
    },
    {
      id: 'O2', type: 'custom', position: { x: START_X + COL_W * 3, y: row5Y },
      data: {
        label: 'Dashboard & Alertes', subtitle: 'KPIs temps réel\nAlertes conformité\nSuivi investisseurs',
        icon: 'bar-chart', accent: '#3498DB', badge: 'LIVE', badgeColor: '#3498DB', animDelay: 1.85,
      },
    },
  ];

  return [...sources, ...collecte, ...processing, ...ai, ...outputs];
}

function buildEdges(): Edge[] {
  const greenEdge = { color: 'rgba(46, 204, 113, 0.6)' };
  const orangeEdge = { color: 'rgba(230, 126, 34, 0.6)' };
  const glowEdge = { color: 'rgba(46, 204, 113, 0.8)', glowing: true };

  return [
    // Sources → Collecte
    { id: 'e-S1-C1', source: 'S1', target: 'C1', type: 'animated', data: greenEdge },
    { id: 'e-S2-C1', source: 'S2', target: 'C1', type: 'animated', data: greenEdge },
    { id: 'e-S3-C1', source: 'S3', target: 'C1', type: 'animated', data: greenEdge },
    { id: 'e-S4-C1', source: 'S4', target: 'C1', type: 'animated', data: greenEdge },
    { id: 'e-S5-C1', source: 'S5', target: 'C1', type: 'animated', data: orangeEdge },
    // Collecte → Processing
    { id: 'e-C1-P1', source: 'C1', target: 'P1', type: 'animated', data: greenEdge },
    { id: 'e-C1-P2', source: 'C1', target: 'P2', type: 'animated', data: greenEdge },
    { id: 'e-C1-P3', source: 'C1', target: 'P3', type: 'animated', data: greenEdge },
    // Processing → AI
    { id: 'e-P1-AI', source: 'P1', target: 'AI', type: 'animated', data: glowEdge },
    { id: 'e-P2-AI', source: 'P2', target: 'AI', type: 'animated', data: glowEdge },
    { id: 'e-P3-AI', source: 'P3', target: 'AI', type: 'animated', data: glowEdge },
    // AI → Outputs
    { id: 'e-AI-O1', source: 'AI', target: 'O1', type: 'animated', data: greenEdge },
    { id: 'e-AI-O2', source: 'AI', target: 'O2', type: 'animated', data: greenEdge },
  ];
}

const nodeTypes: NodeTypes = { custom: CustomNode };
const edgeTypes: EdgeTypes = { animated: AnimatedEdge };

function DiagramInner() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  const nodes = useMemo(() => buildNodes(), []);
  const edges = useMemo(() => buildEdges(), []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#2ECC71' }}>
          Architecture
        </span>
        <h2 className="mt-2 font-display font-extrabold text-3xl md:text-4xl tracking-tight text-white">
          Plateforme CarbonCo
        </h2>
        <p className="mt-2 text-sm" style={{ color: '#7F8C8D' }}>
          Flux de données ESG de la collecte au reporting — temps réel
        </p>
        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 text-[11px]" style={{ color: '#7F8C8D' }}>
          <span className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full" style={{ background: 'rgba(46, 204, 113, 0.8)' }} />
            Flux données automatisé
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-0.5 rounded-full" style={{ background: 'rgba(230, 126, 34, 0.8)' }} />
            Extraction documentaire IA
          </span>
        </div>
      </div>

      {/* Diagram */}
      <div
        className="w-full rounded-2xl border overflow-hidden"
        style={{
          height: 820,
          background: '#0D1B2A',
          borderColor: 'rgba(46, 204, 113, 0.15)',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.4}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background
            color="#1B2A4A"
            gap={20}
            size={1}
          />
          <Controls
            position="bottom-left"
            style={{ background: 'rgba(30, 45, 69, 0.9)', border: 'none', borderRadius: 8 }}
          />
          <MiniMap
            position="bottom-right"
            nodeColor={() => '#2ECC71'}
            maskColor="rgba(13, 27, 42, 0.85)"
            style={{ background: '#1B2A4A', borderRadius: 8, border: '1px solid rgba(46, 204, 113, 0.2)' }}
            className="hidden lg:block"
          />
        </ReactFlow>
      </div>

      {/* Footer stats */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
        {[
          { emoji: '⚡', text: '60 jours → 6 heures' },
          { emoji: '🛡️', text: 'Souveraineté EU' },
          { emoji: '✅', text: 'EU AI Act Compliant' },
        ].map((stat) => (
          <span
            key={stat.text}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium"
            style={{
              background: 'rgba(30, 45, 69, 0.6)',
              border: '1px solid rgba(46, 204, 113, 0.2)',
              color: '#B0BEC5',
            }}
          >
            <span>{stat.emoji}</span>
            {stat.text}
          </span>
        ))}
      </div>

      {/* Detail panel */}
      <DetailPanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}

export default function WorkflowDiagram() {
  return (
    <ReactFlowProvider>
      <DiagramInner />
    </ReactFlowProvider>
  );
}
