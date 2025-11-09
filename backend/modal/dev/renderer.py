"""
Scene rendering logic for dev environment
Handles individual scene rendering with automatic code repair
"""

from typing import Tuple

from .config import MAX_RENDER_ATTEMPTS, RENDER_TIMEOUT


def render_single_scene_logic(
    section_num: int,
    manim_code: str,
    work_dir_path: str,
    job_id: str,
    voice_id: str = None
) -> Tuple[int, str, str]:
    """
    Render a single Manim scene in its own container.

    Args:
        section_num: Section number (1-indexed)
        manim_code: Python code for the Manim scene
        work_dir_path: Path to working directory
        job_id: Unique job identifier
        voice_id: Optional voice ID for TTS. Defaults to male voice if not provided.

    Returns:
        Tuple of (section_num, video_path, error_message)
    """
    import subprocess
    import sys
    from pathlib import Path

    sys.path.insert(0, '/root')
    from services.code_utils import apply_all_manual_fixes, clean_manim_code
    from services.llm import AnthropicClaudeService

    work_dir = Path(work_dir_path)
    work_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'━'*60}")
    print(f"📹 [Container {section_num}] Rendering Section {section_num}")
    print(f"{'━'*60}")

    # Apply code cleanup
    manim_code = clean_manim_code(manim_code, voice_id)
    manim_code = apply_all_manual_fixes(manim_code, voice_id)

    # Save code
    code_file = work_dir / f"section_{section_num}.py"
    code_file.write_text(manim_code)
    print(f"✓ [Container {section_num}] Code saved to {code_file.name}")

    # Try rendering up to MAX_RENDER_ATTEMPTS times
    current_code = manim_code
    current_file = code_file

    for attempt in range(MAX_RENDER_ATTEMPTS):
        try:
            # Find scene class name
            scene_class = "ExplainerScene"
            for line in current_code.split('\n'):
                if 'class ' in line and ('(VoiceoverScene)' in line or '(Scene)' in line):
                    scene_class = line.split('class ')[1].split('(')[0].strip()
                    break

            if attempt == 0:
                print(f"🎬 [Container {section_num}] Starting Manim Rendering (Attempt {attempt + 1}/{MAX_RENDER_ATTEMPTS})...")
            else:
                print(f"🔧 [Container {section_num}] Retrying with repaired code (Attempt {attempt + 1}/{MAX_RENDER_ATTEMPTS})...")

            print(f"   Scene class: {scene_class}")
            print("   Quality: 480p15 (low)")
            print(f"   File: {current_file.name}")

            # Ensure ELEVEN_API_KEY is set for manim_voiceover (it expects this exact name)
            import os
            env = os.environ.copy()
            # Check multiple possible environment variable names from Modal secrets
            elevenlabs_key = (
                env.get('ELEVEN_API_KEY') or
                env.get('ELEVENLABS_API_KEY') or
                env.get('elevenlabs_key') or
                env.get('ELEVENLABS_KEY')
            )
            
            if elevenlabs_key:
                env['ELEVEN_API_KEY'] = elevenlabs_key
                print("   🔑 ELEVEN_API_KEY found and set")
                
                # Create .env file in working directory to prevent interactive prompts
                env_file = work_dir / ".env"
                if not env_file.exists():
                    env_file.write_text(f'ELEVEN_API_KEY="{elevenlabs_key}"\n')
                    print("   📝 Created .env file to prevent interactive prompts")
            else:
                print("   ⚠️  Warning: ELEVEN_API_KEY not found in environment")
                eleven_vars = [k for k in env.keys() if 'eleven' in k.lower()]
                print(f"   Available env vars with 'eleven' or 'ELEVEN': {eleven_vars}")

            result = subprocess.run(
                [
                    "manim",
                    "-ql",  # Low quality without preview overhead
                    "--format", "mp4",
                    "--frame_rate", "12",
                    "--media_dir", str(work_dir),
                    str(current_file),
                    scene_class
                ],
                capture_output=True,
                text=True,
                timeout=RENDER_TIMEOUT,
                env=env,  # Pass environment with ELEVEN_API_KEY set
                cwd=str(work_dir)  # Run from work_dir so .env file is found
            )
            print(f"✓ [Container {section_num}] Manim render completed (exit code: {result.returncode})")

            # Print stdout/stderr for debugging if exit code is non-zero
            if result.returncode != 0:
                print("   ⚠️  Non-zero exit code detected")
                
                # Detect specific error types
                error_summary = []
                if result.stderr:
                    stderr_lower = result.stderr.lower()
                    if 'eoferror' in stderr_lower or 'eof when reading a line' in stderr_lower:
                        if 'recorderservice' in stderr_lower or 'recorder' in stderr_lower:
                            error_summary.append("EOFError: RecorderService requires additional packages and causes interactive prompts. Use ElevenLabsService instead.")
                        else:
                            error_summary.append("EOFError: Interactive prompt failed (likely transcription package issue)")
                    if 'importerror' in stderr_lower and 'create_voiceover_tracker' in stderr_lower:
                        error_summary.append("ImportError: create_voiceover_tracker doesn't exist in manim_voiceover (incorrect API usage)")
                    if 'importerror' in stderr_lower and 'manim_voiceover.services.tts' in stderr_lower:
                        error_summary.append("ImportError: PreGeneratedAudioService should be imported from services.tts.pregenerated, NOT manim_voiceover.services.tts")
                    if 'typeerror' in stderr_lower and 'vgroup' in stderr_lower and 'vmobject' in stderr_lower:
                        error_summary.append("TypeError: VGroup can only contain VMobject types. Use Group() for mixed types or non-VMobjects")
                    if 'typeerror' in stderr_lower and 'abstract class' in stderr_lower and 'pregeneratedaudioservice' in stderr_lower:
                        error_summary.append("TypeError: PreGeneratedAudioService missing abstract method. This is a code issue - PreGeneratedAudioService should have generate_from_text method.")
                    if 'filenotfounderror' in stderr_lower and 'pre-generated audio file' in stderr_lower:
                        error_summary.append("FileNotFoundError: Pre-generated audio file not found. PreGeneratedAudioService will fall back to ElevenLabsService if fallback_to_elevenlabs=True.")
                    if 'nameerror' in stderr_lower:
                        # Extract the undefined name
                        name_match = __import__('re').search(r"name '(\w+)' is not defined", result.stderr)
                        if name_match:
                            error_summary.append(f"NameError: '{name_match.group(1)}' is not defined")
                    if 'attributeerror' in stderr_lower:
                        # Extract the attribute error
                        attr_match = __import__('re').search(r"has no attribute '(\w+)'", result.stderr)
                        if attr_match:
                            error_summary.append(f"AttributeError: Missing attribute '{attr_match.group(1)}'")
                    if 'tts_init' in stderr_lower or '{tts_init}' in current_code:
                        error_summary.append("Code generation issue: Placeholder '{tts_init}' not replaced")
                
                if error_summary:
                    print("   🔍 Detected errors:")
                    for err in error_summary:
                        print(f"      - {err}")
                
                if result.stdout:
                    stdout_preview = result.stdout[-1000:] if len(result.stdout) > 1000 else result.stdout
                    print(f"   📋 stdout (last 1000 chars):\n{stdout_preview}")
                if result.stderr:
                    stderr_preview = result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr
                    print(f"   📋 stderr (last 1000 chars):\n{stderr_preview}")

            if result.stdout:
                audio_lines = [line for line in result.stdout.split('\n') if 'elevenlabs' in line.lower() or 'audio' in line.lower()]
                if audio_lines:
                    print("   🎤 Audio generation detected")

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
            # Prioritize video file existence over exit code (Manim can return non-zero on warnings)
            render_failed = not rendered_video or not rendered_video.exists()
            
            # Only treat non-zero exit code as failure if video doesn't exist
            if render_failed and result.returncode != 0:
                print("   📋 Render failure details:")
                print(f"      Exit code: {result.returncode}")
                print(f"      Checked directories: {checked_dirs}")

            if render_failed and attempt < MAX_RENDER_ATTEMPTS - 1:
                # Attempt code repair
                print(f"🔧 [Container {section_num}] Render failed, attempting code repair...")

                claude_service = AnthropicClaudeService(model="claude-sonnet-4-5-20250929")

                # Build enhanced repair prompt with error analysis
                error_analysis = ""
                if result.stderr:
                    stderr_lower = result.stderr.lower()
                    # Use selected voice_id or default
                    selected_voice_id = voice_id or "pqHfZKP75CvOlQylNhV4"
                    
                    if 'eoferror' in stderr_lower:
                        if 'recorderservice' in stderr_lower or 'recorder' in stderr_lower:
                            error_analysis += f"\n\nCRITICAL: EOFError - RecorderService requires additional packages and causes interactive prompts. Replace RecorderService with ElevenLabsService(voice_id=\"{selected_voice_id}\", transcription_model=None)."
                        else:
                            error_analysis += "\n\nCRITICAL: EOFError detected. This happens when manim-voiceover tries to prompt for missing packages. Ensure transcription_model=None is set and never call set_transcription()."
                    if 'importerror' in stderr_lower and 'create_voiceover_tracker' in stderr_lower:
                        error_analysis += f"\n\nCRITICAL: ImportError - create_voiceover_tracker doesn't exist in manim_voiceover. For pre-generated audio, use PreGeneratedAudioService from services.tts.pregenerated instead. Use VoiceoverScene with self.set_speech_service(PreGeneratedAudioService(audio_file_path=path, voice_id=\"{selected_voice_id}\"))."
                    if 'importerror' in stderr_lower and 'manim_voiceover.services.tts' in stderr_lower:
                        error_analysis += "\n\nCRITICAL: ImportError - PreGeneratedAudioService must be imported from services.tts.pregenerated, NOT from manim_voiceover.services.tts. Fix: from services.tts.pregenerated import PreGeneratedAudioService"
                    if 'typeerror' in stderr_lower and 'vgroup' in stderr_lower and 'vmobject' in stderr_lower:
                        error_analysis += "\n\nCRITICAL: TypeError - VGroup can only contain VMobject types. Replace VGroup() with Group() when adding non-VMobject types (like Sphere, Cube, Prism, or base Mobject instances)."
                    if 'typeerror' in stderr_lower and 'abstract class' in stderr_lower and 'pregeneratedaudioservice' in stderr_lower:
                        error_analysis += "\n\nCRITICAL: TypeError - PreGeneratedAudioService is missing abstract method generate_from_text. This should not happen - the service implementation needs to be fixed. As a workaround, use ElevenLabsService instead of PreGeneratedAudioService."
                    if 'filenotfounderror' in stderr_lower and 'pre-generated audio file' in stderr_lower:
                        error_analysis += "\n\nCRITICAL: FileNotFoundError - Pre-generated audio file not found. Ensure PreGeneratedAudioService is initialized with fallback_to_elevenlabs=True, or use ElevenLabsService directly if audio file doesn't exist."
                    if 'nameerror' in stderr_lower:
                        name_match = __import__('re').search(r"name '(\w+)' is not defined", result.stderr)
                        if name_match:
                            undefined_name = name_match.group(1)
                            error_analysis += f"\n\nCRITICAL: NameError - '{undefined_name}' is not defined. Check for placeholders like {{tts_init}} or {{variable_name}} that weren't replaced. Remove or replace all placeholders."
                    if 'attributeerror' in stderr_lower:
                        attr_match = __import__('re').search(r"has no attribute '(\w+)'", result.stderr)
                        if attr_match:
                            missing_attr = attr_match.group(1)
                            error_analysis += f"\n\nCRITICAL: AttributeError - Missing attribute '{missing_attr}'. Remove calls to non-existent methods/attributes."
                    if 'tts_init' in stderr_lower or '{tts_init}' in current_code:
                        error_analysis += f"\n\nCRITICAL: Found placeholder '{{tts_init}}' in code. Replace with actual ElevenLabsService initialization: ElevenLabsService(voice_id=\"{selected_voice_id}\", transcription_model=None)"
                
                repair_prompt = f"""The following Manim code failed to render. Please fix ALL errors.

ORIGINAL CODE:
```python
{current_code}
```

ERROR OUTPUT (stdout):
{result.stdout[:2000]}

ERROR OUTPUT (stderr):
{result.stderr[:2000]}
{error_analysis}

REQUIREMENTS:
1. Use ElevenLabsService(voice_id="{selected_voice_id}", transcription_model=None) - NEVER use transcription_model or set_transcription()
2. For pre-generated audio, use PreGeneratedAudioService from services.tts.pregenerated (NOT from manim_voiceover.services.tts)
3. NEVER import create_voiceover_tracker - it doesn't exist in manim_voiceover
4. NEVER use RecorderService - it causes EOFError prompts. Use ElevenLabsService instead.
5. Replace VGroup() with Group() when mixing VMobject and non-VMobject types
6. Remove ALL placeholders like {{tts_init}}, {{variable_name}}, etc.
7. Remove calls to non-existent methods like check_overlap(), bounding_box, etc.
8. Ensure all classes inherit from VoiceoverScene, not Scene
9. Do NOT call set_transcription() anywhere

Return ONLY the fixed Python code."""

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
                repaired_code = clean_manim_code(repaired_code, voice_id)
                repaired_code = apply_all_manual_fixes(repaired_code, voice_id)

                current_file = work_dir / f"section_{section_num}_repaired.py"
                current_file.write_text(repaired_code)
                current_code = repaired_code
                print(f"✓ [Container {section_num}] Repaired code saved")
                continue

            if render_failed:
                print(f"❌ [Container {section_num}] Render failed after {MAX_RENDER_ATTEMPTS} attempts")
                error_details = []
                if result.returncode != 0:
                    error_details.append(f"Exit code: {result.returncode}")
                if checked_dirs:
                    error_details.append(f"Checked directories: {checked_dirs}")
                if result.stderr:
                    error_details.append(f"stderr: {result.stderr[:1000]}")
                if result.stdout and result.returncode != 0:
                    error_details.append(f"stdout: {result.stdout[-1000:]}")
                error_msg = "Render failed. " + " | ".join(error_details)
                return (section_num, None, error_msg)

            # Success - move video to final location
            section_video = work_dir / f"section_{section_num}.mp4"
            rendered_video.rename(section_video)
            file_size = section_video.stat().st_size / (1024 * 1024)
            print(f"✓ [Container {section_num}] Video rendered successfully ({file_size:.2f} MB)")

            # Generate thumbnail (midpoint frame for better representation)
            thumbnail_path = None
            try:
                print(f"🖼️  [Container {section_num}] Generating thumbnail (midpoint frame)...")
                thumbnail_file = work_dir / f"section_{section_num}_thumbnail.png"
                
                # First, get video duration to find midpoint
                try:
                    duration_result = subprocess.run(
                        [
                            "ffprobe",
                            "-v", "error",
                            "-show_entries", "format=duration",
                            "-of", "default=noprint_wrappers=1:nokey=1",
                            str(section_video)
                        ],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    
                    if duration_result.returncode == 0 and duration_result.stdout.strip():
                        duration = float(duration_result.stdout.strip())
                        midpoint = duration / 2.0
                        print(f"   Video duration: {duration:.2f}s, seeking to midpoint: {midpoint:.2f}s")
                    else:
                        # Fallback to frame 60 if duration detection fails
                        midpoint = 5.0  # ~5 seconds in (frame 60 at 12fps)
                        print(f"   Could not detect duration, using fallback: {midpoint:.2f}s")
                except Exception as e:
                    # Fallback to frame 60 if ffprobe fails
                    midpoint = 5.0
                    print(f"   Duration detection failed, using fallback: {midpoint:.2f}s")
                
                # Extract frame at midpoint
                thumbnail_result = subprocess.run(
                    [
                        "ffmpeg",
                        "-ss", str(midpoint),  # Seek to midpoint
                        "-i", str(section_video),
                        "-vframes", "1",  # Extract one frame
                        "-q:v", "2",      # High quality
                        str(thumbnail_file)
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if thumbnail_result.returncode == 0 and thumbnail_file.exists():
                    thumbnail_size = thumbnail_file.stat().st_size / 1024  # KB
                    print(f"✓ [Container {section_num}] Thumbnail generated ({thumbnail_size:.2f} KB)")
                    thumbnail_path = thumbnail_file
                else:
                    print(f"⚠️  [Container {section_num}] Thumbnail generation failed (exit code: {thumbnail_result.returncode})")
                    if thumbnail_result.stderr:
                        print(f"   stderr: {thumbnail_result.stderr[:500]}")
            except Exception as e:
                print(f"⚠️  [Container {section_num}] Thumbnail generation error (non-fatal): {type(e).__name__}: {e}")

            # Upload to GCS (individual sections needed by user)
            gcs_upload_success = False
            try:
                from services.gcs_storage import (
                    upload_scene_thumbnail,
                    upload_scene_video,
                )
                upload_result = upload_scene_video(str(section_video), job_id, section_num)
                if upload_result and upload_result.get("success"):
                    gcs_upload_success = True
                    print(f"✓ [Container {section_num}] Scene video uploaded to GCS: {upload_result.get('public_url')}")
                else:
                    print(f"⚠️  [Container {section_num}] GCS upload failed: {upload_result.get('error', 'Unknown error') if upload_result else 'No result'}")
                
                # Upload thumbnail if it was generated
                if thumbnail_path and thumbnail_path.exists():
                    thumbnail_upload_result = upload_scene_thumbnail(str(thumbnail_path), job_id, section_num)
                    if thumbnail_upload_result and thumbnail_upload_result.get("success"):
                        print(f"✓ [Container {section_num}] Thumbnail uploaded to GCS: {thumbnail_upload_result.get('public_url')}")
                    else:
                        print(f"⚠️  [Container {section_num}] Thumbnail upload failed: {thumbnail_upload_result.get('error', 'Unknown error') if thumbnail_upload_result else 'No result'}")
            except Exception as e:
                print(f"⚠️  [Container {section_num}] GCS upload error (non-fatal): {type(e).__name__}: {e}")

            # OPTIMIZATION: Skip individual volume commits (saves 5-10 seconds total)
            # Single volume reload in main function is sufficient
            print(f"✓ [Container {section_num}] Skipping volume commit (optimization enabled)")

            # Return section_num, video_path, error_message, gcs_upload_success
            return (section_num, str(section_video), None, gcs_upload_success)

        except subprocess.TimeoutExpired:
            if attempt < MAX_RENDER_ATTEMPTS - 1:
                print(f"⚠️  [Container {section_num}] Timeout, attempting repair...")
                # Similar repair logic for timeout
                continue
            else:
                return (section_num, None, "Timeout after repair attempt", False)
        except Exception as e:
            print(f"❌ [Container {section_num}] Error: {type(e).__name__}: {e}")
            return (section_num, None, str(e), False)

    return (section_num, None, "Failed after all attempts", False)
