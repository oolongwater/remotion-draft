/**
 * BranchButton.tsx
 * 
 * Button for asking questions about the current topic.
 * Creates a new branch with videos that answer the user's question.
 */

import { useState } from 'react';

interface BranchButtonProps {
  onAskQuestion: (question: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Button to ask a question and create a new learning branch
 */
export const BranchButton: React.FC<BranchButtonProps> = ({
  onAskQuestion,
  disabled = false,
  className = '',
}) => {
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [question, setQuestion] = useState('');
  
  const handleClick = () => {
    if (disabled) return;
    setShowQuestionInput(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      onAskQuestion(question.trim());
      setQuestion('');
      setShowQuestionInput(false);
    }
  };
  
  const handleCancel = () => {
    setQuestion('');
    setShowQuestionInput(false);
  };
  
  if (showQuestionInput) {
    return (
      <div className={`bg-slate-700/50 border border-slate-600 rounded-xl p-4 ${className}`}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-slate-300 text-sm mb-1 block">
              What are you confused about?
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., 'How does energy transfer between objects?', 'Why is this important?', 'Can you explain this more deeply?'"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none"
              rows={3}
              autoFocus
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!question.trim()}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
            >
              Generate Answer Videos
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
          
          <p className="text-xs text-slate-400 italic">
            AI will analyze your question and create 1-5 videos to answer it based on complexity.
          </p>
        </form>
      </div>
    );
  }
  
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium ${className}`}
      title="Ask a question about this topic and get personalized video explanations"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Ask Question</span>
    </button>
  );
};

