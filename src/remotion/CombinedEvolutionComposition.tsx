/**
 * CombinedEvolutionComposition.tsx
 * 
 * Wrapper component that combines multiple evolution scripts into one continuous composition.
 * Handles seamless transitions between scripts as the composition extends.
 */

import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion';
import { EvolutionScript } from '../types/EvolutionScript';
import { EvolvingComposition } from './EvolvingComposition';

interface CombinedEvolutionCompositionProps {
  scripts: EvolutionScript[];
  onPausePointReached?: (questionText: string, frame: number) => void;
}

/**
 * CombinedEvolutionComposition Component
 * 
 * Combines multiple evolution scripts into a continuous playback.
 * Each script plays sequentially, creating an infinitely extending composition.
 */
export const CombinedEvolutionComposition: React.FC<CombinedEvolutionCompositionProps> = ({
  scripts,
  onPausePointReached,
}) => {
  const frame = useCurrentFrame();
  
  if (scripts.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
        }}
      >
        <div>Loading...</div>
      </AbsoluteFill>
    );
  }
  
  if (scripts.length === 1) {
    // Single script, render directly
    return (
      <EvolvingComposition
        script={scripts[0]}
        onPausePointReached={onPausePointReached}
      />
    );
  }
  
  // Multiple scripts - render them sequentially
  let cumulativeFrame = 0;
  
  return (
    <AbsoluteFill>
      {scripts.map((script, index) => {
        const from = cumulativeFrame;
        const duration = script.duration;
        cumulativeFrame += duration;
        
        // Adjust script to start from frame 0 in its sequence
        const adjustedScript = {
          ...script,
          startFrame: 0,
          endFrame: duration,
          keyframes: script.keyframes.map(kf => ({
            ...kf,
            frame: kf.frame - script.startFrame,
          })),
        };
        
        return (
          <Sequence
            key={script.id}
            from={from}
            durationInFrames={duration}
          >
            <EvolvingComposition
              script={adjustedScript}
              onPausePointReached={onPausePointReached}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

