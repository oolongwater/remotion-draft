/**
 * Card.tsx
 * 
 * A versatile card component for displaying content with animations.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimationDefinition } from '../../types/SceneConfig';
import { applyAnimations, buildStyle } from '../../utils/animationEngine';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  borderColor?: string;
  padding?: number;
  animations?: AnimationDefinition[];
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  backgroundColor = '#1e293b',
  borderColor = '#334155',
  padding = 30,
  animations = [],
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Apply animations
  const animationValues = applyAnimations(frame, fps, animations);
  const animatedStyle = buildStyle(animationValues);
  
  return (
    <div
      style={{
        backgroundColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: `${padding}px`,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        ...style,
        ...animatedStyle,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: '#e2e8f0',
            marginBottom: subtitle ? 10 : 20,
          }}
        >
          {title}
        </div>
      )}
      
      {subtitle && (
        <div
          style={{
            fontSize: 18,
            color: '#94a3b8',
            marginBottom: 20,
          }}
        >
          {subtitle}
        </div>
      )}
      
      <div style={{ color: '#cbd5e1' }}>{children}</div>
    </div>
  );
};
