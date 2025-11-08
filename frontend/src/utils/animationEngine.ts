/**
 * animationEngine.ts
 * 
 * Converts animation configuration objects into Remotion animations.
 * Provides helpers for spring, easing, keyframe, and sequence animations.
 */

import { interpolate, spring, Easing } from 'remotion';
import {
  AnimationDefinition,
  SpringAnimationConfig,
  EasingAnimationConfig,
  KeyframeAnimationConfig,
  SequenceAnimationConfig,
  EasingFunction,
  KeyframePoint,
} from '../types/SceneConfig';

/**
 * Easing function mappings
 */
const EASING_FUNCTIONS: Record<EasingFunction, Easing> = {
  linear: Easing.linear,
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),
  easeInQuad: Easing.in(Easing.quad),
  easeOutQuad: Easing.out(Easing.quad),
  easeInOutQuad: Easing.inOut(Easing.quad),
  easeInCubic: Easing.in(Easing.cubic),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInOutCubic: Easing.inOut(Easing.cubic),
  easeInQuart: Easing.in(Easing.poly(4)),
  easeOutQuart: Easing.out(Easing.poly(4)),
  easeInOutQuart: Easing.inOut(Easing.poly(4)),
};

/**
 * Get easing function from config
 */
function getEasingFunction(easingName?: EasingFunction): Easing | undefined {
  if (!easingName) return undefined;
  return EASING_FUNCTIONS[easingName];
}

/**
 * Convert value to number if it's a string percentage or pixel value
 */
function parseValue(value: number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle percentages
    if (value.endsWith('%')) {
      return parseFloat(value) / 100;
    }
    // Handle pixel values
    if (value.endsWith('px')) {
      return parseFloat(value);
    }
    // Try to parse as number
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Create a spring animation
 */
export function createSpringAnimation(
  frame: number,
  fps: number,
  config: SpringAnimationConfig
): number {
  const delay = config.delay || 0;
  const from = parseValue(config.from);
  const to = parseValue(config.to);
  
  const springValue = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: config.config?.damping ?? 10,
      stiffness: config.config?.stiffness ?? 100,
      mass: config.config?.mass ?? 1,
      overshootClamping: config.config?.overshootClamping ?? false,
    },
  });
  
  // Interpolate from -> to using spring value (0 to 1)
  return from + (to - from) * springValue;
}

/**
 * Create an easing animation
 */
export function createEasingAnimation(
  frame: number,
  config: EasingAnimationConfig
): number {
  const delay = config.delay || 0;
  const from = parseValue(config.from);
  const to = parseValue(config.to);
  const easing = getEasingFunction(config.easing);
  
  return interpolate(
    frame,
    [delay, delay + config.duration],
    [from, to],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing,
    }
  );
}

/**
 * Create a keyframe animation
 */
export function createKeyframeAnimation(
  frame: number,
  config: KeyframeAnimationConfig
): number {
  if (config.keyframes.length === 0) return 0;
  if (config.keyframes.length === 1) return parseValue(config.keyframes[0].value);
  
  // Sort keyframes by frame
  const sortedKeyframes = [...config.keyframes].sort((a, b) => a.frame - b.frame);
  
  // Find the current segment
  for (let i = 0; i < sortedKeyframes.length - 1; i++) {
    const current = sortedKeyframes[i];
    const next = sortedKeyframes[i + 1];
    
    if (frame >= current.frame && frame <= next.frame) {
      const easing = getEasingFunction(next.easing);
      return interpolate(
        frame,
        [current.frame, next.frame],
        [parseValue(current.value), parseValue(next.value)],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing,
        }
      );
    }
  }
  
  // Before first keyframe
  if (frame < sortedKeyframes[0].frame) {
    return parseValue(sortedKeyframes[0].value);
  }
  
  // After last keyframe
  return parseValue(sortedKeyframes[sortedKeyframes.length - 1].value);
}

/**
 * Create a sequence animation (execute animations in order)
 * Returns the value of the currently active animation in the sequence
 */
export function createSequenceAnimation(
  frame: number,
  fps: number,
  config: SequenceAnimationConfig
): number {
  // For sequences, we need to track cumulative duration
  // This is a simplified implementation - may need refinement
  let currentFrame = 0;
  
  for (const anim of config.animations) {
    if (anim.type === 'spring') {
      // Springs don't have a fixed duration, approximate with delay
      const duration = (anim.delay || 0) + 60; // Assume 60 frames for spring
      if (frame < currentFrame + duration) {
        return createSpringAnimation(frame - currentFrame, fps, anim);
      }
      currentFrame += duration;
    } else if (anim.type === 'easing') {
      const duration = anim.duration + (anim.delay || 0);
      if (frame < currentFrame + duration) {
        return createEasingAnimation(frame - currentFrame, anim);
      }
      currentFrame += duration;
    } else if (anim.type === 'keyframe') {
      const duration = Math.max(...anim.keyframes.map(k => k.frame));
      if (frame < currentFrame + duration) {
        return createKeyframeAnimation(frame - currentFrame, anim);
      }
      currentFrame += duration;
    }
  }
  
  // Return the last animation's final value
  return 0;
}

/**
 * Main animation engine function - dispatches to appropriate handler
 */
