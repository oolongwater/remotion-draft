/**
 * EvolutionScript.ts
 * 
 * Type definitions for the evolving composition system.
 * Describes how visual elements transform over time in a continuous composition.
 */

import { VisualElement, ElementProperties, ElementType } from './AnimationInstruction';

/**
 * Action types that describe how elements change
 */
export type ActionType = 'morph' | 'split' | 'merge' | 'appear' | 'disappear' | 'move' | 'scale' | 'rotate' | 'recolor';

/**
 * An action describes a transformation of an element
 */
export interface Action {
  type: ActionType;
  elementId: string;
  targetElementId?: string; // For merge operations
  params?: {
    // For morph
    toShape?: ElementType;
    toProperties?: Partial<ElementProperties>;
    
    // For split
    into?: string[]; // IDs of resulting elements
    splitProperties?: ElementProperties[];
    
    // For merge
    from?: string[]; // IDs of elements being merged
    
    // For move/scale/rotate
    deltaX?: number;
    deltaY?: number;
    deltaScale?: number;
    deltaRotation?: number;
    
    // For recolor
    toColor?: string;
    
    // Animation easing
    easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';
  };
}

/**
 * A keyframe represents the complete visual state at a specific point in time
 */
export interface EvolutionKeyframe {
  frame: number;
  elements: VisualElement[]; // Complete state of all elements at this frame
  actions?: Action[]; // What actions caused the change from previous keyframe
  textLabels?: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize?: number;
    color?: string;
    fontWeight?: string | number;
  }>;
  pauseForQuestion?: {
    questionText: string;
    resumeAfterAnswer: boolean;
  };
  description?: string; // Human-readable description of what's happening
}

/**
 * An evolution script describes how the composition evolves over a time period
 */
export interface EvolutionScript {
  id: string;
  startFrame: number;
  endFrame: number;
  duration: number; // endFrame - startFrame
  keyframes: EvolutionKeyframe[];
  topic: string;
  colors: {
    background: string;
    primary: string;
    secondary?: string;
    accent?: string;
    text: string;
  };
  // Metadata
  generatedAt?: string;
  continuesFrom?: string; // ID of previous script if this is an extension
}

/**
 * Response from LLM when generating an evolution script
 */
export interface GenerateEvolutionResponse {
  success: boolean;
  script?: EvolutionScript;
  error?: string;
}

/**
 * Request parameters for generating an evolution script
 */
export interface GenerateEvolutionRequest {
  topic: string;
  previousScript?: EvolutionScript; // If extending, provide previous script
  duration?: number; // Desired duration in frames (default 1800 = 1 minute at 30fps)
  userAnswer?: string; // If user answered a question
  wasCorrect?: boolean; // Whether the answer was correct
  startingElements?: VisualElement[]; // Override starting state
}

/**
 * Helper function to create an initial evolution script
 */
export function createEvolutionScript(
  topic: string,
  initialKeyframe: EvolutionKeyframe,
  duration: number = 1800
): EvolutionScript {
  return {
    id: `evolution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    startFrame: 0,
    endFrame: duration,
    duration,
    keyframes: [initialKeyframe],
    topic,
    colors: {
      background: '#0f172a',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Helper function to find keyframes surrounding a given frame
 */
export function findSurroundingKeyframes(
  frame: number,
  keyframes: EvolutionKeyframe[]
): { prev: EvolutionKeyframe | null; next: EvolutionKeyframe | null; progress: number } {
  if (keyframes.length === 0) {
    return { prev: null, next: null, progress: 0 };
  }
  
  // Sort keyframes by frame
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  
  // Find the previous and next keyframes
  let prevKeyframe: EvolutionKeyframe | null = null;
  let nextKeyframe: EvolutionKeyframe | null = null;
  
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].frame <= frame) {
      prevKeyframe = sorted[i];
    }
    if (sorted[i].frame > frame) {
      nextKeyframe = sorted[i];
      break;
    }
  }
  
  // If we're past all keyframes, use the last one
  if (!nextKeyframe && prevKeyframe) {
    return { prev: prevKeyframe, next: prevKeyframe, progress: 1 };
  }
  
  // If we're before all keyframes, use the first one
  if (!prevKeyframe && nextKeyframe) {
    return { prev: nextKeyframe, next: nextKeyframe, progress: 0 };
  }
  
  // Calculate progress between keyframes
  if (prevKeyframe && nextKeyframe) {
    const totalFrames = nextKeyframe.frame - prevKeyframe.frame;
    const currentFrames = frame - prevKeyframe.frame;
    const progress = totalFrames > 0 ? currentFrames / totalFrames : 0;
    return { prev: prevKeyframe, next: nextKeyframe, progress };
  }
  
  return { prev: prevKeyframe, next: nextKeyframe, progress: 0 };
}

/**
 * Helper function to get the current visual state at a specific frame
 */
export function getStateAtFrame(
  frame: number,
  script: EvolutionScript
): EvolutionKeyframe | null {
  const { prev, next, progress } = findSurroundingKeyframes(frame, script.keyframes);
  
  if (!prev) return null;
  if (!next || prev === next) return prev;
  
  // For now, return the previous keyframe
  // The interpolation will be handled by the component
  return prev;
}

/**
 * Helper to check if a frame has a pause point
 */
export function getPausePointAtFrame(
  frame: number,
  script: EvolutionScript
): EvolutionKeyframe['pauseForQuestion'] | null {
  const keyframe = script.keyframes.find(kf => kf.frame === frame);
  return keyframe?.pauseForQuestion || null;
}

