/**
 * VideoConfig.ts
 * 
 * Type definitions for the infinite video learning system.
 * Replaces the old rigid scene-based structure with flexible video segments.
 */

/**
 * A single video segment in the learning journey
 */
export interface VideoSegment {
  id: string;
  manimCode: string; // Python Manim code to render
  duration: number; // Duration in seconds
  hasQuestion: boolean; // Whether this segment ends with a question
  questionText?: string; // The question text if hasQuestion is true
  topic: string; // What topic this segment teaches
  difficulty: 'easy' | 'medium' | 'hard'; // Difficulty level
  // Optional metadata
  generatedAt?: string;
  parentSegmentId?: string; // ID of the segment that led to this one
  videoUrl?: string; // URL to the rendered video (set after rendering)
  renderingStatus?: 'pending' | 'rendering' | 'completed' | 'failed'; // Status of video rendering
}

/**
 * Context about the learning journey
 * Passed to LLM to generate contextually appropriate next segments
 */
export interface LearningContext {
  // Initial topic user wanted to learn
  initialTopic?: string;
  
  // Most recent topic being taught
  previousTopic?: string;
  
  // User's last answer (if they answered a question)
  userAnswer?: string;
  
  // Whether the last answer was correct
  wasCorrect?: boolean;
  
  // History of topics covered in this session
  historyTopics: string[];
  
  // Current depth in the topic (how many segments deep)
  depth: number;
  
  // Pattern of correctness (to adjust difficulty intelligently)
  correctnessPattern?: boolean[]; // last N answers
  
  // User preference for learning style (if we track this)
  preferredStyle?: 'visual' | 'code-heavy' | 'conceptual' | 'mixed';
}

/**
 * The complete video session state
 * Represents the entire learning journey
 */
export interface VideoSession {
  // All video segments generated in this session
  segments: VideoSegment[];
  
  // Index of the currently playing segment
  currentIndex: number;
  
  // Learning context for generating next segments
  context: LearningContext;
  
  // Session metadata
  sessionId: string;
  startedAt: string;
  lastUpdatedAt: string;
}

/**
 * Response from LLM when generating a video segment
 */
export interface GenerateSegmentResponse {
  success: boolean;
  segment?: VideoSegment;
  error?: string;
}

/**
 * Response from LLM when evaluating an answer
 */
export interface EvaluateAnswerResponse {
  success: boolean;
  correct?: boolean;
  reasoning?: string;
  suggestedNextTopic?: string;
  suggestedDifficulty?: 'easy' | 'medium' | 'hard';
  error?: string;
}

/**
 * Helper type for creating new learning contexts
 */
export type ContextUpdate = Partial<LearningContext>;

/**
 * Helper function to create initial learning context
 */
export function createInitialContext(topic: string): LearningContext {
  return {
    initialTopic: topic,
    previousTopic: undefined,
    userAnswer: undefined,
    wasCorrect: undefined,
    historyTopics: [],
    depth: 0,
    correctnessPattern: [],
    preferredStyle: 'mixed',
  };
}

/**
 * Helper function to update learning context
 */
export function updateContext(
  current: LearningContext,
  updates: ContextUpdate
): LearningContext {
  return {
    ...current,
    ...updates,
  };
}

/**
 * Helper function to create a new video session
 */
export function createVideoSession(initialTopic: string): VideoSession {
  return {
    segments: [],
    currentIndex: 0,
    context: createInitialContext(initialTopic),
    sessionId: generateSessionId(),
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Legacy types kept for backward compatibility during migration
// TODO: Remove these once all old code is updated

/**
 * @deprecated Use VideoSegment instead
 */
export interface SceneConfig {
  type: string;
  duration: number;
  content?: any;
  animations?: any;
  colors?: ColorConfig;
}

/**
 * @deprecated Use VideoSession instead
 */
export interface VideoConfig {
  topic: string;
  scenes: any[];
  answerValidation?: any;
  fps?: number;
  width?: number;
  height?: number;
  generatedAt?: string;
  version?: string;
}

