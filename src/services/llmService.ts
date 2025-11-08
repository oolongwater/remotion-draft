/**
 * llmService.ts
 * 
 * Service for integrating with Claude API to generate dynamic video segments
 * and evaluate user understanding.
 */

/// <reference types="vite/client" />

import {
  VideoSegment,
  LearningContext,
  GenerateSegmentResponse,
  EvaluateAnswerResponse,
  ColorConfig,
} from '../types/VideoConfig';
import {
  EvolutionScript,
  EvolutionKeyframe,
  GenerateEvolutionRequest,
  GenerateEvolutionResponse,
} from '../types/EvolutionScript';

/**
 * Generate a dynamic video segment based on learning context
 */
export async function generateVideoSegment(
  context: LearningContext
): Promise<GenerateSegmentResponse> {
  console.log('generateVideoSegment called with context:', context);
  
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('API key not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
    };
  }
  
  try {
    const prompt = buildSegmentPrompt(context);
    console.log('Generated prompt length:', prompt.length);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API request failed:', response.status, errorData);
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
      };
    }
    
    const data = await response.json();
    console.log('API response received, content length:', data.content?.[0]?.text?.length);
    
    const textContent = data.content?.[0]?.text;
    
    if (!textContent) {
      console.error('No text content in response:', data);
      return {
        success: false,
        error: 'No content received from API',
      };
    }
    
    // Parse the JSON response
    const cleanedJSON = cleanJSONResponse(textContent);
    let segmentData: any;
    
    try {
      segmentData = JSON.parse(cleanedJSON);
      console.log('Parsed segment data:', {
        hasAnimationSequence: !!segmentData.animationSequence,
        duration: segmentData.animationSequence?.duration,
        hasQuestion: segmentData.hasQuestion,
        elementCount: segmentData.animationSequence?.elements?.length,
        topic: segmentData.animationSequence?.topic,
      });
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Received text:', textContent);
      return {
        success: false,
        error: 'Failed to parse video segment JSON from API response',
      };
    }
    
    // Validate and construct VideoSegment
    if (!validateAnimationSequenceData(segmentData)) {
      console.error('Validation failed for segment data:', segmentData);
      return {
        success: false,
        error: 'Invalid animation sequence structure from API. Check console for details.',
      };
    }
    
    // Add unique IDs to the animation sequence if not present
    const animSeq = segmentData.animationSequence;
    if (!animSeq.id) {
      animSeq.id = generateSegmentId();
    }
    
    const segment: VideoSegment = {
      id: animSeq.id,
      animationSequence: animSeq,
      duration: animSeq.duration || 300, // Default 10 seconds at 30fps
      hasQuestion: segmentData.hasQuestion || false,
      questionText: segmentData.questionText,
      topic: animSeq.topic || context.previousTopic || context.initialTopic || 'Unknown',
      difficulty: segmentData.difficulty || 'medium',
      colors: animSeq.colors || getDefaultColors(),
      generatedAt: new Date().toISOString(),
      parentSegmentId: context.depth > 0 ? `segment_${context.depth - 1}` : undefined,
    };
    
    return {
      success: true,
      segment,
    };
  } catch (error) {
    console.error('LLM Service Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Evaluate a user's answer to determine correctness and next steps
 */
export async function evaluateAnswer(
  answer: string,
  question: string,
  topic: string
): Promise<EvaluateAnswerResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured',
    };
  }
  
  try {
    const prompt = buildEvaluationPrompt(answer, question, topic);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `API request failed: ${response.status}`,
      };
    }
    
    const data = await response.json();
    const textContent = data.content?.[0]?.text;
    
    if (!textContent) {
      return {
        success: false,
        error: 'No content received from API',
      };
    }
    
    const cleanedJSON = cleanJSONResponse(textContent);
    let evalData: any;
    
    try {
      evalData = JSON.parse(cleanedJSON);
    } catch (parseError) {
      console.error('Evaluation Parse Error:', parseError);
      return {
        success: false,
        error: 'Failed to parse evaluation response',
      };
    }
    
    return {
      success: true,
      correct: evalData.correct || false,
      reasoning: evalData.reasoning || '',
      suggestedNextTopic: evalData.suggestedNextTopic,
      suggestedDifficulty: evalData.suggestedDifficulty,
    };
  } catch (error) {
    console.error('Evaluation Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate an evolution script for continuous composition
 */
export async function generateEvolutionScript(
  request: GenerateEvolutionRequest
): Promise<GenerateEvolutionResponse> {
  console.log('generateEvolutionScript called with request:', request);
  
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('API key not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
    };
  }
  
  try {
    const prompt = buildEvolutionPrompt(request);
    console.log('Generated evolution prompt length:', prompt.length);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API request failed:', response.status, errorData);
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
      };
    }
    
    const data = await response.json();
    console.log('API response received, content length:', data.content?.[0]?.text?.length);
    
    const textContent = data.content?.[0]?.text;
    
    if (!textContent) {
      console.error('No text content in response:', data);
      return {
        success: false,
        error: 'No content received from API',
      };
    }
    
    // Parse the JSON response
    const cleanedJSON = cleanJSONResponse(textContent);
    let scriptData: any;
    
    try {
      scriptData = JSON.parse(cleanedJSON);
      console.log('Parsed evolution script data:', {
        hasScript: !!scriptData.evolutionScript,
        keyframeCount: scriptData.evolutionScript?.keyframes?.length,
        duration: scriptData.evolutionScript?.duration,
        topic: scriptData.evolutionScript?.topic,
      });
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Received text:', textContent);
      return {
        success: false,
        error: 'Failed to parse evolution script JSON from API response',
      };
    }
    
    // Validate and construct EvolutionScript
    if (!validateEvolutionScriptData(scriptData)) {
      console.error('Validation failed for evolution script data:', scriptData);
      return {
        success: false,
        error: 'Invalid evolution script structure from API. Check console for details.',
      };
    }
    
    const script: EvolutionScript = {
      id: generateSegmentId(),
      ...scriptData.evolutionScript,
      startFrame: request.previousScript ? request.previousScript.endFrame : 0,
      generatedAt: new Date().toISOString(),
      continuesFrom: request.previousScript?.id,
    };
    
    return {
      success: true,
      script,
    };
  } catch (error) {
    console.error('Evolution Script Generation Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Build the prompt for generating an evolution script
 */
function buildEvolutionPrompt(request: GenerateEvolutionRequest): string {
  const { topic, previousScript, duration = 1800, userAnswer, wasCorrect } = request;
  
  const isFirst = !previousScript;
  const startFrame = previousScript ? previousScript.endFrame : 0;
  const endFrame = startFrame + duration;
  
  let contextInfo = '';
  if (previousScript && previousScript.keyframes.length > 0) {
    const lastKeyframe = previousScript.keyframes[previousScript.keyframes.length - 1];
    contextInfo = `
PREVIOUS STATE:
- The composition currently has ${lastKeyframe.elements.length} elements on screen
- Last visual state: ${JSON.stringify(lastKeyframe.elements.map(el => ({ id: el.id, type: el.type, x: el.properties.x, y: el.properties.y })))}
- Continue evolving FROM this state (don't restart)
`;
  }
  
  let feedbackInfo = '';
  if (userAnswer && wasCorrect !== undefined) {
    feedbackInfo = `
USER INTERACTION:
- User answered: "${userAnswer}"
- Answer was: ${wasCorrect ? 'CORRECT' : 'INCORRECT'}
- ${wasCorrect ? 'Progress deeper into the concept' : 'Revisit fundamentals with different visuals'}
`;
  }
  
  return `You are creating a CONTINUOUSLY EVOLVING visual composition that teaches "${topic}".

${contextInfo}${feedbackInfo}

YOUR TASK:
Generate an evolution script with ${Math.ceil(duration / 300)} keyframes describing how shapes morph and transform over ${Math.round(duration / 30)} seconds.

CORE PRINCIPLES:
1. **CONTINUITY**: This is ONE composition that evolves, not separate slides
2. **ELEMENT PERSISTENCE**: Elements that appeared early STAY and continue transforming
3. **SMOOTH MORPHING**: Shapes morph into other shapes over time
4. **VISUAL NARRATIVE**: Tell the story through motion and transformation
5. **MINIMAL TEXT**: Only key terms at critical moments

KEYFRAME STRUCTURE:
Each keyframe represents a complete visual state at a specific moment. Include:
- frame: When this state is reached (0 to ${duration})
- elements: ALL elements and their complete properties at this moment
- actions: What transformations caused this state (appear, morph, split, merge, move)
- description: What concept is being taught at this moment

EXAMPLE EVOLUTION (Teaching "Recursion"):
Keyframe 1 (frame 0): One blue circle appears
Keyframe 2 (frame 90): Circle splits into 2 smaller circles below it
  Actions: [{"type": "split", "elementId": "root", "into": ["child1", "child2"]}]
Keyframe 3 (frame 180): Each circle splits again (4 total)
  Actions: [{"type": "split", "elementId": "child1"...}, {"type": "split", "elementId": "child2"...}]
Keyframe 4 (frame 270): Show connections between parent and children
  Actions: [{"type": "appear", "elementId": "line1"...}]
Keyframe 5 (frame 360): PAUSE for question
  pauseForQuestion: {"questionText": "What pattern do you see?", "resumeAfterAnswer": true}

VISUAL ELEMENT TYPES:
- circle: {id, type: "circle", properties: {x, y, radius, fill}}
- rect: {id, type: "rect", properties: {x, y, width, height, fill}}
- triangle: {id, type: "triangle", properties: {x, y, width, fill}}
- line: {id, type: "line", properties: {x1, y1, x2, y2, stroke}}
- text: {id, type: "text", properties: {x, y, text, fontSize, fill}}

ACTION TYPES:
- appear: Element fades in
- disappear: Element fades out
- morph: Shape changes type (circle → rect)
- split: One element becomes multiple
- merge: Multiple elements become one
- move: Element changes position
- recolor: Element changes color

RESPONSE FORMAT (JSON only):
{
  "evolutionScript": {
    "topic": "${topic}",
    "duration": ${duration},
    "endFrame": ${endFrame},
    "keyframes": [
      {
        "frame": 0,
        "elements": [
          {
            "id": "element1",
            "type": "circle",
            "properties": {"x": 640, "y": 360, "radius": 50, "fill": "#3b82f6"}
          }
        ],
        "actions": [{"type": "appear", "elementId": "element1"}],
        "description": "Initial shape appears"
      },
      {
        "frame": 90,
        "elements": [
          {
            "id": "element1",
            "type": "rect",
            "properties": {"x": 640, "y": 360, "width": 100, "height": 100, "fill": "#8b5cf6"}
          }
        ],
        "actions": [
          {"type": "morph", "elementId": "element1", "params": {"toShape": "rect"}},
          {"type": "recolor", "elementId": "element1", "params": {"toColor": "#8b5cf6"}}
        ],
        "description": "Circle morphs into square"
      }
    ],
    "colors": {
      "background": "#0f172a",
      "primary": "#3b82f6",
      "secondary": "#8b5cf6",
      "accent": "#fbbf24",
      "text": "#e2e8f0"
    }
  }
}

IMPORTANT RULES:
- Each keyframe must include ALL visible elements (not just changes)
- Element IDs persist across keyframes
- Space keyframes 60-120 frames apart for smooth transitions
- Include 1 pause point for a question around frame ${Math.floor(duration * 0.6)}
- Coordinate system: 1280x720 (center is 640, 360)
- Keep it flowing - one transformation leads naturally to the next

Generate the evolution script now:`;
}

/**
 * Validate evolution script data structure
 */
function validateEvolutionScriptData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    console.error('Data is not an object');
    return false;
  }
  
  if (!data.evolutionScript || typeof data.evolutionScript !== 'object') {
    console.error('Missing or invalid evolutionScript');
    return false;
  }
  
  const script = data.evolutionScript;
  
  // Check required fields
  if (!script.keyframes || !Array.isArray(script.keyframes) || script.keyframes.length === 0) {
    console.error('Missing or empty keyframes array');
    return false;
  }
  
  if (typeof script.duration !== 'number' || script.duration <= 0) {
    console.error('Invalid duration:', script.duration);
    return false;
  }
  
  // Validate each keyframe
  for (const keyframe of script.keyframes) {
    if (typeof keyframe.frame !== 'number') {
      console.error('Invalid keyframe frame:', keyframe);
      return false;
    }
    
    if (!keyframe.elements || !Array.isArray(keyframe.elements)) {
      console.error('Invalid keyframe elements:', keyframe);
      return false;
    }
    
    // Validate elements in keyframe
    for (const element of keyframe.elements) {
      if (!element.id || !element.type || !element.properties) {
        console.error('Invalid element in keyframe:', element);
        return false;
      }
      
      // Skip coordinate validation for lines
      if (element.type === 'line' || element.type === 'connection') {
        continue;
      }
      
      // Regular elements need x and y (unless it's text which might be positioned differently)
      if (element.type !== 'text' && 
          (typeof element.properties.x !== 'number' || typeof element.properties.y !== 'number')) {
        console.warn('Element missing x or y (but allowing):', element);
      }
    }
  }
  
  return true;
}

