/**
 * LeafQuestionOverlay.tsx
 * 
 * Overlay component for leaf question flow with multiple states:
 * - loading: Generating question (spinner)
 * - ready: Show question + textarea for answer
 * - evaluating: Checking answer (purple spinner)
 * - correct: Green celebration UI with "Continue Learning" button
 * - incorrect: Orange "not quite right" message + loading remediation video
 * - error: Red error state with retry option
 */

import { useState, useCallback } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LeafQuestionOverlayProps {
  isOpen: boolean;
  question?: string;
  status: 'idle' | 'loading' | 'ready' | 'evaluating' | 'correct' | 'incorrect' | 'error';
  answer: string;
  reasoning?: string;
  error?: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer: string) => Promise<void>;
  onContinue: () => void;
  onRetry?: () => void;
  onStartOver?: () => void;
}

export const LeafQuestionOverlay: React.FC<LeafQuestionOverlayProps> = ({
  isOpen,
  question,
  status,
  answer,
  reasoning,
  error,
  onAnswerChange,
  onSubmit,
  onContinue,
  onRetry,
  onStartOver,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(answer);
    } finally {
      setIsSubmitting(false);
    }
  }, [answer, isSubmitting, onSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl mx-4 overflow-hidden">
        
        {/* Loading State - Minimal */}
        {status === 'loading' && (
          <div className="p-16 flex items-center justify-center">
            <div className="relative w-20 h-20">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-yellow-500 rounded-full animate-spin" />
              
              {/* Inner pulsing circle */}
              <div className="absolute inset-4 bg-yellow-500/30 rounded-full animate-pulse" />
              
              {/* Center dot */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-500 rounded-full" />
            </div>
          </div>
        )}

        {/* Ready State - Show Question */}
        {status === 'ready' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="text-4xl">❓</div>
                <h2 className="text-2xl font-bold text-yellow-400">Knowledge Check</h2>
              </div>
              {onStartOver && (
                <button
                  onClick={onStartOver}
                  className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                  title="Start over from the beginning"
                >
                  Start Over
                </button>
              )}
            </div>
            
            <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <p className="text-lg text-white leading-relaxed">{question}</p>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="leaf-answer" className="block text-sm font-medium text-slate-300 mb-2">
                Your Answer
              </label>
              <textarea
                id="leaf-answer"
                value={answer}
                onChange={(e) => onAnswerChange(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                className="w-full px-4 py-3 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                autoFocus
              />

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={!answer.trim() || isSubmitting}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    answer.trim() && !isSubmitting
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-slate-900 cursor-pointer'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Evaluating State - Minimal & Clean */}
        {status === 'evaluating' && (
          <div className="p-16 flex items-center justify-center">
            <div className="relative w-20 h-20">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
              
              {/* Inner pulsing circle */}
              <div className="absolute inset-4 bg-purple-500/30 rounded-full animate-pulse" />
              
              {/* Center dot */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 rounded-full" />
            </div>
          </div>
        )}

        {/* Correct State - Celebration */}
        {status === 'correct' && (
          <div className="p-12 text-center">
            <div className="text-7xl mb-6 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-green-400 mb-4">Excellent!</h2>
            <p className="text-lg text-white mb-6">
              Your answer demonstrates great understanding!
            </p>
            {reasoning && (
              <div className="mb-8 p-4 bg-green-900/20 border border-green-700/50 rounded-lg text-left">
                <div className="text-sm font-semibold text-green-400 mb-2">Evaluation:</div>
                <p className="text-sm text-slate-300">{reasoning}</p>
              </div>
            )}
            <button
              onClick={onContinue}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all text-lg"
            >
              Continue Learning →
            </button>
          </div>
        )}

        {/* Incorrect State - Show Explanation */}
        {status === 'incorrect' && (
          <div className="p-12 text-center">
            <div className="text-6xl mb-6">💡</div>
            <h2 className="text-2xl font-bold text-orange-400 mb-4">Not quite right</h2>
            <p className="text-lg text-white mb-6">
              Here's the correct explanation
            </p>
            {reasoning && (
              <div className="mb-8 p-6 bg-orange-900/20 border border-orange-700/50 rounded-lg text-left">
                <div className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide">Explanation:</div>
                <p className="text-base text-slate-200 leading-relaxed">{reasoning}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onContinue}
                className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all text-lg"
              >
                Continue Learning →
              </button>
              {onStartOver && (
                <button
                  onClick={onStartOver}
                  className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all text-lg border border-slate-600"
                >
                  Start Over
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="p-12 text-center">
            <div className="text-6xl mb-6">⚠️</div>
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <p className="text-white mb-4">
              {error || 'We encountered an error processing your answer'}
            </p>
            <div className="flex gap-4 justify-center">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={onContinue}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

