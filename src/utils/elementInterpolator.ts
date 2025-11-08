/**
 * elementInterpolator.ts
 * 
 * Utilities for smoothly interpolating between element states in keyframes.
 * Handles morphing, appearing, disappearing, and property transitions.
 */

import { interpolate } from 'remotion';
import { VisualElement, ElementProperties, ElementType } from '../types/AnimationInstruction';
import { Action } from '../types/EvolutionScript';

/**
 * Interpolate between two element states
 */
export function interpolateElementProperties(
  fromProps: ElementProperties,
  toProps: ElementProperties,
  progress: number,
  easing: (x: number) => number = (x) => x
): ElementProperties {
  const easedProgress = easing(progress);
  
  const result: ElementProperties = { ...fromProps };
  
  // Interpolate numeric properties
  const numericProps: (keyof ElementProperties)[] = [
    'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'width', 'height', 'radius',
    'opacity', 'rotation', 'scale', 'scaleX', 'scaleY',
    'strokeWidth', 'fontSize'
  ];
  
  for (const prop of numericProps) {
    const fromVal = fromProps[prop];
    const toVal = toProps[prop];
    
    if (typeof fromVal === 'number' && typeof toVal === 'number') {
      (result as any)[prop] = fromVal + (toVal - fromVal) * easedProgress;
    } else if (typeof toVal === 'number' && fromVal === undefined) {
      (result as any)[prop] = toVal * easedProgress;
    }
  }
  
  // Interpolate colors
  if (fromProps.fill && toProps.fill) {
    result.fill = interpolateColor(fromProps.fill, toProps.fill, easedProgress);
  } else if (toProps.fill) {
    result.fill = toProps.fill;
  }
  
  if (fromProps.stroke && toProps.stroke) {
    result.stroke = interpolateColor(fromProps.stroke, toProps.stroke, easedProgress);
  } else if (toProps.stroke) {
    result.stroke = toProps.stroke;
  }
  
  // Copy string properties
  if (toProps.text !== undefined) result.text = toProps.text;
  if (toProps.fontWeight !== undefined) result.fontWeight = toProps.fontWeight;
  if (toProps.textAlign !== undefined) result.textAlign = toProps.textAlign;
  if (toProps.label !== undefined) result.label = toProps.label;
  if (toProps.shape !== undefined) result.shape = toProps.shape;
  if (toProps.path !== undefined) result.path = toProps.path;
  
  return result;
}

/**
 * Interpolate between two color strings (hex format)
 */
