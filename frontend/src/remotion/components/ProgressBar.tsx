/**
 * ProgressBar.tsx
 * 
 * An animated progress bar component.
 */

import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface ProgressBarProps {
  progress?: number; // 0-100, or use animation
  animateFrom?: number;
  animateTo?: number;
  duration?: number;
  delay?: number;
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  showPercentage?: boolean;
  style?: React.CSSProperties;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  animateFrom = 0,
  animateTo = 100,
  duration = 60,
  delay = 0,
  height = 30,
  backgroundColor = '#1e293b',
  fillColor = '#3b82f6',
  showPercentage = true,
  style = {},
}) => {
  const frame = useCurrentFrame();
  
  // Calculate progress value
  const currentProgress = progress !== undefined
    ? progress
    : interpolate(
        frame,
        [delay, delay + duration],
        [animateFrom, animateTo],
        { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
      );
  
  return (
    <div style={{ width: '100%', ...style }}>
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor,
          borderRadius: height / 2,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${currentProgress}%`,
            height: '100%',
            backgroundColor: fillColor,
            transition: 'width 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 15,
          }}
        >
          {showPercentage && currentProgress > 10 && (
            <span
              style={{
                color: '#ffffff',
                fontSize: height * 0.5,
                fontWeight: 'bold',
              }}
            >
              {Math.round(currentProgress)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
