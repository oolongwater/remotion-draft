/**
 * RevealBlock.tsx
 * 
 * Reveals content with various animation styles: wipe, slide, scale, curtain.
 * Perfect for dramatic reveals in educational videos.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export type RevealType = 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down' | 'scale' | 'fade' | 'curtain';

interface RevealBlockProps {
  children: React.ReactNode;
  type?: RevealType;
  delay?: number;
  duration?: number;
  style?: React.CSSProperties;
  className?: string;
  revealColor?: string;
}

export const RevealBlock: React.FC<RevealBlockProps> = ({
  children,
  type = 'wipe-right',
  delay = 0,
  duration = 40,
  style = {},
  className = '',
  revealColor = '#3b82f6',
}) => {
  const frame = useCurrentFrame();
  
  const startFrame = delay;
  const endFrame = delay + duration;
  
  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  // Content fade-in (slightly delayed after reveal)
  const contentOpacity = interpolate(
    frame,
    [startFrame + duration * 0.3, endFrame],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  // Calculate reveal effect based on type
  let revealStyle: React.CSSProperties = {};
  let contentStyle: React.CSSProperties = { opacity: contentOpacity };
  
  switch (type) {
    case 'wipe-left':
      revealStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: revealColor,
        transform: `translateX(${interpolate(progress, [0, 1], [0, -100])}%)`,
      };
      break;
      
    case 'wipe-right':
      revealStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: revealColor,
        transform: `translateX(${interpolate(progress, [0, 1], [0, 100])}%)`,
      };
      break;
      
    case 'wipe-up':
      revealStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: revealColor,
        transform: `translateY(${interpolate(progress, [0, 1], [0, -100])}%)`,
      };
      break;
      
    case 'wipe-down':
      revealStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: revealColor,
        transform: `translateY(${interpolate(progress, [0, 1], [0, 100])}%)`,
      };
      break;
      
    case 'scale':
      contentStyle = {
        opacity: contentOpacity,
        transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
      };
      break;
      
    case 'fade':
      contentStyle = {
        opacity: interpolate(progress, [0, 1], [0, 1]),
      };
      break;
      
    case 'curtain':
      // Two curtains opening from center
      const leftCurtain = {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '50%',
        height: '100%',
        backgroundColor: revealColor,
        transform: `translateX(${interpolate(progress, [0, 1], [0, -100])}%)`,
      };
      const rightCurtain = {
        position: 'absolute' as const,
        top: 0,
        right: 0,
        width: '50%',
        height: '100%',
        backgroundColor: revealColor,
        transform: `translateX(${interpolate(progress, [0, 1], [0, 100])}%)`,
      };
      
      return (
        <div
          className={className}
          style={{
            position: 'relative',
            overflow: 'hidden',
            ...style,
          }}
        >
          <div style={contentStyle}>
            {children}
          </div>
          <div style={leftCurtain} />
          <div style={rightCurtain} />
        </div>
      );
  }
  
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={contentStyle}>
        {children}
      </div>
      {type.startsWith('wipe') && <div style={revealStyle} />}
    </div>
  );
};

