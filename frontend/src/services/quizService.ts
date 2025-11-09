/**
 * quizService.ts
 * 
 * Service for generating and evaluating quiz questions using Claude API.
 */

/// <reference types="vite/client" />

/**
 * Response from generating a quiz question
 */
export interface GenerateQuizQuestionResponse {
  success: boolean;
  question?: string;
  correctAnswer?: string; // For internal evaluation (not shown to user)
  error?: string;
}

/**
 * Response from evaluating a quiz answer
 */
export interface EvaluateQuizAnswerResponse {
  success: boolean;
  correct?: boolean;
  explanation?: string;
  error?: string;
}

/**
 * Generate a quiz question based on the topic and content covered
 */
export async function generateQuizQuestion(
  topic: string,
  voiceoverScript?: string
): Promise<GenerateQuizQuestionResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('VITE_ANTHROPIC_API_KEY not configured');
    return {
      success: false,
      error: 'API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.',
    };
  }
  
  try {
    const prompt = buildQuizQuestionPrompt(topic, voiceoverScript);
    
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
        temperature: 0.7,
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
        error: `Claude API request failed: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    const textContent = data.content?.[0]?.text;
    
    if (!textContent) {
      return {
        success: false,
        error: 'No content received from Claude API',
      };
    }
    
    // Parse JSON response
    const cleanedJSON = cleanJSONResponse(textContent);
    let parsedData: any;
    
    try {
      parsedData = JSON.parse(cleanedJSON);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return {
        success: false,
        error: 'Failed to parse quiz question from API response',
      };
    }
    
    if (!parsedData.question || typeof parsedData.question !== 'string') {
      return {
        success: false,
        error: 'Invalid quiz question format from API',
      };
    }
    
    return {
      success: true,
      question: parsedData.question.trim(),
      correctAnswer: parsedData.correct_answer?.trim(),
    };
  } catch (error) {
    console.error('Quiz question generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Evaluate a user's quiz answer
 */
export async function evaluateQuizAnswer(
  userAnswer: string,
  question: string,
  topic: string,
  correctAnswer?: string
): Promise<EvaluateQuizAnswerResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'API key not configured',
    };
  }
  
  try {
    const prompt = buildQuizEvaluationPrompt(userAnswer, question, topic, correctAnswer);
    
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
        temperature: 0.3,
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
    
    // Parse JSON response
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
      explanation: evalData.explanation || '',
    };
  } catch (error) {
    console.error('Quiz evaluation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Build the prompt for generating a quiz question
 */
function buildQuizQuestionPrompt(topic: string, voiceoverScript?: string): string {
  return `You are an expert educational assessment designer. Generate a single, clear quiz question that tests understanding of this topic.

TOPIC:
${topic}

${voiceoverScript ? `LESSON CONTENT:\n${voiceoverScript}\n` : ''}

Your task is to create ONE specific, factual question that:
1. Tests understanding of a key concept from the lesson
2. Has a clear, verifiable answer
3. Is appropriate for someone who just learned this material
4. Can be answered in 1-3 sentences
5. Is direct and concise (max 15 words for the question)

GOOD EXAMPLES:
- "What is the time complexity of binary search?"
- "What are the three main types of machine learning?"
- "How does Newton's third law apply to collisions?"

BAD EXAMPLES (too vague/broad):
- "What did you learn?"
- "Can you explain the topic?"

RESPONSE FORMAT (JSON only, no markdown):
{
  "question": "Your specific, testable question here?",
  "correct_answer": "Brief outline of the correct answer (1-2 sentences)"
}

Generate the quiz question now:`;
}

/**
 * Build the prompt for evaluating a quiz answer
 */
function buildQuizEvaluationPrompt(
  userAnswer: string,
  question: string,
  topic: string,
  correctAnswer?: string
): string {
  return `You are an expert educational evaluator. Assess whether the student's answer demonstrates understanding of the concept.

TOPIC: ${topic}
QUESTION: ${question}
${correctAnswer ? `EXPECTED ANSWER: ${correctAnswer}\n` : ''}
STUDENT ANSWER: ${userAnswer}

Evaluate:
1. Does the answer demonstrate correct understanding? (Be lenient - if they have the right idea, mark it correct)
2. Provide a brief explanation of why the answer is correct or incorrect
3. If incorrect, what was the correct concept they should understand?

Be generous in your evaluation - partial understanding or correct core concepts should be marked as correct.

RESPONSE FORMAT (JSON only, no markdown):
{
  "correct": true/false,
  "explanation": "Brief explanation of the evaluation and the correct answer if wrong"
}

Evaluate the answer now:`;
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

