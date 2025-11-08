# Multi-Variant Code Generation with Intelligent Retry System

## Overview

The video generation pipeline now implements a robust multi-variant code generation system with intelligent fallback rendering and repair logic. This significantly improves success rates by generating multiple code alternatives and applying AI-powered fixes when needed.

## Key Features

### 1. **3 Parallel Code Variants Per Section**

- Each video section generates 3 different code implementations simultaneously
- Variants use slightly different temperatures (base, +0.1, +0.1) for diversity
- All variants are cleaned and fixed before rendering attempts

### 2. **Intelligent Fallback Rendering**

- Renders are attempted sequentially: Variant 1 → Variant 2 → Variant 3
- If a variant succeeds, rendering stops immediately (no wasted resources)
- If a variant fails, the next one is tried automatically

### 3. **AI-Powered Code Repair with Sonnet 4.5**

- **ALWAYS uses Claude Sonnet 4.5 for repairs** (regardless of generation mode)
- If all 3 variants fail, Sonnet 4.5 repairs all variants in parallel
- Repairs apply both rule-based fixes AND intelligent LLM-based corrections
- Up to 3 repair attempts (fix attempt 1, 2, and 3)

### 4. **Parallel Section Processing**

- All sections process their variants and retries in parallel
- Maximizes throughput and reduces total generation time
- Independent failure handling per section

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ For Each Section (All Sections Run in Parallel)            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: Generate 3 Code Variants in Parallel              │
│  • Variant 1: Temperature = TEMP                            │
│  • Variant 2: Temperature = TEMP + 0.1                      │
│  • Variant 3: Temperature = TEMP + 0.1                      │
│  • All cleaned & fixed with rule-based fixes               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: Try Rendering (Sequential Fallback)               │
│  1. Try Variant 1 → Success? ✅ Done                        │
│  2. Failed? Try Variant 2 → Success? ✅ Done                │
│  3. Failed? Try Variant 3 → Success? ✅ Done                │
└─────────────────────────────────────────────────────────────┘
                           │
                    All Failed? ❌
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: Repair with Sonnet 4.5 (Fix Attempt 1)            │
│  • Apply rule-based fixes to all variants                   │
│  • Use Sonnet 4.5 to intelligently repair code              │
│  • All 3 variants repaired in parallel                      │
│  • Retry rendering: V1 → V2 → V3                            │
└─────────────────────────────────────────────────────────────┘
                           │
                    All Failed? ❌
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 4: Repair with Sonnet 4.5 Again (Fix Attempt 2)      │
│  • Apply more aggressive fixes                              │
│  • Use Sonnet 4.5 for second repair attempt                 │
│  • All 3 variants repaired in parallel                      │
│  • Retry rendering: V1 → V2 → V3                            │
└─────────────────────────────────────────────────────────────┘
                           │
                    All Failed? ❌
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5: Repair with Sonnet 4.5 Final (Fix Attempt 3)      │
│  • Apply final aggressive fixes                             │
│  • Use Sonnet 4.5 for third repair attempt                  │
│  • All 3 variants repaired in parallel                      │
│  • Retry rendering: V1 → V2 → V3                            │
└─────────────────────────────────────────────────────────────┘
                           │
                    All Failed? ❌
                           │
                           ▼
                   ❌ Section Failed
```

## Retry Logic Summary

**Total Possible Attempts Per Section:**

- 3 initial variants
- 3 variants after repair attempt 1
- 3 variants after repair attempt 2
- 3 variants after repair attempt 3
- **= Up to 12 render attempts per section**

**Rendering Strategy:**

- Sequential fallback (try variants one at a time until success)
- Stops immediately on first success
- Minimizes wasted compute resources

## LLM Service Configuration

### Code Generation (Mode-Dependent)

- **Deep Mode**: Anthropic Claude Sonnet 4.5
- **Fast Mode**: Cerebras Qwen 3

### Code Repair (Always)

- **ALWAYS**: Anthropic Claude Sonnet 4.5
- Lower temperature (0.3) for precise fixes
- Includes error context and both original + rule-fixed code

## Benefits

1. **Higher Success Rate**: Multiple attempts increase probability of success
2. **Cost Efficient**: Sequential fallback stops on first success
3. **Quality Repairs**: Sonnet 4.5 provides intelligent fixes based on context
4. **Parallel Processing**: All sections and repairs run concurrently
5. **Mode Flexibility**: Fast mode for generation, premium quality for repairs

## Implementation Details

### Files Modified

- `backend/modal/dev/generator_logic.py`

### Key Functions

- `generate_code_variant_async()`: Generates a single code variant
- `try_render_with_fallback()`: Handles rendering with fallback logic
- `apply_fix_async()`: Applies Sonnet 4.5-based repairs
- `process_section_with_variants()`: Orchestrates the full variant pipeline
- `process_all_sections()`: Processes all sections in parallel

### Configuration

- `MAX_FIX_ATTEMPTS = 3`: Maximum repair attempts
- Repair temperature: `0.3` (precise fixes)
- Generation temperature variance: `+0.1` for diversity

## Error Handling

- Graceful degradation: Sections can fail independently
- Detailed logging at each stage
- Error context provided to repair prompts
- Comprehensive traceback for debugging

## Future Enhancements

- [ ] Capture actual render errors and pass to repair prompt
- [ ] Learn from successful variants to improve future generations
- [ ] Adaptive temperature adjustment based on failure patterns
- [ ] Parallel rendering of all 3 variants (fastest wins)
