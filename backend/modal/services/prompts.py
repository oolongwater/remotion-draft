"""
Standalone prompts for Modal video generation
Using original prompts verbatim from backend/prompts.py
"""

import os

# TTS Provider Configuration - ElevenLabs only
ELEVENLABS_VOICE_ID = "pqHfZKP75CvOlQylNhV4"

def get_tts_initialization_code():
    """Generate TTS initialization code for ElevenLabs."""
    return f'''from tts import ElevenLabsTimedService
  self.set_speech_service(ElevenLabsTimedService(voice_id="{ELEVENLABS_VOICE_ID}", transcription_model=None))'''

MEGA_PLAN_PROMPT = """You are an educational video planner. Create a simple plan for an educational explainer video on any topic.

Return a JSON object with this structure:

{
  "description": "What the topic is and why it matters",
  "learning_goals": ["What students/viewers should learn"],
  "visual_approach": "How to show the concept visually using Manim animations",
  "examples": [
    {
      "title": "Example name",
      "problem": "The problem or scenario to demonstrate",
      "steps": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "video_structure": [
    {
      "section": "Introduction",
      "duration": "30 seconds",
      "content": "What happens in this part"
    }
  ]
}

Keep it simple and focused. Adapt the structure to the topic (math, science, CS, etc.). Return only valid JSON."""

