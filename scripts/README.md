# Cached Session Generator

This script pre-generates video sessions for all example topics on the landing page.

## Usage

1. Install dependencies:
   ```bash
   cd scripts
   npm install
   ```

2. Run the generator:
   ```bash
   npm run generate
   ```

The script will:
- Call the backend Modal endpoint for each topic
- Wait for video generation to complete via SSE
- Build a `VideoSession` object with all video URLs
- Save JSON files to `frontend/public/cached-sessions/`

## Output

Generated files:
- `react-hooks.json`
- `binary-search-trees.json`
- `photosynthesis.json`
- `quantum-computing.json`
- `shakespeares-sonnets.json`
- `machine-learning.json`

Each file contains a complete `VideoSession` that can be instantly loaded by the frontend.

## Notes

- Generation happens sequentially with 5-second delays between topics
- Each topic takes ~1-2 minutes to generate
- Total runtime: ~10-15 minutes for all 6 topics
- Sessions can be regenerated at any time to update content

