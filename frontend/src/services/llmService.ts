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
  VideoSession,
  ReflectionQuestion,
  GenerateReflectionQuestionsResponse,
  ClosingQuestionPayload,
  GenerateClosingQuestionResponse,
} from '../types/VideoConfig';

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
        hasManimCode: !!segmentData.manimCode,
        duration: segmentData.duration,
        hasQuestion: segmentData.hasQuestion,
        topic: segmentData.topic,
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
    if (!validateSegmentData(segmentData)) {
      console.error('Validation failed for segment data:', segmentData);
      return {
        success: false,
        error: 'Invalid video segment structure from API. Check console for details.',
      };
    }
    
    const segment: VideoSegment = {
      id: generateSegmentId(),
      manimCode: segmentData.manimCode,
      duration: segmentData.duration || 90, // Default 90 seconds
      hasQuestion: segmentData.hasQuestion || false,
      questionText: segmentData.questionText,
      topic: segmentData.topic || context.previousTopic || context.initialTopic || 'Unknown',
      difficulty: segmentData.difficulty || 'medium',
      generatedAt: new Date().toISOString(),
      parentSegmentId: context.depth > 0 ? `segment_${context.depth - 1}` : undefined,
      videoUrl: undefined, // Will be set after rendering
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
 * Enhanced version that accepts optional context for leaf questions
 */
export async function evaluateAnswer(
  answer: string,
  question: string,
  topic: string,
  context?: {
    branchPath?: Array<{
      nodeNumber: string;
      topic: string;
      voiceoverScript?: string;
    }>;
  }
): Promise<EvaluateAnswerResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured',
    };
  }
  
  try {
    const prompt = buildEvaluationPrompt(answer, question, topic, context);
    
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
      console.error('Raw response:', textContent);
      console.error('Cleaned JSON:', cleanedJSON);
      
      // Return a more helpful error with snippet
      const snippet = textContent.length > 100 
        ? textContent.substring(0, 100) + '...' 
        : textContent;
      
      return {
        success: false,
        error: `Failed to parse evaluation response. Check console for details. Response started with: "${snippet}"`,
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
  
  const ttsInit = `from tts import ElevenLabsTimedService
        self.set_speech_service(ElevenLabsTimedService(voice_id="pqHfZKP75CvOlQylNhV4", transcription_model=None))`;
  
  return `You are an expert Manim animator creating educational explainer videos similar to 3Blue1Brown. Your task is to generate complete, runnable Manim code that creates an engaging explainer animation with exceptional spatial awareness and visual design.

CONTEXT:
- Topic: ${topicToTeach}
- Is first segment: ${isFirst}
- Previous topics covered: ${historyTopics.join(', ') || 'none'}
- Last answer was correct: ${wasCorrect ?? 'N/A'}
- Depth in topic: ${depth}
${difficultyGuidance ? `- Guidance: ${difficultyGuidance}` : ''}

## Core Principles:
1. **VISUALIZE CONCEPTS, NOT JUST EQUATIONS**: Always create visual representations (shapes, diagrams, transformations) to demonstrate the concept - equations should support the visuals, not replace them
2. **PERFECT SPATIAL ORGANIZATION**: Every element must be carefully positioned with explicit spacing to avoid any overlaps
3. Use smooth transitions and pacing for educational clarity
4. Include explanatory text alongside visual demonstrations with strategic placement
5. Build concepts progressively from simple to complex with visual metaphors
6. Use color coding and visual hierarchy to emphasize key concepts
7. **SHOW, DON'T JUST TELL**: Use geometric objects, transformations, and visual metaphors to explain abstract concepts
8. **IMPORTANT: End with a question to test understanding** (only skip for the very first intro segment)

## CRITICAL TECHNICAL REQUIREMENTS:
- **MANDATORY**: Generate a single complete Scene class that inherits from VoiceoverScene (NEVER use Scene)
- **MANDATORY**: Include manim_voiceover imports and use self.voiceover() blocks
- **MANDATORY**: Initialize TTS service in construct() method EXACTLY like this (NO OTHER PARAMETERS):
  \`\`\`python
  ${ttsInit}
  \`\`\`
- **CRITICAL**: ALWAYS use the EXACT voice_id and transcription_model=None shown above (this is REQUIRED)
- **CRITICAL**: DO NOT use GTTSService, AzureService, or any other TTS service - ONLY the service specified above
- **CRITICAL**: DO NOT enable transcription, subtitles, or captions - we do NOT need them
- Include all necessary imports at the top
- Use Manim Community Edition syntax (v0.18.1)
- Ensure the code can be saved to a .py file and run with: manim -pql filename.py SceneName
- **IMPORTANT**: Target video length: 45-90 seconds MAXIMUM (NEVER exceed 2 minutes)
- Keep animations concise and focused on key concepts only

## Animation Structure (KEEP IT CONCISE - MAX 90 seconds total):
1. **Introduction** (5-8 seconds): Title and brief overview with a visual teaser (show a key shape/diagram that will be explained)
2. **Core Explanation** (30-50 seconds): Main VISUAL demonstration with step-by-step transformation/animation of objects - use shapes, arrows, transformations to show the concept, with equations as supporting elements only
3. **Example** (15-20 seconds): ONE clear, practical example shown through visual objects interacting, transforming, or combining
4. **Summary** (5-10 seconds): Key visual takeaway (show the final result visually, with minimal text)
${isFirst ? '' : '5. **Question** (5-10 seconds): Display a clear question to test understanding of the concept just taught'}

## Visual Guidelines:
- **PRIORITIZE VISUAL DEMONSTRATIONS**: Use geometric shapes, arrows, transformations, and diagrams FIRST - equations are supplementary
- Use consistent color schemes (BLUE for primary objects, YELLOW for highlights, RED for important results, GREEN for correct/good)
- Apply smooth animations with appropriate wait times (typically 0.5-2 seconds between transitions)
- When showing equations, ALWAYS accompany them with visual interpretations (shapes, graphs, diagrams)
- Include descriptive text with Text() for explanations, but keep text concise
- Create visual metaphors and analogies appropriate to the topic (e.g., objects moving, transforming, combining)
- Apply transformations (FadeIn, FadeOut, Transform, ReplacementTransform, Indicate) to show relationships and changes
- Use VGroup() to group related elements together and animate them as units

## CRITICAL SPATIAL PLACEMENT RULES (MUST FOLLOW):
1. **MANDATORY Buff Distances**: ALWAYS use .next_to(), .to_edge(), .to_corner() with explicit buff parameter (minimum 0.5, recommended 0.7-1.0 for text)
2. **NO OVERLAPS ALLOWED**: Before adding any element, consider existing elements' positions - maintain minimum 0.6 units separation
3. **Screen Layout Zones**:
   - TOP (y > 2.5): Titles and section headers only
   - CENTER (-1.5 < y < 2.5): Main visual demonstrations and key objects
   - BOTTOM (y < -1.5): Supporting text, conclusions, or secondary information
   - LEFT (x < -2): Labels, descriptions, or "before" states
   - RIGHT (x > 2): Results, "after" states, or conclusions
4. **Visual Objects Spacing**: Position shapes, diagrams, and text with clear separation (minimum 0.6 units apart, 1.0+ for unrelated groups)
5. **Dynamic Positioning**: When objects move, use VGroup() to move labels with them, or explicitly reposition labels using .animate
6. **Text Placement Strategy**:
   - Use .to_edge(UP, buff=0.7) for titles
   - Use .to_corner(UL, buff=0.5) or .to_corner(UR, buff=0.5) for persistent labels
   - Use .next_to(object, direction, buff=0.7) for object labels - never place text directly on top of objects
7. **Size Awareness**: Larger font sizes need more spacing - use font_size=36 for titles, 28 for main text, 24 for labels
8. **Equation Positioning**: When showing equations, position them to the side (LEFT or RIGHT * 3) while the visual demonstration occupies the center
9. **Before Adding ANY Element**: Mentally check if it will overlap with existing elements - if yes, adjust position or remove old elements first
10. **Consistent Alignment**: All text in a group should align (use VGroup and .arrange(DOWN, buff=0.5) for vertical stacks)

## Common Manim Patterns:
- Creating shapes: Circle(), Square(), Triangle(), Line(), Arrow(), Dot()
- Mathematical text: MathTex(r"\\formula"), Tex()
- Regular text: Text("description", font_size=28)
- Animations: Create(), Write(), FadeIn(), FadeOut(), Transform(), Shift(), Rotate(), Scale()
- Grouping: VGroup(), Group()
- Positioning: .to_edge(), .to_corner(), .next_to(), .shift()
- Colors: BLUE, RED, GREEN, YELLOW, WHITE, PURPLE, ORANGE
- Wait times: self.wait(seconds)

## CRITICAL - DO NOT RENDER CODE AS TEXT:
❌ **NEVER DO THIS**: \`Text("MathTex(r'x^2')")\` - This renders the STRING "MathTex(r'x^2')" literally on screen
✅ **CORRECT**: \`MathTex(r"x^2")\` - This actually renders the mathematical expression x²
❌ **NEVER DO THIS**: Show variable names or code syntax as Text objects
✅ **CORRECT**: Create actual Manim objects (MathTex, Circle, Square, etc.) - don't show their constructor calls as strings

## CRITICAL - Functionality That Does NOT Exist in Manim:
❌ **NEVER USE**: \`self.set_camera_orientation()\` - This method does NOT exist in Scene class
❌ **NEVER USE**: \`self.begin_ambient_camera_rotation()\` - Only exists in ThreeDScene
❌ **NEVER USE**: \`ThreeDAxes()\` unless you inherit from ThreeDScene
❌ **NEVER USE**: \`GTTSService()\` - Use ElevenLabsTimedService() ONLY
❌ **NEVER USE**: \`KokoroService()\` or any other TTS service
✅ **CORRECT**: For standard Scene class, use only 2D elements: Axes(), NumberPlane(), .shift(), .move_to()
✅ **CORRECT**: For 3D, you MUST inherit from ThreeDScene: \`class MyScene(ThreeDScene):\`
✅ **CORRECT**: For audio, ALWAYS use: \`self.set_speech_service(ElevenLabsTimedService(voice_id="pqHfZKP75CvOlQylNhV4", transcription_model=None))\`

REMEMBER: Focus on QUALITY over QUANTITY - one concept explained well in 90 seconds is better than rushing through multiple concepts. Adapt visual techniques to the topic while maintaining the same educational rigor used in mathematical explanations.

## Output Format:
Generate only the Python code. Start with imports, follow with the Scene class. Make it self-contained and runnable. Include comments for complex sections. The animation should be educational, visually engaging, and accurate to the subject matter.

RESPONSE FORMAT (JSON only, no markdown):
{
  "manimCode": "from manim import *\\nimport numpy as np\\n\\nclass ExplainerScene(VoiceoverScene):\\n    def construct(self):\\n        # Your Manim code here\\n        ...",
  "duration": 90,
  "hasQuestion": ${isFirst ? 'false' : 'true'},
  "questionText": "${isFirst ? '' : 'What is the main concept we just learned?'}",
  "topic": "${topicToTeach}",
  "difficulty": "medium"
}

IMPORTANT: The manimCode field should contain the complete Python code as a string with escaped newlines (\\n). Do not include markdown code blocks around the code.

NOTE: Set hasQuestion to true and provide a questionText for most segments. Only set hasQuestion to false for introductory segments where asking a question doesn't make sense yet.

Generate the Manim code now:`;
}

/**
 * Build the prompt for evaluating an answer
 */
function buildEvaluationPrompt(
  answer: string,
  question: string,
  topic: string,
  context?: {
    branchPath?: Array<{
      nodeNumber: string;
      topic: string;
      voiceoverScript?: string;
    }>;
  }
): string {
  let contextSection = '';
  if (context?.branchPath && context.branchPath.length > 0) {
    const pathContext = context.branchPath
      .map((node) => `- Node ${node.nodeNumber}: ${node.topic}`)
      .join('\n');
    contextSection = `\nLEARNING PATH CONTEXT:\n${pathContext}\n`;
  }

  return `Evaluate this student answer:

QUESTION: ${question}
TOPIC: ${topic}
STUDENT ANSWER: ${answer}${contextSection}

Determine:
1. Is the answer correct/demonstrates understanding?
2. Brief reasoning for your evaluation
3. What topic should come next (deeper, easier, or related)?
4. Suggested difficulty for next segment

CRITICAL: You MUST respond with ONLY valid JSON. No other text before or after. No markdown formatting. Just the JSON object.

RESPONSE FORMAT:
{
  "correct": true,
  "reasoning": "Brief explanation",
  "suggestedNextTopic": "topic name",
  "suggestedDifficulty": "easy"
}

or

{
  "correct": false,
  "reasoning": "Brief explanation",
  "suggestedNextTopic": "topic name",
  "suggestedDifficulty": "medium"
}

Return ONLY the JSON object now:`;
}

/**
 * Validate segment data structure
 */
function validateSegmentData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.manimCode || typeof data.manimCode !== 'string') return false;
  if (data.hasQuestion && !data.questionText) return false;
  
  // Check for basic Manim code structure
  const code = data.manimCode;
  
  // Check for required Manim imports
  if (!code.includes('from manim import') && !code.includes('import manim')) {
    console.error('Manim code missing required imports');
    return false;
  }
  
  // Check for Scene class definition
  if (!code.includes('class ') || (!code.includes('Scene') && !code.includes('VoiceoverScene'))) {
    console.error('Manim code missing Scene class definition');
    return false;
  }
  
  // Check for construct method
  if (!code.includes('def construct')) {
    console.error('Manim code missing construct method');
    return false;
  }
  
  return true;
}