/**
 * Build the prompt for generating a video segment
 */
function buildSegmentPrompt(context: LearningContext): string {
  const {
    initialTopic,
    previousTopic,
    wasCorrect,
    historyTopics,
    depth,
    correctnessPattern,
  } = context;
  
  const topicToTeach = previousTopic || initialTopic || 'a programming concept';
  const isFirst = depth === 0;
  
  // Determine difficulty adjustment based on correctness pattern
  let difficultyGuidance = '';
  if (correctnessPattern && correctnessPattern.length > 0) {
    const recentCorrect = correctnessPattern.slice(-3).filter(Boolean).length;
    if (recentCorrect >= 2) {
      difficultyGuidance = 'The user is doing well. Go deeper or more advanced.';
    } else if (recentCorrect === 0) {
      difficultyGuidance = 'The user is struggling. Simplify and use more examples.';
    }
  }
  
  return `You are a motion graphics designer creating visual explanations for educational videos.

CONTEXT:
- Topic: ${topicToTeach}
- Is first segment: ${isFirst}
- Previous topics covered: ${historyTopics.join(', ') || 'none'}
- Last answer was correct: ${wasCorrect ?? 'N/A'}
- Depth in topic: ${depth}
${difficultyGuidance ? `- Guidance: ${difficultyGuidance}` : ''}

YOUR TASK:
Design ONE animation sequence (10-20 seconds) that VISUALLY teaches this concept through motion, shapes, and transformations.

VISUAL TEACHING PRINCIPLES:
- Show relationships through POSITION and CONNECTIONS (not words)
- Use SIZE to show importance or scale
- Use MOTION to show cause and effect, flow, transformation
- Use COLOR to categorize, emphasize, or indicate states
- Use SHAPE TRANSFORMATIONS to show change or evolution
- Use SPATIAL LAYOUT to show structure, hierarchy, relationships
- TEXT should be MINIMAL: only key terms and short labels

THINK LIKE A MOTION DESIGNER:
- How would you explain this concept without words?
- What shapes represent the core ideas?
- How do these shapes move and transform to teach the concept?
- What metaphor best captures the essence?

AVAILABLE VISUAL ELEMENTS:
1. SHAPES (use in "elements" array):
   - circle: Basic unit, entity, node, value
     Properties: x, y, radius, fill
   - rect: Container, block, state, data structure
     Properties: x, y, width, height, fill
   - triangle: Direction, pointer, hierarchy
     Properties: x, y, width (size), fill
   - star: Special item, highlight, achievement
     Properties: x, y, radius, fill
   - polygon: Complex entity, group
     Properties: x, y, radius, fill

2. LINES (use in "elements" array for dividers/separators):
   - line: Simple line, divider
     Properties: x1, y1, x2, y2, stroke, strokeWidth
     Example: {id: "line1", type: "line", properties: {x1: 100, y1: 360, x2: 1180, y2: 360, stroke: "#fff"}}

3. CONNECTIONS (use in "connections" array for relationships):
   - Connects two existing elements by their IDs
   - Properties: from, to, type (line/arrow/curve)
   - Example: {id: "conn1", from: "circle1", to: "circle2", type: "arrow"}

4. TRANSFORMATIONS:
   - Morph: One shape becomes another (circle → rect → triangle)
   - Split: One becomes many (recursion, branching)
   - Merge: Many become one (joining, combining)
   - Growth/Shrink: Change in size/importance
   - Rotation: Change in perspective, cycle
   - Color shift: State change, transition

4. METAPHORS (pre-built patterns):
   - "tree-structure": Hierarchies, recursion
   - "flow-diagram": Sequential processes
   - "comparison": A vs B side-by-side
   - "branching": Conditionals, decisions
   - "cycle": Loops, repetition
   - "transformation": State changes
   - "split": One to many
   - "merge": Many to one

EXAMPLE 1: Teaching "Recursion"
Visual Concept: Tree splitting pattern
- Start: One blue circle at top center (size 50)
- Frame 0-30: Circle enters with scale animation
- Frame 30-60: Circle splits into 2 smaller circles below it
- Frame 60-90: Each of those splits into 2 more
- Frame 90-150: Show the tree structure with connecting lines
- Frame 150-180: Add minimal text label "Recursion" at top
- Minimal colors: Primary blue for circles, accent yellow for connections
- Question: "What pattern do you see in recursion?"

EXAMPLE 2: Teaching "Variables Store Data"
Visual Concept: Container transformation
- Start: Empty rect (container) at left
- Frame 0-30: Rect appears with scale animation
- Frame 30-60: Small circle (data) flies in from right
- Frame 60-90: Circle enters rect, rect glows (highlighting)
- Frame 90-120: Label appears: "x = 5"
- Frame 120-180: Show rect with circle inside can move around (data is stored)
- Colors: Rect in primary blue, data circle in accent yellow
- Question: "What does a variable do?"

RESPONSE FORMAT (JSON only, no markdown):
{
  "animationSequence": {
    "duration": 300,
    "elements": [
      {
        "id": "circle1",
        "type": "circle",
        "properties": {
          "x": 640,
          "y": 200,
          "radius": 50,
          "fill": "#3b82f6"
        },
        "enterFrame": 0,
        "enterAnimation": "scale"
      }
    ],
    "transitions": [
      {
        "elementId": "circle1",
        "property": "y",
        "toValue": 400,
        "startFrame": 60,
        "duration": 40,
        "easing": "easeInOut"
      }
    ],
    "connections": [],
    "textLabels": [
      {
        "id": "label1",
        "text": "Recursion",
        "x": 640,
        "y": 100,
        "fontSize": 48,
        "color": "#ffffff",
        "enterFrame": 150,
        "animation": "kinetic"
      }
    ],
    "topic": "${topicToTeach}",
    "visualConcept": "tree-structure",
    "colors": {
      "background": "#0f172a",
      "primary": "#3b82f6",
      "secondary": "#8b5cf6",
      "accent": "#fbbf24",
      "text": "#e2e8f0"
    }
  },
  "hasQuestion": true,
  "questionText": "What is the main concept we just learned?",
  "difficulty": "medium"
}

COORDINATE SYSTEM:
- Canvas is 1280x720 (center is 640, 360)
- x: 0 (left) to 1280 (right)
- y: 0 (top) to 720 (bottom)

TIMING GUIDELINES:
- Total duration: 300-600 frames (10-20 seconds at 30fps)
- Enter animations: 20-30 frames
- Main animations: 40-60 frames each
- Text labels: Appear late (after visuals establish context)
- Keep it FLOWING - one motion leads to the next

IMPORTANT:
- Focus on VISUAL TEACHING through motion and transformation
- Use text SPARINGLY - only for key terms
- Make it feel like a continuous, flowing animation
- Think: "How would I teach this concept through dance or mime?"

Generate the animation sequence now:`;
}

