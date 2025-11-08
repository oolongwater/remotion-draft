#!/usr/bin/env python3
"""
Google Cloud Storage Service for Video Upload

This service handles video file uploads to GCS bucket,
providing public URLs for uploaded videos.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

try:
    from google.cloud import storage
    from google.cloud.exceptions import NotFound
    from google.oauth2 import service_account
except ImportError:
    print("⚠️  google-cloud-storage not installed. Install with: pip install google-cloud-storage")
    storage = None
    service_account = None
    NotFound = Exception


class GCSStorageService:
    """Service for managing video uploads to Google Cloud Storage."""
    
    def __init__(self, bucket_name: str = "vid-gen-static"):
        """
        Initialize GCS client and storage configuration.
        
        Args:
            bucket_name: Name of the GCS bucket (default: vid-gen-static)
        """
        if storage is None:
            raise ImportError(
                "google-cloud-storage is required. Install with: pip install google-cloud-storage"
            )
        
        self.bucket_name = bucket_name
        
        # Initialize GCS client with credentials
        # Credentials are loaded from (in order):
        # 1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to service account JSON file)
        # 2. GCP_SERVICE_ACCOUNT_JSON environment variable (JSON string from Modal secret)
        # 3. Default credentials from gcloud CLI or compute instance
        credentials = self._get_credentials()
        
        try:
            if credentials:
                self.client = storage.Client(credentials=credentials)
                print(f"✓ GCS client initialized with service account credentials")
            else:
                self.client = storage.Client()
                print(f"✓ GCS client initialized with default credentials")
        except Exception as e:
            print(f"⚠️  Warning: Could not initialize GCS client: {e}")
            print("   Make sure GCP credentials are configured via Modal secret or environment variable")
            raise
        
        # Get or create bucket
        self._ensure_bucket_exists()
    
    def _get_credentials(self):
        """
        Get GCP credentials from environment variables or default.
        
        Returns:
            Credentials object or None to use default credentials
        """
        # Check for GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)
        creds_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if creds_path and Path(creds_path).exists():
            try:
                if service_account:
                    return service_account.Credentials.from_service_account_file(creds_path)
            except Exception as e:
                print(f"⚠️  Warning: Could not load credentials from {creds_path}: {e}")
        
        # Check for GCP_SERVICE_ACCOUNT_JSON (JSON string from Modal secret)
        json_creds = os.getenv('GCP_SERVICE_ACCOUNT_JSON')
        if json_creds:
            try:
                # Parse JSON string
                creds_dict = json.loads(json_creds)
                if service_account:
                    return service_account.Credentials.from_service_account_info(creds_dict)
            except json.JSONDecodeError as e:
                print(f"⚠️  Warning: Invalid JSON in GCP_SERVICE_ACCOUNT_JSON: {e}")
            except Exception as e:
                print(f"⚠️  Warning: Could not load credentials from GCP_SERVICE_ACCOUNT_JSON: {e}")
        
        # Fall back to default credentials
        return None
    
    def _ensure_bucket_exists(self):
        """Ensure the bucket exists, create if it doesn't."""
        try:
            try:
                self.bucket = self.client.bucket(self.bucket_name)
                # Try to get bucket metadata to verify it exists
                self.bucket.reload()
                print(f"📦 Using existing GCS bucket: {self.bucket_name}")
            except NotFound:
                # Bucket doesn't exist, create it
                print(f"📦 Creating GCS bucket: {self.bucket_name}")
                self.bucket = self.client.create_bucket(self.bucket_name)
                print(f"✅ Created GCS bucket: {self.bucket_name}")
                print(f"   Note: Bucket is assumed to have public access configured")
        except Exception as e:
            print(f"⚠️  Warning: Could not verify/create bucket: {e}")
            # Try to continue anyway - bucket might exist but not be accessible
            try:
                self.bucket = self.client.bucket(self.bucket_name)
            except Exception:
                raise
    
    def upload_file(
        self,
        local_path: str,
        gcs_path: Optional[str] = None,
        content_type: str = "video/mp4",
        metadata: Optional[Dict[str, str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Upload a file to GCS bucket.
        
        Args:
            local_path: Path to the local file
            gcs_path: Optional GCS object path (default: filename from local_path)
            content_type: MIME type of the file (default: video/mp4)
            metadata: Optional metadata dictionary to attach to the object
            
        Returns:
            Dictionary with upload results including public URL
        """
        try:
            if not Path(local_path).exists():
                raise FileNotFoundError(f"File not found: {local_path}")
            
            # Determine GCS object path
            if gcs_path is None:
                gcs_path = Path(local_path).name
            
            # Create blob
            blob = self.bucket.blob(gcs_path)
            
            # Set content type
            blob.content_type = content_type
            
            # Set metadata if provided
            if metadata:
                blob.metadata = metadata
            
            # Set cache control for public access
            blob.cache_control = "public, max-age=3600"
            
            # Upload file
            print(f"📤 Uploading {Path(local_path).name} to gs://{self.bucket_name}/{gcs_path}...")
            blob.upload_from_filename(local_path)
            
            # Make blob publicly accessible
            blob.make_public()
            
            # Get public URL
            public_url = blob.public_url
            
            file_size = Path(local_path).stat().st_size
            
            upload_data = {
                "success": True,
                "filename": gcs_path,
                "public_url": public_url,
                "bucket": self.bucket_name,
                "uploaded_at": datetime.utcnow().isoformat(),
                "file_size": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
                "storage_path": f"{self.bucket_name}/{gcs_path}"
            }
            
            print(f"✅ File uploaded successfully: {public_url}")
            return upload_data
            
        except Exception as e:
            print(f"❌ Error uploading file: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "local_path": local_path,
                "gcs_path": gcs_path
            }
    
    def upload_scene_video(
        self,
        video_path: str,
        job_id: str,
        section_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Upload a single scene video to GCS.
        
        Args:
            video_path: Path to the local video file
            job_id: Job identifier
            section_num: Section number (1-indexed)
            
        Returns:
            Dictionary with upload results
        """
        # Create GCS path: {job_id}/section_{section_num}.mp4
        gcs_path = f"{job_id}/section_{section_num}.mp4"
        
        metadata = {
            "job_id": job_id,
            "section_num": str(section_num),
            "type": "scene"
        }
        
        return self.upload_file(
            local_path=video_path,
            gcs_path=gcs_path,
            content_type="video/mp4",
            metadata=metadata
        )
    
    def upload_final_video(
        self,
        video_path: str,
        job_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Upload the final combined video to GCS.
        
        Args:
            video_path: Path to the local video file
            job_id: Job identifier
            
        Returns:
            Dictionary with upload results
        """
        # Create GCS path: {job_id}/final.mp4
        gcs_path = f"{job_id}/final.mp4"
        
        metadata = {
            "job_id": job_id,
            "type": "final"
        }
        
        return self.upload_file(
            local_path=video_path,
            gcs_path=gcs_path,
            content_type="video/mp4",
            metadata=metadata
        )
    
    def get_public_url(self, gcs_path: str) -> str:
        """
        Get public URL for a file in GCS.
        
        Args:
            gcs_path: Path to the file in GCS bucket
            
        Returns:
            Public URL string
        """
        blob = self.bucket.blob(gcs_path)
        return blob.public_url
    
    def delete_file(self, gcs_path: str) -> bool:
        """
        Delete a file from GCS bucket.
        
        Args:
            gcs_path: Path to the file in GCS bucket
            
        Returns:
            True if successful, False otherwise
        """
        try:
            blob = self.bucket.blob(gcs_path)
            blob.delete()
            print(f"✅ File deleted successfully: {gcs_path}")
            return True
        except NotFound:
            print(f"⚠️  File not found: {gcs_path}")
            return False
        except Exception as e:
            print(f"❌ Error deleting file: {str(e)}")
            return False
    
    def list_files(self, prefix: str = "", limit: int = 100) -> list:
        """
        List files in the GCS bucket.
        
        Args:
            prefix: Optional prefix to filter files
            limit: Maximum number of files to return
            
        Returns:
            List of blob information dictionaries
        """
        try:
            blobs = self.bucket.list_blobs(prefix=prefix, max_results=limit)
            
            files = []
            for blob in blobs:
                files.append({
                    "name": blob.name,
                    "size": blob.size,
                    "content_type": blob.content_type,
                    "time_created": blob.time_created.isoformat() if blob.time_created else None,
                    "public_url": blob.public_url
                })
            
            return files
        except Exception as e:
            print(f"❌ Error listing files: {str(e)}")
            return []


# Convenience functions for easy import
def get_gcs_storage_service(bucket_name: str = "vid-gen-static") -> GCSStorageService:
    """Get a configured GCS storage service instance."""
    return GCSStorageService(bucket_name=bucket_name)


def upload_scene_video(video_path: str, job_id: str, section_num: int) -> Optional[Dict[str, Any]]:
    """
    Convenience function to upload a scene video.
    
    Args:
        video_path: Path to the local video file
        job_id: Job identifier
        section_num: Section number (1-indexed)
        
    Returns:
        Dictionary with upload results
    """
    service = get_gcs_storage_service()
    return service.upload_scene_video(video_path, job_id, section_num)


def upload_final_video(video_path: str, job_id: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function to upload the final video.
    
    Args:
        video_path: Path to the local video file
        job_id: Job identifier
        
    Returns:
        Dictionary with upload results
    """
    service = get_gcs_storage_service()
    return service.upload_final_video(video_path, job_id)


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing GCS Storage Service...")
    
    try:
        # Initialize service
        storage = GCSStorageService()
        
        # List existing files
        files = storage.list_files()
        print(f"📹 Found {len(files)} files in storage")
        
        print("✅ GCS Storage Service test completed")
        
    except Exception as e:
        print(f"❌ Storage service test failed: {e}")

