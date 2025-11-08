/**
 * AnimatedText.tsx
 * 
 * Displays text with character-by-character or word-by-word animations.
 * Enhanced with fly-in directions, advanced easing, and stagger patterns.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export type FlyInDirection = 'left' | 'right' | 'top' | 'bottom' | 'none';
export type StaggerPattern = 'sequential' | 'from-center' | 'random';
export type EasingMode = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic' | 'anticipation';

interface AnimatedTextProps {
  text: string;
  animationType?: 'fade' | 'slide' | 'scale' | 'none';
  flyFrom?: FlyInDirection;
  easing?: EasingMode;
  stagger?: StaggerPattern;
  delay?: number;
  duration?: number;
  byWord?: boolean;
  style?: React.CSSProperties;
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
      // Deterministic randomness based on index
      return Math.sin(index * 12.9898) * 0.5 + 0.5;
    case 'sequential':
    default:
      return index;
  }
}

/**
 * Get fly-in offset based on direction
 */
function getFlyInOffset(direction: FlyInDirection): { x: number; y: number } {
  const distance = 100;
  switch (direction) {
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
    case 'top':
      return { x: 0, y: -distance };
    case 'bottom':
      return { x: 0, y: distance };
    case 'none':
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Apply easing function to progress
 */
function applyEasing(progress: number, easing: EasingMode): number {
  switch (easing) {
    case 'ease-in':
      return progress * progress;
    case 'ease-out':
      return 1 - Math.pow(1 - progress, 2);
    case 'ease-in-out':
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case 'bounce':
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
      if (progress === 0 || progress === 1) return progress;
      return Math.pow(2, -10 * progress) * Math.sin((progress - 0.1) * 5 * Math.PI) + 1;
    case 'anticipation':
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
    case 'linear':
    default:
      return progress;
  }
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  animationType = 'fade',
  flyFrom = 'none',
  easing = 'ease-out',
  stagger = 'sequential',
  delay = 0,
  duration = 60,
  byWord = false,
  style = {},
}) => {
  const frame = useCurrentFrame();
  
  // Split text into words or characters
  const items = byWord ? text.split(' ') : text.split('');
  const itemDelay = duration / items.length;
  const flyOffset = getFlyInOffset(flyFrom);
  
  return (
    <span style={{ display: 'inline-block', ...style }}>
      {items.map((item, index) => {
        const staggerOrder = getStaggerOrder(index, items.length, stagger);
        const startFrame = delay + staggerOrder * itemDelay;
        const endFrame = startFrame + itemDelay * 1.5;
        
        const rawProgress = interpolate(
          frame,
          [startFrame, endFrame],
          [0, 1],
          { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
        );
        
        const progress = applyEasing(rawProgress, easing);
        
        let opacity = 1;
        let translateX = 0;
        let translateY = 0;
        let scale = 1;
        
        if (animationType === 'fade') {
          opacity = progress;
        } else if (animationType === 'slide') {
          opacity = progress;
          translateY = interpolate(progress, [0, 1], [20, 0]);
        } else if (animationType === 'scale') {
          opacity = progress;
          scale = interpolate(progress, [0, 1], [0, 1]);
        }
        
        // Apply fly-in offset
        if (flyFrom !== 'none') {
          translateX = interpolate(progress, [0, 1], [flyOffset.x, 0]);
          translateY = interpolate(progress, [0, 1], [flyOffset.y, 0]);
          opacity = progress;
        }
        
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
