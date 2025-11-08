/**
 * KineticText.tsx
 * 
 * Advanced text animation component for video-essay style presentations.
 * Features flying text, bounce effects, elastic animations, and staggered reveals.
 */

import React from 'react';
import { useCurrentFrame, interpolate, spring } from 'remotion';

export type FlyDirection = 'left' | 'right' | 'top' | 'bottom' | 'center';
export type StaggerPattern = 'sequential' | 'from-center' | 'random';
export type EasingType = 'linear' | 'bounce' | 'elastic' | 'anticipation';

interface KineticTextProps {
  text: string;
  flyFrom?: FlyDirection;
  stagger?: StaggerPattern;
  easing?: EasingType;
  delay?: number;
  duration?: number;
  byWord?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Calculate stagger order based on pattern
 */
function getStaggerOrder(index: number, total: number, pattern: StaggerPattern): number {
  switch (pattern) {
    case 'from-center':
      const center = Math.floor(total / 2);
      return Math.abs(index - center);
    case 'random':
      // Use index as seed for deterministic randomness
      return Math.sin(index * 12.9898) * 0.5 + 0.5;
    case 'sequential':
    default:
      return index;
  }
}

/**
 * Get initial position offset based on fly direction
 */
function getFlyOffset(direction: FlyDirection): { x: number; y: number } {
  const distance = 200;
  switch (direction) {
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
    case 'top':
      return { x: 0, y: -distance };
    case 'bottom':
      return { x: 0, y: distance };
    case 'center':
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Apply easing function
 */
function applyEasing(progress: number, easing: EasingType): number {
  switch (easing) {
    case 'bounce':
      // Bounce easing out
      if (progress < 1 / 2.75) {
        return 7.5625 * progress * progress;
      } else if (progress < 2 / 2.75) {
        const t = progress - 1.5 / 2.75;
        return 7.5625 * t * t + 0.75;
      } else if (progress < 2.5 / 2.75) {
        const t = progress - 2.25 / 2.75;
        return 7.5625 * t * t + 0.9375;
      } else {
        const t = progress - 2.625 / 2.75;
        return 7.5625 * t * t + 0.984375;
      }
    case 'elastic':
      // Elastic easing out
      if (progress === 0 || progress === 1) return progress;
      return Math.pow(2, -10 * progress) * Math.sin((progress - 0.1) * 5 * Math.PI) + 1;
    case 'anticipation':
      // Anticipation easing (back out)
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
    case 'linear':
    default:
      return progress;
  }
}

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  flyFrom = 'center',
  stagger = 'sequential',
  easing = 'anticipation',
  delay = 0,
  duration = 60,
  byWord = false,
  style = {},
  className = '',
}) => {
  const frame = useCurrentFrame();
  
  // Split text into words or characters
  const items = byWord ? text.split(' ') : text.split('');
  const itemDelay = duration / items.length;
  const offset = getFlyOffset(flyFrom);
  
  return (
    <span className={className} style={{ display: 'inline-block', ...style }}>
      {items.map((item, index) => {
        const staggerOrder = getStaggerOrder(index, items.length, stagger);
        const startFrame = delay + staggerOrder * itemDelay;
        const endFrame = startFrame + itemDelay * 2;
        
        // Calculate progress
        const rawProgress = interpolate(
          frame,
          [startFrame, endFrame],
          [0, 1],
          { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
        );
        
        const progress = applyEasing(rawProgress, easing);
        
        // Animate position
        const translateX = interpolate(progress, [0, 1], [offset.x, 0]);
        const translateY = interpolate(progress, [0, 1], [offset.y, 0]);
        
        // Animate opacity
        const opacity = interpolate(rawProgress, [0, 0.3], [0, 1], {
          extrapolateRight: 'clamp',
          extrapolateLeft: 'clamp',
        });
        
        // Animate scale for anticipation effect
        const scale = easing === 'anticipation' ? interpolate(progress, [0, 1], [0.5, 1]) : 1;
        
        return (
          <span
            key={index}
            style={{
              display: 'inline-block',
              opacity,
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              whiteSpace: 'pre',
            }}
          >
            {item}
            {byWord && index < items.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </span>
  );
};

