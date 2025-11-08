/**
 * EvolvingComposition.tsx
 * 
 * Main component for the evolving composition system.
 * Renders a single, continuously evolving composition where elements morph and transform.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { EvolutionScript, findSurroundingKeyframes, getPausePointAtFrame } from '../types/EvolutionScript';
import { interpolateElements } from '../utils/elementInterpolator';
import { MorphingElement } from './components/MorphingElement';

interface EvolvingCompositionProps {
  script: EvolutionScript;
  onPausePointReached?: (questionText: string, frame: number) => void;
}

/**
 * EvolvingComposition Component
 * 
 * Renders elements that continuously evolve based on keyframes in the evolution script.
 */
export const EvolvingComposition: React.FC<EvolvingCompositionProps> = ({
  script,
  onPausePointReached,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  // Find surrounding keyframes
  const { prev, next, progress } = useMemo(
    () => findSurroundingKeyframes(frame, script.keyframes),
    [frame, script.keyframes]
  );
  
  // Interpolate elements between keyframes
  const currentElements = useMemo(() => {
    if (!prev) return [];
    if (!next || prev === next) return prev.elements;
    
    // Get actions from next keyframe
    const actions = next.actions || [];
    
    return interpolateElements(
      prev.elements,
      next.elements,
      progress,
      actions
    );
  }, [prev, next, progress]);
  
  // Get text labels from current keyframe
  const textLabels = useMemo(() => {
    if (!prev) return [];
    
    // If we're transitioning, interpolate opacity of text labels
    const labels = prev.textLabels || [];
    const nextLabels = next?.textLabels || [];
    
    // Show labels from current keyframe, fade out if they don't exist in next
    return labels.map(label => {
      const existsInNext = nextLabels.some(nl => nl.id === label.id);
      const opacity = existsInNext || !next || prev === next ? 1 : Math.max(0, 1 - progress * 2);
      
      return { ...label, opacity };
    }).concat(
      // Fade in new labels from next keyframe
      nextLabels
        .filter(label => !labels.some(l => l.id === label.id))
        .map(label => ({
          ...label,
          opacity: Math.min(1, progress * 2),
        }))
    );
  }, [prev, next, progress]);
  
  // Check for pause points
  const pausePoint = useMemo(
    () => getPausePointAtFrame(frame, script),
    [frame, script]
  );
  
  // Notify about pause point (only once per pause)
  React.useEffect(() => {
    if (pausePoint && onPausePointReached) {
      onPausePointReached(pausePoint.questionText, frame);
    }
  }, [pausePoint?.questionText, frame]); // Only trigger when question changes
  
  const backgroundColor = script.colors.background;
  
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        {/* Render all morphing elements */}
        {currentElements.map((element) => (
          <MorphingElement
            key={element.id}
            element={element}
            colors={script.colors}
          />
        ))}
        
        {/* Render text labels */}
        {textLabels.map((label) => (
          <text
            key={label.id}
            x={label.x}
            y={label.y}
            fill={label.color || script.colors.text}
            fontSize={label.fontSize || 32}
            fontWeight={label.fontWeight || 'bold'}
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={label.opacity ?? 1}
            style={{
              transition: 'opacity 0.3s ease',
            }}
          >
            {label.text}
          </text>
        ))}
      </svg>
      
      {/* Show frame counter for debugging (optional) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: '#fff',
            fontSize: 14,
            fontFamily: 'monospace',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          Frame: {frame} / {script.endFrame}
          {pausePoint && ' [PAUSE]'}
        </div>
      )}
    </AbsoluteFill>
  );
};

