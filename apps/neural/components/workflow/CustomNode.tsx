'use client';

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { motion } from 'framer-motion';
import {
  Database,
  Users,
  Calculator,
  Package,
  FileText,
  Layers,
  ShieldCheck,
  Leaf,
  Globe,
  Sparkles,
  FileBarChart,
  BarChart3,
  Coins,
} from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  database: Database,
  users: Users,
  calculator: Calculator,
  package: Package,
  file: FileText,
  layers: Layers,
  'shield-check': ShieldCheck,
  leaf: Leaf,
  globe: Globe,
  sparkles: Sparkles,
  'file-text': FileBarChart,
  'bar-chart': BarChart3,
  coins: Coins,
};

export interface CustomNodeData {
  label: string;
  subtitle: string;
  icon: string;
  accent: string;
  badge?: string;
  badgeColor?: string;
  prominent?: boolean;
  pulsing?: boolean;
  animDelay?: number;
}

function CustomNodeComponent({ data }: { data: CustomNodeData }) {
  const Icon = ICONS[data.icon] || Database;
  const isProminent = data.prominent;
  const isPulsing = data.pulsing;

  const accentColor = data.accent || '#2ECC71';
  const badgeColor = data.badgeColor || accentColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: data.animDelay || 0, ease: 'easeOut' }}
      whileHover={{ scale: 1.04, transition: { duration: 0.2 } }}
      className="group relative"
    >
      {/* Glow behind */}
      {isPulsing && (
        <div
          className="absolute -inset-1 rounded-2xl opacity-40 blur-md animate-pulse"
          style={{ background: accentColor }}
        />
      )}

      <div
        className={`relative rounded-xl border backdrop-blur-md transition-all duration-300 cursor-pointer
          ${isProminent ? 'px-6 py-4' : 'px-4 py-3'}
          group-hover:shadow-lg`}
        style={{
          background: 'rgba(30, 45, 69, 0.85)',
          borderColor: `${accentColor}40`,
          boxShadow: `0 0 20px ${accentColor}10`,
          minWidth: isProminent ? 260 : 160,
        }}
      >
        {/* Top handles */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !border-0 !rounded-full"
          style={{ background: accentColor, opacity: 0.6 }}
        />

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: isProminent ? 36 : 30,
              height: isProminent ? 36 : 30,
              background: `${accentColor}20`,
            }}
          >
            <Icon
              style={{ color: accentColor }}
              className={isProminent ? 'w-5 h-5' : 'w-4 h-4'}
            />
          </div>

          <div className="min-w-0 flex-1">
            {/* Title + badge */}
            <div className="flex items-center gap-2">
              <span
                className="font-semibold leading-tight"
                style={{
                  fontSize: isProminent ? 14 : 13,
                  color: '#FFFFFF',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {data.label}
              </span>
              {data.badge && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    background: `${badgeColor}25`,
                    color: badgeColor,
                    border: `1px solid ${badgeColor}40`,
                  }}
                >
                  {isPulsing && (
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: badgeColor }}
                    />
                  )}
                  {data.badge}
                </span>
              )}
            </div>

            {/* Subtitle */}
            <p
              className="mt-1 leading-snug whitespace-pre-line"
              style={{
                fontSize: 11,
                color: '#7F8C8D',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {data.subtitle}
            </p>
          </div>
        </div>

        {/* Bottom handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !border-0 !rounded-full"
          style={{ background: accentColor, opacity: 0.6 }}
        />
      </div>
    </motion.div>
  );
}

export default memo(CustomNodeComponent);