/**
 * Build the prompt for evaluating an answer
 */
function buildEvaluationPrompt(
  answer: string,
  question: string,
  topic: string
): string {
  return `Evaluate this student answer:

QUESTION: ${question}
TOPIC: ${topic}
STUDENT ANSWER: ${answer}

Determine:
1. Is the answer correct/demonstrates understanding?
2. Brief reasoning for your evaluation
3. What topic should come next (deeper, easier, or related)?
4. Suggested difficulty for next segment

Response format (JSON only):
{
  "correct": true/false,
  "reasoning": "Brief explanation",
  "suggestedNextTopic": "topic name",
  "suggestedDifficulty": "easy/medium/hard"
}`;
}

/**
 * Validate animation sequence data structure
 */
function validateAnimationSequenceData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    console.error('Data is not an object');
    return false;
  }
  
  if (!data.animationSequence || typeof data.animationSequence !== 'object') {
    console.error('Missing or invalid animationSequence');
    return false;
  }
  
  const seq = data.animationSequence;
  
  // Check required fields
  if (!seq.elements || !Array.isArray(seq.elements)) {
    console.error('Missing or invalid elements array');
    return false;
  }
  
  if (!seq.transitions || !Array.isArray(seq.transitions)) {
    console.error('Missing or invalid transitions array');
    return false;
  }
  
  if (typeof seq.duration !== 'number' || seq.duration <= 0) {
    console.error('Invalid duration:', seq.duration);
    return false;
  }
  
  // Validate elements
  for (const element of seq.elements) {
    if (!element.id || !element.type || !element.properties) {
      console.error('Invalid element structure:', element);
      return false;
    }
    
    // Different validation for different element types
    if (element.type === 'connection' || element.type === 'line') {
      // Lines need x1,y1,x2,y2 properties
      if (element.type === 'line') {
        const props = element.properties as any;
        if (typeof props.x1 !== 'number' || typeof props.y1 !== 'number' || 
            typeof props.x2 !== 'number' || typeof props.y2 !== 'number') {
          console.warn('Line element missing coordinate properties, but allowing:', element);
          // Allow it anyway in case it has x,y,width fallback
        }
      }
      continue;
    }
    
    // Regular elements need x and y
    if (typeof element.properties.x !== 'number' || typeof element.properties.y !== 'number') {
      console.error('Invalid element position (missing x or y):', element);
      return false;
    }
  }
  
  // Question validation
  if (data.hasQuestion && !data.questionText) {
    console.error('hasQuestion is true but questionText is missing');
    return false;
  }
  
  return true;
}

