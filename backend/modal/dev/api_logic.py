"""
FastAPI endpoint logic for video generation in dev environment
Pure Python logic without Modal decorators
Provides HTTP POST endpoint with Server-Sent Events streaming
"""



async def generate_video_api_logic(item: dict, generate_educational_video_fn):
    """
    FastAPI endpoint logic for video generation.

    Args:
        item: Request body dict
        generate_educational_video_fn: Modal function reference for video generation

    Request body:
        {
            "topic": "Topic for the video (or 'prompt')",
            "job_id": "optional-job-id",
            "image_context": "optional base64-encoded image",
            "clerk_user_id": "optional clerk user id",
            "mode": "deep or fast (default: deep)",
            "code_iterations": 1,
            "video_iterations": 1,
            "voice_id": "optional ElevenLabs voice ID"
        }

    Returns:
        StreamingResponse with Server-Sent Events
    """
    import json

    from fastapi.responses import StreamingResponse

    # Support both 'topic' and 'prompt' for backwards compatibility
    prompt = item.get("topic") or item.get("prompt")
    if not prompt:
        return {"success": False, "error": "Topic/prompt is required"}

    job_id = item.get("job_id")
    image_context = item.get("image_context")  # Base64 encoded image
    clerk_user_id = item.get("clerk_user_id")  # Clerk user ID for user association
    mode = item.get("mode", "deep")  # Generation mode: "deep" or "fast"
    voice_id = item.get("voice_id")  # ElevenLabs voice ID

    # Log what we received
    print(f"📥 Received API request:")
    print(f"   Topic: {prompt}")
    print(f"   Job ID: {job_id}")
    print(f"   Mode: {mode}")
    print(f"   Has image: {bool(image_context)}")
    print(f"   Clerk User ID: {clerk_user_id}")
    print(f"   Voice ID: {voice_id}")

    # Check cache (skip if image_context is provided, as it affects generation)
    if not image_context:
        try:
            from services.cache_service import get_cache_service
            cache_service = get_cache_service()
            cached_result = cache_service.get_cache(prompt)
            
            if cached_result:
                print(f"✓ Returning cached result for prompt")
                
                def cached_event_stream():
                    """Stream cached result as SSE"""
                    # Return cached result as completed status
                    cached_update = {
                        "status": "completed",
                        "progress_percentage": 100,
                        "message": "Video generation completed successfully! (from cache)",
                        "job_id": cached_result.get("job_id", job_id),
                        "sections": cached_result.get("sections", []),
                        "section_details": cached_result.get("section_details", []),
                        "final_video_url": cached_result.get("final_video_url"),
                        "metadata": cached_result.get("metadata", {}),
                        "cached": True
                    }
                    yield f"data: {json.dumps(cached_update)}\n\n"
                
                return StreamingResponse(
                    cached_event_stream(),
                    media_type="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Accel-Buffering": "no",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type"
                    }
                )
        except Exception as e:
            # Cache check failed, continue with normal generation
            print(f"⚠️  Cache check error (continuing with generation): {type(e).__name__}: {e}")

    def event_stream():
        """Stream progress updates as SSE"""
        try:
            for update in generate_educational_video_fn.remote_gen(
                prompt=prompt,
                job_id=job_id,
                image_context=image_context,
                clerk_user_id=clerk_user_id,
                mode=mode,
                voice_id=voice_id
            ):
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            error_update = {
                "status": "failed",
                "error": f"Streaming error: {str(e)}"
            }
            yield f"data: {json.dumps(error_update)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    )
