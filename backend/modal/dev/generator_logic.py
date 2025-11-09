"""
Main video generation pipeline logic for dev environment
Pure Python logic without Modal decorators
Handles the complete workflow: planning, code generation, rendering, upload
"""

import ast
import re
from typing import Any, Callable, Dict, Optional

from .config import (
    MAX_TOKENS,
    TEMP,
)

VOICEOVER_PATTERN = re.compile(
    r'self\.voiceover\(\s*(?:text\s*=\s*)?(?P<prefix>[fFbBrRuU]{0,2})(?P<quote>"""|\'\'\'|"|\')(?P<text>.*?)(?P=quote)',
    re.DOTALL,
)


def extract_voiceover_script(manim_code: str) -> str:
    """
    Extract concatenated narration text from self.voiceover(...) calls within the Manim code.
    Returns a single string combining all detected voiceover snippets in chronological order.
    """
    if not manim_code:
        return ""

    narration_segments = []

    for match in VOICEOVER_PATTERN.finditer(manim_code):
        prefix = (match.group("prefix") or "").lower()
        quote = match.group("quote")
        text = match.group("text")

        # Reconstruct the original literal for safer parsing
        literal = f"{prefix}{quote}{text}{quote}"

        parsed_text = text
        # Only attempt literal evaluation when not dealing with f-strings
        if "f" not in prefix:
            try:
                parsed_text = ast.literal_eval(literal)
            except Exception:
                parsed_text = text

        # Normalize whitespace and append
        if isinstance(parsed_text, str):
            cleaned = " ".join(parsed_text.split())
            if cleaned:
                narration_segments.append(cleaned)

    return " ".join(narration_segments)


def generate_educational_video_logic(
    prompt: str,
    job_id: Optional[str] = None,
    image_context: Optional[str] = None,
    clerk_user_id: Optional[str] = None,
    render_single_scene_fn: Optional[Callable] = None,
    mode: str = "deep",
    voice_id: Optional[str] = None
):
    """
    Generate a complete educational video from a prompt with optional image context.

    Args:
        prompt: Topic/description for the video
        job_id: Optional job ID for tracking
        image_context: Optional base64-encoded image to provide visual context
        clerk_user_id: Optional Clerk user ID to associate video with user account
        render_single_scene_fn: Modal function reference for rendering scenes
        mode: Generation mode - "deep" (slower, higher quality) or "fast" (faster, good quality)
              - deep: Uses Anthropic Claude Sonnet 4.5 for code generation
              - fast: Uses Cerebras Qwen 3 for code generation
        voice_id: Optional ElevenLabs voice ID (defaults to male voice if not specified)

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
    from services.prompts import MEGA_PLAN_PROMPT

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
        # Validate mode
        if mode not in ["deep", "fast"]:
            mode = "deep"  # Default to deep mode
        
        print(f"\n{'='*60}")
        print(f"🎬 Starting video generation")
        print(f"   Job ID: {job_id}")
        print(f"   Prompt: {prompt}")
        print(f"   Mode: {mode.upper()} ({'High Quality' if mode == 'deep' else 'Fast Generation'})")
        print(f"   Working directory: {work_dir}")
        print(f"{'='*60}\n")
        capture_log(f"Starting video generation - Job: {job_id}, Topic: {prompt}, Mode: {mode}")

        # Initialize LLM services
        from services.llm import create_llm_service

        # Cerebras Qwen-3 for plan generation (STAGE 1)
        plan_provider = "cerebras"
        plan_model = "qwen-3-235b-a22b-instruct-2507"

        print(f"🔧 Initializing {plan_provider} {plan_model} service for plan generation...")
        plan_llm_service = create_llm_service(provider=plan_provider, model=plan_model)
        print(f"✓ {plan_provider} {plan_model} service initialized\n")
        capture_log(f"{plan_provider} {plan_model} service initialized for plan generation")

        # Code generation service based on mode (STAGE 2)
        if mode == "deep":
            # Deep mode: Anthropic Sonnet 4.5 (slower, higher quality)
            code_provider = "anthropic"
            code_model = "claude-sonnet-4-5-20250929"
        else:
            # Fast mode: Cerebras Qwen 3 (faster, good quality)
            code_provider = "cerebras"
            code_model = "qwen-3-235b-a22b-instruct-2507"

        print(f"🔧 Initializing {code_provider} {code_model} service for code generation...")
        print(f"   Mode: {mode.upper()} - {'Premium quality' if mode == 'deep' else 'Fast generation'}")
        code_llm_service = create_llm_service(provider=code_provider, model=code_model)
        print(f"✓ {code_provider} {code_model} service initialized\n")
        capture_log(f"{code_provider} {code_model} service initialized for code generation (mode: {mode})")

        # ALWAYS initialize Sonnet 4.5 for repairs (even in fast mode)
        repair_provider = "anthropic"
        repair_model = "claude-sonnet-4-5-20250929"
        print(f"🔧 Initializing {repair_provider} {repair_model} service for code repairs...")
        print(f"   This service will be used for fixing failed code generations")
        repair_llm_service = create_llm_service(provider=repair_provider, model=repair_model)
        print(f"✓ {repair_provider} {repair_model} service initialized for repairs\n")
        capture_log(f"{repair_provider} {repair_model} service initialized for code repairs")

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

        # Upload plan to GCS
        try:
            from datetime import datetime

            from services.gcs_storage import GCSStorageService
            
            print(f"\n📤 Uploading plan to GCS...")
            gcs_service = GCSStorageService()
            plan_upload_data = {
                "job_id": job_id,
                "prompt": prompt,
                "mode": mode,
                "plan": mega_plan,
                "timestamp": datetime.utcnow().isoformat()
            }
            plan_upload_result = gcs_service.upload_plan(plan_upload_data, job_id)
            if plan_upload_result and plan_upload_result.get("success"):
                print(f"✓ Plan uploaded to GCS: {plan_upload_result.get('public_url')}")
            else:
                print(f"⚠️  Plan upload failed (non-fatal): {plan_upload_result.get('error', 'Unknown error') if plan_upload_result else 'No result'}")
        except Exception as e:
            print(f"⚠️  Plan upload error (non-fatal): {type(e).__name__}: {e}")

        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 15,
            "message": f"Plan created with {len(video_structure)} sections",
            "job_id": job_id,
            "plan": mega_plan
        })

        # Initialize TTS service and audio directory for later use
        import asyncio

        from services.tts import ElevenLabsTimedService
        
        # Use provided voice_id or default to male voice
        selected_voice_id = voice_id or "pqHfZKP75CvOlQylNhV4"
        capture_log(f"Using voice ID: {selected_voice_id}", "info")
        
        tts_service = ElevenLabsTimedService(
            voice_id=selected_voice_id,
            transcription_model=None
        )
        
        audio_dir = work_dir / "voiceovers"
        audio_dir.mkdir(exist_ok=True)
        print(f"📁 Audio directory: {audio_dir}")
        
        # Initialize empty audio_map - will be populated after code generation
        audio_map = {}

        # STAGE 2: Code Generation (Extract Scripts First)
        print(f"\n{'─'*60}")
        print("🎨 STAGE 2: Code Generation (Script Extraction)")
        print(f"{'─'*60}\n")

        yield update_job_progress({
            "status": "processing",
            "stage": 2,
            "stage_name": "Code Generation",
            "progress_percentage": 20,
            "message": f"Generating code and extracting scripts for {len(video_structure)} sections...",
            "job_id": job_id
        })

        section_scripts: Dict[int, str] = {}
        section_code_variants: Dict[int, list] = {}  # section_num -> [(variant_num, code)]

        async def generate_code_variant_async(section_info, variant_num):
            """Generate a single code variant for a section (without audio - audio will be generated later)."""
            i, section = section_info
            section_num = i + 1

            try:
                print(f"\n{'━'*60}")
                print(f"📹 [Section {section_num} Variant {variant_num}] Generating code variant {variant_num}/3")
                print(f"{'━'*60}")

                # Prepare system prompt (Manim guidelines and requirements)
                from services.prompts import get_manim_prompt
                system_prompt = get_manim_prompt(voice_id)
                
                # Prepare user prompt (section-specific information)
                # Note: Audio will be generated later based on extracted script
                user_prompt = f"""Topic: {prompt}
