'use client';

import React, { memo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from 'reactflow';

function AnimatedEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const color = (data?.color as string) || 'rgba(46, 204, 113, 0.6)';
  const glowing = (data?.glowing as boolean) || false;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      {/* Glow layer */}
      {glowing && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: color,
            strokeWidth: 6,
            filter: 'blur(6px)',
            opacity: 0.3,
          }}
        />
      )}

      {/* Base line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 2,
          opacity: 0.5,
        }}
      />

      {/* Animated flowing dots */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 8"
        strokeLinecap="round"
        style={{
          animation: 'flowDash 2s linear infinite',
        }}
      />
    </>
  );
}

export default memo(AnimatedEdgeComponent);
