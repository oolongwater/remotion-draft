/**
 * VisualStateController.tsx
 * 
 * Manages smooth transitions between animation sequences.
 * Handles element matching, morphing, and continuous playback.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import {
  AnimationSequence,
  VisualElement,
  createVisualElement,
} from '../types/AnimationInstruction';
import { ContinuousCanvas } from '../remotion/ContinuousCanvas';

interface VisualStateControllerProps {
  sequences: AnimationSequence[];
  transitionDuration?: number; // Duration of transition between sequences in frames
}

/**
 * Calculate which elements should morph vs fade in/out
 */
function calculateElementTransitions(
  prevSequence: AnimationSequence | null,
  nextSequence: AnimationSequence
): {
  morphingElements: Map<string, string>; // Maps prev element ID to next element ID
  exitingElements: string[]; // Elements that only exist in prev
  enteringElements: string[]; // Elements that only exist in next
} {
  if (!prevSequence) {
    return {
      morphingElements: new Map(),
      exitingElements: [],
      enteringElements: nextSequence.elements.map((e) => e.id),
    };
  }
  
  const prevIds = new Set(prevSequence.elements.map((e) => e.id));
  const nextIds = new Set(nextSequence.elements.map((e) => e.id));
  
  // Elements with matching IDs should morph
  const morphingElements = new Map<string, string>();
  nextSequence.elements.forEach((nextEl) => {
    if (prevIds.has(nextEl.id)) {
      morphingElements.set(nextEl.id, nextEl.id);
    }
  });
  
  // Elements only in prev should fade out
  const exitingElements = prevSequence.elements
    .filter((e) => !nextIds.has(e.id))
    .map((e) => e.id);
  
  // Elements only in next should fade in
  const enteringElements = nextSequence.elements
    .filter((e) => !prevIds.has(e.id))
    .map((e) => e.id);
  
  return { morphingElements, exitingElements, enteringElements };
}

/**
 * Create a transition sequence that blends two animation sequences
 */
function createTransitionSequence(
  prevSequence: AnimationSequence,
  nextSequence: AnimationSequence,
  transitionDuration: number
): AnimationSequence {
  const transitions = calculateElementTransitions(prevSequence, nextSequence);
  
  // Create a blended sequence
  const blendedElements: VisualElement[] = [];
  
  // Add exiting elements with exit animations
  prevSequence.elements
    .filter((e) => transitions.exitingElements.includes(e.id))
    .forEach((element) => {
      blendedElements.push({
        ...element,
        exitFrame: transitionDuration * 0.6,
        exitAnimation: 'fade',
      });
    });
  
  // Add morphing elements (present in both sequences)
  transitions.morphingElements.forEach((nextId, prevId) => {
    const prevEl = prevSequence.elements.find((e) => e.id === prevId)!;
    const nextEl = nextSequence.elements.find((e) => e.id === nextId)!;
    
    // Create element that morphs from prev to next
    blendedElements.push({
      ...prevEl,
      id: prevId,
      type: prevEl.type,
      properties: { ...prevEl.properties },
      enterAnimation: 'none',
    });
  });
  
  // Add entering elements with enter animations
  nextSequence.elements
    .filter((e) => transitions.enteringElements.includes(e.id))
    .forEach((element) => {
      blendedElements.push({
        ...element,
        enterFrame: transitionDuration * 0.4,
        enterAnimation: 'scale',
      });
    });
  
  // Create transition animations for morphing elements
  const transitionAnimations = [];
  transitions.morphingElements.forEach((nextId, prevId) => {
    const prevEl = prevSequence.elements.find((e) => e.id === prevId)!;
    const nextEl = nextSequence.elements.find((e) => e.id === nextId)!;
    
    // If shape type changes, add morph transition
    if (prevEl.type !== nextEl.type) {
      transitionAnimations.push({
        elementId: prevId,
        property: 'morph' as const,
        toValue: null,
        startFrame: 0,
        duration: transitionDuration,
        morphToShape: nextEl.type,
        easing: 'easeInOut' as const,
      });
    }
    
    // Add property transitions (position, color, etc.)
    ['x', 'y', 'fill', 'opacity', 'rotation', 'scale'].forEach((prop) => {
      const key = prop as keyof typeof prevEl.properties;
      if (prevEl.properties[key] !== nextEl.properties[key] && nextEl.properties[key] !== undefined) {
        transitionAnimations.push({
          elementId: prevId,
          property: prop,
          fromValue: prevEl.properties[key],
          toValue: nextEl.properties[key],
          startFrame: 0,
          duration: transitionDuration,
          easing: 'easeInOut' as const,
        });
      }
    });
  });
  
  return {
    id: `transition_${prevSequence.id}_to_${nextSequence.id}`,
    duration: transitionDuration,
    elements: blendedElements,
    transitions: [...prevSequence.transitions, ...transitionAnimations],
    textLabels: [], // No text during transitions
    topic: nextSequence.topic,
    visualConcept: 'transition',
    colors: nextSequence.colors,
    backgroundColor: prevSequence.backgroundColor || prevSequence.colors.background,
  };
}

