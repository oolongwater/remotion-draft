/**
 * ErrorDisplay.tsx
 * 
 * Display error messages from LLM API failures or validation errors.
 */

import React from 'react';

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-2xl p-8 border border-red-500/30">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        
        {/* Error Title */}
        <h2 className="text-2xl font-bold text-center mb-4 text-red-400">
          Oops! Something went wrong
        </h2>
        
        {/* Error Message */}
        <p className="text-slate-300 text-center mb-6 leading-relaxed">
          {error}
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <button
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 transform hover:scale-105"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Start Over
          </button>
        </div>
        
        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <p className="text-sm text-slate-500 text-center">
            If the problem persists, check your API key configuration or try a different topic.
          </p>
        </div>
      </div>
    </div>
  );
};

