# Dynamic Component Generation Implementation

This document describes the new dynamic component generation system that allows the LLM to create fully customized React components, animations, and layouts for educational videos.

## What Changed

Your Remotion educational app has been transformed from a **template-based system** (where only content/text could be customized) to a **fully dynamic system** where the LLM can generate:

- ✅ Custom React components with JSX
- ✅ Advanced animations (spring physics, easing, keyframes)
- ✅ Flexible layouts (grid, flexbox, absolute positioning)
- ✅ Rich visual components (code blocks, charts, diagrams)
- ✅ Complete creative control over scene structure

## Architecture Overview

### 1. Type System (`src/types/SceneConfig.ts`)

**New Types Added:**
- `AnimationDefinition`: Spring, easing, keyframe, and sequence animations
- `LayoutConfig`: Flex, grid, absolute, and stack layouts
- `DynamicSceneConfig`: Scene configuration with `componentCode` field
- `AnySceneConfig`: Union of template and dynamic scene configs

**Key Feature:** Backward compatible with existing template scenes.

### 2. Animation Engine (`src/utils/animationEngine.ts`)

**Capabilities:**
- `createSpringAnimation()`: Physics-based animations with damping, stiffness, mass
- `createEasingAnimation()`: 12 easing functions (linear, easeIn, easeOut, cubic, quad, etc.)
- `createKeyframeAnimation()`: Multi-point animations with custom easing per segment
- `createSequenceAnimation()`: Chain multiple animations in sequence

**Animation Presets:**
- `fadeIn/fadeOut`: Opacity transitions
- `slideInLeft/Right/Up/Down`: Directional slides
- `scaleIn`: Scale from 0 to 1
- `bounceIn`: Spring-based entrance
- `rotate360`: Full rotation
- `pulse`: Keyframe-based pulsing

**Helpers:**
- `applyAnimations()`: Apply multiple animations to get property values
- `buildStyle()`: Convert animation values to CSS styles
- `buildTransform()`: Build transform strings from properties

### 3. Layout Engine (`src/utils/LayoutEngine.tsx`)

**Layout Components:**

**FlexLayout:**
```typescript
<FlexLayout config={{
  type: 'flex',
  direction: 'row',
  justify: 'center',
  align: 'start',
  gap: 20
}}>
  {children}
</FlexLayout>
```

**GridLayout:**
```typescript
<GridLayout config={{
  type: 'grid',
  columns: 2,
  gap: 20
}}>
  {children}
</GridLayout>
```

**AbsoluteLayout:**
```typescript
<AbsoluteLayout config={{
  type: 'absolute',
  anchor: 'center',
  x: 100,
  y: 50
}}>
  {children}
</AbsoluteLayout>
```

**StackLayout:**
```typescript
<StackLayout config={{
  type: 'stack',
  align: 'center',
  justify: 'center'
}}>
  {children}
</StackLayout>
```

### 4. Building Block Components (`src/remotion/components/`)

**CodeBlock:**
- Syntax highlighting
- Line numbers
- Highlight specific lines
- Supports multiple languages

**Card:**
- Title and subtitle
- Custom colors and borders
- Padding control
- Animation support

**AnimatedText:**
- Character-by-character animation
- Word-by-word animation
- Fade, slide, scale effects

**ProgressBar:**
- Animated progress
- Custom colors and height
- Percentage display

**Chart:**
- Bar charts
- Line charts
- Animated data entry
- Custom colors per data point

**Diagram:**
- Node-edge diagrams
- Flowcharts
- Multiple node shapes (rect, circle, diamond)
- Animated edge drawing
- Arrow markers

**TwoColumnLayout:**
- Side-by-side content
- Adjustable column widths
- Gap control

### 5. Dynamic Scene Renderer (`src/remotion/DynamicSceneRenderer.tsx`)

**Core Features:**

