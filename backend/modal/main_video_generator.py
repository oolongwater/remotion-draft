#!/usr/bin/env python3
"""
Main Modal Video Generator - Complete Pipeline
Standalone implementation following the specified pseudocode

Pipeline:
1. Generate mega plan with structured output (Gemini Flash)
2. Concurrent scene generation:
   a. Generate Manim code for each scene (Claude Sonnet)
   b. Generate TTS audio for voiceover (ElevenLabs)
   c. Render scene with Manim
3. Concatenate videos

100% standalone - no dependencies on other project files
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import modal

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION - TTS provider
# ═══════════════════════════════════════════════════════════════════════════
ELEVENLABS_VOICE_ID = "pqHfZKP75CvOlQylNhV4"  # ElevenLabs voice

# Create Modal App
app = modal.App("main-video-generator")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",  # For video concatenation
        "sox",     # For audio processing
        "texlive-latex-base",
        "texlive-latex-extra",
        "texlive-fonts-recommended",
        "texlive-fonts-extra",
        "libcairo2-dev",
        "libpango1.0-dev",
    )
    .pip_install(
        "requests>=2.31.0",
        "python-dotenv>=0.21.0",
        "manim==0.18.1",
        "manim-voiceover>=0.3.0",
        "elevenlabs==0.2.27",  # TTS provider
        "fastapi[standard]>=0.104.0",
        "anthropic>=0.40.0",
    )
    .add_local_file("../llm.py", "/root/llm.py")
    .add_local_file("../tts.py", "/root/tts.py")  # TTS service (ElevenLabs)
    .add_local_file("prompts.py", "/root/prompts.py")
    .add_local_file("code_cleanup.py", "/root/code_cleanup.py")
    .add_local_file("manual_code_helpers.py", "/root/manual_code_helpers.py")
)

# Create volumes for caching and storage
output_volume = modal.Volume.from_name("video-outputs-main", create_if_missing=True)


# Separate function for rendering individual scenes (runs in parallel containers)
@app.function(
    image=image,
    timeout=900,  # 15 minutes per scene
    memory=8192,  # 8GB per scene
    cpu=4.0,
    secrets=[
        modal.Secret.from_name("anthropic-key"),  # For code repair
        modal.Secret.from_name("elevenlabs-key"),  # TTS provider
    ],
    volumes={
        "/outputs": output_volume
    },
)
def render_single_scene(
    section_num: int,
    manim_code: str,
    work_dir_path: str,
    job_id: str
) -> tuple:
    """
    Render a single Manim scene in its own container.
    Returns: (section_num, video_path, error)
    """
    # Error logging removed - Supabase integration temporarily disabled
    import subprocess
    import sys
    from pathlib import Path

    sys.path.insert(0, '/root')
    from code_cleanup import clean_manim_code
    from llm import AnthropicClaudeService
    from manual_code_helpers import apply_all_manual_fixes

    work_dir = Path(work_dir_path)
    work_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'━'*60}")
    print(f"📹 [Container {section_num}] Rendering Section {section_num}")
    print(f"{'━'*60}")

    # Apply code cleanup
    manim_code = clean_manim_code(manim_code)
    manim_code = apply_all_manual_fixes(manim_code)

    # Save code
    code_file = work_dir / f"section_{section_num}.py"
    code_file.write_text(manim_code)
    print(f"✓ [Container {section_num}] Code saved to {code_file.name}")

    # Try rendering up to 2 times (original + one repair attempt)
    max_attempts = 2
    current_code = manim_code
    current_file = code_file

    for attempt in range(max_attempts):
        try:
            # Find scene class name
            scene_class = "ExplainerScene"
            for line in current_code.split('\n'):
                if 'class ' in line and ('(VoiceoverScene)' in line or '(Scene)' in line):
                    scene_class = line.split('class ')[1].split('(')[0].strip()
                    break

            if attempt == 0:
                print(f"🎬 [Container {section_num}] Starting Manim Rendering (Attempt {attempt + 1}/{max_attempts})...")
            else:
                print(f"🔧 [Container {section_num}] Retrying with repaired code (Attempt {attempt + 1}/{max_attempts})...")

            print(f"   Scene class: {scene_class}")
            print(f"   Quality: 480p15 (low)")
            print(f"   File: {current_file.name}")

            result = subprocess.run(
                [
                    "manim",
                    "-ql",  # Low quality without preview overhead
                    "--format", "mp4",
                    "--frame_rate", "12",  # Reduced from 15fps to 12fps for faster rendering
                    "--media_dir", str(work_dir),
                    str(current_file),
                    scene_class
                ],
                capture_output=True,
                text=True,
                timeout=600
            )
            print(f"✓ [Container {section_num}] Manim render completed (exit code: {result.returncode})")

            if result.stdout:
                audio_lines = [line for line in result.stdout.split('\n') if 'elevenlabs' in line.lower() or 'audio' in line.lower()]
                if audio_lines:
                    print(f"   🎤 Audio generation detected")

            # Find rendered video - check multiple possible quality directories
            # Manim might output to 480p15 (from -ql flag) or 480p12 (from --frame_rate)
            videos_base = work_dir / "videos"
            if videos_base.exists():
                # Debug: list what Manim actually created
                try:
                    scene_dir = videos_base / current_file.stem
                    if scene_dir.exists():
                        quality_dirs = list(scene_dir.iterdir())
                        print(f"   📁 Available quality directories: {[d.name for d in quality_dirs if d.is_dir()]}")
                except Exception as e:
                    print(f"   ⚠️  Could not list directories: {e}")

            possible_dirs = [
                work_dir / "videos" / current_file.stem / "480p15",  # -ql default
                work_dir / "videos" / current_file.stem / "480p12",  # frame_rate override
            ]

            rendered_video = None
            checked_dirs = []
            for media_dir in possible_dirs:
                if media_dir.exists():
                    rendered_files = list(media_dir.glob("*.mp4"))
                    checked_dirs.append(f"{media_dir.name} ({len(rendered_files)} files)")
                    if rendered_files:
                        rendered_video = rendered_files[0]
                        print(f"   ✓ Found video in: {media_dir.name}/")
                        break
                else:
                    checked_dirs.append(f"{media_dir.name} (missing)")

            if not rendered_video:
                print(f"   ❌ No video found. Checked directories: {checked_dirs}")

            # Check if render was successful
            render_failed = not rendered_video or not rendered_video.exists() or result.returncode != 0

            if render_failed and attempt < max_attempts - 1:
                # Log render failure details to console
                print(f"📋 Render failure details:")
                print(f"   Exit code: {result.returncode}")
                print(f"   Checked directories: {checked_dirs}")

                # Attempt to repair code
                print(f"🔧 [Container {section_num}] Render failed, attempting code repair...")

                claude_service = AnthropicClaudeService(model="claude-sonnet-4-5-20250929")

                repair_prompt = f"""The following Manim code failed to render. Please fix the code.

