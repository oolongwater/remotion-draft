"""
Code utilities for fixing generated Manim code.
Combines TTS configuration fixes and scene structure/API compatibility fixes.

This module provides functions to clean up AI-generated Manim code by:
- Fixing TTS service initialization and parameters
- Ensuring proper scene inheritance (VoiceoverScene)
- Removing incompatible methods and API calls
- Adding required imports and initializations
"""

import re

# ============================================================================
# TTS Configuration Fixes (from code_cleanup.py)
# ============================================================================

def remove_transcription_params(code: str, voice_id: str = None) -> str:
    """
    Remove transcription_model and other problematic parameters from ElevenLabsService initialization.
    Also fix PreGeneratedAudioService to ensure transcription_model=None.

    This fixes the common error where manim-voiceover tries to prompt for missing
    transcription packages (whisper, stable_whisper) which aren't needed.

    Args:
        code: Python code string with Manim scene
        voice_id: Optional voice ID to use. Defaults to male voice if not provided.

    Returns:
        Cleaned code with problematic parameters removed
    """
    # Use provided voice_id or default
    selected_voice_id = voice_id or "pqHfZKP75CvOlQylNhV4"
    # Pattern 1: Remove transcription_model parameter
    # ElevenLabsService(transcription_model="...", ...) -> ElevenLabsService(...)
    code = re.sub(
        r'ElevenLabsService\(\s*transcription_model\s*=\s*[^,)]+\s*,?\s*',
        'ElevenLabsService(',
        code
    )

    # Pattern 2: Ensure correct voice_id parameter
    # Replace any voice_id with the correct one
    code = re.sub(
        r'ElevenLabsService\(\s*voice_id\s*=\s*[^,)]+',
        f'ElevenLabsService(voice_id="{selected_voice_id}"',
        code
    )

    # Pattern 3: Remove voice_name parameter
    code = re.sub(
        r'ElevenLabsService\(\s*voice_name\s*=\s*[^,)]+\s*,?\s*',
        'ElevenLabsService(',
        code
    )

    # Pattern 4: Clean up any trailing commas and ADD voice_id + transcription_model=None
    # ElevenLabsService(, ) -> ElevenLabsService(voice_id="...", transcription_model=None)
    # ElevenLabsService() -> ElevenLabsService(voice_id="...", transcription_model=None)
    code = re.sub(
        r'ElevenLabsService\(\s*,?\s*\)',
        f'ElevenLabsService(voice_id="{selected_voice_id}", transcription_model=None)',
        code
    )

    # Pattern 4b: Add transcription_model=None if only voice_id is present
    # ElevenLabsService(voice_id="...") -> ElevenLabsService(voice_id="...", transcription_model=None)
    code = re.sub(
        rf'ElevenLabsService\(voice_id="{selected_voice_id}"\)',
        f'ElevenLabsService(voice_id="{selected_voice_id}", transcription_model=None)',
        code
    )

    # Pattern 4c: Remove model parameter if present (we want default model)
    code = re.sub(
        rf'ElevenLabsService\(voice_id="{selected_voice_id}",\s*model="[^"]*",?\s*',
        f'ElevenLabsService(voice_id="{selected_voice_id}", ',
        code
    )

    # Pattern 5: Replace GTTSService with ElevenLabsService
    code = re.sub(
        r'GTTSService\([^)]*\)',
        f'ElevenLabsService(voice_id="{selected_voice_id}", transcription_model=None)',
        code
    )

    # Pattern 6: Update imports if GTTSService was used
    code = re.sub(
        r'from manim_voiceover\.services\.gtts import GTTSService',
        'from manim_voiceover.services.elevenlabs import ElevenLabsService',
        code
    )

    # Pattern 7: Fix PreGeneratedAudioService - ensure transcription_model=None is not needed
    # PreGeneratedAudioService already handles this, but ensure no RecorderService is used
    # Replace RecorderService with ElevenLabsService
    code = re.sub(
        r'RecorderService\([^)]*\)',
        f'ElevenLabsService(voice_id="{selected_voice_id}", transcription_model=None)',
        code
    )
    
    # Remove RecorderService imports
    code = re.sub(
        r'from manim_voiceover\.services\.recorder import RecorderService[^\n]*\n?',
        '',
        code
    )

    return code