/**
 * VisualStateController Component
 * 
 * Manages the continuous flow of animation sequences with smooth transitions.
 */
export const VisualStateController: React.FC<VisualStateControllerProps> = ({
  sequences,
  transitionDuration = 30, // Default 1 second at 30fps
}) => {
  const { fps } = useVideoConfig();
  
  if (sequences.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#ffffff', fontSize: 32 }}>Loading...</div>
      </AbsoluteFill>
    );
  }
  
  if (sequences.length === 1) {
    // Single sequence, no transitions needed
    return <ContinuousCanvas sequence={sequences[0]} />;
  }
  
  // Build TransitionSeries with all sequences and transitions
  return (
    <TransitionSeries>
      {sequences.map((sequence, index) => (
        <React.Fragment key={sequence.id}>
          {/* Main sequence */}
          <TransitionSeries.Sequence durationInFrames={sequence.duration}>
            <ContinuousCanvas sequence={sequence} />
          </TransitionSeries.Sequence>
          
          {/* Transition to next sequence */}
          {index < sequences.length - 1 && (
            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: transitionDuration })}
            />
          )}
        </React.Fragment>
      ))}
    </TransitionSeries>
  );
};

/**
 * Alternative version with custom morphing transitions
 * (More complex but provides better control over element morphing)
 */
export const VisualStateControllerWithMorphing: React.FC<VisualStateControllerProps> = ({
  sequences,
  transitionDuration = 30,
}) => {
  if (sequences.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#ffffff', fontSize: 32 }}>Loading...</div>
      </AbsoluteFill>
    );
  }
  
  if (sequences.length === 1) {
    return <ContinuousCanvas sequence={sequences[0]} />;
  }
  
  // Create expanded sequence list with transitions
  const expandedSequences: AnimationSequence[] = [];
  let cumulativeDuration = 0;
  
  sequences.forEach((sequence, index) => {
    if (index > 0) {
      // Add transition sequence
      const transitionSeq = createTransitionSequence(
        sequences[index - 1],
        sequence,
        transitionDuration
      );
      expandedSequences.push(transitionSeq);
      cumulativeDuration += transitionDuration;
    }
    
    expandedSequences.push(sequence);
    cumulativeDuration += sequence.duration;
  });
  
  // Render all sequences as a continuous timeline
  let currentFrame = 0;
  
  return (
    <AbsoluteFill>
      {expandedSequences.map((sequence) => {
        const from = currentFrame;
        const duration = sequence.duration;
        currentFrame += duration;
        
        return (
          <Sequence
            key={sequence.id}
            from={from}
            durationInFrames={duration}
          >
            <ContinuousCanvas sequence={sequence} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

