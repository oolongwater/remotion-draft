/**
 * ContinuousCanvas.tsx
 * 
 * Main renderer for the continuous visual animation system.
 * Interprets animation sequences and renders visual elements with smooth transitions.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Sequence } from 'remotion';
import {
  AnimationSequence,
  VisualElement,
  Connection,
  TextLabel,
  Transition as ElementTransition,
} from '../types/AnimationInstruction';
import { Shape } from './components/visual/Shape';
import { Icon } from './components/visual/Icon';
import { KineticText } from './components/kinetic/KineticText';

interface ContinuousCanvasProps {
  sequence: AnimationSequence;
}

/**
 * Render a single visual element
 */
const RenderElement: React.FC<{
  element: VisualElement;
  transitions: ElementTransition[];
}> = ({ element, transitions }) => {
  const frame = useCurrentFrame();
  
  // Find active transitions for this element
  const activeTransitions = transitions.filter(
    (t) => t.elementId === element.id && frame >= t.startFrame && frame < t.startFrame + t.duration
  );
  
  // Apply transitions to properties
  let properties = { ...element.properties };
  
  // Check if this element should morph to another shape
  const morphTransition = activeTransitions.find((t) => t.property === 'morph');
  
  if (element.type === 'text') {
    // Render text label
    return (
      <g
        transform={`translate(${properties.x}, ${properties.y})`}
        opacity={properties.opacity ?? 1}
      >
        <text
          fill={properties.fill || '#ffffff'}
          fontSize={properties.fontSize || 32}
          fontWeight={properties.fontWeight || 'normal'}
          textAnchor={properties.textAlign === 'center' ? 'middle' : properties.textAlign === 'right' ? 'end' : 'start'}
        >
          {properties.text || ''}
        </text>
      </g>
    );
  }
  
  if (element.type === 'icon') {
    // Icon elements would use the Icon component
    return null; // TODO: Implement icon rendering
  }
  
  if (element.type === 'line' || element.type === 'connection') {
    // Handle line elements that appear in the elements array
    // These should ideally be in the connections array, but handle them here too
    const x1 = (properties as any).x1 || properties.x || 0;
    const y1 = (properties as any).y1 || properties.y || 0;
    const x2 = (properties as any).x2 || (properties.x || 0) + (properties.width || 100);
    const y2 = (properties as any).y2 || properties.y || 0;
    
    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={properties.stroke || properties.fill || '#64748b'}
        strokeWidth={properties.strokeWidth || 2}
        opacity={properties.opacity ?? 1}
        strokeDasharray={(properties as any).dashed ? '5,5' : undefined}
      />
    );
  }
  
  // Render shape
  return (
    <Shape
      type={element.type}
      properties={properties}
      enterFrame={element.enterFrame}
      exitFrame={element.exitFrame}
      enterAnimation={element.enterAnimation}
      exitAnimation={element.exitAnimation}
      morphTo={morphTransition ? {
        type: morphTransition.morphToShape!,
        properties: { ...properties, path: morphTransition.morphToPath },
        startFrame: morphTransition.startFrame,
        duration: morphTransition.duration,
        easing: morphTransition.easing,
      } : undefined}
    />
  );
};

/**
 * Render connections between elements
 */
const RenderConnection: React.FC<{
  connection: Connection;
  elements: VisualElement[];
}> = ({ connection, elements }) => {
  const frame = useCurrentFrame();
  
  // Find connected elements
  const fromElement = elements.find((e) => e.id === connection.from);
  const toElement = elements.find((e) => e.id === connection.to);
  
  if (!fromElement || !toElement) return null;
  
  // Check if connection should be visible
  if (connection.enterFrame && frame < connection.enterFrame) return null;
  if (connection.exitFrame && frame > connection.exitFrame) return null;
  
  const x1 = fromElement.properties.x || 0;
  const y1 = fromElement.properties.y || 0;
  const x2 = toElement.properties.x || 0;
  const y2 = toElement.properties.y || 0;
  
  // Animate line drawing if specified
  let pathLength = 1;
  if (connection.animated && connection.enterFrame) {
    const animDuration = 30;
    if (frame < connection.enterFrame + animDuration) {
      pathLength = (frame - connection.enterFrame) / animDuration;
    }
  }
  
  const strokeDasharray = connection.dashed ? '10,5' : undefined;
  
  if (connection.type === 'curve') {
    // Curved connection (Bezier)
    const cx = (x1 + x2) / 2;
    const cy = Math.min(y1, y2) - 50;
    const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
    
    return (
      <path
        d={path}
        fill="none"
        stroke={toElement.properties.stroke || '#64748b'}
        strokeWidth={2}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={connection.animated ? (1 - pathLength) * 100 : 0}
        markerEnd="url(#arrowhead)"
      />
    );
  }
  
  // Straight line connection
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={toElement.properties.stroke || '#64748b'}
      strokeWidth={2}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={connection.animated ? (1 - pathLength) * 100 : 0}
      markerEnd={connection.type === 'arrow' ? 'url(#arrowhead)' : undefined}
    />
  );
};

