# Infinite Learning Video Architecture

## Overview

The application has been completely refactored to support an **infinite, flowing educational video experience**. Instead of rigid scene templates, the system now generates fully dynamic, kinetic video segments that adapt to user understanding in real-time.

## Key Concepts

### 1. Video Segments (Not Scenes)
- Each segment is a **custom-generated React/Remotion component**
- LLM creates unique code for each segment based on context
- No templates - every segment is purpose-built for its content
- Duration: 10-20 seconds typically
- Can optionally include questions (not required)

### 2. Learning Context
The system tracks:
- **Topic history**: What the user has learned
- **Performance pattern**: Recent answers (last 5)
- **Depth**: How deep into a topic they've gone
- **Difficulty adjustment**: Automatic based on performance

### 3. Infinite Flow
- User enters topic → generates first segment
- Segment plays → user watches
- If no question → auto-generates next segment
- If question → user answers → evaluates → generates next
- Loop continues infinitely, adapting to user

## Architecture Components

### Core Controllers

#### VideoController (`/src/controllers/VideoController.tsx`)
Central state manager for the learning journey:
- Maintains `VideoSession` with all segments
- Tracks `LearningContext` for intelligent generation
- Handles answer evaluation and next segment generation
- Provides navigation through segment history

**Key Methods:**
- `handleAnswer(answer)`: Evaluates answer, generates next segment
- `requestNextSegment()`: Auto-advance without question
- `requestNewTopic(topic)`: Pivot to new learning path
- `goToSegment(index)`: Navigate history

### Services

#### LLM Service (`/src/services/llmService.ts`)
Handles all AI interactions:

**`generateVideoSegment(context)`**
- Takes: `LearningContext` (history, performance, depth)
- Returns: `VideoSegment` with custom component code
- LLM generates kinetic, video-essay style React/Remotion code

**`evaluateAnswer(answer, question, topic)`**
- Takes: User's answer, the question, current topic
- Returns: Correctness, reasoning, suggested next topic/difficulty
- LLM intelligently evaluates understanding

### Type System (`/src/types/VideoConfig.ts`)

```typescript
interface VideoSegment {
  id: string;
  componentCode: string;      // JSX/TSX to render
  duration: number;            // Frames
  hasQuestion: boolean;
  questionText?: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  colors: ColorConfig;
}

interface LearningContext {
  initialTopic?: string;
  previousTopic?: string;
  userAnswer?: string;
  wasCorrect?: boolean;
  historyTopics: string[];
  depth: number;
  correctnessPattern?: boolean[];
}

interface VideoSession {
  segments: VideoSegment[];
  currentIndex: number;
  context: LearningContext;
  fps: number;
  width: number;
  height: number;
}
```

### Rendering

#### DynamicSceneRenderer (`/src/remotion/DynamicSceneRenderer.tsx`)
- Safely executes LLM-generated component code
- Provides whitelisted imports (all kinetic components, Remotion hooks)
- Security validation (no dangerous patterns)
- Error boundaries with helpful messages

### UI Components

#### App.tsx
Simplified to 3 states:
1. **Landing**: User enters topic
2. **Learning**: Continuous video flow with VideoController
3. **Error**: Error handling

#### InputOverlay
Contextual interaction based on segment state:
- **Has question**: Shows input field, submit button
- **No question**: Shows "Continue Learning" button
- **Always**: "New Topic" and "Start Over" options
- **Loading**: Shows spinner during generation/evaluation

## Kinetic Animation Components

New `/src/remotion/components/kinetic/` directory with video-essay style components:

### KineticText
Advanced text animations:
- Fly-in from any direction
- Stagger patterns (sequential, from-center, random)
- Easing modes (bounce, elastic, anticipation)
- Word or character-by-character

### RevealBlock
Dramatic content reveals:
- Wipe transitions (left, right, up, down)
- Scale and fade effects
- Curtain opens

