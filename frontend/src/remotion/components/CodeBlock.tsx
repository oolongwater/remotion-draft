/**
 * CodeBlock.tsx
 * 
 * A component for displaying syntax-highlighted code in Remotion scenes.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimationDefinition } from '../../types/SceneConfig';
import { applyAnimations, buildStyle } from '../../utils/animationEngine';

interface CodeBlockProps {
  code: string;
  language?: string;
  lineNumbers?: boolean;
  highlightLines?: number[];
  animations?: AnimationDefinition[];
  style?: React.CSSProperties;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'javascript',
  lineNumbers = true,
  highlightLines = [],
  animations = [],
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Apply animations
  const animationValues = applyAnimations(frame, fps, animations);
  const animatedStyle = buildStyle(animationValues);
  
  // Split code into lines
  const lines = code.split('\n');
  
  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: '20px',
        fontFamily: 'monospace',
        fontSize: 18,
        overflow: 'auto',
        ...style,
        ...animatedStyle,
      }}
    >
      {/* Language label */}
      {language && (
        <div
          style={{
            color: '#94a3b8',
            fontSize: 14,
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          {language}
        </div>
      )}
      
      {/* Code lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {lines.map((line, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              backgroundColor: highlightLines.includes(index + 1)
                ? 'rgba(59, 130, 246, 0.1)'
                : 'transparent',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {lineNumbers && (
              <span
                style={{
                  color: '#475569',
                  marginRight: 20,
                  userSelect: 'none',
                  minWidth: 30,
                }}
              >
                {index + 1}
              </span>
            )}
            <span style={{ color: '#e2e8f0', whiteSpace: 'pre' }}>
              {line || ' '}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
