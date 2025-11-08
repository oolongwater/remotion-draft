/**
 * VideoController.tsx
 * 
 * Manages the infinite learning flow:
 * - Tracks video segment history
 * - Generates new segments based on user progress
 * - Evaluates user answers
 * - Maintains learning context
 */

import { useState, useCallback, useEffect } from 'react';
import {
  VideoSession,
  VideoSegment,
  LearningContext,
  createVideoSession,
  updateContext,
} from '../types/VideoConfig';
import {
  generateVideoSegment,
  evaluateAnswer,
} from '../services/llmService';
import { generateVideoScenes, GenerationProgress } from '../services/videoRenderService';

/**
 * Props for VideoController render function
 */
export interface VideoControllerState {
  // Current session state
  session: VideoSession;
  
  // Currently playing segment
  currentSegment: VideoSegment | null;
  
  // Loading states
  isGenerating: boolean;
  isEvaluating: boolean;
  
  // Error state
  error: string | null;
  
  // Generation progress (for SSE updates)
  generationProgress?: GenerationProgress;
  
  // Actions
  handleAnswer: (answer: string) => Promise<void>;
  requestNextSegment: () => Promise<void>;
  requestNewTopic: (topic: string) => Promise<void>;
  goToSegment: (index: number) => void;
}

interface VideoControllerProps {
  initialTopic: string;
  onError?: (error: string) => void;
  children: (state: VideoControllerState) => React.ReactNode;
  isTestMode?: boolean; // NEW: Use hardcoded test data instead of generating
}

// ===== TEST DATA - EASILY REMOVABLE =====
/**
 * Create hardcoded test session with 2 video segments
 * Uses public test videos from the internet
 */
