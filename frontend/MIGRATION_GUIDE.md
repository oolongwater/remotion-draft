# Migration Guide: Fixed Scenes → Infinite Learning Flow

## What Changed?

The app has been completely transformed from a rigid scene-based system to an infinite, adaptive learning experience.

## Breaking Changes

### Removed Components
The following files have been **deleted**:
- `src/SceneController.tsx` → Replaced by `VideoController`
- `src/remotion/scenes/IntroScene.tsx` → Dynamic generation
- `src/remotion/scenes/ConceptScene.tsx` → Dynamic generation
- `src/remotion/scenes/RetryScene.tsx` → Dynamic generation
- `src/remotion/scenes/ClarificationScene.tsx` → Dynamic generation
- `src/remotion/scenes/AdvancedScene.tsx` → Dynamic generation
- `src/utils/interpretAnswer.ts` → LLM-based evaluation
- `src/types/SceneConfig.ts` → Replaced by `VideoConfig.ts`

### Replaced Types
```typescript
// OLD - Don't use these anymore
interface VideoConfig {
  topic: string;
  scenes: SceneConfig[];
  answerValidation: AnswerValidation;
}

type SceneType = "intro" | "concept" | "retry" | "clarification" | "advanced";

// NEW - Use these instead
interface VideoSession {
  segments: VideoSegment[];
  currentIndex: number;
  context: LearningContext;
}

interface VideoSegment {
  id: string;
  componentCode: string;
  duration: number;
  hasQuestion: boolean;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  // ...
}
```

## New Architecture

### 1. VideoController (replaces SceneController)

**Before:**
```typescript
<SceneController videoConfig={videoConfig}>
  {({ currentScene, sceneConfig, handleUserInput }) => (
    // Render based on scene type
  )}
</SceneController>
```

**After:**
```typescript
<VideoController initialTopic={topic} onError={handleError}>
  {({ session, currentSegment, handleAnswer, requestNextSegment }) => (
    // Render current segment
  )}
</VideoController>
```

### 2. Video Generation

**Before:**
```typescript
// Generated entire multi-scene config at once
const response = await generateVideoConfig(topic);
// Had intro, concept, retry, clarification, advanced
```

**After:**
```typescript
// Generates one segment at a time based on context
const response = await generateVideoSegment(context);
// Each segment is unique and contextual
```

### 3. Rendering

**Before:**
```typescript
// Used different components based on scene type
const Component = SCENE_COMPONENTS[currentScene];
<Component content={sceneData.content} />
```

**After:**
```typescript
// Everything uses DynamicSceneRenderer
<DynamicSceneRenderer
  config={{
    type: 'dynamic',
    componentCode: currentSegment.componentCode,
    duration: currentSegment.duration,
    colors: currentSegment.colors,
  }}
/>
```

## New Features You Can Use

### Kinetic Animation Components

```typescript
import {
  KineticText,
  RevealBlock,
  Timeline,
  Transition,
  FloatingElements,
  SplitScreen,
} from './remotion/components/kinetic';

// Example: Flying text
<KineticText
  text="React Hooks Explained"
  flyFrom="left"
  easing="anticipation"
  stagger="sequential"
  byWord={true}
/>

// Example: Revealing content
<RevealBlock type="wipe-right" delay={60}>
  <CodeBlock code="const [count, setCount] = useState(0)" />
</RevealBlock>

// Example: Orchestrated timeline
<Timeline items={[
  {
    id: 'step1',
    startFrame: 0,
    duration: 30,
    animation: 'slide-up',
    content: <div>First concept</div>
  },
  {
    id: 'step2',
    startFrame: 40,
    duration: 30,
    animation: 'slide-up',
    content: <div>Second concept</div>
  }
]} />
```

### Learning Context Tracking

The system now tracks:
- **History**: All topics covered in session
- **Performance**: Last 5 answers (correct/incorrect)
- **Depth**: How deep into a topic
- **Difficulty**: Auto-adjusts based on performance

```typescript
// Access via VideoController
const { session } = useVideoController();

console.log(session.context.historyTopics);
console.log(session.context.correctnessPattern);
console.log(session.context.depth);
```

### Flexible Interaction

**Questions are now optional:**
```typescript
// Segment can have question
{
  hasQuestion: true,
  questionText: "What does useState return?"
}

// Or no question (auto-advances)
{
  hasQuestion: false
}
```

## How to Adapt Your Code

### If you were using SceneController:

```typescript
// OLD
import { SceneController } from './SceneController';

<SceneController videoConfig={config}>
  {({ currentScene, handleUserInput }) => {
    // Scene-specific logic
  }}
</SceneController>

// NEW
import { VideoController } from './controllers/VideoController';

<VideoController initialTopic={topic}>
  {({ currentSegment, handleAnswer, requestNextSegment }) => {
    // Segment-agnostic logic
    // All segments rendered the same way
  }}
</VideoController>
```

### If you were calling generateVideoConfig:

```typescript
// OLD
const response = await generateVideoConfig(topic);
// Returns entire multi-scene config

// NEW
const response = await generateVideoSegment(context);
// Returns single segment
// Call again for next segment with updated context
```

### If you were creating custom scenes:

Don't create scene components anymore. Instead:

1. **For LLM to generate**: It will create custom code
2. **For manual creation**: Create reusable components in `/components/kinetic/`

```typescript
// Example custom kinetic component
export const CustomExplanation: React.FC = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill>
      <KineticText text="Your explanation" />
      <Timeline items={[...]} />
    </AbsoluteFill>
  );
};
```

## Testing the New System

1. **Start the app**
2. **Enter a topic**: "React hooks"
3. **Watch the first segment**: Should see kinetic animations
4. **Segment ends**: 
   - If no question → Next segment auto-generates
   - If question → Answer it → Generates based on correctness
5. **Continue indefinitely**: Each segment adapts to your learning

## Common Issues

### "Property 'env' does not exist on type 'ImportMeta'"

**Fix**: Add to top of file:
```typescript
/// <reference types="vite/client" />
```

### "Cannot find module './SceneController'"

**Fix**: Replace with:
```typescript
import { VideoController } from './controllers/VideoController';
```

### "Type 'SceneType' is not defined"

**Fix**: The concept of scene types is gone. Work with `VideoSegment` instead.

### Segment code fails to execute

**Check**:
1. Uses only whitelisted components
2. No dangerous patterns (fetch, eval, etc.)
3. Valid React/Remotion code
4. Error message shows available components

## Benefits of New System

✅ **Truly infinite learning** - no predefined paths
✅ **Adaptive difficulty** - adjusts to user performance
✅ **Kinetic animations** - professional video-essay feel
✅ **Contextual** - each segment knows what came before
✅ **Flexible** - can have questions or not
✅ **Intelligent** - LLM decides what to teach next

## Need Help?

See `ARCHITECTURE.md` for complete system documentation.

---

**Welcome to infinite learning!** 🎓✨

