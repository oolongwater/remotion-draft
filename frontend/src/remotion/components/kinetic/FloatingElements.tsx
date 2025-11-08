/**
 * FloatingElements.tsx
 * 
 * Creates ambient floating/drifting elements in the background.
 * Adds visual interest and dynamism to static content.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export interface FloatingElement {
  id: string;
  content: React.ReactNode;
  x: number; // Start X position (0-100%)
  y: number; // Start Y position (0-100%)
  driftX?: number; // Horizontal drift amount in pixels
  driftY?: number; // Vertical drift amount in pixels
  rotation?: number; // Rotation amount in degrees
  scale?: number; // Scale factor
  speed?: number; // Animation speed multiplier
  opacity?: number; // Element opacity
}

interface FloatingElementsProps {
  elements: FloatingElement[];
  style?: React.CSSProperties;
  className?: string;
}

export const FloatingElements: React.FC<FloatingElementsProps> = ({
  elements,
  style = {},
  className = '',
}) => {
  const frame = useCurrentFrame();
  
  // Safety check
  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return null;
  }
  
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style,
      }}
    >
      {elements.map((element) => {
        const {
          id,
          content,
          x,
          y,
          driftX = 0,
          driftY = 0,
          rotation = 0,
          scale = 1,
          speed = 1,
          opacity = 0.5,
        } = element;
        
        // Calculate drift based on frame with sine wave for smooth motion
        const adjustedFrame = frame * speed;
        const driftOffsetX = Math.sin(adjustedFrame * 0.02) * driftX;
        const driftOffsetY = Math.cos(adjustedFrame * 0.025) * driftY;
        
        // Calculate rotation
        const currentRotation = (adjustedFrame * rotation * 0.1) % 360;
        
        // Calculate scale oscillation
        const scaleOscillation = Math.sin(adjustedFrame * 0.03) * 0.1;
        const currentScale = scale + scaleOscillation;
        
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(${driftOffsetX}px, ${driftOffsetY}px) rotate(${currentRotation}deg) scale(${currentScale})`,
              opacity,
              transition: 'transform 0.1s ease-out',
            }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
};

