/**
 * VideoController.tsx
 * 
 * Manages the infinite learning flow:
 * - Tracks video segment history
 * - Generates new segments based on user progress
 * - Evaluates user answers
 * - Maintains learning context
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
  addRootNode,
  navigateToNode as navigateToNodeHelper,
  saveLearningTree,
  saveVideoSession,
  getChildren,
  getNodeNumber,
  isLeafNode,
  getPathFromRoot,
} from '../types/TreeState';
import {
  evaluateAnswer,
  generateLeafQuestion,
} from '../services/llmService';
import { generateVideoScenes, GenerationProgress, SectionDetail } from '../services/videoRenderService';
import { analyzeQuestion } from '../services/questionAnalysisService';
import { generateQuizQuestion, evaluateQuizAnswer } from '../services/quizService';

/**
 * Generation request for parallel processing
 */
export interface GenerationRequest {
  id: string;
  type: 'question' | 'topic' | 'next';
  prompt: string;
  status: 'pending' | 'generating' | 'complete' | 'error';
  parentNodeId: string | null;
  resultNodeId: string | null;
  error?: string;
  timestamp: number;
}

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
  
  // Quiz state
  showQuiz: boolean;
  quizQuestion: string | null;
  quizResult: 'correct' | 'incorrect' | null;
  quizExplanation: string | null;
  isGeneratingQuiz: boolean;
  
  // Active generation requests (parallel processing)
  activeGenerations: GenerationRequest[];
  removeGenerationRequest: (requestId: string) => void;
  
  // Actions
  handleAnswer: (answer: string) => Promise<void>;
  requestNextSegment: () => Promise<void>;
  requestNewTopic: (topic: string) => Promise<void>;
  navigateToNode: (nodeId: string) => void;
  handleQuestionBranch: (question: string) => Promise<void>;
  handleQuizAnswer: (answer: string) => Promise<void>;
  triggerQuizQuestion: () => Promise<void>;
  closeQuiz: () => void;
  createQuestionNode: (leafNodeId: string) => Promise<void>;
  handleLeafQuestionAnswer: (question: string, answer: string) => Promise<{
    success: boolean;
    correct?: boolean;
    reasoning?: string;
    error?: string;
  }>;
  
  // Legacy - kept for backward compatibility
  goToSegment: (index: number) => void;
}

interface VideoControllerProps {
  initialTopic: string;
  onError?: (error: string) => void;
  children: (state: VideoControllerState) => React.ReactNode;
  isTestMode?: boolean; // NEW: Use hardcoded test data instead of generating
  initialSession?: VideoSession; // NEW: Cached session to restore from localStorage
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
  
