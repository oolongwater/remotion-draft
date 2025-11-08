# Setup Instructions

## Prerequisites

1. Node.js and npm installed
2. Anthropic API key (get one from https://console.anthropic.com/)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
touch .env
```

Add your Anthropic API key to the `.env` file:

```
VITE_ANTHROPIC_API_KEY=your_actual_api_key_here
```

**Important:** Replace `your_actual_api_key_here` with your real API key from Anthropic.

### 3. Start the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173 (or another port if 5173 is busy).

## How It Works

1. **Landing Page**: Enter any topic you want to learn about
2. **AI Generation**: Claude generates a custom educational video configuration
3. **Interactive Learning**: Watch the Remotion video and answer questions
4. **Branching Paths**: Different outcomes based on your answers:
   - Correct answer → Success scene
   - Incorrect answer → Retry with hints
   - Ask a question → Get clarification

## Architecture Overview

- **Landing Page** (`src/components/LandingPage.tsx`) - Topic input
- **LLM Service** (`src/services/llmService.ts`) - Claude API integration
- **Scene Components** (`src/remotion/scenes/`) - Config-driven Remotion scenes
- **State Management** (`src/App.tsx`) - App state machine (landing/loading/preview/error)
- **Scene Controller** (`src/SceneController.tsx`) - Branching logic

## Customization

### Modify the LLM Prompt

Edit `src/services/llmService.ts` → `generatePrompt()` function to change how content is generated.

### Adjust Scene Animations

Scenes accept animation configs. Modify the LLM prompt or edit default props in scene components.

### Change Visual Theme

Colors are configurable per scene in the `VideoConfig`. Update the LLM prompt or scene defaults.

## Troubleshooting

### "API key not configured" Error

Make sure:
1. `.env` file exists in the root directory
2. Contains `VITE_ANTHROPIC_API_KEY=your_key`
3. No extra spaces or quotes around the key
4. Restart the dev server after creating/editing `.env`

### "Failed to generate configuration" Error

Check:
1. Your API key is valid
2. You have API credits remaining
3. Your internet connection is working
4. Check the browser console for detailed error messages

### Scenes Not Displaying Correctly

- Ensure all scene components are receiving props correctly
- Check browser console for React errors
- Verify the LLM returned valid JSON (check Network tab)

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Open Remotion Studio (to preview individual scenes)
npm run studio
```

## Notes

- The app generates configurations client-side (no backend needed)
- Configurations are cached in localStorage for quick replay
- Video dimensions: 1280x720 @ 30fps (configurable in LLM response)

