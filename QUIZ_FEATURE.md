# Quiz Question Feature

## Overview
This feature adds an interactive quiz question at leaf nodes (end of learning branches) that tests user understanding and provides personalized feedback.

## How It Works

### 1. **Quiz Trigger**
- When a video ends at a **leaf node** (no child nodes), a quiz question is automatically generated
- The quiz uses Claude API via `VITE_ANTHROPIC_API_KEY` from `.env`
- Questions are contextual, based on the video topic and voiceover script

### 2. **Question Generation**
- Service: `src/services/quizService.ts`
- Function: `generateQuizQuestion(topic, voiceoverScript)`
- Generates a specific, testable question relevant to the lesson content
- Returns both the question and an expected correct answer outline

### 3. **User Interaction**
- Component: `src/components/QuizQuestionOverlay.tsx`
- User sees the quiz question in an overlay
- User types their answer in a text area
- User submits answer for evaluation

### 4. **Answer Evaluation**
- Function: `evaluateQuizAnswer(userAnswer, question, topic, correctAnswer)`
- Claude API evaluates if the answer demonstrates understanding
- Lenient evaluation - partial understanding counts as correct

### 5. **Two Outcomes**

#### ✅ Correct Answer
- Shows congratulations overlay with celebration UI
- User can continue learning or start a new topic

#### ❌ Incorrect Answer
- Shows that answer is incorrect
- **Automatically generates explanation video**:
  - Uses Modal backend to generate a new video
  - Video explains the correct answer
  - Video is added as a child node in the tree
  - User is automatically navigated to explanation video
- Tree structure updates to include explanation branch

## Implementation Files

### New Files
1. **`src/components/QuizQuestionOverlay.tsx`**
   - Quiz UI overlay component
   - Handles question display, answer input, and result states

2. **`src/services/quizService.ts`**
   - Quiz question generation via Claude API
   - Answer evaluation via Claude API
   - Uses `VITE_ANTHROPIC_API_KEY`

### Modified Files
1. **`src/controllers/VideoController.tsx`**
   - Added quiz state management
   - Added `triggerQuizQuestion()` function
   - Added `handleQuizAnswer()` function with video generation
   - Added `closeQuiz()` function
   - Exports quiz state and functions in `VideoControllerState`

2. **`src/App.tsx`**
   - Imports `QuizQuestionOverlay` component
   - Renders quiz overlay when `showQuiz` is true
   - Triggers quiz on video end at leaf nodes
   - Passes quiz handlers to overlay

## Tree Structure Updates

When user answers incorrectly:
```
Current Leaf Node (where quiz appears)
    └── Explanation Video Node (auto-generated)
        - Topic: "Explanation: [original topic]"
        - Title: "Correct Answer: [original topic]"
        - Branch Label: "Explanation"
```

## Environment Setup

Ensure `.env` file contains:
```
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## User Flow

1. User watches video until the end
2. If leaf node → Quiz question appears automatically
3. User answers the question
4. **Correct**: Congratulations message → Continue or restart
5. **Incorrect**: Generating explanation video → Auto-navigate to explanation → Can watch and learn

## Benefits

- ✅ Tests understanding at natural stopping points
- ✅ Provides immediate feedback
- ✅ Generates personalized explanation videos for wrong answers
- ✅ Creates branching learning paths based on performance
- ✅ Uses AI to ensure questions are relevant and fair
- ✅ Seamless integration with existing tree structure

## Technical Details

### Quiz State Management
```typescript
interface VideoControllerState {
  showQuiz: boolean;
  quizQuestion: string | null;
  quizResult: 'correct' | 'incorrect' | null;
  isGeneratingQuiz: boolean;
  // ... other state
}
```

### LLM Integration
- Model: `claude-sonnet-4-5-20250929`
- Direct API calls from frontend
- Uses `anthropic-dangerous-direct-browser-access: true` header
- Temperature: 0.7 for question generation, 0.3 for evaluation

### Video Generation on Wrong Answer
- Uses existing `generateVideoScenes()` service
- Topic includes explanation context from Claude
- First section video is used as explanation
- Progress indicators shown during generation
- Explanation node added to tree with "Explanation" branch label

