# Getting Started

Welcome to your Interactive Branching Educational Video App! 🎉

## First Steps

### 1. Install Dependencies

```bash
npm install
```

This will install:
- Remotion (video framework)
- React & React DOM
- Vite (build tool)
- Tailwind CSS (styling)
- TypeScript (type safety)

### 2. Start the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your app in action!

### 3. Open Remotion Studio (Optional)

```bash
npm run studio
```

This opens the Remotion Studio where you can:
- Preview each scene individually
- Adjust animations frame-by-frame
- Export individual scenes as videos

## What You've Built

### 5 Interactive Scenes

1. **IntroScene** - Welcome screen with fade-in animation
2. **ConceptScene** - Educational content with slide-in effect
3. **RetryScene** - Encouragement screen with shake animation
4. **ClarificationScene** - Q&A screen with smooth transitions
5. **AdvancedScene** - Success celebration with particles

### State Machine

The app routes users through scenes based on their answers:
- **Correct answer** → Success scene
- **Incorrect answer** → Retry with simpler explanation
- **Question** → Clarification with more context

### Smart Answer Interpretation

A stub function in `src/utils/interpretAnswer.ts` evaluates answers using keyword matching. Replace it with an LLM API call for production use!

## Quick Customization Guide

### Change the Educational Content

Edit `src/remotion/scenes/ConceptScene.tsx`:
- Update the concept explanation text
- Modify the question
- Adjust animation timings

### Modify Answer Logic

Edit `src/utils/interpretAnswer.ts`:
- Add more keywords for correct answers
- Integrate with OpenAI, Anthropic, etc.
- Add scoring or confidence levels

### Add a New Scene

1. Create `/src/remotion/scenes/YourScene.tsx`
2. Add to `SceneType` in `/src/SceneController.tsx`
3. Register in `/src/remotion/Root.tsx`
4. Add routing logic in `handleUserInput()`
5. Import in `/src/App.tsx`

### Customize Styling

- Global styles: Edit `src/index.css`
- Tailwind theme: Edit `tailwind.config.js`
- Component styles: Use Tailwind classes inline

## Project Structure

```
src/
├── App.tsx                         # Main app component
├── SceneController.tsx             # State machine
├── main.tsx                        # Entry point
├── index.css                       # Global styles
├── components/
│   └── InputOverlay.tsx           # User input UI
├── utils/
│   └── interpretAnswer.ts         # Answer evaluation
└── remotion/
    ├── Root.tsx                   # Composition registry
    ├── index.ts                   # Remotion entry
    └── scenes/                    # All scene components
        ├── IntroScene.tsx
        ├── ConceptScene.tsx
        ├── RetryScene.tsx
        ├── ClarificationScene.tsx
        └── AdvancedScene.tsx
```

## Common Tasks

### Test Different User Flows

1. **Happy Path**: Answer with "React" or "component" → Success
2. **Retry Path**: Answer with "something wrong" → Retry → Try again
3. **Question Path**: Answer with "what does that mean?" → Clarification

### Adjust Scene Duration

In `src/SceneController.tsx`, modify `SCENE_CONFIGS`:

```typescript
concept: {
  durationInFrames: 240,  // Longer scene (8 seconds)
  fps: 30,
  width: 1280,
  height: 720,
}
```

### Change Animation Speed

In any scene file, adjust the `interpolate` ranges:

```typescript
// Faster fade-in (0-15 frames instead of 0-30)
const opacity = interpolate(frame, [0, 15], [0, 1], {
  extrapolateRight: "clamp",
});
```

## Troubleshooting

### White Screen / Blank Page
- Check browser console for errors
- Ensure all dependencies are installed
- Verify imports are correct

### Player Not Showing
- Check that scene components are properly imported
- Verify composition IDs match scene types
- Look for TypeScript errors

### Animations Choppy
- Avoid CSS transitions (use Remotion's `interpolate()`)
- Check frame rate in scene configs
- Use `extrapolateRight: "clamp"` to prevent overshooting

## Next Steps

### For Learning
- Read the inline comments in each file
- Experiment with different animations
- Try the Remotion Studio to see frames individually

### For Production
- Replace `interpretAnswer()` with real AI
- Add user authentication
- Track progress and analytics
- Deploy to Vercel, Netlify, or similar

### For Scaling
- Check out [Remotion Lambda](https://remotion.dev/lambda) for server-side rendering
- Add a database to store user progress
- Implement more complex branching logic

## Resources

- [Remotion Documentation](https://remotion.dev/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Happy Building! 🚀**

Questions? Check the comments in the code - they're designed to guide you through extensions and customizations!