Section: {section['section']} (Duration: {section['duration']})
Content: {section['content']}

Generate a SINGLE scene for this section only. The scene should be self-contained and match the duration specified.
Use ElevenLabsService for voiceover generation."""

                # Add image context note if provided
                if image_context:
                    user_prompt += "\n\nNOTE: An image was provided as context for this video. When creating visual demonstrations, consider referencing elements or concepts visible in that image."

                print(f"🤖 [Section {section_num} V{variant_num}] Calling {code_provider} {code_model}...")

                # Use slightly higher temperature for variants to get diversity
                temp = TEMP if variant_num == 1 else TEMP + 0.1
                
                # Text-only API call using llm service with system prompt
                manim_code = await code_llm_service.generate_simple_async(
                    prompt=user_prompt,
                    system_prompt=system_prompt,
                    max_tokens=MAX_TOKENS,
                    temperature=temp
                )

                print(f"🔍 [Section {section_num} V{variant_num}] Extracting code from response...")
                
                if '```python' in manim_code:
                    manim_code = manim_code.split('```python')[1].split('```')[0].strip()
                elif '```' in manim_code:
                    manim_code = manim_code.split('```')[1].split('```')[0].strip()

                # Clean the code to remove problematic parameters
                from services.code_utils import apply_all_manual_fixes, clean_manim_code

                manim_code = clean_manim_code(manim_code, voice_id)
                manim_code = apply_all_manual_fixes(manim_code, voice_id)
                print(f"✓ [Section {section_num} V{variant_num}] Code cleaned and fixed")

                # Extract voiceover narration script for this section
                narration_text = extract_voiceover_script(manim_code)
                section_scripts[section_num] = narration_text

                return (section_num, variant_num, manim_code, None)

            except Exception as e:
                print(f"❌ [Section {section_num} V{variant_num}] Code generation error: {type(e).__name__}: {e}")
                import traceback
                print(traceback.format_exc())
                return (section_num, variant_num, None, str(e))

        async def try_render_with_fallback(section_num, code_variants, fix_attempt=0):
            """
            Try rendering with code variants, falling back to next variant on failure.
            If all fail, apply fixes and retry (up to 3 fix attempts total).
            
            Args:
                section_num: Section number
                code_variants: List of (variant_num, code) tuples
                fix_attempt: Current fix attempt number (0-3)
            
            Returns:
                (success, video_path, error) tuple
            """
            import concurrent.futures
            
            MAX_FIX_ATTEMPTS = 3
            
            print(f"\n{'─'*60}")
            print(f"🎬 [Section {section_num}] Trying {len(code_variants)} code variants (fix attempt {fix_attempt})")
            print(f"{'─'*60}")
            
            # Try each variant sequentially until one succeeds
            for variant_num, code in code_variants:
                if code is None:
                    continue
                    
                try:
                    print(f"🚀 [Section {section_num} V{variant_num}] Spawning render container...")
                    render_call = render_single_scene_fn.spawn(section_num, code, str(work_dir), job_id, voice_id)
                    
                    # Wait for render to complete
                    print(f"⏳ [Section {section_num} V{variant_num}] Waiting for render...")
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                        future = executor.submit(render_call.get, 900)  # 15 min timeout
                        result = await asyncio.get_event_loop().run_in_executor(None, future.result)
                    
                    # Handle both 3-tuple (old format) and 4-tuple (new format with GCS upload status)
                    if len(result) == 4:
                        result_section_num, video_path, error, gcs_upload_success = result
                    else:
                        result_section_num, video_path, error = result
                        gcs_upload_success = False  # Default to False for old format
                    
                    if video_path and not error:
                        # Success if GCS upload succeeded OR if we have a local file
                        if gcs_upload_success:
                            print(f"✅ [Section {section_num} V{variant_num}] Render succeeded and uploaded to GCS!")
                        else:
                            print(f"✅ [Section {section_num} V{variant_num}] Render succeeded (GCS upload status unknown)")
                        return (True, video_path, None, gcs_upload_success)
                    else:
                        print(f"❌ [Section {section_num} V{variant_num}] Render failed: {error}")
                        # Continue to next variant
                        
                except Exception as e:
                    print(f"❌ [Section {section_num} V{variant_num}] Render exception: {type(e).__name__}: {e}")
                    # Continue to next variant
            
            # All variants failed - try applying fixes if we haven't exceeded max attempts
            if fix_attempt < MAX_FIX_ATTEMPTS:
                print(f"\n⚠️  [Section {section_num}] All {len(code_variants)} variants failed. Applying fixes (attempt {fix_attempt + 1}/{MAX_FIX_ATTEMPTS})...")
                
                # Apply fixes to all variants in parallel using Sonnet 4.5
                async def apply_fix_async(variant_code_tuple, last_error=None):
                    variant_num, code = variant_code_tuple
                    if code is None:
                        return (variant_num, None)
                    
                    try:
                        print(f"🔧 [Section {section_num} V{variant_num}] Applying LLM-based fixes with Sonnet 4.5...")
                        from services.code_utils import (
                            apply_all_manual_fixes,
                            clean_manim_code,
                        )
                        
                        # First, try rule-based fixes
                        fixed_code = clean_manim_code(code, voice_id)
                        fixed_code = apply_all_manual_fixes(fixed_code, voice_id)
                        
                        # Additional aggressive fixes for common errors
                        import re
                        fixed_code = re.sub(r',\s*stroke_width\s*=\s*[^,\)]+', '', fixed_code)
                        fixed_code = re.sub(r',\s*fill_opacity\s*=\s*[^,\)]+', '', fixed_code)
                        
                        # Then use Sonnet 4.5 to regenerate/fix the code based on errors
                        repair_prompt = f"""The following Manim code failed to render. Please fix all errors and return ONLY the corrected Python code.

