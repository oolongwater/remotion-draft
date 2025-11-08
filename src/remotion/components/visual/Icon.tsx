/**
 * Icon.tsx
 * 
 * Icon library for visual metaphors and concepts.
 * Simple, recognizable icons rendered as SVG paths.
 */

import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export type IconType =
  | 'arrow-right'
  | 'arrow-down'
  | 'arrow-up'
  | 'arrow-left'
  | 'check'
  | 'cross'
  | 'question'
  | 'lightbulb'
  | 'gear'
  | 'star'
  | 'heart'
  | 'lock'
  | 'unlock'
  | 'play'
  | 'pause'
  | 'plus'
  | 'minus'
  | 'refresh'
  | 'search';

interface IconProps {
  type: IconType;
  x: number;
  y: number;
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  enterFrame?: number;
  enterAnimation?: 'fade' | 'scale' | 'spring' | 'none';
}

/**
 * Get SVG path for icon type
 */
function getIconPath(type: IconType, size: number): string {
  const s = size;
  const half = s / 2;
  
  switch (type) {
    case 'arrow-right':
      return `M ${half * 0.3} ${half * 0.5} L ${half * 1.3} ${half} L ${half * 0.3} ${half * 1.5} Z`;
    
    case 'arrow-down':
      return `M ${half * 0.5} ${half * 0.3} L ${half} ${half * 1.3} L ${half * 1.5} ${half * 0.3} Z`;
    
    case 'arrow-up':
      return `M ${half * 0.5} ${half * 1.3} L ${half} ${half * 0.3} L ${half * 1.5} ${half * 1.3} Z`;
    
    case 'arrow-left':
      return `M ${half * 1.3} ${half * 0.5} L ${half * 0.3} ${half} L ${half * 1.3} ${half * 1.5} Z`;
    
    case 'check':
      return `M ${half * 0.3} ${half} L ${half * 0.7} ${half * 1.4} L ${half * 1.7} ${half * 0.4}`;
    
    case 'cross':
      return `M ${half * 0.4} ${half * 0.4} L ${half * 1.6} ${half * 1.6} M ${half * 1.6} ${half * 0.4} L ${half * 0.4} ${half * 1.6}`;
    
    case 'plus':
      return `M ${half} ${half * 0.3} L ${half} ${half * 1.7} M ${half * 0.3} ${half} L ${half * 1.7} ${half}`;
    
    case 'minus':
      return `M ${half * 0.3} ${half} L ${half * 1.7} ${half}`;
    
    case 'question':
      // Simplified question mark
      return `M ${half * 0.6} ${half * 0.4} Q ${half} ${half * 0.2} ${half * 1.4} ${half * 0.4} Q ${half * 1.5} ${half * 0.7} ${half} ${half} L ${half} ${half * 1.2} M ${half} ${half * 1.5} L ${half} ${half * 1.6}`;
    
    case 'lightbulb':
      // Simplified lightbulb
      return `M ${half * 0.5} ${half} Q ${half * 0.5} ${half * 0.3} ${half} ${half * 0.3} Q ${half * 1.5} ${half * 0.3} ${half * 1.5} ${half} Q ${half * 1.5} ${half * 1.2} ${half} ${half * 1.5} Q ${half * 0.5} ${half * 1.2} ${half * 0.5} ${half} M ${half * 0.7} ${half * 1.6} L ${half * 1.3} ${half * 1.6}`;
    
    case 'star':
      // 5-pointed star
      const points = 5;
      const outerRadius = s * 0.5;
      const innerRadius = s * 0.2;
      let starPath = '';
      for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = half + Math.cos(angle) * radius;
        const y = half + Math.sin(angle) * radius;
        starPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      return starPath + ' Z';
    
    case 'heart':
      // Simplified heart
      return `M ${half} ${half * 1.7} Q ${half * 0.3} ${half * 1.3} ${half * 0.3} ${half * 0.8} Q ${half * 0.3} ${half * 0.4} ${half} ${half * 0.5} Q ${half * 1.7} ${half * 0.4} ${half * 1.7} ${half * 0.8} Q ${half * 1.7} ${half * 1.3} ${half} ${half * 1.7}`;
    
    case 'gear':
      // Simplified gear
      const teeth = 6;
      let gearPath = '';
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (Math.PI * 2 * i) / (teeth * 2);
        const radius = i % 2 === 0 ? s * 0.5 : s * 0.35;
        const x = half + Math.cos(angle) * radius;
        const y = half + Math.sin(angle) * radius;
        gearPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      }
      return gearPath + ` Z M ${half * 0.7} ${half} A ${s * 0.15} ${s * 0.15} 0 1 0 ${half * 1.3} ${half} A ${s * 0.15} ${s * 0.15} 0 1 0 ${half * 0.7} ${half}`;
    
    case 'play':
      return `M ${half * 0.5} ${half * 0.3} L ${half * 0.5} ${half * 1.7} L ${half * 1.7} ${half} Z`;
    
    case 'pause':
      return `M ${half * 0.5} ${half * 0.3} L ${half * 0.5} ${half * 1.7} L ${half * 0.8} ${half * 1.7} L ${half * 0.8} ${half * 0.3} Z M ${half * 1.2} ${half * 0.3} L ${half * 1.2} ${half * 1.7} L ${half * 1.5} ${half * 1.7} L ${half * 1.5} ${half * 0.3} Z`;
    
    case 'refresh':
      // Circular arrow
      return `M ${half * 1.5} ${half * 0.7} A ${s * 0.4} ${s * 0.4} 0 1 0 ${half * 0.7} ${half * 1.5} L ${half * 0.5} ${half * 1.3} L ${half * 0.9} ${half * 1.3} L ${half * 0.7} ${half * 1.7}`;
    
    case 'search':
      // Magnifying glass
      return `M ${half * 0.8} ${half * 0.8} A ${s * 0.25} ${s * 0.25} 0 1 0 ${half * 0.8} ${half * 0.8} M ${half * 1.1} ${half * 1.1} L ${half * 1.6} ${half * 1.6}`;
    
    case 'lock':
      return `M ${half * 0.6} ${half * 0.9} L ${half * 0.6} ${half * 1.6} L ${half * 1.4} ${half * 1.6} L ${half * 1.4} ${half * 0.9} Z M ${half * 0.7} ${half * 0.9} L ${half * 0.7} ${half * 0.6} Q ${half * 0.7} ${half * 0.3} ${half} ${half * 0.3} Q ${half * 1.3} ${half * 0.3} ${half * 1.3} ${half * 0.6} L ${half * 1.3} ${half * 0.9}`;
    
    case 'unlock':
      return `M ${half * 0.6} ${half * 0.9} L ${half * 0.6} ${half * 1.6} L ${half * 1.4} ${half * 1.6} L ${half * 1.4} ${half * 0.9} Z M ${half * 0.7} ${half * 0.9} L ${half * 0.7} ${half * 0.6} Q ${half * 0.7} ${half * 0.3} ${half} ${half * 0.3} Q ${half * 1.3} ${half * 0.3} ${half * 1.3} ${half * 0.6}`;
    
    default:
      return '';
  }
}

