/**
 * QuizQuestionOverlay.tsx
 * 
 * Displays a quiz question as a leaf node with answer evaluation.
 * Shows congratulations on correct answer or generates explanation video on wrong answer.
 */

import { FC, useState } from 'react';

interface QuizQuestionOverlayProps {
  isOpen: boolean;
  question: string;
  isLoading?: boolean;
  isEvaluating?: boolean;
  error?: string;
  result?: 'correct' | 'incorrect' | null;
  explanation?: string;
  onSubmitAnswer: (answer: string) => Promise<void>;
  onContinue: () => void;
  onRestart: () => void;
}

export const QuizQuestionOverlay: FC<QuizQuestionOverlayProps> = ({
  isOpen,
  question,
  isLoading = false,
  isEvaluating = false,
  error,
  result,
  explanation,
  onSubmitAnswer,
  onContinue,
  onRestart,
}) => {
  const [answer, setAnswer] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim() && !isEvaluating) {
      await onSubmitAnswer(answer.trim());
    }
  };

  // Show congratulations if correct
  if (result === 'correct') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur">
        <div className="w-full max-w-2xl rounded-3xl border border-green-500/40 bg-slate-900/90 p-8 shadow-2xl">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 border-2 border-green-500">
              <svg
                className="h-10 w-10 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-green-400 mb-4">
              Congratulations! 🎉
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              You answered correctly! Great job understanding the material.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onContinue}
                className="rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Continue Learning
              </button>
              <button
                onClick={onRestart}
                className="rounded-xl border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-600/60 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if evaluation failed
  if (error && !isLoading && !isEvaluating && !result) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur">
        <div className="w-full max-w-2xl rounded-3xl border border-red-500/40 bg-slate-900/90 p-8 shadow-2xl">
          <div className="text-center">
            {/* Error Icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 border-2 border-red-500">
              <svg
                className="h-10 w-10 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-red-400 mb-4">
              Oops! Something went wrong
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              {error}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onContinue}
                className="rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Try Again
              </button>
              <button
                onClick={onRestart}
                className="rounded-xl border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-600/60 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Start Over
              </button>
            </div>

            <p className="mt-6 text-xs text-slate-500">
              If the problem persists, check your API key configuration or try a different topic.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show "uh oh" message if incorrect
  if (result === 'incorrect') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur">
        <div className="w-full max-w-2xl rounded-3xl border border-red-500/40 bg-slate-900/90 p-8 shadow-2xl">
          <div className="text-center">
            {/* Error Icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 border-2 border-red-500">
              <svg
                className="h-10 w-10 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <h2 className="text-3xl font-bold text-red-400 mb-4">
              Uh Oh! 😅
            </h2>
            <p className="text-lg text-slate-300 mb-4">
              Not quite right, but that's okay! Let's learn from this.
            </p>

            {/* Explanation */}
            {explanation && (
              <div className="rounded-2xl border border-slate-700 bg-slate-800/60 px-6 py-4 mb-8 text-left">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">
                  Explanation
                </h3>
                <p className="text-base text-slate-200 leading-relaxed">
                  {explanation}
                </p>
              </div>
            )}

            <button
              onClick={onRestart}
              className="rounded-xl bg-slate-700 px-8 py-3 text-base font-semibold text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500/60 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz question form
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
        <header className="mb-6">
          <p className="text-sm uppercase tracking-[0.35em] text-blue-400">
            Quiz Question
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Test Your Understanding
          </h1>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4" />
            <p className="text-slate-400">Generating quiz question...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-8 text-center">
            <p className="text-base font-semibold text-red-300 mb-4">
              Failed to generate quiz question
            </p>
            <p className="text-sm text-red-200/80 mb-6">{error}</p>
            <button
              onClick={onRestart}
              className="rounded-xl border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-600/60 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Start New Topic
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-8 shadow-inner">
              <h2 className="text-2xl font-semibold text-white leading-relaxed mb-6">
                {question}
              </h2>
              
              <div className="mt-6">
                <label htmlFor="quiz-answer" className="block text-sm font-medium text-slate-300 mb-2">
                  Your Answer
                </label>
                <textarea
                  id="quiz-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={4}
                  disabled={isEvaluating}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Answer based on what you learned in this lesson.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onRestart}
                className="w-full rounded-xl border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-600/60 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto"
              >
                Skip Quiz
              </button>
              <button
                type="submit"
                disabled={!answer.trim() || isEvaluating}
                className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
              >
                {isEvaluating ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Checking Answer...
                  </span>
                ) : (
                  'Submit Answer'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

