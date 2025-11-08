/**
 * VisualMetaphor.tsx
 * 
 * Pre-built visual metaphors for common programming concepts.
 * These can be referenced by the LLM to create consistent, recognizable patterns.
 */

import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, AbsoluteFill } from 'remotion';
import { Shape } from './Shape';
import { Icon } from './Icon';
import { ElementProperties } from '../../../types/AnimationInstruction';

export type MetaphorType =
  | 'split' // One thing becomes many
  | 'merge' // Many things become one
  | 'growth' // Something grows/expands
  | 'shrink' // Something shrinks
  | 'flow' // Sequential flow
  | 'cycle' // Circular/repeating pattern
  | 'branching' // Conditional/decision paths
  | 'hierarchy' // Tree structure
  | 'comparison' // A vs B
  | 'transformation'; // State change

interface VisualMetaphorProps {
  type: MetaphorType;
  startFrame?: number;
  duration?: number;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  centerX?: number;
  centerY?: number;
  scale?: number;
}

/**
 * Split metaphor: One circle splits into multiple circles
 */
const SplitMetaphor: React.FC<{
  startFrame: number;
  duration: number;
  colors: any;
  centerX: number;
  centerY: number;
  scale: number;
}> = ({ startFrame, duration, colors, centerX, centerY, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  // Original circle
  const originalOpacity = interpolate(progress, [0, 0.3], [1, 0], { extrapolateRight: 'clamp' });
  
  // New circles spread out
  const spread = interpolate(progress, [0.3, 1], [0, 150 * scale]);
  const newOpacity = interpolate(progress, [0.3, 0.5], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  
  const positions = [
    { x: centerX - spread, y: centerY - spread },
    { x: centerX + spread, y: centerY - spread },
    { x: centerX - spread, y: centerY + spread },
    { x: centerX + spread, y: centerY + spread },
  ];
  
  return (
    <>
      <Shape
        type="circle"
        properties={{
          x: centerX,
          y: centerY,
          radius: 50 * scale,
          fill: colors.primary,
          opacity: originalOpacity,
        }}
        enterFrame={startFrame}
        enterAnimation="scale"
      />
      {positions.map((pos, i) => (
        <Shape
          key={i}
          type="circle"
          properties={{
            x: pos.x,
            y: pos.y,
            radius: 30 * scale,
            fill: colors.secondary,
            opacity: newOpacity,
          }}
          enterFrame={startFrame}
          enterAnimation="none"
        />
      ))}
    </>
  );
};

/**
 * Merge metaphor: Multiple circles merge into one
 */
const MergeMetaphor: React.FC<{
  startFrame: number;
  duration: number;
  colors: any;
  centerX: number;
  centerY: number;
  scale: number;
}> = ({ startFrame, duration, colors, centerX, centerY, scale }) => {
  const frame = useCurrentFrame();
  
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  const spread = interpolate(progress, [0, 0.7], [150 * scale, 0]);
  const smallOpacity = interpolate(progress, [0.5, 0.7], [1, 0], { extrapolateRight: 'clamp' });
  const largeOpacity = interpolate(progress, [0.7, 1], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  
  const positions = [
    { x: centerX - spread, y: centerY - spread },
    { x: centerX + spread, y: centerY - spread },
    { x: centerX - spread, y: centerY + spread },
    { x: centerX + spread, y: centerY + spread },
  ];
  
  return (
    <>
      {positions.map((pos, i) => (
        <Shape
          key={i}
          type="circle"
          properties={{
            x: pos.x,
            y: pos.y,
            radius: 30 * scale,
            fill: colors.secondary,
            opacity: smallOpacity,
          }}
          enterFrame={startFrame}
          enterAnimation="scale"
        />
      ))}
      <Shape
        type="circle"
        properties={{
          x: centerX,
          y: centerY,
          radius: 50 * scale,
          fill: colors.primary,
          opacity: largeOpacity,
        }}
        enterFrame={startFrame}
        enterAnimation="none"
      />
    </>
  );
};

/**
 * Growth metaphor: Something grows larger
 */
const GrowthMetaphor: React.FC<{
  startFrame: number;
  duration: number;
  colors: any;
  centerX: number;
  centerY: number;
  scale: number;
}> = ({ startFrame, duration, colors, centerX, centerY, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const currentScale = spring({
    frame: frame - startFrame,
    fps,
    from: 0.2 * scale,
    to: 1.5 * scale,
    config: { damping: 20, stiffness: 80 },
  });
  
  return (
    <Shape
      type="circle"
      properties={{
        x: centerX,
        y: centerY,
        radius: 50,
        fill: colors.primary,
        scale: currentScale,
      }}
      enterFrame={startFrame}
      enterAnimation="none"
    />
  );
};

/**
 * Flow metaphor: Arrows showing sequential flow
 */
const FlowMetaphor: React.FC<{
  startFrame: number;
  duration: number;
  colors: any;
  centerX: number;
  centerY: number;
  scale: number;
}> = ({ startFrame, duration, colors, centerX, centerY, scale }) => {
  const frame = useCurrentFrame();
  
  const steps = [
    { x: centerX - 200 * scale, y: centerY },
    { x: centerX, y: centerY },
    { x: centerX + 200 * scale, y: centerY },
  ];
  
  const stepDuration = duration / steps.length;
  
  return (
    <>
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <Shape
            type="circle"
            properties={{
              x: step.x,
              y: step.y,
              radius: 40 * scale,
              fill: colors.primary,
            }}
            enterFrame={startFrame + i * stepDuration}
            enterAnimation="scale"
          />
          {i < steps.length - 1 && (
            <Icon
              type="arrow-right"
              x={step.x + 80 * scale}
              y={step.y}
              size={40 * scale}
              stroke={colors.accent}
              enterFrame={startFrame + i * stepDuration + stepDuration * 0.5}
              enterAnimation="fade"
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
};

/**
 * Branching metaphor: Decision/conditional paths
 */
const BranchingMetaphor: React.FC<{
  startFrame: number;
  duration: number;
  colors: any;
  centerX: number;
  centerY: number;
  scale: number;
}> = ({ startFrame, duration, colors, centerX, centerY, scale }) => {
  const frame = useCurrentFrame();
  
  const branchDelay = duration * 0.4;
  
  return (
    <>
      {/* Root */}
      <Shape
        type="circle"
        properties={{
          x: centerX,
          y: centerY - 100 * scale,
          radius: 40 * scale,
          fill: colors.primary,
        }}
        enterFrame={startFrame}
        enterAnimation="scale"
      />
      
      {/* Decision diamond */}
      <Shape
        type="rect"
        properties={{
          x: centerX,
          y: centerY,
          width: 60 * scale,
          height: 60 * scale,
          fill: colors.accent,
          rotation: 45,
        }}
        enterFrame={startFrame + branchDelay * 0.5}
        enterAnimation="scale"
      />
      
      {/* Left branch */}
      <Shape
        type="circle"
        properties={{
          x: centerX - 120 * scale,
          y: centerY + 100 * scale,
          radius: 35 * scale,
          fill: colors.secondary,
        }}
        enterFrame={startFrame + branchDelay}
        enterAnimation="scale"
      />
      
      {/* Right branch */}
      <Shape
        type="circle"
        properties={{
          x: centerX + 120 * scale,
          y: centerY + 100 * scale,
          radius: 35 * scale,
          fill: colors.secondary,
        }}
        enterFrame={startFrame + branchDelay}
        enterAnimation="scale"
      />
    </>
  );
};

/**
 * Main VisualMetaphor component
 */
export const VisualMetaphor: React.FC<VisualMetaphorProps> = ({
  type,
  startFrame = 0,
  duration = 90,
  colors = {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#fbbf24',
  },
  centerX = 640,
  centerY = 360,
  scale = 1,
}) => {
  const metaphorProps = {
    startFrame,
    duration,
    colors,
    centerX,
    centerY,
    scale,
  };
  
  switch (type) {
    case 'split':
      return <SplitMetaphor {...metaphorProps} />;
    case 'merge':
      return <MergeMetaphor {...metaphorProps} />;
    case 'growth':
      return <GrowthMetaphor {...metaphorProps} />;
    case 'flow':
      return <FlowMetaphor {...metaphorProps} />;
    case 'branching':
      return <BranchingMetaphor {...metaphorProps} />;
    default:
      return null;
  }
};

