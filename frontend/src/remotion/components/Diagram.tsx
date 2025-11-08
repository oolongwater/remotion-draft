/**
 * Diagram.tsx
 * 
 * A component for creating simple diagrams (flowcharts, trees, etc.)
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  shape?: 'rect' | 'circle' | 'diamond';
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  color?: string;
  dashed?: boolean;
}

interface DiagramProps {
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
  width?: number;
  height?: number;
  animationDuration?: number;
  animationDelay?: number;
  nodeSize?: { width: number; height: number };
  style?: React.CSSProperties;
}

export const Diagram: React.FC<DiagramProps> = ({
  nodes,
  edges = [],
  width = 800,
  height = 600,
  animationDuration = 60,
  animationDelay = 0,
  nodeSize = { width: 120, height: 60 },
  style = {},
}) => {
  const frame = useCurrentFrame();
  
  // Animation progress
  const animationProgress = interpolate(
    frame,
    [animationDelay, animationDelay + animationDuration],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  // Node positions as a map
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  return (
    <div style={{ width, height, position: 'relative', ...style }}>
      <svg width={width} height={height}>
        {/* Render edges first (so they appear behind nodes) */}
        {edges.map((edge, index) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          
          if (!fromNode || !toNode) return null;
          
          const edgeDelay = (index / edges.length) * animationDuration * 0.5;
          const edgeProgress = interpolate(
            frame,
            [animationDelay + edgeDelay, animationDelay + edgeDelay + 20],
            [0, 1],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
          );
          
          // Calculate center points
          const x1 = fromNode.x + nodeSize.width / 2;
          const y1 = fromNode.y + nodeSize.height / 2;
          const x2 = toNode.x + nodeSize.width / 2;
          const y2 = toNode.y + nodeSize.height / 2;
          
          // Animate the edge drawing
          const currentX2 = x1 + (x2 - x1) * edgeProgress;
          const currentY2 = y1 + (y2 - y1) * edgeProgress;
          
          return (
            <g key={`edge-${index}`}>
              <line
                x1={x1}
                y1={y1}
                x2={currentX2}
                y2={currentY2}
                stroke={edge.color || '#64748b'}
                strokeWidth={2}
                strokeDasharray={edge.dashed ? '5,5' : undefined}
                markerEnd="url(#arrowhead)"
              />
              
              {edge.label && edgeProgress > 0.8 && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 10}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={14}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
          </marker>
        </defs>
        
        {/* Render nodes */}
        {nodes.map((node, index) => {
          const nodeDelay = (index / nodes.length) * animationDuration * 0.5;
          const nodeProgress = interpolate(
            frame,
            [animationDelay + nodeDelay, animationDelay + nodeDelay + 20],
            [0, 1],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
          );
          
          const scale = nodeProgress;
          const opacity = nodeProgress;
          
          const color = node.color || '#3b82f6';
          const shape = node.shape || 'rect';
          
          return (
            <g
              key={node.id}
              opacity={opacity}
              transform={`translate(${node.x + nodeSize.width / 2}, ${node.y + nodeSize.height / 2}) scale(${scale})`}
            >
              {shape === 'rect' && (
                <rect
                  x={-nodeSize.width / 2}
                  y={-nodeSize.height / 2}
                  width={nodeSize.width}
                  height={nodeSize.height}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  rx={8}
                />
              )}
              
              {shape === 'circle' && (
                <circle
                  r={Math.min(nodeSize.width, nodeSize.height) / 2}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
              
              {shape === 'diamond' && (
                <polygon
                  points={`0,${-nodeSize.height / 2} ${nodeSize.width / 2},0 0,${nodeSize.height / 2} ${-nodeSize.width / 2},0`}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
              
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={14}
                fontWeight="bold"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
