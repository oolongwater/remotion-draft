#!/usr/bin/env python3
"""
Supabase Storage Service for Video Upload and Management

This service handles video file uploads to Supabase Storage bucket,
providing secure URLs and managing video metadata.
"""

import os
import uuid
import secrets
import requests
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SupabaseStorageService:
    """Service for managing video uploads to Supabase Storage."""
    
    def __init__(self):
        """Initialize Supabase client and storage configuration."""
        # Check for SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (Modal secret compatibility)
        self.supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        # Use service role key if available, otherwise fall back to anon key
        # Modal secret "supabase-service-role" maps to environment variable "service_role"
        self.supabase_key = os.getenv('service_role') or os.getenv('SUPABASE_SERVICE_ROLE') or os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
        self.bucket_name = os.getenv('SUPABASE_BUCKET_NAME', 'videos')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "Supabase configuration missing. Please set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and either "
                "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY environment variables."
            )
        
        # Set up headers for API requests
        self.headers = {
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json'
        }
        
        # Ensure bucket exists
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Ensure the videos bucket exists, create if it doesn't."""
        try:
            # Try to list buckets
            response = requests.get(
                f"{self.supabase_url}/storage/v1/bucket",
                headers=self.headers
            )
            
            if response.status_code == 200:
                buckets = response.json()
                bucket_names = [bucket['name'] for bucket in buckets]
                
                if self.bucket_name not in bucket_names:
                    # Create bucket if it doesn't exist
                    create_response = requests.post(
                        f"{self.supabase_url}/storage/v1/bucket",
                        headers=self.headers,
                        json={
                            "id": self.bucket_name,
                            "name": self.bucket_name,
                            "public": True
                        }
                    )
                    
                    if create_response.status_code in [200, 201]:
                        print(f"✅ Created Supabase bucket: {self.bucket_name}")
                    else:
                        print(f"⚠️ Failed to create bucket: {create_response.text}")
                else:
                    print(f"📦 Using existing Supabase bucket: {self.bucket_name}")
            else:
                print(f"⚠️ Could not list buckets: {response.text}")
                
        except Exception as e:
            print(f"⚠️  Warning: Could not verify/create bucket: {e}")
            # Continue anyway - bucket might exist but not be listable
    
    def upload_video(self, video_path: str, topic: str, job_id: str = None, 
                    video_code: str = None, captions_file_path: str = None, 
                    audio_file_path: str = None, duration_seconds: float = None,
                    mega_plan: Dict = None, code_critique: Dict = None,
                    total_cost: float = None, cost_breakdown: Dict = None,
                    topic_directory: str = None, webhook_url: str = None,
                    keywords: list = None, clerk_user_id: str = None,
                    render_time_seconds: int = None, stage_timings: Dict = None) -> Optional[Dict[str, Any]]:
        """
        Upload a video file to Supabase Storage and store metadata in database.
        
        Args:
            video_path: Path to the local video file
            topic: Topic name for the video
            job_id: Optional job ID for tracking
            video_code: The Manim code used to generate the video
            captions_file_path: Path to captions file
            audio_file_path: Path to audio file
            duration_seconds: Video duration in seconds
            mega_plan: The mega plan used for generation
            code_critique: Code critique results
            total_cost: Total cost of generation
            cost_breakdown: Detailed cost breakdown
            topic_directory: Local directory where files are stored
            webhook_url: Webhook URL for notifications
            keywords: List of keywords for video discoverability
            clerk_user_id: Clerk user ID to associate video with user account
            
        Returns:
            Dictionary with upload results including public URL
        """
        try:
            if not Path(video_path).exists():
                raise FileNotFoundError(f"Video file not found: {video_path}")
            
            # Generate unique filename
            file_id = job_id or str(uuid.uuid4())
            safe_topic = self._sanitize_filename(topic)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{safe_topic}_{timestamp}_{file_id}.mp4"
            
            # Read video file
            with open(video_path, 'rb') as video_file:
                video_data = video_file.read()
            
            # Upload to Supabase Storage using direct HTTP API
            upload_headers = {
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'video/mp4',
                'Cache-Control': '3600'
            }
            
            upload_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{filename}"
            
            upload_response = requests.post(
                upload_url,
                headers=upload_headers,
                data=video_data
            )
            
            if upload_response.status_code in [200, 201]:
                # Get public URL
                public_url = f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{filename}"
                
                upload_data = {
                    "success": True,
                    "filename": filename,
                    "public_url": public_url,
                    "bucket": self.bucket_name,
                    "topic": topic,
                    "job_id": file_id,
                    "uploaded_at": datetime.utcnow().isoformat(),
                    "file_size": os.path.getsize(video_path),
                    "storage_path": f"{self.bucket_name}/{filename}"
                }
                
                # Store metadata in Supabase database
                try:
                    metadata_stored = self._store_video_metadata(
                        job_id=file_id,
                        topic=topic,
                        supabase_url=public_url,
                        supabase_filename=filename,
                        video_path=video_path,
                        video_code=video_code,
                        captions_file_path=captions_file_path,
                        audio_file_path=audio_file_path,
                        duration_seconds=duration_seconds,
                        mega_plan=mega_plan,
                        code_critique=code_critique,
                        total_cost=total_cost,
                        cost_breakdown=cost_breakdown,
                        topic_directory=topic_directory,
                        webhook_url=webhook_url,
                        keywords=keywords,
                        clerk_user_id=clerk_user_id,
                        render_time_seconds=render_time_seconds,
                        stage_timings=stage_timings
                    )
                    if metadata_stored:
                        print(f"✅ Video metadata stored in database")
                    else:
                        print(f"❌ Failed to store video metadata in database")
                except Exception as e:
                    print(f"⚠️ Warning: Failed to store metadata in database: {e}")
                
                print(f"✅ Video uploaded successfully: {public_url}")
                return upload_data
            else:
                print(f"❌ Upload failed: {upload_response.status_code} - {upload_response.text}")
                return {
                    "success": False,
                    "error": f"Upload failed: {upload_response.status_code} - {upload_response.text}",
                    "topic": topic,
                    "job_id": job_id
                }
                
        except Exception as e:
            print(f"❌ Error uploading video: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "topic": topic,
                "job_id": job_id
            }
    
    def get_video_url(self, filename: str, expires_in: int = 3600) -> Optional[str]:
        """
        Get a public URL for a video file.
        
        Args:
            filename: Name of the file in storage
            expires_in: URL expiration time in seconds (default: 1 hour) - not used for public URLs
            
        Returns:
            Public URL string or None if error
        """
        try:
            # For public buckets, we can use the public URL
            public_url = f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{filename}"
            return public_url
            
        except Exception as e:
            print(f"❌ Error getting video URL: {str(e)}")
            return None
    
    def delete_video(self, filename: str) -> bool:
        """
        Delete a video file from storage.
        
        Args:
            filename: Name of the file to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            delete_url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{filename}"
            
            response = requests.delete(delete_url, headers=self.headers)
            
            if response.status_code in [200, 204]:
                print(f"✅ Video deleted successfully: {filename}")
                return True
            else:
                print(f"❌ Failed to delete video: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error deleting video: {str(e)}")
            return False
    
    def list_videos(self, prefix: str = "", limit: int = 100) -> list:
        """
        List videos in the storage bucket.
        
        Args:
            prefix: Optional prefix to filter files
            limit: Maximum number of files to return
            
        Returns:
            List of file information dictionaries
        """
        try:
            list_url = f"{self.supabase_url}/storage/v1/object/list/{self.bucket_name}"
            
            response = requests.post(
                list_url,
                headers=self.headers,
                json={"prefix": prefix, "limit": limit}
            )
            
            if response.status_code == 200:
                files = response.json()
                
                # Filter by prefix if provided
                if prefix:
                    files = [f for f in files if f.get('name', '').startswith(prefix)]
                
                # Add public URLs to file info
                for file_info in files:
                    file_info['public_url'] = self.get_video_url(file_info.get('name', ''))
                
                return files
            else:
                print(f"❌ Error listing videos: {response.status_code} - {response.text}")
                return []
            
        except Exception as e:
            print(f"❌ Error listing videos: {str(e)}")
            return []
    
    def get_video_metadata(self, filename: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific video file.
        
        Args:
            filename: Name of the file
            
        Returns:
            Dictionary with file metadata or None if not found
        """
        try:
            # Get file info using Supabase Storage API
            info_url = f"{self.supabase_url}/storage/v1/object/info/{self.bucket_name}/{filename}"
            
            response = requests.get(info_url, headers=self.headers)
            
            if response.status_code == 200:
                file_info = response.json()
                return {
                    "filename": filename,
                    "size": file_info.get('size', 0),
                    "last_modified": file_info.get('last_modified', ''),
                    "content_type": file_info.get('content_type', 'video/mp4'),
                    "public_url": self.get_video_url(filename),
                    "bucket": self.bucket_name
                }
            else:
                print(f"❌ Error getting file info: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error getting video metadata: {str(e)}")
            return None
    
    def _store_video_metadata(self, job_id: str, topic: str, supabase_url: str, 
                            supabase_filename: str, video_path: str = None,
                            video_code: str = None, captions_file_path: str = None,
                            audio_file_path: str = None, duration_seconds: float = None,
                            mega_plan: Dict = None, code_critique: Dict = None,
                            total_cost: float = None, cost_breakdown: Dict = None,
                            topic_directory: str = None, webhook_url: str = None,
                            keywords: list = None, clerk_user_id: str = None,
                            render_time_seconds: int = None, stage_timings: Dict = None) -> bool:
        """
        Store video metadata in Supabase database.
        
        Args:
            job_id: Unique job identifier
            topic: Video topic
            supabase_url: Public URL of uploaded video
            supabase_filename: Filename in Supabase storage
            video_path: Local path to video file
            video_code: Manim code used
            captions_file_path: Path to captions file
            audio_file_path: Path to audio file
            duration_seconds: Video duration
            mega_plan: Generation plan data
            code_critique: Code critique results
            total_cost: Total generation cost
            cost_breakdown: Cost breakdown details
            topic_directory: Local directory path
            webhook_url: Webhook URL
            keywords: List of keywords for video discoverability
            clerk_user_id: Clerk user ID to associate video with user
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Generate a secure random share token (32 hex characters)
            share_token = secrets.token_hex(16)
            
            # Prepare metadata for database insertion
            metadata = {
                "job_id": job_id,
                "topic": topic,
                "supabase_url": supabase_url,
                "supabase_filename": supabase_filename,
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "is_public": False,  # Videos are private by default, users must explicitly make them public
                "share_token": share_token  # Generate unique token for sharing
            }
            
            # Convert clerk_user_id to Supabase user_id if provided
            if clerk_user_id:
                try:
                    # Query the users table to get the Supabase user ID from clerk_user_id
                    users_url = f"{self.supabase_url}/rest/v1/users"
                    users_headers = {
                        'Authorization': f'Bearer {self.supabase_key}',
                        'apikey': self.supabase_key,
                        'Content-Type': 'application/json'
                    }
                    
                    response = requests.get(
                        users_url,
                        headers=users_headers,
                        params={"clerk_user_id": f"eq.{clerk_user_id}", "select": "id"}
                    )
                    
                    if response.status_code == 200:
                        users = response.json()
                        if users and len(users) > 0:
                            metadata["user_id"] = users[0]["id"]
                            print(f"✅ Associated video with user: {clerk_user_id} -> {users[0]['id']}")
                        else:
                            print(f"⚠️ No Supabase user found for Clerk ID: {clerk_user_id}")
                    else:
                        print(f"⚠️ Failed to query users table: {response.status_code} - {response.text}")
                except Exception as e:
                    print(f"⚠️ Failed to resolve user ID: {e}")
            
            # Add optional fields if provided
            if video_path:
                metadata["local_video_path"] = str(video_path)
                # Get file size if file exists
                if Path(video_path).exists():
                    metadata["file_size_bytes"] = os.path.getsize(video_path)
            
            if video_code:
                metadata["video_code"] = video_code
            
            if captions_file_path:
                metadata["captions_file_path"] = str(captions_file_path)
            
            if audio_file_path:
                metadata["audio_file_path"] = str(audio_file_path)
            
            if duration_seconds:
                metadata["duration_seconds"] = duration_seconds
            
            if mega_plan:
                metadata["mega_plan"] = mega_plan  # Let PostgreSQL handle JSONB conversion
            
            if code_critique:
                metadata["code_critique"] = code_critique  # Let PostgreSQL handle JSONB conversion
            
            if total_cost:
                metadata["total_cost"] = total_cost
            
            if cost_breakdown:
                metadata["cost_breakdown"] = cost_breakdown  # Let PostgreSQL handle JSONB conversion
            
            if topic_directory:
                metadata["topic_directory"] = str(topic_directory)
            
            if webhook_url:
                metadata["webhook_url"] = webhook_url
            
            if keywords:
                metadata["keywords"] = keywords  # PostgreSQL will handle array conversion
            
            if render_time_seconds:
                metadata["render_time_seconds"] = render_time_seconds
            
            if stage_timings:
                metadata["stage_timings"] = stage_timings  # Let PostgreSQL handle JSONB conversion
            
            # Insert into Supabase database
            db_url = f"{self.supabase_url}/rest/v1/video_metadata"
            
            # Use appropriate headers for PostgreSQL/Supabase
            db_headers = {
                'Authorization': f'Bearer {self.supabase_key}',
                'apikey': self.supabase_key,  # Supabase requires both Authorization and apikey
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'  # Don't return the inserted data
            }
            
            response = requests.post(
                db_url,
                headers=db_headers,
                json=metadata
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Video metadata stored in database for job: {job_id}")
                return True
            else:
                print(f"❌ Failed to store metadata: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error storing video metadata: {str(e)}")
            return False

    def _sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename for storage.
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename safe for storage
        """
        # Remove special characters and spaces
        safe_name = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_name = safe_name.replace(' ', '_')
        
        # Limit length
        if len(safe_name) > 50:
            safe_name = safe_name[:50]
        
        return safe_name or "video"
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get storage usage statistics.
        
        Returns:
            Dictionary with storage statistics
        """
        try:
            files = self.list_videos()
            
            total_size = sum(f.get('size', 0) for f in files)
            total_files = len(files)
            
            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "bucket_name": self.bucket_name,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Error getting storage stats: {str(e)}")
            return {
                "error": str(e),
                "bucket_name": self.bucket_name
            }


# Convenience functions for easy import
def get_storage_service() -> SupabaseStorageService:
    """Get a configured Supabase storage service instance."""
    return SupabaseStorageService()


def upload_video(video_path: str, topic: str, job_id: str = None) -> Optional[Dict[str, Any]]:
    """
    Convenience function to upload a video.
    
    Args:
        video_path: Path to the local video file
        topic: Topic name for the video
        job_id: Optional job ID for tracking
        
    Returns:
        Dictionary with upload results
    """
    service = get_storage_service()
    return service.upload_video(video_path, topic, job_id)


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Supabase Storage Service...")
    
    try:
        # Initialize service
        storage = SupabaseStorageService()
        
        # Get storage stats
        stats = storage.get_storage_stats()
        print(f"📊 Storage Stats: {stats}")
        
        # List existing videos
        videos = storage.list_videos()
        print(f"📹 Found {len(videos)} videos in storage")
        
        print("✅ Supabase Storage Service test completed")
        
    except Exception as e:
        print(f"❌ Storage service test failed: {e}")