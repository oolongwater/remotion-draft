"""
Standalone Supabase upload function for Modal
Simple wrapper around the existing storage.py upload functionality
"""

import os
from services.storage import SupabaseStorageService


def upload_video_to_supabase(
    video_path: str,
    topic: str,
    job_id: str = None,
    **kwargs
):
    """
    Upload a video to Supabase storage.

    Args:
        video_path: Path to the video file
        topic: Video topic/title
        job_id: Optional job ID
        **kwargs: Additional metadata (clerk_user_id, etc.)

    Returns:
        Dict with upload results including public_url

    Example:
        >>> result = upload_video_to_supabase(
        ...     video_path="/path/to/video.mp4",
        ...     topic="My Video",
        ...     job_id="abc123"
        ... )
        >>> print(result['public_url'])
    """
    service = SupabaseStorageService()
    return service.upload_video(
        video_path=video_path,
        topic=topic,
        job_id=job_id,
        **kwargs
    )


if __name__ == "__main__":
    # Test the upload function
    print("🧪 Testing Supabase upload function...")
    print("Note: This test requires a video file and Supabase credentials")

    # Check for credentials
    if not os.getenv('NEXT_PUBLIC_SUPABASE_URL') and not os.getenv('SUPABASE_URL'):
        print("❌ Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
        print("Set credentials in backend/config/.env")
        sys.exit(1)

    print("✅ Upload function loaded successfully")
    print("Use: upload_video_to_supabase(video_path, topic, job_id)")
