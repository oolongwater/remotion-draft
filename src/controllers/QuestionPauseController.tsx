/**
 * QuestionPauseController.tsx
 * 
 * Controller for handling question pauses in the evolving composition.
 * Monitors for pause points and manages user interaction during pauses.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PlayerRef } from '@remotion/player';
import { EvolutionScript, getPausePointAtFrame } from '../types/EvolutionScript';
import { evaluateAnswer } from '../services/llmService';

interface QuestionPauseControllerProps {
  script: EvolutionScript;
  playerRef: React.RefObject<PlayerRef>;
  currentFrame: number;
  onAnswerEvaluated?: (correct: boolean, reasoning: string) => void;
  children?: React.ReactNode;
}

interface PauseState {
  isPaused: boolean;
  questionText: string | null;
  pauseFrame: number | null;
  isEvaluating: boolean;
}

/**
 * QuestionPauseController Component
 * 
 * Monitors the composition for pause points and handles question/answer flow.
 */
export const QuestionPauseController: React.FC<QuestionPauseControllerProps> = ({
  script,
  playerRef,
  currentFrame,
  onAnswerEvaluated,
  children,
}) => {
  const [pauseState, setPauseState] = useState<PauseState>({
    isPaused: false,
    questionText: null,
    pauseFrame: null,
    isEvaluating: false,
  });
  
  const [userAnswer, setUserAnswer] = useState('');
  const lastPauseFrame = useRef<number | null>(null);
  
  // Check for pause points
  useEffect(() => {
    const pausePoint = getPausePointAtFrame(currentFrame, script);
    
    // Only pause if we hit a new pause point (not the same one we're already at)
    if (pausePoint && !pauseState.isPaused && lastPauseFrame.current !== currentFrame) {
      console.log('Pause point reached at frame', currentFrame);
      lastPauseFrame.current = currentFrame;
      
      // Pause the player
      if (playerRef.current) {
        playerRef.current.pause();
      }
      
      setPauseState({
        isPaused: true,
        questionText: pausePoint.questionText,
        pauseFrame: currentFrame,
        isEvaluating: false,
      });
    }
  }, [currentFrame, script, pauseState.isPaused, playerRef]);
  
  // Handle answer submission
  const handleAnswerSubmit = useCallback(async () => {
    if (!pauseState.questionText || !userAnswer.trim()) return;
    
    setPauseState(prev => ({ ...prev, isEvaluating: true }));
    
    try {
      // Evaluate the answer
      const result = await evaluateAnswer(
        userAnswer,
        pauseState.questionText,
        script.topic
      );
      
      if (result.success) {
        console.log('Answer evaluated:', result.correct);
        
        // Notify parent
        if (onAnswerEvaluated && result.reasoning) {
          onAnswerEvaluated(result.correct || false, result.reasoning);
        }
        
        // Resume playback
        if (playerRef.current) {
          playerRef.current.play();
        }
        
        // Clear pause state
        setPauseState({
          isPaused: false,
          questionText: null,
          pauseFrame: null,
          isEvaluating: false,
        });
        
        setUserAnswer('');
      } else {
        console.error('Answer evaluation failed:', result.error);
        setPauseState(prev => ({ ...prev, isEvaluating: false }));
      }
    } catch (error) {
      console.error('Error evaluating answer:', error);
      setPauseState(prev => ({ ...prev, isEvaluating: false }));
    }
  }, [pauseState.questionText, userAnswer, script.topic, playerRef, onAnswerEvaluated]);
  
  // Handle skip (continue without answering)
  const handleSkip = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.play();
    }
    
    setPauseState({
      isPaused: false,
      questionText: null,
      pauseFrame: null,
      isEvaluating: false,
    });
    
    setUserAnswer('');
  }, [playerRef]);
  
  // Render question overlay if paused
  return (
    <>
      {children}
      
      {pauseState.isPaused && pauseState.questionText && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            pointerEvents: 'all',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              borderRadius: 12,
              padding: '32px',
              maxWidth: 600,
              width: '90%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: '#e2e8f0',
                marginBottom: 24,
                textAlign: 'center',
              }}
            >
              {pauseState.questionText}
            </div>
            
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !pauseState.isEvaluating) {
                  handleAnswerSubmit();
                }
              }}
              placeholder="Type your answer..."
              disabled={pauseState.isEvaluating}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: 18,
                borderRadius: 8,
                border: '2px solid #475569',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                marginBottom: 16,
                outline: 'none',
              }}
              autoFocus
            />
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={handleSkip}
                disabled={pauseState.isEvaluating}
                style={{
                  padding: '12px 24px',
                  fontSize: 16,
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#475569',
                  color: '#e2e8f0',
                  cursor: pauseState.isEvaluating ? 'not-allowed' : 'pointer',
                  opacity: pauseState.isEvaluating ? 0.5 : 1,
                }}
              >
                Skip
              </button>
              
              <button
                onClick={handleAnswerSubmit}
                disabled={pauseState.isEvaluating || !userAnswer.trim()}
                style={{
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 'bold',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  cursor: pauseState.isEvaluating || !userAnswer.trim() ? 'not-allowed' : 'pointer',
                  opacity: pauseState.isEvaluating || !userAnswer.trim() ? 0.5 : 1,
                }}
              >
                {pauseState.isEvaluating ? 'Evaluating...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