**Safe Code Execution:**
- Uses Function constructor for code evaluation
- Whitelisted imports only (no arbitrary imports)
- Validates code for dangerous patterns before execution
- Error boundaries for runtime errors

**Security Checks:**
Block dangerous patterns:
- `eval()`, `Function()`
- `import`, `require()`
- `process`, `global`, `window.location`
- `document.cookie`, `localStorage`, `sessionStorage`
- `<script>` tags
- `fetch()`, `XMLHttpRequest`

**Available Context:**
LLM-generated code has access to:
- React and React hooks
- Remotion hooks (`useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`)
- All building block components
- Animation engine functions
- Layout engine
- Safe console logging

**Error Handling:**
- Compilation errors show detailed error message
- Runtime errors caught by error boundary
- Security violations show security warning
- Fallback UI for all error states

### 6. Integration (`src/App.tsx`, `src/SceneController.tsx`)

**Scene Type Detection:**
```typescript
if (currentScene === 'dynamic' && currentSceneData?.type === 'dynamic') {
  // Use DynamicSceneRenderer
  CurrentSceneComponent = DynamicSceneRenderer;
  componentProps = { config: currentSceneData };
} else {
  // Use template scene
  CurrentSceneComponent = SCENE_COMPONENTS[currentScene];
  componentProps = { content, animations, colors };
}
```

**Scene Controller:**
- Now supports `'dynamic'` scene type
- Handles `AnySceneConfig` (template or dynamic)
- Backward compatible with existing scenes

### 7. LLM Service Updates (`src/services/llmService.ts`)

**Enhanced Prompt:**
- Instructions for creating dynamic scenes
- Documentation of available building blocks
- Animation engine API reference
- Example dynamic scene code
- Guidelines for when to use dynamic vs template scenes

**Validation:**
- Checks for `componentCode` on dynamic scenes
- Checks for `content` and `animations` on template scenes
- Type-safe validation for both scene types

## How to Use Dynamic Scenes

### Example 1: Code Tutorial Scene

```javascript
{
  "type": "dynamic",
  "duration": 180,
  "componentCode": "const Scene = () => { const frame = useCurrentFrame(); const { fps } = useVideoConfig(); return (<AbsoluteFill style={{backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60}}><TwoColumnLayout left={<Card title='JavaScript Variables'><p style={{color: '#cbd5e1', fontSize: 20}}>Variables store data values. Use const for constants and let for variables that change.</p></Card>} right={<CodeBlock code='const name = \"Alice\";\\nlet age = 25;\\nage = 26;' language='javascript' lineNumbers={true} highlightLines={[3]} />} gap={40} /></AbsoluteFill>); };"
}
```

### Example 2: Data Visualization Scene

```javascript
{
  "type": "dynamic",
  "duration": 180,
  "componentCode": "const Scene = () => { const frame = useCurrentFrame(); return (<AbsoluteFill style={{backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60}}><div style={{fontSize: 36, color: '#e2e8f0', marginBottom: 40}}>Algorithm Performance</div><Chart type='bar' data={[{label: 'Bubble', value: 100}, {label: 'Quick', value: 40}, {label: 'Merge', value: 45}]} animationDuration={60} showValues={true} /></AbsoluteFill>); };"
}
```

### Example 3: Flowchart Scene

```javascript
{
  "type": "dynamic",
  "duration": 180,
  "componentCode": "const Scene = () => { return (<AbsoluteFill style={{backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Diagram nodes={[{id: '1', label: 'Start', x: 340, y: 50, color: '#10b981'}, {id: '2', label: 'Process', x: 340, y: 150, color: '#3b82f6'}, {id: '3', label: 'End', x: 340, y: 250, color: '#ef4444'}]} edges={[{from: '1', to: '2'}, {from: '2', to: '3'}]} width={800} height={400} animationDuration={60} /></AbsoluteFill>); };"
}
```

## Testing the Implementation

### 1. Test with Simple Prompt
Try: "Teach me about JavaScript variables"