def ensure_elevenlabs_import(code: str) -> str:
    """
    Ensure ElevenLabsService is properly imported.

    Args:
        code: Python code string

    Returns:
        Code with proper ElevenLabsService import
    """
    # Check if import exists
    if 'from manim_voiceover.services.elevenlabs import ElevenLabsService' in code:
        return code

    # Check if there's a manim_voiceover import section
    if 'from manim_voiceover' in code:
        # Add after existing manim_voiceover imports
        code = re.sub(
            r'(from manim_voiceover[^\n]+\n)',
            r'\1from manim_voiceover.services.elevenlabs import ElevenLabsService\n',
            code,
            count=1
        )
    else:
        # Add after manim import
        code = re.sub(
            r'(from manim import \*\n)',
            r'\1from manim_voiceover import VoiceoverScene\nfrom manim_voiceover.services.elevenlabs import ElevenLabsService\n',
            code
        )

    return code


# ============================================================================
# Scene Structure Fixes (from manual_code_helpers.py)
# ============================================================================

def remove_camera_orientation_calls(code: str) -> str:
    """
    Remove self.set_camera_orientation lines which are invalid in Manim Community.

    Args:
        code: Python code string

    Returns:
        Code with camera orientation calls removed
    """
    lines = code.split('\n')
    filtered_lines = []

    for line in lines:
        stripped_line = line.strip()
        if stripped_line.startswith('self.set_camera_orientation'):
            print(f"⚠️  Removed invalid line: {stripped_line}")
            continue
        filtered_lines.append(line)

    return '\n'.join(filtered_lines)


def fix_scene_inheritance(code: str) -> str:
    """
    Replace (Scene) with (VoiceoverScene) for proper voiceover support.

    Args:
        code: Python code string

    Returns:
        Code with Scene inheritance fixed to VoiceoverScene
    """
    lines = code.split('\n')
    filtered_lines = []
    scene_replaced = False

    for line in lines:
        stripped_line = line.strip()

        # Fix Scene class to use VoiceoverScene
        if '(Scene)' in line and '(VoiceoverScene)' not in line:
            fixed_line = line.replace('(Scene)', '(VoiceoverScene)')
            print(f"⚠️  Fixed Scene inheritance: {stripped_line} -> {fixed_line.strip()}")
            filtered_lines.append(fixed_line)
            scene_replaced = True
        else:
            filtered_lines.append(line)

    if scene_replaced:
        print("⚠️  Automatically converted to VoiceoverScene for audio support")

    return '\n'.join(filtered_lines)


def ensure_voiceover_imports(code: str) -> str:
    """
    Ensure VoiceoverScene and ElevenLabsService imports are present.

    Args:
        code: Python code string

    Returns:
        Code with proper voiceover imports
    """
    if 'VoiceoverScene' not in code:
        return code

    # Check if imports already exist
    if 'from manim_voiceover import VoiceoverScene' in code:
        return code

    # Add the imports after the manim import
    lines = code.split('\n')
    new_lines = []
    imports_added = False

    for line in lines:
        new_lines.append(line)
        if line.strip().startswith('from manim import') and not imports_added:
            new_lines.append('from manim_voiceover import VoiceoverScene')
            new_lines.append('from manim_voiceover.services.elevenlabs import ElevenLabsService')
            print("⚠️  Added missing manim_voiceover imports")
            imports_added = True

    return '\n'.join(new_lines)


def ensure_speech_service_init(code: str) -> str:
    """
    Ensure ElevenLabsService is initialized in construct() method if VoiceoverScene is used.
    NOTE: This should NOT add transcription_model parameter - that's handled by remove_transcription_params()

    Args:
        code: Python code string

    Returns:
        Code with speech service initialization
    """
    if 'VoiceoverScene' not in code:
        return code

    if 'set_speech_service' in code:
        return code  # Already has initialization

    lines = code.split('\n')
    new_lines = []
    in_construct = False
    service_added = False

    for i, line in enumerate(lines):
        new_lines.append(line)
        if 'def construct(self):' in line:
            in_construct = True
        elif in_construct and line.strip() and not line.strip().startswith('#') and not service_added:
            # Add speech service initialization after first non-comment line in construct
            new_lines.append('        # Initialize ElevenLabs speech service for audio narration')
            new_lines.append('        self.set_speech_service(ElevenLabsService())')
            print("⚠️  Added speech service initialization to construct method")
            service_added = True
            in_construct = False

    return '\n'.join(new_lines)


