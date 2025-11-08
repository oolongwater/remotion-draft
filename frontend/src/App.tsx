/**
 * App.tsx
 *
 * Main application component for the infinite learning video experience.
 * Simplified architecture:
 * 1. Landing - User enters topic
 * 2. Video Flow - Continuous video segments with VideoController
 */

import { useEffect, useRef, useState } from "react";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { InputOverlay } from "./components/InputOverlay";
import { LandingPage } from "./components/LandingPage";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { TreeExplorer } from "./components/TreeExplorer";
import { TreeVisualizer } from "./components/TreeVisualizer";
import { VideoController } from "./controllers/VideoController";
import { getNextNode, getPreviousNode } from "./types/TreeState";

/**
 * App state types
 */
type AppState = "landing" | "learning" | "error";

/**
 * Main App Component
 */
export const App: React.FC = () => {
  // App state machine
  const [appState, setAppState] = useState<AppState>("landing");
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Reference to the video element for programmatic control
  const videoRef = useRef<HTMLVideoElement>(null);

  // Track when segment changes to restart playback
  const [segmentKey, setSegmentKey] = useState(0);

  // ===== TEST MODE - EASILY REMOVABLE =====
  const [isTestMode, setIsTestMode] = useState(false);
  // ===== END TEST MODE =====

  // Tree explorer modal state
  const [showTreeExplorer, setShowTreeExplorer] = useState(false);

  // Auto-play toggle state (on by default)
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true);

  /**
   * Handle topic submission from landing page
   */
  const handleTopicSubmit = async (topic: string) => {
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
    setAppState("landing");
    setCurrentTopic("");
    setError("");
    setIsTestMode(false); // Reset test mode
  };

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

  // Learning state - show video flow
  if (appState === "learning" && currentTopic) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
        <VideoController
          initialTopic={currentTopic}
          onError={handleVideoError}
          isTestMode={isTestMode} // Pass test mode flag
        >
          {({
            session,
            currentSegment,
            currentNodeNumber,
            isGenerating,
            isEvaluating,
            error: videoError,
            handleAnswer,
            requestNextSegment,
            requestNewTopic,
            navigateToNode,
            handleQuestionBranch,
          }) => {
            // Debug info in console
            console.log("VideoController State:", {
              treeSize: session.tree.nodes.size,
              currentNode: session.tree.currentNodeId,
              currentSegment: currentSegment?.id,
              nodeNumber: currentNodeNumber,
              isGenerating,
              videoError,
              context: session.context,
            });

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

            // Check if video has ended and should auto-advance
            useEffect(() => {
              if (!videoRef.current) return;

              const handleVideoEnd = () => {
                console.log("Video ended");
                console.log("Auto-play conditions:", {
                  isAutoPlayEnabled,
                  hasCurrentSegment: !!currentSegment,
                  hasQuestion: currentSegment?.hasQuestion,
                  isGenerating,
                });

                console.log(isAutoPlayEnabled, currentSegment, !isGenerating);
                if (isAutoPlayEnabled && currentSegment && !isGenerating) {
                  console.log("Navigating to next node");
                  const nextNode = getNextNode(
                    session.tree,
                    session.tree.currentNodeId
                  );
                  console.log("Next node:", nextNode?.id);
                  if (nextNode) {
                    console.log("Navigating to node:", nextNode.id);
                    navigateToNode(nextNode.id);
                  } else {
                    console.log("No next node found");
                  }
                } else {
                  console.log("Auto-play conditions not met");
                }
              };

              videoRef.current.addEventListener("ended", handleVideoEnd);
              return () => {
                videoRef.current?.removeEventListener("ended", handleVideoEnd);
              };
            }, [
              segmentKey,
              currentSegment,
              isGenerating,
              navigateToNode,
              isAutoPlayEnabled,
              session.tree,
            ]);

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
                {/* Topic and progress display */}
                <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm z-50 border border-slate-700">
                  <div>
                    <span className="text-slate-400">Learning: </span>
                    <span className="font-semibold text-blue-400">
                      {currentSegment.topic}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400">Node: </span>
                    <span className="text-slate-300">{currentNodeNumber}</span>
                    <span className="ml-2 text-slate-400">Depth: </span>
                    <span className="text-slate-300">
                      {session.context.depth}
                    </span>
                  </div>
                </div>

                {/* Tree Visualizer - mini tree preview */}
                {session.tree.nodes.size > 0 && (
                  <TreeVisualizer
                    tree={session.tree}
                    onExpandClick={() => setShowTreeExplorer(true)}
                    className="absolute top-4 right-4 z-50"
                  />
                )}

                {/* Video Player Container with Navigation */}
                <div className="flex items-center gap-4">
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
                    style={{ width: "90vw", maxWidth: "1280px" }}
                  >
                    {currentSegment.videoUrl ? (
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

                {/* Input Overlay - shown when segment has a question or when loading next */}
                <InputOverlay
                  hasQuestion={currentSegment.hasQuestion}
                  questionText={currentSegment.questionText}
                  isGenerating={isGenerating}
                  isEvaluating={isEvaluating}
                  onAnswer={handleAnswer}
                  onRequestNext={requestNextSegment}
                  onNewTopic={requestNewTopic}
                  onReset={handleReset}
                  onAskQuestion={handleQuestionBranch}
                  currentNodeNumber={currentNodeNumber}
                />

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
