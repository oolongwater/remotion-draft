/**
 * questionAnalysisService.ts
 * 
 * Service for analyzing user questions and breaking them into learning phases.
 * Uses Claude Haiku 4.5 for fast, cost-effective question analysis.
 */

/// <reference types="vite/client" />

import { LearningContext } from '../types/VideoConfig';

/**
 * Learning phase for answering a question
 */
export interface LearningPhase {
  sub_topic: string;      // Concise sub-topic name (e.g., "Heat Conduction")
  description: string;    // Brief description of what this phase covers
}

/**
 * Response from question analysis
 */
export interface QuestionAnalysisResponse {
  success: boolean;
  video_count?: number;
  phases?: LearningPhase[];
  error?: string;
}

/**
 * Analyze a user's question to determine how many videos are needed
 * and break the answer into learning phases
 */
export async function analyzeQuestion(
  question: string,
  currentTopic: string,
  currentContext?: LearningContext
): Promise<QuestionAnalysisResponse> {
  console.log('analyzeQuestion called:', { question, currentTopic });
  
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('API key not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
    };
  }
  
  try {
    const prompt = buildQuestionAnalysisPrompt(question, currentTopic, currentContext);
    console.log('Analyzing question with Claude Haiku 4.5...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5 - fast and efficient
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
      const errorData = await response.json().catch(() => ({}));
      console.error('API request failed:', response.status, errorData);
      return {
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    console.log('Haiku response received');
    
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
    let analysisData: any;
    
    try {
      analysisData = JSON.parse(cleanedJSON);
      console.log('Parsed analysis data:', analysisData);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Received text:', textContent);
      return {
        success: false,
        error: 'Failed to parse question analysis from API response',
      };
    }
    
    // Validate the response structure
    if (!validateAnalysisData(analysisData)) {
      console.error('Invalid analysis data structure:', analysisData);
      return {
        success: false,
        error: 'Invalid question analysis structure from API',
      };
    }
    
    return {
      success: true,
      video_count: analysisData.video_count,
      phases: analysisData.phases,
    };
  } catch (error) {
    console.error('Question Analysis Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Build the prompt for analyzing a question
 */
function buildQuestionAnalysisPrompt(
  question: string,
  currentTopic: string,
  currentContext?: LearningContext
): string {
  const contextInfo = currentContext 
    ? `\n\nLearning Context:
- Topics covered so far: ${currentContext.historyTopics.join(', ') || 'none'}
- Current depth: ${currentContext.depth}
- User's learning style: ${currentContext.preferredStyle || 'mixed'}`
    : '';
  
  return `You are an expert educational content planner. A student is learning about "${currentTopic}" and has asked a question. Your task is to analyze their question and determine how to best answer it through educational videos.${contextInfo}

STUDENT'S QUESTION: "${question}"

Analyze this question and determine:

1. **Complexity Assessment**: How complex is this question?
   - Simple clarification (1 video) - e.g., "What does X mean?", "Why is Y true?"
   - Detailed explanation (2-3 videos) - e.g., "How does X work?", "Explain the process of Y"
   - Deep dive / Multiple concepts (4-5 videos) - e.g., "I'm really confused about X", "Explain everything about Y in detail"

2. **Learning Phases**: Break down the answer into logical learning phases
   - Each phase should focus on ONE clear sub-topic
   - Phases should build on each other progressively
   - Use concise, descriptive sub-topic names (2-5 words)

3. **Video Count**: Decide how many videos are needed (minimum 1, maximum 5)
   - Consider the question's complexity
   - Look for keywords suggesting confusion ("confused", "don't understand", "explain more")
   - Consider if multiple concepts need explanation

IMPORTANT GUIDELINES:
- If the question is simple and direct → 1-2 videos
- If the question shows moderate confusion or asks "how" → 2-3 videos  
- If the question shows deep confusion or asks for comprehensive explanation → 3-5 videos
- Each sub_topic should be a SHORT, clear title (not a full sentence)
- Each description should briefly explain what that phase covers

Return your analysis in this EXACT JSON format:
{
  "video_count": 2,
  "phases": [
    {
      "sub_topic": "Short Title Here",
      "description": "Brief explanation of what this video will cover"
    },
    {
      "sub_topic": "Another Short Title",
      "description": "Brief explanation of the second concept"
    }
  ]
}

Return ONLY the JSON, no additional text or markdown.`;
}

/**
 * Validate the analysis data structure
 */
function validateAnalysisData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.video_count !== 'number') return false;
  if (data.video_count < 1 || data.video_count > 5) return false;
  if (!Array.isArray(data.phases)) return false;
  if (data.phases.length !== data.video_count) return false;
  
  // Check each phase
  for (const phase of data.phases) {
    if (!phase.sub_topic || typeof phase.sub_topic !== 'string') return false;
    if (!phase.description || typeof phase.description !== 'string') return false;
  }
  
  return true;
}

/**
 * Clean JSON from LLM response (remove markdown formatting)
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

