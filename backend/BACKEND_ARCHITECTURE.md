# Backend Architecture

## Overview

The backend is a **serverless video generation pipeline** running on Modal.com that creates educational videos using Manim animations with AI-generated code and TTS voiceovers.

## Core Pipeline Flow

```
User Request → Modal API Endpoint → Video Generation Pipeline → Supabase Upload → Return URL
```

### Pipeline Stages

1. **Planning** (Stage 1)
   - Uses Claude Sonnet to generate a structured video plan
   - Breaks topic into sections with timing
   - Supports optional image context for visual reference

2. **Parallel Generation** (Stage 2)
   - **Code Generation**: Async calls to Claude Sonnet for each section's Manim code
   - **Rendering**: Each section renders in parallel Modal containers
   - **Error Handling**: Automatic code repair (1 retry) using Claude if render fails

3. **Concatenation** (Stage 3)
   - Uses ffmpeg to combine all section videos
   - Handles single-video edge case

4. **Upload** (Stage 4)
   - Uploads final video to Supabase Storage
   - Stores metadata (code, cost, timing, user association)
   - Returns public URL

## Critical Files

**Note**: All ManimGL-related files have been removed. This backend uses **Manim Community Edition (CE)** only.

### Main Entry Point
- **`backend/modal/main_video_generator.py`** (1130 lines)
  - FastAPI endpoint: `generate_video_api()` - POST endpoint with SSE streaming
  - Main function: `generate_educational_video()` - Generator yielding progress updates
  - Render function: `render_single_scene()` - Parallel scene rendering with retry logic
  - Local CLI: `main()` - Test harness for local development

### Services Layer
- **`backend/llm.py`** - LLM abstraction supporting:
  - Anthropic Claude (Sonnet 4.5, Haiku 4.5)
  - Google Gemini (Flash, Pro) with structured output
  - OpenAI GPT models
  - Async API support for parallel calls

- **`backend/tts.py`** - TTS services:
  - **ElevenLabs** - with character-level timing

- **`backend/storage.py`** - Supabase integration:
  - Video upload to Storage bucket
  - Metadata storage in PostgreSQL
  - User association via Clerk ID
  - Share token generation

- **`backend/utils/error_logging.py`** - Error tracking:
  - Supabase Storage log uploads (JSON + Python code)
  - Sentry integration for real-time monitoring
  - Detailed render failure logs with context

### Code Processing
- **`backend/modal/code_cleanup.py`** - Removes problematic Manim parameters
- **`backend/modal/manual_code_helpers.py`** - Applies known fixes to common issues
- **`backend/modal/prompts.py`** - Templates for code generation and mega plans
- **`backend/prompts.py`** - Alternative prompt library

### Upload Helper
- **`backend/modal/upload_to_supabase.py`** - Wrapper for storage service upload

## Key Features

### Parallel Processing
- **Code Generation**: All sections generate Manim code concurrently using async API calls
- **Rendering**: Each section renders in isolated Modal containers (up to N parallel)
- **Resource Allocation**: 8GB RAM, 4 CPU cores per render container

### Error Recovery
- **Render Failures**: Automatic code repair using Claude (1 retry max)
- **Logging**: All failures logged to Supabase Storage + Sentry with full context
- **Graceful Degradation**: Continues if some sections succeed

### Progress Tracking
- **SSE Updates**: Real-time progress via Server-Sent Events
- **Supabase Job Table**: `job_progress` table stores status, percentage, stage
- **User Association**: Links videos to Clerk user accounts

### Cost Tracking
- **LLM Usage**: Tracks input/output tokens and calculates API costs
- **TTS Usage**: Estimates cost based on character count
- **Metadata Storage**: Stores cost breakdown in database

## Environment Variables

### Required Secrets (Modal)
- `anthropic-key` - Claude API key
- `elevenlabs-key` - ElevenLabs TTS API key
- `supabase-config` - Supabase URL + anon key
- `supabase-service-role` - Service role key for database writes
- `sentry-dsn` - Sentry error tracking DSN

### Configuration
- `ELEVENLABS_VOICE_ID` - Default: `pqHfZKP75CvOlQylNhV4`

## Database Schema

### `video_metadata` Table
- `job_id` (UUID, PK) - Unique job identifier
- `topic` (text) - Video topic/description
- `supabase_url` (text) - Public video URL
- `supabase_filename` (text) - Storage filename
- `status` (text) - "completed", "failed"
- `user_id` (UUID, FK → users.id) - Owner user ID
- `clerk_user_id` (text) - Clerk user identifier
- `video_code` (text) - Generated Manim code
- `mega_plan` (jsonb) - Structured plan object
- `cost_breakdown` (jsonb) - Cost details
- `duration_seconds` (float) - Video length
- `keywords` (text[]) - Search keywords
- `is_public` (boolean) - Public/private flag
- `share_token` (text) - Secret sharing token
- `created_at`, `updated_at`, `completed_at` (timestamptz)

