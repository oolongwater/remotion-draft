/**
 * LeafQuestionOverlay.tsx
 * 
 * Overlay component for leaf question flow with multiple states:
 * - loading: Generating question (spinner)
 * - ready: Show question + textarea for answer
 * - evaluating: Checking answer (purple spinner)
 * - correct: Green celebration UI with "Continue Learning" button
 * - incorrect: Orange "not quite right" message + loading remediation video
 * - generating_followup: Blue loading state while generating follow-up videos
 * - error: Red error state with retry option
 */

import { useState, useCallback } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LeafQuestionOverlayProps {
  isOpen: boolean;
  question?: string;
  status: 'idle' | 'loading' | 'ready' | 'evaluating' | 'correct' | 'incorrect' | 'error' | 'generating_followup';
  answer: string;
  reasoning?: string;
  error?: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: (answer: string) => Promise<void>;
  onContinue: () => void;
  onContinueLearning?: (wasCorrect: boolean) => void;
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
  onContinueLearning,
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
        
        {/* Loading State - Enhanced */}
        {status === 'loading' && (
          <div className="p-16 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/3 left-1/3 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl animate-pulse" />
              <div className="absolute bottom-1/3 right-1/3 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Enhanced spinner */}
            <div className="relative w-24 h-24 mb-6 z-10">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-yellow-500 border-r-yellow-400 rounded-full animate-spin" />
              
              {/* Middle counter-spinning ring */}
              <div className="absolute inset-2 border-4 border-transparent border-b-amber-500 border-l-amber-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
              
              {/* Inner pulsing glow */}
              <div className="absolute inset-4 bg-gradient-to-br from-yellow-500/40 to-amber-500/40 rounded-full animate-pulse" />
              
              {/* Center dot with shadow */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full shadow-lg shadow-yellow-500/50" />
            </div>

            {/* Animated text */}
            <div className="text-center z-10">
              <h3 className="text-xl font-bold text-yellow-400 mb-2 animate-pulse">Generating Question</h3>
              <p className="text-slate-400 text-sm">Preparing your knowledge check...</p>
              
              {/* Animated dots */}
              <div className="flex justify-center space-x-2 mt-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
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

        {/* Evaluating State - Enhanced */}
        {status === 'evaluating' && (
          <div className="p-16 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/3 left-1/3 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl animate-pulse" />
              <div className="absolute bottom-1/3 right-1/3 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Enhanced spinner */}
            <div className="relative w-24 h-24 mb-6 z-10">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-purple-400 rounded-full animate-spin" />
              
              {/* Middle counter-spinning ring */}
              <div className="absolute inset-2 border-4 border-transparent border-b-fuchsia-500 border-l-fuchsia-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
              
              {/* Inner pulsing glow */}
              <div className="absolute inset-4 bg-gradient-to-br from-purple-500/40 to-fuchsia-500/40 rounded-full animate-pulse" />
              
              {/* Center dot with shadow */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-purple-400 to-fuchsia-500 rounded-full shadow-lg shadow-purple-500/50" />
            </div>

            {/* Animated text */}
            <div className="text-center z-10">
              <h3 className="text-xl font-bold text-purple-400 mb-2 animate-pulse">Evaluating Answer</h3>
              <p className="text-slate-400 text-sm">Analyzing your response...</p>
              
              {/* Animated dots */}
              <div className="flex justify-center space-x-2 mt-4">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
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
            
            {/* Continue Learning Prompt */}
            <div className="mb-8 p-6 bg-slate-900/50 border border-slate-700 rounded-lg">
              <p className="text-xl text-white mb-6">
                Do you want to continue learning?
              </p>
              <p className="text-sm text-slate-400">
                We'll generate a more complex topic to challenge your understanding
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {onContinueLearning && (
                <button
                  onClick={() => onContinueLearning(true)}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all text-lg"
                >
                  Yes, Continue Learning →
                </button>
              )}
              <button
                onClick={onContinue}
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all text-lg border border-slate-600"
              >
                No, I'm Done
              </button>
            </div>
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
            
            {/* Continue Learning Prompt */}
            <div className="mb-8 p-6 bg-slate-900/50 border border-slate-700 rounded-lg">
              <p className="text-xl text-white mb-6">
                Do you want to continue learning?
              </p>
              <p className="text-sm text-slate-400">
                We'll review a simpler topic to reinforce the fundamentals
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {onContinueLearning && (
                <button
                  onClick={() => onContinueLearning(false)}
                  className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all text-lg"
                >
                  Yes, Continue Learning →
                </button>
              )}
              <button
                onClick={onContinue}
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all text-lg border border-slate-600"
              >
                No, I'm Done
              </button>
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

        {/* Generating Follow-up State - Enhanced */}
        {status === 'generating_followup' && (
          <div className="p-16 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Animated background orbs */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Enhanced multi-layer spinner */}
            <div className="relative w-28 h-28 mb-8 z-10">
              {/* Outer spinning ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-blue-400 rounded-full animate-spin" />
              
              {/* Middle counter-spinning ring */}
              <div className="absolute inset-3 border-4 border-transparent border-b-cyan-500 border-l-cyan-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
              
              {/* Inner pulsing glow */}
              <div className="absolute inset-6 bg-gradient-to-br from-blue-500/40 to-cyan-500/40 rounded-full animate-pulse" />
              
              {/* Center sparkle */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full shadow-lg shadow-blue-500/50" />
            </div>
            
            {/* Text content */}
            <div className="text-center z-10 max-w-md">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-pulse mb-3">
                Generating New Lessons
              </h2>
              <p className="text-lg text-slate-300 mb-2">
                Creating personalized content based on your progress...
              </p>
              <p className="text-sm text-slate-500">This may take a moment</p>
              
              {/* Animated progress dots */}
              <div className="flex justify-center space-x-2 mt-6">
                <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 bg-gradient-to-br from-cyan-400 to-cyan-500 rounded-full animate-bounce shadow-lg shadow-cyan-500/50" style={{ animationDelay: '150ms' }} />
                <div className="w-2.5 h-2.5 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