ORIGINAL CODE:
```python
{code}
```

AFTER RULE-BASED FIXES:
```python
{fixed_code}
```

ERROR CONTEXT:
The code failed during rendering. Common issues include:
- Incorrect parameter names or values
- Missing imports (especially PreGeneratedAudioService should be from services.tts.pregenerated, NOT manim_voiceover.services.tts)
- Syntax errors
- Invalid Manim API usage
- VGroup containing non-VMobject types (Mobject, Sphere, Cube, etc.) - MUST use Group() instead
- add_tip() called with invalid parameters (width, length) - add_tip() takes NO parameters
- opacity= parameter in Mobject constructors - Mobject.__init__() does NOT accept opacity parameter
- RecorderService causing EOFError (use ElevenLabsService instead)

CRITICAL FIXES REQUIRED:
1. **VGroup Error**: If you see "VGroup can only contain VMobject types" or "Got Mobject instead":
   - Find ALL VGroup() calls that contain non-VMobject types
   - Replace VGroup() with Group() for ANY mixed types or when unsure
   - Common non-VMobjects: Mobject base class, Sphere, Cube, Prism, Cone, Cylinder, any 3D objects
   - When in doubt, ALWAYS use Group() instead of VGroup()

2. **add_tip() Error**: If you see "add_tip() got an unexpected keyword argument":
   - Find ALL calls to .add_tip() with parameters like width= or length=
   - Replace `arrow.add_tip(width=0.2, length=0.2)` with `arrow.add_tip()` (no parameters)
   - Replace `arrow.add_tip(length=0.3)` with `arrow.add_tip()` (no parameters)
   - If custom tip size is needed, use Arrow constructor: `Arrow(start, end, tip_length=0.3)` instead

