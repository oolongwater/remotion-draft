# Cached Sessions Guide

This guide explains the cached session system for instant-loading video topics.

## Overview

The cached session system allows pre-selected topics on the landing page to load instantly without waiting for backend video generation. Sessions are pre-generated and stored as static JSON files.

## How It Works

### 1. Architecture

```
┌─────────────────┐
│  Landing Page   │ ─── Click Topic ───▶ Has cache? ──Yes──▶ Load JSON ──▶ Instant Play
│  (6 topics)     │                           │
└─────────────────┘                           No
                                              │
                                              ▼
                                      Generate via Backend
                                      (Normal flow, ~1-2 min)
```

### 2. File Structure

```
frontend/
├── public/
│   └── cached-sessions/          # Static JSON files
│       ├── react-hooks.json
│       ├── binary-search-trees.json
│       ├── photosynthesis.json
│       ├── quantum-computing.json
│       ├── shakespeares-sonnets.json
│       └── machine-learning.json
│
└── src/
    └── services/
        └── cachedSessionService.ts  # Load/check cached sessions

scripts/
├── generateCachedSessions.ts     # Generation script
├── package.json
└── README.md
```

### 3. Components

#### cachedSessionService.ts
- `hasCachedSession(topic)` - Check if topic has cached session
- `loadCachedSession(topic)` - Load and deserialize session from JSON
- `getCachedTopics()` - Get list of all cached topics

#### App.tsx
- Enhanced `handleTopicSubmit` to try loading cache first
- Falls back to generation if cache fails

#### LandingPage.tsx
- Visual indicators (⚡) for cached topics
- Blue/purple gradient styling for instant-load topics
- Direct submission on click for cached topics

## Generating Cached Sessions

### Prerequisites
1. Backend Modal endpoint must be running
2. Node.js 18+ installed

### Steps

1. **Install dependencies:**
   ```bash
   cd scripts
   npm install
   ```

2. **Run generator:**
   ```bash
   npm run generate
   ```

3. **What happens:**
   - Calls backend for each topic (React Hooks, Binary Search Trees, etc.)
   - Waits for video generation via SSE
   - Builds VideoSession with all video URLs
   - Saves to `frontend/public/cached-sessions/`

4. **Duration:**
   - ~1-2 minutes per topic
   - Total: ~10-15 minutes for all 6 topics
   - Sequential processing to avoid rate limits

### Output Format

Each JSON file contains a complete `VideoSession`:

```json
{
  "tree": {
    "nodes": [[nodeId, nodeData], ...],  // Map serialized as array
    "rootIds": ["node_xxx"],
    "currentNodeId": "node_xxx"
  },
  "context": {
    "initialTopic": "React Hooks",
    "historyTopics": ["React Hooks"],
    "depth": 2,
    "correctnessPattern": [],
    "preferredStyle": "mixed"
  },
  "sessionId": "cached_xxx",
  "startedAt": "2024-11-09T...",
  "lastUpdatedAt": "2024-11-09T..."
}
```

## User Experience

### With Cached Sessions
1. User clicks "React Hooks" ⚡
2. Instant load (<100ms)
3. Video starts playing immediately
4. No backend calls needed

### Without Cached Sessions
1. User enters "Ancient Rome"
2. Loading spinner appears
3. Backend generates video (~1-2 min)
4. Video starts playing

### Visual Indicators

**Cached topics** (have ⚡):
- Lightning bolt emoji prefix
- Blue/purple gradient background
- Tooltip: "Instant playback - Pre-loaded"
- Instant submission on click

**Regular topics** (no icon):
- Standard gray background
- Tooltip: "Will generate on demand"
- Fills input field on click

## Updating Cached Sessions

To refresh cached sessions with new content:

1. Delete old JSON files (or specific ones):
   ```bash
   rm frontend/public/cached-sessions/*.json
   ```

2. Run generator again:
   ```bash
   cd scripts
   npm run generate
   ```

3. New sessions will be generated and saved

## Configuration

### Adding New Cached Topics

1. **Update LandingPage.tsx:**
   ```typescript
   const exampleTopics = [
     'React Hooks',
     'Your New Topic',  // Add here
     // ...
   ];
   ```

2. **Update cachedSessionService.ts:**
   ```typescript
   const CACHED_SESSIONS: Record<string, string> = {
     'React Hooks': '/cached-sessions/react-hooks.json',
     'Your New Topic': '/cached-sessions/your-new-topic.json',  // Add here
     // ...
   };
   ```

3. **Update generateCachedSessions.ts:**
   ```typescript
   const TOPICS = [
     'React Hooks',
     'Your New Topic',  // Add here
     // ...
   ];
   ```

4. **Regenerate sessions:**
   ```bash
   cd scripts
   npm run generate
   ```

## Benefits

1. **Speed:** Instant loading vs 1-2 minute wait
2. **Cost:** No backend calls for popular topics
3. **UX:** Smooth, responsive interface
4. **Reliability:** Pre-validated sessions

## Fallback Strategy

If cached session fails to load:
- Console warning logged
- Automatically falls back to normal generation
- User experience is seamless
- No error shown to user

## Testing

### Test Cached Loading
1. Click a topic with ⚡ icon
2. Should load instantly
3. Check console for: `"✅ Successfully loaded cached session for: ..."`

### Test Fallback
1. Rename a cached JSON file temporarily
2. Click that topic
3. Should fall back to generation
4. Check console for: `"Failed to load cached session, falling back to generation"`

### Test Generation
1. Delete all cached JSON files
2. Run generation script
3. Verify all 6 files are created
4. Check each file has valid JSON structure

## Troubleshooting

### Issue: Topics not loading instantly
- Check `frontend/public/cached-sessions/` has JSON files
- Verify topic names match exactly (case-sensitive)
- Check browser console for errors

### Issue: Generation script fails
- Ensure backend Modal endpoint is running
- Check network connectivity
- Verify endpoint URL in script matches deployed backend

### Issue: Videos not playing
- Check video URLs in JSON are valid and accessible
- Verify GCS bucket permissions if using Google Cloud Storage
- Test video URLs directly in browser

## Future Enhancements

Possible improvements:
- Automatic background regeneration
- Version tracking for sessions
- CDN caching for JSON files
- Compression for smaller file sizes
- Progressive loading for large sessions

