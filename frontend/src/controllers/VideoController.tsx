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
  createVideoSession,
  updateContext,
} from '../types/VideoConfig';
import {
  generateSectionQuestion,
} from '../services/llmService';
import { generateVideoScenes, GenerationProgress } from '../services/videoRenderService';
import { TEST_SEGMENTS } from '../services/testData';

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
  handleAnswer: (answer: string) => Promise<{ correct: boolean; correctAnswer?: string } | undefined>;
  requestNextSegment: () => Promise<void>;
  requestNewTopic: (topic: string) => Promise<void>;
  goToSegment: (index: number) => void;
}

interface VideoControllerProps {
  initialTopic: string;
  onError?: (error: string) => void;
  children: (state: VideoControllerState) => React.ReactNode;
}

/**
 * VideoController Component
 * 
 * Uses render props pattern to provide video state and controls to children
 */
export const VideoController: React.FC<VideoControllerProps> = ({
  initialTopic,
  onError,
  children,
}) => {
  // Session state
  const [session, setSession] = useState<VideoSession>(() =>
    createVideoSession(initialTopic)
  );
  
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
      
      // Check if this is test mode
      const isTestMode = topic.toLowerCase().includes('__test__');
      
      if (isTestMode) {
        // Use pre-loaded test data instead of calling backend
        console.log('🧪 TEST MODE: Using pre-loaded test data');
        
        setSession((prev) => ({
          ...prev,
          segments: TEST_SEGMENTS,
          currentIndex: 0,
          lastUpdatedAt: new Date().toISOString(),
        }));
        
        console.log(`Loaded ${TEST_SEGMENTS.length} test segments instantly`);
        setIsGenerating(false);
        return;
      }
      
      const result = await generateVideoScenes(topic, (progress) => {
        // Update progress state for UI
        setGenerationProgress(progress);
        console.log('Generation progress:', progress);
      });
      
      if (result.success && result.sections && result.sections.length > 0) {
        // Map section URLs to VideoSegments with placeholder questions initially
        const segments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
          // Extract section number from URL (e.g., section_1.mp4 -> 1)
          const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
          const sectionNum = sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1;
          
          return {
            id: `segment_${sectionNum}`,
            manimCode: '', // Not needed since video is already rendered
            duration: 90, // Default duration (could be improved with metadata)
            hasQuestion: true, // All segments have questions now
            questionText: 'Loading question...', 
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
        
        // Generate dynamic questions for each section based on content
        if (result.plan?.video_structure) {
          console.log('Generating dynamic questions based on section content...');
          
          // Generate questions in parallel for all sections (including the last one)
          const questionPromises = result.sections.map(async (_sectionUrl, index) => {
            const sectionInfo = result.plan!.video_structure![index];
            const sectionNum = index + 1;
            
            try {
              const questionResult = await generateSectionQuestion(
                topic,
                sectionNum,
                result.sections!.length,
                {
                  title: sectionInfo.section,
                  description: sectionInfo.content,
                }
              );
              
              if (questionResult.success && questionResult.question && questionResult.options && questionResult.correctAnswer) {
                console.log(`Generated question for section ${sectionNum}: ${questionResult.question}`);
                return {
                  index,
                  question: questionResult.question,
                  options: questionResult.options,
                  correctAnswer: questionResult.correctAnswer,
                };
              } else {
                console.warn(`Failed to generate question for section ${sectionNum}:`, questionResult.error);
                return {
                  index,
                  question: 'What did you learn from this section?',
                  options: ['I learned a lot', 'I learned something', 'I need to review', 'I am confused'],
                  correctAnswer: 'I learned a lot', // Fallback
                };
              }
            } catch (error) {
              console.error(`Error generating question for section ${sectionNum}:`, error);
              return {
                index,
                question: 'What did you learn from this section?',
                options: ['I learned a lot', 'I learned something', 'I need to review', 'I am confused'],
                correctAnswer: 'I learned a lot', // Fallback
              };
            }
          });
          
          // Wait for all questions to be generated
          const questions = await Promise.all(questionPromises);
          
          // Update segments with generated questions
          setSession((prev) => {
            const updatedSegments = [...prev.segments];
            questions.forEach((q) => {
              if (q && updatedSegments[q.index]) {
                updatedSegments[q.index] = {
                  ...updatedSegments[q.index],
                  questionText: q.question,
                  questionOptions: q.options,
                  correctAnswer: q.correctAnswer,
                };
              }
            });
            
            return {
              ...prev,
              segments: updatedSegments,
              lastUpdatedAt: new Date().toISOString(),
            };
          });
          
          console.log('All questions generated and updated');
        }
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
   * Handle user's answer to a multiple choice question
   * Checks the answer locally and returns the result
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
        // Check if answer is correct (local check, no API call)
        const correct = answer === currentSegment.correctAnswer;
        
        console.log(`Answer "${answer}" is ${correct ? 'correct' : 'incorrect'}. Correct answer was: "${currentSegment.correctAnswer}"`);
        
        // Update correctness pattern
        const newPattern = [
          ...(session.context.correctnessPattern || []),
          correct,
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
        
        // Return the result so the UI can handle it
        return { correct, correctAnswer: currentSegment.correctAnswer };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsEvaluating(false);
        return { correct: false, correctAnswer: currentSegment.correctAnswer };
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
          // Map section URLs to VideoSegments with placeholder questions
          const newSegments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
            const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
            const sectionNum = sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1;
            
            return {
              id: `segment_${Date.now()}_${sectionNum}`,
              manimCode: '',
              duration: 90,
              hasQuestion: true, // All segments have questions now
              questionText: 'Loading question...',
              topic: newTopic,
              difficulty: 'medium',
              generatedAt: new Date().toISOString(),
              videoUrl: sectionUrl,
              renderingStatus: 'completed',
            };
          });
          
          const firstNewSegmentIndex = session.segments.length;
          
          // Append new segments to existing ones
          setSession((prev) => ({
            ...prev,
            segments: [...prev.segments, ...newSegments],
            currentIndex: prev.segments.length, // Navigate to first new segment
            context: newContext,
            lastUpdatedAt: new Date().toISOString(),
          }));
          
          console.log(`Generated ${newSegments.length} video segments for new topic: ${newTopic}`);
          
          // Generate dynamic questions for the new topic's sections (including the last one)
          if (result.plan?.video_structure) {
            console.log('Generating dynamic questions for new topic sections...');
            
            const questionPromises = result.sections.map(async (_sectionUrl, index) => {
              const sectionInfo = result.plan!.video_structure![index];
              const sectionNum = index + 1;
              
              try {
                const questionResult = await generateSectionQuestion(
                  newTopic,
                  sectionNum,
                  result.sections!.length,
                  {
                    title: sectionInfo.section,
                    description: sectionInfo.content,
                  }
                );
                
                if (questionResult.success && questionResult.question && questionResult.options && questionResult.correctAnswer) {
                  console.log(`Generated question for new topic section ${sectionNum}: ${questionResult.question}`);
                  return {
                    index: firstNewSegmentIndex + index,
                    question: questionResult.question,
                    options: questionResult.options,
                    correctAnswer: questionResult.correctAnswer,
                  };
                } else {
                  return {
                    index: firstNewSegmentIndex + index,
                    question: 'What did you learn from this section?',
                    options: ['I learned a lot', 'I learned something', 'I need to review', 'I am confused'],
                    correctAnswer: 'I learned a lot',
                  };
                }
              } catch (error) {
                console.error(`Error generating question for new topic section ${sectionNum}:`, error);
                return {
                  index: firstNewSegmentIndex + index,
                  question: 'What did you learn from this section?',
                  options: ['I learned a lot', 'I learned something', 'I need to review', 'I am confused'],
                  correctAnswer: 'I learned a lot',
                };
              }
            });
            
            const questions = await Promise.all(questionPromises);
            
            setSession((prev) => {
              const updatedSegments = [...prev.segments];
              questions.forEach((q) => {
                if (q && updatedSegments[q.index]) {
                  updatedSegments[q.index] = {
                    ...updatedSegments[q.index],
                    questionText: q.question,
                    questionOptions: q.options,
                    correctAnswer: q.correctAnswer,
                  };
                }
              });
              
              return {
                ...prev,
                segments: updatedSegments,
                lastUpdatedAt: new Date().toISOString(),
              };
            });
            
            console.log('Questions generated for new topic');
          }
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

