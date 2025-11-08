# Video Generation Pipeline Optimization

## Implementation Date
November 8, 2025

## Optimization Goal
Reduce video generation pipeline from **1.5 minutes** to under **1 minute**.

---

## ✅ Implemented Optimizations

### 🎤 **1. Parallel Audio Pre-Generation (PRIMARY OPTIMIZATION)**

**Impact:** Expected to save **20-30 seconds**

**Changes:**
- Added new Stage 1.5: "Pre-generating Audio in Parallel"
- All ElevenLabs TTS audio is now generated in parallel BEFORE code generation
- Audio files are pre-created and passed to Manim rendering containers
- Renderers no longer block on TTS API calls during video generation

**Files Modified:**
- `backend/modal/services/tts/elevenlabs.py`
  - Added `_call_elevenlabs_api_async()` method
  - Added `generate_from_text_async()` method
  - Uses `aiohttp` for async HTTP requests

- `backend/modal/main_video_generator_dev_modular.py`
  - Added `aiohttp>=3.9.0` dependency

- `backend/modal/dev/generator_logic.py`
  - Added Stage 1.5 audio pre-generation
  - Creates audio directory and generates all section audio in parallel
  - Modified code generation prompts to use pre-generated audio files
  - Audio map passed to render containers

**How It Works:**
```python
# Before: Audio generated serially during rendering (50-75 sec total)
for section in sections:
    render_scene()  # Blocks on TTS for 10-15 seconds each

# After: Audio generated in parallel upfront (10-15 sec total)
audio_results = await asyncio.gather(*[
    generate_audio(section) for section in sections
])  # All 5 sections generate simultaneously

for section in sections:
    render_scene(pregenerated_audio)  # No TTS blocking!
```

---

### 💾 **2. Skip Individual Volume Commits**

**Impact:** Expected to save **5-10 seconds**

**Changes:**
- Removed per-section `volume.commit()` calls
- Single volume reload in main function is sufficient
- Reduces I/O overhead from 5 commits to 1 reload

**Files Modified:**
- `backend/modal/dev/renderer.py`
  - Line 302-304: Commented out individual volume commits
  - Added optimization note

**Note:** Individual section GCS uploads are still performed (user requirement)

---

## 📊 Expected Performance Improvement

| Stage | Before | After | Savings |
|-------|--------|-------|---------|
| Plan Generation | 5-10s | 5-10s | ✅ No change |
| **Audio Generation** | **50-75s** (serial) | **10-15s** (parallel) | **🔥 40-60s** |
| Code Generation | 10-15s | 10-15s | ✅ No change |
| Video Rendering | 20-30s | 20-30s | ✅ No change |
| Volume Commits | 10-15s | 2-3s | **⚡ 7-12s** |
| Concatenation | 3-5s | 3-5s | ✅ No change |
| **Total** | **90-150s** | **50-68s** | **✨ 40-82s** |

**Expected new runtime:** **50-70 seconds** (down from 90-150 seconds)

---

## 🔧 Technical Details

### Async Audio Generation Flow

1. **Plan Stage:** Video structure with 5 sections created
2. **Audio Stage (NEW):** 
   - Initialize ElevenLabsTimedService once
   - Create audio directory: `/outputs/{job_id}/audio/`
   - Launch 5 parallel async tasks
   - Each task calls ElevenLabs API independently
   - Audio files saved: `section_1.mp3`, `section_2.mp3`, etc.
   - Build audio_map: `{section_num: {audio_path, narration_text}}`

3. **Code Generation Stage:**
   - Prompt modified to use pre-generated audio
   - Instructions to load audio file instead of calling TTS
   - Audio path provided: `/outputs/{job_id}/audio/section_N.mp3`

4. **Rendering Stage:**
   - Manim scenes load pre-existing audio files
   - No TTS API calls during rendering
   - Pure video rendering without I/O blocking

### Dependencies Added

```python
# Modal image
.pip_install(
    "aiohttp>=3.9.0",  # For async HTTP requests
    # ... existing dependencies
)
```

---

## 🎯 Future Optimization Opportunities

### Phase 2 (Medium Effort - Additional 10-20 sec savings)
1. **Switch to Claude Haiku for Code Generation**
   - Haiku is 3-5x faster than Sonnet
   - Slightly lower quality but sufficient
   - Saves: 5-8 seconds

2. **Reduce Rendering Quality**
   - Lower frame rate from 12fps to 10fps
   - Add `--disable_caching` flag
   - Saves: 5-10 seconds

3. **Container Warm Pools**
   - Keep 2 containers warm
   - Eliminates cold start overhead
   - Saves: 3-5 seconds

### Phase 3 (Complex - Additional 10-15 sec savings)
1. **Streaming Concatenation**
   - Start concatenating sections as they complete
   - Don't wait for all sections to finish
   - Saves: 3-5 seconds

2. **Advanced TTS Caching**
   - Cache audio across similar requests
   - Pre-warm cache with common phrases
   - Saves: Variable

3. **GPU Acceleration for Rendering**
   - Use Modal GPU containers
   - Significantly faster Manim rendering
   - Saves: 10-20 seconds

---

## 🧪 Testing Recommendations

1. **Measure Actual Timings:**
   ```bash
   time python3 -m modal run backend/modal/main_video_generator_dev_modular.py \
     --prompt "Explain backpropagation in machine learning"
   ```

2. **Monitor ElevenLabs API:**
   - Check for rate limiting with parallel requests
   - Verify audio quality is maintained
   - Monitor API costs (unchanged - same number of requests)

3. **Verify Audio Sync:**
   - Ensure pre-generated audio syncs properly with Manim animations
   - Check voiceover timing data is preserved
   - Test with various narration lengths

4. **Volume Consistency:**
   - Verify all sections are accessible after single volume reload
   - Check for any race conditions with parallel renders

---

## 📝 Notes

- Individual section GCS uploads are **retained** (user requirement)
- Audio caching still works - cached audio won't make redundant API calls
- ElevenLabs API costs remain the same (same number of TTS requests)
- All 5 sections generate audio in parallel - not sequential
- Fallback behavior: If audio generation fails, render continues with inline TTS

---

## 🚀 Deployment

To deploy the optimized version:

```bash
# Deploy to Modal
modal deploy backend/modal/main_video_generator_dev_modular.py

# The new audio pre-generation stage will automatically run
# Monitor the new "Stage 1.5: Pre-generating Audio" logs
```

---

## ✨ Summary

The primary optimization is **parallel audio pre-generation**, which moves the TTS bottleneck out of the critical rendering path. By generating all audio files upfront and in parallel, we eliminate 40-60 seconds of sequential blocking time.

Combined with skipping redundant volume commits, this should reduce total pipeline time from **1.5 minutes to under 1 minute** (50-70 seconds expected).

**Next Steps:**
1. Deploy and test the optimized pipeline
2. Measure actual performance improvement
3. If further optimization needed, implement Phase 2 optimizations

