/**
 * TwoColumnLayout.tsx
 * 
 * A simple two-column layout component.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimationDefinition } from '../../types/SceneConfig';
import { applyAnimations, buildStyle } from '../../utils/animationEngine';

interface TwoColumnLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: string | number;
  rightWidth?: string | number;
  gap?: number;
  animations?: AnimationDefinition[];
  style?: React.CSSProperties;
}

export const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  left,
  right,
  leftWidth = '50%',
  rightWidth = '50%',
  gap = 20,
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
        display: 'flex',
        flexDirection: 'row',
        gap: `${gap}px`,
        width: '100%',
        height: '100%',
        ...style,
        ...animatedStyle,
      }}
    >
      <div
        style={{
          width: typeof leftWidth === 'number' ? `${leftWidth}px` : leftWidth,
          flex: leftWidth === '50%' ? 1 : undefined,
        }}
      >
        {left}
      </div>
      <div
        style={{
          width: typeof rightWidth === 'number' ? `${rightWidth}px` : rightWidth,
          flex: rightWidth === '50%' ? 1 : undefined,
        }}
      >
        {right}
      </div>
    </div>
  );
};

