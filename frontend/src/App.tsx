/**
 * App.tsx
 *
 * Main application component for the infinite learning video experience.
 * Simplified architecture:
 * 1. Landing - User enters topic
 * 2. Video Flow - Continuous video segments with VideoController
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ClosingQuestionOverlay } from "./components/ClosingQuestionOverlay";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { InputOverlay } from "./components/InputOverlay";
import { LandingPage } from "./components/LandingPage";
import { LeafQuestionOverlay } from "./components/LeafQuestionOverlay";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { QuizQuestionOverlay } from "./components/QuizQuestionOverlay";
import { TreeExplorer } from "./components/TreeExplorer";
import { TreeVisualizer } from "./components/TreeVisualizer";
import { VideoController } from "./controllers/VideoController";
import { generateClosingQuestion } from "./services/llmService";
import {
  getAllNodes,
  getChildren,
  getNextNode,
  getPreviousNode,
  loadVideoSession,
  clearVideoSession,
} from "./types/TreeState";
import { ClosingQuestionPayload, VideoSession } from "./types/VideoConfig";

/**
 * App state types
 */
type AppState = "landing" | "learning" | "error" | "closing";

/**
 * Main App Component
 */
export const App: React.FC = () => {
  // App state machine
  const [appState, setAppState] = useState<AppState>("landing");
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  // Cached session from localStorage
  const [cachedSession, setCachedSession] = useState<VideoSession | null>(null);

  // Reference to the video element for programmatic control
  const videoRef = useRef<HTMLVideoElement>(null);
  const closingPayloadRef = useRef<ClosingQuestionPayload | null>(null);

  // Track when segment changes to restart playback
  const [segmentKey, setSegmentKey] = useState(0);

  // Closing question state
  const [closingQuestion, setClosingQuestion] = useState<string | null>(null);
  const [closingQuestionStatus, setClosingQuestionStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [closingQuestionError, setClosingQuestionError] = useState<string>("");
  const [closingQuestionAnswer, setClosingQuestionAnswer] =
    useState<string>("");

  const resetClosingQuestionState = useCallback(() => {
    setClosingQuestion(null);
    setClosingQuestionStatus("idle");
    setClosingQuestionError("");
    setClosingQuestionAnswer("");
    closingPayloadRef.current = null;
  }, []);

  // Leaf question state
  const [leafQuestion, setLeafQuestion] = useState<string | null>(null);
  const [leafQuestionStatus, setLeafQuestionStatus] = useState<
    "idle" | "loading" | "ready" | "evaluating" | "correct" | "incorrect" | "error"
  >("idle");
  const [leafQuestionAnswer, setLeafQuestionAnswer] = useState<string>("");
  const [leafEvaluationReasoning, setLeafEvaluationReasoning] = useState<string>("");

  const resetLeafQuestionState = useCallback(() => {
    setLeafQuestion(null);
    setLeafQuestionStatus("idle");
    setLeafQuestionAnswer("");
    setLeafEvaluationReasoning("");
  }, []);

  // ===== TEST MODE - EASILY REMOVABLE =====
  const [isTestMode, setIsTestMode] = useState(false);
  // ===== END TEST MODE =====

  // Tree explorer modal state
  const [showTreeExplorer, setShowTreeExplorer] = useState(false);

  // Auto-play toggle state (on by default)
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);

  // Track if user has seen a video (to prevent question overlay on initial mount)
  const [hasSeenFirstVideo, setHasSeenFirstVideo] = useState(false);

  /**
   * Check for cached session on mount
   * If found, skip landing page and go directly to learning state
   */
  useEffect(() => {
    const cached = loadVideoSession();
    if (cached) {
      console.log('Loaded cached session from localStorage');
      console.log('Cached tree has', cached.tree.nodes.size, 'nodes');
      console.log('Saved current node ID:', cached.tree.currentNodeId);
      
      // Validate the saved currentNodeId - only reset if it's invalid
      const isValidNode = cached.tree.currentNodeId && 
                         cached.tree.nodes.has(cached.tree.currentNodeId);
      
      if (!isValidNode) {
        // Only reset to first root if currentNodeId is empty or invalid
        if (cached.tree.rootIds.length > 0) {
          console.log('Invalid or missing currentNodeId, resetting to first root');
          cached.tree.currentNodeId = cached.tree.rootIds[0];
        } else {
          console.error('No root nodes found in cached tree!');
          return; // Don't load corrupted session
        }
      } else {
        console.log('Restoring user to saved position:', cached.tree.currentNodeId);
      }
      
      setCachedSession(cached);
      setCurrentTopic(cached.context.initialTopic || "Cached Session");
      setAppState("learning");
    }
  }, []);

  /**
   * Handle topic submission from landing page
   */
  const handleTopicSubmit = async (topic: string) => {
    resetClosingQuestionState();
    resetLeafQuestionState();
    setHasSeenFirstVideo(false); // Reset video tracking for new session
    clearVideoSession(); // Clear localStorage to force fresh generation
    setCachedSession(null); // Clear any cached session to force new generation
    setCurrentTopic(topic);
    setIsTestMode(false); // Normal mode
    setAppState("learning");
    setError("");
  };

  // ===== TEST MODE - EASILY REMOVABLE =====
  /**
   * Handle test mode activation with hardcoded data
   */
  const handleTestMode = () => {
    resetClosingQuestionState();
    setCurrentTopic("Test Topic: Understanding Machine Learning");
    setIsTestMode(true);
    setAppState("learning");
    setError("");
  };
  // ===== END TEST MODE =====

  /**
   * Handle errors from VideoController
   */
  const handleVideoError = (errorMsg: string) => {
    setError(errorMsg);
    setAppState("error");
  };

  /**
   * Handle retry after error
   */
  const handleRetry = () => {
    resetClosingQuestionState();
    if (currentTopic) {
      setAppState("learning");
      setError("");
    } else {
      setAppState("landing");
    }
  };

  /**
   * Return to landing page
   */
  const handleReset = () => {
    resetClosingQuestionState();
    resetLeafQuestionState();
    setHasSeenFirstVideo(false); // Reset video tracking
    clearVideoSession(); // Clear localStorage
    setCachedSession(null); // Clear cached session
    setAppState("landing");
    setCurrentTopic("");
    setError("");
    setIsTestMode(false); // Reset test mode
  };

  const executeClosingQuestionRequest = useCallback(
    async (payload: ClosingQuestionPayload) => {
      setClosingQuestionStatus("loading");
      setClosingQuestion(null);
      setClosingQuestionError("");

      try {
        console.log("Requesting closing question with payload:", payload);
        const response = await generateClosingQuestion(payload);
        console.log("Closing question response:", response);
        if (response.success && response.question) {
          setClosingQuestion(response.question);
          setClosingQuestionStatus("ready");
        } else {
          setClosingQuestionStatus("error");
          setClosingQuestionError(
            response.error || "Unable to generate closing question"
          );
        }
      } catch (err) {
        console.error("Closing question error:", err);
        setClosingQuestionStatus("error");
        setClosingQuestionError(
          err instanceof Error
            ? err.message
            : "Unknown error occurred while generating the closing question"
        );
      }
    },
    []
  );

  const requestClosingQuestion = useCallback(
    (sessionSnapshot: VideoSession) => {
      const topic =
        sessionSnapshot.context.initialTopic || currentTopic || "your lesson";

      // Get all nodes from the tree instead of segments array
      const allNodes = getAllNodes(sessionSnapshot.tree);

      const voiceoverSections = allNodes
        .map((node, index) => {
          const script = node.segment.voiceoverScript?.trim();
          if (!script) {
            return null;
          }
          return {
            section: index + 1,
            script,
          };
        })
        .filter(
          (item): item is ClosingQuestionPayload["voiceoverSections"][number] =>
            item !== null
        );

      const userResponses = allNodes
        .map((node, index) => {
          if (!node.segment.userAnswer) {
            return null;
          }

          const prompt =
            (node.segment.questionText && node.segment.questionText.trim()) ||
            `What resonated with you in segment ${index + 1}?`;

          return {
            prompt,
            answer: node.segment.userAnswer,
          };
        })
        .filter(
          (item): item is ClosingQuestionPayload["userResponses"][number] =>
            item !== null
        );

      const summary =
        sessionSnapshot.context.historyTopics &&
        sessionSnapshot.context.historyTopics.length > 0
          ? sessionSnapshot.context.historyTopics.join(" → ")
          : undefined;

      const payload: ClosingQuestionPayload = {
        topic,
        voiceoverSections,
        userResponses,
        summary,
      };

      closingPayloadRef.current = payload;
      setAppState("closing");
      void executeClosingQuestionRequest(payload);
    },
    [currentTopic, executeClosingQuestionRequest]
  );

  const handleRetryClosingQuestion = useCallback(() => {
    if (closingPayloadRef.current) {
      void executeClosingQuestionRequest(closingPayloadRef.current);
    }
  }, [executeClosingQuestionRequest]);

  // Render based on app state
  if (appState === "landing") {
    return (
      <LandingPage
        onSubmit={handleTopicSubmit}
        onTestMode={handleTestMode} // Pass test mode handler
      />
    );
  }

  if (appState === "error") {
    return <ErrorDisplay error={error} onRetry={handleRetry} />;
  }

  // Closing question state - show lightweight overlay
  if (appState === "closing") {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-950">
        <ClosingQuestionOverlay
          isOpen
          topic={
            currentTopic || closingPayloadRef.current?.topic || "Your lesson"
          }
          question={closingQuestion || undefined}
          answer={closingQuestionAnswer}
          onAnswerChange={(newAnswer) => {
            setClosingQuestionAnswer(newAnswer);
            console.log("Closing question answer:", newAnswer);
          }}
          isLoading={closingQuestionStatus === "loading"}
          error={
            closingQuestionStatus === "error" ? closingQuestionError : undefined
          }
          onRestart={handleReset}
          onRetry={
            closingQuestionStatus === "error"
              ? handleRetryClosingQuestion
              : undefined
          }
        />
      </div>
    );
  }

  // Learning state - show video flow
  if (appState === "learning" && currentTopic) {
    return (
      <div className="relative w-full h-screen flex bg-slate-900">
        <VideoController
          initialTopic={currentTopic}
          onError={handleVideoError}
          isTestMode={isTestMode} // Pass test mode flag
          initialSession={cachedSession || undefined} // Pass cached session if available
        >
          {({
            session,
            currentSegment,
            currentNodeNumber,
            isGenerating,
            error: videoError,
            requestNextSegment,
            requestNewTopic,
            navigateToNode,
            handleQuestionBranch,
            showQuiz,
            quizQuestion,
            quizResult,
            quizExplanation,
            isGeneratingQuiz,
            isEvaluating,
            handleQuizAnswer,
            triggerQuizQuestion,
            closeQuiz,
            createQuestionNode,
            handleLeafQuestionAnswer,
            goToSegment,
            activeGenerations,
            removeGenerationRequest,
          }) => {
            // Check if current node is a leaf (no children) - this means it's the last segment
            const isLastSegment =
              getChildren(session.tree, session.tree.currentNodeId).length ===
              0;

            // Debug info in console
            console.log("VideoController State:", {
              treeSize: session.tree.nodes.size,
              currentNode: session.tree.currentNodeId,
              currentSegment: currentSegment?.id,
              nodeNumber: currentNodeNumber,
              isGenerating,
              videoError,
              context: session.context,
              isLastSegment,
            });

            const handleVideoEnd = useCallback(() => {
              if (!currentSegment || isGenerating) {
                return;
              }

              // Check if this is a leaf node AND not already a question node
              // Also ensure we've actually played the video (not just mounted on a leaf node)
              if (isLastSegment && !currentSegment.isQuestionNode && hasSeenFirstVideo) {
                // Leaf video detected - create question node
                console.log('Leaf video ended, creating question node');
                createQuestionNode(session.tree.currentNodeId);
              } else if (isAutoPlayEnabled && !currentSegment.isQuestionNode) {
                // Auto-advance to next node (only for video nodes, not question nodes)
                const nextNode = getNextNode(
                  session.tree,
                  session.tree.currentNodeId
                );
                if (nextNode) {
                  navigateToNode(nextNode.id);
                }
              }
            }, [
              currentSegment,
              isGenerating,
              isLastSegment,
              createQuestionNode,
              session,
              isAutoPlayEnabled,
              navigateToNode,
              hasSeenFirstVideo,
            ]);

            // IMPORTANT: Call all hooks BEFORE any conditional returns
            // Effect to restart video when segment changes
            useEffect(() => {
              if (
                currentSegment &&
                currentSegment.videoUrl &&
                videoRef.current
              ) {
                setSegmentKey((prev) => prev + 1);
                videoRef.current.load();
                videoRef.current.play().catch(console.error);
              }
            }, [currentSegment?.id, currentSegment?.videoUrl]);

            // Check if video has ended and should auto-advance or trigger reflection
            useEffect(() => {
              if (!videoRef.current) return;

              videoRef.current.addEventListener("ended", handleVideoEnd);
              return () => {
                videoRef.current?.removeEventListener("ended", handleVideoEnd);
              };
            }, [handleVideoEnd]);

            // Preload next 2 videos for smooth playback
            useEffect(() => {
              if (!session.tree.currentNodeId) return;

              // Get next 2 nodes
              const videosToPreload: string[] = [];
              let currentNodeId = session.tree.currentNodeId;

              for (let i = 0; i < 2; i++) {
                const nextNode = getNextNode(session.tree, currentNodeId);
                if (nextNode && nextNode.segment.videoUrl) {
                  videosToPreload.push(nextNode.segment.videoUrl);
                  currentNodeId = nextNode.id;
                } else {
                  break;
                }
              }

              // Create hidden video elements to trigger preloading
              const preloadElements: HTMLVideoElement[] = [];
              videosToPreload.forEach((url) => {
                const video = document.createElement("video");
                video.src = url;
                video.preload = "auto";
                video.style.display = "none";
                document.body.appendChild(video);
                preloadElements.push(video);
              });

              // Cleanup preload elements
              return () => {
                preloadElements.forEach((video) => {
                  document.body.removeChild(video);
                });
              };
            }, [session.tree, session.tree.currentNodeId]);

            // Auto-open leaf question overlay when navigating to a question node
            // But NOT on initial mount - only when we actually navigate to a question node
            useEffect(() => {
              // Mark that we've seen a video segment (not on question nodes)
              if (currentSegment && !currentSegment.isQuestionNode) {
                setHasSeenFirstVideo(true);
              }
            }, [currentSegment?.id, currentSegment?.isQuestionNode]);
            
            useEffect(() => {
              if (currentSegment?.isQuestionNode && leafQuestionStatus === "idle" && hasSeenFirstVideo) {
                // Extract the question from the segment
                if (currentSegment.questionText) {
                  setLeafQuestion(currentSegment.questionText);
                  setLeafQuestionStatus("ready");
                  console.log("Auto-opening leaf question overlay");
                }
              } else if (!currentSegment?.isQuestionNode && leafQuestionStatus !== "idle") {
                // Reset state when leaving question node
                resetLeafQuestionState();
              }
            }, [currentSegment?.id, currentSegment?.isQuestionNode, currentSegment?.questionText, leafQuestionStatus, resetLeafQuestionState, hasSeenFirstVideo]);

            // NOW we can do conditional returns

            // Show loading spinner while generating first segment
            if (!currentSegment && isGenerating) {
              return (
                <div className="flex items-center justify-center w-full h-screen">
                  <LoadingSpinner />
                </div>
              );
            }

            // Show error if something went wrong
            if (videoError) {
              return (
                <div className="flex items-center justify-center w-full h-screen">
                  <ErrorDisplay error={videoError} onRetry={handleRetry} />
                </div>
              );
            }

            // No segment yet and not generating - show waiting state
            if (!currentSegment) {
              return (
                <div className="flex items-center justify-center w-full h-screen">
                  <div className="text-white text-center">
                    <div className="text-2xl mb-4">
                      Preparing your learning experience...
                    </div>
                    <LoadingSpinner />
                  </div>
                </div>
              );
            }

            return (
              <>
                {/* Quiz Question Overlay */}
                <QuizQuestionOverlay
                  isOpen={showQuiz}
                  question={quizQuestion || ''}
                  isLoading={isGeneratingQuiz}
                  isEvaluating={isEvaluating}
                  error={videoError || undefined}
                  result={quizResult}
                  explanation={quizExplanation || undefined}
                  onSubmitAnswer={handleQuizAnswer}
                  onContinue={closeQuiz}
                  onRestart={handleReset}
                />

                {/* Leaf Question Overlay */}
                <LeafQuestionOverlay
                  isOpen={leafQuestionStatus !== 'idle'}
                  question={leafQuestion || undefined}
                  status={leafQuestionStatus}
                  answer={leafQuestionAnswer}
                  reasoning={leafEvaluationReasoning}
                  error={videoError || undefined}
                  onAnswerChange={setLeafQuestionAnswer}
                  onSubmit={async (ans) => {
                    if (!leafQuestion) return;
                    setLeafQuestionStatus('evaluating');
                    const result = await handleLeafQuestionAnswer(leafQuestion, ans);
                    if (result.success) {
                      if (result.correct) {
                        setLeafQuestionStatus('correct');
                        setLeafEvaluationReasoning(result.reasoning || '');
                      } else {
                        setLeafQuestionStatus('incorrect');
                        setLeafEvaluationReasoning(result.reasoning || '');
                      }
                    } else {
                      setLeafQuestionStatus('error');
                    }
                  }}
                  onContinue={() => {
                    resetLeafQuestionState();
                    // If on question node, try to navigate to next or show message
                    if (currentSegment?.isQuestionNode) {
                      const nextNode = getNextNode(session.tree, session.tree.currentNodeId);
                      if (nextNode) {
                        navigateToNode(nextNode.id);
                      }
                    }
                  }}
                  onRetry={() => {
                    setLeafQuestionStatus('ready');
                    setLeafQuestionAnswer('');
                  }}
                  onStartOver={handleReset}
                />

                {/* Left Sidebar */}
                <div className="w-80 h-screen bg-slate-800 border-r border-slate-700 flex flex-col">
                  {/* Sidebar Header */}
                  <div className="p-4 border-b border-slate-700">
                    <button
                      onClick={handleReset}
                      className="w-full bg-slate-700/80 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-all border border-slate-600 hover:border-slate-500 flex items-center justify-center gap-2"
                      title="Return to home"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      <span>Home</span>
                    </button>
                  </div>

                  {/* Topic Display */}
                  <div className="px-4 py-3 border-b border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Currently Learning</div>
                    <div className="font-semibold text-blue-400 text-sm">
                      {currentSegment.topic}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Node: {currentNodeNumber}
                    </div>
                  </div>

                  {/* Sidebar Content - Input Controls */}
                  <div className="flex-1 overflow-y-auto">
                    <InputOverlay
                      hasQuestion={currentSegment.hasQuestion}
                      questionText={currentSegment.questionText}
                      isGenerating={isGenerating}
                      isEvaluating={false}
                      onAnswer={() => Promise.resolve()}
                      onRequestNext={requestNextSegment}
                      onNewTopic={requestNewTopic}
                      onReset={handleReset}
                      onAskQuestion={handleQuestionBranch}
                      currentNodeNumber={currentNodeNumber}
                      activeGenerations={activeGenerations}
                      onNavigateToGeneration={navigateToNode}
                      onDismissGeneration={removeGenerationRequest}
                    />
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center relative p-4">
                  {/* Video Player Container with Navigation */}
                  <div className="flex items-center gap-4 mb-4">
                  {/* Previous Button */}
                  <button
                    onClick={() => {
                      const prevNode = getPreviousNode(
                        session.tree,
                        session.tree.currentNodeId
                      );
                      if (prevNode) {
                        navigateToNode(prevNode.id);
                      }
                    }}
                    disabled={
                      !getPreviousNode(session.tree, session.tree.currentNodeId)
                    }
                    className={`p-3 rounded-full transition-all ${
                      getPreviousNode(session.tree, session.tree.currentNodeId)
                        ? "bg-slate-700/80 hover:bg-slate-600 text-white cursor-pointer"
                        : "bg-slate-800/40 text-slate-600 cursor-not-allowed"
                    }`}
                    title="Previous video"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  {/* Video Player */}
                  <div
                    className="relative shadow-2xl rounded-lg overflow-hidden bg-black"
                    style={{ width: "calc(100vw - 400px)", maxWidth: "1280px" }}
                  >
                    {currentSegment.isQuestionNode ? (
                      <div
                        className="flex items-center justify-center bg-gradient-to-br from-yellow-900/30 to-slate-900"
                        style={{ width: "100%", height: "450px" }}
                      >
                        <div className="text-center text-white px-8">
                          <div className="text-6xl mb-4">❓</div>
                          <div className="text-2xl mb-2 font-semibold text-yellow-400">
                            Knowledge Check
                          </div>
                          <div className="text-lg text-slate-300">
                            Answer the question below to continue your learning journey
                          </div>
                        </div>
                      </div>
                    ) : currentSegment.videoUrl ? (
                      <video
                        key={segmentKey}
                        ref={videoRef}
                        src={currentSegment.videoUrl}
                        controls
                        autoPlay
                        className="w-full h-auto"
                        style={{
                          maxHeight: "80vh",
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : currentSegment.renderingStatus === "rendering" ||
                      currentSegment.renderingStatus === "pending" ? (
                      <div
                        className="flex items-center justify-center"
                        style={{ width: "100%", height: "450px" }}
                      >
                        <div className="text-center text-white">
                          <LoadingSpinner />
                          <div className="mt-4 text-lg">Rendering video...</div>
                          <div className="mt-2 text-sm text-slate-400">
                            This may take a minute
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ width: "100%", height: "450px" }}
                      >
                        <div className="text-center text-white">
                          <div className="text-lg mb-2">
                            Video not available
                          </div>
                          <div className="text-sm text-slate-400">
                            Rendering status:{" "}
                            {currentSegment.renderingStatus || "unknown"}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-play Toggle Overlay */}
                    <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2 text-sm z-10">
                      <span className="text-slate-300">Auto-play</span>
                      <button
                        onClick={() => setIsAutoPlayEnabled(!isAutoPlayEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isAutoPlayEnabled ? "bg-blue-600" : "bg-slate-600"
                        }`}
                        title={
                          isAutoPlayEnabled
                            ? "Disable auto-play"
                            : "Enable auto-play"
                        }
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isAutoPlayEnabled
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => {
                      const nextNode = getNextNode(
                        session.tree,
                        session.tree.currentNodeId
                      );
                      if (nextNode) {
                        navigateToNode(nextNode.id);
                      }
                    }}
                    disabled={
                      !getNextNode(session.tree, session.tree.currentNodeId)
                    }
                    className={`p-3 rounded-full transition-all ${
                      getNextNode(session.tree, session.tree.currentNodeId)
                        ? "bg-slate-700/80 hover:bg-slate-600 text-white cursor-pointer"
                        : "bg-slate-800/40 text-slate-600 cursor-not-allowed"
                    }`}
                    title="Next video"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                  {/* Tree Visualizer - horizontal minimap below video */}
                  {session.tree.nodes.size > 0 && (
                    <div style={{ width: 'calc(100vw - 400px)', maxWidth: '1280px' }}>
                      <TreeVisualizer
                        tree={session.tree}
                        onExpandClick={() => setShowTreeExplorer(true)}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Tree Explorer Modal */}
                  {showTreeExplorer && (
                    <TreeExplorer
                      tree={session.tree}
                      onNodeClick={(nodeId) => {
                        navigateToNode(nodeId);
                        setShowTreeExplorer(false);
                      }}
                      onClose={() => setShowTreeExplorer(false)}
                    />
                  )}
                </div>
              </>
            );
          }}
        </VideoController>
      </div>
    );
  }

  // Fallback
  return <div>Loading...</div>;
};