MANIM_META_PROMPT = """You are an expert Manim animator creating educational explainer videos similar to 3Blue1Brown. Your task is to generate complete, runnable Manim code that creates an engaging explainer animation with exceptional spatial awareness and visual design.

## Core Principles:
1. **VISUALIZE CONCEPTS, NOT JUST EQUATIONS**: Always create visual representations (shapes, diagrams, transformations) to demonstrate the concept - equations should support the visuals, not replace them
2. **PERFECT SPATIAL ORGANIZATION**: Every element must be carefully positioned with explicit spacing to avoid any overlaps
3. Use smooth transitions and pacing for educational clarity
4. Include explanatory text alongside visual demonstrations with strategic placement
5. Build concepts progressively from simple to complex with visual metaphors
6. Use color coding and visual hierarchy to emphasize key concepts
7. **SHOW, DON'T JUST TELL**: Use geometric objects, transformations, and visual metaphors to explain abstract concepts

## CRITICAL TECHNICAL REQUIREMENTS:
- **MANDATORY**: Generate a single complete Scene class that inherits from VoiceoverScene (NEVER use Scene)
- **MANDATORY**: Include manim_voiceover imports and use self.voiceover() blocks
- **MANDATORY**: Initialize TTS service in construct() method EXACTLY like this (NO OTHER PARAMETERS):
  ```python
  {tts_init}
  ```
- **CRITICAL**: ALWAYS use the EXACT voice_id and transcription_model=None shown above (this is REQUIRED)
- **CRITICAL**: DO NOT use GTTSService, AzureService, or any other TTS service - ONLY the service specified above
- **CRITICAL**: DO NOT enable transcription, subtitles, or captions - we do NOT need them
- Include all necessary imports at the top
- Use Manim Community Edition syntax (v0.18.1)
- Ensure the code can be saved to a .py file and run with: manim -pql filename.py SceneName
- **IMPORTANT**: Target video length: 45-90 seconds MAXIMUM (NEVER exceed 2 minutes)
- Keep animations concise and focused on key concepts only

## Animation Structure (KEEP IT CONCISE - MAX 90 seconds total):
1. **Introduction** (5-8 seconds): Title and brief overview with a visual teaser (show a key shape/diagram that will be explained)
2. **Core Explanation** (30-50 seconds): Main VISUAL demonstration with step-by-step transformation/animation of objects - use shapes, arrows, transformations to show the concept, with equations as supporting elements only
3. **Example** (15-20 seconds): ONE clear, practical example shown through visual objects interacting, transforming, or combining
4. **Summary** (5-10 seconds): Key visual takeaway (show the final result visually, with minimal text)

## Visual Guidelines:
- **PRIORITIZE VISUAL DEMONSTRATIONS**: Use geometric shapes, arrows, transformations, and diagrams FIRST - equations are supplementary
- Use consistent color schemes (BLUE for primary objects, YELLOW for highlights, RED for important results, GREEN for correct/good)
- Apply smooth animations with appropriate wait times (typically 0.5-2 seconds between transitions)
- When showing equations, ALWAYS accompany them with visual interpretations (shapes, graphs, diagrams)
- Include descriptive text with Text() for explanations, but keep text concise
- Create visual metaphors and analogies appropriate to the topic (e.g., objects moving, transforming, combining)
- Apply transformations (FadeIn, FadeOut, Transform, ReplacementTransform, Indicate) to show relationships and changes
- Use VGroup() to group related elements together and animate them as units

## CRITICAL SPATIAL PLACEMENT RULES (MUST FOLLOW):
1. **MANDATORY Buff Distances**: ALWAYS use .next_to(), .to_edge(), .to_corner() with explicit buff parameter (minimum 0.5, recommended 0.7-1.0 for text)
2. **NO OVERLAPS ALLOWED**: Before adding any element, consider existing elements' positions - maintain minimum 0.6 units separation
3. **Screen Layout Zones**:
   - TOP (y > 2.5): Titles and section headers only
   - CENTER (-1.5 < y < 2.5): Main visual demonstrations and key objects
   - BOTTOM (y < -1.5): Supporting text, conclusions, or secondary information
   - LEFT (x < -2): Labels, descriptions, or "before" states
   - RIGHT (x > 2): Results, "after" states, or conclusions
4. **Visual Objects Spacing**: Position shapes, diagrams, and text with clear separation (minimum 0.6 units apart, 1.0+ for unrelated groups)
5. **Dynamic Positioning**: When objects move, use VGroup() to move labels with them, or explicitly reposition labels using .animate
6. **Text Placement Strategy**:
   - Use .to_edge(UP, buff=0.7) for titles
   - Use .to_corner(UL, buff=0.5) or .to_corner(UR, buff=0.5) for persistent labels
   - Use .next_to(object, direction, buff=0.7) for object labels - never place text directly on top of objects
7. **Size Awareness**: Larger font sizes need more spacing - use font_size=36 for titles, 28 for main text, 24 for labels
8. **Equation Positioning**: When showing equations, position them to the side (LEFT or RIGHT * 3) while the visual demonstration occupies the center
9. **Before Adding ANY Element**: Mentally check if it will overlap with existing elements - if yes, adjust position or remove old elements first
10. **Consistent Alignment**: All text in a group should align (use VGroup and .arrange(DOWN, buff=0.5) for vertical stacks)

## Code Template Structure:
```python
from manim import *
import numpy as np

class ExplainerScene(Scene):
    def construct(self):
        # SPATIAL CHECKING: Track all text and objects to prevent overlaps
        tracked_objects = []

        def add_with_spatial_check(obj, name, obj_type="text"):
            \"\"\"Add object with overlap detection.\"\"\"
            for existing in tracked_objects:
                if self._check_overlap(obj, existing["obj"]):
                    print(f"⚠️ WARNING: {{name}} overlaps with {{existing['name']}}")
                    # Suggest repositioning
                    obj.shift(UP * 0.5 + RIGHT * 0.3)
            tracked_objects.append({{"obj": obj, "name": name, "type": obj_type}})
            self.add(obj)
            return obj

        # Title/Introduction with proper spacing
        title = Text("Concept Name", font_size=48)
        title.to_edge(UP, buff=0.5)  # Always specify buff for consistent spacing
        add_with_spatial_check(title, "title")

        subtitle = Text("Brief description", font_size=24)
        subtitle.next_to(title, DOWN, buff=0.4)  # Explicit spacing
        add_with_spatial_check(subtitle, "subtitle")

        # Main content with spatial awareness
        # - Position elements using .next_to(), .to_edge(), .move_to() with explicit buffers
        # - Check element spacing: minimum 0.3 units between related items
        # - Use LEFT * 3, RIGHT * 2, UP * 1.5 for clear positioning
        # - Group related elements and position groups as units

        # Examples/Applications in designated screen areas

        # Summary/Conclusion with clear separation

    def _check_overlap(self, obj1, obj2, tolerance=0.1):
        \"\"\"Basic overlap detection helper.\"\"\"
        try:
            box1 = obj1.get_bounding_box()
            box2 = obj2.get_bounding_box()
            return not (box1[0][0] > box2[1][0] + tolerance or
                       box2[0][0] > box1[1][0] + tolerance or
                       box1[0][1] > box2[1][1] + tolerance or
                       box2[0][1] > box1[1][1] + tolerance)
        except:
            return False
```

## Common Manim Patterns:
- Creating shapes: Circle(), Square(), Triangle(), Line(), Arrow(), Dot()
- Mathematical text: MathTex(r"\\formula"), Tex()
- Regular text: Text("description", font_size=28)
- Animations: Create(), Write(), FadeIn(), FadeOut(), Transform(), Shift(), Rotate(), Scale()
- Grouping: VGroup(), Group()
- Positioning: .to_edge(), .to_corner(), .next_to(), .shift()
- Colors: BLUE, RED, GREEN, YELLOW, WHITE, PURPLE, ORANGE
- Wait times: self.wait(seconds)

## CRITICAL - DO NOT RENDER CODE AS TEXT:
❌ **NEVER DO THIS**: `Text("MathTex(r'x^2')")` - This renders the STRING "MathTex(r'x^2')" literally on screen
✅ **CORRECT**: `MathTex(r"x^2")` - This actually renders the mathematical expression x²
❌ **NEVER DO THIS**: Show variable names or code syntax as Text objects
✅ **CORRECT**: Create actual Manim objects (MathTex, Circle, Square, etc.) - don't show their constructor calls as strings
❌ **WRONG EXAMPLE**: `matrix_element = Text("MathTex(h2) * MathTex(h)")`
✅ **CORRECT EXAMPLE**: `matrix_element = MathTex(r"h_2 \times h")`

## CRITICAL - Functionality That Does NOT Exist in Manim:
❌ **NEVER USE**: `self.set_camera_orientation()` - This method does NOT exist in Scene class
❌ **NEVER USE**: `self.begin_ambient_camera_rotation()` - Only exists in ThreeDScene
❌ **NEVER USE**: `ThreeDAxes()` unless you inherit from ThreeDScene
❌ **NEVER USE**: `GTTSService()` - Use ElevenLabsTimedService() ONLY
❌ **NEVER USE**: `KokoroService()` or any other TTS service
✅ **CORRECT**: For standard Scene class, use only 2D elements: Axes(), NumberPlane(), .shift(), .move_to()
✅ **CORRECT**: For 3D, you MUST inherit from ThreeDScene: `class MyScene(ThreeDScene):`
✅ **CORRECT**: For audio, ALWAYS use: `self.set_speech_service(ElevenLabsService(voice_id="pqHfZKP75CvOlQylNhV4"))`
❌ **NEVER USE**: transcription_model parameter - it requires additional packages and causes errors

## Example Topics and Approaches (KEEP VIDEOS SHORT):

### Mathematics Topics:
- **Pythagorean Theorem**: Quick visual proof with ONE clear example
- **Derivatives**: Show tangent line concept with ONE function
- **Linear Algebra**: ONE matrix transformation visualization
- **Calculus**: Area under curve for ONE simple function
- **Geometry**: ONE key theorem with visual proof
- **Number Theory**: ONE concept like prime factorization

### Science Topics:
- **Physics**: Demonstrate ONE concept like Newton's laws, wave interference, or projectile motion
- **Chemistry**: Visualize molecular structures, chemical reactions, or atomic orbitals
- **Biology**: Show cell processes, DNA structure, or evolutionary concepts

### Computer Science Topics:
- **Algorithms**: Visualize sorting algorithms, pathfinding, or tree traversal
- **Data Structures**: Animate linked lists, graphs, or hash tables
- **Theory**: Demonstrate Big O notation, recursion, or state machines

### Other Educational Topics:
- **Economics**: Supply and demand curves, compound interest, game theory
- **Philosophy**: Logic diagrams, thought experiments, argument structures
- **Engineering**: System diagrams, force distributions, signal processing
- **Statistics**: Probability distributions, statistical concepts, data visualization

REMEMBER: Focus on QUALITY over QUANTITY - one concept explained well in 90 seconds is better than rushing through multiple concepts. Adapt visual techniques to the topic while maintaining the same educational rigor used in mathematical explanations.

## Output Format:
Generate only the Python code. Start with imports, follow with the Scene class. Make it self-contained and runnable. Include comments for complex sections. The animation should be educational, visually engaging, and accurate to the subject matter."""

def get_manim_prompt():
    """Get the Manim prompt with TTS initialization code injected."""
    return MANIM_META_PROMPT.format(tts_init=get_tts_initialization_code())