def remove_incompatible_methods(code: str) -> str:
    """
    Remove methods that don't exist or cause issues in Manim Community.

    Args:
        code: Python code string

    Returns:
        Code with incompatible methods removed
    """
    lines = code.split('\n')
    filtered_lines = []

    incompatible_patterns = [
        'self.set_camera_orientation',
        '.begin_ambient_camera_rotation',
        '.stop_ambient_camera_rotation',
        '.move_camera',
        'self.check_overlap',  # Non-existent method
        '.check_overlap',  # Non-existent method
        '.bounding_box',  # Non-existent attribute (MathTex doesn't have this)
    ]

    for line in lines:
        stripped_line = line.strip()
        skip_line = False

        for pattern in incompatible_patterns:
            if pattern in stripped_line:
                print(f"⚠️  Removed incompatible method/attribute: {stripped_line}")
                skip_line = True
                break

        if not skip_line:
            filtered_lines.append(line)

    return '\n'.join(filtered_lines)


def remove_incorrect_imports(code: str) -> str:
    """
    Remove incorrect imports that don't exist in manim_voiceover.
    Fix import paths for PreGeneratedAudioService.
    
    Args:
        code: Python code string
        
    Returns:
        Code with incorrect imports removed and fixed
    """
    lines = code.split('\n')
    filtered_lines = []
    
    for line in lines:
        # Remove create_voiceover_tracker import (doesn't exist)
        if 'from manim_voiceover.helper import create_voiceover_tracker' in line:
            print("⚠️  Removed incorrect import: create_voiceover_tracker (doesn't exist in manim_voiceover)")
            continue
        # Remove create_voiceover_tracker usage
        if 'create_voiceover_tracker' in line:
            print(f"⚠️  Removed incorrect usage of create_voiceover_tracker: {line.strip()}")
            continue
        # Fix incorrect PreGeneratedAudioService import path
        if 'from manim_voiceover.services.tts.pregenerated import PreGeneratedAudioService' in line:
            print("⚠️  Fixed PreGeneratedAudioService import path")
            filtered_lines.append('from services.tts.pregenerated import PreGeneratedAudioService')
            continue
        # Fix any other manim_voiceover.services.tts imports
        if 'from manim_voiceover.services.tts' in line:
            print(f"⚠️  Fixed incorrect import path: {line.strip()}")
            # Replace with services.tts path
            fixed_line = line.replace('from manim_voiceover.services.tts', 'from services.tts')
            filtered_lines.append(fixed_line)
            continue
        filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)


def remove_placeholders(code: str) -> str:
    """
    Remove code generation placeholders like {tts_init}, {variable_name}, etc.
    
    Args:
        code: Python code string
        
    Returns:
        Code with placeholders removed or replaced
    """
    # Pattern: {tts_init} or {variable_name} - replace with proper initialization
    if '{tts_init}' in code:
        print("⚠️  Found placeholder {tts_init}, replacing with ElevenLabsService initialization")
        code = code.replace(
            '{tts_init}',
            'ElevenLabsService(voice_id="pqHfZKP75CvOlQylNhV4", transcription_model=None)'
        )
    
    # Pattern: Any other {placeholder} - remove the line or replace with comment
    import re
    placeholder_pattern = r'\{[a-zA-Z_][a-zA-Z0-9_]*\}'
    matches = re.findall(placeholder_pattern, code)
    if matches:
        for placeholder in matches:
            print(f"⚠️  Found placeholder {placeholder}, removing")
            # Remove lines containing only the placeholder
            lines = code.split('\n')
            filtered_lines = []
            for line in lines:
                if placeholder in line and line.strip() == placeholder:
                    # Skip lines that are just the placeholder
                    continue
                elif placeholder in line:
                    # Replace placeholder in line with comment or remove
                    filtered_lines.append(line.replace(placeholder, '# Placeholder removed'))
                else:
                    filtered_lines.append(line)
            code = '\n'.join(filtered_lines)
    
    return code


def fix_color_constants(code: str) -> str:
    """
    Fix color constant naming issues (though Manim Community uses GRAY, not GREY).
    This is mainly for compatibility.

    Args:
        code: Python code string

    Returns:
        Code with color constants fixed
    """
    # Note: Manim Community uses GRAY (American spelling)
    # ManimGL uses GREY (British spelling)
    # Since we're using Manim Community, no fix needed, but keep function for compatibility
    return code