/**
 * Render text labels with animations
 */
const RenderTextLabel: React.FC<{ label: TextLabel }> = ({ label }) => {
  const frame = useCurrentFrame();
  
  // Check if label should be visible
  if (frame < label.enterFrame) return null;
  if (label.exitFrame && frame > label.exitFrame) return null;
  
  const animDuration = 20;
  const enterProgress = Math.min(1, (frame - label.enterFrame) / animDuration);
  
  let opacity = enterProgress * (label.exitFrame && frame > label.exitFrame - animDuration
    ? 1 - (frame - (label.exitFrame - animDuration)) / animDuration
    : 1);
  
  if (label.animation === 'kinetic') {
    return (
      <foreignObject
        x={label.x - 200}
        y={label.y - 20}
        width={400}
        height={100}
        style={{ overflow: 'visible' }}
      >
        <KineticText
          text={label.text}
          flyFrom="left"
          easing="anticipation"
          delay={0}
          byWord={true}
          style={{
            fontSize: label.fontSize || 32,
            color: label.color || '#ffffff',
            fontWeight: label.fontWeight || 'bold',
            textAlign: 'center',
          }}
        />
      </foreignObject>
    );
  }
  
  // Simple fade or typewriter
  let displayText = label.text;
  if (label.animation === 'typewriter') {
    const charProgress = enterProgress * label.text.length;
    displayText = label.text.substring(0, Math.floor(charProgress));
  }
  
  return (
    <text
      x={label.x}
      y={label.y}
      fill={label.color || '#ffffff'}
      fontSize={label.fontSize || 32}
      fontWeight={label.fontWeight || 'bold'}
      textAnchor="middle"
      dominantBaseline="middle"
      opacity={opacity}
    >
      {displayText}
    </text>
  );
};

/**
 * Main ContinuousCanvas component
 */
export const ContinuousCanvas: React.FC<ContinuousCanvasProps> = ({ sequence }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  // Apply camera movement if specified
  let cameraX = 0;
  let cameraY = 0;
  let cameraZoom = 1;
  
  if (sequence.camera && frame >= sequence.camera.startFrame) {
    const cameraDuration = sequence.camera.duration;
    const cameraProgress = Math.min(
      1,
      (frame - sequence.camera.startFrame) / cameraDuration
    );
    
    cameraX = sequence.camera.fromX + (sequence.camera.toX - sequence.camera.fromX) * cameraProgress;
    cameraY = sequence.camera.fromY + (sequence.camera.toY - sequence.camera.fromY) * cameraProgress;
    cameraZoom = sequence.camera.fromZoom + (sequence.camera.toZoom - sequence.camera.fromZoom) * cameraProgress;
  }
  
  const backgroundColor = sequence.backgroundColor || sequence.colors.background;
  
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <svg
        width={width}
        height={height}
        viewBox={`${-cameraX} ${-cameraY} ${width / cameraZoom} ${height / cameraZoom}`}
        style={{ overflow: 'visible' }}
      >
        {/* Define arrow markers for connections */}
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
        
        {/* Render connections first (behind elements) */}
        {sequence.connections?.map((connection) => (
          <RenderConnection
            key={connection.id}
            connection={connection}
            elements={sequence.elements}
          />
        ))}
        
        {/* Render visual elements */}
        {sequence.elements.map((element) => (
          <RenderElement
            key={element.id}
            element={element}
            transitions={sequence.transitions}
          />
        ))}
        
        {/* Render text labels */}
        {sequence.textLabels?.map((label) => (
          <RenderTextLabel key={label.id} label={label} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

