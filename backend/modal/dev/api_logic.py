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
            "code_iterations": 1,
            "video_iterations": 1
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

    # Log what we received
    print(f"📥 Received API request:")
    print(f"   Topic: {prompt}")
    print(f"   Job ID: {job_id}")
    print(f"   Has image: {bool(image_context)}")
    print(f"   Clerk User ID: {clerk_user_id}")

    def event_stream():
        """Stream progress updates as SSE"""
        try:
            for update in generate_educational_video_fn.remote_gen(
                prompt=prompt,
                job_id=job_id,
                image_context=image_context,
                clerk_user_id=clerk_user_id
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
            "X-Accel-Buffering": "no"
        }
    )