ORIGINAL CODE:
```python
{current_code}
```

ERROR OUTPUT (stdout):
{result.stdout[:2000]}

ERROR OUTPUT (stderr):
{result.stderr[:2000]}

Return ONLY the fixed Python code with the correct TTS service initialization."""

                repaired_code = claude_service.generate_simple(
                    prompt=repair_prompt,
                    max_tokens=16000,
                    temperature=0.1
                )

                if '```python' in repaired_code:
                    repaired_code = repaired_code.split('```python')[1].split('```')[0].strip()
                elif '```' in repaired_code:
                    repaired_code = repaired_code.split('```')[1].split('```')[0].strip()

                # Clean repaired code
                repaired_code = clean_manim_code(repaired_code)
                repaired_code = apply_all_manual_fixes(repaired_code)

                current_file = work_dir / f"section_{section_num}_repaired.py"
                current_file.write_text(repaired_code)
                current_code = repaired_code
                print(f"✓ [Container {section_num}] Repaired code saved")
                continue

            if render_failed:
                print(f"❌ [Container {section_num}] Render failed after {max_attempts} attempts")
                print(f"📋 Render failure details:")
                print(f"   Exit code: {result.returncode}")
                print(f"   Checked directories: {checked_dirs}")

                # Return full stderr for debugging (not truncated)
                return (section_num, None, f"Render failed: {result.stderr}")

            # Success - move video to final location
            section_video = work_dir / f"section_{section_num}.mp4"
            rendered_video.rename(section_video)
            file_size = section_video.stat().st_size / (1024 * 1024)
            print(f"✓ [Container {section_num}] Video rendered successfully ({file_size:.2f} MB)")

            # Commit volume changes so main function can access the file
            from modal import Volume
            volume = Volume.from_name("video-outputs-main")
            volume.commit()
            print(f"✓ [Container {section_num}] Volume changes committed")

            return (section_num, str(section_video), None)

        except subprocess.TimeoutExpired:
            if attempt < max_attempts - 1:
                print(f"⚠️  [Container {section_num}] Timeout, attempting repair...")
                # Similar repair logic for timeout
                continue
            else:
                return (section_num, None, "Timeout after repair attempt")
        except Exception as e:
            print(f"❌ [Container {section_num}] Error: {type(e).__name__}: {e}")
            return (section_num, None, str(e))

    return (section_num, None, "Failed after all attempts")


@app.function(
    image=image,
    timeout=3600,  # 1 hour
    memory=16384,  # 16GB
    cpu=8.0,
    secrets=[
        modal.Secret.from_name("anthropic-key"),
        modal.Secret.from_name("elevenlabs-key"),  # TTS provider
    ],
    volumes={
        "/outputs": output_volume
    },
    is_generator=True
)
def generate_educational_video(
    prompt: str,
    job_id: Optional[str] = None,
    image_context: Optional[str] = None,
    clerk_user_id: Optional[str] = None
):
    """
    Generate a complete educational video from a prompt with optional image context.

    Args:
        prompt: Topic/description for the video
        job_id: Optional job ID for tracking
        image_context: Optional base64-encoded image to provide visual context
        clerk_user_id: Optional Clerk user ID to associate video with user account

    Yields:
        Progress updates and final video URL
    """
    import os
    import subprocess
    import sys
    import tempfile
    import uuid
    from pathlib import Path

    sys.path.insert(0, '/root')
    from prompts import MEGA_PLAN_PROMPT, get_manim_prompt

    # Configuration
    TEMP = 0.3
    MAX_TOKENS = 16000
    job_id = job_id or str(uuid.uuid4())
    work_dir = Path(f"/outputs/{job_id}")
    work_dir.mkdir(parents=True, exist_ok=True)

    # Create log buffer to capture all logs for this job
    log_buffer = []

    def capture_log(message, level="info"):
        """Capture log message to console"""
        log_buffer.append(f"[{level.upper()}] {message}")
        print(f"[{level.upper()}] {message}")

    def update_job_progress(update_data):
        """Helper to yield SSE update (Supabase integration temporarily disabled)"""
        return update_data

    try:
        print(f"\n{'='*60}")
        print(f"🎬 Starting video generation")
        print(f"   Job ID: {job_id}")
        print(f"   Prompt: {prompt}")
        print(f"   Working directory: {work_dir}")
        print(f"{'='*60}\n")

        # Initialize LLM service
        sys.path.insert(0, '/root')
        from llm import AnthropicClaudeService, LLMMessage

        print("🔧 Initializing Claude Sonnet 4.5 service...")
        claude_service = AnthropicClaudeService(model="claude-sonnet-4-5-20250929")
        print("✓ Claude service initialized\n")

        # STAGE 1: Generate Mega Plan with Structured Output
        print(f"\n{'─'*60}")
        print("📋 STAGE 1: Generating Mega Plan")
        print(f"{'─'*60}")
        capture_log("Starting STAGE 1: Generating Mega Plan", level="info")

        yield update_job_progress({
            "status": "processing",
            "stage": 1,
            "stage_name": "Planning",
            "progress_percentage": 5,
            "message": "Generating video plan with scene breakdown...",
            "job_id": job_id
        })

        # Call Claude Sonnet for plan generation
        plan_prompt = f"{MEGA_PLAN_PROMPT}\n\nTopic: {prompt}"

        # Add image context if provided
        if image_context:
            plan_prompt += "\n\nIMPORTANT: An image has been provided as visual context. Reference this image when planning the video structure and visual approach. Use the image to inform what concepts to explain and how to visualize them."
            print(f"🖼️  Image context provided - will be included in plan generation")

        print(f"🤖 Calling Claude Sonnet for plan generation...")
        print(f"   Model: claude-sonnet-4-5-20250929")
        print(f"   Temperature: {TEMP}")
        print(f"   Max tokens: {MAX_TOKENS}")

        # Call with image if provided
        if image_context:
            # Use the LLM service's underlying client to send multimodal message
            from anthropic import Anthropic
            anthropic_client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY') or os.getenv('anthropic_key'))

            response = anthropic_client.messages.create(
                model="claude-sonnet-4-5-20250929",
                max_tokens=MAX_TOKENS,
                temperature=TEMP,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",  # Assume PNG, could be improved
                                "data": image_context
                            }
                        },
                        {
                            "type": "text",
                            "text": plan_prompt
                        }
                    ]
                }]
            )
            plan_response = response.content[0].text
        else:
            plan_response = claude_service.generate_simple(
                prompt=plan_prompt,
                max_tokens=MAX_TOKENS,
                temperature=TEMP
            )

        # Capture successful API call
        capture_log("Claude API call successful for plan generation", level="info")

        # Parse the JSON plan
        print("\n🔍 Parsing plan response...")
        plan_text = plan_response
        print(f"   Raw response preview: {plan_text[:200]}...")
        # Remove markdown code blocks if present
        if '```json' in plan_text:
            plan_text = plan_text.split('```json')[1].split('```')[0].strip()
        elif '```' in plan_text:
            plan_text = plan_text.split('```')[1].split('```')[0].strip()

        mega_plan = json.loads(plan_text)
        print(f"✓ Plan parsed successfully")

        video_structure = mega_plan.get('video_structure', [])
        capture_log(f"Plan generated successfully: {len(video_structure)} sections", level="info")

        # Extract video structure from mega plan
        video_structure = mega_plan.get('video_structure', [])
        if not video_structure:
            print("⚠️  No video_structure in plan, using default")
            video_structure = [{"section": "Main", "duration": "60 seconds", "content": mega_plan.get('description', '')}]

        print(f"\n📊 Plan Summary:")
        print(f"   Total sections: {len(video_structure)}")
        for idx, section in enumerate(video_structure, 1):
            print(f"   {idx}. {section['section']} ({section.get('duration', 'N/A')})")
        print()

        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 15,
            "message": f"Plan created with {len(video_structure)} sections",
            "job_id": job_id,
            "plan": mega_plan
        })

        # STAGE 2: Pipelined Code Generation + Rendering
        print(f"\n{'─'*60}")
        print("🎨 STAGE 2: Pipelined Code Generation → Rendering")
        print(f"{'─'*60}\n")
        capture_log("Starting STAGE 2: Code Generation and Rendering", level="info")

        yield update_job_progress({
            "status": "processing",
            "stage": 2,
            "stage_name": "Pipeline",
            "progress_percentage": 15,
            "message": f"Starting pipelined generation and rendering for {len(video_structure)} sections...",
            "job_id": job_id
        })

        # Track spawned render jobs
        import asyncio

        render_function_calls = []

        async def generate_code_async(section_info):
            """Generate code using async Anthropic API via llm.py service."""
            i, section = section_info
            section_num = i + 1

            try:
                print(f"\n{'━'*60}")
                print(f"📹 [Async {section_num}] Section {section_num}/{len(video_structure)}: {section['section']}")
                print(f"{'━'*60}")

                section_prompt = f"""{get_manim_prompt()}