3. **Opacity Error**: If you see "Mobject.__init__() got an unexpected keyword argument 'opacity'":
   - Find ALL Mobject constructors with opacity= parameter (Circle, Square, Line, Arrow, etc.)
   - Replace `Circle(opacity=0.5)` with `Circle().set_opacity(0.5)` (create object first, then set opacity)
   - Replace `Line(opacity=0.8)` with `Line().set_stroke_opacity(0.8)` or `Line().set_opacity(0.8)`
   - Replace `Square(opacity=0.6)` with `Square().set_opacity(0.6)`
   - ALWAYS use `.set_opacity()`, `.set_fill_opacity()`, or `.set_stroke_opacity()` AFTER object creation

Please generate a corrected version that:
1. Fixes all syntax and runtime errors
2. Uses only valid Manim parameters and methods
3. Replaces ALL VGroup() calls with Group() when containing non-VMobject types (Mobject, Sphere, Cube, etc.)
4. Removes ALL invalid parameters from add_tip() calls (use add_tip() with no parameters)
5. Removes ALL opacity= parameters from Mobject constructors (use .set_opacity() method AFTER creation)
6. Ensures PreGeneratedAudioService is imported from services.tts.pregenerated (NOT manim_voiceover.services.tts)
7. Never uses RecorderService - always use ElevenLabsService with transcription_model=None
8. Maintains the original intent and structure
9. Returns ONLY the Python code without explanations