export function applyAnimation(
  frame: number,
  fps: number,
  definition: AnimationDefinition
): number {
  switch (definition.type) {
    case 'spring':
      return createSpringAnimation(frame, fps, definition);
    case 'easing':
      return createEasingAnimation(frame, definition);
    case 'keyframe':
      return createKeyframeAnimation(frame, definition);
    case 'sequence':
      return createSequenceAnimation(frame, fps, definition);
    default:
      return 0;
  }
}

/**
 * Apply multiple animations and return a map of property -> value
 */
export function applyAnimations(
  frame: number,
  fps: number,
  definitions: AnimationDefinition[]
): Record<string, number> {
  const result: Record<string, number> = {};
  
  for (const def of definitions) {
    if (def.type === 'sequence') {
      // Sequences don't have a single property
      continue;
    }
    
    const value = applyAnimation(frame, fps, def);
    result[def.property] = value;
  }
  
  return result;
}

/**
 * Animation presets for common patterns
 */
export const AnimationPresets = {
  fadeIn: (duration: number = 30, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'opacity',
    from: 0,
    to: 1,
    duration,
    delay,
    easing: 'easeOut',
  }),
  
  fadeOut: (duration: number = 30, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'opacity',
    from: 1,
    to: 0,
    duration,
    delay,
    easing: 'easeIn',
  }),
  
  slideInLeft: (distance: number = 100, duration: number = 40, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'translateX',
    from: -distance,
    to: 0,
    duration,
    delay,
    easing: 'easeOutCubic',
  }),
  
  slideInRight: (distance: number = 100, duration: number = 40, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'translateX',
    from: distance,
    to: 0,
    duration,
    delay,
    easing: 'easeOutCubic',
  }),
  
  slideInUp: (distance: number = 100, duration: number = 40, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'translateY',
    from: distance,
    to: 0,
    duration,
    delay,
    easing: 'easeOutCubic',
  }),
  
  slideInDown: (distance: number = 100, duration: number = 40, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'translateY',
    from: -distance,
    to: 0,
    duration,
    delay,
    easing: 'easeOutCubic',
  }),
  
  scaleIn: (duration: number = 30, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'scale',
    from: 0,
    to: 1,
    duration,
    delay,
    easing: 'easeOutCubic',
  }),
  
  bounceIn: (delay: number = 0): SpringAnimationConfig => ({
    type: 'spring',
    property: 'scale',
    from: 0,
    to: 1,
    delay,
    config: {
      damping: 10,
      stiffness: 200,
      mass: 0.5,
    },
  }),
  
  rotate360: (duration: number = 60, delay: number = 0): EasingAnimationConfig => ({
    type: 'easing',
    property: 'rotate',
    from: 0,
    to: 360,
    duration,
    delay,
    easing: 'linear',
  }),
  
  pulse: (frames: number = 120): KeyframeAnimationConfig => ({
    type: 'keyframe',
    property: 'scale',
    keyframes: [
      { frame: 0, value: 1 },
      { frame: frames * 0.25, value: 1.05, easing: 'easeInOut' },
      { frame: frames * 0.5, value: 1, easing: 'easeInOut' },
      { frame: frames * 0.75, value: 1.05, easing: 'easeInOut' },
      { frame: frames, value: 1, easing: 'easeInOut' },
    ],
  }),
};

/**
 * Helper to build a transform string from animation values
 */
export function buildTransform(values: Record<string, number>): string {
  const transforms: string[] = [];
  
  if ('translateX' in values || 'translateY' in values) {
    const x = values.translateX || 0;
    const y = values.translateY || 0;
    transforms.push(`translate(${x}px, ${y}px)`);
  }
  
  if ('scale' in values) {
    transforms.push(`scale(${values.scale})`);
  }
  
  if ('scaleX' in values) {
    transforms.push(`scaleX(${values.scaleX})`);
  }
  
  if ('scaleY' in values) {
    transforms.push(`scaleY(${values.scaleY})`);
  }
  
  if ('rotate' in values) {
    transforms.push(`rotate(${values.rotate}deg)`);
  }
  
  if ('rotateX' in values) {
    transforms.push(`rotateX(${values.rotateX}deg)`);
  }
  
  if ('rotateY' in values) {
    transforms.push(`rotateY(${values.rotateY}deg)`);
  }
  
  if ('skewX' in values) {
    transforms.push(`skewX(${values.skewX}deg)`);
  }
  
  if ('skewY' in values) {
    transforms.push(`skewY(${values.skewY}deg)`);
  }
  
  return transforms.join(' ');
}

/**
 * Helper to extract CSS properties from animation values
 */
export function buildStyle(values: Record<string, number>): React.CSSProperties {
  const style: React.CSSProperties = {};
  
  // Extract transform properties
  const transformProps = ['translateX', 'translateY', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'skewX', 'skewY'];
  const transformValues: Record<string, number> = {};
  
  for (const prop of transformProps) {
    if (prop in values) {
      transformValues[prop] = values[prop];
    }
  }
  
  if (Object.keys(transformValues).length > 0) {
    style.transform = buildTransform(transformValues);
  }
  
  // Extract direct CSS properties
  if ('opacity' in values) {
    style.opacity = values.opacity;
  }
  
  if ('width' in values) {
    style.width = values.width;
  }
  
  if ('height' in values) {
    style.height = values.height;
  }
  
  return style;
}