The LLM should generate scenes that include code examples using `CodeBlock`.

### 2. Test with Data-Heavy Topic
Try: "Explain sorting algorithm performance"

The LLM should generate scenes with `Chart` components.

### 3. Test with Process-Oriented Topic
Try: "How does HTTP request/response work"

The LLM should generate scenes with `Diagram` components showing the flow.

### 4. Test Template Scenes Still Work
Try a simple topic to ensure backward compatibility with template scenes.

## Troubleshooting

### LLM Not Generating Dynamic Scenes
- The LLM might default to template scenes for simple topics
- Try more visual/technical topics that benefit from code/charts/diagrams
- The prompt encourages dynamic scenes for topics with "visual aids"

### Dynamic Scene Not Rendering
- Check browser console for errors
- Verify the `componentCode` is valid JavaScript
- Ensure component returns JSX wrapped in `AbsoluteFill` or similar container

### Security Validation Blocking Valid Code
- Review the dangerous patterns list in `DynamicSceneRenderer.tsx`
- The validation is strict for safety
- If you need to allow certain patterns, modify `validateCode()`

### Animation Not Working
- Verify animation definitions match the `AnimationDefinition` type
- Check that `applyAnimations()` is called with correct frame and fps
- Use `buildStyle()` to convert animation values to CSS

## Next Steps

### Potential Enhancements

1. **More Building Blocks:**
   - Interactive quiz components
   - 3D visualizations
   - Audio waveforms
   - Timeline components
   - Mind maps

2. **Advanced Animations:**
   - Path animations (SVG path following)
   - Particle systems
   - Morphing shapes
   - Parallax effects

3. **AI-Generated Assets:**
   - Generate SVG diagrams
   - Create color palettes
   - Suggest layout compositions

4. **Template Library:**
   - Pre-built dynamic scene templates
   - Style system for consistent theming
   - Component composition patterns

5. **Testing & Validation:**
   - Unit tests for animation engine
   - Visual regression testing
   - Performance monitoring
   - Security audits

## Files Modified/Created

### Created:
- `src/utils/animationEngine.ts`
- `src/utils/LayoutEngine.tsx`
- `src/remotion/DynamicSceneRenderer.tsx`
- `src/remotion/components/CodeBlock.tsx`
- `src/remotion/components/Card.tsx`
- `src/remotion/components/AnimatedText.tsx`
- `src/remotion/components/ProgressBar.tsx`
- `src/remotion/components/Chart.tsx`
- `src/remotion/components/Diagram.tsx`
- `src/remotion/components/TwoColumnLayout.tsx`
- `src/remotion/components/index.ts`

### Modified:
- `src/types/SceneConfig.ts` - Added dynamic scene types
- `src/App.tsx` - Integrated dynamic scene rendering
- `src/SceneController.tsx` - Added 'dynamic' scene type support
- `src/services/llmService.ts` - Enhanced prompt with dynamic capabilities

## Security Considerations

The dynamic code execution is designed with security in mind:

1. **No Network Access:** fetch, XMLHttpRequest blocked
2. **No File System:** No access to filesystem APIs
3. **No Dangerous Globals:** process, global, window.location blocked
4. **No Dynamic Code:** eval, Function() constructor blocked
5. **Sandboxed Context:** Only whitelisted APIs available
6. **Validation Before Execution:** Pattern matching for dangerous code
7. **Error Boundaries:** Crashes don't affect app

**Note:** This runs in the browser, so it's inherently safer than server-side code execution, but validation is still important for preventing malicious LLM outputs.

## Backward Compatibility

All existing functionality remains intact:
- Template scenes (intro, concept, retry, clarification, advanced) work as before
- Existing VideoConfig format is supported
- No breaking changes to the API
- Dynamic scenes are opt-in via the LLM's generation choices

The system intelligently chooses between template and dynamic rendering based on the scene type.

