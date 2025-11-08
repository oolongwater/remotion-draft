/**
 * Timeline.tsx
 * 
 * Orchestrates multiple elements appearing in sequence or parallel.
 * Perfect for building up complex explanations step by step.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export interface TimelineItem {
  id: string;
  content: React.ReactNode;
  startFrame: number;
  duration: number;
  exitFrame?: number;
  exitDuration?: number;
  animation?: 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'scale' | 'none';
  style?: React.CSSProperties;
}

interface TimelineProps {
  items: TimelineItem[];
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Get animation transform based on type
 */
function getAnimationTransform(
  animation: TimelineItem['animation'],
  progress: number,
  isExit: boolean = false
): { opacity: number; transform: string } {
  const direction = isExit ? -1 : 1;
  
  switch (animation) {
    case 'slide-left':
      return {
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [50 * direction, 0])}px)`,
      };
    case 'slide-right':
      return {
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [-50 * direction, 0])}px)`,
      };
    case 'slide-up':
      return {
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [50 * direction, 0])}px)`,
      };
    case 'slide-down':
      return {
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [-50 * direction, 0])}px)`,
      };
    case 'scale':
      return {
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [isExit ? 1 : 0.8, isExit ? 0.8 : 1])})`,
      };
    case 'fade':
      return {
        opacity: progress,
        transform: 'none',
      };
    case 'none':
      return {
        opacity: 1,
        transform: 'none',
      };
    default:
      return {
        opacity: progress,
        transform: 'none',
      };
  }
}

export const Timeline: React.FC<TimelineProps> = ({
  items,
  style = {},
  className = '',
}) => {
  const frame = useCurrentFrame();
  
  // Safety check
  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }
  
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      {items.map((item) => {
        const { startFrame, duration, exitFrame, exitDuration = 20, animation = 'fade' } = item;
        const endFrame = startFrame + duration;
        
        // Calculate entrance progress
        const entranceProgress = interpolate(
          frame,
          [startFrame, endFrame],
          [0, 1],
          { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
        );
        
        // Calculate exit progress if exitFrame is defined
        let exitProgress = 1;
        if (exitFrame !== undefined) {
          const exitEnd = exitFrame + exitDuration;
          exitProgress = interpolate(
            frame,
            [exitFrame, exitEnd],
            [1, 0],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
          );
        }
        
        // Determine if we're in exit phase
        const isExiting = exitFrame !== undefined && frame >= exitFrame;
        
        // Get animation styles
        const progress = isExiting ? exitProgress : entranceProgress;
        const animationStyle = getAnimationTransform(animation, progress, isExiting);
        
        // Don't render if not started or fully exited
        if (frame < startFrame || (exitFrame !== undefined && frame > exitFrame + exitDuration)) {
          return null;
        }
        
        return (
          <div
            key={item.id}
            style={{
              ...item.style,
              ...animationStyle,
            }}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
};