### Timeline
Orchestrate multiple elements:
- Define start/end frames for each element
- Different animations per element
- Sequential or overlapping timing

### Transition
Smooth content changes:
- Crossfade between content
- Wipe transitions
- Zoom and slide effects

### FloatingElements
Ambient background elements:
- Drift and rotation
- Physics-based motion
- Adds visual depth

### SplitScreen
Dynamic layouts:
- Vertical or horizontal splits
- Animated dividers
- Adjustable split ratios

## LLM Prompt Strategy

### Video Segment Generation
The prompt instructs the LLM to:
1. Create kinetic, video-essay style animations
2. Use available components (KineticText, RevealBlock, etc.)
3. Make it feel like a real educational video
4. Optionally include a question (not required)
5. Adapt difficulty based on context

**Context Provided:**
- Current topic
- Is this the first segment?
- Previous topics covered
- Last answer correctness
- Current depth in topic
- Difficulty guidance based on performance

### Answer Evaluation
The prompt asks LLM to:
1. Determine correctness/understanding
2. Provide reasoning
3. Suggest next topic (deeper/easier/related)
4. Suggest difficulty adjustment

## User Experience Flow

### Example Journey: "React Hooks"

1. **User Input**: "React hooks"
2. **Video 1 Generated**: 
   - Kinetic intro to useState
   - Flying text, code examples
   - No question → auto-advances after 10s

3. **Video 2 Generated**:
   - Deeper dive into useState with Timeline
   - Shows state updates animating
   - Question: "What does useState return?"

4. **User Answers**: "An array with state and setter"
5. **Evaluation**: Correct!

6. **Video 3 Generated**:
   - Goes deeper: useEffect
   - Split screen: code + diagram
   - Question about useEffect

7. **User Struggles**: Wrong answer
8. **Evaluation**: Incorrect

9. **Video 4 Generated**:
   - **Difficulty drops**: Simpler useEffect explanation
   - More visual metaphors
   - Question again

10. **User Gets It**: Correct answer
11. **Video 5 Generated**: Custom hooks...

And on and on, infinitely adapting!

## Key Improvements Over Old System

### Before
- ❌ Rigid 5-scene structure (intro → concept → retry → clarification → advanced)
- ❌ Template-based scenes with static content
- ❌ Card-based layouts only
- ❌ Always requires Q&A
- ❌ No context awareness
- ❌ Fixed flow

### After
- ✅ Infinite, adaptive segments
- ✅ Fully custom-generated components
- ✅ Kinetic, video-essay style animations
- ✅ Optional questions (videos can flow continuously)
- ✅ Full learning context tracking
- ✅ Branching based on understanding

## Development Notes

### Adding New Kinetic Components
1. Create component in `/src/remotion/components/kinetic/`
2. Export from `kinetic/index.ts`
3. It's automatically available in LLM context

### Modifying LLM Behavior
Edit prompts in `/src/services/llmService.ts`:
- `buildSegmentPrompt()`: Controls video generation
- `buildEvaluationPrompt()`: Controls answer evaluation

### Adjusting Difficulty Logic
Modify in `VideoController.tsx`:
- Update `correctnessPattern` tracking
- Change difficulty guidance in segment generation

## Security

### Code Execution Safety
The `DynamicSceneRenderer` validates all LLM-generated code:
- Blocks: eval, Function(), import, require
- Blocks: process, global, window.location
- Blocks: localStorage, fetch, XMLHttpRequest
- Provides only whitelisted imports

### Sandboxed Context
Generated code only has access to:
- React and Remotion hooks
- Building block components
- Kinetic animation components
- Safe console methods

## Future Enhancements

Potential additions:
- Voice narration for segments
- User profiles to remember learning style
- Branching paths (choose your own adventure)
- Segment bookmarking
- Export favorite segments
- Social sharing
- Multi-user collaborative learning
- Real-time voice Q&A

---

**The system is now truly infinite and adaptive!** 🚀

