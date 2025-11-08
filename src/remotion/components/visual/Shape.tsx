/**
 * Shape.tsx
 * 
 * Morphable primitive shapes that can transform smoothly from one shape to another.
 * Uses @remotion/shapes and @remotion/paths for smooth morphing.
 */

import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { Circle, Rect, Triangle, Star, Polygon } from '@remotion/shapes';
import { interpolatePath } from '@remotion/paths';
import { makeCircle, makeRect, makeTriangle, makeStar, makePolygon } from '@remotion/shapes';
import { ElementProperties, ElementType, EasingType } from '../../../types/AnimationInstruction';

interface ShapeProps {
  type: ElementType;
  properties: ElementProperties;
  enterFrame?: number;
  exitFrame?: number;
  enterAnimation?: 'fade' | 'scale' | 'slide' | 'spring' | 'none';
  exitAnimation?: 'fade' | 'scale' | 'slide' | 'none';
  morphTo?: {
    type: ElementType;
    properties: ElementProperties;
    startFrame: number;
    duration: number;
    easing?: EasingType;
  };
}

/**
 * Get easing function
 */
function getEasing(easing?: EasingType): ((x: number) => number) {
  switch (easing) {
    case 'spring':
      return (x) => x; // Spring will be handled separately
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
    case 'easeIn':
      return (x) => x * x;
    case 'easeOut':
      return (x) => 1 - Math.pow(1 - x, 2);
    case 'easeInOut':
      return (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    default:
      return (x) => x; // linear
  }
}

/**
 * Generate SVG path for a shape type
 */
function getShapePath(type: ElementType, properties: ElementProperties): string {
  const size = properties.width || properties.radius || 100;
  
  switch (type) {
    case 'circle':
      return makeCircle({ radius: size / 2 }).path;
    case 'rect':
      return makeRect({ width: size, height: properties.height || size }).path;
    case 'triangle':
      return makeTriangle({ length: size, direction: 'up' }).path;
    case 'star':
      return makeStar({ points: 5, innerRadius: size * 0.4, outerRadius: size }).path;
    case 'polygon':
      return makePolygon({ points: 6, radius: size / 2 }).path;
    default:
      return makeCircle({ radius: size / 2 }).path;
  }
}

export const Shape: React.FC<ShapeProps> = ({
  type,
  properties,
  enterFrame = 0,
  exitFrame,
  enterAnimation = 'scale',
  exitAnimation = 'fade',
  morphTo,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Enter animation
  let enterProgress = 1;
  if (frame < enterFrame + 30) {
    enterProgress = interpolate(
      frame,
      [enterFrame, enterFrame + 30],
      [0, 1],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
    );
  }
  
  // Exit animation
  let exitProgress = 1;
  if (exitFrame && frame > exitFrame - 30) {
    exitProgress = interpolate(
      frame,
      [exitFrame - 30, exitFrame],
      [1, 0],
      { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
    );
  }
  
  // Morphing
  let currentPath = properties.path || getShapePath(type, properties);
  let currentFill = properties.fill || '#3b82f6';
  let currentStroke = properties.stroke;
  let currentStrokeWidth = properties.strokeWidth || 0;
  
  if (morphTo && frame >= morphTo.startFrame) {
    const morphProgress = interpolate(
      frame,
      [morphTo.startFrame, morphTo.startFrame + morphTo.duration],
      [0, 1],
      {
        extrapolateRight: 'clamp',
        extrapolateLeft: 'clamp',
        easing: getEasing(morphTo.easing),
      }
    );
    
    const targetPath = morphTo.properties.path || getShapePath(morphTo.type, morphTo.properties);
    
    // Interpolate between paths
    try {
      currentPath = interpolatePath(morphProgress, currentPath, targetPath);
    } catch (e) {
      // If path interpolation fails, just switch at 50%
      currentPath = morphProgress < 0.5 ? currentPath : targetPath;
    }
    
    // Interpolate colors
    if (morphTo.properties.fill) {
      currentFill = interpolateColor(properties.fill || '#3b82f6', morphTo.properties.fill, morphProgress);
    }
  }
  
  // Apply enter animation transforms
  let scale = 1;
  let opacity = 1;
  let translateY = 0;
  
  if (enterAnimation === 'scale') {
    scale = enterProgress;
    opacity = enterProgress;
  } else if (enterAnimation === 'fade') {
    opacity = enterProgress;
  } else if (enterAnimation === 'slide') {
    translateY = interpolate(enterProgress, [0, 1], [100, 0]);
    opacity = enterProgress;
  } else if (enterAnimation === 'spring') {
    scale = spring({
      frame: frame - enterFrame,
      fps,
      config: { damping: 15, stiffness: 200 },
    });
    opacity = Math.min(1, scale);
  }
  
  // Apply exit animation
  if (exitAnimation === 'fade') {
    opacity *= exitProgress;
  } else if (exitAnimation === 'scale') {
    scale *= exitProgress;
    opacity *= exitProgress;
  }
  
  // Apply element's own scale and opacity
  scale *= properties.scale || 1;
  opacity *= properties.opacity ?? 1;
  
  const x = properties.x || 0;
  const y = properties.y || 0;
  const rotation = properties.rotation || 0;
  
  return (
    <g
      transform={`translate(${x}, ${y + translateY}) rotate(${rotation}) scale(${scale})`}
      opacity={opacity}
      style={{ transformOrigin: 'center' }}
    >
      <path
        d={currentPath}
        fill={currentFill}
        stroke={currentStroke}
        strokeWidth={currentStrokeWidth}
      />
    </g>
  );
};

/**
 * Simple color interpolation
 */
function interpolateColor(color1: string, color2: string, progress: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Wrapper components for specific shapes
 */
export const AnimatedCircle: React.FC<ShapeProps> = (props) => (
  <Shape {...props} type="circle" />
);

export const AnimatedRect: React.FC<ShapeProps> = (props) => (
  <Shape {...props} type="rect" />
);

export const AnimatedTriangle: React.FC<ShapeProps> = (props) => (
  <Shape {...props} type="triangle" />
);

export const AnimatedStar: React.FC<ShapeProps> = (props) => (
  <Shape {...props} type="star" />
);

export const AnimatedPolygon: React.FC<ShapeProps> = (props) => (
  <Shape {...props} type="polygon" />
);

