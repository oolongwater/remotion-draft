#!/usr/bin/env python3
"""
Main Modal Video Generator - DEV ENVIRONMENT (Modular Version)

This is the refactored, modular version of the dev environment video generator.
All logic has been separated into modules in the dev/ directory.

Architecture:
- dev/config.py - Configuration constants
- dev/renderer.py - Scene rendering logic (pure Python)
- dev/generator_logic.py - Main pipeline logic (pure Python)
- dev/api_logic.py - FastAPI endpoint logic (pure Python)
- dev/cli_logic.py - Local CLI entrypoint logic (pure Python)

This main file contains:
- Modal container image definition (inline, not in dev/)
- All Modal decorators at global scope (required by Modal)
- Thin wrapper functions that delegate to pure Python logic modules

Pipeline:
1. Generate mega plan with structured output (Claude Sonnet)
2. Concurrent scene generation:
   a. Generate Manim code for each scene (Claude Sonnet)
   b. Generate ElevenLabs audio for voiceover
   c. Render scene with Manim
3. Concatenate videos

Usage:
    # Deploy to Modal
    modal deploy backend/modal/main_video_generator_dev_modular.py

    # Test locally
    modal run backend/modal/main_video_generator_dev_modular.py --prompt "Explain photosynthesis"

    # API endpoint (after deployment)
    POST https://YOUR_MODAL_URL/generate_video_api
    {
        "topic": "Your topic here",
        "job_id": "optional-job-id",
        "image_context": "optional-base64-image",
        "clerk_user_id": "optional-clerk-id"
    }
"""

from typing import Optional, Tuple

import modal

# Create Modal app - DEV VERSION
APP_NAME = "main-video-generator-dev"
VOLUME_NAME = "video-outputs-main-dev"

app = modal.App(APP_NAME)

# Build the container image (all paths relative to project root)
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
        "elevenlabs==0.2.27",
        "fastapi[standard]>=0.104.0",
        "anthropic>=0.40.0",
        "google-cloud-storage>=2.10.0",
    )
    # Add services directory as a Python package
    .add_local_dir(
        "backend/modal/services",
        "/root/services"
    )
    # Add dev module as a Python package
    .add_local_dir(
        "backend/modal/dev",
        "/root/dev",
        ignore=["image.py", "generator.py", "api.py", "cli.py"]
    )
)

output_volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)

# Import configuration constants from dev module (now available in image)
from dev.api_logic import generate_video_api_logic
from dev.cli_logic import main_cli_logic
from dev.config import (
    MAIN_CPU,
    MAIN_MEMORY,
    MAIN_SECRETS,
    MAIN_TIMEOUT,
    RENDER_CPU,
    RENDER_MEMORY,
    RENDER_SECRETS,
)
from dev.generator_logic import generate_educational_video_logic

# Import pure Python logic functions (now available in image)
from dev.renderer import render_single_scene_logic

# ============================================================================
# MODAL FUNCTIONS - ALL AT GLOBAL SCOPE (Required by Modal)
# ============================================================================

@app.function(
    image=image,
    timeout=900,  # 15 minutes per scene
    memory=RENDER_MEMORY,
    cpu=RENDER_CPU,
    secrets=[modal.Secret.from_name(s) for s in RENDER_SECRETS],
    volumes={"/outputs": output_volume},
)
def render_single_scene(
    section_num: int,
    manim_code: str,
    work_dir_path: str,
    job_id: str
) -> Tuple[int, str, str]:
    """
    Render a single Manim scene in its own container.
    Delegates to pure Python logic function.
    """
    return render_single_scene_logic(section_num, manim_code, work_dir_path, job_id)


@app.function(
    image=image,
    timeout=MAIN_TIMEOUT,
    memory=MAIN_MEMORY,
    cpu=MAIN_CPU,
    secrets=[modal.Secret.from_name(s) for s in MAIN_SECRETS],
    volumes={"/outputs": output_volume},
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
    Delegates to pure Python logic function.
    """
    # Pass the render function reference to the logic
    yield from generate_educational_video_logic(
        prompt=prompt,
        job_id=job_id,
        image_context=image_context,
        clerk_user_id=clerk_user_id,
        render_single_scene_fn=render_single_scene
    )


@app.function(
    image=image,
    secrets=[modal.Secret.from_name(s) for s in MAIN_SECRETS],
)
@modal.fastapi_endpoint(method="POST")
async def generate_video_api(item: dict):
    """
    FastAPI endpoint for video generation.
    Delegates to pure Python logic function.
    """
    return await generate_video_api_logic(item, generate_educational_video)


@app.local_entrypoint()
def main(prompt: str):
    """
    Local entrypoint for testing.
    Delegates to pure Python logic function.
    """
    main_cli_logic(prompt, generate_educational_video)


# That's it! The entire app is now modular and maintainable.
#
# Key architectural improvement:
# - Modal decorators are at GLOBAL SCOPE (required by Modal)
# - Business logic is in separate modules (easier to test and maintain)
# - Clear separation of concerns: decorators vs logic
# - Each component can be understood and modified independently
