/**
 * SplitScreen.tsx
 * 
 * Dynamic split-screen layouts with animated dividers.
 * Perfect for comparing concepts or showing code alongside explanations.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export type SplitDirection = 'vertical' | 'horizontal';
export type DividerStyle = 'solid' | 'gradient' | 'animated' | 'none';

interface SplitScreenProps {
  left: React.ReactNode;
  right: React.ReactNode;
  direction?: SplitDirection;
  splitRatio?: number; // 0-1, default 0.5
  dividerStyle?: DividerStyle;
  dividerColor?: string;
  dividerWidth?: number;
  animateIn?: boolean;
  animationDelay?: number;
  animationDuration?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const SplitScreen: React.FC<SplitScreenProps> = ({
  left,
  right,
  direction = 'vertical',
  splitRatio = 0.5,
  dividerStyle = 'solid',
  dividerColor = '#3b82f6',
  dividerWidth = 2,
  animateIn = true,
  animationDelay = 0,
  animationDuration = 40,
  style = {},
  className = '',
}) => {
  const frame = useCurrentFrame();
  
  // Animation progress
  const progress = animateIn
    ? interpolate(
        frame,
        [animationDelay, animationDelay + animationDuration],
        [0, 1],
        { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
      )
    : 1;
  
  // Calculate split sizes
  const leftSize = splitRatio * 100;
  const rightSize = (1 - splitRatio) * 100;
  
  // Divider position animation
  const dividerPosition = interpolate(progress, [0, 1], [50, splitRatio * 100]);
  
  // Panel animations
  const leftOpacity = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const rightOpacity = interpolate(progress, [0.5, 1], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  
  // Divider styles
  let dividerElement: React.ReactNode = null;
  
  if (dividerStyle !== 'none') {
    const baseDividerStyle: React.CSSProperties = {
      position: 'absolute',
      zIndex: 10,
    };
    
    if (direction === 'vertical') {
      baseDividerStyle.left = `${dividerPosition}%`;
      baseDividerStyle.top = 0;
      baseDividerStyle.width = `${dividerWidth}px`;
      baseDividerStyle.height = '100%';
      baseDividerStyle.transform = 'translateX(-50%)';
    } else {
      baseDividerStyle.top = `${dividerPosition}%`;
      baseDividerStyle.left = 0;
      baseDividerStyle.height = `${dividerWidth}px`;
      baseDividerStyle.width = '100%';
      baseDividerStyle.transform = 'translateY(-50%)';
    }
    
    switch (dividerStyle) {
      case 'solid':
        dividerElement = <div style={{ ...baseDividerStyle, backgroundColor: dividerColor }} />;
        break;
        
      case 'gradient':
        const gradient =
          direction === 'vertical'
            ? `linear-gradient(to bottom, transparent, ${dividerColor}, transparent)`
            : `linear-gradient(to right, transparent, ${dividerColor}, transparent)`;
        dividerElement = <div style={{ ...baseDividerStyle, background: gradient }} />;
        break;
        
      case 'animated':
        // Pulsing divider
        const pulseOpacity = interpolate(
          Math.sin(frame * 0.1),
          [-1, 1],
          [0.3, 1]
        );
        dividerElement = (
          <div
            style={{
              ...baseDividerStyle,
              backgroundColor: dividerColor,
              opacity: pulseOpacity,
            }}
          />
        );
        break;
    }
  }
  
  // Container and panel styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: direction === 'vertical' ? 'row' : 'column',
    ...style,
  };
  
  const leftPanelStyle: React.CSSProperties = {
    flexBasis: `${leftSize}%`,
    flexShrink: 0,
    opacity: leftOpacity,
    overflow: 'hidden',
  };
  
  const rightPanelStyle: React.CSSProperties = {
    flexBasis: `${rightSize}%`,
    flexShrink: 0,
    opacity: rightOpacity,
    overflow: 'hidden',
  };
  
  return (
    <div className={className} style={containerStyle}>
      <div style={leftPanelStyle}>{left}</div>
      <div style={rightPanelStyle}>{right}</div>
      {dividerElement}
    </div>
  );
};

