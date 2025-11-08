/**
 * InputOverlay.tsx
 * 
 * Contextual interaction overlay for the infinite learning experience.
 * - Shows question input when segment has a question
 * - Shows continue/new topic options when no question
 * - Handles loading states during generation and evaluation
 */

import { useState, FormEvent } from "react";

interface InputOverlayProps {
  hasQuestion: boolean;
  questionText?: string;
  isGenerating: boolean;
  isEvaluating: boolean;
  onAnswer: (answer: string) => void;
  onRequestNext: () => void;
  onNewTopic: (topic: string) => void;
  onReset: () => void;
}

export const InputOverlay: React.FC<InputOverlayProps> = ({
  hasQuestion,
  questionText,
  isGenerating,
  isEvaluating,
  onAnswer,
  onRequestNext,
  onNewTopic,
  onReset,
}) => {
  const [input, setInput] = useState("");
  const [showNewTopicInput, setShowNewTopicInput] = useState(false);
  const [newTopicValue, setNewTopicValue] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (hasQuestion && input.trim()) {
      onAnswer(input.trim());
      setInput("");
    }
  };

  const handleNewTopicSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (newTopicValue.trim()) {
      onNewTopic(newTopicValue.trim());
      setNewTopicValue("");
      setShowNewTopicInput(false);
    }
  };

  // Show loading state
  if (isGenerating || isEvaluating) {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl px-8 py-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
            <span className="text-white text-lg">
              {isEvaluating ? 'Evaluating your answer...' : 'Generating next segment...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // New topic input mode
  if (showNewTopicInput) {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <div className="mb-4">
            <h3 className="text-white text-lg font-semibold mb-2">
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
    );
  }

  // Question mode - segment has a question
  if (hasQuestion && questionText) {
    return (
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-2xl">
          {/* Question */}
          <div className="mb-4">
            <h3 className="text-blue-400 text-sm font-semibold uppercase tracking-wide mb-2">
              Question
            </h3>
            <p className="text-white text-lg">
              {questionText}
            </p>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isEvaluating}
            />
            <button
              type="submit"
              disabled={!input.trim() || isEvaluating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              Submit
            </button>
          </form>

          {/* Additional Actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowNewTopicInput(true)}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Switch Topic
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={onReset}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No question mode - show continue/new topic options
  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-slate-800/95 backdrop-blur-md border border-slate-700 rounded-2xl px-6 py-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onRequestNext}
            disabled={isGenerating}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            <span>Continue Learning</span>
            <span>→</span>
          </button>
          
          <div className="h-8 w-px bg-slate-600" />
          
          <button
            onClick={() => setShowNewTopicInput(true)}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            New Topic
          </button>
          
          <button
            onClick={onReset}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
};