export const Icon: React.FC<IconProps> = ({
  type,
  x,
  y,
  size = 40,
  fill,
  stroke = '#ffffff',
  strokeWidth = 3,
  opacity = 1,
  rotation = 0,
  enterFrame = 0,
  enterAnimation = 'scale',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Enter animation
  let scale = 1;
  let currentOpacity = opacity;
  
  if (frame < enterFrame + 30) {
    const progress = interpolate(
      frame,
      [enterFrame, enterFrame + 30],
      [0, 1],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
    );
    
    if (enterAnimation === 'scale') {
      scale = progress;
      currentOpacity = opacity * progress;
    } else if (enterAnimation === 'fade') {
      currentOpacity = opacity * progress;
    } else if (enterAnimation === 'spring') {
      scale = spring({
        frame: frame - enterFrame,
        fps,
        config: { damping: 15, stiffness: 200 },
      });
      currentOpacity = opacity * Math.min(1, scale);
    }
  }
  
  const path = getIconPath(type, size);
  
  // Center the icon at (x, y)
  const centerOffset = -size / 2;
  
  return (
    <g
      transform={`translate(${x + centerOffset}, ${y + centerOffset}) rotate(${rotation}, ${size / 2}, ${size / 2}) scale(${scale})`}
      opacity={currentOpacity}
      style={{ transformOrigin: 'center' }}
    >
      <path
        d={path}
        fill={fill || 'none'}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