/**
 * Clean JSON from LLM response with aggressive extraction
 */
function cleanJSONResponse(response: string): string {
  let cleaned = response.trim();
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/, '');
  cleaned = cleaned.replace(/\s*```$/g, '');
  
  cleaned = cleaned.trim();
  
  // Try to extract JSON object - find first { to last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // Remove any trailing text after the JSON object
  cleaned = cleaned.replace(/\}\s*[^}]*$/g, '}');
  
  return cleaned.trim();
}

/**
 * Generate unique segment ID
 */
function generateSegmentId(): string {
  return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
              type: 'manim',
              duration: response.segment.duration,
              manimCode: response.segment.manimCode,
              videoUrl: response.segment.videoUrl,
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

/**
 * Generate reflection questions based on the completed lesson
 * Calls Modal backend which uses ANTHROPIC_API_KEY
 */
export async function generateReflectionQuestions(
  session: VideoSession
): Promise<GenerateReflectionQuestionsResponse> {
  const modalEndpoint =
    "https://evan-zhangmingjun--main-video-generator-dev-generate-reflection-questions.modal.run";
  
  try {
    // Build session summary to send to backend
    const sessionSummary = {
      topic: session.context.initialTopic || 'Unknown topic',
      segments: session.segments.map(seg => ({
        topic: seg.topic,
        hasQuestion: seg.hasQuestion,
        questionText: seg.questionText,
      })),
      depth: session.context.depth,
      historyTopics: session.context.historyTopics,
    };
    
    const response = await fetch(modalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionSummary),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Backend request failed: ${response.status} ${response.statusText}. ${errorText}`,
      };
    }
    
    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Backend returned failure',
      };
    }
    
    // Validate and extract questions
    const rawQuestions: any[] = Array.isArray(data?.questions)
      ? data.questions
      : [];

    const questions: ReflectionQuestion[] = rawQuestions
      .map((item, index) => {
        const promptText =
          typeof item?.prompt === 'string' ? item.prompt.trim() : '';
        if (!promptText) {
          return null;
        }
        const question: ReflectionQuestion = {
          id:
            typeof item?.id === 'string' && item.id.trim()
              ? item.id.trim()
              : `reflection-${index + 1}`,
          prompt: promptText,
        };
        if (typeof item?.placeholder === 'string' && item.placeholder.trim()) {
          question.placeholder = item.placeholder.trim();
        }
        return question;
      })
      .filter((item): item is ReflectionQuestion => item !== null);

    if (!questions.length) {
      return {
        success: false,
        error: 'No reflection questions returned from backend',
      };
    }
    
    return {
      success: true,
      questions,
    };
  } catch (error) {
    console.error('Reflection questions generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate a contextual question at leaf nodes based on the branch path
 */
export async function generateLeafQuestion(payload: {
  topic: string;
  branchPath: Array<{
    nodeNumber: string;
    topic: string;
    voiceoverScript?: string;
  }>;
  summary?: string;
}): Promise<{
  success: boolean;
  question?: string;
  error?: string;
}> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('VITE_ANTHROPIC_API_KEY not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
    };
  }

  try {
    // Build context from branch path
    const pathContext = payload.branchPath
      .map((node) => {
        const script = node.voiceoverScript ? `\n  Script: ${node.voiceoverScript}` : '';
        return `- Node ${node.nodeNumber}: ${node.topic}${script}`;
      })
      .join('\n');

    const prompt = `You are an expert instructional designer creating a knowledge check question for a learner who has just completed a video learning path.

LEARNING PATH COMPLETED:
${pathContext}

${payload.summary ? `SUMMARY:\n${payload.summary}\n` : ''}

Your task is to generate ONE concrete, content-focused question that:
1. Tests a specific concept, definition, or fact from the lessons covered (e.g., "What property must all nodes in a binary search tree satisfy?")
2. Has a clear, factual answer based on the material covered in the path
3. Avoids broad reflection - focus on concrete knowledge from the videos
4. Can be answered in 1-3 sentences
5. Is direct and clear (one sentence, max 20 words)

GOOD EXAMPLES:
- "What is the time complexity for search in a binary search tree?"
- "What property must a binary search tree maintain?"
- "How does insertion work in a balanced BST?"

BAD EXAMPLES (too reflective/broad):
- "How might binary search trees optimize data retrieval in applications you use daily?"
- "What resonated with you about this lesson?"

RESPONSE FORMAT (JSON only, no markdown):
{
  "question": "Your specific, testable question here?"
}

Generate the leaf question now:`;

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
        max_tokens: 512,
        temperature: 0.6,
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
      console.error('Claude API request failed:', response.status, errorData);
      return {
        success: false,
        error: `Claude API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
      };
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      console.error('No text content in response:', data);
      return {
        success: false,
        error: 'No content received from Claude API',
      };
    }

    // Parse the JSON response
    const cleanedJSON = cleanJSONResponse(textContent);
    let parsedData: any;

    try {
      parsedData = JSON.parse(cleanedJSON);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Received text:', textContent);
      return {
        success: false,
        error: 'Failed to parse leaf question JSON from API response',
      };
    }

    const question = parsedData.question;

    if (typeof question === 'string' && question.trim()) {
      return {
        success: true,
        question: question.trim(),
      };
    }

    return {
      success: false,
      error: 'No question found in API response',
    };
  } catch (error) {
    console.error('Leaf question generation error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown error occurred during leaf question generation',
    };
  }
}

/**
 * Generate a remediation video for incorrect answers
 * Uses Modal backend for video generation
 */
export async function generateRemediationVideo(
  question: string,
  userAnswer: string,
  correctExplanation: string,
  branchContext: string,
  onProgress?: (progress: any) => void
): Promise<{
  success: boolean;
  videoUrl?: string;
  segment?: VideoSegment;
  error?: string;
}> {
  try {
    // Import the video render service dynamically to avoid circular dependencies
    const { generateVideoScenes } = await import('./videoRenderService');
    
    // Build a topic that includes the remediation context
    const remediationTopic = `Explanation: ${question}

Your answer: "${userAnswer}"

Let me explain: ${correctExplanation}

Context: ${branchContext}`;

    console.log('Generating remediation video with topic:', remediationTopic);
    
    const result = await generateVideoScenes(remediationTopic, onProgress);
    
    if (result.success && result.sections && result.sections.length > 0) {
      const videoUrl = result.sections[0]; // Use first section
      const detail = result.sectionDetails?.[0];
      
      const segment: VideoSegment = {
        id: `remediation_${Date.now()}`,
        manimCode: '',
        duration: 90,
        hasQuestion: false,
        topic: `Remediation: ${question}`,
        difficulty: 'medium',
        generatedAt: new Date().toISOString(),
        videoUrl: videoUrl,
        thumbnailUrl: detail?.thumbnail_url,
        title: `Understanding: ${question}`,
        renderingStatus: 'completed',
        voiceoverScript: detail?.voiceover_script,
        isQuestionNode: false,
      };
      
      return {
        success: true,
        videoUrl,
        segment,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to generate remediation video',
      };
    }
  } catch (error) {
    console.error('Remediation video generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred during remediation video generation',
    };
  }
}

/**
 * Generate a single closing question based on narration and learner interaction.
 * Calls Claude API directly from the frontend.
 */
export async function generateClosingQuestion(
  payload: ClosingQuestionPayload
): Promise<GenerateClosingQuestionResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('VITE_ANTHROPIC_API_KEY not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
    };
  }

  try {
    // Build the prompt
    const prompt = buildClosingQuestionPrompt(payload);

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
        max_tokens: 512,
        temperature: 0.6,
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
      console.error('Claude API request failed:', response.status, errorData);
      return {
        success: false,
        error: `Claude API request failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`,
      };
    }

    const data = await response.json();
    const textContent = data.content?.[0]?.text;

    if (!textContent) {
      console.error('No text content in response:', data);
      return {
        success: false,
        error: 'No content received from Claude API',
      };
    }

    // Parse the JSON response
    const cleanedJSON = cleanJSONResponse(textContent);
    let parsedData: any;

    try {
      parsedData = JSON.parse(cleanedJSON);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Received text:', textContent);
      return {
        success: false,
        error: 'Failed to parse closing question JSON from API response',
      };
    }

    const question = parsedData.closing_question || parsedData.question;

    if (typeof question === 'string' && question.trim()) {
      return {
        success: true,
        question: question.trim(),
      };
    }

    return {
      success: false,
      error: 'No closing question found in API response',
    };
  } catch (error) {
    console.error('Closing question generation error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown error occurred during closing question generation',
    };
  }
}

/**
 * Build the prompt for generating a closing question
 */
function buildClosingQuestionPrompt(payload: ClosingQuestionPayload): string {
  const { topic, voiceoverSections, userResponses, summary } = payload;

  // Build narration summary
  const narrationLines = voiceoverSections
    .map((entry) => {
      const truncated = entry.script.trim();
      if (truncated) {
        return `Section ${entry.section}: ${truncated}`;
      }
      return null;
    })
    .filter((line): line is string => line !== null);

  const narrationSummary = narrationLines.length > 0 ? narrationLines.join('\n') : 'N/A';

  // Build learner responses summary
  const learnerLines = userResponses
    .map((entry) => {
      if (entry.answer) {
        return `${entry.prompt}: ${entry.answer}`;
      }
      return null;
    })
    .filter((line): line is string => line !== null);

  const learnerSummary =
    learnerLines.length > 0 ? learnerLines.join('\n') : 'No learner responses recorded.';

  return `You are an expert instructional designer crafting a final knowledge check question for a short educational video.

LESSON TOPIC:
${topic}

NARRATION SCRIPT (what was explained):
${narrationSummary}

LEARNER RESPONSES (how they engaged):
${learnerSummary}

${summary ? `SESSION SUMMARY:\n${summary}\n` : ''}

Your task is to generate ONE concrete, content-focused question that:
1. Tests a specific concept, definition, or fact from the lesson (e.g., "What is the time complexity for search in a BST?")
2. Has a clear, factual answer based on the material covered
3. Avoids broad reflection - focus on concrete knowledge
4. Can be answered in 1-3 sentences
5. Is direct and clear (one sentence, max 15 words)

GOOD EXAMPLES:
- "What is the time complexity for search in a binary search tree?"
- "What property must a binary search tree maintain?"
- "How does insertion work in a balanced BST?"

BAD EXAMPLES (too reflective/broad):
- "How might binary search trees optimize data retrieval in applications you use daily?"
- "What resonated with you about this lesson?"

RESPONSE FORMAT (JSON only, no markdown):
{
  "closing_question": "Your specific, testable question here?"
}

Generate the closing question now:`;
}
