/**
 * Transition.tsx
 * 
 * Smooth transitions between content: crossfades, wipes, morphs.
 * Use for seamless content changes within a single video segment.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

export type TransitionType = 'crossfade' | 'wipe-horizontal' | 'wipe-vertical' | 'zoom' | 'slide';

interface TransitionProps {
  from: React.ReactNode;
  to: React.ReactNode;
  startFrame: number;
  duration?: number;
  type?: TransitionType;
  style?: React.CSSProperties;
  className?: string;
}

export const Transition: React.FC<TransitionProps> = ({
  from,
  to,
  startFrame,
  duration = 30,
  type = 'crossfade',
  style = {},
  className = '',
}) => {
  const frame = useCurrentFrame();
  
  const endFrame = startFrame + duration;
  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );
  
  let fromStyle: React.CSSProperties = {};
  let toStyle: React.CSSProperties = {};
  let containerStyle: React.CSSProperties = { position: 'relative', ...style };
  
  switch (type) {
    case 'crossfade':
      fromStyle = {
        opacity: 1 - progress,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      };
      toStyle = {
        opacity: progress,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      };
      break;
      
    case 'wipe-horizontal':
      fromStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        clipPath: `inset(0 ${progress * 100}% 0 0)`,
      };
      toStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)`,
      };
      break;
      
    case 'wipe-vertical':
      fromStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        clipPath: `inset(0 0 ${progress * 100}% 0)`,
      };
      toStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        clipPath: `inset(${(1 - progress) * 100}% 0 0 0)`,
      };
      break;
      
    case 'zoom':
      fromStyle = {
        opacity: 1 - progress,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        transform: `scale(${1 + progress * 0.2})`,
      };
      toStyle = {
        opacity: progress,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        transform: `scale(${0.8 + progress * 0.2})`,
      };
      break;
      
    case 'slide':
      fromStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        transform: `translateX(${-progress * 100}%)`,
      };
      toStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        transform: `translateX(${(1 - progress) * 100}%)`,
      };
      break;
  }
  
  return (
    <div className={className} style={containerStyle}>
      <div style={fromStyle}>{from}</div>
      <div style={toStyle}>{to}</div>
    </div>
  );
};