function createTestSession(topic: string): VideoSession {
  return {
    segments: [
      {
        id: 'test_segment_1',
        manimCode: '',
        duration: 30,
        hasQuestion: true,
        questionText: 'What are the three main types of machine learning mentioned?',
        topic: topic,
        difficulty: 'medium',
        generatedAt: new Date().toISOString(),
        // Big Buck Bunny - a popular open-source test video
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        renderingStatus: 'completed',
      },
      {
        id: 'test_segment_2',
        manimCode: '',
        duration: 30,
        hasQuestion: false,
        topic: topic,
        difficulty: 'medium',
        generatedAt: new Date().toISOString(),
        // Elephant's Dream - another open-source test video
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        renderingStatus: 'completed',
      },
    ],
    currentIndex: 0,
    context: {
      initialTopic: topic,
      historyTopics: [topic],
      depth: 0,
      correctnessPattern: [],
      preferredStyle: 'mixed',
    },
    sessionId: `test_session_${Date.now()}`,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}
// ===== END TEST DATA =====

/**
 * VideoController Component
 * 
 * Uses render props pattern to provide video state and controls to children
 */
export const VideoController: React.FC<VideoControllerProps> = ({
  initialTopic,
  onError,
  children,
  isTestMode = false, // Default to normal mode
}) => {
  // Session state
  // ===== TEST MODE - EASILY REMOVABLE =====
  const [session, setSession] = useState<VideoSession>(() =>
    isTestMode ? createTestSession(initialTopic) : createVideoSession(initialTopic)
  );
  // ===== END TEST MODE =====
  
  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Generation progress
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | undefined>();
  
  // Get current segment
  const currentSegment = session.segments[session.currentIndex] || null;
  
  /**
   * Generate the first segment when component mounts
   */
  useEffect(() => {
    // ===== TEST MODE - EASILY REMOVABLE =====
    // Skip generation in test mode (test data already loaded)
    if (isTestMode) {
      console.log('Test mode active - using hardcoded video data');
      return;
    }
    // ===== END TEST MODE =====
    
    if (session.segments.length === 0 && !isGenerating) {
      console.log('Generating initial segment for topic:', session.context.initialTopic);
      generateInitialSegment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  /**
   * Generate all video scenes for the initial topic using Modal backend
   */
  const generateInitialSegment = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(undefined);
    
    try {
      const topic = session.context.initialTopic || 'a topic';
      
      const result = await generateVideoScenes(topic, (progress) => {
        // Update progress state for UI
        setGenerationProgress(progress);
        console.log('Generation progress:', progress);
      });
      
      if (result.success && result.sections && result.sections.length > 0) {
        // Map section URLs to VideoSegments
        const segments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
          // Extract section number from URL (e.g., section_1.mp4 -> 1)
          const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
          const sectionNum = sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1;
          
          return {
            id: `segment_${sectionNum}`,
            manimCode: '', // Not needed since video is already rendered
            duration: 90, // Default duration (could be improved with metadata)
            hasQuestion: index < result.sections!.length - 1, // All but last have questions
            questionText: index < result.sections!.length - 1 
              ? 'What did you learn from this section?' 
              : undefined,
            topic: topic,
            difficulty: 'medium',
            generatedAt: new Date().toISOString(),
            videoUrl: sectionUrl,
            renderingStatus: 'completed', // Already rendered
          };
        });
        
        setSession((prev) => ({
          ...prev,
          segments,
          currentIndex: 0,
          lastUpdatedAt: new Date().toISOString(),
        }));
        
        console.log(`Generated ${segments.length} video segments`);
      } else {
        const errorMsg = result.error || 'Failed to generate video scenes';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(undefined);
    }
  };
  
  /**
   * Handle user's answer to a question
   * Since all scenes are generated upfront, this evaluates the answer and navigates to next segment
   */
  const handleAnswer = useCallback(
    async (answer: string) => {
      if (!currentSegment || !currentSegment.hasQuestion) {
        console.warn('No question to answer in current segment');
        return;
      }
      
      setIsEvaluating(true);
      setError(null);
      
      try {
        // Evaluate the answer
        const evalResponse = await evaluateAnswer(
          answer,
          currentSegment.questionText || '',
          currentSegment.topic
        );
        
        if (!evalResponse.success) {
          const errorMsg = evalResponse.error || 'Failed to evaluate answer';
          setError(errorMsg);
          onError?.(errorMsg);
          setIsEvaluating(false);
          return;
        }
        
        const { correct } = evalResponse;
        
        // Update correctness pattern
        const newPattern = [
          ...(session.context.correctnessPattern || []),
          correct || false,
        ].slice(-5); // Keep last 5 answers
        
        // Update context
        const updatedContext = updateContext(session.context, {
          previousTopic: currentSegment.topic,
          userAnswer: answer,
          wasCorrect: correct,
          historyTopics: [...session.context.historyTopics, currentSegment.topic],
          depth: session.context.depth + 1,
          correctnessPattern: newPattern,
        });
        
        setSession((prev) => ({
          ...prev,
          context: updatedContext,
          lastUpdatedAt: new Date().toISOString(),
        }));
        
        setIsEvaluating(false);
        
        // Navigate to next segment (all scenes already generated)
        if (session.currentIndex < session.segments.length - 1) {
          setSession((prev) => ({
            ...prev,
            currentIndex: prev.currentIndex + 1,
            lastUpdatedAt: new Date().toISOString(),
          }));
        } else {
          console.log('Reached end of available segments after answering');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsEvaluating(false);
      }
    },
    [currentSegment, session, onError]
  );
  
  /**
   * Request next segment without answering a question
   * (for segments that don't have questions)
   * Since all scenes are generated upfront, this just navigates to the next segment
   */
  const requestNextSegment = useCallback(async () => {
    // If there's a next segment available, navigate to it
    if (session.currentIndex < session.segments.length - 1) {
      setSession((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        lastUpdatedAt: new Date().toISOString(),
      }));
    } else {
      // At the end of segments - could generate more or show completion message
      console.log('Reached end of available segments');
      // For now, just log - could trigger new generation if needed
    }
  }, [session]);
  
  /**
   * Request a completely new topic (pivot)
   * Generates all scenes for the new topic using Modal backend
   */
  const requestNewTopic = useCallback(
    async (newTopic: string) => {
      setIsGenerating(true);
      setError(null);
      setGenerationProgress(undefined);
      
      try {
        // Create fresh context for new topic
        const newContext = updateContext(session.context, {
          previousTopic: newTopic,
          depth: 0, // Reset depth for new topic
          historyTopics: [...session.context.historyTopics, newTopic],
        });
        
        const result = await generateVideoScenes(newTopic, (progress) => {
          setGenerationProgress(progress);
          console.log('Generation progress for new topic:', progress);
        });
        
        if (result.success && result.sections && result.sections.length > 0) {
          // Map section URLs to VideoSegments
          const newSegments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
            const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
            const sectionNum = sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1;
            
            return {
              id: `segment_${Date.now()}_${sectionNum}`,
              manimCode: '',
              duration: 90,
              hasQuestion: index < result.sections!.length - 1,
              questionText: index < result.sections!.length - 1 
                ? 'What did you learn from this section?' 
                : undefined,
              topic: newTopic,
              difficulty: 'medium',
              generatedAt: new Date().toISOString(),
              videoUrl: sectionUrl,
              renderingStatus: 'completed',
            };
          });
          
          // Append new segments to existing ones
          setSession((prev) => ({
            ...prev,
            segments: [...prev.segments, ...newSegments],
            currentIndex: prev.segments.length, // Navigate to first new segment
            context: newContext,
            lastUpdatedAt: new Date().toISOString(),
          }));
          
          console.log(`Generated ${newSegments.length} video segments for new topic: ${newTopic}`);
        } else {
          const errorMsg = result.error || 'Failed to generate video scenes for new topic';
          setError(errorMsg);
          onError?.(errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setIsGenerating(false);
        setGenerationProgress(undefined);
      }
    },
    [session, onError]
  );
  
  /**
   * Navigate to a specific segment in history
   */
  const goToSegment = useCallback((index: number) => {
    if (index >= 0 && index < session.segments.length) {
      setSession((prev) => ({
        ...prev,
        currentIndex: index,
        lastUpdatedAt: new Date().toISOString(),
      }));
    }
  }, [session.segments.length]);
  
  // Build state object for children
  const state: VideoControllerState = {
    session,
    currentSegment,
    isGenerating,
    isEvaluating,
    error,
    generationProgress,
    handleAnswer,
    requestNextSegment,
    requestNewTopic,
    goToSegment,
  };
  
  return <>{children(state)}</>;
};

