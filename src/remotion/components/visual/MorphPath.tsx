/**
 * MorphPath.tsx
 * 
 * Component for morphing between arbitrary SVG paths.
 * Uses @remotion/paths for smooth path interpolation.
 */

import React from 'react';
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';
import { interpolatePath } from '@remotion/paths';
import { EasingType } from '../../../types/AnimationInstruction';

interface MorphPathProps {
  paths: string[]; // Array of SVG paths to morph through
  timings: number[]; // Frame numbers when each path should be reached
  x?: number;
  y?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  easing?: EasingType;
}

/**
 * Get easing function
 */
function getEasing(easing?: EasingType): ((x: number) => number) {
  switch (easing) {
    case 'easeIn':
      return (x) => x * x;
    case 'easeOut':
      return (x) => 1 - Math.pow(1 - x, 2);
    case 'easeInOut':
      return (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'bounce':
      return (x) => {
        if (x < 1 / 2.75) {
          return 7.5625 * x * x;
        } else if (x < 2 / 2.75) {
          const t = x - 1.5 / 2.75;
          return 7.5625 * t * t + 0.75;
        } else if (x < 2.5 / 2.75) {
          const t = x - 2.25 / 2.75;
          return 7.5625 * t * t + 0.9375;
        } else {
          const t = x - 2.625 / 2.75;
          return 7.5625 * t * t + 0.984375;
        }
      };
    default:
      return (x) => x; // linear
  }
}

export const MorphPath: React.FC<MorphPathProps> = ({
  paths,
  timings,
  x = 0,
  y = 0,
  fill = '#3b82f6',
  stroke,
  strokeWidth = 0,
  opacity = 1,
  rotation = 0,
  scale = 1,
  easing = 'easeInOut',
}) => {
  const frame = useCurrentFrame();
  
  if (paths.length < 2 || timings.length !== paths.length) {
    // Need at least 2 paths and matching timings
    return (
      <g transform={`translate(${x}, ${y})`}>
        <path d={paths[0] || ''} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />
      </g>
    );
  }
  
  // Find which segment we're in
  let currentPath = paths[0];
  
  for (let i = 0; i < paths.length - 1; i++) {
    const startFrame = timings[i];
    const endFrame = timings[i + 1];
    
    if (frame >= startFrame && frame <= endFrame) {
      const progress = interpolate(
        frame,
        [startFrame, endFrame],
        [0, 1],
        {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
          easing: getEasing(easing),
        }
      );
      
      try {
        currentPath = interpolatePath(progress, paths[i], paths[i + 1]);
      } catch (e) {
        // If interpolation fails, just switch at 50%
        currentPath = progress < 0.5 ? paths[i] : paths[i + 1];
      }
      break;
    } else if (frame > endFrame) {
      currentPath = paths[i + 1];
    }
  }
  
  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation}) scale(${scale})`}
      opacity={opacity}
      style={{ transformOrigin: 'center' }}
    >
      <path
        d={currentPath}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </g>
  );
};

