/**
 * LandingPage.tsx
 * 
 * Landing page where users enter the topic they want to learn about.
 */

import React, { useState } from 'react';

interface LandingPageProps {
  onSubmit: (topic: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSubmit }) => {
  const [topic, setTopic] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onSubmit(topic.trim());
    }
  };
  
  // Example topics for inspiration
  const exampleTopics = [
    'React Hooks',
    'Binary Search Trees',
    'Photosynthesis',
    'Quantum Computing',
    'Shakespeare\'s Sonnets',
    'Machine Learning',
  ];
  
  const handleExampleClick = (exampleTopic: string) => {
    setTopic(exampleTopic);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Main Content */}
        <div className="text-center mb-12 space-y-6">
          {/* Title */}
          <h1 className="text-6xl font-bold text-white mb-4 animate-fade-in">
            Learn Anything
          </h1>
          
          {/* Subtitle */}
          <p className="text-2xl text-blue-300 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            What do you want to learn today?
          </p>
          
          <p className="text-slate-400 max-w-lg mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
            Enter any topic and our AI will create a personalized, interactive video lesson just for you.
          </p>
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="e.g., React Hooks, Quantum Physics, Ancient Rome..."
              className={`w-full px-6 py-5 text-lg bg-slate-800/50 backdrop-blur-sm text-white placeholder-slate-500 rounded-xl border-2 transition-all duration-300 focus:outline-none ${
                isFocused ? 'border-blue-500 shadow-lg shadow-blue-500/30' : 'border-slate-700'
              }`}
            />
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={!topic.trim()}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-8 py-3 rounded-lg font-semibold transition-all duration-300 ${
                topic.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 shadow-lg'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              Generate
            </button>
          </div>
        </form>
        
        {/* Example Topics */}
        <div className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <p className="text-slate-500 text-sm mb-4 text-center">Or try one of these:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {exampleTopics.map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/70 text-slate-300 hover:text-white rounded-lg text-sm transition-all duration-200 border border-slate-700 hover:border-blue-500/50 backdrop-blur-sm"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
        
        {/* Feature Highlights */}
        <div className="mt-16 grid grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '1s' }}>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">AI-Powered</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">Interactive</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm">Personalized</p>
          </div>
        </div>
      </div>
      
      {/* Add CSS animation */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};

