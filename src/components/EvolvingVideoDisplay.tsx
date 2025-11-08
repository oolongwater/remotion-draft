/**
 * EvolvingVideoDisplay.tsx
 * 
 * Component that displays the evolving composition with Player integration.
 * Separated from App.tsx to properly use hooks.
 */

import React, { useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { EvolutionScript } from '../types/EvolutionScript';
import { CombinedEvolutionComposition } from '../remotion/CombinedEvolutionComposition';
import { QuestionPauseController } from '../controllers/QuestionPauseController';
import { useCurrentPlayerFrame } from '../utils/useCurrentPlayerFrame';

interface EvolvingVideoDisplayProps {
  scripts: EvolutionScript[];
  topic: string;
  totalDuration: number;
  isExtending: boolean;
  onReset: () => void;
  onAnswerEvaluated: (correct: boolean, reasoning: string) => void;
  onAutoExtend: () => void;
}

export const EvolvingVideoDisplay: React.FC<EvolvingVideoDisplayProps> = ({
  scripts,
  topic,
  totalDuration,
  isExtending,
  onReset,
  onAnswerEvaluated,
  onAutoExtend,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const currentFrame = useCurrentPlayerFrame(playerRef);
  const currentScript = scripts.length > 0 ? scripts[0] : null;
  
  // Auto-extend when approaching end of composition (80% threshold)
  useEffect(() => {
    if (totalDuration > 0 && currentFrame >= totalDuration * 0.8 && !isExtending) {
      console.log('Auto-extending at frame', currentFrame);
      onAutoExtend();
    }
  }, [currentFrame, totalDuration, isExtending, onAutoExtend]);
  
  if (!currentScript) {
    return null;
  }
  
  return (
    <>
      {/* Topic display */}
      <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm z-50 border border-slate-700">
        <div>
          <span className="text-slate-400">Learning: </span>
          <span className="font-semibold text-blue-400">{topic}</span>
        </div>
        <div className="mt-1">
          <span className="text-slate-400">Duration: </span>
          <span className="text-slate-300">{Math.round(totalDuration / 30)}s</span>
          {isExtending && <span className="ml-2 text-yellow-400">Extending...</span>}
        </div>
        <div className="mt-1">
          <span className="text-slate-400">Frame: </span>
          <span className="text-slate-300">{currentFrame} / {totalDuration}</span>
        </div>
      </div>
      
      {/* Reset button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={onReset}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
        >
          New Topic
        </button>
      </div>
      
      {/* Remotion Player Container */}
      <div className="relative shadow-2xl rounded-lg overflow-hidden bg-black" style={{ width: "90vw", maxWidth: "1280px" }}>
        <QuestionPauseController
          script={currentScript}
          playerRef={playerRef}
          currentFrame={currentFrame}
          onAnswerEvaluated={onAnswerEvaluated}
        >
          <Player
            ref={playerRef}
            component={CombinedEvolutionComposition}
            inputProps={{
              scripts: scripts,
            }}
            durationInFrames={Math.max(totalDuration, 1)}
            compositionWidth={1280}
            compositionHeight={720}
            fps={30}
            controls={false}
            loop={false}
            style={{
              width: "100%",
            }}
            clickToPlay={false}
            autoPlay
          />
        </QuestionPauseController>
      </div>
    </>
  );
};

