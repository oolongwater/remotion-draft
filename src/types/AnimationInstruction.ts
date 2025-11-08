/**
 * AnimationInstruction.ts
 * 
 * Type definitions for declarative animation instructions.
 * These replace the previous React component code generation approach.
 */

/**
 * Base properties for any visual element
 */
export interface ElementProperties {
  // Position (for most elements)
  x?: number;
  y?: number;
  
  // Line-specific properties
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  
  // Size
  width?: number;
  height?: number;
  radius?: number; // For circles
  
  // Appearance
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  
  // Transform
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  
  // SVG Path (for custom shapes)
  path?: string;
  
  // Text properties
  text?: string;
  fontSize?: number;
  fontWeight?: string | number;
  textAlign?: 'left' | 'center' | 'right';
  
  // Diagram node properties
  label?: string;
  shape?: 'rect' | 'circle' | 'diamond' | 'ellipse';
  
  // Line/connection properties
  dashed?: boolean;
  
  // Z-index for layering
  zIndex?: number;
}

/**
 * Types of visual elements that can be animated
 */
export type ElementType = 
  | 'circle'
  | 'rect'
  | 'polygon'
  | 'triangle'
  | 'star'
  | 'path'
  | 'text'
  | 'line'
  | 'diagram-node'
  | 'connection'
  | 'icon';

/**
 * A visual element in the animation
 */
export interface VisualElement {
  id: string;
  type: ElementType;
  properties: ElementProperties;
  enterFrame?: number; // When the element should appear
  exitFrame?: number; // When the element should disappear
  enterAnimation?: 'fade' | 'scale' | 'slide' | 'spring' | 'none';
  exitAnimation?: 'fade' | 'scale' | 'slide' | 'none';
}

/**
 * Connection between two elements (for diagrams)
 */
export interface Connection {
  id: string;
  from: string; // Element ID
  to: string; // Element ID
  type?: 'line' | 'arrow' | 'curve';
  label?: string;
  dashed?: boolean;
  animated?: boolean; // Animate the line drawing
  enterFrame?: number;
  exitFrame?: number;
}

/**
 * Easing functions available
 */
export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'spring'
  | 'bounce'
  | 'elastic';

/**
 * A transition that transforms an element's properties over time
 */
export interface Transition {
  elementId: string;
  property: keyof ElementProperties | 'morph'; // 'morph' for shape-to-shape
  fromValue?: any;
  toValue: any;
  startFrame: number;
  duration: number;
  easing?: EasingType;
  // For morphing between shapes
  morphToShape?: ElementType;
  morphToPath?: string;
}

/**
 * Camera movement for focus and zoom effects
 */
export interface CameraMovement {
  startFrame: number;
  duration: number;
  fromX: number;
  fromY: number;
  fromZoom: number;
  toX: number;
  toY: number;
  toZoom: number;
  easing?: EasingType;
}

/**
 * Text label that appears on screen
 */
export interface TextLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  fontWeight?: string | number;
  enterFrame: number;
  exitFrame?: number;
  animation?: 'fade' | 'typewriter' | 'kinetic' | 'none';
}

/**
 * A complete animation sequence
 * This represents one "teaching moment" in the video
 */
export interface AnimationSequence {
  id: string;
  duration: number; // Total duration in frames
  
  // Visual elements in this sequence
  elements: VisualElement[];
  
  // Connections between elements (for diagrams)
  connections?: Connection[];
  
  // Transitions/animations over time
  transitions: Transition[];
  
  // Text labels (minimal, as per design)
  textLabels?: TextLabel[];
  
  // Optional camera movement
  camera?: CameraMovement;
  
  // Metadata
  topic: string;
  visualConcept: string; // E.g., "tree-splitting-pattern", "flow-diagram", "comparison"
  colors: ColorScheme;
  
  // Background
  backgroundColor?: string;
}

/**
 * Color scheme for the sequence
 */
export interface ColorScheme {
  background: string;
  primary: string;
  secondary?: string;
  accent?: string;
  text: string;
}

/**
 * Teaching pattern types - pre-built visual patterns
 */
export type TeachingPattern =
  | 'tree-structure'
  | 'flow-diagram'
  | 'comparison'
  | 'timeline'
  | 'network-graph'
  | 'transformation'
  | 'zoom-levels'
  | 'cycle'
  | 'branching';

/**
 * Response from LLM when generating an animation sequence
 */
export interface GenerateAnimationResponse {
  success: boolean;
  sequence?: AnimationSequence;
  error?: string;
}

/**
 * Helper to create a basic visual element
 */
export function createVisualElement(
  id: string,
  type: ElementType,
  properties: Partial<ElementProperties>
): VisualElement {
  return {
    id,
    type,
    properties: {
      x: 0,
      y: 0,
      opacity: 1,
      ...properties,
    },
  };
}

/**
 * Helper to create a transition
 */
export function createTransition(
  elementId: string,
  property: keyof ElementProperties | 'morph',
  toValue: any,
  startFrame: number,
  duration: number,
  easing: EasingType = 'easeInOut'
): Transition {
  return {
    elementId,
    property,
    toValue,
    startFrame,
    duration,
    easing,
  };
}

/**
 * Helper to create a text label
 */
export function createTextLabel(
  id: string,
  text: string,
  x: number,
  y: number,
  enterFrame: number,
  exitFrame?: number
): TextLabel {
  return {
    id,
    text,
    x,
    y,
    enterFrame,
    exitFrame,
    fontSize: 32,
    color: '#ffffff',
  };
}