function interpolateColor(color1: string, color2: string, progress: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get easing function
 */
function getEasingFunction(easing?: string): (x: number) => number {
  switch (easing) {
    case 'easeIn':
      return (x) => x * x;
    case 'easeOut':
      return (x) => 1 - Math.pow(1 - x, 2);
    case 'easeInOut':
      return (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'spring':
      // Simple spring approximation
      return (x) => {
        const c4 = (2 * Math.PI) / 3;
        return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
      };
    default:
      return (x) => x; // linear
  }
}

/**
 * Interpolate between two arrays of elements
 * Matches elements by ID and interpolates their properties
 */
export function interpolateElements(
  prevElements: VisualElement[],
  nextElements: VisualElement[],
  progress: number,
  actions?: Action[]
): VisualElement[] {
  const result: VisualElement[] = [];
  
  // Create maps for quick lookup
  const prevMap = new Map(prevElements.map(el => [el.id, el]));
  const nextMap = new Map(nextElements.map(el => [el.id, el]));
  
  // Track which elements we've processed
  const processedIds = new Set<string>();
  
  // Process elements that exist in next state
  for (const nextEl of nextElements) {
    const prevEl = prevMap.get(nextEl.id);
    
    if (prevEl) {
      // Element exists in both - interpolate
      const action = actions?.find(a => a.elementId === nextEl.id);
      const easing = getEasingFunction(action?.params?.easing);
      
      result.push({
        ...nextEl,
        properties: interpolateElementProperties(
          prevEl.properties,
          nextEl.properties,
          progress,
          easing
        ),
      });
    } else {
      // Element is new - fade in
      const appearAction = actions?.find(a => a.type === 'appear' && a.elementId === nextEl.id);
      const appearProgress = appearAction ? progress : Math.min(1, progress * 2); // Faster fade in
      
      result.push({
        ...nextEl,
        properties: {
          ...nextEl.properties,
          opacity: (nextEl.properties.opacity ?? 1) * appearProgress,
          scale: nextEl.properties.scale ? nextEl.properties.scale * (0.5 + 0.5 * appearProgress) : undefined,
        },
      });
    }
    
    processedIds.add(nextEl.id);
  }
  
  // Process elements that existed before but are disappearing
  for (const prevEl of prevElements) {
    if (!processedIds.has(prevEl.id)) {
      const disappearAction = actions?.find(a => a.type === 'disappear' && a.elementId === prevEl.id);
      const disappearProgress = disappearAction ? 1 - progress : Math.max(0, 1 - progress * 2);
      
      result.push({
        ...prevEl,
        properties: {
          ...prevEl.properties,
          opacity: (prevEl.properties.opacity ?? 1) * disappearProgress,
          scale: prevEl.properties.scale ? prevEl.properties.scale * (0.5 + 0.5 * disappearProgress) : undefined,
        },
      });
    }
  }
  
  return result;
}

/**
 * Apply an action to an element
 * Used for special transformations like split and merge
 */
export function applyAction(
  element: VisualElement,
  action: Action,
  progress: number,
  allElements: VisualElement[]
): VisualElement[] {
  const easing = getEasingFunction(action.params?.easing);
  const easedProgress = easing(progress);
  
  switch (action.type) {
    case 'split': {
      // If splitting, return multiple elements
      if (action.params?.into && action.params?.splitProperties) {
        const splitElements: VisualElement[] = action.params.into.map((id, i) => {
          const targetProps = action.params!.splitProperties![i];
          return {
            id,
            type: element.type,
            properties: interpolateElementProperties(
              element.properties,
              targetProps,
              easedProgress
            ),
          };
        });
        
        // Original element fades out as splits appear
        if (easedProgress < 0.5) {
          return [
            {
              ...element,
              properties: {
                ...element.properties,
                opacity: (element.properties.opacity ?? 1) * (1 - easedProgress * 2),
              },
            },
            ...splitElements.map(el => ({
              ...el,
              properties: {
                ...el.properties,
                opacity: (el.properties.opacity ?? 1) * (easedProgress * 2),
              },
            })),
          ];
        } else {
          return splitElements;
        }
      }
      return [element];
    }
    
    case 'merge': {
      // Merging happens when multiple elements become one
      // This is handled at the interpolateElements level
      return [element];
    }
    
    case 'morph': {
      // Morphing is handled by property interpolation
      return [element];
    }
    
    default:
      return [element];
  }
}

/**
 * Calculate element changes between two keyframes
 * Returns a description of what changed
 */
export function calculateChanges(
  prevElements: VisualElement[],
  nextElements: VisualElement[]
): Action[] {
  const actions: Action[] = [];
  
  const prevMap = new Map(prevElements.map(el => [el.id, el]));
  const nextMap = new Map(nextElements.map(el => [el.id, el]));
  
  // Check for new elements
  for (const nextEl of nextElements) {
    if (!prevMap.has(nextEl.id)) {
      actions.push({
        type: 'appear',
        elementId: nextEl.id,
      });
    }
  }
  
  // Check for removed elements
  for (const prevEl of prevElements) {
    if (!nextMap.has(prevEl.id)) {
      actions.push({
        type: 'disappear',
        elementId: prevEl.id,
      });
    }
  }
  
  // Check for morphed elements
  for (const nextEl of nextElements) {
    const prevEl = prevMap.get(nextEl.id);
    if (prevEl && prevEl.type !== nextEl.type) {
      actions.push({
        type: 'morph',
        elementId: nextEl.id,
        params: {
          toShape: nextEl.type,
        },
      });
    }
  }
  
  return actions;
}

