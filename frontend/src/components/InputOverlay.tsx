/**
 * InputOverlay.tsx
 * 
 * Contextual interaction overlay for the infinite learning experience.
 * - Shows multiple choice questions
 * - Shows result (correct/incorrect) with feedback
 * - Shows continue/new topic options
 * - Handles loading states during generation
 */

import { useState, FormEvent } from "react";

interface InputOverlayProps {
  hasQuestion: boolean;
  videoEnded: boolean;
  questionText?: string;
  questionOptions?: string[];
  correctAnswer?: string;
  isGenerating: boolean;
  isEvaluating: boolean;
  isLastSegment?: boolean; // Whether this is the last segment
  onAnswer: (answer: string) => Promise<{ correct: boolean; correctAnswer?: string } | undefined>;
  onRequestNext: () => void;
  onNewTopic: (topic: string) => void;
  onReset: () => void;
  onRepeat: () => void;
}

export const InputOverlay: React.FC<InputOverlayProps> = ({
  hasQuestion,
  videoEnded,
  questionText,
  questionOptions,
  isGenerating,
  isEvaluating,
  isLastSegment,
  onAnswer,
  onRequestNext,
  onNewTopic,
  onReset,
  onRepeat,
}) => {
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopicValue, setNewTopicValue] = useState("");
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctAnswer?: string; userAnswer?: string } | null>(null);

  const handleAnswerClick = async (answer: string) => {
    const result = await onAnswer(answer);
    if (result) {
      setAnswerResult({
        correct: result.correct,
        correctAnswer: result.correctAnswer,
        userAnswer: answer,
      });
    }
  };

  const handleContinue = () => {
    setAnswerResult(null);
    onRequestNext();
  };

  const handleRepeat = () => {
    setAnswerResult(null);
    onRepeat(); // Go back to first segment
  };

  const handleNewTopicSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (newTopicValue.trim()) {
      onNewTopic(newTopicValue.trim());
      setNewTopicValue("");
      setShowNewTopicInput(false);
      setAnswerResult(null);
    }
  };

  // Question Overlay (on top of video) - only show when video has ended and there's a question
  console.log('InputOverlay state:', {
    hasQuestion,
    videoEnded,
    hasQuestionText: !!questionText,
    hasQuestionOptions: !!questionOptions,
    answerResult,
    showNewTopicInput,
    shouldShowQuestion: hasQuestion && videoEnded && questionText && questionOptions && !answerResult && !showNewTopicInput
  });
  
  const questionOverlay = hasQuestion && videoEnded && questionText && questionOptions && !answerResult && !showNewTopicInput ? (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-2xl w-full max-w-2xl mx-4">
        {/* Loading state during evaluation */}
        {isEvaluating ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            <span className="text-white text-xl">Evaluating your answer...</span>
          </div>
        ) : (
          <>
            {/* Question */}
            <div className="mb-6">
              <h3 className="text-blue-400 text-sm font-semibold uppercase tracking-wide mb-3">
                Question
              </h3>
              <p className="text-white text-xl mb-6">
                {questionText}
              </p>
            </div>

            {/* Multiple Choice Options */}
            <div className="space-y-3">
              {questionOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerClick(option)}
                  disabled={isEvaluating}
                  className="w-full px-6 py-5 bg-slate-700/50 hover:bg-slate-600/70 border border-slate-600 hover:border-blue-500 rounded-xl text-left text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="font-semibold text-blue-400 mr-3 text-lg">{String.fromCharCode(65 + index)}.</span>
                  <span className="text-lg">{option}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // Result Overlay (on top of video) - show after answering
  const resultOverlay = hasQuestion && answerResult && !showNewTopicInput ? (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-2xl w-full max-w-2xl mx-4">
        {/* Result */}
        <div className="mb-6">
          {answerResult.correct ? (
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-green-400 text-2xl font-bold">Correct!</h3>
                <p className="text-slate-300">Great job! You got it right.</p>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-red-400 text-2xl font-bold">Not quite</h3>
                  <p className="text-slate-300">Let's review the correct answer</p>
                </div>
              </div>
              
              {/* Show correct answer */}
              <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                <p className="text-slate-400 text-sm mb-2">Correct answer:</p>
                <p className="text-green-400 font-semibold text-lg">{answerResult.correctAnswer}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRepeat}
            className="flex-1 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Repeat
          </button>
          {!isLastSegment && (
            <button
              onClick={handleContinue}
              className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Continue
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  // New topic input overlay
  const newTopicOverlay = showNewTopicInput ? (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-2xl w-full max-w-2xl mx-4">
        <div className="mb-6">
          <h3 className="text-white text-2xl font-semibold mb-2">
            What do you want to learn about?
          </h3>
        </div>
        
        <form onSubmit={handleNewTopicSubmit} className="flex gap-3">
          <input
            type="text"
            value={newTopicValue}
            onChange={(e) => setNewTopicValue(e.target.value)}
            placeholder="Enter a new topic..."
            className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newTopicValue.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            Go
          </button>
          <button
            type="button"
            onClick={() => setShowNewTopicInput(false)}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  ) : null;

  // Bottom Controls - Always visible below the video
  return (
    <>
      {/* Overlays on video */}
      {questionOverlay}
      {resultOverlay}
      {newTopicOverlay}

      {/* Bottom control bar - always visible */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl px-6 py-3 shadow-2xl">
          <div className="flex items-center gap-3">
            {/* Loading indicator */}
            {isGenerating && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
                <span className="text-white text-sm">Generating next segment...</span>
                <div className="h-6 w-px bg-slate-600 ml-2" />
              </div>
            )}
            
            {/* Switch Topic button */}
            <button
              onClick={() => setShowNewTopicInput(true)}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors text-sm"
            >
              Switch Topic
            </button>
            
            <span className="text-slate-600">•</span>
            
            {/* Start Over button */}
            <button
              onClick={onReset}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