  addChildNode(tree, tree.rootIds[0], segment2);
  
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
  initialSession, // Cached session from localStorage
}) => {
  // Session state
  // ===== TEST MODE - EASILY REMOVABLE =====
  const [session, setSession] = useState<VideoSession>(() => {
    // Priority: initialSession > testMode > new session
    if (initialSession) {
      console.log('Using cached session from localStorage');
      return initialSession;
    }
    return isTestMode ? createTestSession(initialTopic) : createVideoSession(initialTopic);
  });
  // ===== END TEST MODE =====
  
  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Generation progress
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | undefined>();
  
  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<string | null>(null);
  const [quizCorrectAnswer, setQuizCorrectAnswer] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<'correct' | 'incorrect' | null>(null);
  const [quizExplanation, setQuizExplanation] = useState<string | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  
  // Parallel generation tracking
  const [activeGenerations, setActiveGenerations] = useState<GenerationRequest[]>([]);
  const [mostRecentGenerationId, setMostRecentGenerationId] = useState<string | null>(null);
  
  // Track in-progress questions to prevent duplicates
  const processingQuestionsRef = useRef<Set<string>>(new Set());
  
  // Get current segment from tree
  const currentNode = getCurrentNode(session.tree);
  const currentSegment = currentNode?.segment || null;
  const currentNodeNumber = currentNode ? getNodeNumber(session.tree, currentNode.id) : '';
  
  /**
   * Helper: Create a new generation request
   */
  const createGenerationRequest = (
    type: 'question' | 'topic' | 'next',
    prompt: string,
    parentNodeId: string | null
  ): GenerationRequest => {
    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      prompt,
      status: 'pending',
      parentNodeId,
      resultNodeId: null,
      timestamp: Date.now(),
    };
  };
  
  /**
   * Helper: Update a generation request
   */
  const updateGenerationRequest = (
    requestId: string,
    updates: Partial<GenerationRequest>
  ) => {
    setActiveGenerations(prev => 
      prev.map(req => req.id === requestId ? { ...req, ...updates } : req)
    );
  };
  
  /**
   * Helper: Remove a generation request
   */
  const removeGenerationRequest = useCallback((requestId: string) => {
    setActiveGenerations(prev => prev.filter(req => req.id !== requestId));
  }, []);
  
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
    
    // Skip generation if session already has nodes (loaded from cache)
    if (initialSession && session.tree.nodes.size > 0) {
      console.log('Using cached session - skipping initial generation');
      return;
    }
    
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
        const detailByUrl = new Map<string, SectionDetail>();
        result.sectionDetails?.forEach((detail) => {
          if (detail?.video_url) {
            detailByUrl.set(detail.video_url, detail);
          }
        });

        const scriptBySection = new Map<number, string>();
        result.voiceoverScripts?.forEach((item) => {
          if (typeof item?.section === 'number' && item.script) {
            scriptBySection.set(item.section, item.script);
          }
        });

        // Map section URLs to VideoSegments
        const segments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
          const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
          const detail = detailByUrl.get(sectionUrl);
          const sectionNum = detail?.section ?? (sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1);
          const voiceoverScript =
            (detail?.voiceover_script || '').trim() ||
            (sectionNum !== undefined ? (scriptBySection.get(sectionNum) || '').trim() : '');
          
          return {
            id: `segment_${sectionNum}`,
            manimCode: '',
            duration: 90,
            hasQuestion: false,
            questionText: undefined,
            topic: detail?.title || topic,
            difficulty: 'medium',
            generatedAt: new Date().toISOString(),
            videoUrl: sectionUrl,
            thumbnailUrl: detail?.thumbnail_url,
            title: detail?.title,
            renderingStatus: 'completed', // Already rendered
            voiceoverScript: voiceoverScript || undefined,
          };
        });
        
        // Build tree structure: first segment is root, rest are linear children
        const tree = initializeTree(segments[0]);
        let currentNodeId = tree.rootIds[0];
        
        for (let i = 1; i < segments.length; i++) {
          const newNode = addChildNode(tree, currentNodeId, segments[i]);
          currentNodeId = newNode.id;
        }
        
        const updatedSession = {
          ...session,
          tree,
          lastUpdatedAt: new Date().toISOString(),
        };
        
        setSession(updatedSession);
        
        // Save complete session to localStorage
        saveVideoSession(updatedSession);
        
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
        
        // Store user answer on current node's segment
        currentNode.segment.userAnswer = answer;
        
        const updatedSession = {
          ...session,
          context: updatedContext,
          lastUpdatedAt: new Date().toISOString(),
        };
        
        setSession(updatedSession);
        setIsEvaluating(false);
        
        // Save the session with the updated answer
        saveVideoSession(updatedSession);
        
        // Navigate to first child if it exists
        const children = getChildren(session.tree, currentNode.id);
        if (children.length > 0) {
          navigateToNodeHelper(session.tree, children[0].id);
          const navUpdatedSession = { ...updatedSession, lastUpdatedAt: new Date().toISOString() };
          setSession(navUpdatedSession);
          saveVideoSession(navUpdatedSession);
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
      const updatedSession = { ...session, lastUpdatedAt: new Date().toISOString() };
      setSession(updatedSession);
      saveVideoSession(updatedSession);
    } else {
      console.log('Reached leaf node - no more segments');
    }
  }, [currentNode, session]);
  
  /**
   * Request a completely new topic (pivot)
   * Creates a new independent root tree instead of branching
   * Now supports parallel generation
   */
  const requestNewTopic = useCallback(
    async (newTopic: string) => {
      // Create generation request
      const request = createGenerationRequest('topic', newTopic, null);
      
      // Add to active generations and mark as most recent
      setActiveGenerations(prev => [...prev, request]);
      setMostRecentGenerationId(request.id);
      
      console.log(`[${request.id}] Starting new topic generation: ${newTopic}`);
      
      try {
        // Update status to generating
        updateGenerationRequest(request.id, { status: 'generating' });
        
        // Create fresh context for new topic
        const newContext = updateContext(session.context, {
          previousTopic: newTopic,
          depth: 0,
          historyTopics: [...session.context.historyTopics, newTopic],
        });
        
        const result = await generateVideoScenes(newTopic, (progress) => {
          console.log(`[${request.id}] Generation progress:`, progress);
        });
        
        if (result.success && result.sections && result.sections.length > 0) {
          const detailByUrl = new Map<string, SectionDetail>();
          result.sectionDetails?.forEach((detail) => {
            if (detail?.video_url) {
              detailByUrl.set(detail.video_url, detail);
            }
          });

          const scriptBySection = new Map<number, string>();
          result.voiceoverScripts?.forEach((item) => {
            if (typeof item?.section === 'number' && item.script) {
              scriptBySection.set(item.section, item.script);
            }
          });

          // Map section URLs to VideoSegments
          const newSegments: VideoSegment[] = result.sections.map((sectionUrl, index) => {
            const sectionMatch = sectionUrl.match(/section_(\d+)\.mp4/);
            const detail = detailByUrl.get(sectionUrl);
            const sectionNum = detail?.section ?? (sectionMatch ? parseInt(sectionMatch[1], 10) : index + 1);
            const voiceoverScript =
              (detail?.voiceover_script || '').trim() ||
              (sectionNum !== undefined ? (scriptBySection.get(sectionNum) || '').trim() : '');
            
            return {
              id: `segment_${Date.now()}_${sectionNum}`,
              manimCode: '',
              duration: 90,
              hasQuestion: false,
              questionText: undefined,
              topic: newTopic,
              difficulty: 'medium',
              generatedAt: new Date().toISOString(),
              videoUrl: sectionUrl,
              thumbnailUrl: detail?.thumbnail_url,
              title: detail?.title,
              renderingStatus: 'completed',
              voiceoverScript: voiceoverScript || undefined,
            };
          });
          
          // Create new independent root tree
          const newRootNode = addRootNode(session.tree, newSegments[0]);
          
          // Add remaining segments as linear children of the new root
          let currentBranchNodeId = newRootNode.id;
          for (let i = 1; i < newSegments.length; i++) {
            const newNode = addChildNode(session.tree, currentBranchNodeId, newSegments[i]);
            currentBranchNodeId = newNode.id;
          }
          
          // Update request with result
          updateGenerationRequest(request.id, { 
            status: 'complete',
            resultNodeId: newRootNode.id
          });
          
          // Only navigate if this is still the most recent request
          setMostRecentGenerationId(current => {
            if (current === request.id) {
              console.log(`[${request.id}] Most recent request - navigating to new topic`);
              navigateToNodeHelper(session.tree, newRootNode.id);
            } else {
              console.log(`[${request.id}] Not most recent (current: ${current}) - skipping navigation`);
            }
            return current;
          });
          
          const updatedSession = {
            ...session,
            context: newContext,
            lastUpdatedAt: new Date().toISOString(),
          };
          
          setSession(updatedSession);
          saveVideoSession(updatedSession);
          
          console.log(`[${request.id}] Created new root tree with ${newSegments.length} video segments for topic: ${newTopic}`);
        } else {
          const errorMsg = result.error || 'Failed to generate video scenes for new topic';
          updateGenerationRequest(request.id, { 
            status: 'error',
            error: errorMsg
          });
          console.error(`[${request.id}] Error:`, errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        updateGenerationRequest(request.id, { 
          status: 'error',
          error: errorMsg
        });
        console.error(`[${request.id}] Error:`, err);
      }
    },
    [session, onError]
  );
  
  /**
   * Navigate to a specific node by ID
   */
  const navigateToNode = useCallback((nodeId: string) => {
    try {
      navigateToNodeHelper(session.tree, nodeId);
      const updatedSession = { ...session, lastUpdatedAt: new Date().toISOString() };
      setSession(updatedSession);
      saveVideoSession(updatedSession);
    } catch (err) {
      console.error('Failed to navigate to node:', err);
    }
  }, [session]);
  
  /**
   * Handle user question and create a branch with answer videos
   * Now supports parallel generation
   */
  const handleQuestionBranch = useCallback(async (question: string) => {
    if (!currentNode || !currentSegment) {
      console.warn('No current node to branch from');
      return;
    }
    
    // DUPLICATE PREVENTION: Check if this exact question is already being processed
    const questionKey = `${currentNode.id}:${question.trim().toLowerCase()}`;
    if (processingQuestionsRef.current.has(questionKey)) {
      console.warn(`❌ DUPLICATE CALL BLOCKED: Question "${question}" is already being processed for node ${currentNode.id}`);
      return;
    }
    
    // Mark this question as being processed
    processingQuestionsRef.current.add(questionKey);
    console.log(`✅ Question processing started: "${question}" (key: ${questionKey})`);
    
    // Create generation request
    const request = createGenerationRequest('question', question, currentNode.id);
    
    // Add to active generations and mark as most recent
    setActiveGenerations(prev => [...prev, request]);
    setMostRecentGenerationId(request.id);
    
    console.log(`[${request.id}] Starting question branch: ${question}`);
    
    try {
      // Update status to generating
      updateGenerationRequest(request.id, { status: 'generating' });
      
      console.log(`[${request.id}] Analyzing question...`);
      
      // Step 1: Analyze the question to get learning phases
      const analysisResult = await analyzeQuestion(
        question,
        currentSegment.topic,
        session.context
      );
      
      if (!analysisResult.success || !analysisResult.phases) {
        const errorMsg = analysisResult.error || 'Failed to analyze question';
        updateGenerationRequest(request.id, { 
          status: 'error',
          error: errorMsg
        });
        console.error(`[${request.id}] Error:`, errorMsg);
        return;
      }
      
      const { phases } = analysisResult;
      console.log(`[${request.id}] Question analysis complete: ${phases.length} videos needed`);
      console.log(`[${request.id}] Phases:`, phases.map(p => p.sub_topic).join(', '));
      
      // Step 2: Generate videos for each phase
      let firstNewNodeId: string | null = null;
      let currentParentNodeId = currentNode.id;
      
      // Store all generated segments paired with their phase info, then add to tree at once
      const generatedItems: Array<{ segment: VideoSegment; phase: typeof phases[0]; phaseIndex: number }> = [];
      
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        console.log(`[${request.id}] Generating video ${i + 1}/${phases.length}: ${phase.sub_topic}`);
        
        // Build contextual topic that includes parent topic and original question
        const contextualTopic = `${currentSegment.topic} - ${phase.sub_topic}. Context: User asked "${question}"`;
        
        // Generate video for this phase using Modal backend with full context
        const result = await generateVideoScenes(contextualTopic, (progress) => {
          console.log(`[${request.id}] Video ${i + 1} progress:`, progress);
        });
        
        if (result.success && result.sections && result.sections.length > 0) {
          // Create segment from first section (we only need one video per phase)
          const videoUrl = result.sections[0];
          const detail = result.sectionDetails?.[0];
          
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
            thumbnailUrl: detail?.thumbnail_url,
            title: detail?.title,
            renderingStatus: 'completed',
            voiceoverScript: detail?.voiceover_script,
          };
          
          // Store segment with its corresponding phase info to avoid index mismatch
          generatedItems.push({ segment: newSegment, phase, phaseIndex: i });
          console.log(`[${request.id}] ✓ Generated video ${i + 1}: ${phase.sub_topic}`);
        } else {
          const errorMsg = result.error || `Failed to generate video for: ${phase.sub_topic}`;
          console.error(`[${request.id}] Error generating video ${i + 1}:`, errorMsg);
          // Continue with remaining phases even if one fails
        }
      }
      
      // Step 3: Add all generated segments to tree in one batch
      if (generatedItems.length > 0) {
        for (let i = 0; i < generatedItems.length; i++) {
          const { segment, phase, phaseIndex } = generatedItems[i];
          const newNode = addChildNode(
            session.tree,
            currentParentNodeId,
            segment,
            phase.sub_topic
          );
          
          // Track first node to navigate to it later
          if (i === 0) {
            firstNewNodeId = newNode.id;
          }
          
          // For linear chain: next phase branches from this node
          currentParentNodeId = newNode.id;
          console.log(`[${request.id}] ✓ Added node ${i + 1} to tree: ${phase.sub_topic}`);
        }
        
        // Update request with result
        updateGenerationRequest(request.id, { 
          status: 'complete',
          resultNodeId: firstNewNodeId!
        });
        
        // Only navigate if this is still the most recent request
        setMostRecentGenerationId(current => {
          if (current === request.id) {
            console.log(`[${request.id}] Most recent request - navigating to question branch`);
            navigateToNodeHelper(session.tree, firstNewNodeId!);
          } else {
            console.log(`[${request.id}] Not most recent (current: ${current}) - skipping navigation`);
          }
          return current;
        });
        
        // Create updated session and save
        const updatedSession = { 
          ...session, 
          lastUpdatedAt: new Date().toISOString() 
        };
        setSession(updatedSession);
        saveVideoSession(updatedSession);
        
        console.log(`[${request.id}] ✓ Question branch created with ${generatedItems.length} videos`);
      } else {
        const errorMsg = 'Failed to create any videos for the question';
        updateGenerationRequest(request.id, { 
          status: 'error',
          error: errorMsg
        });
        console.error(`[${request.id}] Error:`, errorMsg);
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      updateGenerationRequest(request.id, { 
        status: 'error',
        error: errorMsg
      });
      console.error(`[${request.id}] Error:`, err);
    } finally {
      // CLEANUP: Remove question from processing set
      processingQuestionsRef.current.delete(questionKey);
      console.log(`✓ Question processing completed and cleaned up: "${question}" (key: ${questionKey})`);
    }
  }, [currentNode, currentSegment, session, onError]);
  
  /**
   * Generate and show quiz question for leaf nodes
   */
  const triggerQuizQuestion = useCallback(async () => {
    if (!currentNode || !currentSegment) {
      console.warn('No current node for quiz');
      return;
    }
    
    // Check if current node is a leaf
    if (!isLeafNode(session.tree, currentNode.id)) {
      console.log('Not a leaf node, skipping quiz');
      return;
    }
    
    setIsGeneratingQuiz(true);
    setShowQuiz(true);
    setQuizResult(null);
    setError(null);
    
    try {
      console.log('Generating quiz question for:', currentSegment.topic);
      const result = await generateQuizQuestion(
        currentSegment.topic,
        currentSegment.voiceoverScript
      );
      
      if (result.success && result.question) {
        setQuizQuestion(result.question);
        setQuizCorrectAnswer(result.correctAnswer || null);
      } else {
        setError(result.error || 'Failed to generate quiz question');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [currentNode, currentSegment, session, onError]);
  
  /**
   * Handle user's quiz answer
   */
  const handleQuizAnswer = useCallback(async (answer: string) => {
    if (!quizQuestion || !currentSegment || !currentNode) {
      console.warn('No quiz question or current segment');
      return;
    }
    
    setIsEvaluating(true);
    setError(null);
    
    try {
      console.log('Evaluating quiz answer:', answer);
      const result = await evaluateQuizAnswer(
        answer,
        quizQuestion,
        currentSegment.topic,
        quizCorrectAnswer || undefined
      );
      
      if (!result.success) {
        setError(result.error || 'Failed to evaluate answer');
        setIsEvaluating(false);
        return;
      }
      
      const { correct, explanation } = result;
      
      // Store the explanation for display
      setQuizExplanation(explanation || null);
      
      if (correct) {
        // Show congratulations
        setQuizResult('correct');
        setIsEvaluating(false);
      } else {
        // Show incorrect message with explanation
        setQuizResult('incorrect');
        setIsEvaluating(false);
        
        // Generate a new video explaining the correct answer
        setIsGenerating(true);
        setGenerationProgress(undefined);
        
        try {
          const explanationTopic = `${currentSegment.topic} - Correct Answer Explanation: ${explanation}`;
          
          const videoResult = await generateVideoScenes(explanationTopic, (progress) => {
            setGenerationProgress(progress);
          });
          
          if (videoResult.success && videoResult.sections && videoResult.sections.length > 0) {
            const videoUrl = videoResult.sections[0];
            const detail = videoResult.sectionDetails?.[0];
            
            const explanationSegment: VideoSegment = {
              id: `explanation_${Date.now()}`,
              manimCode: '',
              duration: 90,
              hasQuestion: false,
              topic: `Explanation: ${currentSegment.topic}`,
              difficulty: 'medium',
              generatedAt: new Date().toISOString(),
              videoUrl: videoUrl,
              thumbnailUrl: detail?.thumbnail_url,
              title: `Correct Answer: ${currentSegment.topic}`,
              renderingStatus: 'completed',
              voiceoverScript: detail?.voiceover_script,
            };
            
            // Add explanation as child node
            const explanationNode = addChildNode(
              session.tree,
              currentNode.id,
              explanationSegment,
              'Explanation'
            );
            
            setSession((prev) => ({
              ...prev,
              lastUpdatedAt: new Date().toISOString(),
            }));
            
            saveLearningTree(session.sessionId, session.tree);
            
            // Navigate to explanation video
            navigateToNodeHelper(session.tree, explanationNode.id);
            
            // Close quiz overlay
            setShowQuiz(false);
            setQuizQuestion(null);
            setQuizResult(null);
            
            console.log('Generated explanation video and navigated to it');
          } else {
            setError(videoResult.error || 'Failed to generate explanation video');
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error generating explanation';
          setError(errorMsg);
          onError?.(errorMsg);
        } finally {
          setIsGenerating(false);
          setGenerationProgress(undefined);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsEvaluating(false);
    }
  }, [quizQuestion, quizCorrectAnswer, currentSegment, currentNode, session, onError]);
  
  /**
   * Close quiz overlay
   */
  const closeQuiz = useCallback(() => {
    setShowQuiz(false);
    setQuizQuestion(null);
    setQuizResult(null);
    setQuizExplanation(null);
    setQuizCorrectAnswer(null);
    setError(null);
  }, []);
  
  /**
   * Create a question node at a leaf
   * Generates a contextual question based on the branch path and adds it as a child
   */
  const createQuestionNode = useCallback(async (leafNodeId: string) => {
    try {
      const leafNode = session.tree.nodes.get(leafNodeId);
      if (!leafNode) {
        console.error('Leaf node not found:', leafNodeId);
        return;
      }
      
      // Check if already has a question node child
      const children = getChildren(session.tree, leafNodeId);
      const hasQuestionNode = children.some(child => child.segment.isQuestionNode);
      if (hasQuestionNode) {
        console.log('Question node already exists for this leaf');
        return;
      }
      
      setIsGenerating(true);
      setError(null);
      
      // Build branch path for context
      const pathNodes = getPathFromRoot(session.tree, leafNodeId);
      const branchPath = pathNodes.map(node => ({
        nodeNumber: getNodeNumber(session.tree, node.id),
        topic: node.segment.topic,
        voiceoverScript: node.segment.voiceoverScript,
      }));
      
      const summary = session.context.historyTopics.join(' → ');
      
      console.log('Generating leaf question for node:', leafNodeId);
      const result = await generateLeafQuestion({
        topic: leafNode.segment.topic,
        branchPath,
        summary,
      });
      
      if (!result.success || !result.question) {
        const errorMsg = result.error || 'Failed to generate leaf question';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsGenerating(false);
        return;
      }
      
      // Create question-only segment with duration 0
      const questionSegment: VideoSegment = {
        id: `question_${Date.now()}`,
        manimCode: '',
        duration: 0,
        hasQuestion: false,
        questionText: result.question,
        topic: `Question: ${leafNode.segment.topic}`,
        difficulty: 'medium',
        generatedAt: new Date().toISOString(),
        isQuestionNode: true, // Mark as question node
        title: 'Knowledge Check',
      };
      
      // Add as child of leaf node
      const questionNode = addChildNode(session.tree, leafNodeId, questionSegment, 'Question');
      
      // Navigate to question node
      navigateToNodeHelper(session.tree, questionNode.id);
      
      const updatedSession = {
        ...session,
        lastUpdatedAt: new Date().toISOString(),
      };
      
      setSession(updatedSession);
      saveVideoSession(updatedSession);
      
      console.log('Question node created and navigated to:', questionNode.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error creating question node';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [session, onError]);
  
  /**
   * Handle answer to a leaf question
   * Evaluates with LLM and generates remediation video if incorrect
   */
  const handleLeafQuestionAnswer = useCallback(async (
    question: string,
    answer: string
  ): Promise<{
    success: boolean;
    correct?: boolean;
    reasoning?: string;
    error?: string;
  }> => {
    if (!currentNode) {
      return {
        success: false,
        error: 'No current node',
      };
    }
    
    setIsEvaluating(true);
    setError(null);
    
    try {
      // Build context for evaluation
      const pathNodes = getPathFromRoot(session.tree, currentNode.id);
      const branchPath = pathNodes.map(node => ({
        nodeNumber: getNodeNumber(session.tree, node.id),
        topic: node.segment.topic,
        voiceoverScript: node.segment.voiceoverScript,
      }));
      
      console.log('Evaluating leaf question answer:', answer);
      const evalResult = await evaluateAnswer(
        answer,
        question,
        currentNode.segment.topic,
        { branchPath }
      );
      
      if (!evalResult.success) {
        const errorMsg = evalResult.error || 'Failed to evaluate answer';
        setError(errorMsg);
        setIsEvaluating(false);
        return {
          success: false,
          error: errorMsg,
        };
      }
      
      const { correct, reasoning } = evalResult;
      
      // Update correctness pattern in context
      const newPattern = [
        ...(session.context.correctnessPattern || []),
        correct || false,
      ].slice(-5);
      
      const updatedContext = updateContext(session.context, {
        correctnessPattern: newPattern,
        userAnswer: answer,
        wasCorrect: correct,
      });
      
      // Store answer on current node
      currentNode.segment.userAnswer = answer;
      
      const updatedSession = {
        ...session,
        context: updatedContext,
        lastUpdatedAt: new Date().toISOString(),
      };
      
      setSession(updatedSession);
      saveVideoSession(updatedSession);
      
      setIsEvaluating(false);
      
      // Just return the evaluation result with explanation
      // No video generation needed - the overlay will show the explanation
      return {
        success: true,
        correct,
        reasoning,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error evaluating answer';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsEvaluating(false);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }, [currentNode, session, onError]);
  
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
    showQuiz,
    quizQuestion,
    quizResult,
    quizExplanation,
    isGeneratingQuiz,
    activeGenerations,
    removeGenerationRequest,
    handleAnswer,
    requestNextSegment,
    requestNewTopic,
    navigateToNode,
    handleQuestionBranch,
    handleQuizAnswer,
    triggerQuizQuestion,
    closeQuiz,
    createQuestionNode,
    handleLeafQuestionAnswer,
    goToSegment,
  };
  
  return <>{children(state)}</>;
};

