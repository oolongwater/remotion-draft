#!/usr/bin/env python3
"""
Cache Service for Video Generation Results

This service handles caching of video generation results based on normalized prompts.
Cache entries are stored in GCS bucket at cache/{normalized-prompt}.json
"""

import json
import re
from datetime import datetime
from typing import Any, Dict, Optional

from services.gcs_storage import GCSStorageService


def normalize_prompt(prompt: str) -> str:
    """
    Normalize a prompt to create a consistent cache key.
    
    Args:
        prompt: Original prompt text
        
    Returns:
        Normalized prompt string safe for use as filename
    """
    if not prompt:
        return ""
    
    # Convert to lowercase and strip whitespace
    normalized = prompt.lower().strip()
    
    # Replace spaces and special characters with hyphens
    # Keep only alphanumeric characters and hyphens
    normalized = re.sub(r'[^a-z0-9\s-]', '', normalized)
    normalized = re.sub(r'\s+', '-', normalized)
    
    # Remove multiple consecutive hyphens
    normalized = re.sub(r'-+', '-', normalized)
    
    # Remove leading/trailing hyphens
    normalized = normalized.strip('-')
    
    # Limit length to avoid filesystem issues (max 200 chars)
    if len(normalized) > 200:
        normalized = normalized[:200]
    
    return normalized


class CacheService:
    """Service for managing video generation result cache."""
    
    def __init__(self, bucket_name: str = "vid-gen-static"):
        """
        Initialize cache service with GCS storage.
        
        Args:
            bucket_name: Name of the GCS bucket (default: vid-gen-static)
        """
        self.bucket_name = bucket_name
        self.gcs_service = GCSStorageService(bucket_name=bucket_name)
        self.cache_prefix = "cache"
    
    def get_cache_key(self, normalized_prompt: str) -> str:
        """
        Generate cache key (GCS path) for a normalized prompt.
        
        Args:
            normalized_prompt: Normalized prompt string
            
        Returns:
            GCS path for cache file
        """
        if not normalized_prompt:
            raise ValueError("Normalized prompt cannot be empty")
        
        return f"{self.cache_prefix}/{normalized_prompt}.json"
    
    def get_cache(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached result for a prompt.
        
        Args:
            prompt: Original prompt text
            
        Returns:
            Cached data dictionary if found, None otherwise
        """
        try:
            normalized = normalize_prompt(prompt)
            if not normalized:
                return None
            
            cache_key = self.get_cache_key(normalized)
            
            # Try to read from GCS
            try:
                blob = self.gcs_service.bucket.blob(cache_key)
                if not blob.exists():
                    return None
                
                # Download and parse JSON
                cache_data_str = blob.download_as_text()
                cache_data = json.loads(cache_data_str)
                
                print(f"✓ Cache hit for prompt: {prompt[:50]}...")
                return cache_data
                
            except Exception as e:
                # Cache read failed, treat as cache miss
                print(f"⚠️  Cache read error (treating as miss): {type(e).__name__}: {e}")
                return None
                
        except Exception as e:
            print(f"⚠️  Cache lookup error: {type(e).__name__}: {e}")
            return None
    
    def store_cache(self, prompt: str, cache_data: Dict[str, Any]) -> bool:
        """
        Store cache result for a prompt.
        
        Args:
            prompt: Original prompt text
            cache_data: Dictionary containing cache data to store
            
        Returns:
            True if successful, False otherwise
        """
        try:
            normalized = normalize_prompt(prompt)
            if not normalized:
                print(f"⚠️  Cannot cache: normalized prompt is empty")
                return False
            
            cache_key = self.get_cache_key(normalized)
            
            # Add timestamp if not present
            if "metadata" in cache_data and "created_at" not in cache_data["metadata"]:
                cache_data["metadata"]["created_at"] = datetime.utcnow().isoformat() + "Z"
            
            # Convert to JSON string
            cache_json = json.dumps(cache_data, indent=2)
            
            # Upload to GCS
            try:
                blob = self.gcs_service.bucket.blob(cache_key)
                blob.upload_from_string(
                    cache_json,
                    content_type="application/json"
                )
                
                # Make publicly readable (optional, but useful for debugging)
                blob.make_public()
                
                print(f"✓ Cache stored: {cache_key}")
                return True
                
            except Exception as e:
                print(f"⚠️  Cache storage error (non-fatal): {type(e).__name__}: {e}")
                return False
                
        except Exception as e:
            print(f"⚠️  Cache storage error (non-fatal): {type(e).__name__}: {e}")
            return False


# Convenience function for easy import
def get_cache_service(bucket_name: str = "vid-gen-static") -> CacheService:
    """Get a configured cache service instance."""
    return CacheService(bucket_name=bucket_name)


# Example usage
if __name__ == "__main__":
    print("🧪 Testing Cache Service...")
    
    try:
        cache = CacheService()
        
        # Test normalization
        test_prompts = [
            "Explain Photosynthesis",
            "explain photosynthesis",
            "Explain  Photosynthesis!!!",
            "What is Machine Learning?",
        ]
        
        for prompt in test_prompts:
            normalized = normalize_prompt(prompt)
            print(f"  '{prompt}' -> '{normalized}'")
        
        print("✅ Cache Service test completed")
        
    except Exception as e:
        print(f"❌ Cache service test failed: {e}")