Topic: {prompt}
Section: {section['section']} (Duration: {section['duration']})
Content: {section['content']}

Generate a SINGLE scene for this section only. The scene should be self-contained and match the duration specified."""

                # Add image context note if provided
                if image_context:
                    section_prompt += "\n\nNOTE: An image was provided as context for this video. When creating visual demonstrations, consider referencing elements or concepts visible in that image."

                print(f"🤖 [Async {section_num}] Calling Claude Sonnet for code generation (async)...")
                print(f"   Model: claude-sonnet-4-5-20250929")
                print(f"   Temperature: {TEMP}")
                print(f"   Max tokens: {MAX_TOKENS}")
                if image_context:
                    print(f"   🖼️  Using image context")

                # Async API call - with image if provided
                if image_context:
                    # Use direct Anthropic API for multimodal
                    from anthropic import AsyncAnthropic
                    async_anthropic = AsyncAnthropic(api_key=os.getenv('ANTHROPIC_API_KEY') or os.getenv('anthropic_key'))

                    response = await async_anthropic.messages.create(
                        model="claude-sonnet-4-5-20250929",
                        max_tokens=MAX_TOKENS,
                        temperature=TEMP,
                        messages=[{
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": image_context
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": section_prompt
                                }
                            ]
                        }]
                    )
                    manim_code = response.content[0].text
                else:
                    # Text-only API call using llm.py service - ALL happen in parallel!
                    manim_code = await claude_service.generate_simple_async(
                        prompt=section_prompt,
                        max_tokens=MAX_TOKENS,
                        temperature=TEMP
                    )

                print(f"\n🔍 [Async {section_num}] Extracting code from response...")
                print(f"   Raw response preview: {manim_code[:200]}...")
                if '```python' in manim_code:
                    manim_code = manim_code.split('```python')[1].split('```')[0].strip()
                elif '```' in manim_code:
                    manim_code = manim_code.split('```')[1].split('```')[0].strip()

                # Clean the code to remove problematic parameters
                sys.path.insert(0, '/root')
                from code_cleanup import clean_manim_code
                from manual_code_helpers import apply_all_manual_fixes

                manim_code = clean_manim_code(manim_code)
                manim_code = apply_all_manual_fixes(manim_code)
                print(f"✓ [Async {section_num}] Code cleaned and fixed")

                # IMMEDIATELY spawn render container (don't wait)
                print(f"🚀 [Async {section_num}] Spawning Modal container for rendering (including ElevenLabs audio)...")
                render_call = render_single_scene.spawn(section_num, manim_code, str(work_dir), job_id)
                render_function_calls.append((section_num, render_call))

                print(f"✓ [Async {section_num}] Render container spawned! Continuing to next section...")

                return (section_num, True, None)

            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()

                error_msg = f"Section {section_num} code generation failed: {type(e).__name__}: {e}"
                capture_log(error_msg, level="error")

                print(f"\n❌ [Async {section_num}] Code generation error: {type(e).__name__}: {e}")
                print(error_trace)
                return (section_num, None, None, str(e))

        async def generate_all_parallel():
            """Generate ALL codes in parallel using asyncio.gather."""
            print(f"🎯 Starting FULLY PARALLEL code generation for {len(video_structure)} sections...")
            tasks = [generate_code_async((i, section)) for i, section in enumerate(video_structure)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return results

        # Execute ALL code generation calls in parallel
        generation_results = asyncio.run(generate_all_parallel())

        successful_generations = len([r for r in generation_results if r[1]])
        print(f"\n✓ Code generation complete: {successful_generations} / {len(video_structure)} sections spawned renders")

        capture_log(f"Code generation complete: {successful_generations}/{len(video_structure)} sections succeeded", level="info")

        # Now wait for all render containers to complete (in parallel)
        print(f"\n{'─'*60}")
        print(f"⏳ Waiting for {len(render_function_calls)} render containers to complete...")
        print(f"   (Audio generation with ElevenLabs happening in parallel containers)")
        print(f"{'─'*60}\n")

        # Wait for ALL renders in parallel using asyncio
        async def wait_for_all_renders():
            """Wait for all render containers in parallel."""
            async def get_result(section_num, render_call):
                try:
                    # Modal's function_call.get() is blocking, so run in thread pool
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(render_call.get, 900)  # 15 min timeout
                        result = await asyncio.get_event_loop().run_in_executor(None, future.result)
                    print(f"✓ Section {section_num} render completed")
                    return result
                except Exception as e:
                    import traceback
                    error_trace = traceback.format_exc()

                    error_msg = f"Section {section_num} render failed: {e}"
                    capture_log(error_msg, level="error")

                    print(f"❌ Section {section_num} render failed: {e}")
                    return (section_num, None, str(e))

            tasks = [get_result(section_num, render_call) for section_num, render_call in render_function_calls]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return results

        render_results = asyncio.run(wait_for_all_renders())
        print(f"\n✓ All rendering containers completed")

        # Reload volume to see files written by render containers
        print(f"🔄 Reloading volume to access rendered videos...")
        output_volume.reload()
        print(f"✓ Volume reloaded")

        # Process results from Modal containers
        scene_videos = []
        for section_num, video_path, error in render_results:
            if video_path and not error:
                video_file = Path(video_path)
                if video_file.exists():
                    scene_videos.append((section_num, video_file))
                    print(f"✓ Section {section_num} video found: {video_file.name}")
                else:
                    print(f"⚠️  Section {section_num} video path returned but file doesn't exist: {video_path}")
            else:
                # Print full error (first 2000 chars for readability in Modal logs)
                error_preview = error[:2000] if len(error) > 2000 else error
                print(f"⚠️  Section {section_num} failed: {error_preview}")
                if len(error) > 2000:
                    print(f"   (Error truncated - {len(error)} total chars)")

        # Sort videos by section number
        scene_videos.sort(key=lambda x: x[0])
        scene_videos = [video for _, video in scene_videos]

        print(f"\n✓ Rendering complete: {len(scene_videos)} / {len(video_structure)} sections succeeded")

        capture_log(f"Rendering complete: {len(scene_videos)}/{len(video_structure)} sections succeeded", level="info")

        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 75,
            "message": f"Rendered {len(scene_videos)} sections successfully",
            "job_id": job_id
        })

        # STAGE 3: Concatenate all sections
        print(f"\n{'─'*60}")
        print("🔗 STAGE 3: Concatenating Videos")
        print(f"{'─'*60}")
        capture_log("Starting STAGE 3: Concatenating Videos", level="info")
        print(f"   Total sections to combine: {len(scene_videos)}")

        yield update_job_progress({
            "status": "processing",
            "stage": 3,
            "stage_name": "Concatenating",
            "progress_percentage": 80,
            "message": "Combining all sections...",
            "job_id": job_id
        })

        final_video = work_dir / f"{job_id}_final.mp4"

        if len(scene_videos) == 1:
            # Only one video, just rename it
            print(f"   Single video - no concatenation needed")
            scene_videos[0].rename(final_video)
            print(f"✓ Renamed to {final_video.name}")
        elif len(scene_videos) > 1:
            # Concatenate multiple videos
            print(f"   Creating concatenation list...")
            concat_file = work_dir / "concat_list.txt"
            with open(concat_file, 'w') as f:
                for video in scene_videos:
                    f.write(f"file '{video.absolute()}'\n")
                    print(f"     - {video.name}")

            try:
                print(f"   Running ffmpeg concatenation...")
                result = subprocess.run(
                    [
                        "ffmpeg",
                        "-f", "concat",
                        "-safe", "0",
                        "-i", str(concat_file),
                        "-c", "copy",
                        str(final_video)
                    ],
                    check=True,
                    capture_output=True,
                    text=True
                )
                final_size = final_video.stat().st_size / (1024 * 1024)
                print(f"✓ Concatenation complete")
                print(f"   Final video: {final_video.name} ({final_size:.2f} MB)")
            except subprocess.CalledProcessError as e:
                print(f"\n❌ Concatenation failed")
                print(f"   Return code: {e.returncode}")
                print(f"   stdout: {e.stdout}")
                print(f"   stderr: {e.stderr}")
                print(f"\n📄 Concat file contents:")
                with open(concat_file, 'r') as f:
                    print(f.read())
                print(f"\n📁 Work directory contents:")
                import os
                for item in os.listdir(work_dir):
                    item_path = work_dir / item
                    if item_path.is_file():
                        print(f"   {item} ({item_path.stat().st_size / (1024*1024):.2f} MB)")
                    else:
                        print(f"   {item}/ (directory)")
                raise
        else:
            error_msg = f"No videos were successfully rendered out of {len(render_results)} attempts"
            print(f"❌ {error_msg}")
            capture_log(error_msg, level="error")

            # Log details of each failed render
            for section_num, video_path, error in render_results:
                capture_log(f"Section {section_num} failed: {error}", level="error")

            fatal_exception = Exception("No videos were successfully rendered")
            print(f"📋 Complete failure log:")
            for section_num, video_path, error in render_results:
                print(f"   Section {section_num}: {error}")
            raise fatal_exception

        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 90,
            "message": "Video rendered successfully (upload disabled)",
            "job_id": job_id
        })

        # STAGE 4: Upload disabled (Supabase integration temporarily removed)
        print(f"\n{'─'*60}")
        print("✅ STAGE 4: Video Generation Complete")
        print(f"{'─'*60}")
        capture_log("Video generation completed (upload disabled)", level="info")

        print(f"   Video path: {final_video}")
        print(f"   Topic: {prompt}")
        print(f"   Job ID: {job_id}")
        print(f"   ⚠️  Upload to Supabase disabled - video saved locally only")

        final_size = final_video.stat().st_size / (1024 * 1024)
        print(f"\n{'='*60}")
        print(f"✅ VIDEO GENERATION COMPLETED SUCCESSFULLY")
        print(f"{'='*60}\n")
        print(f"   Final video: {final_video.name} ({final_size:.2f} MB)")

        yield update_job_progress({
            "status": "completed",
            "progress_percentage": 100,
            "message": "Video generation completed successfully!",
            "video_path": str(final_video),
            "job_id": job_id,
            "metadata": {
                "prompt": prompt,
                "file_size_mb": round(final_size, 2),
                "note": "Upload disabled - video saved locally"
            }
        })

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()

        # Log full error details
        full_logs = "\n".join(log_buffer)
        print(f"📋 Full error logs ({len(log_buffer)} entries):")
        print(full_logs[:5000])  # Print first 5000 chars of logs

        print(f"\n{'='*60}")
        print(f"❌ FATAL ERROR")
        print(f"{'='*60}")
        print(f"Error: {str(e)}")
        print(f"\nTraceback:")
        print(error_trace)
        print(f"{'='*60}\n")

        yield update_job_progress({
            "status": "failed",
            "error": f"Error: {str(e)}",
            "traceback": error_trace,
            "job_id": job_id
        })


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("anthropic-key"),
        modal.Secret.from_name("elevenlabs-key"),  # TTS provider
    ]
)
@modal.fastapi_endpoint(method="POST")
async def generate_video_api(item: dict):
    """
    FastAPI endpoint for video generation.

    Request body:
        {
            "topic": "Topic for the video (or 'prompt')",
            "job_id": "optional-job-id",
            "image_context": "optional base64-encoded image",
            "clerk_user_id": "optional clerk user id",
            "code_iterations": 1,
            "video_iterations": 1
        })

    Returns:
        StreamingResponse with Server-Sent Events
    """
    import json

    from fastapi.responses import StreamingResponse

    # Support both 'topic' and 'prompt' for backwards compatibility
    prompt = item.get("topic") or item.get("prompt")
    if not prompt:
        return {"success": False, "error": "Topic/prompt is required"}

    job_id = item.get("job_id")
    image_context = item.get("image_context")  # Base64 encoded image
    clerk_user_id = item.get("clerk_user_id")  # Clerk user ID for user association

    # Log what we received
    print(f"📥 Received API request:")
    print(f"   Topic: {prompt}")
    print(f"   Job ID: {job_id}")
    print(f"   Has image: {bool(image_context)}")
    print(f"   Clerk User ID: {clerk_user_id}")

    def event_stream():
        """Stream progress updates as SSE"""
        try:
            for update in generate_educational_video.remote_gen(
                prompt=prompt,
                job_id=job_id,
                image_context=image_context,
                clerk_user_id=clerk_user_id
            ):
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            error_update = {
                "status": "failed",
                "error": f"Streaming error: {str(e)}"
            }
            yield f"data: {json.dumps(error_update)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.local_entrypoint()
def main(prompt: str):
    """
    Local entrypoint for testing.

    Usage:
        modal run backend/modal/main_video_generator.py --prompt "Explain photosynthesis"
    """
    print(f"🎬 Starting educational video generation")
    print(f"   Prompt: {prompt}")
    print()

    for update in generate_educational_video.remote_gen(prompt=prompt):
        status = update.get("status")
        message = update.get("message", "")
        progress = update.get("progress_percentage", 0)
        stage_name = update.get("stage_name", "")
        video_url = update.get("video_url")
        error = update.get("error")

        if error:
            print(f"\n❌ Error: {error}")
            if "traceback" in update:
                print(update["traceback"])
            break

        if stage_name:
            print(f"\n[{stage_name}]")

        print(f"  [{progress:3d}%] {message}")

        if video_url:
            print(f"\n✅ Video completed!")
            print(f"   URL: {video_url}")

            metadata = update.get("metadata", {})
            if metadata:
                print(f"\n📊 Metadata:")
                for key, value in metadata.items():
                    print(f"   {key}: {value}")

    print("\n✅ Process completed!")
