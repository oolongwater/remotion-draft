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
  difficulty: "easy" | "medium" | "hard"; // Difficulty level
  // Optional metadata
  generatedAt?: string;
  parentSegmentId?: string; // ID of the segment that led to this one
  videoUrl?: string; // URL to the rendered video (set after rendering)
  thumbnailUrl?: string; // URL to the thumbnail image (first frame)
  title?: string; // Generated title for this segment
  renderingStatus?: "pending" | "rendering" | "completed" | "failed"; // Status of video rendering
  voiceoverScript?: string; // Combined narration text for this segment
  userAnswer?: string; // Learner's response collected during this segment
  isQuestionNode?: boolean; // True if this is a question-only node (no video)
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
  preferredStyle?: "visual" | "code-heavy" | "conceptual" | "mixed";
}

/**
 * Tree node wrapping a video segment with parent/child relationships
 * Used for git-like branching navigation
 */
export interface TreeNode {
  id: string;
  segment: VideoSegment;
  parentId: string | null; // null for root
  childIds: string[]; // Array of child node IDs
  branchIndex: number; // Which branch from parent (0, 1, 2...)
  branchLabel?: string; // "Answer 1", "Question: Why?"
}

/**
 * Learning tree structure using flat Map + Adjacency List
 * Enables O(1) lookups and easy serialization
 * Supports multiple independent root nodes for separate learning paths
 */
export interface LearningTree {
  nodes: Map<string, TreeNode>; // Fast lookup by ID
  rootIds: string[]; // Array of root node IDs for multiple independent trees
  currentNodeId: string;
}

/**
 * The complete video session state
 * Represents the entire learning journey
 */
export interface VideoSession {
  // Tree structure for branching navigation
  tree: LearningTree;

  // Learning context for generating next segments
  context: LearningContext;

  // Session metadata
  sessionId: string;
  startedAt: string;
  lastUpdatedAt: string;
}

/**
 * @deprecated Legacy linear session structure - use tree-based VideoSession instead
 */
export interface LegacyVideoSession {
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
  suggestedDifficulty?: "easy" | "medium" | "hard";
  error?: string;
}

/**
 * A single reflection question
 */
export interface ReflectionQuestion {
  id: string;
  prompt: string;
  placeholder?: string;
}

/**
 * Response from backend when generating reflection questions
 */
export interface GenerateReflectionQuestionsResponse {
  success: boolean;
  questions?: ReflectionQuestion[];
  error?: string;
}

/**
 * Closing question request payload
 */
export interface ClosingQuestionPayload {
  topic: string;
  voiceoverSections: Array<{
    section: number;
    script: string;
  }>;
  userResponses: Array<{
    prompt: string;
    answer: string;
  }>;
  summary?: string;
}

/**
 * Response from backend when generating a closing question
 */
export interface GenerateClosingQuestionResponse {
  success: boolean;
  question?: string;
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
    preferredStyle: "mixed",
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
 * Helper function to create a new tree-based video session
 */
export function createVideoSession(initialTopic: string): VideoSession {
  // Create empty tree (will be populated when first segment is generated)
  const tree: LearningTree = {
    nodes: new Map(),
    rootIds: [],
    currentNodeId: "",
  };

  return {
    tree,
    context: createInitialContext(initialTopic),
    sessionId: generateSessionId(),
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Helper function to create a legacy linear video session
 * @deprecated Use createVideoSession instead
 */
export function createLegacyVideoSession(
  initialTopic: string
): LegacyVideoSession {
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

/**
 * Generate a unique node ID
 */
export function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Legacy types kept for backward compatibility during migration
// TODO: Remove these once all old code is updated

/**
 * @deprecated Use VideoSegment instead
 */
export interface ColorConfig {
  [key: string]: string;
}

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
