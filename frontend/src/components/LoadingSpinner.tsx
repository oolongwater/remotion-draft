/**
 * LoadingSpinner.tsx
 * 
 * Beautiful loading animation displayed while LLM generates the video configuration.
 */

import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Animated gradient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Main content */}
      <div className="relative z-10">
        {/* Multi-layered spinner */}
        <div className="relative w-32 h-32 mx-auto">
          {/* Outer ring */}
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-blue-400 rounded-full animate-spin" />
          
          {/* Middle ring */}
          <div className="absolute inset-3 border-4 border-transparent border-b-purple-500 border-l-purple-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
          
          {/* Inner glow */}
          <div className="absolute inset-6 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-full animate-pulse" />
          
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full shadow-lg shadow-blue-500/50" />
        </div>
        
        {/* Text content */}
        <div className="mt-12 space-y-3 text-center max-w-md mx-auto px-4">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent animate-pulse">
            Generating Your Lesson
          </h2>
          <p className="text-slate-300 text-lg">
            Our AI is crafting a personalized learning experience...
          </p>
          
          {/* Animated progress dots */}
          <div className="flex justify-center space-x-2 pt-6">
            <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full animate-bounce shadow-lg shadow-purple-500/50" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

