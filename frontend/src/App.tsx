/**
 * App.tsx
 * 
 * Main application component for the infinite learning video experience.
 * Simplified architecture:
 * 1. Landing - User enters topic
 * 2. Video Flow - Continuous video segments with VideoController
 */

import { useEffect, useRef, useState } from "react";
import { VideoController } from "./controllers/VideoController";
import { InputOverlay } from "./components/InputOverlay";
import { LandingPage } from "./components/LandingPage";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { SegmentationOverlay, SegmentationLoading } from "./components/SegmentationOverlay";
import { handleVideoSegmentation, SegmentationMask } from "./services/segmentationService";
import { getLabelFromManimCode } from "./utils/manimCodeParser";

/**
 * App state types
 */
type AppState = 'landing' | 'learning' | 'error';

/**
 * Main App Component
 */
export const App: React.FC = () => {
  // App state machine
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  // Reference to the video element for programmatic control
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Track when segment changes to restart playback
  const [segmentKey, setSegmentKey] = useState(0);
  
  // Segmentation state (always enabled)
  const [segmentationMasks, setSegmentationMasks] = useState<SegmentationMask[] | null>(null);
  const [segmentationLabel, setSegmentationLabel] = useState<string | undefined>(undefined);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [videoDisplaySize, setVideoDisplaySize] = useState({ width: 0, height: 0 });
  const [videoActualSize, setVideoActualSize] = useState({ width: 0, height: 0 });
  const [currentManimCode, setCurrentManimCode] = useState<string>('');
  
  // ===== TEST MODE - EASILY REMOVABLE =====
  const [isTestMode, setIsTestMode] = useState(false);
  // ===== END TEST MODE =====

  /**
   * Handle topic submission from landing page
   */
  const handleTopicSubmit = async (topic: string) => {
    setCurrentTopic(topic);
    setIsTestMode(false); // Normal mode
    setAppState('learning');
    setError('');
  };
  
  // ===== TEST MODE - EASILY REMOVABLE =====
  /**
   * Handle test mode activation with hardcoded data
   */
  const handleTestMode = () => {
    setCurrentTopic('Test Topic: Understanding Machine Learning');
    setIsTestMode(true);
    setAppState('learning');
    setError('');
  };
  // ===== END TEST MODE =====
  
  /**
   * Handle errors from VideoController
   */
  const handleVideoError = (errorMsg: string) => {
    setError(errorMsg);
    setAppState('error');
  };
  
  /**
   * Handle retry after error
   */
  const handleRetry = () => {
    if (currentTopic) {
      setAppState('learning');
      setError('');
    } else {
      setAppState('landing');
    }
  };
  
  /**
   * Return to landing page
   */
  const handleReset = () => {
    setAppState('landing');
    setCurrentTopic('');
    setError('');
    setIsTestMode(false); // Reset test mode
    setSegmentationMasks(null);
  };
  
  /**
   * Check if clicked area is mostly black background
   */
  const isBlackBackground = (video: HTMLVideoElement, x: number, y: number): boolean => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      // Sample a small area around the click point
      const sampleSize = 20;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      
      // Calculate sampling position
      const rect = video.getBoundingClientRect();
      const videoX = ((x - rect.left) / rect.width) * video.videoWidth;
      const videoY = ((y - rect.top) / rect.height) * video.videoHeight;
      
      // Draw the sample area
      ctx.drawImage(
        video,
        videoX - sampleSize / 2,
        videoY - sampleSize / 2,
        sampleSize,
        sampleSize,
        0,
        0,
        sampleSize,
        sampleSize
      );
      
      // Get pixel data
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const data = imageData.data;
      
      // Calculate average brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalBrightness += (r + g + b) / 3;
      }
      const avgBrightness = totalBrightness / (sampleSize * sampleSize);
      
      // Consider it black if average brightness is less than 15 (out of 255)
      return avgBrightness < 15;
    } catch (error) {
      console.log('Could not check background color:', error);
      return false;
    }
  };
  
  /**
   * Handle video container click for segmentation
   * Always triggers segmentation (mode always enabled)
   */
  const handleVideoContainerClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    
    // Check if clicked on black background - clear segmentation if active
    if (isBlackBackground(video, event.clientX, event.clientY)) {
      console.log('⚫ Clicked on black background');
      if (segmentationMasks) {
        console.log('   Clearing segmentation');
        setSegmentationMasks(null);
        setSegmentationLabel(undefined);
      }
      return;
    }
    
    // Update display size right before segmentation
    const rect = video.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setVideoDisplaySize({
        width: rect.width,
        height: rect.height,
      });
      console.log('📐 Pre-segmentation video display size:', rect.width, 'x', rect.height);
    }
    
    // Clear previous segmentation
    setSegmentationMasks(null);
    setIsSegmenting(true);
    
    try {
      // Perform segmentation
      const result = await handleVideoSegmentation(event, video);
      
      if (result && result.success && result.masks) {
        setSegmentationMasks(result.masks);
        
        // Store video dimensions for overlay
        if (result.image_size) {
          setVideoActualSize({
            width: result.image_size.width,
            height: result.image_size.height,
          });
          console.log('📐 Video actual size from API:', result.image_size.width, 'x', result.image_size.height);
        }
        
        // Get contextual label from Manim code metadata
        const currentTime = video.currentTime;
        const rect = video.getBoundingClientRect();
        
        // Get normalized click coordinates
        const normalizedX = (event.clientX - rect.left) / rect.width;
        const normalizedY = (event.clientY - rect.top) / rect.height;
        
        // Try to get label from Manim code first (most accurate)
        let label = getLabelFromManimCode(
          currentManimCode,
          normalizedX,
          normalizedY,
          currentTime
        );
        
        if (label) {
          console.log('🏷️  Object label from Manim code:', label);
        }
        
        // Fallback to keyword-based if Manim parsing fails
        if (!label && currentTopic) {
          label = getContextualLabel(currentTopic, currentTime);
          if (label) {
            console.log('🏷️  Object label from keyword fallback:', label);
          }
        }
        
        if (!label) {
          console.log('⚠️  No label found for this object');
        }
        
        setSegmentationLabel(label);
      } else {
        console.error('Segmentation failed:', result?.error);
      }
    } catch (error) {
      console.error('Error in video segmentation:', error);
    } finally {
      setIsSegmenting(false);
    }
  };
  
  /**
   * Extract potential object labels from video context and timestamp
   * Uses topic, segment content, and current timestamp to guess what object was clicked
   */
  const getContextualLabel = (topic: string, currentTime: number): string | undefined => {
    if (!topic) return undefined;
    
    // Common educational topics and their associated objects
    const topicKeywords: Record<string, string[]> = {
      // Biology
      'cell': ['nucleus', 'mitochondria', 'chloroplast', 'ribosome', 'cell membrane', 'cytoplasm', 'endoplasmic reticulum', 'golgi apparatus'],
      'photosynthesis': ['chloroplast', 'thylakoid', 'stroma', 'chlorophyll', 'carbon dioxide', 'glucose', 'oxygen'],
      'respiration': ['mitochondria', 'ATP', 'glucose', 'oxygen', 'carbon dioxide'],
      'dna': ['nucleotide', 'base pair', 'helix', 'adenine', 'thymine', 'guanine', 'cytosine', 'sugar', 'phosphate'],
      'protein': ['amino acid', 'ribosome', 'peptide bond', 'enzyme', 'protein structure'],
      
      // Chemistry
      'atom': ['proton', 'neutron', 'electron', 'nucleus', 'electron shell', 'orbital'],
      'molecule': ['atom', 'bond', 'oxygen', 'hydrogen', 'carbon', 'nitrogen'],
      'reaction': ['reactant', 'product', 'catalyst', 'energy', 'activation energy'],
      
      // Physics
      'circuit': ['resistor', 'capacitor', 'battery', 'wire', 'current', 'voltage'],
      'wave': ['wavelength', 'amplitude', 'frequency', 'crest', 'trough'],
      'force': ['mass', 'acceleration', 'velocity', 'momentum', 'energy'],
      
      // Math
      'graph': ['axis', 'point', 'line', 'curve', 'vertex', 'edge'],
      'triangle': ['vertex', 'side', 'angle', 'hypotenuse', 'base', 'height'],
      'circle': ['radius', 'diameter', 'circumference', 'center', 'arc', 'chord'],
    };
    
    const topicLower = topic.toLowerCase();
    
    // Find matching keywords
    let candidates: string[] = [];
    for (const [key, objects] of Object.entries(topicKeywords)) {
      if (topicLower.includes(key)) {
        candidates.push(...objects);
      }
    }
    
    // If we have candidates, return a semi-random one based on timestamp
    // This creates pseudo-consistent labeling (same timestamp = same label)
    if (candidates.length > 0) {
      const index = Math.floor(currentTime * 1.5) % candidates.length;
      const label = candidates[index];
      console.log(`🏷️ Context label: "${label}" (from topic: "${topic}", time: ${currentTime.toFixed(1)}s)`);
      return label.charAt(0).toUpperCase() + label.slice(1); // Capitalize
    }
    
    return undefined;
  };

  // Render based on app state
  if (appState === 'landing') {
    return (
      <LandingPage 
        onSubmit={handleTopicSubmit}
        onTestMode={handleTestMode} // Pass test mode handler
      />
    );
  }
  
  if (appState === 'error') {
    return <ErrorDisplay error={error} onRetry={handleRetry} />;
  }
  
  // Learning state - show video flow
  if (appState === 'learning' && currentTopic) {
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
            isGenerating,
            isEvaluating,
            error: videoError,
            handleAnswer,
            requestNextSegment,
            requestNewTopic,
            goToSegment,
          }) => {
            // Debug info in console
            console.log('VideoController State:', {
              hasSegments: session.segments.length,
              currentSegment: currentSegment?.id,
              isGenerating,
              videoError,
              context: session.context,
            });
            
            // IMPORTANT: Call all hooks BEFORE any conditional returns
            // Effect to restart video when segment changes
            useEffect(() => {
              if (currentSegment && currentSegment.videoUrl && videoRef.current) {
                console.log('🎬 Segment changed, loading new segment data...');
                console.log('   Segment ID:', currentSegment.id);
                console.log('   Has manimCode:', !!currentSegment.manimCode);
                console.log('   Has topic:', !!currentSegment.topic);
                
                setSegmentKey((prev) => prev + 1);
                videoRef.current.load();
                videoRef.current.play().catch(console.error);
                
                // Update current Manim code for precise object identification
                const manimCode = currentSegment.manimCode || '';
                const topic = currentSegment.topic || '';
                setCurrentManimCode(manimCode);
                setCurrentTopic(topic);
                console.log('📝 Loaded segment code:');
                console.log('   Manim code length:', manimCode.length, 'chars');
                console.log('   Topic:', topic);
                if (manimCode.length > 0) {
                  console.log('   Code preview:', manimCode.substring(0, 200) + '...');
                } else {
                  console.warn('   ⚠️  WARNING: Manim code is empty!');
                }
                
                // Clear segmentation when segment changes
                setSegmentationMasks(null);
                setSegmentationLabel(undefined);
              }
            }, [currentSegment?.id, currentSegment?.videoUrl]);
            
            // Effect to track video display size for segmentation overlay
            useEffect(() => {
              const video = videoRef.current;
              if (!video) return;
              
              const updateVideoSize = () => {
                const rect = video.getBoundingClientRect();
                console.log('📐 Updating video size from rect:', rect);
                
                // Only update if we have valid dimensions
                if (rect.width > 0 && rect.height > 0) {
                  setVideoDisplaySize({
                    width: rect.width,
                    height: rect.height,
                  });
                  console.log('✓ Video display size set to:', rect.width, 'x', rect.height);
                } else {
                  console.log('⚠️ Video rect has 0 dimensions, will retry...');
                }
              };
              
              // Update on load and resize
              video.addEventListener('loadedmetadata', updateVideoSize);
              video.addEventListener('loadeddata', updateVideoSize);
              window.addEventListener('resize', updateVideoSize);
              
              // Try multiple times to catch when video is actually rendered
              updateVideoSize(); // Immediate
              setTimeout(updateVideoSize, 100); // After 100ms
              setTimeout(updateVideoSize, 500); // After 500ms
              
              return () => {
                video.removeEventListener('loadedmetadata', updateVideoSize);
                video.removeEventListener('loadeddata', updateVideoSize);
                window.removeEventListener('resize', updateVideoSize);
              };
            }, [currentSegment?.videoUrl]);
            
            // Check if video has ended and should auto-advance
            useEffect(() => {
              if (!videoRef.current) return;
              
              const handleVideoEnd = () => {
                if (currentSegment && !currentSegment.hasQuestion && !isGenerating) {
                  requestNextSegment();
                }
              };
              
              videoRef.current.addEventListener('ended', handleVideoEnd);
              return () => {
                videoRef.current?.removeEventListener('ended', handleVideoEnd);
              };
            }, [currentSegment, isGenerating, requestNextSegment]);
            
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
                    <div className="text-2xl mb-4">Preparing your learning experience...</div>
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
                    <span className="font-semibold text-blue-400">{currentSegment.topic}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-slate-400">Segment: </span>
                    <span className="text-slate-300">{session.currentIndex + 1} of {session.segments.length}</span>
                    <span className="ml-2 text-slate-400">Depth: </span>
                    <span className="text-slate-300">{session.context.depth}</span>
                  </div>
                </div>
                
                {/* Navigation through history */}
                {session.segments.length > 1 && (
                  <div className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm z-50 border border-slate-700 flex gap-2">
                    <button
                      onClick={() => goToSegment(Math.max(0, session.currentIndex - 1))}
                      disabled={session.currentIndex === 0}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => goToSegment(Math.min(session.segments.length - 1, session.currentIndex + 1))}
                      disabled={session.currentIndex === session.segments.length - 1}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                    >
                      →
                    </button>
                  </div>
                )}

                {/* Segmentation hint */}
                {!segmentationMasks && !isSegmenting && (
                  <div className="absolute top-20 right-4 bg-blue-500/20 border border-blue-400/50 text-blue-200 px-3 py-2 rounded-lg text-xs backdrop-blur-sm z-40">
                    🎯 Click video to segment objects
                  </div>
                )}

                {/* Video Player Container - Click to segment (always enabled) */}
                <div 
                  className="relative shadow-2xl rounded-lg overflow-hidden bg-black cursor-crosshair" 
                  style={{ width: "90vw", maxWidth: "1280px" }}
                  onClick={handleVideoContainerClick}
                  title="Click on the video to segment objects"
                >
                  
                  {currentSegment.videoUrl ? (
                    <>
                      <video
                        key={segmentKey}
                        ref={videoRef}
                        src={currentSegment.videoUrl}
                        controls
                        autoPlay
                        loop={currentSegment.hasQuestion}
                        crossOrigin="anonymous"
                        className="w-full h-auto"
                        style={{
                          maxHeight: "80vh",
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                      
                      {/* Segmentation loading indicator */}
                      {isSegmenting && <SegmentationLoading />}
                      
                      {/* Segmentation overlay */}
                      {segmentationMasks && segmentationMasks.length > 0 && (
                        <SegmentationOverlay
                          masks={segmentationMasks}
                          videoWidth={videoActualSize.width}
                          videoHeight={videoActualSize.height}
                          displayWidth={videoDisplaySize.width}
                          displayHeight={videoDisplaySize.height}
                          objectLabel={segmentationLabel}
                        />
                      )}
                    </>
                  ) : currentSegment.renderingStatus === 'rendering' || currentSegment.renderingStatus === 'pending' ? (
                    <div className="flex items-center justify-center" style={{ width: "100%", height: "450px" }}>
                      <div className="text-center text-white">
                        <LoadingSpinner />
                        <div className="mt-4 text-lg">Rendering video...</div>
                        <div className="mt-2 text-sm text-slate-400">This may take a minute</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center" style={{ width: "100%", height: "450px" }}>
                      <div className="text-center text-white">
                        <div className="text-lg mb-2">Video not available</div>
                        <div className="text-sm text-slate-400">Rendering status: {currentSegment.renderingStatus || 'unknown'}</div>
                      </div>
                    </div>
                  )}
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
                />
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