### `job_progress` Table
- `job_id` (UUID, PK)
- `status` (text) - "processing", "completed", "failed"
- `current_stage` (int) - 1-4 (planning, pipeline, concat, upload)
- `progress_percentage` (int) - 0-100
- `message` (text) - Human-readable status
- `video_url` (text) - Final URL when completed
- `error_message` (text) - Error details if failed

## Modal Deployment

### Container Image
- Base: Debian Slim (Python 3.11)
- System deps: ffmpeg, sox, LaTeX, Cairo, Pango
- Python packages: manim, anthropic, elevenlabs, supabase, sentry

### Resource Limits
- **Main Function**: 16GB RAM, 8 CPUs, 1 hour timeout
- **Render Function**: 8GB RAM, 4 CPUs, 15 min timeout per scene
- **Volume**: Persistent `video-outputs-main` for inter-container file sharing

### Deployment Command
```bash
modal deploy backend/modal/main_video_generator.py
```

## API Usage

### Generate Video (HTTP POST)
```bash
curl -X POST https://YOUR_MODAL_URL/generate_video_api \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Explain how neural networks work",
    "job_id": "optional-uuid",
    "clerk_user_id": "user_xxxxx",
    "image_context": "base64-encoded-image-data"
  }'
```

### Response (SSE Stream)
```json
data: {"status": "processing", "stage": 1, "progress_percentage": 5, "message": "Generating plan..."}
data: {"status": "processing", "stage": 2, "progress_percentage": 50, "message": "Rendering section 3/5..."}
data: {"status": "completed", "progress_percentage": 100, "video_url": "https://..."}
```

## Local Testing

```bash
# Install Modal CLI
pip install modal

# Set up secrets in Modal dashboard
modal secret create anthropic-key ANTHROPIC_API_KEY=sk-...
modal secret create elevenlabs-key ELEVENLABS_API_KEY=...
modal secret create supabase-config SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_URL=...

# Run locally (uses Modal infrastructure)
modal run backend/modal/main_video_generator.py --prompt "Explain photosynthesis"
```

## Development vs Production

### Development Version
- **File**: `backend/modal/main_video_generator_dev.py`
- **Purpose**: Testing new features without affecting production
- **Deploy Separately**: Uses different Modal app name

### Production Version
- **File**: `backend/modal/main_video_generator.py`
- **Stability**: Tested and reliable
- **Monitoring**: Full Sentry integration

## Dependencies

### Python Packages (requirements.txt)
- `manim==0.18.1` - Animation engine
- `anthropic>=0.40.0` - Claude API
- `elevenlabs==0.2.27` - TTS
- `supabase>=2.0.0` - Database + storage
- `sentry-sdk>=2.0.0` - Error monitoring
- `modal` - Serverless platform

### System Packages
- ffmpeg - Video concatenation
- LaTeX - Math rendering in animations
- Cairo/Pango - Text rendering

## Monitoring & Debugging

### Sentry Integration
- Automatic error capture with full context
- Breadcrumbs track each pipeline stage
- User/job tagging for easy filtering

### Supabase Error Logs
- Full render failures stored as JSON in Storage
- Includes: stdout, stderr, code, command, attempt number
- Accessible via public URLs for debugging

### Modal Logs
- Real-time container logs in Modal dashboard
- Searchable by job_id or timestamp
- Shows parallel execution across containers

## Cost Optimization

### Current Costs (Approximate)
- **Claude Sonnet 4.5**: $3/1M input tokens, $15/1M output tokens
- **ElevenLabs**: ~$0.30/1K characters
- **Modal Compute**: Pay per second of container runtime

### Optimization Strategies
1. **Parallel Rendering**: Reduces total wall-clock time
2. **Code Caching**: Reuses successful code when possible
3. **Audio Caching**: TTS results cached by content hash
4. **Quality Settings**: Low quality (480p, 12fps) for faster renders

## Future Improvements

### Potential Enhancements
- [ ] Multi-language support (TTS + subtitles)
- [ ] Custom voice cloning
- [ ] Background music generation
- [ ] Interactive elements (quizzes, annotations)
- [ ] Video editing API (trim, splice, effects)
- [ ] Batch generation queue
- [ ] Cost prediction before generation

### Performance Optimizations
- [ ] GPU acceleration for rendering
- [ ] Incremental video building (avoid full re-render)
- [ ] Smart code caching (semantic similarity)
- [ ] Pre-warm containers for faster cold starts