def remove_vgroup_with_non_vmobjects(code: str) -> str:
    """
    Fix VGroup usage with non-VMobject types.
    VGroup can only contain VMobject types. Use Group() for mixed types.
    
    Args:
        code: Python code string
        
    Returns:
        Code with VGroup issues fixed
    """
    import re
    
    # Pattern 1: VGroup with non-VMobject types - replace with Group
    # Look for VGroup(...) patterns that might contain non-VMobjects
    # Common non-VMobjects: Sphere, Cube, Prism, etc. (3D objects)
    # Also Mobject base class instances
    
    # Replace VGroup with Group when non-VMobject types are detected
    # This is a conservative fix - we'll replace VGroup with Group in suspicious cases
    lines = code.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Check if line contains VGroup and potential non-VMobject types
        if 'VGroup' in line:
            # Check for common non-VMobject patterns
            non_vmobject_patterns = [
                r'Sphere\(',
                r'Cube\(',
                r'Prism\(',
                r'Cone\(',
                r'Cylinder\(',
                r'Mobject\(',
                r'ThreeDObject\(',
                r'\bMobject\b',  # Mobject as a class name (not just constructor)
            ]
            
            has_non_vmobject = any(re.search(pattern, line) for pattern in non_vmobject_patterns)
            
            if has_non_vmobject:
                print(f"⚠️  Replaced VGroup with Group (contains non-VMobject): {line.strip()[:80]}")
                # Replace VGroup with Group
                fixed_line = line.replace('VGroup', 'Group')
                fixed_lines.append(fixed_line)
                continue
        
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)


def fix_add_tip_parameters(code: str) -> str:
    """
    Fix add_tip() calls with invalid parameters.
    add_tip() does NOT accept width or length parameters.
    
    Args:
        code: Python code string
        
    Returns:
        Code with add_tip() calls fixed
    """
    import re
    
    # Pattern 1: Remove width and length parameters from add_tip()
    # arrow.add_tip(width=0.2, length=0.2) -> arrow.add_tip()
    # arrow.add_tip(length=0.3) -> arrow.add_tip()
    # arrow.add_tip(width=0.2) -> arrow.add_tip()
    
    lines = code.split('\n')
    fixed_lines = []
    
    for line in lines:
        if '.add_tip(' in line:
            # Check if line has invalid parameters
            if 'width=' in line or 'length=' in line:
                print(f"⚠️  Removed invalid parameters from add_tip(): {line.strip()[:80]}")
                # Remove parameters: .add_tip(width=..., length=...) -> .add_tip()
                # Handle various patterns
                fixed_line = re.sub(
                    r'\.add_tip\([^)]*\)',
                    '.add_tip()',
                    line
                )
                fixed_lines.append(fixed_line)
                continue
        
        fixed_lines.append(line)
    
    return '\n'.join(fixed_lines)


def fix_opacity_parameters(code: str) -> str:
    """
    Fix opacity= parameter usage in Mobject constructors.
    Mobject.__init__() does NOT accept opacity parameter - must use .set_opacity() method instead.
    
    Args:
        code: Python code string
        
    Returns:
        Code with opacity parameters fixed
    """
    import re
    
    # Pattern: Find any Mobject constructor with opacity= parameter
    # Circle(opacity=0.5) -> Circle().set_opacity(0.5)
    # Line(opacity=0.8, color=BLUE) -> Line(color=BLUE).set_opacity(0.8)
    # Square(color=BLUE, opacity=0.6) -> Square(color=BLUE).set_opacity(0.6)
    
    lines = code.split('\n')
    fixed_lines = []
    
    # Pattern to match: MobjectType(...opacity=value...)
    # This matches common Mobject constructors followed by parentheses with opacity parameter
    mobject_constructors = [
        'Circle', 'Square', 'Rectangle', 'Line', 'Arrow', 'Dot', 'Polygon', 
        'RegularPolygon', 'Triangle', 'Ellipse', 'Arc', 'Sector', 'Annulus',
        'Text', 'MathTex', 'Tex', 'Brace', 'Bracket', 'Angle', 'LabeledDot'
    ]
    
    for line in lines:
        fixed_line = line
        
        # Check if line contains opacity= parameter
        if 'opacity=' in line and '(' in line:
            # Try to find and fix each mobject constructor pattern
            for mobject_type in mobject_constructors:
                # Pattern: mobject_type(...opacity=value...)
                pattern = rf'({mobject_type})\s*\(([^)]*opacity\s*=\s*([^,)]+)[^)]*)\)'
                match = re.search(pattern, line)
                
                if match:
                    full_match = match.group(0)
                    mobject_name = match.group(1)
                    params = match.group(2)
                    opacity_value = match.group(3).strip()
                    
                    # Remove opacity parameter from params
                    # Handle both: opacity=value and , opacity=value
                    params_without_opacity = re.sub(r',\s*opacity\s*=\s*[^,)]+', '', params)
                    params_without_opacity = re.sub(r'opacity\s*=\s*[^,)]+\s*,?\s*', '', params_without_opacity)
                    
                    # Clean up trailing/leading commas and spaces
                    params_without_opacity = params_without_opacity.strip().rstrip(',').strip()
                    
                    # Build replacement: MobjectType(params).set_opacity(value)
                    if params_without_opacity:
                        new_constructor = f"{mobject_name}({params_without_opacity})"
                    else:
                        new_constructor = f"{mobject_name}()"
                    
                    replacement = f"{new_constructor}.set_opacity({opacity_value})"
                    fixed_line = line.replace(full_match, replacement)
                    print(f"⚠️  Fixed opacity parameter: {line.strip()[:80]} -> {fixed_line.strip()[:80]}")
                    break  # Only fix first match per line
        
        fixed_lines.append(fixed_line)
    
    return '\n'.join(fixed_lines)


