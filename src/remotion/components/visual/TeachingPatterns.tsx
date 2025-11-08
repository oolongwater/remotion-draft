/**
 * TeachingPatterns.tsx
 * 
 * Pre-built visual teaching patterns for common programming concepts.
 * These provide ready-to-use animation sequences for frequent teaching scenarios.
 */

import {
  AnimationSequence,
  VisualElement,
  Connection,
  TextLabel,
  Transition,
  createVisualElement,
  createTransition,
  createTextLabel,
} from '../../../types/AnimationInstruction';

/**
 * Tree Structure Pattern: Shows hierarchical relationships, recursion
 */
export function createTreeStructurePattern(
  topic: string,
  centerX: number = 640,
  centerY: number = 200,
  levels: number = 3
): AnimationSequence {
  const elements: VisualElement[] = [];
  const connections: Connection[] = [];
  const transitions: Transition[] = [];
  
  // Create root node
  elements.push(createVisualElement('root', 'circle', {
    x: centerX,
    y: centerY,
    radius: 40,
    fill: '#3b82f6',
  }));
  
  // Create child nodes
  let currentLevel = 1;
  let nodeId = 0;
  
  for (let level = 1; level < levels; level++) {
    const nodesInLevel = Math.pow(2, level);
    const spacing = 800 / (nodesInLevel + 1);
    
    for (let i = 0; i < nodesInLevel; i++) {
      const nodeX = (i + 1) * spacing;
      const nodeY = centerY + level * 150;
      const id = `node_${nodeId++}`;
      
      elements.push(createVisualElement(id, 'circle', {
        x: nodeX,
        y: nodeY,
        radius: 30,
        fill: '#8b5cf6',
      }));
      
      // Add connection to parent
      const parentIndex = Math.floor(i / 2);
      const parentId = level === 1 ? 'root' : `node_${parentIndex + Math.pow(2, level - 1) - 1}`;
      
      connections.push({
        id: `conn_${id}`,
        from: parentId,
        to: id,
        type: 'line',
        animated: true,
        enterFrame: 30 + level * 40,
      });
    }
  }
  
  // Add enter animations for elements
  elements.forEach((el, index) => {
    el.enterFrame = 10 + index * 5;
    el.enterAnimation = 'spring';
  });
  
  const textLabels: TextLabel[] = [
    createTextLabel('title', topic, centerX, 80, 150),
  ];
  
  return {
    id: `tree_${Date.now()}`,
    duration: 300,
    elements,
    connections,
    transitions,
    textLabels,
    topic,
    visualConcept: 'tree-structure',
    colors: {
      background: '#0f172a',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
  };
}

/**
 * Flow Diagram Pattern: Shows sequential processes
 */
export function createFlowDiagramPattern(
  topic: string,
  steps: string[],
  startX: number = 200,
  centerY: number = 360
): AnimationSequence {
  const elements: VisualElement[] = [];
  const connections: Connection[] = [];
  const transitions: Transition[] = [];
  const textLabels: TextLabel[] = [];
  
  const spacing = (1280 - 2 * startX) / (steps.length - 1);
  
  steps.forEach((step, index) => {
    const x = startX + index * spacing;
    const id = `step_${index}`;
    
    // Add step circle
    elements.push(createVisualElement(id, 'circle', {
      x,
      y: centerY,
      radius: 50,
      fill: '#3b82f6',
    }));
    
    // Add label
    textLabels.push({
      id: `label_${index}`,
      text: step,
      x,
      y: centerY + 100,
      fontSize: 24,
      color: '#e2e8f0',
      enterFrame: 30 + index * 40,
      animation: 'fade',
    });
    
    // Add connection arrow to next step
    if (index < steps.length - 1) {
      connections.push({
        id: `arrow_${index}`,
        from: id,
        to: `step_${index + 1}`,
        type: 'arrow',
        animated: true,
        enterFrame: 30 + index * 40 + 20,
      });
    }
  });
  
  // Add enter animations
  elements.forEach((el, index) => {
    el.enterFrame = 10 + index * 40;
    el.enterAnimation = 'scale';
  });
  
  // Add title
  textLabels.push(createTextLabel('title', topic, 640, 150, 0));
  
  return {
    id: `flow_${Date.now()}`,
    duration: 300 + steps.length * 40,
    elements,
    connections,
    transitions,
    textLabels,
    topic,
    visualConcept: 'flow-diagram',
    colors: {
      background: '#0f172a',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
  };
}

/**
 * Comparison Pattern: Shows A vs B comparison
 */
export function createComparisonPattern(
  topic: string,
  leftLabel: string,
  rightLabel: string,
  leftColor: string = '#3b82f6',
  rightColor: string = '#ef4444'
): AnimationSequence {
  const elements: VisualElement[] = [];
  const transitions: Transition[] = [];
  const textLabels: TextLabel[] = [];
  
  // Left side
  elements.push(createVisualElement('left', 'rect', {
    x: 320,
    y: 360,
    width: 300,
    height: 200,
    fill: leftColor,
  }));
  
  textLabels.push({
    id: 'label_left',
    text: leftLabel,
    x: 320,
    y: 360,
    fontSize: 32,
    color: '#ffffff',
    enterFrame: 40,
    animation: 'kinetic',
  });
  
  // Right side
  elements.push(createVisualElement('right', 'rect', {
    x: 960,
    y: 360,
    width: 300,
    height: 200,
    fill: rightColor,
  }));
  
  textLabels.push({
    id: 'label_right',
    text: rightLabel,
    x: 960,
    y: 360,
    fontSize: 32,
    color: '#ffffff',
    enterFrame: 40,
    animation: 'kinetic',
  });
  
  // Add enter animations
  elements.forEach((el, index) => {
    el.enterFrame = index * 30;
    el.enterAnimation = 'slide';
  });
  
  // Add title
  textLabels.push(createTextLabel('title', topic, 640, 150, 0));
  
  // VS label
  textLabels.push({
    id: 'vs',
    text: 'VS',
    x: 640,
    y: 360,
    fontSize: 48,
    color: '#fbbf24',
    fontWeight: 'bold',
    enterFrame: 60,
    animation: 'fade',
  });
  
  return {
    id: `comparison_${Date.now()}`,
    duration: 300,
    elements,
    transitions,
    textLabels,
    connections: [],
    topic,
    visualConcept: 'comparison',
    colors: {
      background: '#0f172a',
      primary: leftColor,
      secondary: rightColor,
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
  };
}

/**
 * Transformation Pattern: Shows state changes
 */
export function createTransformationPattern(
  topic: string,
  fromShape: 'circle' | 'rect' | 'triangle',
  toShape: 'circle' | 'rect' | 'triangle',
  centerX: number = 640,
  centerY: number = 360
): AnimationSequence {
  const elements: VisualElement[] = [];
  const transitions: Transition[] = [];
  const textLabels: TextLabel[] = [];
  
  // Initial shape
  elements.push(createVisualElement('shape', fromShape, {
    x: centerX,
    y: centerY,
    radius: 60,
    width: 120,
    height: 120,
    fill: '#3b82f6',
  }));
  
  // Morph transition
  transitions.push({
    elementId: 'shape',
    property: 'morph',
    toValue: null,
    startFrame: 90,
    duration: 60,
    morphToShape: toShape,
    easing: 'easeInOut',
  });
  
  // Color transition
  transitions.push({
    elementId: 'shape',
    property: 'fill',
    fromValue: '#3b82f6',
    toValue: '#8b5cf6',
    startFrame: 90,
    duration: 60,
    easing: 'easeInOut',
  });
  
  // Add labels
  textLabels.push(createTextLabel('title', topic, centerX, 150, 0));
  textLabels.push(createTextLabel('before', 'Before', centerX - 200, centerY, 30));
  textLabels.push(createTextLabel('after', 'After', centerX + 200, centerY, 180));
  
  return {
    id: `transformation_${Date.now()}`,
    duration: 240,
    elements,
    transitions,
    textLabels,
    connections: [],
    topic,
    visualConcept: 'transformation',
    colors: {
      background: '#0f172a',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
  };
}

/**
 * Cycle Pattern: Shows repeating/looping processes
 */
export function createCyclePattern(
  topic: string,
  stageLabels: string[],
  centerX: number = 640,
  centerY: number = 360,
  radius: number = 200
): AnimationSequence {
  const elements: VisualElement[] = [];
  const connections: Connection[] = [];
  const transitions: Transition[] = [];
  const textLabels: TextLabel[] = [];
  
  const angleStep = (2 * Math.PI) / stageLabels.length;
  
  stageLabels.forEach((label, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const id = `stage_${index}`;
    
    // Add stage circle
    elements.push(createVisualElement(id, 'circle', {
      x,
      y,
      radius: 40,
      fill: '#3b82f6',
    }));
    
    // Add label
    textLabels.push({
      id: `label_${index}`,
      text: label,
      x,
      y: y + 70,
      fontSize: 20,
      color: '#e2e8f0',
      enterFrame: 20 + index * 30,
      animation: 'fade',
    });
    
    // Add connection to next stage (or back to first)
    const nextIndex = (index + 1) % stageLabels.length;
    connections.push({
      id: `conn_${index}`,
      from: id,
      to: `stage_${nextIndex}`,
      type: 'arrow',
      animated: true,
      enterFrame: 30 + index * 30,
    });
  });
  
  // Add enter animations
  elements.forEach((el, index) => {
    el.enterFrame = 10 + index * 30;
    el.enterAnimation = 'spring';
  });
  
  // Add title
  textLabels.push(createTextLabel('title', topic, centerX, centerY, 0));
  
  return {
    id: `cycle_${Date.now()}`,
    duration: 300 + stageLabels.length * 30,
    elements,
    connections,
    transitions,
    textLabels,
    topic,
    visualConcept: 'cycle',
    colors: {
      background: '#0f172a',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
  };
}

/**
 * Branching Pattern: Shows conditional paths
 */
export function createBranchingPattern(
  topic: string,
  condition: string,
  truePath: string,
  falsePath: string,
  centerX: number = 640,
  centerY: number = 360
): AnimationSequence {
  const elements: VisualElement[] = [];
  const connections: Connection[] = [];
  const transitions: Transition[] = [];
  const textLabels: TextLabel[] = [];
  
  // Start node
  elements.push(createVisualElement('start', 'circle', {
    x: centerX,
    y: centerY - 150,
    radius: 40,
    fill: '#3b82f6',
  }));
  
  // Decision diamond
  elements.push(createVisualElement('decision', 'rect', {
    x: centerX,
    y: centerY,
    width: 100,
    height: 100,
    fill: '#fbbf24',
    rotation: 45,
  }));
  
  textLabels.push({
    id: 'condition',
    text: condition,
    x: centerX,
    y: centerY,
    fontSize: 20,
    color: '#0f172a',
    fontWeight: 'bold',
    enterFrame: 60,
    animation: 'fade',
  });
  
  // True path
  elements.push(createVisualElement('true', 'circle', {
    x: centerX - 200,
    y: centerY + 150,
    radius: 40,
    fill: '#10b981',
  }));
  
  textLabels.push({
    id: 'true_label',
    text: truePath,
    x: centerX - 200,
    y: centerY + 220,
    fontSize: 18,
    color: '#e2e8f0',
    enterFrame: 120,
    animation: 'fade',
  });
  
  // False path
  elements.push(createVisualElement('false', 'circle', {
    x: centerX + 200,
    y: centerY + 150,
    radius: 40,
    fill: '#ef4444',
  }));
  
  textLabels.push({
    id: 'false_label',
    text: falsePath,
    x: centerX + 200,
    y: centerY + 220,
    fontSize: 18,
    color: '#e2e8f0',
    enterFrame: 120,
    animation: 'fade',
  });
  
  // Connections
  connections.push(
    {
      id: 'conn_start',
      from: 'start',
      to: 'decision',
      type: 'arrow',
      animated: true,
      enterFrame: 40,
    },
    {
      id: 'conn_true',
      from: 'decision',
      to: 'true',
      type: 'arrow',
      label: 'True',
      animated: true,
      enterFrame: 90,
    },
    {
      id: 'conn_false',
      from: 'decision',
      to: 'false',
      type: 'arrow',
      label: 'False',
      animated: true,
      enterFrame: 90,
    }
  );
  
  // Add enter animations
  elements.forEach((el, index) => {
    el.enterFrame = 10 + index * 30;
    el.enterAnimation = 'scale';
  });
  
  // Add title
  textLabels.push(createTextLabel('title', topic, centerX, 100, 0));
  
  return {
    id: `branching_${Date.now()}`,
    duration: 300,
    elements,
    connections,
    transitions,
    textLabels,
    topic,
    visualConcept: 'branching',
    colors: {
      background: '#0f172a',
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#fbbf24',
      text: '#e2e8f0',
    },
  };
}

