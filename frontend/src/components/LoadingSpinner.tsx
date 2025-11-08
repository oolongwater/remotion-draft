/**
 * LoadingSpinner.tsx
 * 
 * Loading animation displayed while LLM generates the video configuration.
 */

import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="relative">
        {/* Spinning circle */}
        <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
        
        {/* Pulsing inner circle */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-blue-500 rounded-full animate-pulse opacity-50"></div>
      </div>
      
      <div className="mt-8 space-y-2 text-center">
        <h2 className="text-2xl font-bold text-blue-400">Generating Your Lesson</h2>
        <p className="text-slate-400">Our AI is creating a personalized learning experience...</p>
        
        {/* Progress dots */}
        <div className="flex justify-center space-x-2 pt-4">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