def add_basic_voiceover_if_missing(code: str) -> str:
    """
    Add a basic voiceover block if VoiceoverScene is used but no voiceover blocks exist.

    Args:
        code: Python code string

    Returns:
        Code with basic voiceover block added if needed
    """
    if 'VoiceoverScene' not in code:
        return code

    if 'self.voiceover(' in code or 'with self.voiceover(' in code:
        return code  # Already has voiceover blocks

    print("⚠️  WARNING: VoiceoverScene used but no self.voiceover() blocks found!")
    print("    The prompt should ensure voiceover blocks are included.")

    # Don't automatically add voiceover - let the repair system handle it
    # This is just a warning
    return code


# ============================================================================
# Main Entry Points
# ============================================================================

def clean_manim_code(code: str, voice_id: str = None) -> str:
    """
    Apply TTS configuration fixes to Manim code.

    Args:
        code: Raw generated Manim code
        voice_id: Optional voice ID to use. Defaults to male voice if not provided.

    Returns:
        Cleaned, ready-to-run Manim code with TTS fixes applied
    """
    # Apply all TTS cleanup functions
    code = remove_transcription_params(code, voice_id)
    code = ensure_elevenlabs_import(code)

    return code


def apply_all_manual_fixes(code: str, voice_id: str = None) -> str:
    """
    Apply scene structure and API compatibility fixes to Manim code.

    Args:
        code: Raw generated Manim code
        voice_id: Optional voice ID to use. Defaults to male voice if not provided.

    Returns:
        Code with all manual fixes applied
    """
    print("🔧 Applying manual code fixes...")

    # Order matters!
    code = remove_incorrect_imports(code)  # Remove incorrect imports first
    code = remove_camera_orientation_calls(code)
    code = fix_scene_inheritance(code)
    code = ensure_voiceover_imports(code)
    code = remove_incompatible_methods(code)
    code = fix_color_constants(code)
    code = fix_add_tip_parameters(code)  # Fix add_tip() invalid parameters
    code = ensure_speech_service_init(code)
    code = add_basic_voiceover_if_missing(code)

    print("✓ Manual code fixes complete")
    return code


# ============================================================================
# Testing
# ============================================================================

if __name__ == "__main__":
    # Test case 1: TTS configuration
    test_code_1 = """
from manim import *
from manim_voiceover import VoiceoverScene
from manim_voiceover.services.elevenlabs import ElevenLabsService

class TestScene(VoiceoverScene):
    def construct(self):
        self.set_speech_service(ElevenLabsService(voice_id="pNuYQqviK3X", transcription_model="base"))
"""

    # Test case 2: Scene structure
    test_code_2 = """
from manim import *

class TestScene(Scene):
    def construct(self):
        # Set camera
        self.set_camera_orientation(phi=75 * DEGREES, theta=30 * DEGREES)

        # Create objects
        circle = Circle()
        self.play(Create(circle))
        self.wait()
"""

    print("="*60)
    print("Test 1 - TTS Configuration Fixes:")
    print("="*60)
    print("BEFORE:")
    print(test_code_1)
    print("\nAFTER:")
    cleaned_1 = clean_manim_code(test_code_1)
    print(cleaned_1)

    print("\n" + "="*60)
    print("Test 2 - Scene Structure Fixes:")
    print("="*60)
    print("BEFORE:")
    print(test_code_2)
    print("\nAFTER:")
    fixed_2 = apply_all_manual_fixes(test_code_2)
    print(fixed_2)