/**
 * Legacy validation function for backward compatibility
 * @deprecated
 */
function validateSegmentData(data: any): boolean {
  console.warn('validateSegmentData is deprecated, use validateAnimationSequenceData');
  return validateAnimationSequenceData(data);
}

/**
 * Clean JSON from LLM response
 */
function cleanJSONResponse(response: string): string {
  let cleaned = response.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return cleaned.trim();
}

/**
 * Generate unique segment ID
 */
function generateSegmentId(): string {
  return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default color configuration
 */
function getDefaultColors(): ColorConfig {
  return {
    background: '#0f172a',
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    text: '#e2e8f0',
    accent: '#fbbf24',
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateVideoSegment instead
 */
export async function generateVideoConfig(topic: string): Promise<any> {
  console.warn('generateVideoConfig is deprecated. Use generateVideoSegment instead.');
  
  const context: LearningContext = {
    initialTopic: topic,
    historyTopics: [],
    depth: 0,
  };
  
  const response = await generateVideoSegment(context);
  
  if (response.success && response.segment) {
    // Convert to old format for compatibility
    return {
      success: true,
      data: {
        topic,
        scenes: [
          {
            type: 'dynamic',
            duration: response.segment.duration,
            componentCode: response.segment.componentCode,
            colors: response.segment.colors,
          },
        ],
        fps: 30,
        width: 1280,
        height: 720,
      },
    };
  }
  
  return {
    success: false,
    error: response.error,
  };
}

/**
 * Save configuration to localStorage
 */
export function saveConfigToLocalStorage(config: any): void {
  try {
    localStorage.setItem('lastGeneratedConfig', JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save config to localStorage:', error);
  }
}

/**
 * Load configuration from localStorage
 */
export function loadConfigFromLocalStorage(): any | null {
  try {
    const configStr = localStorage.getItem('lastGeneratedConfig');
    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (error) {
    console.error('Failed to load config from localStorage:', error);
  }
  return null;
}
