# Interactive Branching Educational Video App

An MVP of an interactive, branching educational video application built with **Remotion**, **React**, **TypeScript**, **Vite**, and **Tailwind CSS**. This prototype demonstrates how to create educational content that adapts to user input through a state machine-driven interface.

![Banner](https://img.shields.io/badge/Remotion-4.0-blue) ![React](https://img.shields.io/badge/React-18.2-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)

## 🎥 What is This?

This app creates an interactive learning experience where:
- Users watch animated **Remotion scenes** (not traditional videos)
- Scenes ask questions and respond to user input
- A **state machine** routes users to different scenes based on their answers
- All animations are code-driven, making them infinitely customizable

**No video files involved** - everything is rendered in real-time using React components!

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Run the interactive app in the browser
npm run dev

# Open Remotion Studio to edit individual scenes
npm run studio
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## 📁 Project Structure

```
remotion/
├── src/
│   ├── main.tsx                    # Vite entry point
│   ├── App.tsx                     # Main app with Remotion Player
│   ├── SceneController.tsx         # State machine for scene routing
│   ├── index.css                   # Tailwind CSS imports
│   ├── components/
│   │   └── InputOverlay.tsx        # UI overlay for user interactions
│   ├── utils/
│   │   └── interpretAnswer.ts      # Answer interpretation logic (stub)
│   └── remotion/
│       ├── Root.tsx                # Registers all Remotion compositions
│       ├── index.ts                # Remotion entry point
│       └── scenes/
│           ├── IntroScene.tsx      # Welcome screen
│           ├── ConceptScene.tsx    # Teaches a concept
│           ├── RetryScene.tsx      # Shown on incorrect answer
│           ├── ClarificationScene.tsx  # Answers user questions
│           └── AdvancedScene.tsx   # Success/completion screen
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎬 Scene Flow

The app implements the following branching logic:

```
IntroScene (Start)
    ↓
ConceptScene (Question)
    ├── Correct → AdvancedScene (Success!)
    ├── Incorrect → RetryScene → Back to ConceptScene
    └── Question → ClarificationScene → Back to ConceptScene
```

## 🛠️ How to Extend This App

### Adding New Scenes

1. **Create the scene component:**

```tsx
// src/remotion/scenes/NewScene.tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const NewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Your content here */}
    </AbsoluteFill>
  );
};
```

2. **Register it in Root.tsx:**

```tsx
import { NewScene } from "./scenes/NewScene";

<Composition
  id="new-scene"
  component={NewScene}
  durationInFrames={120}
  fps={30}
  width={1280}
  height={720}
/>
```

3. **Add to SceneController.tsx:**

```tsx
// Add to SceneType union
export type SceneType = "intro" | "concept" | "new-scene" | ...;

// Add to SCENE_CONFIGS
export const SCENE_CONFIGS: Record<SceneType, SceneConfig> = {
  // ...
  "new-scene": {
    durationInFrames: 120,
    fps: 30,
    width: 1280,
    height: 720,
  },
};

// Add routing logic in handleUserInput()
```

4. **Import and map in App.tsx:**

```tsx
import { NewScene } from "./remotion/scenes/NewScene";

const SCENE_COMPONENTS: Record<SceneType, React.FC> = {
  // ...
  "new-scene": NewScene,
};
```

### Customizing Answer Interpretation

The `interpretAnswer()` function in `src/utils/interpretAnswer.ts` currently uses keyword matching. To integrate with an LLM:

```typescript
// Example with OpenAI
import OpenAI from "openai";

export async function interpretAnswer(answer: string): Promise<AnswerResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "Evaluate if this answer about React components is correct. Reply with only: correct, incorrect, or question"
      },
      { role: "user", content: answer }
    ],
  });

  return completion.choices[0].message.content as AnswerResult;
}
```

### Customizing Animations

All scenes use Remotion's animation APIs. Key functions:

- **`useCurrentFrame()`** - Get the current frame number
- **`interpolate()`** - Map values between ranges
- **`spring()`** - Create spring-based animations

Example:

```tsx
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: "clamp",
});
```

### Adding More UI Options

The `InputOverlay` component can be extended to support:
- Multiple choice buttons
- Sliders
- Voice input
- Image uploads
- Rich text editors

Example multiple choice:

```tsx
const choices = ["Option A", "Option B", "Option C"];

return (
  <div className="flex gap-4">
    {choices.map((choice) => (
      <button
        key={choice}
        onClick={() => onUserInput(choice)}
        className="px-6 py-3 bg-blue-600 rounded-lg"
      >
        {choice}
      </button>
    ))}
  </div>
);
```

## 🎨 Customizing Styles

This project uses **Tailwind CSS**. To customize:

1. Edit `tailwind.config.js` to change theme:

```js
theme: {
  extend: {
    colors: {
      brand: {
        primary: '#your-color',
        secondary: '#your-color',
      },
    },
  },
}
```

2. Update component styles using Tailwind classes
3. Override global styles in `src/index.css`

## 🎓 Learn More

### Remotion Resources
- [Remotion Docs](https://www.remotion.dev/docs/)
- [Remotion Examples](https://www.remotion.dev/docs/examples)
- [Remotion Player Docs](https://www.remotion.dev/docs/player)

### Key Concepts
- **Composition**: A renderable video/scene with defined dimensions and duration
- **Frame**: The basic unit of time in Remotion (at 30fps, frame 30 = 1 second)
- **interpolate()**: Maps input ranges to output ranges for smooth animations
- **spring()**: Creates physics-based animations that feel natural

## 🔧 Troubleshooting

### Player not showing
- Ensure all dependencies are installed: `npm install`
- Check browser console for errors
- Verify that the scene component is properly imported in `App.tsx`

### Animations not smooth
- Check that you're using `useCurrentFrame()` for all animations
- Avoid CSS transitions/animations (they don't work well with Remotion's rendering)
- Use `interpolate()` with proper extrapolation settings

### Scene not changing
- Check console for routing errors in `SceneController`
- Verify scene type is added to all necessary places (type union, configs, mappings)
- Ensure `handleUserInput()` has logic for the scene transition

## 📦 Dependencies

- **remotion** - Video creation framework
- **@remotion/player** - Remotion Player component
- **@remotion/cli** - Remotion CLI tools
- **react** / **react-dom** - UI framework
- **vite** - Build tool
- **tailwindcss** - CSS framework
- **typescript** - Type safety

## 🚢 Deployment

This app can be deployed to any static hosting service:

### Vercel
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
# Deploy the dist/ folder
```

### GitHub Pages
```bash
npm run build
# Deploy dist/ folder to gh-pages branch
```

**Note**: If you want to render videos server-side, check out [Remotion Lambda](https://www.remotion.dev/docs/lambda) for cloud rendering capabilities.

## 💡 Ideas for Enhancement

- [ ] Add progress tracking (scenes visited, score, time spent)
- [ ] Implement user profiles and saved progress
- [ ] Add more complex branching logic (multiple correct paths)
- [ ] Create a visual scene editor
- [ ] Add accessibility features (screen reader support, keyboard navigation)
- [ ] Implement analytics to track user performance
- [ ] Add multiplayer/collaborative learning features
- [ ] Export completed interactions as shareable videos
- [ ] Add gamification (points, badges, leaderboards)
- [ ] Support multiple languages

## 📝 License

MIT - Feel free to use this as a starting point for your own projects!

## 🙏 Acknowledgments

Built with:
- [Remotion](https://www.remotion.dev/) by Jonny Burger
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Happy coding! 🚀** If you build something cool with this, we'd love to see it!

