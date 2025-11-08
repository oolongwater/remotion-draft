/**
 * Root.tsx
 * 
 * This is the Remotion root component that registers all compositions.
 * Each composition represents a different scene in the branching video.
 * 
 * EXTENDING WITH NEW SCENES:
 * --------------------------
 * To add a new scene:
 * 1. Create the scene component in src/remotion/scenes/
 * 2. Import it here
 * 3. Add a new <Composition> with a unique id
 * 4. Update SceneType in SceneController.tsx
 * 5. Add scene config in SCENE_CONFIGS
 * 6. Update routing logic in handleUserInput()
 * 
 * The Remotion Studio will display all registered compositions
 * in the sidebar for individual editing and preview.
 */

import { Composition } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { ConceptScene } from "./scenes/ConceptScene";
import { RetryScene } from "./scenes/RetryScene";
import { ClarificationScene } from "./scenes/ClarificationScene";
import { AdvancedScene } from "./scenes/AdvancedScene";

/**
 * RemotionRoot Component
 * 
 * Registers all compositions that can be rendered.
 * Each composition corresponds to a scene in the interactive video.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 
        IntroScene: The welcome screen
        Shows title and prompts user to start the lesson
      */}
      <Composition
        id="intro"
        component={IntroScene}
        durationInFrames={90}
        fps={30}
        width={1280}
        height={720}
      />

      {/* 
        ConceptScene: Presents educational content
        Explains the concept and asks a question
      */}
      <Composition
        id="concept"
        component={ConceptScene}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
      />

      {/* 
        RetryScene: Shown on incorrect answers
        Provides encouragement and simplified explanation
      */}
      <Composition
        id="retry"
        component={RetryScene}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />

      {/* 
        ClarificationScene: Shown when user asks a question
        Provides additional context and explanation
      */}
      <Composition
        id="clarification"
        component={ClarificationScene}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />

      {/* 
        AdvancedScene: Success/completion screen
        Celebrates correct answer with animations
      */}
      <Composition
        id="advanced"
        component={AdvancedScene}
        durationInFrames={120}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};