Generate the fixed code now:"""

                        print(f"🤖 [Section {section_num} V{variant_num}] Calling Sonnet 4.5 for intelligent repair...")
                        
                        # Use repair_llm_service (Sonnet 4.5) for fixing
                        repaired_code = await repair_llm_service.generate_simple_async(
                            prompt=repair_prompt,
                            max_tokens=MAX_TOKENS,
                            temperature=0.3  # Lower temperature for more precise fixes
                        )
                        
                        # Extract code from response
                        if '```python' in repaired_code:
                            repaired_code = repaired_code.split('```python')[1].split('```')[0].strip()
                        elif '```' in repaired_code:
                            repaired_code = repaired_code.split('```')[1].split('```')[0].strip()
                        
                        # Apply final cleanup
                        repaired_code = clean_manim_code(repaired_code, voice_id)
                        repaired_code = apply_all_manual_fixes(repaired_code, voice_id)
                        
                        print(f"✅ [Section {section_num} V{variant_num}] Sonnet 4.5 repair complete")
                        return (variant_num, repaired_code)
                    except Exception as e:
                        print(f"❌ [Section {section_num} V{variant_num}] Repair failed: {e}")
                        import traceback
                        print(traceback.format_exc())
                        return (variant_num, None)
                
                fix_tasks = [apply_fix_async(vc) for vc in code_variants]
                fixed_variants = await asyncio.gather(*fix_tasks)
                
                # Filter out None results
                fixed_variants = [(vn, code) for vn, code in fixed_variants if code is not None]
                
                if fixed_variants:
                    print(f"✓ [Section {section_num}] Applied fixes to {len(fixed_variants)} variants. Retrying renders...")
                    # Recursively try rendering with fixed variants
                    return await try_render_with_fallback(section_num, fixed_variants, fix_attempt + 1)
                else:
                    print(f"❌ [Section {section_num}] No variants could be fixed")
                    return (False, None, "All variants and fix attempts failed", False)
            else:
                print(f"❌ [Section {section_num}] Max fix attempts (3) reached")
                return (False, None, f"All {len(code_variants)} variants failed after 3 fix attempts", False)

        async def generate_code_variants_for_section(section_info):
            """
            Generate 3 code variants for a single section and extract scripts.
            Returns (section_num, code_variants, extracted_script, error)
            """
            i, section = section_info
            section_num = i + 1
            
            try:
                print(f"\n{'='*60}")
                print(f"🎬 SECTION {section_num}/{len(video_structure)}: {section['section']}")
                print(f"{'='*60}")
                
                # Generate 3 code variants in parallel
                print(f"🤖 [Section {section_num}] Generating 3 code variants in parallel...")
                variant_tasks = [
                    generate_code_variant_async(section_info, 1),
                    generate_code_variant_async(section_info, 2),
                    generate_code_variant_async(section_info, 3)
                ]
                variant_results = await asyncio.gather(*variant_tasks, return_exceptions=True)
                
                # Extract successful code variants
                code_variants = []
                for result in variant_results:
                    if isinstance(result, tuple) and len(result) == 4:
                        s_num, v_num, code, error = result
                        if code and not error:
                            code_variants.append((v_num, code))
                            print(f"✓ [Section {section_num} V{v_num}] Generated successfully")
                        else:
                            print(f"❌ [Section {section_num} V{v_num}] Generation failed: {error}")
                
                if not code_variants:
                    print(f"❌ [Section {section_num}] All 3 variants failed to generate")
                    return (section_num, [], "", "All code generation attempts failed")
                
                print(f"✓ [Section {section_num}] Generated {len(code_variants)}/3 variants successfully")
                
                # Extract script from first successful variant
                first_variant_code = code_variants[0][1]
                extracted_script = extract_voiceover_script(first_variant_code)
                
                # Fallback to plan content if script extraction yields nothing
                if not extracted_script or len(extracted_script.strip()) < 20:
                    print(f"⚠️  [Section {section_num}] Script extraction failed or too short, falling back to plan content")
                    extracted_script = section.get('content', '')
                    if len(extracted_script) < 50:
                        extracted_script = f"{section['section']}. {extracted_script}"
                
                print(f"✓ [Section {section_num}] Extracted script ({len(extracted_script)} chars): {extracted_script[:100]}...")
                
                return (section_num, code_variants, extracted_script, None)
                    
            except Exception as e:
                print(f"❌ [Section {section_num}] Fatal error: {type(e).__name__}: {e}")
                import traceback
                print(traceback.format_exc())
                return (section_num, [], "", str(e))

        # PHASE 1: Generate all code variants and extract scripts
        async def generate_all_code_variants():
            """Generate code variants for all sections."""
            print(f"🎯 PHASE 1: Generating code variants for {len(video_structure)} sections...")
            section_tasks = [generate_code_variants_for_section((i, section)) for i, section in enumerate(video_structure)]
            results = await asyncio.gather(*section_tasks)
            return results
        
        code_gen_results = asyncio.run(generate_all_code_variants())
        print(f"\n✓ All code generation completed")
        
        # Store code variants and scripts
        for section_num, code_variants, extracted_script, error in code_gen_results:
            if code_variants and not error:
                section_code_variants[section_num] = code_variants
                section_scripts[section_num] = extracted_script
                print(f"✓ Section {section_num}: {len(code_variants)} variants, script ready")
            else:
                print(f"⚠️  Section {section_num}: Code generation failed - {error}")
        
        # STAGE 2.5: Generate Audio from Actual Scripts
        print(f"\n{'─'*60}")
        print("🎤 STAGE 2.5: Generating Audio from Extracted Scripts")
        print(f"{'─'*60}")
        
        yield update_job_progress({
            "status": "processing",
            "stage": 2.5,
            "stage_name": "Audio Generation",
            "progress_percentage": 45,
            "message": f"Generating audio from actual scripts for {len(section_scripts)} sections...",
            "job_id": job_id
        })
        
        async def generate_audio_from_script(section_num, script_text):
            """Generate audio for a section using its actual extracted script."""
            try:
                print(f"🎤 [Audio {section_num}] Generating from actual script...")
                print(f"   Text length: {len(script_text)} characters")
                print(f"   Preview: {script_text[:100]}...")
                
                # Generate audio using async API
                audio_result = await tts_service.generate_from_text_async(
                    text=script_text,
                    cache_dir=str(audio_dir),
                    path=f"section_{section_num}.mp3"
                )
                
                audio_path = audio_result.get('audio_path', '')
                if audio_path and Path(audio_path).exists():
                    file_size = Path(audio_path).stat().st_size / 1024  # KB
                    print(f"✅ [Audio {section_num}] Generated: {Path(audio_path).name} ({file_size:.2f} KB)")
                    return (section_num, audio_path, script_text, None)
                else:
                    print(f"⚠️  [Audio {section_num}] Audio generation failed")
                    return (section_num, None, script_text, "Audio file not generated")
                    
            except Exception as e:
                print(f"❌ [Audio {section_num}] Audio generation error: {e}")
                import traceback
                print(traceback.format_exc())
                return (section_num, None, script_text, str(e))
        
        async def generate_all_audio_from_scripts():
            """Generate audio for all sections using actual scripts."""
            print(f"🎯 Generating audio for {len(section_scripts)} sections...")
            tasks = [
                generate_audio_from_script(section_num, script)
                for section_num, script in section_scripts.items()
            ]
            results = await asyncio.gather(*tasks)
            return results
        
        audio_gen_results = asyncio.run(generate_all_audio_from_scripts())
        
        # Populate audio_map with actual scripts
        successful_audio = 0
        for section_num, audio_path, script_text, error in audio_gen_results:
            if audio_path and not error:
                audio_map[section_num] = {
                    'audio_path': audio_path,
                    'narration_text': script_text
                }
                successful_audio += 1
                print(f"✓ Section {section_num} audio ready with actual script")
            else:
                print(f"⚠️  Section {section_num} audio failed: {error}")
                audio_map[section_num] = None
        
        print(f"\n✓ Audio generation complete: {successful_audio} / {len(section_scripts)} sections")
        
        # Upload scripts to GCS
        try:
            from datetime import datetime

            from services.gcs_storage import GCSStorageService
            
            print(f"\n📤 Uploading scripts to GCS...")
            gcs_service = GCSStorageService()
            scripts_upload_data = {
                "job_id": job_id,
                "scripts": {
                    str(section_num): {
                        "text": script,
                        "section_info": video_structure[section_num - 1] if section_num - 1 < len(video_structure) else {}
                    }
                    for section_num, script in section_scripts.items()
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            scripts_upload_result = gcs_service.upload_scripts(scripts_upload_data, job_id)
            if scripts_upload_result and scripts_upload_result.get("success"):
                print(f"✓ Scripts uploaded to GCS: {scripts_upload_result.get('public_url')}")
            else:
                print(f"⚠️  Scripts upload failed (non-fatal): {scripts_upload_result.get('error', 'Unknown error') if scripts_upload_result else 'No result'}")
        except Exception as e:
            print(f"⚠️  Scripts upload error (non-fatal): {type(e).__name__}: {e}")
        
        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 55,
            "message": f"Generated audio for {successful_audio}/{len(section_scripts)} sections using actual scripts",
            "job_id": job_id
        })
        
        # STAGE 3: Patch Code to Use Pre-Generated Audio
        print(f"\n{'─'*60}")
        print("🔧 STAGE 3: Patching Code to Use Pre-Generated Audio")
        print(f"{'─'*60}\n")
        
        def patch_code_for_pregenerated_audio(code: str, section_num: int, narration_text: str) -> str:
            """
            Modify code to use PreGeneratedAudioService instead of ElevenLabsService.
            """
            # Replace ElevenLabsService import and usage with PreGeneratedAudioService
            patched = code
            
            # Add PreGeneratedAudioService import if not present
            if "PreGeneratedAudioService" not in patched:
                # Find the import section
                if "from services.tts" in patched or "from tts import" in patched:
                    # Replace ElevenLabsService with PreGeneratedAudioService
                    patched = patched.replace(
                        "from tts import ElevenLabsTimedService",
                        "from services.tts.pregenerated import PreGeneratedAudioService"
                    )
                    patched = patched.replace(
                        "from services.tts import ElevenLabsTimedService",
                        "from services.tts.pregenerated import PreGeneratedAudioService"
                    )
                else:
                    # Add import after manim_voiceover import
                    if "from manim_voiceover import VoiceoverScene" in patched:
                        patched = patched.replace(
                            "from manim_voiceover import VoiceoverScene",
                            "from manim_voiceover import VoiceoverScene\nfrom services.tts.pregenerated import PreGeneratedAudioService"
                        )
            
            # Replace set_speech_service call
            import re
            audio_path = f"/outputs/{job_id}/voiceovers/section_{section_num}.mp3"
            
            # Use selected voice_id
            selected_voice_id = voice_id or "pqHfZKP75CvOlQylNhV4"
            
            # Pattern to match set_speech_service with ElevenLabsService
            elevenlabs_pattern = r'self\.set_speech_service\(ElevenLabsTimedService\([^)]*\)\)'
            replacement = f'self.set_speech_service(PreGeneratedAudioService(audio_file_path="{audio_path}", fallback_to_elevenlabs=True, voice_id="{selected_voice_id}"))'
            
            patched = re.sub(elevenlabs_pattern, replacement, patched)
            
            # Also handle cases where it's split across lines or uses different formatting
            if "ElevenLabsTimedService" in patched and "set_speech_service" in patched:
                # More aggressive replacement
                lines = patched.split('\n')
                new_lines = []
                in_tts_setup = False
                skip_next = False
                
                for i, line in enumerate(lines):
                    if skip_next:
                        skip_next = False
                        continue
                        
                    if "set_speech_service" in line and "ElevenLabsTimedService" in line:
                        new_lines.append(f'        self.set_speech_service(PreGeneratedAudioService(audio_file_path="{audio_path}", fallback_to_elevenlabs=True, voice_id="{selected_voice_id}"))')
                        in_tts_setup = False
                    elif "set_speech_service" in line:
                        # Multi-line set_speech_service
                        in_tts_setup = True
                        new_lines.append(f'        self.set_speech_service(PreGeneratedAudioService(audio_file_path="{audio_path}", fallback_to_elevenlabs=True, voice_id="{selected_voice_id}"))')
                    elif in_tts_setup and ("ElevenLabsTimedService" in line or ")" in line):
                        # Skip lines that are part of the old set_speech_service call
                        in_tts_setup = ")" not in line
                        continue
                    else:
                        new_lines.append(line)
                        
                patched = '\n'.join(new_lines)
            
            return patched
        
        # Patch all code variants to use pre-generated audio
        patched_code_variants = {}
        for section_num, code_variants in section_code_variants.items():
            if section_num in audio_map and audio_map[section_num]:
                # Audio available - patch code
                narration_text = audio_map[section_num]['narration_text']
                patched_variants = []
                for variant_num, code in code_variants:
                    patched_code = patch_code_for_pregenerated_audio(code, section_num, narration_text)
                    patched_variants.append((variant_num, patched_code))
                    print(f"✓ Section {section_num} V{variant_num}: Patched to use pre-generated audio")
                patched_code_variants[section_num] = patched_variants
            else:
                # No audio - use original code with ElevenLabsService
                print(f"⚠️  Section {section_num}: No pre-generated audio, using original code")
                patched_code_variants[section_num] = code_variants
        
        print(f"✓ Patched {len(patched_code_variants)} sections to use pre-generated audio\n")
        
        # STAGE 4: Rendering with Correctly Matched Audio
        print(f"\n{'─'*60}")
        print("🎬 STAGE 4: Rendering with Matched Audio")
        print(f"{'─'*60}\n")
        
        yield update_job_progress({
            "status": "processing",
            "stage": 4,
            "stage_name": "Rendering",
            "progress_percentage": 65,
            "message": f"Rendering {len(patched_code_variants)} sections with matched audio...",
            "job_id": job_id
        })
        
        async def render_section_with_variants(section_num, code_variants):
            """Render a section using its code variants and pre-generated audio."""
            try:
                # Try rendering with fallback logic
                success, video_path, error, gcs_upload_success = await try_render_with_fallback(section_num, code_variants, fix_attempt=0)
                
                if success:
                    return (section_num, video_path, None, gcs_upload_success)
                else:
                    return (section_num, None, error, False)
                    
            except Exception as e:
                print(f"❌ [Section {section_num}] Render error: {type(e).__name__}: {e}")
                import traceback
                print(traceback.format_exc())
                return (section_num, None, str(e), False)
        
        async def render_all_sections():
            """Render all sections with their code variants."""
            print(f"🎯 Rendering {len(patched_code_variants)} sections...")
            tasks = [
                render_section_with_variants(section_num, code_variants)
                for section_num, code_variants in patched_code_variants.items()
            ]
            results = await asyncio.gather(*tasks)
            return results
        
        render_results = asyncio.run(render_all_sections())
        print(f"\n✓ All rendering containers completed")

        # Reload volume to see files written by render containers
        print(f"🔄 Reloading volume to access rendered videos...")
        from modal import Volume
        output_volume = Volume.from_name("video-outputs-main-dev")
        output_volume.reload()
        print(f"✓ Volume reloaded")

        # Process results from Modal containers
        # Track sections based on GCS upload success (more reliable than file existence)
        scene_videos = []
        successful_sections = []  # Sections with successful GCS uploads
        
        for section_num, video_path, error, gcs_upload_success in render_results:
            if gcs_upload_success:
                # GCS upload succeeded - this is the reliable indicator of success
                successful_sections.append(section_num)
                
                # Try to find local file for concatenation (optional)
                if video_path:
                    video_file = Path(video_path)
                    if video_file.exists():
                        scene_videos.append((section_num, video_file))
                        print(f"✓ Section {section_num} video found locally: {video_file.name}")
                    else:
                        print(f"✓ Section {section_num} uploaded to GCS successfully (local file not found, will skip concatenation)")
                else:
                    print(f"✓ Section {section_num} uploaded to GCS successfully (no local path)")
            elif video_path and not error:
                # Render succeeded but GCS upload failed - still try to use local file
                video_file = Path(video_path)
                if video_file.exists():
                    scene_videos.append((section_num, video_file))
                    successful_sections.append(section_num)
                    print(f"⚠️  Section {section_num} rendered but GCS upload failed - using local file")
                else:
                    print(f"⚠️  Section {section_num} rendered but GCS upload failed and local file not found")
            else:
                print(f"⚠️  Section {section_num} failed: {error}")

        # Sort videos by section number
        scene_videos.sort(key=lambda x: x[0])
        scene_videos = [video for _, video in scene_videos]
        
        # Generate titles for each section
        print(f"\n{'─'*60}")
        print("🏷️  Generating Section Titles")
        print(f"{'─'*60}")
        
        section_titles = {}
        
        async def generate_section_title(section_info):
            """Generate a title for a section."""
            section_num, section = section_info
            
            try:
                print(f"🏷️  [Section {section_num}] Generating title...")
                
                # Use the original section data from video_structure
                section_data = video_structure[section_num - 1]
                
                title_prompt = f"""Generate a short, engaging title for this video section.

