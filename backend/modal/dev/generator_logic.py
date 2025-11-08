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

        # Initialize LLM services
        from services.llm import create_llm_service

        # Cerebras Qwen-3 for plan generation (STAGE 1)
        plan_provider = "cerebras"
        plan_model = "qwen-3-235b-a22b-instruct-2507"

        print(f"🔧 Initializing {plan_provider} {plan_model} service for plan generation...")
        plan_llm_service = create_llm_service(provider=plan_provider, model=plan_model)
        print(f"✓ {plan_provider} {plan_model} service initialized\n")
        capture_log(f"{plan_provider} {plan_model} service initialized for plan generation")

        # Anthropic Sonnet 4.5 for code generation (STAGE 2)
        code_provider = "anthropic"
        code_model = "claude-sonnet-4-5-20250929"

        print(f"🔧 Initializing {code_provider} {code_model} service for code generation...")
        code_llm_service = create_llm_service(provider=code_provider, model=code_model)
        print(f"✓ {code_provider} {code_model} service initialized\n")
        capture_log(f"{code_provider} {code_model} service initialized for code generation")

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

        # Call Cerebras for plan generation
        plan_prompt = f"{MEGA_PLAN_PROMPT}\n\nTopic: {prompt}"

        # Add image context if provided
        if image_context:
            plan_prompt += "\n\nIMPORTANT: An image has been provided as visual context. Reference this image when planning the video structure and visual approach. Use the image to inform what concepts to explain and how to visualize them."
            print(f"🖼️  Image context provided - will be included in plan generation")
            print(f"⚠️  Note: Cerebras may not support multimodal images. Image context will be described in text.")

        print(f"🤖 Calling {plan_provider} {plan_model} for plan generation...")
        print(f"   Model: {plan_model}")
        print(f"   Temperature: {TEMP}")
        print(f"   Max tokens: {MAX_TOKENS}")

        # Note: Cerebras may not support multimodal images like Anthropic
        # For now, we'll use text-only generation even when image_context is provided
        plan_response = plan_llm_service.generate_simple(
            prompt=plan_prompt,
            max_tokens=MAX_TOKENS,
            temperature=TEMP
        )

        # Parse the JSON plan
        print("\n🔍 Parsing plan response...")
        plan_text = plan_response
        print(f"   Raw response type: {type(plan_text)}")
        print(f"   Raw response length: {len(plan_text) if plan_text else 0}")
        print(f"   Raw response preview (first 500 chars): {plan_text[:500] if plan_text else 'None'}...")
        print(f"   Raw response preview (last 500 chars): ...{plan_text[-500:] if plan_text and len(plan_text) > 500 else plan_text}")
        
        original_plan_text = plan_text
        
        # Handle Cerebras thinking model responses that include reasoning
        # Look for </think> marker or similar
        if '</think>' in plan_text:
            print(f"   Found </think> marker, extracting JSON after reasoning...")
            plan_text = plan_text.split('</think>')[-1].strip()
            print(f"   Extracted text length after reasoning: {len(plan_text)}")
            print(f"   Extracted text preview: {plan_text[:300]}...")
        
        # Debug: Check for markdown code blocks
        has_json_block = '```json' in plan_text
        has_code_block = '```' in plan_text
        print(f"   Contains ```json block: {has_json_block}")
        print(f"   Contains ``` block: {has_code_block}")
        
        # Remove markdown code blocks if present
        if '```json' in plan_text:
            print(f"   Extracting JSON from ```json block...")
            plan_text = plan_text.split('```json')[1].split('```')[0].strip()
            print(f"   Extracted text length: {len(plan_text)}")
            print(f"   Extracted text preview: {plan_text[:300]}...")
        elif '```' in plan_text:
            print(f"   Extracting JSON from ``` block...")
            plan_text = plan_text.split('```')[1].split('```')[0].strip()
            print(f"   Extracted text length: {len(plan_text)}")
            print(f"   Extracted text preview: {plan_text[:300]}...")
        
        # Try to find JSON object in the text (look for first { and last })
        # This handles cases where there's text before/after the JSON
        if not plan_text.strip().startswith('{'):
            print(f"   Text doesn't start with {{, searching for JSON object...")
            # Find first {
            first_brace = plan_text.find('{')
            if first_brace != -1:
                # Find matching closing brace
                brace_count = 0
                last_brace = -1
                for i in range(first_brace, len(plan_text)):
                    if plan_text[i] == '{':
                        brace_count += 1
                    elif plan_text[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_brace = i
                            break
                
                if last_brace != -1:
                    plan_text = plan_text[first_brace:last_brace + 1]
                    print(f"   Extracted JSON object (from char {first_brace} to {last_brace + 1})")
                    print(f"   Extracted text length: {len(plan_text)}")
                    print(f"   Extracted text preview: {plan_text[:300]}...")
                else:
                    print(f"   ⚠️  Found opening {{ but couldn't find matching }}")

        # Debug: Try to find JSON-like content
        print(f"\n🔍 [DEBUG] Attempting JSON parse...")
        print(f"   Text to parse length: {len(plan_text)}")
        print(f"   Text to parse (first 500 chars): {plan_text[:500]}")
        print(f"   Text to parse (last 500 chars): {plan_text[-500:] if len(plan_text) > 500 else plan_text}")
        
        try:
            mega_plan = json.loads(plan_text)
            print(f"✓ Plan parsed successfully")
            print(f"   Parsed keys: {list(mega_plan.keys()) if isinstance(mega_plan, dict) else 'Not a dict'}")
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON parsing failed!")
            print(f"   Error: {e}")
            print(f"   Error position: line {e.lineno}, column {e.colno}")
            print(f"   Error message: {e.msg}")
            print(f"\n📋 Full response that failed to parse:")
            print(f"{'='*80}")
            print(plan_text)
            print(f"{'='*80}")
            print(f"\n📋 Original response (before extraction):")
            print(f"{'='*80}")
            print(original_plan_text[:2000])
            print(f"{'='*80}")
            raise

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

                print(f"🤖 [Async {section_num}] Calling {code_provider} {code_model} for code generation (async)...")
                print(f"   Model: {code_model}")
                print(f"   Temperature: {TEMP}")
                print(f"   Max tokens: {MAX_TOKENS}")
                if image_context:
                    print(f"   🖼️  Image context provided (will be described in text)")
                    print(f"   ⚠️  Note: Cerebras may not support multimodal images")

                # Note: Cerebras may not support multimodal images like Anthropic
                # For now, we'll use text-only generation even when image_context is provided
                # Text-only API call using llm service - ALL happen in parallel!
                manim_code = await code_llm_service.generate_simple_async(
                    prompt=section_prompt,
                    max_tokens=MAX_TOKENS,
                    temperature=TEMP
                )

                print(f"\n🔍 [Async {section_num}] Extracting code from response...")
                print(f"   Raw response type: {type(manim_code)}")
                print(f"   Raw response length: {len(manim_code) if manim_code else 0}")
                print(f"   Raw response preview (first 500 chars): {manim_code[:500] if manim_code else 'None'}...")
                
                # Debug: Check for code blocks
                has_python_block = '```python' in manim_code
                has_code_block = '```' in manim_code
                print(f"   Contains ```python block: {has_python_block}")
                print(f"   Contains ``` block: {has_code_block}")
                
                original_code = manim_code
                if '```python' in manim_code:
                    print(f"   Extracting code from ```python block...")
                    manim_code = manim_code.split('```python')[1].split('```')[0].strip()
                    print(f"   Extracted code length: {len(manim_code)}")
                elif '```' in manim_code:
                    print(f"   Extracting code from ``` block...")
                    manim_code = manim_code.split('```')[1].split('```')[0].strip()
                    print(f"   Extracted code length: {len(manim_code)}")
                else:
                    print(f"   No code blocks found, using raw response")

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
