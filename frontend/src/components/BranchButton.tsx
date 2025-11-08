/**
 * BranchButton.tsx
 * 
 * Placeholder button for creating branches from current node.
 * Will be replaced with actual question-based branching feature in the future.
 */

import { useState } from 'react';

interface BranchButtonProps {
  onBranch: (branchLabel?: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Button to create a new branch from current node
 */
export const BranchButton: React.FC<BranchButtonProps> = ({
  onBranch,
  disabled = false,
  className = '',
}) => {
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [branchLabel, setBranchLabel] = useState('');
  
  const handleClick = () => {
    if (disabled) return;
    setShowLabelInput(true);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (branchLabel.trim()) {
      onBranch(branchLabel.trim());
      setBranchLabel('');
      setShowLabelInput(false);
    } else {
      onBranch();
      setShowLabelInput(false);
    }
  };
  
  const handleCancel = () => {
    setBranchLabel('');
    setShowLabelInput(false);
  };
  
  if (showLabelInput) {
    return (
      <div className={`bg-slate-700/50 border border-slate-600 rounded-xl p-4 ${className}`}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-slate-300 text-sm mb-1 block">
              Branch Label (optional):
            </label>
            <input
              type="text"
              value={branchLabel}
              onChange={(e) => setBranchLabel(e.target.value)}
              placeholder="e.g., 'Alternative approach', 'Deep dive'..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Create Branch
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
            This is a placeholder. The real feature will create branches based on your questions.
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
      title="Create a new learning branch from here (placeholder)"
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
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
      <span>Ask Question (Branch)</span>
    </button>
  );
};

