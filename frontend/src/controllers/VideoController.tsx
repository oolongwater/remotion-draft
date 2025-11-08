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
  getCurrentNode,
  initializeTree,
  addChildNode,
  navigateToNode as navigateToNodeHelper,
  saveLearningTree,
  getChildren,
  getNodeNumber,
} from '../types/TreeState';
import {
  evaluateAnswer,
} from '../services/llmService';
import { generateVideoScenes, GenerationProgress } from '../services/videoRenderService';
import { analyzeQuestion } from '../services/questionAnalysisService';

/**
 * Props for VideoController render function
 */
export interface VideoControllerState {
  // Current session state
  session: VideoSession;
  
  // Currently playing segment
  currentSegment: VideoSegment | null;
  
  // Current node number (e.g., "1.2.1")
  currentNodeNumber: string;
  
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
  navigateToNode: (nodeId: string) => void;
  handleQuestionBranch: (question: string) => Promise<void>;
  
  // Legacy - kept for backward compatibility
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
 * Create hardcoded test session with 2 video segments in a tree
 * Uses public test videos from the internet
 */
function createTestSession(topic: string): VideoSession {
  // Create first segment
  const segment1: VideoSegment = {
    id: 'test_segment_1',
    manimCode: '',
    duration: 30,
    hasQuestion: true,
    questionText: 'What are the three main types of machine learning mentioned?',
    topic: topic,
    difficulty: 'medium',
    generatedAt: new Date().toISOString(),
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    renderingStatus: 'completed',
  };
  
  // Initialize tree with root
  const tree = initializeTree(segment1);
  
  // Add second segment as child
  const segment2: VideoSegment = {
    id: 'test_segment_2',
    manimCode: '',
    duration: 30,
    hasQuestion: false,
    topic: topic,
    difficulty: 'medium',
    generatedAt: new Date().toISOString(),
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    renderingStatus: 'completed',
  };
  
  addChildNode(tree, tree.rootId, segment2);
  
  return {
    tree,
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
  
  // Get current segment from tree
  const currentNode = getCurrentNode(session.tree);
  const currentSegment = currentNode?.segment || null;
  const currentNodeNumber = currentNode ? getNodeNumber(session.tree, currentNode.id) : '';
  
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
    
    // Check if tree is empty (no root node)
    if (session.tree.nodes.size === 0 && !isGenerating) {
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
        // Create segments
        const segments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
          const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
          const sectionNum = sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1;
          
          return {
            id: `segment_${sectionNum}`,
            manimCode: '',
            duration: 90,
            hasQuestion: index < result.sections!.length - 1,
            questionText: index < result.sections!.length - 1 
              ? 'What did you learn from this section?' 
              : undefined,
            topic: topic,
            difficulty: 'medium',
            generatedAt: new Date().toISOString(),
            videoUrl: sectionUrl,
            renderingStatus: 'completed',
          };
        });
        
        // Build tree structure: first segment is root, rest are linear children
        const tree = initializeTree(segments[0]);
        let currentNodeId = tree.rootId;
        
        for (let i = 1; i < segments.length; i++) {
          const newNode = addChildNode(tree, currentNodeId, segments[i]);
          currentNodeId = newNode.id;
        }
        
        setSession((prev) => ({
          ...prev,
          tree,
          lastUpdatedAt: new Date().toISOString(),
        }));
        
        // Save to localStorage
        saveLearningTree(session.sessionId, tree);
        
        console.log(`Generated tree with ${segments.length} video segments`);
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
   * Evaluates the answer and navigates to next node in tree
   */
  const handleAnswer = useCallback(
    async (answer: string) => {
      if (!currentSegment || !currentSegment.hasQuestion || !currentNode) {
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
        
        // Navigate to first child if it exists
        const children = getChildren(session.tree, currentNode.id);
        if (children.length > 0) {
          navigateToNodeHelper(session.tree, children[0].id);
          setSession((prev) => ({ ...prev, lastUpdatedAt: new Date().toISOString() }));
          saveLearningTree(session.sessionId, session.tree);
        } else {
          console.log('Reached leaf node after answering');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsEvaluating(false);
      }
    },
    [currentSegment, currentNode, session, onError]
  );
  
  /**
   * Request next segment without answering a question
   * Navigates to first child if available
   */
  const requestNextSegment = useCallback(async () => {
    if (!currentNode) {
      console.warn('No current node');
      return;
    }
    
    // Navigate to first child if it exists
    const children = getChildren(session.tree, currentNode.id);
    if (children.length > 0) {
      navigateToNodeHelper(session.tree, children[0].id);
      setSession((prev) => ({ ...prev, lastUpdatedAt: new Date().toISOString() }));
      saveLearningTree(session.sessionId, session.tree);
    } else {
      console.log('Reached leaf node - no more segments');
    }
  }, [currentNode, session]);
  
  /**
   * Request a completely new topic (pivot)
   * Generates all scenes for the new topic and adds as branch from current node
   */
  const requestNewTopic = useCallback(
    async (newTopic: string) => {
      if (!currentNode) {
        console.warn('No current node to branch from');
        return;
      }
      
      setIsGenerating(true);
      setError(null);
      setGenerationProgress(undefined);
      
      try {
        // Create fresh context for new topic
        const newContext = updateContext(session.context, {
          previousTopic: newTopic,
          depth: 0,
          historyTopics: [...session.context.historyTopics, newTopic],
        });
        
        const result = await generateVideoScenes(newTopic, (progress) => {
          setGenerationProgress(progress);
          console.log('Generation progress for new topic:', progress);
        });
        
        if (result.success && result.sections && result.sections.length > 0) {
          // Create segments
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
          
          // Add new segments as branch from current node
          const firstNewNode = addChildNode(
            session.tree,
            currentNode.id,
            newSegments[0],
            `Topic: ${newTopic}`
          );
          
          // Add remaining segments as linear children
          let currentBranchNodeId = firstNewNode.id;
          for (let i = 1; i < newSegments.length; i++) {
            const newNode = addChildNode(session.tree, currentBranchNodeId, newSegments[i]);
            currentBranchNodeId = newNode.id;
          }
          
          // Navigate to first new node
          navigateToNodeHelper(session.tree, firstNewNode.id);
          
          setSession((prev) => ({
            ...prev,
            context: newContext,
            lastUpdatedAt: new Date().toISOString(),
          }));
          
          // Save to localStorage
          saveLearningTree(session.sessionId, session.tree);
          
          console.log(`Generated branch with ${newSegments.length} video segments for new topic: ${newTopic}`);
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
    [currentNode, session, onError]
  );
  
  /**
   * Navigate to a specific node by ID
   */
  const navigateToNode = useCallback((nodeId: string) => {
    try {
      navigateToNodeHelper(session.tree, nodeId);
      setSession((prev) => ({ ...prev, lastUpdatedAt: new Date().toISOString() }));
      saveLearningTree(session.sessionId, session.tree);
    } catch (err) {
      console.error('Failed to navigate to node:', err);
    }
  }, [session]);
  
  /**
   * Handle user question and create a branch with answer videos
   */
  const handleQuestionBranch = useCallback(async (question: string) => {
    if (!currentNode || !currentSegment) {
      console.warn('No current node to branch from');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(undefined);
    
    try {
      console.log('Analyzing question:', question);
      
      // Step 1: Analyze the question to get learning phases
      const analysisResult = await analyzeQuestion(
        question,
        currentSegment.topic,
        session.context
      );
      
      if (!analysisResult.success || !analysisResult.phases) {
        const errorMsg = analysisResult.error || 'Failed to analyze question';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsGenerating(false);
        return;
      }
      
      const { phases } = analysisResult;
      console.log(`Question analysis complete: ${phases.length} videos needed`);
      console.log('Phases:', phases.map(p => p.sub_topic).join(', '));
      
      // Step 2: Generate videos for each phase
      let firstNewNodeId: string | null = null;
      let currentParentNodeId = currentNode.id;
      
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        console.log(`Generating video ${i + 1}/${phases.length}: ${phase.sub_topic}`);
        
        setGenerationProgress({
          status: 'processing',
          stage: i + 1,
          stage_name: phase.sub_topic,
          progress_percentage: Math.round(((i + 1) / phases.length) * 100),
          message: `Generating video for: ${phase.sub_topic}`,
        });
        
        // Build contextual topic that includes parent topic and original question
        const contextualTopic = `${currentSegment.topic} - ${phase.sub_topic}. Context: User asked "${question}"`;
        
        // Generate video for this phase using Modal backend with full context
        const result = await generateVideoScenes(contextualTopic, (progress) => {
          setGenerationProgress({
            ...progress,
            stage: i + 1,
            stage_name: phase.sub_topic,
          });
        });
        
        if (result.success && result.sections && result.sections.length > 0) {
          // Create segment from first section (we only need one video per phase)
          const videoUrl = result.sections[0];
          
          const newSegment: VideoSegment = {
            id: `question_phase_${Date.now()}_${i}`,
            manimCode: '',
            duration: 90,
            hasQuestion: i < phases.length - 1, // Only last video has no question
            questionText: i < phases.length - 1 
              ? 'Do you understand this part?' 
              : undefined,
            topic: phase.sub_topic,
            difficulty: 'medium',
            generatedAt: new Date().toISOString(),
            videoUrl: videoUrl,
            renderingStatus: 'completed',
          };
          
          // Add as child node with sub_topic as label
          const newNode = addChildNode(
            session.tree,
            currentParentNodeId,
            newSegment,
            phase.sub_topic
          );
          
          // Track first node to navigate to it later
          if (i === 0) {
            firstNewNodeId = newNode.id;
          }
          
          // For linear chain: next phase branches from this node
          currentParentNodeId = newNode.id;
          
          console.log(`✓ Created node ${i + 1}: ${phase.sub_topic}`);
        } else {
          const errorMsg = result.error || `Failed to generate video for: ${phase.sub_topic}`;
          console.error(errorMsg);
          // Continue with remaining phases even if one fails
        }
      }
      
      // Step 3: Navigate to first video in the branch
      if (firstNewNodeId) {
        navigateToNodeHelper(session.tree, firstNewNodeId);
        setSession((prev) => ({ ...prev, lastUpdatedAt: new Date().toISOString() }));
        saveLearningTree(session.sessionId, session.tree);
        
        console.log(`✓ Question branch created with ${phases.length} videos`);
        console.log(`Navigated to first video: ${phases[0].sub_topic}`);
      } else {
        setError('Failed to create any videos for the question');
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      onError?.(errorMsg);
      console.error('Question branch error:', err);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(undefined);
    }
  }, [currentNode, currentSegment, session, onError]);
  
  /**
   * Navigate to a specific segment by index (legacy compatibility)
   * @deprecated Use navigateToNode instead
   */
  const goToSegment = useCallback((_index: number) => {
    console.warn('goToSegment is deprecated, but attempting to navigate...');
    // This is a best-effort compatibility function
    // It doesn't work the same way with tree structure
  }, []);
  
  // Build state object for children
  const state: VideoControllerState = {
    session,
    currentSegment,
    currentNodeNumber,
    isGenerating,
    isEvaluating,
    error,
    generationProgress,
    handleAnswer,
    requestNextSegment,
    requestNewTopic,
    navigateToNode,
    handleQuestionBranch,
    goToSegment,
  };
  
  return <>{children(state)}</>;
};