Section: {section_data['section']}
Content: {section_data['content']}

Requirements:
- Keep it concise (5-8 words maximum)
- Make it engaging and clear
- Reflect the main topic of the section
- Use title case
- Do NOT include quotes or extra formatting

Return ONLY the title text, nothing else."""

                title = await code_llm_service.generate_simple_async(
                    prompt=title_prompt,
                    max_tokens=50,
                    temperature=0.7
                )
                
                # Clean up the title
                title = title.strip().strip('"\'')
                
                print(f"✓ [Section {section_num}] Title: {title}")
                return (section_num, title, None)
                
            except Exception as e:
                print(f"⚠️  [Section {section_num}] Title generation failed: {e}")
                # Fall back to section name
                fallback_title = section_data.get('section', f'Section {section_num}')
                return (section_num, fallback_title, str(e))
        
        async def generate_all_titles():
            """Generate titles for all successful sections."""
            print(f"🎯 Generating titles for {len(successful_sections)} sections...")
            tasks = [
                generate_section_title((section_num, video_structure[section_num - 1]))
                for section_num in sorted(successful_sections)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            return results
        
        title_results = asyncio.run(generate_all_titles())
        
        for section_num, title, error in title_results:
            if not error:
                section_titles[section_num] = title
            else:
                # Use fallback title
                section_titles[section_num] = video_structure[section_num - 1].get('section', f'Section {section_num}')
        
        print(f"✓ Generated {len(section_titles)} section titles")

        # Build list of section URLs (sections are uploaded to GCS at {job_id}/section_{num}.mp4)
        section_urls = []
        section_details = []
        for section_num in sorted(successful_sections):
            section_url = f"https://storage.googleapis.com/vid-gen-static/{job_id}/section_{section_num}.mp4"
            thumbnail_url = f"https://storage.googleapis.com/vid-gen-static/{job_id}/section_{section_num}_thumbnail.png"
            section_urls.append(section_url)
            section_details.append({
                "section": section_num,
                "title": section_titles.get(section_num, f"Section {section_num}"),
                "video_url": section_url,
                "thumbnail_url": thumbnail_url,
                "voiceover_script": section_scripts.get(section_num, "")
            })

        print(f"\n✓ Rendering complete: {len(successful_sections)} / {len(video_structure)} sections uploaded to GCS")
        print(f"   ({len(scene_videos)} sections available locally for concatenation)")

        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 75,
            "message": f"Rendered {len(successful_sections)} sections successfully (uploaded to GCS)",
            "job_id": job_id
        })

        # STAGE 5: Concatenate all sections
        print(f"\n{'─'*60}")
        print("🔗 STAGE 5: Concatenating Videos")
        print(f"{'─'*60}")
        print(f"   Total sections to combine: {len(scene_videos)}")

        yield update_job_progress({
            "status": "processing",
            "stage": 5,
            "stage_name": "Concatenating",
            "progress_percentage": 85,
            "message": "Combining all sections...",
            "job_id": job_id
        })

        final_video = work_dir / f"{job_id}_final.mp4"
        final_video_url = None

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
                    final_video_url = upload_result.get('public_url')
                    print(f"✓ Final video uploaded to GCS: {final_video_url}")
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
                subprocess.run(
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
                        final_video_url = upload_result.get('public_url')
                        print(f"✓ Final video uploaded to GCS: {final_video_url}")
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
            for section_num, video_path, error, gcs_upload_success in render_results:
                if error:
                    capture_log(f"Section {section_num} failed: {error}", level="error")
                elif not gcs_upload_success:
                    capture_log(f"Section {section_num} rendered but GCS upload failed", level="error")
            raise Exception("No videos were successfully rendered")

        yield update_job_progress({
            "status": "processing",
            "progress_percentage": 90,
            "message": "Video rendered successfully (upload disabled)",
            "job_id": job_id
        })

        # STAGE 6: Upload disabled (Supabase integration temporarily removed)
        print(f"\n{'─'*60}")
        print("✅ STAGE 6: Video Generation Complete")
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

        # Build final video URL if not already set
        if not final_video_url:
            final_video_url = f"https://storage.googleapis.com/vid-gen-static/{job_id}/final.mp4"

        # Prepare response data
        response_data = {
            "status": "completed",
            "progress_percentage": 100,
            "message": "Video generation completed successfully!",
            "video_path": str(final_video),
            "job_id": job_id,
            "sections": section_urls,  # List of section video URLs
            "section_details": section_details,
            "final_video_url": final_video_url,
            "metadata": {
                "prompt": prompt,
                "file_size_mb": round(final_size, 2),
                "note": "Upload disabled - video saved locally",
                "num_sections": len(section_urls),
                "voiceover_scripts": [
                    {
                        "section": section_num,
                        "script": section_scripts.get(section_num, "")
                    }
                    for section_num in sorted(section_scripts.keys())
                ]
            }
        }

        # Store cache (skip if image_context is provided, as it affects generation)
        if not image_context:
            try:
                from services.cache_service import get_cache_service
                cache_service = get_cache_service()
                
                # Build cache data structure
                cache_data = {
                    "job_id": job_id,
                    "final_video_url": final_video_url,
                    "sections": section_urls,
                    "section_details": section_details,
                    "metadata": {
                        "prompt": prompt,
                        "file_size_mb": round(final_size, 2),
                        "num_sections": len(section_urls),
                        "voiceover_scripts": [
                            {
                                "section": section_num,
                                "script": section_scripts.get(section_num, "")
                            }
                            for section_num in sorted(section_scripts.keys())
                        ]
                    }
                }
                
                cache_service.store_cache(prompt, cache_data)
            except Exception as e:
                # Cache storage failed, but this is non-fatal
                print(f"⚠️  Cache storage error (non-fatal): {type(e).__name__}: {e}")

        yield update_job_progress(response_data)

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
