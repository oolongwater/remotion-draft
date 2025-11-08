"""
Main video generation pipeline logic for dev environment
Pure Python logic without Modal decorators
Handles the complete workflow: planning, code generation, rendering, upload
"""

from typing import Any, Callable, Optional

from .config import (
    MAX_TOKENS,
    TEMP,
)


def generate_educational_video_logic(
    prompt: str,
    job_id: Optional[str] = None,
    image_context: Optional[str] = None,
    clerk_user_id: Optional[str] = None,
    render_single_scene_fn: Optional[Callable] = None
):
    """
    Generate a complete educational video from a prompt with optional image context.

    Args:
        prompt: Topic/description for the video
        job_id: Optional job ID for tracking
        image_context: Optional base64-encoded image to provide visual context
        clerk_user_id: Optional Clerk user ID to associate video with user account
        render_single_scene_fn: Modal function reference for rendering scenes

    Yields:
        Progress updates and final video URL
    """
    import json
    import os
    import subprocess
    import sys
    import uuid
    from pathlib import Path

    sys.path.insert(0, '/root')
    from services.prompts import MANIM_META_PROMPT, MEGA_PLAN_PROMPT

    # Configuration
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
        capture_log(f"Starting video generation - Job: {job_id}, Topic: {prompt}")

        # Initialize LLM service
        from services.llm import AnthropicClaudeService

        print("🔧 Initializing Claude Sonnet 4.5 service...")
        claude_service = AnthropicClaudeService(model="claude-sonnet-4-5-20250929")
        print("✓ Claude service initialized\n")
        capture_log("Claude Sonnet 4.5 service initialized")

        # STAGE 1: Generate Mega Plan with Structured Output
        print(f"\n{'─'*60}")
        print("📋 STAGE 1: Generating Mega Plan")
        print(f"{'─'*60}")
        capture_log("STAGE 1: Starting mega plan generation")

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
                                "media_type": "image/png",
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

                section_prompt = f"""{MANIM_META_PROMPT}

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
                from services.code_utils import apply_all_manual_fixes, clean_manim_code

                manim_code = clean_manim_code(manim_code)
                manim_code = apply_all_manual_fixes(manim_code)
                print(f"✓ [Async {section_num}] Code cleaned and fixed")

                # IMMEDIATELY spawn render container (don't wait)
                print(f"🚀 [Async {section_num}] Spawning Modal container for rendering (including ElevenLabs audio)...")
                render_call = render_single_scene_fn.spawn(section_num, manim_code, str(work_dir), job_id)
                render_function_calls.append((section_num, render_call))

                print(f"✓ [Async {section_num}] Render container spawned! Continuing to next section...")

                return (section_num, True, None)

            except Exception as e:
                print(f"\n❌ [Async {section_num}] Code generation error: {type(e).__name__}: {e}")
                import traceback
                print(traceback.format_exc())
                return (section_num, None, None, str(e))

        async def generate_all_parallel():
            """Generate ALL codes in parallel using asyncio.gather."""
            print(f"🎯 Starting FULLY PARALLEL code generation for {len(video_structure)} sections...")
            tasks = [generate_code_async((i, section)) for i, section in enumerate(video_structure)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return results

        # Execute ALL code generation calls in parallel
        generation_results = asyncio.run(generate_all_parallel())

        print(f"\n✓ Code generation complete: {len([r for r in generation_results if r[1]])} / {len(video_structure)} sections spawned renders")

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
                    print(f"❌ Section {section_num} render failed: {e}")
                    return (section_num, None, str(e))

            tasks = [get_result(section_num, render_call) for section_num, render_call in render_function_calls]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return results

        render_results = asyncio.run(wait_for_all_renders())
        print(f"\n✓ All rendering containers completed")

        # Reload volume to see files written by render containers
        print(f"🔄 Reloading volume to access rendered videos...")
        from modal import Volume
        output_volume = Volume.from_name("video-outputs-main-dev")
        output_volume.reload()
        print(f"✓ Volume reloaded")

        # Process results from Modal containers
        scene_videos = []
        successful_sections = []
        for section_num, video_path, error in render_results:
            if video_path and not error:
                video_file = Path(video_path)
                if video_file.exists():
                    scene_videos.append((section_num, video_file))
                    successful_sections.append(section_num)
                    print(f"✓ Section {section_num} video found: {video_file.name}")
                else:
                    print(f"⚠️  Section {section_num} video path returned but file doesn't exist: {video_path}")
            else:
                print(f"⚠️  Section {section_num} failed: {error}")

        # Sort videos by section number
        scene_videos.sort(key=lambda x: x[0])
        scene_videos = [video for _, video in scene_videos]
        
        # Build list of section URLs (sections are uploaded to GCS at {job_id}/section_{num}.mp4)
        section_urls = []
        for section_num in sorted(successful_sections):
            section_url = f"https://storage.googleapis.com/vid-gen-static/{job_id}/section_{section_num}.mp4"
            section_urls.append(section_url)

        print(f"\n✓ Rendering complete: {len(scene_videos)} / {len(video_structure)} sections succeeded")

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
            
            # Upload final video to GCS
            try:
                from services.gcs_storage import upload_final_video
                upload_result = upload_final_video(str(final_video), job_id)
                if upload_result and upload_result.get("success"):
                    print(f"✓ Final video uploaded to GCS: {upload_result.get('public_url')}")
                else:
                    print(f"⚠️  GCS upload failed: {upload_result.get('error', 'Unknown error') if upload_result else 'No result'}")
            except Exception as e:
                print(f"⚠️  GCS upload error (non-fatal): {type(e).__name__}: {e}")
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
                
                # Upload final video to GCS
                try:
                    from services.gcs_storage import upload_final_video
                    upload_result = upload_final_video(str(final_video), job_id)
                    if upload_result and upload_result.get("success"):
                        print(f"✓ Final video uploaded to GCS: {upload_result.get('public_url')}")
                    else:
                        print(f"⚠️  GCS upload failed: {upload_result.get('error', 'Unknown error') if upload_result else 'No result'}")
                except Exception as e:
                    print(f"⚠️  GCS upload error (non-fatal): {type(e).__name__}: {e}")
            except subprocess.CalledProcessError as e:
                print(f"\n❌ Concatenation failed")
                print(f"   Return code: {e.returncode}")
                print(f"   stdout: {e.stdout}")
                print(f"   stderr: {e.stderr}")
                print(f"\n📄 Concat file contents:")
                with open(concat_file, 'r') as f:
                    print(f.read())
                print(f"\n📁 Work directory contents:")
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
            raise Exception("No videos were successfully rendered")

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
            "sections": section_urls,  # List of section video URLs
            "metadata": {
                "prompt": prompt,
                "file_size_mb": round(final_size, 2),
                "note": "Upload disabled - video saved locally",
                "num_sections": len(section_urls)
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
