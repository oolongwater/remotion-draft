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
    job_id: str
) -> Tuple[int, str, str]:
    """
    Render a single Manim scene in its own container.

    Args:
        section_num: Section number (1-indexed)
        manim_code: Python code for the Manim scene
        work_dir_path: Path to working directory
        job_id: Unique job identifier

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
    manim_code = clean_manim_code(manim_code)
    manim_code = apply_all_manual_fixes(manim_code)

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

                repair_prompt = f"""The following Manim code failed to render. Please fix the code.

ORIGINAL CODE:
```python
{current_code}
```

ERROR OUTPUT (stdout):
{result.stdout[:2000]}

ERROR OUTPUT (stderr):
{result.stderr[:2000]}

Return ONLY the fixed Python code with ElevenLabsService(voice_id="pqHfZKP75CvOlQylNhV4", transcription_model=None)."""

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

            # Upload to GCS
            try:
                from services.gcs_storage import upload_scene_video
                upload_result = upload_scene_video(str(section_video), job_id, section_num)
                if upload_result and upload_result.get("success"):
                    print(f"✓ [Container {section_num}] Scene video uploaded to GCS: {upload_result.get('public_url')}")
                else:
                    print(f"⚠️  [Container {section_num}] GCS upload failed: {upload_result.get('error', 'Unknown error') if upload_result else 'No result'}")
            except Exception as e:
                print(f"⚠️  [Container {section_num}] GCS upload error (non-fatal): {type(e).__name__}: {e}")

            # Commit volume changes so main function can access the file
            from modal import Volume
            volume = Volume.from_name("video-outputs-main-dev")
            volume.commit()
            print(f"✓ [Container {section_num}] Volume changes committed")

            return (section_num, str(section_video), None)

        except subprocess.TimeoutExpired:
            if attempt < MAX_RENDER_ATTEMPTS - 1:
                print(f"⚠️  [Container {section_num}] Timeout, attempting repair...")
                # Similar repair logic for timeout
                continue
            else:
                return (section_num, None, "Timeout after repair attempt")
        except Exception as e:
            print(f"❌ [Container {section_num}] Error: {type(e).__name__}: {e}")
            return (section_num, None, str(e))

    return (section_num, None, "Failed after all attempts")
