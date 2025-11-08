/**
 * Chart.tsx
 * 
 * A simple chart component for bar and line charts.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface ChartProps {
  data: ChartDataPoint[];
  type?: 'bar' | 'line';
  width?: number;
  height?: number;
  animationDuration?: number;
  animationDelay?: number;
  showValues?: boolean;
  style?: React.CSSProperties;
}

export const Chart: React.FC<ChartProps> = ({
  data,
  type = 'bar',
  width = 600,
  height = 400,
  animationDuration = 60,
  animationDelay = 0,
  showValues = true,
  style = {},
}) => {
  const frame = useCurrentFrame();
  
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barWidth = (width - 40) / data.length;
  const chartHeight = height - 60;
  
  // Animation progress
  const animationProgress = interpolate(
    frame,
    [animationDelay, animationDelay + animationDuration],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  if (type === 'bar') {
    return (
      <div style={{ width, height, position: 'relative', ...style }}>
        <svg width={width} height={height}>
          {/* Y-axis */}
          <line
            x1={30}
            y1={10}
            x2={30}
            y2={height - 50}
            stroke="#475569"
            strokeWidth={2}
          />
          
          {/* X-axis */}
          <line
            x1={30}
            y1={height - 50}
            x2={width - 10}
            y2={height - 50}
            stroke="#475569"
            strokeWidth={2}
          />
          
          {/* Bars */}
          {data.map((point, index) => {
            const barHeight = (point.value / maxValue) * chartHeight * animationProgress;
            const x = 40 + index * barWidth;
            const y = height - 50 - barHeight;
            const color = point.color || '#3b82f6';
            
            return (
              <g key={index}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth - 10}
                  height={barHeight}
                  fill={color}
                  rx={4}
                />
                
                {/* Label */}
                <text
                  x={x + (barWidth - 10) / 2}
                  y={height - 30}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize={14}
                >
                  {point.label}
                </text>
                
                {/* Value */}
                {showValues && animationProgress > 0.5 && (
                  <text
                    x={x + (barWidth - 10) / 2}
                    y={y - 10}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize={16}
                    fontWeight="bold"
                  >
                    {point.value}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }
  
  // Line chart
  const points = data.map((point, index) => {
    const x = 40 + index * (width - 50) / (data.length - 1 || 1);
    const y = height - 50 - (point.value / maxValue) * chartHeight * animationProgress;
    return { x, y, ...point };
  });
  
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  
  return (
    <div style={{ width, height, position: 'relative', ...style }}>
      <svg width={width} height={height}>
        {/* Y-axis */}
        <line
          x1={30}
          y1={10}
          x2={30}
          y2={height - 50}
          stroke="#475569"
          strokeWidth={2}
        />
        
        {/* X-axis */}
        <line
          x1={30}
          y1={height - 50}
          x2={width - 10}
          y2={height - 50}
          stroke="#475569"
          strokeWidth={2}
        />
        
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Points and labels */}
        {points.map((point, index) => (
          <g key={index}>
            {/* Point */}
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill={point.color || '#3b82f6'}
              stroke="#ffffff"
              strokeWidth={2}
            />
            
            {/* Label */}
            <text
              x={point.x}
              y={height - 30}
              textAnchor="middle"
              fill="#cbd5e1"
              fontSize={14}
            >
              {point.label}
            </text>
            
            {/* Value */}
            {showValues && animationProgress > 0.5 && (
              <text
                x={point.x}
                y={point.y - 15}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize={16}
                fontWeight="bold"
              >
                {point.value}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
